const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { extractProduct, normalizePackage, detectRetailer, findDuplicateCandidates } = require("../src/productImporter");
const { safeRemoteFetch, safeCategoryRemoteFetch, CATEGORY_DEFAULTS, validateRemoteUrl, isPublicAddress, SafeFetchError } = require("../src/safeRemoteFetch");
const { categoryUrlHint, extractCategory, analyzePage } = require("../src/categoryImporter");

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

  console.log("Product URL importer parser, normalization, retailer, duplicate, and SSRF tests passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
