const CONFIDENCE = Object.freeze({ unknown: 0, low: 1, medium: 2, high: 3 });
const { RETAILERS, retailerDefinition } = require("./importers/registry");
const DOMAIN_RETAILERS = Object.freeze(RETAILERS.filter((entry) => entry.domains.length).map((entry) => ({ domains: entry.domains, names: [entry.label.toLowerCase(), entry.id] })));

function text(value, limit = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeRetailerText(value, limit = 500) {
  const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  const withoutMarkup = String(value ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/?(?:li|p|div|ul|ol|span)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return text(withoutMarkup.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const number = lower[1] === "x" ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    }
    return entities[lower] || "";
  }), limit);
}

function decodeHtml(value) {
  return normalizeRetailerText(value);
}

function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const cleaned = text(value, 80).replace(/,/g, "");
  if (!cleaned || /^\s*-\s*(?:\$|USD)?/i.test(cleaned)) return null;
  if (/\b(?:ratings?|reviews?|stars?|product\s*id|item\s*id|sku|upc|gtin|percent|percentage)\b/i.test(cleaned) || /%/.test(cleaned)) return null;
  const multiBuy = cleaned.match(/\b(\d+)\s*\/\s*\$\s*(\d+(?:\.\d{1,2})?)\b/i);
  if (multiBuy) {
    const quantity = Number(multiBuy[1]);
    const total = Number(multiBuy[2]);
    return quantity > 0 && total > 0 ? Number((total / quantity).toFixed(4)) : null;
  }
  const totalForQuantity = cleaned.match(/\$\s*(\d+(?:\.\d{1,2})?)\s*(?:for|\/)\s*(\d+)\b/i);
  if (totalForQuantity) {
    const total = Number(totalForQuantity[1]);
    const quantity = Number(totalForQuantity[2]);
    return quantity > 0 && total > 0 ? Number((total / quantity).toFixed(4)) : null;
  }
  const match = cleaned.match(/(?:\$|USD\s*)?(-?\d+(?:\.\d{1,2})?)/i);
  const number = match ? Number(match[1]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

const TRACKING_QUERY_PATTERN = /^(?:utm_[a-z0-9_]+|gclid|dclid|fbclid|msclkid|campaign|campaignid|adid|ref|ref_|source|affiliates_ad_id|ath[a-z0-9_]+|veh)$/i;
const INVALID_IMAGE_PATTERN = /(?:^|[\/_-])(?:logo|favicon|sprite|spacer|tracking|pixel|placeholder|blank)(?:[\/_\-.]|$)/i;

function normalizeProductUrl(value, baseUrl = "") {
  if (!String(value || "").trim()) return "";
  try {
    const parsed = new URL(String(value || ""), baseUrl || undefined);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "";
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) if (TRACKING_QUERY_PATTERN.test(key)) parsed.searchParams.delete(key);
    return parsed.toString();
  } catch { return ""; }
}

function normalizeImageUrl(value, baseUrl = "") {
  const normalized = normalizeProductUrl(value, baseUrl);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    if (/\.svg(?:$|\?)/i.test(parsed.pathname) || INVALID_IMAGE_PATTERN.test(parsed.pathname)) return "";
    const width = Number(parsed.searchParams.get("width") || parsed.searchParams.get("w"));
    const height = Number(parsed.searchParams.get("height") || parsed.searchParams.get("h"));
    if ((width > 0 && width < 40) || (height > 0 && height < 40)) return "";
    return normalized;
  } catch { return ""; }
}

function suspiciousProductName(value) {
  const name = normalizeRetailerText(value, 200);
  if (name.length < 2 || name.length > 160) return true;
  return /^(?:home|menu|search|search results?|shop|products?|product details?|departments?|categories|weekly ad|sign in|account|cart|learn more|view all|next|previous)$/i.test(name)
    || /\b(?:cookie policy|privacy policy|terms of use|skip to|customer service)\b/i.test(name);
}

