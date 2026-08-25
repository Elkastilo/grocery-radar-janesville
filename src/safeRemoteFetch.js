const dns = require("dns").promises;
const https = require("https");
const net = require("net");

const DEFAULTS = Object.freeze({
  connectTimeoutMs: 5000,
  totalTimeoutMs: 12000,
  maxRedirects: 3,
  maxBytes: 1024 * 1024,
  userAgent: "GroceryRadarProductImporter/1.0 (+https://thegroceryradar.com)"
});

const CATEGORY_DEFAULTS = Object.freeze({
  connectTimeoutMs: 5000,
  totalTimeoutMs: 18000,
  maxRedirects: 3,
  maxBytes: 5 * 1024 * 1024,
  userAgent: DEFAULTS.userAgent
});

class SafeFetchError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function ipv4Number(address) {
  return address.split(".").reduce((value, part) => (value * 256) + Number(part), 0) >>> 0;
}

function inV4Range(value, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (ipv4Number(base) & mask);
}

function isPublicIpv4(address) {
  const value = ipv4Number(address);
  const blocked = [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
    ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
    ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4]
  ];
  return !blocked.some(([base, bits]) => inV4Range(value, base, bits));
}

function expandIpv6(address) {
  let value = address.toLowerCase().split("%")[0];
  if (value.includes(".")) {
    const lastColon = value.lastIndexOf(":");
    const ipv4 = value.slice(lastColon + 1);
    if (net.isIP(ipv4) !== 4) return null;
    const number = ipv4Number(ipv4);
    value = `${value.slice(0, lastColon)}:${((number >>> 16) & 0xffff).toString(16)}:${(number & 0xffff).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const parts = [...left, ...Array(missing).fill("0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.reduce((result, part) => (result << 16n) | BigInt(`0x${part}`), 0n);
}

function isPublicIpv6(address) {
  const value = expandIpv6(address);
  if (value === null) return false;
  const prefix = (bits) => value >> BigInt(128 - bits);
  if (value === 0n || value === 1n) return false;
  if (prefix(7) === 0x7en || prefix(10) === 0x3fan || prefix(8) === 0xffn) return false;
  if (prefix(32) === 0x20010db8n || prefix(32) === 0x20010000n || prefix(16) === 0x2002n) return false;
  if (prefix(96) === 0xffffn) {
    const embedded = Number(value & 0xffffffffn);
    const address4 = [24, 16, 8, 0].map((shift) => (embedded >>> shift) & 255).join(".");
    return isPublicIpv4(address4);
  }
  return prefix(3) === 1n;
}

function isPublicAddress(address) {
  const kind = net.isIP(address);
  return kind === 4 ? isPublicIpv4(address) : kind === 6 ? isPublicIpv6(address) : false;
}

function validateRemoteUrl(input) {
  let url;
  try { url = new URL(String(input || "")); } catch { throw new SafeFetchError("INVALID_URL", "Enter a valid HTTPS product URL."); }
  if (url.protocol !== "https:") throw new SafeFetchError("UNSUPPORTED_PROTOCOL", "Only HTTPS product URLs are allowed.");
  if (url.username || url.password) throw new SafeFetchError("URL_CREDENTIALS", "URLs containing credentials are not allowed.");
  if (url.port && url.port !== "443") throw new SafeFetchError("UNSAFE_PORT", "Only the standard HTTPS port is allowed.");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || hostname.length > 253 || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localdomain") || !hostname.includes(".")) {
    throw new SafeFetchError("PRIVATE_HOST", "Private or internal hosts are not allowed.");
  }
  if (hostname === "metadata.google.internal" || hostname.endsWith(".onrender.com") || hostname.endsWith(".render.internal")) {
    throw new SafeFetchError("PRIVATE_HOST", "Cloud metadata and internal service hosts are not allowed.");
  }
  if (net.isIP(hostname) && !isPublicAddress(hostname)) throw new SafeFetchError("PRIVATE_ADDRESS", "Private or reserved network addresses are not allowed.");
  url.hash = "";
  return url;
}

async function resolveAndValidate(hostname, resolver = dns.lookup) {
  const results = await resolver(hostname, { all: true, verbatim: true });
  const addresses = Array.isArray(results) ? results : [results];
  if (!addresses.length || addresses.some((entry) => !entry?.address || !isPublicAddress(entry.address))) {
    throw new SafeFetchError("PRIVATE_ADDRESS", "The product URL resolved to a private or reserved network address.");
  }
  return addresses.map((entry) => ({ address: entry.address, family: entry.family || net.isIP(entry.address) }));
}

function requestHttps(url, addresses, options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (!settled) { settled = true; callback(value); } };
    const request = https.request(url, {
      method: "GET",
      headers: { "User-Agent": options.userAgent, Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity" },
      lookup: (_hostname, lookupOptions, callback) => {
        const family = typeof lookupOptions === "object" ? lookupOptions.family : 0;
        const eligible = family ? addresses.filter((entry) => entry.family === family) : addresses;
        if (!eligible.length) return callback(new Error("No validated address for requested family."));
        if (lookupOptions?.all) return callback(null, eligible);
        callback(null, eligible[0].address, eligible[0].family);
      }
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > options.maxBytes) {
          request.destroy(new SafeFetchError("RESPONSE_TOO_LARGE", "The retailer response exceeded the importer size limit.", 413));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => finish(resolve, { statusCode: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.setTimeout(options.connectTimeoutMs, () => request.destroy(new SafeFetchError("REQUEST_TIMEOUT", "The retailer did not respond in time.", 504)));
    request.on("error", (error) => finish(reject, error));
    request.end();
  });
}

function requestHttpsBuffer(url, addresses, options) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (!settled) { settled = true; callback(value); } };
    const request = https.request(url, {
      method: "GET",
      headers: { "User-Agent": options.userAgent, Accept: options.accept || "image/webp,image/png,image/jpeg", "Accept-Encoding": "identity" },
      lookup: (_hostname, lookupOptions, callback) => {
        const family = typeof lookupOptions === "object" ? lookupOptions.family : 0;
        const eligible = family ? addresses.filter((entry) => entry.family === family) : addresses;
        if (!eligible.length) return callback(new Error("No validated address for requested family."));
        if (lookupOptions?.all) return callback(null, eligible);
        callback(null, eligible[0].address, eligible[0].family);
      }
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > options.maxBytes) {
          request.destroy(new SafeFetchError("RESPONSE_TOO_LARGE", options.sizeErrorMessage || "The remote response exceeded the safety limit.", 413));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => finish(resolve, { statusCode: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.setTimeout(options.connectTimeoutMs, () => request.destroy(new SafeFetchError("REQUEST_TIMEOUT", "The remote server did not respond in time.", 504)));
    request.on("error", (error) => finish(reject, error));
    request.end();
  });
}

async function safeRemoteFetch(input, custom = {}) {
  const options = { ...DEFAULTS, ...custom };
  const resolver = custom.resolveHost || dns.lookup;
  const requester = custom.requestOnce || requestHttps;
  const operation = async () => {
    let current = validateRemoteUrl(input);
    for (let redirect = 0; redirect <= options.maxRedirects; redirect += 1) {
      const hostname = current.hostname.replace(/^\[|\]$/g, "");
      const addresses = await resolveAndValidate(hostname, resolver);
      const result = await requester(current, addresses, options);
      if ([301, 302, 303, 307, 308].includes(result.statusCode)) {
        if (redirect >= options.maxRedirects) throw new SafeFetchError("TOO_MANY_REDIRECTS", "The retailer redirected too many times.", 502);
        if (!result.headers?.location) throw new SafeFetchError("INVALID_REDIRECT", "The retailer returned an invalid redirect.", 502);
        current = validateRemoteUrl(new URL(result.headers.location, current).toString());
        continue;
      }
      if ([401, 403, 429].includes(result.statusCode)) throw new SafeFetchError("RETAILER_BLOCKED", "Retailer blocked automated retrieval.", 422);
      if (result.statusCode < 200 || result.statusCode >= 300) throw new SafeFetchError("REMOTE_STATUS", `Retailer returned HTTP ${result.statusCode}.`, 502);
      const contentType = String(result.headers?.["content-type"] || "").toLowerCase();
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new SafeFetchError("UNSUPPORTED_CONTENT", "The URL did not return an HTML product page.", 422);
      if (Buffer.byteLength(result.body || "") > options.maxBytes) throw new SafeFetchError("RESPONSE_TOO_LARGE", "The retailer response exceeded the importer size limit.", 413);
      return { url: current.toString(), statusCode: result.statusCode, contentType, body: result.body || "" };
    }
    throw new SafeFetchError("TOO_MANY_REDIRECTS", "The retailer redirected too many times.", 502);
  };
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new SafeFetchError("REQUEST_TIMEOUT", "The retailer request exceeded the total time limit.", 504)), options.totalTimeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

function safeCategoryRemoteFetch(input, custom = {}) {
  return safeRemoteFetch(input, { ...CATEGORY_DEFAULTS, ...custom });
}

async function safeRemoteBufferFetch(input, custom = {}) {
  const options = {
    ...DEFAULTS,
    maxBytes: 4 * 1024 * 1024,
    totalTimeoutMs: 15000,
    accept: "image/webp,image/png,image/jpeg",
    sizeErrorMessage: "The remote image exceeded the 4 MiB safety limit.",
    ...custom
  };
  const resolver = custom.resolveHost || dns.lookup;
  const requester = custom.requestOnce || requestHttpsBuffer;
  const allowedContentTypes = custom.allowedContentTypes || ["image/jpeg", "image/png", "image/webp"];
  const operation = async () => {
    let current = validateRemoteUrl(input);
    for (let redirect = 0; redirect <= options.maxRedirects; redirect += 1) {
      const hostname = current.hostname.replace(/^\[|\]$/g, "");
      const addresses = await resolveAndValidate(hostname, resolver);
      const result = await requester(current, addresses, options);
      if ([301, 302, 303, 307, 308].includes(result.statusCode)) {
        if (redirect >= options.maxRedirects) throw new SafeFetchError("TOO_MANY_REDIRECTS", "The remote image redirected too many times.", 502);
        if (!result.headers?.location) throw new SafeFetchError("INVALID_REDIRECT", "The remote server returned an invalid redirect.", 502);
        current = validateRemoteUrl(new URL(result.headers.location, current).toString());
        continue;
      }
      if ([401, 403, 429].includes(result.statusCode)) throw new SafeFetchError("RETAILER_BLOCKED", "Retailer blocked automated retrieval.", 422);
      if (result.statusCode < 200 || result.statusCode >= 300) throw new SafeFetchError("REMOTE_STATUS", `Remote image returned HTTP ${result.statusCode}.`, 502);
      const contentType = String(result.headers?.["content-type"] || "").split(";")[0].trim().toLowerCase();
      if (!allowedContentTypes.includes(contentType)) throw new SafeFetchError("UNSUPPORTED_CONTENT", "The image URL did not return a supported raster image.", 422);
      const body = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body || "");
      if (body.length > options.maxBytes) throw new SafeFetchError("RESPONSE_TOO_LARGE", options.sizeErrorMessage, 413);
      return { url: current.toString(), statusCode: result.statusCode, contentType, body };
    }
    throw new SafeFetchError("TOO_MANY_REDIRECTS", "The remote image redirected too many times.", 502);
  };
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new SafeFetchError("REQUEST_TIMEOUT", "The remote image request exceeded the total time limit.", 504)), options.totalTimeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}

module.exports = { DEFAULTS, CATEGORY_DEFAULTS, SafeFetchError, isPublicAddress, validateRemoteUrl, resolveAndValidate, safeRemoteFetch, safeCategoryRemoteFetch, safeRemoteBufferFetch };
