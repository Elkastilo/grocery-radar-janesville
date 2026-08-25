"use strict";

const { parsePrice, normalizeRetailerText, normalizePackage } = require("../productImporter");

function typeNames(value) {
  const type = value?.["@type"];
  return (Array.isArray(type) ? type : [type]).filter(Boolean).map((entry) => String(entry).toLowerCase());
}

function safeUrl(value, baseUrl) {
  try {
    const url = new URL(String(value || ""), baseUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function offerValue(value) {
  const offers = Array.isArray(value) ? value : value ? [value] : [];
  return offers.find((offer) => offer && typeof offer === "object") || {};
}

function normalizeSchemaProduct(value, pageUrl, method = "json_ld_product") {
  if (!value || typeof value !== "object" || !typeNames(value).includes("product")) return null;
  const name = normalizeRetailerText(value.name, 200);
  if (!name) return null;
  const offer = offerValue(value.offers);
  const price = parsePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
  const possibleRegular = parsePrice(offer.highPrice ?? offer.regularPrice ?? offer.originalPrice ?? offer.priceSpecification?.listPrice);
  const packageInfo = normalizePackage(value.size || value.weight || value.packageSize);
  const imageValue = Array.isArray(value.image) ? value.image[0] : value.image;
  const image = safeUrl(typeof imageValue === "string" ? imageValue : imageValue?.url || imageValue?.contentUrl, pageUrl);
  const productUrl = safeUrl(value.url || offer.url, pageUrl);
  const brand = normalizeRetailerText(typeof value.brand === "string" ? value.brand : value.brand?.name, 100);
  const sku = normalizeRetailerText(value.sku || value.mpn || value.productID, 100);
  const gtin = normalizeRetailerText(value.gtin14 || value.gtin13 || value.gtin12 || value.gtin8 || value.gtin || value.upc, 40);
  return {
    fields: { name, brand, price, regular_price: possibleRegular !== null && price !== null && possibleRegular > price ? possibleRegular : null, quantity: packageInfo.quantity, item_size: packageInfo.item_size, unit: packageInfo.unit, package_type: packageInfo.package_type, raw_size_text: packageInfo.raw_text, sell_quantity: null, sell_unit: "", retailer_description: normalizeRetailerText(value.description, 500), raw_price_text: normalizeRetailerText(offer.price ?? offer.lowPrice, 120), unit_price: null, unit_price_unit: "", image_url: image, product_url: productUrl, sku, gtin, availability: normalizeRetailerText(offer.availability || value.availability, 120).split("/").pop() },
    confidence: { name: "high", brand: brand ? "high" : "unknown", price: price === null ? "unknown" : "high", regular_price: possibleRegular !== null ? "high" : "unknown", raw_size_text: packageInfo.raw_text ? "medium" : "unknown", quantity: packageInfo.raw_text ? "medium" : "unknown", item_size: packageInfo.item_size !== null ? "medium" : "unknown", unit: packageInfo.unit ? "medium" : "unknown", package_type: packageInfo.package_type ? "medium" : "unknown", image_url: image ? "high" : "unknown", product_url: productUrl ? "high" : "unknown", sku: sku ? "high" : "unknown", gtin: gtin ? "high" : "unknown", availability: offer.availability || value.availability ? "high" : "unknown" },
    field_origins: { name: method, brand: brand ? method : "", price: price === null ? "" : `${method}:offer`, regular_price: possibleRegular !== null ? `${method}:aggregate_or_regular_offer` : "", raw_size_text: packageInfo.raw_text ? `${method}:size` : "", image_url: image ? `${method}:image` : "", product_url: productUrl ? `${method}:url` : "", sku: sku ? `${method}:sku` : "", gtin: gtin ? `${method}:gtin` : "" },
    methods_used: [method], overall_confidence: price === null ? "medium" : "high", category_relevance: "medium", selected_by_default: true,
    warnings: [price === null ? "Price was not present in the structured product data." : "", image ? "" : "Image source was not present."].filter(Boolean)
  };
}

function directProducts(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.filter((entry) => typeNames(entry).includes("product"));
  const output = [];
  if (typeNames(value).includes("product")) output.push(value);
  if (Array.isArray(value["@graph"])) output.push(...value["@graph"].filter((entry) => typeNames(entry).includes("product")));
  if (typeNames(value).includes("itemlist") && Array.isArray(value.itemListElement)) {
    for (const entry of value.itemListElement) {
      const item = entry?.item || entry;
      if (typeNames(item).includes("product")) output.push(item);
    }
  }
  return output;
}

function extractGenericListing(jsonValues, context, method = "generic_structured_data") {
  const products = [];
  const seen = new Set();
  for (const value of jsonValues) {
    if (Date.now() > context.deadline) throw context.timeoutError();
    for (const raw of directProducts(value)) {
      const product = normalizeSchemaProduct(raw, context.pageUrl, method);
      const key = product && (product.fields.gtin || product.fields.sku || product.fields.product_url || `${product.fields.name}|${product.fields.price}`);
      if (product && !seen.has(key)) { seen.add(key); products.push(product); }
      if (products.length >= context.maxProducts) return products;
    }
  }
  return products;
}

module.exports = { typeNames, normalizeSchemaProduct, extractGenericListing };
