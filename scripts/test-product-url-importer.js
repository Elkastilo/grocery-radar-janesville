const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { extractProduct, normalizePackage, detectRetailer, findDuplicateCandidates } = require("../src/productImporter");
const { safeRemoteFetch, safeCategoryRemoteFetch, safeRemoteBufferFetch, CATEGORY_DEFAULTS, validateRemoteUrl, isPublicAddress, SafeFetchError } = require("../src/safeRemoteFetch");
const { categoryUrlHint, extractCategory, analyzePage } = require("../src/categoryImporter");
const { REMOTE_IMAGE_MAX_BYTES, REMOTE_IMAGE_MAX_DIMENSION, REMOTE_IMAGE_MAX_PIXELS, IMAGE_CONCURRENCY, RemoteImageError, magicType, sanitizeImageBuffer, fetchAndSanitizeRemoteImage, storeSanitizedRemoteImage } = require("../src/remoteProductImage");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", "product-importer", name), "utf8");
const stores = [
  { id: 1, name: "Walmart Supercenter", city: "Janesville", state: "WI" },
  { id: 2, name: "ALDI", city: "Janesville", state: "WI" },
  { id: 3, name: "Woodman's Food Market", city: "Janesville", state: "WI" }
];

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error instanceof SafeFetchError && error.code === code);
}

