const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { extractProduct, parsePrice, normalizeRetailerText, normalizePackage, packageFromProductTitle, detectRetailer, findDuplicateCandidates } = require("../src/productImporter");
const { safeRemoteFetch, safeCategoryRemoteFetch, safeRemoteBufferFetch, CATEGORY_DEFAULTS, validateRemoteUrl, isPublicAddress, SafeFetchError } = require("../src/safeRemoteFetch");
const { CATEGORY_ENRICHMENT_MAX_REQUESTS, CATEGORY_ENRICHMENT_CONCURRENCY, categoryUrlHint, productImportReadiness, mergeCategoryProductDetails, enrichCategoryAnalysis, extractCategory, analyzePage, mergeWalmartStoreAnalysis } = require("../src/categoryImporter");
const { parseWalmartStoreUrl, exactWalmartProductMatch } = require("../src/importers/walmart");
const { groceryStoreRetailerMetadata, walmartDepartmentForSource, walmartStoreDepartmentUrl } = require("../src/retailerStores");
const { REMOTE_IMAGE_MAX_BYTES, REMOTE_IMAGE_MAX_DIMENSION, REMOTE_IMAGE_MAX_PIXELS, IMAGE_CONCURRENCY, RemoteImageError, magicType, sanitizeImageBuffer, fetchAndSanitizeRemoteImage, createProductImagePreviewHandler, storeSanitizedRemoteImage } = require("../src/remoteProductImage");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", "product-importer", name), "utf8");
const stores = [
  { id: 1, name: "Walmart Supercenter", city: "Janesville", state: "WI" },
  { id: 2, name: "ALDI", city: "Janesville", state: "WI" },
  { id: 3, name: "Woodman's Food Market", city: "Janesville", state: "WI" }
];

function namedFunctionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist.`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) { end = index + 1; break; }
  }
  assert.ok(end > bodyStart, `${name} must have a complete function body.`);
  return source.slice(start, end);
}

function loadNamedFunction(source, name) {
  return Function(`"use strict"; ${namedFunctionSource(source, name)}; return ${name};`)();
}

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
  const walmartPageTwoUrl = "https://www.walmart.com/browse/food/fresh-fruits/976759_976793_9756351?povid=976759_HubSpoke_976793_Shoptoppicks_Allfruits_Rweb_Jan_07&seo=fresh-fruits&seo=976759_976793_9756351&page=2&affinityOverride=default";
  const validatedPageTwoUrl = validateRemoteUrl(walmartPageTwoUrl);
  assert.equal(categoryUrlHint(validatedPageTwoUrl.toString()), "category", "Walmart browse URLs remain category URLs when page=2 is present.");
  assert.deepEqual(validatedPageTwoUrl.searchParams.getAll("seo"), ["fresh-fruits", "976759_976793_9756351"], "Repeated Walmart seo parameters must remain ordered and intact.");
  assert.equal(validatedPageTwoUrl.searchParams.get("page"), "2");
  assert.equal(validatedPageTwoUrl.searchParams.get("affinityOverride"), "default");
  let requestedPageTwoUrl = "";
  const fetchedPageTwo = await safeCategoryRemoteFetch(walmartPageTwoUrl, {
    resolveHost: async () => [{ address: "8.8.8.8", family: 4 }],
    requestOnce: async (url) => {
      requestedPageTwoUrl = url.toString();
      return { statusCode: 200, headers: { "content-type": "text/html" }, body: fixture("walmart-category-page-2.html") };
    }
  });
  assert.equal(requestedPageTwoUrl, walmartPageTwoUrl, "The safe category fetch must not collapse repeated query parameters or remove pagination context.");
  const walmartPageTwo = analyzePage(fetchedPageTwo.body, fetchedPageTwo.url, stores, { maxProducts: 10 });
  assert.equal(walmartPageTwo.url_type, "category");
  assert.equal(walmartPageTwo.adapter, "walmart");
  assert.equal(walmartPageTwo.products.length, 4);
  assert.deepEqual(walmartPageTwo.products.slice(0, 3).map((product) => product.fields.price), [5.97, 9.76, 3.97]);
  assert.equal(walmartPageTwo.products[3].fields.sku, "309762096");
  assert.equal(walmartPageTwo.products[3].fields.price, null, "A legitimate price-less page-2 listing item must remain discoverable for store-aware enrichment.");
  assert.equal(walmartPageTwo.products[3].confidence.price, "unknown");
  const walmartCategory = extractCategory(fixture("walmart-category.html"), "https://www.walmart.com/browse/food/fresh-fruits/123", stores, 25);
  assert.equal(walmartCategory.url_type, "category");
  assert.equal(walmartCategory.adapter, "walmart");
  assert.equal(walmartCategory.products.length, 4);
  assert.equal(walmartCategory.products[0].fields.name, "Bananas");
  assert.equal(walmartCategory.products[0].fields.price, 0.27);
  assert.equal(walmartCategory.products[0].fields.raw_size_text, "Each");
  assert.equal(walmartCategory.products[0].fields.unit, "each");
  assert.equal(walmartCategory.products[1].fields.regular_price, 3.48);
  assert.equal(walmartCategory.products[1].fields.raw_size_text, "1 lb Container");
  assert.equal(walmartCategory.products[1].fields.item_size, 1);
  assert.equal(walmartCategory.products[1].fields.retailer_description, "Best when enjoyed at room temperature Light, refreshing taste Healthy sweet treat");
  assert.ok(!walmartCategory.products[1].fields.raw_size_text.includes("Best when"));
  assert.equal(walmartCategory.products[2].fields.raw_size_text, "18 oz");
  assert.equal(walmartCategory.products[2].fields.brand, "Freshness Guaranteed");
  assert.equal(walmartCategory.products[2].fields.image_url, "");
  assert.equal(walmartCategory.products[3].fields.price, null);
  assert.equal(walmartCategory.products[3].fields.raw_size_text, null);
  assert.equal(walmartCategory.products[3].fields.quantity, null);
  assert.equal(walmartCategory.products[3].fields.item_size, null);
  assert.equal(walmartCategory.products[3].fields.unit, "");
  assert.equal(walmartCategory.products[3].fields.retailer_description, "Refreshing and sweet golden melon Flavorful addition to many recipes");
  assert.ok(walmartCategory.products.every((item) => item.category_relevance === "high"));
  assert.ok(!walmartCategory.products.some((item) => /seafood|meat|shrimp/i.test(item.fields.name)));
  assert.equal(walmartCategory.location.confidence, "unknown");
  assert.equal(walmartCategory.pagination_likely, true);
  assert.ok(walmartCategory.warnings.some((warning) => warning.includes("malformed")));
  assert.ok(walmartCategory.warnings.some((warning) => warning.includes("other pages")));

  const walmartPrices = extractCategory(fixture("walmart-price-cases.html"), "https://www.walmart.com/browse/food/fresh-apples/456", stores, 25);
  assert.equal(walmartPrices.products.length, 3);
  assert.equal(walmartPrices.products[0].fields.price, 4.97);
  assert.equal(walmartPrices.products[0].fields.raw_size_text, "3 lb Tub");
  assert.equal(walmartPrices.products[0].fields.regular_price, 5.48);
  assert.equal(walmartPrices.products[0].fields.unit_price, 1.66);
  assert.equal(walmartPrices.products[0].confidence.price, "high");
  assert.equal(walmartPrices.products[0].confidence.regular_price, "high");
  assert.equal(walmartPrices.products[0].confidence.unit_price, "high");
  assert.equal(walmartPrices.products[1].fields.price, null);
  assert.equal(walmartPrices.products[1].confidence.price, "unknown");
  assert.notEqual(walmartPrices.products[1].overall_confidence, "high");
  assert.equal(walmartPrices.products[2].fields.price, null);
  assert.equal(walmartPrices.products[2].fields.regular_price, 6.25);
  assert.equal(walmartPrices.products[2].fields.unit_price, 2.08);
  assert.equal(walmartPrices.products[2].confidence.price, "unknown");
  assert.ok(!walmartPrices.products.some((item) => /recommendation/i.test(item.fields.name)));

  const walmartEmptyPriceFields = extractCategory(fixture("walmart-empty-price-fields.html"), "https://www.walmart.com/browse/food/fresh-fruits/976759_976793_9756351?povid=test", stores, 10);
  assert.equal(walmartEmptyPriceFields.products.length, 1);
  assert.equal(walmartEmptyPriceFields.products[0].fields.sku, "309762096");
  assert.equal(walmartEmptyPriceFields.products[0].fields.price, null, "Empty Walmart linePrice/itemPrice and zero minPrice are missing data, not a retail price.");
  assert.equal(walmartEmptyPriceFields.products[0].confidence.price, "unknown");
  assert.deepEqual(productImportReadiness(walmartEmptyPriceFields.products[0].fields, { storeId: 1 }), { ready: false, reasons: ["price_required"], image_required: false });

  const walmartMetadata = groceryStoreRetailerMetadata({ id: 1, name: "Walmart Janesville", address: "3800 Deerfield Dr", city: "Janesville", state: "WI" });
  assert.equal(walmartMetadata.retailer_store_id, "1305");
  assert.equal(walmartDepartmentForSource("https://www.walmart.com/browse/food/fresh-fruits/123"), "produce");
  assert.equal(walmartStoreDepartmentUrl(walmartMetadata, "produce"), "https://www.walmart.com/store/1305-janesville-wi/produce-market");
  assert.equal(categoryUrlHint("https://www.walmart.com/store/1305-janesville-wi/produce-market"), "category");
  assert.deepEqual(parseWalmartStoreUrl("https://www.walmart.com/store/1305-janesville-wi/produce-market"), { retailer: "walmart", retailer_store_id: "1305", retailer_store_slug: "1305-janesville-wi", department: "produce-market", source_url: "https://www.walmart.com/store/1305-janesville-wi/produce-market" });
  const genericProduce = extractCategory(fixture("walmart-store-aware-generic.html"), "https://www.walmart.com/browse/food/fresh-fruits/123", stores, 10);
  const storeProduce = extractCategory(fixture("walmart-store-1305-produce.html"), "https://www.walmart.com/store/1305-janesville-wi/produce-market", stores, 10);
  assert.equal(storeProduce.source_type, "walmart_store_category");
  assert.equal(storeProduce.products.length, 3, "Sponsored/recommendation products must remain excluded.");
  assert.equal(exactWalmartProductMatch(genericProduce.products[0].fields, storeProduce.products[0].fields), true);
  mergeWalmartStoreAnalysis(genericProduce, storeProduce, walmartMetadata);
  assert.deepEqual(genericProduce.products.map((product) => product.fields.price), [4.43, 1.98, 3.24]);
  assert.equal(genericProduce.products[0].fields.regular_price, 5.33);
  assert.equal(genericProduce.products[0].fields.unit_price, 1.97);
  assert.equal(genericProduce.products[0].fields.unit_price_unit, "lb");
  assert.equal(genericProduce.products[0].price_source.type, "retailer_store_page");
  assert.equal(genericProduce.products[0].price_source.retailer_store_id, "1305");
  assert.equal(genericProduce.products[0].location.confidence, "confirmed_store_source");
  assert.equal(productImportReadiness(genericProduce.products[0].fields, { storeId: 1 }).ready, true);
  const wrongStoreDiscovery = extractCategory(fixture("walmart-store-aware-generic.html"), "https://www.walmart.com/browse/food/fresh-fruits/123", stores, 10);
  mergeWalmartStoreAnalysis(wrongStoreDiscovery, { ...storeProduce, walmart_store: { ...storeProduce.walmart_store, retailer_store_id: "9999", retailer_store_slug: "9999-other-wi" } }, walmartMetadata);
  assert.equal(wrongStoreDiscovery.products[0].fields.price, null);
  assert.equal(wrongStoreDiscovery.store_enrichment.status, "store_mismatch");

  const missingRockitCategory = extractCategory(fixture("walmart-rockit-category-missing-price.html"), "https://www.walmart.com/browse/food/fresh-apples/456", stores, 25);
  const missingRockit = missingRockitCategory.products[0];
  assert.equal(missingRockit.fields.name, "Fresh Rockit, Crisp Sweet Miniature Apples, 3lb Tub");
  assert.equal(missingRockit.fields.price, null);
  assert.equal(missingRockit.fields.raw_size_text, "3 lb Tub");
  assert.equal(missingRockit.confidence.price, "unknown");
  assert.deepEqual(productImportReadiness(missingRockit.fields, { storeId: 1 }), { ready: false, reasons: ["price_required"], image_required: false });
  const rockitDetail = extractProduct(fixture("walmart-rockit-product.html"), "https://www.walmart.com/ip/rockit-apples/2001", stores);
  const enrichedRockit = mergeCategoryProductDetails(missingRockit, rockitDetail);
  assert.equal(enrichedRockit.fields.price, 8.97);
  assert.equal(enrichedRockit.confidence.price, "high");
  assert.equal(enrichedRockit.fields.raw_size_text, "3 lb Tub");
  assert.equal(enrichedRockit.fields.sku, "2001");
  assert.equal(enrichedRockit.field_origins.price, "individual_product_page:json_ld");
  assert.equal(productImportReadiness(enrichedRockit.fields, { storeId: 1 }).ready, true);

  const preservedCategoryPrice = mergeCategoryProductDetails({ fields: { name: "Strong listing", price: 4.25, product_url: "https://www.walmart.com/ip/strong/1" }, confidence: { name: "high", price: "high" }, field_origins: { price: "category_listing:currentPrice" } }, { fields: { price: 9.99 }, confidence: { price: "medium" }, field_methods: { price: "open_graph" } });
  assert.equal(preservedCategoryPrice.fields.price, 4.25, "Weaker product-page data must not replace a high-confidence listing price.");

  const preservedStrawberryPrice = mergeCategoryProductDetails({
    fields: { name: "Fresh Strawberries", price: 2.46, product_url: "https://www.walmart.com/ip/strawberries/1001" },
    confidence: { name: "high", price: "high" },
    field_origins: { price: "category_listing:priceInfo.linePrice" },
    warnings: []
  }, {
    fields: { name: "Fresh Strawberries", price: null },
    confidence: { name: "high", price: "unknown" },
    field_methods: { name: "json_ld", price: "json_ld" },
    methods_used: ["json_ld"]
  });
  assert.equal(preservedStrawberryPrice.fields.price, 2.46, "Missing detail-page price must not erase a valid category price.");
  assert.equal(preservedStrawberryPrice.confidence.price, "high", "Unknown detail confidence must not downgrade high category confidence.");
  assert.equal(preservedStrawberryPrice.field_origins.price, "category_listing:priceInfo.linePrice");

  const automatic = { url_type: "category", products: [missingRockit, walmartPrices.products[0]], retailer: { store_id: 1 } };
  let automaticFetches = 0;
  await enrichCategoryAnalysis(automatic, { stores, fetchProductPage: async (url) => { automaticFetches += 1; return { url, body: fixture("walmart-rockit-product.html") }; } });
  assert.equal(automaticFetches, 1, "Automatic enrichment must fetch only incomplete critical rows.");
  assert.equal(automatic.products[0].fields.price, 8.97);
  assert.equal(automatic.products[0].confidence.price, "high", "Authoritative detail price must fill a missing category price.");
  assert.equal(automatic.products[1].fields.price, 4.97);

  const pricedGrapes = { url_type: "category", products: [{ fields: { name: "Green Seedless Grapes", price: 4.43, product_url: "https://www.walmart.com/ip/grapes/3001" }, confidence: { name: "high", price: "high" }, field_origins: { price: "category_listing:priceInfo.linePrice" }, warnings: [] }] };
  let pricedGrapeFetches = 0;
  await enrichCategoryAnalysis(pricedGrapes, { stores, fetchProductPage: async () => { pricedGrapeFetches += 1; throw new SafeFetchError("RETAILER_BLOCKED", "Retailer blocked automated retrieval.", 422); } });
  assert.equal(pricedGrapeFetches, 0, "A complete category row must not make a detail request that could damage valid data.");
  assert.equal(pricedGrapes.products[0].fields.price, 4.43);
  assert.equal(pricedGrapes.products[0].confidence.price, "high");

  const manyIncomplete = { url_type: "category", products: Array.from({ length: 12 }, (_, index) => ({ fields: { name: `Missing ${index}`, price: null, product_url: `https://www.walmart.com/ip/missing/${index}` }, confidence: { name: "high", price: "unknown" }, warnings: [] })) };
  let activeEnrichment = 0;
  let maximumActiveEnrichment = 0;
  let boundedFetches = 0;
  await enrichCategoryAnalysis(manyIncomplete, { stores, fetchProductPage: async (url) => {
    boundedFetches += 1;
    activeEnrichment += 1;
    maximumActiveEnrichment = Math.max(maximumActiveEnrichment, activeEnrichment);
    await new Promise((resolve) => setTimeout(resolve, 2));
    activeEnrichment -= 1;
    return { url, body: fixture("walmart-product-no-price.html") };
  } });
  assert.equal(CATEGORY_ENRICHMENT_MAX_REQUESTS, 8);
  assert.equal(CATEGORY_ENRICHMENT_CONCURRENCY, 2);
  assert.equal(boundedFetches, 8);
  assert.ok(maximumActiveEnrichment <= 2);
  assert.equal(manyIncomplete.enrichment.deferred, 4);
  assert.equal(manyIncomplete.products[0].fields.price, null);
  assert.equal(manyIncomplete.products[0].enrichment.status, "incomplete");
  const blockedDetails = { url_type: "category", products: [{ fields: { name: "Blocked apple", price: null, product_url: "https://www.walmart.com/ip/blocked/22" }, confidence: { name: "high", price: "unknown" }, warnings: [] }] };
  await enrichCategoryAnalysis(blockedDetails, { stores, fetchProductPage: async () => { throw new SafeFetchError("RETAILER_BLOCKED", "Retailer blocked automated retrieval.", 422); } });
  assert.equal(blockedDetails.products[0].enrichment.status, "unavailable");
  assert.equal(blockedDetails.products[0].fields.price, null);
  assert.ok(blockedDetails.products[0].warnings.some((warning) => /manual correction/i.test(warning)));
  assert.equal(productImportReadiness({ name: "No-image apple", price: 2.46, product_url: "https://www.walmart.com/ip/no-image/33", image_url: "" }, { storeId: 1 }).ready, true, "Image availability must not block approval readiness.");

  for (const invalidPrice of [0, 0.00, -1, NaN, Infinity, "", null, undefined, "$0.00", "-$3.99"]) assert.equal(parsePrice(invalidPrice), null);
  assert.equal(parsePrice("$4.97"), 4.97);

  const genericCategory = analyzePage(fixture("generic-category.html"), "https://shop.example.test/category/pantry", stores, { maxProducts: 10 });
  assert.equal(genericCategory.url_type, "category");
  assert.equal(genericCategory.products.length, 2);
  assert.equal(genericCategory.products[0].fields.name, "Pasta");
  const repeatedProducts = Array.from({ length: 70 }, (_, index) => ({ "@type": "Product", name: `Item ${index}`, sku: `SKU-${index}`, url: `https://shop.example.test/product/${index}`, offers: { price: index + 1 } }));
  const capped = extractCategory(`<script type="application/ld+json">${JSON.stringify(repeatedProducts)}</script>`, "https://shop.example.test/category/all", stores, 50);
  assert.equal(capped.products.length, 50);
  assert.equal(CATEGORY_DEFAULTS.maxBytes, 5 * 1024 * 1024);

  assert.deepEqual(normalizePackage("12 x 12 fl oz"), { raw_text: "12 × 12 fl oz", quantity: 12, item_size: 12, unit: "fl oz", package_type: "", normalized_text: "12 × 12 fl oz" });
  assert.deepEqual(normalizePackage("1 lb Container"), { raw_text: "1 lb Container", quantity: 1, item_size: 1, unit: "lb", package_type: "container", normalized_text: "1 lb Container" });
  assert.deepEqual(normalizePackage("3lb Tub"), { raw_text: "3 lb Tub", quantity: 1, item_size: 3, unit: "lb", package_type: "tub", normalized_text: "3 lb Tub" });
  assert.deepEqual(normalizePackage("Each"), { raw_text: "Each", quantity: 1, item_size: null, unit: "each", package_type: "", normalized_text: "Each" });
  assert.equal(normalizePackage("1 gallon").unit, "gallon");
  assert.equal(normalizePackage("24 cans").package_type, "can");
  assert.equal(packageFromProductTitle("Green Seedless Grapes, Bag (2.25 lbs/Bag Est.)").raw_text, "2.25 lb Bag");
  assert.equal(normalizePackage("2 lb").item_size, 2);
  assert.deepEqual(normalizePackage("12 ct").quantity, 12);
  assert.equal(normalizePackage(null).raw_text, null);
  assert.equal(normalizePackage("Best when enjoyed at room temperature. Light, refreshing taste. Healthy sweet treat.").raw_text, null);
  assert.equal(normalizePackage("x".repeat(200)).raw_text, null);
  assert.equal(normalizePackage("<li>Refreshing and sweet golden melon</li><li>Flavorful addition to many recipes</li>").raw_text, null);
  assert.equal(normalizeRetailerText("<div>Fresh &amp; sweet<br><span>fruit</span></div>"), "Fresh & sweet fruit");
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
  const previewResponse = { headers: {}, statusCode: 200, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, status(code) { this.statusCode = code; return this; }, send(body) { this.body = body; }, json(body) { this.body = body; } };
  const previewHandler = createProductImagePreviewHandler({ getPreview: async (url) => {
    assert.equal(url, "https://images.example.test/product.jpg?width=320&quality=80");
    return { buffer: validWebp, mimeType: "image/webp" };
  } });
  await previewHandler({ query: { url: "https://images.example.test/product.jpg?width=320&quality=80" } }, previewResponse);
  assert.equal(previewResponse.statusCode, 200);
  assert.equal(previewResponse.headers["content-type"], "image/webp");
  assert.equal(previewResponse.headers["x-content-type-options"], "nosniff");
  assert.equal(previewResponse.headers["content-length"], String(validWebp.length));
  assert.equal(magicType(previewResponse.body), "image/webp");
  const previewWarnings = [];
  const failedPreviewResponse = { ...previewResponse, headers: {}, statusCode: 200, body: null };
  const failedPreviewHandler = createProductImagePreviewHandler({ getPreview: async () => { throw new RemoteImageError("IMAGE_DECODE_FAILED", "Image unavailable."); }, logWarning: (message, details) => previewWarnings.push({ message, details }) });
  await failedPreviewHandler({ query: { url: "https://images.example.test/product.jpg?private_token=not-logged" } }, failedPreviewResponse);
  assert.equal(failedPreviewResponse.statusCode, 422);
  assert.equal(failedPreviewResponse.body.code, "IMAGE_DECODE_FAILED");
  assert.deepEqual(previewWarnings[0].details, { code: "IMAGE_DECODE_FAILED", source_domain: "images.example.test", status: 422 });
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

  const adminScript = fs.readFileSync(path.join(__dirname, "..", "public", "admin.js"), "utf8");
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const reportMappingSource = namedFunctionSource(serverSource, "importRowToReportBody");
  assert.match(reportMappingSource, /price:\s*row\.price[,\n]/, "Importer approval must publish the reviewed item/package price.");
  assert.doesNotMatch(reportMappingSource, /price:\s*row\.comparison_price/, "Importer approval must not promote comparison pricing into the primary price.");
  assert.match(reportMappingSource, /unit:\s*row\.unit[,\n]/, "Importer approval must preserve the reviewed package unit.");
  assert.match(serverSource, /SELECT price_reports\.price[\s\S]{0,500}\) AS best_price,/, "Public product aggregation must expose the persisted item price as best_price.");
  assert.match(serverSource, /best_price_label:\s*hasCurrentPrice \? `\$\$\{Number\(row\.best_price\)\.toFixed\(2\)\}`/, "Public product headlines must format the item price without a comparison-unit suffix.");
  assert.match(serverSource, /Walmart returned the category page, but no supported product listing data was available\./, "Recognized Walmart browse responses without listings need a retailer-specific retry message.");
  assert.match(serverSource, /WALMART_LISTING_UNAVAILABLE/, "Recognized Walmart browse failures must remain distinct from unsupported-site errors.");
  assert.equal((adminScript.match(/function renderCategoryUrlPreview\(/g) || []).length, 1, "Category imports must have one renderer.");
  assert.match(adminScript, /class="importer-product-row/);
  assert.match(adminScript, /class="importer-edit-panel"[^>]*hidden/);
  assert.doesNotMatch(adminScript, /class="admin-card compact-card" data-category-product/);
  assert.match(adminScript, /data-retry-import-image/);
  assert.match(adminScript, /Downloading preview…/);
  assert.match(adminScript, /Price unavailable/);
  assert.match(adminScript, /function importerPackageLabel\(/);
  assert.match(adminScript, /Retailer description evidence/);
  assert.match(adminScript, /data-approve-import/);
  assert.match(adminScript, /data-fetch-import-details/);
  assert.match(adminScript, /Complete details/);
  assert.match(adminScript, /Approve selected/);
  assert.match(adminScript, /Needs details: <b data-needs-details-count>/);
  assert.match(adminScript, /const ready = selectedCards\.filter\(\(card\) => importerRowReadiness\(card\)\.ready\)\.length;/, "Footer readiness must inspect required row data.");
  assert.match(adminScript, /const readyCards = selectedCards\.filter\(\(card\) => importerRowReadiness\(card\)\.ready\);/, "Bulk approval must process only ready rows.");
  assert.doesNotMatch(adminScript, /selectedCards\.length - duplicates/, "Duplicate counts alone must not define approval readiness.");
  assert.match(adminScript, /function fetchImporterRowDetails\(/);
  assert.match(adminScript, /\/api\/admin\/product-url-imports\/enrich/);
  assert.match(adminScript, /product-url-imports\/\$\{card\.dataset\.importId\}\/approve/);
  assert.doesNotMatch(adminScript, /new FormData\(card\)/, "Importer product articles must never be passed to FormData.");
  assert.doesNotMatch(adminScript, /new FormData\((?:preview|result|container)\)/, "Bulk importer containers must never be passed to FormData.");
  assert.match(adminScript, /function collectImporterRowData\(/);
  assert.match(adminScript, /approveCategoryImportCard\(card, \{ confirmLocation: card\.dataset\.storeSourceConfirmed !== "true", bulk: true \}\)/, "Bulk approval must reuse per-row approval logic while respecting verified store sources.");
  assert.match(adminScript, /data-store-source-confirmed/);
  assert.match(adminScript, /Store source confirmed/);
  const approvalFlowSource = adminScript.slice(adminScript.indexOf("async function approveCategoryImportCard("), adminScript.indexOf("async function saveCategoryUrlImports("));
  assert.doesNotMatch(approvalFlowSource, /new FormData\(/, "Per-row approval must serialize canonical row state, not a DOM container.");
  const bulkFlowSource = adminScript.slice(adminScript.indexOf("async function saveCategoryUrlImports("), adminScript.indexOf("async function saveProductUrlImport("));
  assert.match(bulkFlowSource, /for \(const card of readyCards\)[\s\S]*await approveCategoryImportCard\(/, "Bulk approval must process rows through the shared approval function.");
  assert.match(bulkFlowSource, /if \(result\) approved \+= 1; else failed \+= 1;/, "A failed row must not abort remaining bulk approvals.");
  assert.match(adminScript, /Could not prepare this product for approval\. Please try again\./);
  const collectImporterRowData = loadNamedFunction(adminScript, "collectImporterRowData");
  const controls = [
    { name: "selected", type: "checkbox", checked: true, value: "on" },
    { name: "name", type: "text", value: "Fresh Strawberries — edited" },
    { name: "brand", type: "text", value: "Farm Brand" },
    { name: "price", type: "number", value: "2.46" },
    { name: "regular_price", type: "number", value: "2.98" },
    { name: "size_text", type: "text", value: "1 lb Container" },
    { name: "quantity", type: "number", value: "1" },
    { name: "item_size", type: "number", value: "1" },
    { name: "unit", type: "text", value: "lb" },
    { name: "store_id", type: "select-one", value: "17" },
    { name: "use_image_source", type: "checkbox", checked: false, value: "on" }
  ];
  const collected = collectImporterRowData({
    dataset: { duplicateDecision: "use_existing", existingProductId: "91", locationConfirmation: "admin_confirmed" },
    querySelectorAll(selector) { assert.equal(selector, "[name]"); return controls; }
  });
  assert.deepEqual(collected, {
    selected: true,
    name: "Fresh Strawberries — edited",
    brand: "Farm Brand",
    price: "2.46",
    regular_price: "2.98",
    size_text: "1 lb Container",
    quantity: "1",
    item_size: "1",
    unit: "lb",
    store_id: "17",
    use_image_source: false,
    duplicate_decision: "use_existing",
    existing_product_id: "91",
    location_confirmation: "admin_confirmed"
  }, "Canonical importer state must retain edited price, package, store, duplicate, and location values.");
  const importerRowReadiness = Function(`"use strict"; ${namedFunctionSource(adminScript, "positiveImporterPrice")} ${namedFunctionSource(adminScript, "collectImporterRowData")} ${namedFunctionSource(adminScript, "importerRowReadiness")} return importerRowReadiness;`)();
  const readinessControls = controls.map((control) => ({ ...control }));
  const readinessRow = { dataset: { hasDuplicates: "false" }, querySelectorAll(selector) { assert.equal(selector, "[name]"); return readinessControls; } };
  readinessControls.push({ name: "product_url", type: "url", value: "https://www.walmart.com/ip/fresh-strawberries/3002" });
  assert.equal(importerRowReadiness(readinessRow).ready, true);
  readinessControls.find((control) => control.name === "price").value = "";
  assert.deepEqual(importerRowReadiness(readinessRow).reasons, ["price_required"]);
  readinessControls.find((control) => control.name === "price").value = "2.46";
  readinessRow.dataset.hasDuplicates = "true";
  assert.deepEqual(importerRowReadiness(readinessRow).reasons, ["duplicate_decision_required"]);
  readinessRow.dataset.duplicateDecision = "create_separate";
  assert.equal(importerRowReadiness(readinessRow).ready, true, "Manual price edits and duplicate decisions must immediately make a valid row ready.");
  const importerApprovalErrorMessage = loadNamedFunction(adminScript, "importerApprovalErrorMessage");
  const originalConsoleError = console.error;
  const loggedApprovalErrors = [];
  console.error = (...args) => loggedApprovalErrors.push(args);
  try {
    assert.equal(importerApprovalErrorMessage(new TypeError("FormData constructor: invalid row")), "Could not prepare this product for approval. Please try again.");
    assert.equal(importerApprovalErrorMessage(Object.assign(new Error("Possible duplicate — choose a match."), { handled: true })), "Possible duplicate — choose a match.");
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(loggedApprovalErrors.length, 1, "Unexpected approval implementation errors should be logged once without reaching the UI.");
  assert.doesNotMatch(adminScript, /fields\.(?:description|retailer_description)\s*\|\|\s*fields\.raw_size_text/);
  const adminStyle = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");
  assert.match(adminStyle, /\.importer-package strong[^}]*-webkit-line-clamp:\s*2/);
  assert.match(adminStyle, /\.importer-product-row\.needs-details \.importer-price strong/);

  const walmartSellingPackages = extractCategory(fixture("walmart-selling-package-cases.html"), "https://www.walmart.com/browse/food/fresh-fruits/123", stores, 25);
  const bySku = Object.fromEntries(walmartSellingPackages.products.map((product) => [product.fields.sku, product.fields]));
  assert.equal(walmartSellingPackages.products.length, 6);
  assert.deepEqual([bySku["3001"].raw_size_text, bySku["3001"].sell_quantity, bySku["3001"].sell_unit], ["Each", 1, "each"]);
  assert.deepEqual([bySku["3002"].raw_size_text, bySku["3002"].item_size, bySku["3002"].unit, bySku["3002"].package_type, bySku["3002"].sell_unit], ["1 lb Container", 1, "lb", "container", "each"]);
  assert.equal(bySku["3003"].raw_size_text, "Each");
  assert.equal(bySku["3004"].raw_size_text, "2.25 lb Bag");
  assert.equal(bySku["3004"].unit_price_unit, "lb");
  assert.equal(bySku["3005"].raw_size_text, "3 lb Bag");
  assert.equal(bySku["3006"].raw_size_text, "52 oz Jar");
  assert.ok(!walmartSellingPackages.products.some((product) => /seafood/i.test(product.fields.name)));

  console.log("Product/category extraction, compact UI, price confidence, duplicate, SSRF, and safe image preview tests passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
