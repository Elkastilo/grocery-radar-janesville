"use strict";

const { parsePrice, normalizeRetailerText, normalizePackage, detectRetailer, extractProduct } = require("./productImporter");
const { extractWalmartCategory, parseWalmartStoreUrl, mergeWalmartStorePrices } = require("./importers/walmart");
const { resolveAdapter } = require("./importers/registry");
const { extractGenericListing } = require("./importers/generic");
const { extractFestivalListing } = require("./importers/festival");

const MAX_CATEGORY_PRODUCTS = 50;
const CATEGORY_PRODUCT_CHOICES = Object.freeze([10, 25, 50]);
const CATEGORY_PARSE_TIMEOUT_MS = 1500;
const CATEGORY_ENRICHMENT_MAX_REQUESTS = 8;
const CATEGORY_ENRICHMENT_CONCURRENCY = 2;
const CONFIDENCE_RANK = Object.freeze({ unknown: 0, low: 1, medium: 2, high: 3 });

class CategoryImportError extends Error {
  constructor(code, message) { super(message); this.name = "CategoryImportError"; this.code = code; }
}

function clean(value, limit = 500) { return normalizeRetailerText(value, limit); }

function validHttpsSource(value) {
  try { return new URL(String(value || "")).protocol === "https:"; } catch { return false; }
}

function productImportReadiness(fields = {}, options = {}) {
  const reasons = [];
  if (!clean(fields.name, 120)) reasons.push("name_required");
  if (parsePrice(fields.price) === null) reasons.push("price_required");
  if (!Number.isInteger(Number(options.storeId)) || Number(options.storeId) <= 0) reasons.push("store_required");
  if (!validHttpsSource(fields.product_url || fields.source_url)) reasons.push("source_required");
  if (options.hasDuplicates && !["use_existing", "create_separate"].includes(options.duplicateDecision)) reasons.push("duplicate_decision_required");
  if (options.locationConfirmable === false) reasons.push("location_confirmation_required");
  return { ready: reasons.length === 0, reasons, image_required: false };
}

function needsCriticalProductDetails(product = {}) {
  const fields = product.fields || {};
  return !clean(fields.name, 120) || parsePrice(fields.price) === null;
}

function sourceForField(product, field, fallback = "category_listing") {
  return product.field_origins?.[field] || product.field_methods?.[field] || fallback;
}

