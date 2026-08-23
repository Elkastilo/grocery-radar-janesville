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

function normalizeWalmartItem(item, pageUrl) {
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
    methods_used: ["walmart_serialized_data"],
    overall_confidence: currentPrice === null ? "medium" : "high",
    warnings: [currentPrice === null ? "Price was not present in the serialized listing item." : "", imageSource ? "" : "Image source was not present."].filter(Boolean)
  };
}

function extractWalmartCategory(jsonValues, context) {
  const products = [];
  const seen = new Set();
  let visited = 0;
  const walk = (value, depth = 0) => {
    if (products.length >= context.maxProducts || depth > 35 || value === null || typeof value !== "object") return;
    visited += 1;
    if ((visited & 255) === 0 && Date.now() > context.deadline) throw context.timeoutError();
    if (!Array.isArray(value)) {
      const hasWalmartShape = (value.usItemId || value.itemId) && (value.name || value.title || value.productName) && (value.priceInfo || value.price !== undefined);
      if (hasWalmartShape) {
        const product = normalizeWalmartItem(value, context.pageUrl);
        const key = product && (product.fields.sku || product.fields.product_url || `${product.fields.name}|${product.fields.price}`);
        if (product && !seen.has(key)) { seen.add(key); products.push(product); }
      }
    }
    if (products.length >= context.maxProducts) return;
    if (Array.isArray(value)) value.forEach((entry) => walk(entry, depth + 1));
    else Object.values(value).forEach((entry) => walk(entry, depth + 1));
  };
  jsonValues.forEach((value) => walk(value));
  return products;
}

module.exports = { extractWalmartCategory, normalizeWalmartItem };
