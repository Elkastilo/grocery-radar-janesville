"use strict";

const { parsePrice, normalizeRetailerText, normalizePackage, packageFromProductTitle } = require("../productImporter");

function clean(value, limit = 500) {
  return normalizeRetailerText(value, limit);
}

function safeUrl(value, baseUrl) {
  if (!String(value || "").trim()) return "";
  try {
    const url = new URL(String(value || ""), baseUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function firstWalmartPrice(candidates) {
  for (const candidate of candidates) {
    const value = parsePrice(candidate.value);
    if (value !== null) return { value, confidence: candidate.confidence, source: candidate.source, raw: clean(candidate.raw ?? candidate.value, 120) };
  }
  return { value: null, confidence: "unknown", source: "", raw: "" };
}

function walmartPriceData(item) {
  const priceInfo = item?.priceInfo && typeof item.priceInfo === "object" ? item.priceInfo : {};
  const current = firstWalmartPrice([
    { value: priceInfo.currentPrice?.price, raw: priceInfo.currentPrice?.priceString || priceInfo.currentPrice?.priceDisplay, confidence: "high", source: "priceInfo.currentPrice.price" },
    { value: priceInfo.currentPrice?.linePrice, confidence: "high", source: "priceInfo.currentPrice.linePrice" },
    { value: priceInfo.currentPrice?.itemPrice, confidence: "high", source: "priceInfo.currentPrice.itemPrice" },
    { value: priceInfo.linePrice, confidence: "high", source: "priceInfo.linePrice" },
    { value: priceInfo.itemPrice, confidence: "high", source: "priceInfo.itemPrice" },
    { value: item.currentPrice?.price ?? item.currentPrice, confidence: "high", source: "item.currentPrice" },
    { value: item.linePrice, confidence: "high", source: "item.linePrice" },
    { value: item.itemPrice, confidence: "high", source: "item.itemPrice" },
    { value: priceInfo.currentPrice?.priceString || priceInfo.currentPrice?.priceDisplay || priceInfo.currentPrice?.displayPrice, confidence: "medium", source: "priceInfo.currentPrice.display" },
    { value: priceInfo.minPrice, confidence: "medium", source: "priceInfo.minPrice" },
    { value: priceInfo.maxPrice, confidence: "medium", source: "priceInfo.maxPrice" },
    { value: priceInfo.displayPrice, confidence: "medium", source: "priceInfo.displayPrice" },
    { value: typeof priceInfo.price === "object" ? priceInfo.price?.price : priceInfo.price, confidence: "medium", source: "priceInfo.price" },
    { value: typeof item.price === "object" ? item.price?.price : item.price, confidence: "medium", source: "item.price" }
  ]);
  const regular = firstWalmartPrice([
    { value: priceInfo.wasPrice?.price ?? priceInfo.wasPrice, confidence: "high", source: "priceInfo.wasPrice" },
    { value: priceInfo.strikeThroughPrice?.price ?? priceInfo.strikeThroughPrice, confidence: "high", source: "priceInfo.strikeThroughPrice" },
    { value: priceInfo.listPrice?.price ?? priceInfo.listPrice, confidence: "high", source: "priceInfo.listPrice" },
    { value: item.regularPrice?.price ?? item.regularPrice, confidence: "medium", source: "item.regularPrice" }
  ]);
  const unit = firstWalmartPrice([
    { value: priceInfo.unitPrice?.price, raw: priceInfo.unitPrice?.priceString || priceInfo.unitPrice?.priceDisplay, confidence: "high", source: "priceInfo.unitPrice.price" },
    { value: priceInfo.unitPrice?.linePrice, confidence: "high", source: "priceInfo.unitPrice.linePrice" },
    { value: typeof priceInfo.unitPrice === "object" ? priceInfo.unitPrice?.value : priceInfo.unitPrice, confidence: "medium", source: "priceInfo.unitPrice" },
    { value: item.unitPrice?.price ?? item.unitPrice, confidence: "medium", source: "item.unitPrice" }
  ]);
  return {
    current,
    regular: regular.value !== null && (current.value === null || regular.value > current.value) ? regular : { value: null, confidence: "unknown", source: "", raw: "" },
    unit
  };
}

function walmartPackageData(item) {
  const salesUnit = clean(item.salesUnit || item.salesUnitType || item.unit, 30);
  const weight = item.weight && typeof item.weight === "object"
    ? item.weight.displayValue || item.weight.valueText || (item.weight.value && item.weight.unit ? `${item.weight.value} ${item.weight.unit}` : "")
    : item.weight;
  const candidates = [
    item.productSize,
    item.productSizeLabel,
    item.packageSize,
    item.packageSizeDisplay,
    item.size,
    weight,
    item.weightIncrement && salesUnit && !/^(?:each|ea)$/i.test(salesUnit) ? `${item.weightIncrement} ${salesUnit}` : "",
    item.packageQuantity && item.packageUnit ? `${item.packageQuantity} ${item.packageUnit}` : "",
    item.variant
  ];
  let eachFallback = null;
  for (const candidate of candidates) {
    const normalized = normalizePackage(candidate);
    if (!normalized.raw_text) continue;
    if (normalized.unit === "each") { eachFallback ||= normalized; continue; }
    return normalized;
  }
  const titlePackage = packageFromProductTitle(item.name || item.title || item.productName);
  if (titlePackage.raw_text) return titlePackage;
  return eachFallback || normalizePackage(null);
}

function walmartSellingData(item) {
  const rawUnit = clean(item.salesUnit || item.salesUnitType || item.soldBy || item.unit, 30).toLowerCase();
  const sellUnit = /^(?:each|ea)$/.test(rawUnit) ? "each" : /^(?:lb|lbs|pound|pounds|per lb)$/.test(rawUnit) ? "lb" : rawUnit.includes("weight") ? "weight" : "";
  const explicitQuantity = Number(item.salesQuantity ?? item.sellQuantity);
  return { quantity: Number.isFinite(explicitQuantity) && explicitQuantity > 0 ? explicitQuantity : sellUnit === "each" ? 1 : null, unit: sellUnit };
}

function walmartUnitPriceUnit(item, prices) {
  if (prices.unit.value === null) return "";
  const priceInfo = item.priceInfo && typeof item.priceInfo === "object" ? item.priceInfo : {};
  const textValue = clean(priceInfo.unitPrice?.priceString || priceInfo.unitPrice?.priceDisplay || priceInfo.unitPrice?.displayValue || item.unitPriceDisplay, 100).toLowerCase();
  const match = textValue.match(/(?:\/|per\s+)(lb|oz|fl\s*oz|kg|g|each|ea|ct|count)\b/i);
  if (match) return match[1].replace(/^ea$/, "each").replace(/^count$/, "ct");
  return clean(priceInfo.unitPrice?.unit || item.unitPriceUnit, 20).toLowerCase().replace(/^ea$/, "each");
}

function normalizeWalmartItem(item, pageUrl, relevance = "high", extractionMethod = "walmart_listing_collection") {
  const prices = walmartPriceData(item);
  const currentPrice = prices.current.value;
  const packageInfo = walmartPackageData(item);
  const selling = walmartSellingData(item);
  const retailerDescription = clean(item.shortDescription || item.description, 500);
  const productUrl = safeUrl(item.canonicalUrl || item.productUrl || item.productPageUrl || item.url, pageUrl);
  const image = item.imageInfo || {};
  const imageSource = safeUrl(image.thumbnailUrl || image.imageUrl || image.allImages?.[0]?.url || item.imageUrl || item.image, pageUrl);
  const name = clean(item.name || item.title || item.productName, 200);
  if (!name) return null;
  return {
    fields: {
      name,
      brand: clean(item.brand || item.brandName || item.brandInfo?.name, 100),
      price: currentPrice,
      regular_price: prices.regular.value,
      quantity: packageInfo.quantity,
      item_size: packageInfo.item_size,
      unit: packageInfo.unit,
      package_type: packageInfo.package_type,
      raw_size_text: packageInfo.raw_text,
      sell_quantity: selling.quantity,
      sell_unit: selling.unit,
      retailer_description: retailerDescription,
      raw_price_text: prices.current.raw || (currentPrice === null ? "" : String(currentPrice)),
      unit_price: prices.unit.value,
      unit_price_unit: walmartUnitPriceUnit(item, prices),
      image_url: imageSource,
      product_url: productUrl,
      sku: clean(item.usItemId || item.sku || item.itemId, 100),
      gtin: clean(item.gtin || item.upc, 40),
      availability: clean(item.availabilityStatusDisplayValue || item.availabilityStatus || item.availability, 120)
    },
    confidence: {
      name: "high", price: prices.current.confidence, regular_price: prices.regular.confidence, brand: item.brand || item.brandName || item.brandInfo?.name ? "high" : "unknown",
      raw_size_text: packageInfo.raw_text ? "high" : "unknown", quantity: packageInfo.raw_text ? "high" : "unknown", item_size: packageInfo.item_size !== null ? "high" : "unknown",
      unit: packageInfo.unit ? "high" : "unknown", package_type: packageInfo.package_type ? "high" : "unknown", sell_quantity: selling.quantity ? "high" : "unknown", sell_unit: selling.unit ? "high" : "unknown", retailer_description: retailerDescription ? "medium" : "unknown", image_url: imageSource ? "high" : "unknown", product_url: productUrl ? "high" : "unknown",
      unit_price: prices.unit.confidence, availability: item.availabilityStatusDisplayValue || item.availabilityStatus || item.availability ? "high" : "unknown",
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

module.exports = { EXCLUDED_MODULE_PATTERN, extractWalmartCategory, normalizeWalmartItem, walmartPriceData, walmartPackageData, walmartSellingData, findSearchResults, listingCollections, excludedListingItem };