function mergeCategoryProductDetails(categoryProduct = {}, detail = {}) {
  const categoryPrice = parsePrice(categoryProduct.fields?.price);
  const categoryPriceConfidence = categoryProduct.confidence?.price || "unknown";
  const categoryPriceOrigin = sourceForField(categoryProduct, "price");
  const merged = {
    ...categoryProduct,
    fields: { ...(categoryProduct.fields || {}) },
    confidence: { ...(categoryProduct.confidence || {}) },
    field_origins: { ...(categoryProduct.field_origins || {}) },
    methods_used: [...new Set([...(categoryProduct.methods_used || []), ...(detail.methods_used || []).map((method) => `product_page_${method}`)])],
    warnings: [...(categoryProduct.warnings || [])]
  };
  const detailFields = detail.fields || {};
  const detailConfidence = detail.confidence || {};
  const replaceField = (field, valid = (value) => value !== null && value !== undefined && value !== "") => {
    const candidate = detailFields[field];
    if (!valid(candidate)) return false;
    const current = merged.fields[field];
    const currentValid = valid(current);
    const currentRank = CONFIDENCE_RANK[merged.confidence[field] || "unknown"];
    const detailRank = CONFIDENCE_RANK[detailConfidence[field] || "unknown"];
    if (currentValid && currentRank >= detailRank) return false;
    merged.fields[field] = candidate;
    merged.confidence[field] = detailConfidence[field] || "low";
    merged.field_origins[field] = `individual_product_page:${detail.field_methods?.[field] || "structured_data"}`;
    return true;
  };

  replaceField("name", (value) => Boolean(clean(value, 120)));
  replaceField("price", (value) => parsePrice(value) !== null);
  replaceField("regular_price", (value) => parsePrice(value) !== null);
  replaceField("unit_price", (value) => parsePrice(value) !== null);
  for (const field of ["brand", "sku", "gtin", "availability"]) replaceField(field, (value) => Boolean(clean(value, 120)));
  replaceField("image_url", (value) => validHttpsSource(value));

  const detailPackage = normalizePackage(detailFields.raw_size_text);
  const currentPackage = normalizePackage(merged.fields.raw_size_text);
  const detailPackageRank = CONFIDENCE_RANK[detailConfidence.raw_size_text || "unknown"];
  const currentPackageRank = CONFIDENCE_RANK[merged.confidence.raw_size_text || "unknown"];
  if (detailPackage.raw_text && (!currentPackage.raw_text || detailPackageRank > currentPackageRank)) {
    for (const field of ["raw_size_text", "quantity", "item_size", "unit", "package_type"]) {
      merged.fields[field] = field === "raw_size_text" ? detailPackage.raw_text : detailPackage[field];
      merged.confidence[field] = detailConfidence[field] || detailConfidence.raw_size_text || "medium";
      merged.field_origins[field] = `individual_product_page:${detail.field_methods?.raw_size_text || "size_normalization"}`;
    }
  }

  for (const field of Object.keys(merged.fields)) if (!merged.field_origins[field] && merged.fields[field] !== null && merged.fields[field] !== "") merged.field_origins[field] = sourceForField(categoryProduct, field);
  // Detail enrichment is additive. A missing/invalid detail value must never
  // erase a valid category-listing price or downgrade its confidence/source.
  if (categoryPrice !== null && parsePrice(merged.fields.price) === null) {
    merged.fields.price = categoryPrice;
    merged.confidence.price = categoryPriceConfidence;
    merged.field_origins.price = categoryPriceOrigin;
  }
  if (parsePrice(merged.fields.price) !== null) merged.warnings = merged.warnings.filter((warning) => !/price was not present|no reliable current price/i.test(warning));
  merged.overall_confidence = merged.confidence.name === "high" && merged.confidence.price === "high" ? "high" : clean(merged.fields.name, 120) && parsePrice(merged.fields.price) !== null ? "medium" : "low";
  merged.enrichment = { status: "updated", fetched_at: detail.extracted_at || new Date().toISOString(), source_url: detail.source_url || merged.fields.product_url || "" };
  return merged;
}

async function enrichCategoryAnalysis(analysis, options = {}) {
  const fetchProductPage = options.fetchProductPage;
  if (!analysis || analysis.url_type !== "category" || typeof fetchProductPage !== "function") return analysis;
  const maxRequests = Math.max(0, Math.min(Number(options.maxRequests) || CATEGORY_ENRICHMENT_MAX_REQUESTS, CATEGORY_ENRICHMENT_MAX_REQUESTS));
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || CATEGORY_ENRICHMENT_CONCURRENCY, CATEGORY_ENRICHMENT_CONCURRENCY));
  const targets = analysis.products.filter((product) => needsCriticalProductDetails(product) && validHttpsSource(product.fields?.product_url));
  const attempted = targets.slice(0, maxRequests);
  const targetIndexes = new Map(attempted.map((product) => [product, analysis.products.indexOf(product)]));
  let cursor = 0;
  let updated = 0;
  let failed = 0;
  const workers = Array.from({ length: Math.min(concurrency, attempted.length) }, async () => {
    while (cursor < attempted.length) {
      const product = attempted[cursor++];
      const index = targetIndexes.get(product);
      try {
        const fetched = await fetchProductPage(product.fields.product_url);
        const detail = extractProduct(fetched.body, fetched.url || product.fields.product_url, options.stores || []);
        const merged = mergeCategoryProductDetails(product, detail);
        analysis.products[index] = merged;
        if (!needsCriticalProductDetails(merged)) updated += 1;
        else {
          failed += 1;
          merged.enrichment = { status: "incomplete", source_url: product.fields.product_url };
          if (!merged.warnings.some((warning) => /additional product details/i.test(warning))) merged.warnings.push("Additional product details did not contain a valid current price.");
        }
      } catch (error) {
        failed += 1;
        analysis.products[index] = { ...product, enrichment: { status: "unavailable", code: clean(error.code, 50), source_url: product.fields.product_url }, warnings: [...(product.warnings || []), "Could not retrieve additional product details. Manual correction remains available."] };
      }
    }
  });
  await Promise.all(workers);
  for (const product of targets.slice(maxRequests)) product.enrichment = { status: "not_attempted", source_url: product.fields.product_url };
  analysis.enrichment = { attempted: attempted.length, updated, failed, deferred: Math.max(0, targets.length - attempted.length), max_requests: maxRequests, concurrency };
  return analysis;
}

