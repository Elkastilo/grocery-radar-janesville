"use strict";

const { parsePrice, normalizePackage, detectRetailer, extractProduct } = require("./productImporter");
const { extractWalmartCategory } = require("./importers/walmart");

const MAX_CATEGORY_PRODUCTS = 50;
const CATEGORY_PRODUCT_CHOICES = Object.freeze([10, 25, 50]);
const CATEGORY_PARSE_TIMEOUT_MS = 1500;

class CategoryImportError extends Error {
  constructor(code, message) { super(message); this.name = "CategoryImportError"; this.code = code; }
}

function clean(value, limit = 500) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit); }

function categoryUrlHint(input) {
  let url;
  try { url = new URL(String(input || "")); } catch { return "unsupported"; }
  const path = url.pathname.toLowerCase();
  if (/\/(?:ip|product|p)\//.test(path) || /\/dp\//.test(path)) return "product";
  if (/\/(?:browse|category|categories|search|collections?|aisle)(?:\/|$)/.test(path) || url.searchParams.has("q") || url.searchParams.has("query")) return "category";
  return "unknown";
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

function safeUrl(value, baseUrl) {
  if (!String(value || "").trim()) return "";
  try {
    const url = new URL(String(value || ""), baseUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function genericProduct(value, pageUrl, method = "generic_serialized_data") {
  const name = clean(value.name || value.productName || value.title, 200);
  if (!name) return null;
  const offer = Array.isArray(value.offers) ? value.offers[0] || {} : value.offers || {};
  const price = parsePrice(offer.price ?? offer.lowPrice ?? value.currentPrice ?? value.price?.value ?? value.price);
  const regular = parsePrice(offer.regularPrice ?? offer.originalPrice ?? value.regularPrice ?? value.originalPrice);
  const sizeText = clean(value.size || value.packageSize || value.weight || value.description, 120);
  const pkg = normalizePackage(sizeText);
  const imageValue = Array.isArray(value.image) ? value.image[0] : value.image;
  const imageUrl = safeUrl(typeof imageValue === "string" ? imageValue : imageValue?.url || imageValue?.contentUrl || value.imageUrl, pageUrl);
  const productUrl = safeUrl(offer.url || value.url || value.productUrl || value.canonicalUrl, pageUrl);
  return {
    fields: {
      name, brand: clean(typeof value.brand === "string" ? value.brand : value.brand?.name || value.brandName, 100),
      price, regular_price: regular !== null && price !== null && regular > price ? regular : null,
      quantity: pkg.quantity, item_size: pkg.item_size, unit: pkg.unit, raw_size_text: pkg.raw_text,
      raw_price_text: clean(offer.price ?? offer.lowPrice ?? value.currentPrice ?? value.price, 120),
      unit_price: parsePrice(value.unitPrice || offer.unitPrice), image_url: imageUrl, product_url: productUrl,
      sku: clean(value.sku || value.itemId || value.productId, 100), gtin: clean(value.gtin14 || value.gtin13 || value.gtin12 || value.gtin || value.upc, 40),
      availability: clean(offer.availability || value.availability, 120).split("/").pop()
    },
    confidence: {
      name: "high", price: price === null ? "unknown" : "high", brand: value.brand || value.brandName ? "medium" : "unknown",
      raw_size_text: sizeText ? "medium" : "unknown", quantity: sizeText ? "medium" : "unknown", item_size: sizeText ? "medium" : "unknown", unit: sizeText ? "medium" : "unknown",
      image_url: imageUrl ? "high" : "unknown", product_url: productUrl ? "high" : "unknown", sku: value.sku || value.itemId || value.productId ? "medium" : "unknown",
      gtin: value.gtin || value.gtin12 || value.gtin13 || value.gtin14 || value.upc ? "high" : "unknown", unit_price: value.unitPrice || offer.unitPrice ? "medium" : "unknown",
      availability: offer.availability || value.availability ? "medium" : "unknown"
    },
    methods_used: [method], overall_confidence: price === null ? "medium" : "high", category_relevance: method === "html_product_card" ? "low" : "medium", selected_by_default: method !== "html_product_card",
    warnings: [price === null ? "Price was not present for this listing item." : "", imageUrl ? "" : "Image source was not present."].filter(Boolean)
  };
}

function genericStructuredProducts(jsonValues, context) {
  const output = [];
  const seen = new Set();
  let visited = 0;
  const walk = (value, depth = 0) => {
    if (output.length >= context.maxProducts || depth > 35 || value === null || typeof value !== "object") return;
    visited += 1;
    if ((visited & 255) === 0 && Date.now() > context.deadline) throw context.timeoutError();
    if (!Array.isArray(value)) {
      const types = (Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]]).filter(Boolean).map((entry) => String(entry).toLowerCase());
      const looksLikeProduct = types.includes("product") || ((value.name || value.productName || value.title) && (value.offers || value.price !== undefined || value.currentPrice !== undefined) && (value.url || value.productUrl || value.sku || value.itemId || value.image || value.imageUrl));
      if (looksLikeProduct) {
        const item = genericProduct(value, context.pageUrl, types.includes("product") ? "json_ld" : "generic_serialized_data");
        const key = item && (item.fields.gtin || item.fields.sku || item.fields.product_url || `${item.fields.name}|${item.fields.price}`);
        if (item && !seen.has(key)) { seen.add(key); output.push(item); }
      }
    }
    if (output.length >= context.maxProducts) return;
    if (Array.isArray(value)) value.forEach((entry) => walk(entry, depth + 1));
    else Object.values(value).forEach((entry) => walk(entry, depth + 1));
  };
  jsonValues.forEach((value) => walk(value));
  return output;
}

function htmlCardProducts(html, context, existingKeys) {
  const output = [];
  const cards = html.match(/<(?:article|li)\b[^>]*(?:data-item-id|data-product-id|class=["'][^"']*product)[^>]*>[\s\S]*?<\/(?:article|li)>/gi) || [];
  for (const card of cards) {
    if (output.length >= context.maxProducts || Date.now() > context.deadline) break;
    const title = card.match(/(?:aria-label|title)=["']([^"']{2,200})["']/i)?.[1] || card.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1]?.replace(/<[^>]+>/g, " ");
    const priceText = card.match(/\$\s*\d+(?:\.\d{1,2})?/)?.[0];
    if (!title) continue;
    const href = card.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
    const image = card.match(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1];
    const size = clean(card.replace(/<[^>]+>/g, " "), 500).match(/\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|kg|g|ml|l|gal|gallon|ct|count)\b/i)?.[0] || "";
    const item = genericProduct({ name: clean(title, 200), price: priceText, url: href, image, size }, context.pageUrl, "html_product_card");
    const key = item.fields.product_url || `${item.fields.name}|${item.fields.price}`;
    if (!existingKeys.has(key)) { existingKeys.add(key); item.overall_confidence = "low"; Object.keys(item.confidence).forEach((field) => { if (item.confidence[field] !== "unknown") item.confidence[field] = "low"; }); output.push(item); }
  }
  return output;
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
  const hostname = new URL(pageUrl).hostname.toLowerCase();
  let adapter = "generic";
  let products = [];
  if (hostname === "walmart.com" || hostname.endsWith(".walmart.com")) {
    adapter = "walmart";
    products = extractWalmartCategory(values, context);
  }
  // A recognized Walmart listing collection is authoritative for the supplied browse page.
  // Do not top it up by recursively harvesting recommendation/navigation state.
  if (adapter !== "walmart" || !products.length) {
    const existing = new Set(products.map((item) => item.fields.gtin || item.fields.sku || item.fields.product_url || `${item.fields.name}|${item.fields.price}`));
    for (const item of genericStructuredProducts(values, context)) {
      const key = item.fields.gtin || item.fields.sku || item.fields.product_url || `${item.fields.name}|${item.fields.price}`;
      if (!existing.has(key) && products.length < maxProducts) { existing.add(key); products.push(item); }
    }
    if (products.length < maxProducts) products.push(...htmlCardProducts(html, { ...context, maxProducts: maxProducts - products.length }, existing));
  }
  if (Date.now() > deadline) throw context.timeoutError();
  const retailer = detectRetailer(pageUrl, "", stores);
  const matchedStore = stores.find((store) => String(store.id) === String(retailer.store_id));
  const location = categoryLocation(html, matchedStore);
  products = products.map((item) => ({ ...item, category_relevance: item.category_relevance || "medium", selected_by_default: item.selected_by_default !== false && item.category_relevance !== "low", retailer, location }));
  const paginationLikely = /(?:[?&](?:page|p)=\d+|rel=["']next["']|pagination|load more|next page)/i.test(html);
  if (paginationLikely) warnings.push("Additional products may exist on other pages. Only the supplied page was analyzed.");
  if (products.length >= maxProducts) warnings.push(`Detection stopped at the selected ${maxProducts}-product limit.`);
  if (!products.length) warnings.push("No safely parseable product listing items were detected.");
  return { url_type: products.length ? "category" : "unsupported", source_url: pageUrl, extracted_at: new Date().toISOString(), category_title: pageTitle(html), adapter, retailer, location, products: products.slice(0, maxProducts), detected_count: Math.min(products.length, maxProducts), max_products: maxProducts, pagination_likely: paginationLikely, warnings };
}

function analyzePage(html, pageUrl, stores = [], options = {}) {
  const hint = categoryUrlHint(pageUrl);
  if (hint === "category") return extractCategory(html, pageUrl, stores, options.maxProducts);
  const product = extractProduct(html, pageUrl, stores);
  if (product.fields?.name && (product.fields.price !== undefined || product.fields.sku || product.fields.gtin)) return { url_type: "product", extraction: product };
  const category = extractCategory(html, pageUrl, stores, options.maxProducts);
  return category.products.length > 1 ? category : { url_type: "unsupported", source_url: pageUrl, warnings: [...(category.warnings || []), "The page was not recognized as an individual product or product listing."] };
}

module.exports = { MAX_CATEGORY_PRODUCTS, CATEGORY_PRODUCT_CHOICES, CATEGORY_PARSE_TIMEOUT_MS, CategoryImportError, categoryUrlHint, extractCategory, analyzePage };