function validateProductFields(fields = {}, options = {}) {
  const reasons = [];
  const warnings = [];
  const name = normalizeRetailerText(fields.name || fields.productName, 200);
  const price = parsePrice(fields.price);
  const source = normalizeProductUrl(fields.product_url || fields.source_url);
  if (!name) reasons.push("name_required");
  else if (suspiciousProductName(name)) reasons.push("name_suspicious");
  if (price === null) reasons.push("price_required");
  else if (price > (Number(options.maximumPrice) || 1000)) reasons.push("price_suspicious");
  if (!source) reasons.push("source_required");
  if (options.retailerRecognized === false) reasons.push("retailer_required");
  const titlePackage = packageFromProductTitle(name);
  if (titlePackage.raw_text && !normalizePackage(fields.raw_size_text || fields.size_text).raw_text) reasons.push("size_required");
  const regular = parsePrice(fields.regular_price);
  if (fields.price_conflict === true || (regular !== null && price !== null && regular <= price)) reasons.push("price_conflict");
  if (fields.image_url && !normalizeImageUrl(fields.image_url, source)) warnings.push("Image URL was invalid or appeared to be a placeholder.");
  if (!normalizePackage(fields.raw_size_text || fields.size_text).raw_text) warnings.push("Package size was not available; confirm it when the retailer provides one.");
  return { ready: reasons.length === 0, status: reasons.length === 0 ? "ready" : "needs_review", reasons, warnings };
}

function normalizeUnit(value) {
  const key = text(value, 30).toLowerCase().replace(/[.\s_-]+/g, "");
  return ({ floz: "fl oz", fluidounce: "fl oz", fluidounces: "fl oz", oz: "oz", ounce: "oz", ounces: "oz", lb: "lb", lbs: "lb", pound: "lb", pounds: "lb", g: "g", gram: "g", grams: "g", kg: "kg", kilogram: "kg", kilograms: "kg", ml: "ml", milliliter: "ml", milliliters: "ml", l: "l", liter: "l", liters: "l", gal: "gallon", gallon: "gallon", gallons: "gallon", qt: "qt", quart: "qt", quarts: "qt", pt: "pt", pint: "pt", pints: "pt", ct: "count", count: "count", counts: "count", pk: "pack", pack: "pack", packs: "pack", bag: "bag", bags: "bag", tub: "tub", tubs: "tub", bottle: "bottle", bottles: "bottle", can: "can", cans: "can", box: "box", boxes: "box", each: "each", ea: "each" })[key] || "";
}

function packageTypeName(value) {
  const key = text(value, 30).toLowerCase().replace(/[^a-z]/g, "");
  return ({ containers: "container", container: "container", jars: "jar", jar: "jar", bags: "bag", bag: "bag", tubs: "tub", tub: "tub", bottles: "bottle", bottle: "bottle", cans: "can", can: "can", boxes: "box", box: "box", packs: "pack", pack: "pack" })[key] || "";
}