function categoryUrlHint(input) {
  const pageType = resolveAdapter(input).page_type;
  if (pageType === "product") return "product";
  if (["category", "search", "department", "store_category", "listing"].includes(pageType)) return "category";
  return pageType === "unsupported" ? "unknown" : pageType;
}

function scriptJson(html, warnings, deadline) {
  const values = [];
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = regex.exec(html))) {
    if (Date.now() > deadline) throw new CategoryImportError("CATEGORY_PARSE_TIMEOUT", "Category page parsing exceeded the safety time limit.");
    const attrs = match[1];
    if (!/type\s*=\s*["'](?:application\/json|application\/ld\+json)["']/i.test(attrs) && !/id\s*=\s*["'](?:__NEXT_DATA__|__APOLLO_STATE__)["']/i.test(attrs)) continue;
    try { values.push(JSON.parse(match[2].trim())); } catch { warnings.push("One serialized-data script was malformed and ignored."); }
  }
  return values;
}

function pageTitle(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = h1 || html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "Category import";
  return clean(title.replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&"), 160);
}

function categoryLocation(html, matchedStore) {
  const visible = clean(html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ").replace(/<[^>]+>/g, " "), 30000).toLowerCase();
  if (/\bjanesville\b/.test(visible)) return { confidence: "likely_janesville", evidence: "The listing mentions Janesville, but an administrator must confirm the selected store before marking its prices Confirmed Janesville." };
  return { confidence: "unknown", evidence: matchedStore?.city?.toLowerCase() === "janesville" ? "A Janesville store can be selected, but the listing did not establish that its prices apply to that location." : "The listing did not establish a Janesville price location." };
}

function extractCategory(htmlInput, pageUrl, stores = [], requestedMax = 25) {
  const html = String(htmlInput || "");
  const maxProducts = CATEGORY_PRODUCT_CHOICES.includes(Number(requestedMax)) ? Number(requestedMax) : 25;
  const deadline = Date.now() + CATEGORY_PARSE_TIMEOUT_MS;
  const warnings = [];
  const context = { pageUrl, maxProducts, deadline, timeoutError: () => new CategoryImportError("CATEGORY_PARSE_TIMEOUT", "Category page parsing exceeded the safety time limit.") };
  const values = scriptJson(html, warnings, deadline);
  const resolution = resolveAdapter(pageUrl);
  const adapter = resolution.adapter;
  let products = [];
  if (adapter === "walmart") {
    products = extractWalmartCategory(values, context);
  } else if (adapter === "festival") {
    products = extractFestivalListing(html, context);
  } else {
    products = extractGenericListing(values, context);
  }
  // Retailer adapters and schema.org ItemList/Product collections are authoritative.
  // Never recursively harvest arbitrary application state or recommendation modules.
  if (Date.now() > deadline) throw context.timeoutError();
  const retailer = detectRetailer(pageUrl, "", stores);
  const matchedStore = stores.find((store) => String(store.id) === String(retailer.store_id));
  const walmartStore = parseWalmartStoreUrl(pageUrl);
  const location = walmartStore ? { confidence: "confirmed_store_source", evidence: `The retailer URL establishes Walmart store #${walmartStore.retailer_store_id}.` } : categoryLocation(html, matchedStore);
  products = products.map((item) => {
    const price = parsePrice(item.fields?.price);
    const priceSource = walmartStore && price !== null ? { type: "retailer_store_page", url: pageUrl, retailer_store_id: walmartStore.retailer_store_id, retailer_store_slug: walmartStore.retailer_store_slug, retrieved_at: new Date().toISOString(), location_confirmation_method: "retailer_store_page" } : null;
    return { ...item, category_relevance: item.category_relevance || "medium", selected_by_default: item.selected_by_default !== false && item.category_relevance !== "low", retailer, location, price_source: priceSource || item.price_source, readiness: productImportReadiness(item.fields, { storeId: retailer.store_id, locationConfirmable: Boolean(retailer.store_id) }) };
  });
  const paginationLikely = /(?:[?&](?:page|p)=\d+|rel=["']next["']|pagination|load more|next page)/i.test(html);
  if (paginationLikely) warnings.push("Additional products may exist on other pages. Only the supplied page was analyzed.");
  if (products.length >= maxProducts) warnings.push(`Detection stopped at the selected ${maxProducts}-product limit.`);
  if (!products.length) warnings.push("No safely parseable product listing items were detected.");
  const pricedCount = products.filter((item) => parsePrice(item.fields?.price) !== null).length;
  return { url_type: products.length ? "category" : "unsupported", page_type: resolution.page_type, source_type: walmartStore ? "walmart_store_category" : resolution.page_type === "search" ? "search" : "category", walmart_store: walmartStore, source_url: pageUrl, extracted_at: new Date().toISOString(), category_title: pageTitle(html), adapter, adapter_label: resolution.retailer?.label || "Generic structured data", capabilities: resolution.retailer?.capabilities || null, retailer, location, products: products.slice(0, maxProducts), detected_count: Math.min(products.length, maxProducts), priced_count: Math.min(pricedCount, maxProducts), max_products: maxProducts, pagination_likely: paginationLikely, warnings };
}

function mergeWalmartStoreAnalysis(discovery, storeAnalysis, expectedStore) {
  if (!discovery || !storeAnalysis || storeAnalysis.source_type !== "walmart_store_category") return discovery;
  const actual = storeAnalysis.walmart_store;
  if (!expectedStore || !actual || String(expectedStore.retailer_store_id) !== String(actual.retailer_store_id) || expectedStore.retailer_store_slug !== actual.retailer_store_slug) {
    discovery.warnings = [...(discovery.warnings || []), `Walmart store source did not match the selected Grocery Radar store${actual?.retailer_store_id ? ` (received #${actual.retailer_store_id})` : ""}.`];
    discovery.store_enrichment = { status: "store_mismatch", expected_store_id: String(expectedStore?.retailer_store_id || ""), actual_store_id: String(actual?.retailer_store_id || "") };
    return discovery;
  }
  discovery.products = mergeWalmartStorePrices(discovery.products, storeAnalysis.products, { ...actual, source_url: storeAnalysis.source_url, retrieved_at: storeAnalysis.extracted_at });
  discovery.store_enrichment = { status: "completed", retailer_store_id: actual.retailer_store_id, retailer_store_slug: actual.retailer_store_slug, source_url: storeAnalysis.source_url, matched: discovery.products.filter((product) => product.price_source?.type === "retailer_store_page").length };
  return discovery;
}

function analyzePage(html, pageUrl, stores = [], options = {}) {
  const hint = categoryUrlHint(pageUrl);
  if (hint === "category") return extractCategory(html, pageUrl, stores, options.maxProducts);
  const product = extractProduct(html, pageUrl, stores);
  if (product.fields?.name && (product.fields.price !== undefined || product.fields.sku || product.fields.gtin)) return { url_type: "product", extraction: product };
  const category = extractCategory(html, pageUrl, stores, options.maxProducts);
  return category.products.length > 1 ? category : { url_type: "unsupported", source_url: pageUrl, warnings: [...(category.warnings || []), "The page was not recognized as an individual product or product listing."] };
}

module.exports = { MAX_CATEGORY_PRODUCTS, CATEGORY_PRODUCT_CHOICES, CATEGORY_PARSE_TIMEOUT_MS, CATEGORY_ENRICHMENT_MAX_REQUESTS, CATEGORY_ENRICHMENT_CONCURRENCY, CategoryImportError, categoryUrlHint, productImportReadiness, needsCriticalProductDetails, mergeCategoryProductDetails, enrichCategoryAnalysis, extractCategory, analyzePage, mergeWalmartStoreAnalysis };