async function main() {
  const walmart = extractProduct(fixture("walmart-jsonld.html"), "https://www.walmart.com/ip/123", stores);
  assert.equal(walmart.fields.name, "Coca-Cola Original Soda");
  assert.equal(walmart.fields.price, 7.99);
  assert.equal(walmart.fields.gtin, "049000028904");
  assert.equal(walmart.fields.quantity, 12);
  assert.equal(walmart.fields.item_size, 12);
  assert.equal(walmart.fields.unit, "fl oz");
  assert.equal(walmart.retailer.store_id, 1);
  assert.equal(walmart.location.confidence, "likely_janesville");

  const aldi = extractProduct(fixture("aldi-graph.html"), "https://www.aldi.us/product/milk", stores);
  assert.equal(aldi.fields.name, "Organic Whole Milk");
  assert.equal(aldi.fields.price, 4.29);
  assert.equal(aldi.fields.regular_price, 4.79);
  assert.equal(aldi.retailer.store_id, 2);
  assert.ok(aldi.warnings.some((warning) => warning.includes("malformed")));

  const woodmans = extractProduct(fixture("woodmans-opengraph.html"), "https://shopwoodmans.com/store/eggs", stores);
  assert.equal(woodmans.fields.name, "Woodman's Large Eggs, 12 ct");
  assert.equal(woodmans.fields.price, 2.99);
  assert.equal(woodmans.retailer.store_id, 3);
  assert.equal(analyzePage(fixture("walmart-jsonld.html"), "https://www.walmart.com/ip/123", stores).url_type, "product");

  assert.equal(categoryUrlHint("https://www.walmart.com/browse/food/fresh-fruits/123"), "category");
  assert.equal(categoryUrlHint("https://www.walmart.com/ip/bananas/1001"), "product");
  const walmartCategory = extractCategory(fixture("walmart-category.html"), "https://www.walmart.com/browse/food/fresh-fruits/123", stores, 25);
  assert.equal(walmartCategory.url_type, "category");
  assert.equal(walmartCategory.adapter, "walmart");
  assert.equal(walmartCategory.products.length, 4);
  assert.equal(walmartCategory.products[0].fields.name, "Bananas");
  assert.equal(walmartCategory.products[0].fields.price, 0.27);
  assert.equal(walmartCategory.products[1].fields.regular_price, 3.48);
  assert.equal(walmartCategory.products[2].fields.raw_size_text, "18 oz");
  assert.equal(walmartCategory.products[2].fields.image_url, "");
  assert.equal(walmartCategory.products[3].fields.price, null);
  assert.ok(walmartCategory.products.every((item) => item.category_relevance === "high"));
  assert.ok(!walmartCategory.products.some((item) => /seafood|meat|shrimp/i.test(item.fields.name)));
  assert.equal(walmartCategory.location.confidence, "unknown");
  assert.equal(walmartCategory.pagination_likely, true);
  assert.ok(walmartCategory.warnings.some((warning) => warning.includes("malformed")));
  assert.ok(walmartCategory.warnings.some((warning) => warning.includes("other pages")));

  const genericCategory = analyzePage(fixture("generic-category.html"), "https://shop.example.test/category/pantry", stores, { maxProducts: 10 });
  assert.equal(genericCategory.url_type, "category");
  assert.equal(genericCategory.products.length, 2);
  assert.equal(genericCategory.products[0].fields.name, "Pasta");
  const repeatedProducts = Array.from({ length: 70 }, (_, index) => ({ "@type": "Product", name: `Item ${index}`, sku: `SKU-${index}`, url: `https://shop.example.test/product/${index}`, offers: { price: index + 1 } }));
  const capped = extractCategory(`<script type="application/ld+json">${JSON.stringify(repeatedProducts)}</script>`, "https://shop.example.test/category/all", stores, 50);
  assert.equal(capped.products.length, 50);
  assert.equal(CATEGORY_DEFAULTS.maxBytes, 5 * 1024 * 1024);

  assert.deepEqual(normalizePackage("12 x 12 fl oz"), { raw_text: "12 x 12 fl oz", quantity: 12, item_size: 12, unit: "fl oz", normalized_text: "12 × 12 fl oz" });
  assert.equal(normalizePackage("2 lb").item_size, 2);
  assert.deepEqual(normalizePackage("12 ct").quantity, 12);
  assert.equal(detectRetailer("https://unknown-retailer.example/product", "", stores).recognized, false);

  const duplicates = findDuplicateCandidates({ name: "Coke", brand: "Coca-Cola", raw_size_text: "12 x 12 fl oz", gtin: "049000028904", sku: "WM-123" }, [{ id: 9, display_name: "Other", upc: "049000028904" }], [{ id: 7, sku: "WM-123", store_id: 1, item_name: "Coke" }], 1);
  assert.ok(duplicates.some((candidate) => candidate.type === "gtin"));
  assert.ok(duplicates.some((candidate) => candidate.type === "sku_retailer"));

  for (const input of ["http://example.com/product", "file:///etc/passwd", "ftp://example.com/a", "data:text/plain,x", "javascript:alert(1)"]) assert.throws(() => validateRemoteUrl(input), /Only HTTPS/);
  for (const input of ["https://localhost/product", "https://127.0.0.1/product", "https://10.0.0.1/product", "https://169.254.169.254/latest/meta-data", "https://[::1]/product", "https://[fd00::1]/product"]) assert.throws(() => validateRemoteUrl(input), /Private|reserved/);
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fd00::1", "fe80::1"]) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);

  const publicDns = async () => [{ address: "8.8.8.8", family: 4 }];
  await expectCode(safeRemoteFetch("https://public.example/product", {
    resolveHost: publicDns,
    requestOnce: async () => ({ statusCode: 302, headers: { location: "https://127.0.0.1/private" }, body: "" })
  }), "PRIVATE_ADDRESS");
  await expectCode(safeRemoteFetch("https://public.example/product", {
    resolveHost: publicDns, maxBytes: 10,
    requestOnce: async () => ({ statusCode: 200, headers: { "content-type": "text/html" }, body: "01234567890" })
  }), "RESPONSE_TOO_LARGE");
  await expectCode(safeCategoryRemoteFetch("https://public.example/category", {
    resolveHost: publicDns, maxBytes: 20,
    requestOnce: async () => ({ statusCode: 200, headers: { "content-type": "text/html" }, body: "x".repeat(21) })
  }), "RESPONSE_TOO_LARGE");
  await expectCode(safeRemoteFetch("https://public.example/product", {
    resolveHost: publicDns, totalTimeoutMs: 10,
    requestOnce: async () => new Promise(() => {})
  }), "REQUEST_TIMEOUT");

  const validJpeg = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#f2d447" } }).jpeg().toBuffer();
  const validPng = await sharp({ create: { width: 60, height: 80, channels: 4, background: "#6fba73" } }).png().toBuffer();
  const validWebp = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#5e76a7" } }).webp().toBuffer();
  assert.equal(magicType(validJpeg), "image/jpeg");
  assert.equal(magicType(validPng), "image/png");
  assert.equal(magicType(validWebp), "image/webp");
  for (const [buffer, contentType] of [[validJpeg, "image/jpeg"], [validPng, "image/png"], [validWebp, "image/webp"]]) {
    const sanitized = await sanitizeImageBuffer(buffer, { contentType });
    assert.equal(sanitized.mimeType, "image/webp");
    assert.equal(magicType(sanitized.buffer), "image/webp");
  }
  await assert.rejects(() => sanitizeImageBuffer(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), (error) => error instanceof RemoteImageError && error.code === "INVALID_IMAGE_SIGNATURE");
  await assert.rejects(() => sanitizeImageBuffer(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("<html><script>alert(1)</script></html>")])), (error) => error instanceof RemoteImageError && error.code === "IMAGE_DECODE_FAILED");
  await assert.rejects(() => sanitizeImageBuffer(validJpeg, { contentType: "image/png" }), (error) => error instanceof RemoteImageError && error.code === "IMAGE_TYPE_MISMATCH");
  await assert.rejects(() => sanitizeImageBuffer(Buffer.alloc(REMOTE_IMAGE_MAX_BYTES + 1)), (error) => error instanceof RemoteImageError && error.code === "IMAGE_TOO_LARGE");
  const overDimensionImage = await sharp({ create: { width: REMOTE_IMAGE_MAX_DIMENSION + 1, height: 1, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(() => sanitizeImageBuffer(overDimensionImage), (error) => error instanceof RemoteImageError && error.code === "IMAGE_DIMENSIONS_EXCEEDED");
  const overPixelImage = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(() => sanitizeImageBuffer(overPixelImage), (error) => error instanceof RemoteImageError && ["IMAGE_DECODE_FAILED", "IMAGE_DIMENSIONS_EXCEEDED"].includes(error.code));
  assert.equal(REMOTE_IMAGE_MAX_PIXELS, 24000000);
  assert.equal(IMAGE_CONCURRENCY, 3);

  const imageResponse = (body = validJpeg, contentType = "image/jpeg") => ({ statusCode: 200, headers: { "content-type": contentType }, body });
  const safeImageResponse = await safeRemoteBufferFetch("https://public.example/image.jpg", { resolveHost: publicDns, requestOnce: async () => imageResponse() });
  assert.equal(safeImageResponse.contentType, "image/jpeg");
  assert.ok(safeImageResponse.body.equals(validJpeg));
  await expectCode(safeRemoteBufferFetch("https://public.example/image.jpg", { resolveHost: publicDns, requestOnce: async () => ({ statusCode: 302, headers: { location: "https://127.0.0.1/private.jpg" }, body: Buffer.alloc(0) }) }), "PRIVATE_ADDRESS");
  let rebindingCalls = 0;
  await expectCode(safeRemoteBufferFetch("https://public.example/image.jpg", {
    resolveHost: async () => (++rebindingCalls === 1 ? [{ address: "8.8.8.8", family: 4 }] : [{ address: "127.0.0.1", family: 4 }]),
    requestOnce: async () => ({ statusCode: 302, headers: { location: "https://public.example/next.jpg" }, body: Buffer.alloc(0) })
  }), "PRIVATE_ADDRESS");
  await expectCode(safeRemoteBufferFetch("https://public.example/image.jpg", { resolveHost: publicDns, maxBytes: 10, requestOnce: async () => imageResponse(Buffer.alloc(11)) }), "RESPONSE_TOO_LARGE");
  await expectCode(safeRemoteBufferFetch("https://public.example/image.svg", { resolveHost: publicDns, requestOnce: async () => imageResponse(Buffer.from("<svg></svg>"), "image/svg+xml") }), "UNSUPPORTED_CONTENT");
  await expectCode(safeRemoteBufferFetch("https://public.example/image.jpg", { resolveHost: publicDns, totalTimeoutMs: 10, requestOnce: async () => new Promise(() => {}) }), "REQUEST_TIMEOUT");
  await expectCode(safeRemoteBufferFetch("https://public.example/image.jpg", { resolveHost: publicDns, maxRedirects: 1, requestOnce: async () => ({ statusCode: 302, headers: { location: "/again.jpg" }, body: Buffer.alloc(0) }) }), "TOO_MANY_REDIRECTS");
  for (const input of ["http://example.com/image.jpg", "file:///etc/passwd", "data:image/png,a", "ftp://example.com/image.jpg"]) await assert.rejects(() => safeRemoteBufferFetch(input, { resolveHost: publicDns }), (error) => error instanceof SafeFetchError && error.code === "UNSUPPORTED_PROTOCOL");
  for (const input of ["https://localhost/image.jpg", "https://127.0.0.1/image.jpg", "https://10.0.0.1/image.jpg", "https://169.254.169.254/image.jpg", "https://[::1]/image.jpg", "https://[fd00::1]/image.jpg"]) await assert.rejects(() => safeRemoteBufferFetch(input), (error) => error instanceof SafeFetchError && ["PRIVATE_HOST", "PRIVATE_ADDRESS"].includes(error.code));
  const fetchedImage = await fetchAndSanitizeRemoteImage("https://public.example/image.jpg", { fetchRemote: async () => ({ url: "https://public.example/image.jpg", contentType: "image/jpeg", body: validJpeg }) });
  assert.equal(fetchedImage.mimeType, "image/webp");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-import-image-"));
  try {
    const stored = await storeSanitizedRemoteImage("https://public.example/image.png", tempDir, { fetchRemote: async () => ({ url: "https://public.example/image.png", contentType: "image/png", body: validPng }) });
    assert.match(stored.filename, /^product-import-\d+-[a-f0-9]{32}\.webp$/);
    assert.ok(fs.existsSync(path.join(tempDir, stored.filename)));
    assert.equal(fs.statSync(path.join(tempDir, stored.filename)).mode & 0o777, 0o600);
  } finally { fs.rmSync(tempDir, { recursive: true, force: true }); }

  console.log("Product/category extraction, relevance, normalization, duplicate, SSRF, and safe image pipeline tests passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
