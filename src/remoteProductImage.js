"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { safeRemoteBufferFetch, SafeFetchError } = require("./safeRemoteFetch");

const REMOTE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const REMOTE_IMAGE_MAX_DIMENSION = 6000;
const REMOTE_IMAGE_MAX_PIXELS = 24 * 1000 * 1000;
const PREVIEW_MAX_DIMENSION = 320;
const STORED_MAX_DIMENSION = 1600;
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const PREVIEW_CACHE_MAX_BYTES = 24 * 1024 * 1024;
const PREVIEW_CACHE_MAX_ENTRIES = 128;
const IMAGE_CONCURRENCY = 3;

class RemoteImageError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.name = "RemoteImageError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function magicType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return "";
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "";
}

async function sanitizeImageBuffer(input, options = {}) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || "");
  if (!buffer.length || buffer.length > REMOTE_IMAGE_MAX_BYTES) throw new RemoteImageError("IMAGE_TOO_LARGE", "The product image exceeded the 4 MiB safety limit.", 413);
  const detectedType = magicType(buffer);
  if (!detectedType) throw new RemoteImageError("INVALID_IMAGE_SIGNATURE", "The remote file was not a supported JPEG, PNG, or WebP image.");
  if (options.contentType && options.contentType !== detectedType) throw new RemoteImageError("IMAGE_TYPE_MISMATCH", "The image content type did not match its actual file signature.");
  let metadata;
  try {
    metadata = await sharp(buffer, { failOn: "error", limitInputPixels: REMOTE_IMAGE_MAX_PIXELS, sequentialRead: true }).metadata();
  } catch {
    throw new RemoteImageError("IMAGE_DECODE_FAILED", "The product image was malformed or exceeded safe decoding limits.");
  }
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height) throw new RemoteImageError("IMAGE_DECODE_FAILED", "The product image could not be fully decoded.");
  if (width > REMOTE_IMAGE_MAX_DIMENSION || height > REMOTE_IMAGE_MAX_DIMENSION || width * height > REMOTE_IMAGE_MAX_PIXELS) {
    throw new RemoteImageError("IMAGE_DIMENSIONS_EXCEEDED", "The product image dimensions exceeded safe processing limits.");
  }
  if (Number(metadata.pages || 1) > 1) throw new RemoteImageError("ANIMATED_IMAGE_UNSUPPORTED", "Animated or multi-page product images are not supported.");
  const maxDimension = options.preview ? PREVIEW_MAX_DIMENSION : STORED_MAX_DIMENSION;
  try {
    const result = await sharp(buffer, { failOn: "error", limitInputPixels: REMOTE_IMAGE_MAX_PIXELS, sequentialRead: true })
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .webp({ quality: options.preview ? 78 : 84, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (!result.data.length) throw new Error("empty output");
    return { buffer: result.data, mimeType: "image/webp", width: result.info.width, height: result.info.height, originalMimeType: detectedType };
  } catch (error) {
    if (error instanceof RemoteImageError) throw error;
    throw new RemoteImageError("IMAGE_REENCODE_FAILED", "The product image could not be safely re-encoded.");
  }
}

async function fetchAndSanitizeRemoteImage(url, options = {}) {
  const fetched = await (options.fetchRemote || safeRemoteBufferFetch)(url, options.fetchOptions || {});
  const sanitized = await sanitizeImageBuffer(fetched.body, { preview: options.preview, contentType: fetched.contentType });
  return { ...sanitized, sourceUrl: fetched.url, retrievedAt: new Date().toISOString(), sourceDomain: new URL(fetched.url).hostname.toLowerCase() };
}

class WorkQueue {
  constructor(limit = IMAGE_CONCURRENCY) { this.limit = limit; this.active = 0; this.waiting = []; }
  async run(task) {
    if (this.active >= this.limit) await new Promise((resolve) => this.waiting.push(resolve));
    this.active += 1;
    try { return await task(); }
    finally { this.active -= 1; this.waiting.shift()?.(); }
  }
}

const imageQueue = new WorkQueue();
const previewCache = new Map();
let previewCacheBytes = 0;

function cleanupPreviewCache(now = Date.now()) {
  for (const [key, value] of previewCache) {
    if (value.expiresAt <= now) { previewCache.delete(key); previewCacheBytes -= value.buffer.length; }
  }
  while (previewCache.size > PREVIEW_CACHE_MAX_ENTRIES || previewCacheBytes > PREVIEW_CACHE_MAX_BYTES) {
    const oldest = previewCache.keys().next().value;
    if (!oldest) break;
    const removed = previewCache.get(oldest);
    previewCache.delete(oldest);
    previewCacheBytes -= removed.buffer.length;
  }
}

async function getSanitizedPreview(url, options = {}) {
  cleanupPreviewCache();
  const key = crypto.createHash("sha256").update(String(url)).digest("hex");
  const cached = previewCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached, cacheHit: true };
  const image = await imageQueue.run(() => fetchAndSanitizeRemoteImage(url, { ...options, preview: true }));
  const entry = { ...image, expiresAt: Date.now() + PREVIEW_TTL_MS };
  previewCache.set(key, entry);
  previewCacheBytes += entry.buffer.length;
  cleanupPreviewCache();
  return { ...entry, cacheHit: false };
}

async function storeSanitizedRemoteImage(url, uploadDir, options = {}) {
  const image = await imageQueue.run(() => fetchAndSanitizeRemoteImage(url, { ...options, preview: false }));
  const hash = crypto.createHash("sha256").update(image.buffer).digest("hex");
  const filename = `product-import-${Date.now()}-${crypto.randomBytes(16).toString("hex")}.webp`;
  const storageRoot = path.resolve(uploadDir);
  const fullPath = path.join(storageRoot, filename);
  if (!fullPath.startsWith(`${storageRoot}${path.sep}`)) throw new RemoteImageError("IMAGE_STORAGE_PATH", "A safe image storage path could not be created.", 500);
  await fs.promises.writeFile(fullPath, image.buffer, { flag: "wx", mode: 0o600 });
  return { ...image, hash, filename, sizeBytes: image.buffer.length };
}

function clearPreviewCacheForTests() { previewCache.clear(); previewCacheBytes = 0; }

module.exports = {
  REMOTE_IMAGE_MAX_BYTES,
  REMOTE_IMAGE_MAX_DIMENSION,
  REMOTE_IMAGE_MAX_PIXELS,
  PREVIEW_TTL_MS,
  PREVIEW_CACHE_MAX_BYTES,
  PREVIEW_CACHE_MAX_ENTRIES,
  IMAGE_CONCURRENCY,
  RemoteImageError,
  magicType,
  sanitizeImageBuffer,
  fetchAndSanitizeRemoteImage,
  getSanitizedPreview,
  storeSanitizedRemoteImage,
  cleanupPreviewCache,
  clearPreviewCacheForTests,
  SafeFetchError
};
