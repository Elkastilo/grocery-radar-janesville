"use strict";

const { parsePrice, normalizeRetailerText, normalizePackage } = require("../productImporter");

function safeUrl(value, baseUrl) {
  try { const url = new URL(String(value || ""), baseUrl); return url.protocol === "https:" ? url.toString() : ""; }
  catch { return ""; }
}

function extractFestivalListing(html, context) {
  const products = [];
  const cards = String(html || "").split(/<div\s+class=["']search_result["'][^>]*>/i).slice(1);
  for (const card of cards) {
    if (products.length >= context.maxProducts || Date.now() > context.deadline) break;
    const boundary = card.split(/<div\s+class=["']search_result["']/i)[0];
    const id = boundary.match(/data-prodID=["']?(\d+)/i)?.[1] || boundary.match(/\/view\/(\d+)/i)?.[1] || "";
    const name = normalizeRetailerText(boundary.match(/<h3[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1], 200);
    const rawPrice = normalizeRetailerText(boundary.match(/class=["']search_price["'][^>]*>([\s\S]*?)<\/div>/i)?.[1], 120);
    const price = parsePrice(rawPrice);
    if (!id || !name) continue;
    const unitMatch = rawPrice.match(/\/\s*(ea|each|lb|oz|ct)\b/i);
    const image = boundary.match(/class=["']result_image["'][^>]*data-img=["']([^"']+)/i)?.[1] || "";
    const pkg = normalizePackage(name);
    products.push({
      fields: { name, brand: "", price, regular_price: null, quantity: pkg.quantity, item_size: pkg.item_size, unit: pkg.unit, package_type: pkg.package_type, raw_size_text: pkg.raw_text, sell_quantity: unitMatch ? 1 : null, sell_unit: unitMatch?.[1]?.toLowerCase().replace("ea", "each") || "", retailer_description: "", raw_price_text: rawPrice, unit_price: null, unit_price_unit: "", image_url: safeUrl(image.replace(/&amp;/g, "&"), context.pageUrl), product_url: safeUrl(`/view/${id}`, context.pageUrl), sku: id, gtin: "", availability: "" },
      confidence: { name: "high", price: price === null ? "unknown" : "high", raw_size_text: pkg.raw_text ? "medium" : "unknown", image_url: image ? "high" : "unknown", product_url: "high", sku: "high", sell_unit: unitMatch ? "high" : "unknown" },
      field_origins: { name: "festival_search_result", price: price === null ? "" : "festival_search_result:search_price", image_url: image ? "festival_search_result:data_img" : "", product_url: "festival_search_result:view_url", sku: "festival_search_result:data_prodID" },
      methods_used: ["festival_search_result"], overall_confidence: price === null ? "medium" : "high", category_relevance: "high", selected_by_default: true,
      warnings: price === null ? ["Price was not present in the Festival listing item."] : []
    });
  }
  return products;
}

module.exports = { extractFestivalListing };
