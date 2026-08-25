"use strict";

const { parsePrice, normalizePackage } = require("../productImporter");

function clean(value, limit = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeUrl(value, baseUrl) {
  if (!String(value || "").trim()) return "";
  try {
    const url = new URL(String(value || ""), baseUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function normalizeWalmartItem(item, pageUrl, relevance = "high", extractionMethod = "walmart_listing_collection") {
  const priceInfo = item.priceInfo || item.price || {};
  const currentPrice = parsePrice(priceInfo.currentPrice?.price ?? priceInfo.currentPrice ?? priceInfo.price ?? item.price);
  const regularPrice = parsePrice(priceInfo.wasPrice?.price ?? priceInfo.wasPrice ?? priceInfo.listPrice?.price ?? item.regularPrice);
  const sizeText = clean(item.productSize || item.productSizeLabel || item.weight || item.variant || item.description, 120);
  const packageInfo = normalizePackage(sizeText);
  const productUrl = safeUrl(item.canonicalUrl || item.productUrl || item.productPageUrl || item.url, pageUrl);
  const image = item.imageInfo || {};
  const imageSource = safeUrl(image.thumbnailUrl || image.imageUrl || image.allImages?.[0]?.url || item.imageUrl || item.image, pageUrl);
  const name = clean(item.name || item.title || item.productName, 200);
  if (!name) return null;
  return {
    fields: {
      name,
      brand: clean(item.brand || item.brandName, 100),
      price: currentPrice,
      regular_price: regularPrice !== null && currentPrice !== null && regularPrice > currentPrice ? regularPrice : null,
      quantity: packageInfo.quantity,
      item_size: packageInfo.item_size,
      unit: packageInfo.unit,
      raw_size_text: packageInfo.raw_text,
      raw_price_text: clean(priceInfo.currentPrice?.priceString || priceInfo.currentPrice?.priceDisplay || (currentPrice === null ? "" : String(currentPrice)), 120),
      unit_price: parsePrice(priceInfo.unitPrice?.price ?? priceInfo.unitPrice),
      image_url: imageSource,
      product_url: productUrl,
      sku: clean(item.usItemId || item.sku || item.itemId, 100),
      gtin: clean(item.gtin || item.upc, 40),
      availability: clean(item.availabilityStatusDisplayValue || item.availabilityStatus || item.availability, 120)
    },
    confidence: {
      name: "high", price: currentPrice === null ? "unknown" : "high", brand: item.brand || item.brandName ? "high" : "unknown",
      raw_size_text: sizeText ? "medium" : "unknown", quantity: sizeText ? "medium" : "unknown", item_size: sizeText ? "medium" : "unknown",
      unit: sizeText ? "medium" : "unknown", image_url: imageSource ? "high" : "unknown", product_url: productUrl ? "high" : "unknown",
      unit_price: priceInfo.unitPrice ? "high" : "unknown", availability: item.availabilityStatusDisplayValue || item.availabilityStatus || item.availability ? "high" : "unknown",
      sku: item.usItemId || item.sku || item.itemId ? "high" : "unknown", gtin: item.gtin || item.upc ? "high" : "unknown"
    },
    methods_used: [extractionMethod],
    overall_confidence: currentPrice === null ? "medium" : "high",
    category_relevance: relevance,
    selected_by_default: relevance !== "low",
    warnings: [currentPrice === null ? "Price was not present in the serialized listing item." : "", imageSource ? "" : "Image source was not present.", relevance === "medium" ? "This item came from a less-certain Walmart listing collection and needs category review." : ""].filter(Boolean)
  };
}

const EXCLUDED_MODULE_PATTERN = /sponsor|recommend|also.bought|recent|carousel|related|inspired|popular.near|buy.with|similar|ad.module/i;

function walmartShape(value) {
  return value && typeof value === "object" && (value.usItemId || value.itemId) && (value.name || value.title || value.productName) && (value.priceInfo || value.price !== undefined);
}

function excludedListingItem(item) {
  const label = clean([item?.type, item?.moduleType, item?.badge, item?.badgeText, item?.source, item?.tracking?.module].filter(Boolean).join(" "), 200);
  return item?.sponsored === true || item?.isSponsored === true || item?.isAd === true || EXCLUDED_MODULE_PATTERN.test(label);
}

function findSearchResults(root, deadline, timeoutError) {
  const found = [];
  let visited = 0;
  const walk = (value, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 24) return;
    visited += 1;
    if ((visited & 255) === 0 && Date.now() > deadline) throw timeoutError();
    if (!Array.isArray(value) && value.searchResult && typeof value.searchResult === "object") found.push(value.searchResult);
    if (Array.isArray(value)) value.forEach((entry) => walk(entry, depth + 1));
    else Object.entries(value).forEach(([key, entry]) => {
      if (!EXCLUDED_MODULE_PATTERN.test(key)) walk(entry, depth + 1);
    });
  };
  walk(root);
  return found;
}

function listingCollections(searchResult) {
  const collections = [];
  const add = (items, label, relevance = "high") => {
    if (Array.isArray(items) && items.some(walmartShape)) collections.push({ items, label, relevance });
  };
  add(searchResult.items, "searchResult.items");
  add(searchResult.products, "searchResult.products");
  for (const [index, stack] of (Array.isArray(searchResult.itemStacks) ? searchResult.itemStacks : []).entries()) {
    const label = clean([stack?.title, stack?.name, stack?.type, stack?.displayName, stack?.moduleType].filter(Boolean).join(" "), 200);
    if (EXCLUDED_MODULE_PATTERN.test(label) || stack?.sponsored === true || stack?.isSponsored === true) continue;
    add(stack?.items, `searchResult.itemStacks[${index}].items`, "high");
    add(stack?.products, `searchResult.itemStacks[${index}].products`, "high");
  }
  return collections;
}

function extractWalmartCategory(jsonValues, context) {
  const products = [];
  const seen = new Set();
  for (const root of jsonValues) {
    for (const result of findSearchResults(root, context.deadline, context.timeoutError)) {
      for (const collection of listingCollections(result)) {
        for (const item of collection.items) {
          if (products.length >= context.maxProducts) return products;
          if (!walmartShape(item) || excludedListingItem(item)) continue;
          const product = normalizeWalmartItem(item, context.pageUrl, collection.relevance, `walmart_${collection.label}`);
          const key = product && (product.fields.sku || product.fields.product_url || `${product.fields.name}|${product.fields.price}`);
          if (product && !seen.has(key)) { seen.add(key); products.push(product); }
        }
      }
    }
  }
  return products;
}

module.exports = { EXCLUDED_MODULE_PATTERN, extractWalmartCategory, normalizeWalmartItem, findSearchResults, listingCollections, excludedListingItem };