function normalizePackage(value) {
  const original = String(value ?? "");
  const raw = normalizeRetailerText(original, 120);
  const empty = { raw_text: null, quantity: null, item_size: null, unit: "", package_type: "", normalized_text: "" };
  if (!raw || raw.length > 80) return empty;
  if (/<\/?(?:li|ul|ol)\b/i.test(original) || /[•▪◦]/.test(original)) return empty;
  if ((raw.match(/[.!?](?:\s|$)/g) || []).length > 1) return empty;
  if (/\b(?:best when|enjoyed|refreshing|flavorful|healthy|sweet treat|perfect for|great for|addition to|recipes?|ingredients?|instructions?|made with)\b/i.test(raw)) return empty;
  if (/^(?:1\s+)?(?:each|ea)$/i.test(raw)) return { raw_text: "Each", quantity: 1, item_size: null, unit: "each", package_type: "", normalized_text: "Each" };
  const unitPattern = "fluid\\s+ounces?|fl\\s*\\.?\\s*oz|ounces?|oz|pounds?|lbs?|kilograms?|kg|milliliters?|ml|liters?|l|gallons?|gal|grams?|g|quarts?|qt|pints?|pt|count|ct|packs?|pk|bags?|tubs?|bottles?|cans?|box(?:es)?|each|ea";
  const typePattern = "containers?|jars?|bags?|tubs?|bottles?|cans?|box(?:es)?|packs?";
  let match = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:x|×)\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  if (match) {
    const unit = normalizeUnit(match[3]);
    const normalized = `${Number(match[1])} × ${Number(match[2])} ${unit}`;
    return { raw_text: normalized, quantity: Number(match[1]), item_size: Number(match[2]), unit, package_type: "", normalized_text: normalized };
  }
  match = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(pounds?|lbs?|fluid\\s+ounces?|fl\\s*\\.?\\s*oz|ounces?|oz|kilograms?|kg|milliliters?|ml|liters?|l|gallons?|gal|grams?|g|quarts?|qt|pints?|pt)\\s*(?:\\/\\s*)?(${typePattern})?`, "i"));
  if (match) {
    const amount = Number(match[1]);
    const unit = normalizeUnit(match[2]);
    const packageType = packageTypeName(match[3]);
    const normalized = `${amount} ${unit}${packageType ? ` ${titlePackageType(packageType)}` : ""}`;
    return { raw_text: normalized, quantity: 1, item_size: amount, unit, package_type: packageType, normalized_text: normalized };
  }
  match = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  if (!match) return empty;
  const amount = Number(match[1]);
  const unit = normalizeUnit(match[2]);
  if (["count", "pack", "bag", "tub", "bottle", "can", "box"].includes(unit)) {
    const packageType = unit === "count" ? "" : packageTypeName(unit);
    const normalized = unit === "count" ? `${amount} ct` : `${amount} ${amount === 1 ? unit : `${unit}s`}`;
    return { raw_text: normalized, quantity: amount, item_size: null, unit: unit === "count" ? "count" : "count", package_type: packageType, normalized_text: normalized };
  }
  if (unit === "each") return { raw_text: amount === 1 ? "Each" : `${amount} each`, quantity: amount, item_size: null, unit, package_type: "", normalized_text: amount === 1 ? "Each" : `${amount} each` };
  return { raw_text: `${amount} ${unit}`, quantity: 1, item_size: amount, unit, package_type: "", normalized_text: `${amount} ${unit}` };
}

function titlePackageType(value) { return value ? value[0].toUpperCase() + value.slice(1) : ""; }

function packageFromProductTitle(value) {
  const title = normalizeRetailerText(value, 240);
  if (!title) return normalizePackage(null);
  const each = title.match(/(?:^|[,;(]\s*)(?:1\s+)?each\s*\)?$/i);
  if (each) return normalizePackage("Each");
  const candidates = [...title.matchAll(/(\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:fl\s*\.?\s*oz|oz|lb|kg|ml|g|l)\b|\d+(?:\.\d+)?\s*(?:lbs?|pounds?|fl\s*\.?\s*oz|ounces?|oz|kilograms?|kg|grams?|g|milliliters?|ml|liters?|l|gallons?|gal|quarts?|qt|pints?|pt|count|ct)\b\s*(?:\/\s*)?(?:containers?|jars?|bags?|tubs?|bottles?|cans?|box(?:es)?|packs?)?)/gi)];
  for (const candidate of candidates.reverse()) {
    const parsed = normalizePackage(candidate[1]);
    if (parsed.raw_text) return parsed;
  }
  return normalizePackage(null);
}

function typeNames(value) {
  const type = value?.["@type"];
  return (Array.isArray(type) ? type : [type]).filter(Boolean).map((entry) => String(entry).toLowerCase());
}

function walkJson(value, visit, depth = 0) {
  if (depth > 30 || value === null || typeof value !== "object") return;
  visit(value);
  if (Array.isArray(value)) value.forEach((item) => walkJson(item, visit, depth + 1));
  else Object.values(value).forEach((item) => walkJson(item, visit, depth + 1));
}

function imageUrl(value) {
  const image = Array.isArray(value) ? value[0] : value;
  return text(typeof image === "string" ? image : image?.url || image?.contentUrl, 1000);
}

function brandName(value) {
  return text(typeof value === "string" ? value : value?.name, 100);
}

function offerFrom(value) {
  const offers = Array.isArray(value) ? value : value ? [value] : [];
  const offer = offers.find((item) => item && typeof item === "object") || {};
  const price = parsePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
  const regular = parsePrice(offer.regularPrice ?? offer.originalPrice ?? offer.priceSpecification?.referencePrice ?? offer.priceSpecification?.listPrice);
  return {
    price,
    regular_price: regular && price !== null && regular > price ? regular : null,
    price_conflict: regular !== null && price !== null && regular <= price,
    currency: normalizeRetailerText(offer.priceCurrency || offer.priceSpecification?.priceCurrency, 10),
    availability: normalizeRetailerText(offer.availability, 200).split("/").pop(),
    url: text(offer.url, 1000)
  };
}

function productCandidate(product, method) {
  const offer = offerFrom(product.offers);
  const sizeRaw = normalizeRetailerText(product.size || product.weight, 120);
  const packageInfo = normalizePackage(sizeRaw).raw_text ? normalizePackage(sizeRaw) : packageFromProductTitle(product.name);
  return {
    method,
    name: normalizeRetailerText(product.name, 200), brand: normalizeRetailerText(brandName(product.brand), 100), variant: normalizeRetailerText(product.variant || product.model, 100), description: normalizeRetailerText(product.description, 500),
    image_url: imageUrl(product.image), sku: normalizeRetailerText(product.sku || product.mpn, 100),
    gtin: normalizeRetailerText(product.gtin14 || product.gtin13 || product.gtin12 || product.gtin8 || product.gtin, 40),
    price: offer.price, regular_price: offer.regular_price, price_conflict: offer.price_conflict, unit_price: parsePrice(product.unitPrice || product.offers?.unitPrice), currency: offer.currency,
    availability: offer.availability, product_url: offer.url || text(product.url, 1000),
    raw_price_text: offer.price === null ? "" : normalizeRetailerText(product.offers?.price ?? product.offers?.lowPrice ?? offer.price, 120),
    raw_size_text: packageInfo.raw_text, package: packageInfo,
    seller: normalizeRetailerText(product.offers?.seller?.name || product.manufacturer?.name, 120)
  };
}

function candidateScore(candidate) {
  return [candidate.name, candidate.price !== null, candidate.image_url, candidate.gtin, candidate.sku, candidate.raw_size_text].filter(Boolean).length;
}

function scriptBodies(html, predicate) {
  const output = [];
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = regex.exec(html))) if (predicate(match[1])) output.push(match[2].trim());
  return output;
}

function parseJsonScripts(html, predicate, warnings) {
  const values = [];
  for (const body of scriptBodies(html, predicate)) {
    if (!body) continue;
    try { values.push(JSON.parse(body)); } catch { warnings.push("One structured-data script was malformed and ignored."); }
  }
  return values;
}

function metaMap(html) {
  const map = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    tag.replace(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, name, a, b, c) => { attrs[name.toLowerCase()] = decodeHtml(a ?? b ?? c); return ""; });
    const key = String(attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content && !map.has(key)) map.set(key, attrs.content);
  }
  return map;
}

function applyField(result, name, value, confidence, method) {
  const meaningful = value !== null && value !== undefined && value !== "";
  if (!meaningful || CONFIDENCE[confidence] <= CONFIDENCE[result.confidence[name] || "unknown"]) return;
  result.fields[name] = value;
  result.confidence[name] = confidence;
  result.field_methods[name] = method;
}

function detectRetailer(urlInput, structuredName, stores = []) {
  const hostname = new URL(urlInput).hostname.toLowerCase().replace(/^www\./, "");
  const definition = retailerDefinition(urlInput);
  const mapping = DOMAIN_RETAILERS.find((entry) => entry.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
  const names = [...(mapping?.names || []), text(structuredName, 120).toLowerCase()].filter(Boolean);
  const store = stores.find((candidate) => names.some((name) => {
    const storeName = text(candidate.name, 120).toLowerCase().replace(/[’]/g, "'");
    return storeName.includes(name) || name.includes(storeName);
  })) || null;
  return { hostname, recognized: Boolean(definition || store), retailer: definition?.id || "", retailer_name: store?.name || definition?.label || text(structuredName, 120), store_id: store?.id || null, adapter: definition?.adapter || "generic", capabilities: definition?.capabilities || null };
}

function locationAssessment(html, store) {
  const visible = text(html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ").replace(/<style[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]+>/g, " "), 20000).toLowerCase();
  const janesville = /\bjanesville\b/.test(visible);
  const wisconsin = /\bwisconsin\b|\bwi\b/.test(visible);
  if (janesville && wisconsin) return { confidence: "likely_janesville", evidence: "The product page mentions Janesville, Wisconsin, but an admin must confirm that the displayed price applies to that exact store." };
  if (janesville) return { confidence: "likely_janesville", evidence: "The product page mentions Janesville but does not establish that the displayed price applies to a specific store." };
  return { confidence: "unknown", evidence: store?.city?.toLowerCase() === "janesville" ? "A Janesville store was matched, but the fetched page did not establish that its price applies to that location." : "The fetched page did not establish that its price applies to a Janesville store." };
}

function extractProduct(htmlInput, sourceUrl, stores = []) {
  const html = String(htmlInput || "");
  const result = { source_url: sourceUrl, extracted_at: new Date().toISOString(), fields: {}, confidence: {}, field_methods: {}, methods_used: [], warnings: [] };
  const products = [];
  const jsonLd = parseJsonScripts(html, (attrs) => /type\s*=\s*["']application\/ld\+json["']/i.test(attrs), result.warnings);
  jsonLd.forEach((value) => walkJson(value, (node) => { if (typeNames(node).includes("product")) products.push(productCandidate(node, "json_ld")); }));
  if (products.length) result.methods_used.push("json_ld");

  const embedded = parseJsonScripts(html, (attrs) => /type\s*=\s*["']application\/json["']/i.test(attrs) || /id\s*=\s*["'](?:__NEXT_DATA__|__APOLLO_STATE__)["']/i.test(attrs), result.warnings);
  if (retailerDefinition(sourceUrl)?.id === "walmart" && embedded.length) {
    const { extractWalmartProduct } = require("./importers/walmart");
    const walmartProduct = extractWalmartProduct(embedded, sourceUrl);
    if (walmartProduct) {
      for (const [name, value] of Object.entries(walmartProduct.fields || {})) applyField(result, name, value, walmartProduct.confidence?.[name] || "high", walmartProduct.field_origins?.[name] || "walmart_product_state");
      result.methods_used.push("walmart_product_state");
    }
  }

  if (!result.fields.name) {
    const structuredIdentities = new Set(products.flatMap((product) => [product.sku && `sku:${normalizeMatch(product.sku)}`, product.gtin && `gtin:${normalizeMatch(product.gtin)}`, product.name && `name:${normalizeMatch(product.name)}`].filter(Boolean)));
    let sourcePath = "";
    try { sourcePath = new URL(sourceUrl).pathname.replace(/\/$/, ""); } catch {}
    embedded.forEach((value) => walkJson(value, (node) => {
      if (node && !Array.isArray(node) && (node.name || node.productName || node.title) && (node.price !== undefined || node.offers || node.sku || node.gtin)) {
        const candidate = productCandidate({ ...node, name: node.name || node.productName || node.title, offers: node.offers || { price: node.price, priceCurrency: node.currency }, image: node.image || node.imageUrl }, "embedded_json");
        const identities = [candidate.sku && `sku:${normalizeMatch(candidate.sku)}`, candidate.gtin && `gtin:${normalizeMatch(candidate.gtin)}`, candidate.name && `name:${normalizeMatch(candidate.name)}`].filter(Boolean);
        let candidatePath = "";
        try { candidatePath = new URL(candidate.product_url || "", sourceUrl).pathname.replace(/\/$/, ""); } catch {}
        if (!products.length || identities.some((identity) => structuredIdentities.has(identity)) || (sourcePath && candidatePath === sourcePath)) products.push(candidate);
      }
    }));
    if (products.length) result.methods_used.push("embedded_json");
  }

  const best = products.sort((a, b) => candidateScore(b) - candidateScore(a))[0];
  if (best) {
    const confidence = best.method === "json_ld" ? "high" : "medium";
    for (const name of ["name", "brand", "variant", "image_url", "sku", "gtin", "price", "regular_price", "price_conflict", "unit_price", "currency", "availability", "raw_price_text", "raw_size_text"]) applyField(result, name, best[name], confidence, best.method);
    for (const name of ["quantity", "item_size", "unit", "package_type"]) applyField(result, name, best.package[name], best.package.raw_text ? "medium" : "unknown", "size_normalization");
  }

  const meta = metaMap(html);
  const metaFields = { name: meta.get("og:title"), image_url: meta.get("og:image"), price: parsePrice(meta.get("product:price:amount")), currency: meta.get("product:price:currency"), retailer: meta.get("og:site_name") };
  for (const [name, value] of Object.entries(metaFields)) applyField(result, name, value, "medium", "open_graph");
  if (Object.values(metaFields).some((value) => value !== null && value !== undefined && value !== "")) result.methods_used.push("open_graph");

  const visible = decodeHtml(html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ").replace(/<style[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]+>/g, " "));
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ");
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  applyField(result, "name", decodeHtml(h1 || title), "low", "html_heuristic");
  const priceText = visible.match(/\$\s*\d+(?:\.\d{1,2})?/)?.[0];
  applyField(result, "price", parsePrice(priceText), "low", "html_heuristic");
  applyField(result, "raw_price_text", priceText, "low", "html_heuristic");
  const packageMatch = visible.match(/\b\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|kg|g|ml|l|gal|gallon|ct|count)\b|\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|kg|g|ml|l|gal|gallon|ct|count)\b/i)?.[0];
  if (packageMatch) {
    const normalized = normalizePackage(packageMatch);
    applyField(result, "raw_size_text", normalized.raw_text, "low", "html_heuristic");
    for (const name of ["quantity", "item_size", "unit", "package_type"]) applyField(result, name, normalized[name], "low", "html_heuristic");
  }
  if ((!best || !best.name) && (h1 || title || priceText || packageMatch)) result.methods_used.push("html_heuristic");

  const canonicalTag = (html.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'][^>]*>/i) || [""])[0];
  const canonicalHref = canonicalTag.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const canonicalUrl = normalizeProductUrl(canonicalHref?.[1] || canonicalHref?.[2] || canonicalHref?.[3], sourceUrl) || normalizeProductUrl(sourceUrl);
  if (canonicalHref && canonicalUrl) {
    result.fields.product_url = canonicalUrl;
    result.confidence.product_url = "high";
    result.field_methods.product_url = "canonical_link";
  } else if (result.fields.product_url) result.fields.product_url = normalizeProductUrl(result.fields.product_url, sourceUrl) || canonicalUrl;
  else applyField(result, "product_url", canonicalUrl, "medium", "final_response_url");
  if (result.fields.image_url) {
    const normalizedImage = normalizeImageUrl(result.fields.image_url, sourceUrl);
    if (normalizedImage) result.fields.image_url = normalizedImage;
    else {
      delete result.fields.image_url;
      result.confidence.image_url = "unknown";
      result.warnings.push("The detected image was invalid or appeared to be a placeholder.");
    }
  }
  const titlePackage = packageFromProductTitle(result.fields.name);
  if (!normalizePackage(result.fields.raw_size_text).raw_text && titlePackage.raw_text) {
    applyField(result, "raw_size_text", titlePackage.raw_text, "medium", "product_title_size");
    for (const name of ["quantity", "item_size", "unit", "package_type"]) applyField(result, name, titlePackage[name], "medium", "product_title_size");
  }

  const retailer = detectRetailer(sourceUrl, result.fields.retailer || best?.seller, stores);
  result.retailer = retailer;
  result.location = locationAssessment(html, stores.find((store) => String(store.id) === String(retailer.store_id)));
  if (!retailer.store_id) result.warnings.push(retailer.recognized ? "Retailer recognized, but no existing Grocery Radar store location was matched." : "Retailer not recognized. Select an existing store manually.");
  if (result.location.confidence !== "confirmed_janesville") result.warnings.push("This price may be location-dependent and is not confirmed for the Janesville store.");
  if (!result.fields.name) result.warnings.push("No reliable product name was found.");
  else if (suspiciousProductName(result.fields.name)) result.warnings.push("The detected product name looks like navigation or page text.");
  if (result.fields.price == null) result.warnings.push("No reliable current price was found.");
  if (result.fields.price_conflict === true) result.warnings.push("The source exposed conflicting current and regular prices.");
  if (parsePrice(result.fields.price) !== null && result.fields.price > 1000) result.warnings.push("The detected price is unusually large and requires review.");
  result.methods_used = [...new Set(result.methods_used)];
  result.overall_confidence = result.confidence.name === "high" && result.confidence.price === "high" ? "high" : result.fields.name && result.fields.price != null ? "medium" : "low";
  return result;
}

function normalizeMatch(value) { return text(value, 300).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function findDuplicateCandidates(imported, products = [], priorImports = [], storeId = null) {
  const gtin = text(imported.gtin, 40).replace(/\D/g, "");
  const sku = normalizeMatch(imported.sku);
  const name = normalizeMatch(imported.name);
  const brand = normalizeMatch(imported.brand);
  const size = normalizeMatch(imported.raw_size_text || imported.size_text);
  const canonicalUrl = normalizeProductUrl(imported.product_url || imported.source_url);
  const matches = [];
  for (const product of products) {
    const productGtin = text(product.upc || product.gtin, 40).replace(/\D/g, "");
    if (gtin && productGtin === gtin) matches.push({ type: "gtin", confidence: "high", product_id: product.id, name: product.display_name || product.name });
    else if (name && size && normalizeMatch(product.display_name || product.name) === name && (!brand || normalizeMatch(product.brand_optional || product.brand) === brand) && normalizeMatch(product.default_size_text || product.size_text) === size) matches.push({ type: "name_brand_size", confidence: "medium", product_id: product.id, name: product.display_name || product.name });
  }
  for (const prior of priorImports) {
    const priorProductId = prior.product_id || prior.approved_product_id || null;
    if (canonicalUrl && normalizeProductUrl(prior.source_url) === canonicalUrl) matches.push({ type: "canonical_url", confidence: "high", import_id: prior.id, product_id: priorProductId, name: prior.item_name });
    else if (sku && normalizeMatch(prior.sku) === sku && String(prior.store_id || "") === String(storeId || "")) matches.push({ type: "sku_retailer", confidence: "high", import_id: prior.id, product_id: priorProductId, name: prior.item_name });
  }
  const unique = new Map();
  for (const match of matches) unique.set(`${match.product_id || ""}:${match.import_id || ""}:${match.type}`, match);
  return [...unique.values()].slice(0, 10);
}

module.exports = { DOMAIN_RETAILERS, parsePrice, normalizeRetailerText, normalizePackage, packageFromProductTitle, normalizeProductUrl, normalizeImageUrl, suspiciousProductName, validateProductFields, detectRetailer, extractProduct, findDuplicateCandidates };
