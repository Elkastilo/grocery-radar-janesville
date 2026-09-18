"use strict";

const { parsePrice, normalizeRetailerText, normalizePackage, normalizeImageUrl, normalizeProductUrl } = require("../productImporter");

const ALDI_GRAPHQL_HASH = "5573f6ef85bfad81463b431985396705328c5ac3283c4e183aa36c6aad1afafe";

function encodedJsonScripts(html) {
  const values = [];
  const source = String(html || "");
  let cursor = 0;
  while ((cursor = source.indexOf("<script", cursor)) >= 0) {
    const start = source.indexOf(">", cursor);
    const end = source.indexOf("</script>", start);
    if (start < 0 || end < 0) break;
    const body = source.slice(start + 1, end).trim();
    if (body.startsWith("%7B") || body.startsWith("%5B")) {
      try { values.push(JSON.parse(decodeURIComponent(body))); } catch { /* Ignore unrelated malformed state. */ }
    }
    cursor = end + 9;
  }
  return values;
}

function collectionContext(html, pageUrl) {
  const fallback = { slug: new URL(pageUrl).pathname.split("/").filter(Boolean).pop() || "", shopId: "", postalCode: "", zoneId: "", retailerLocationId: "", city: "", state: "" };
  const visit = (value, operationName = "") => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const nextOperation = /^(SimplifiedCollectionHeaderQuery|ShopCollectionScoped)$/.test(key) ? key : operationName;
      const match = key.match(/^(?:SimplifiedCollectionHeaderQuery|ShopCollectionScoped)\.(\{.*\})$/) || (nextOperation && key.startsWith("{") ? ["", key] : null);
      if (match) {
        try {
          const variables = JSON.parse(match[1]);
          if (variables.slug) fallback.slug = String(variables.slug);
          if (variables.shopId) fallback.shopId = String(variables.shopId);
          if (variables.postalCode) fallback.postalCode = String(variables.postalCode);
        } catch { /* Continue with the next serialized query key. */ }
      }
      if (typeof child === "string") {
        const location = child.match(/\b(Janesville),\s*(WI|Wisconsin)\s+(\d{5})\b/i);
        if (location) { fallback.city = location[1]; fallback.state = location[2].toUpperCase() === "WISCONSIN" ? "WI" : location[2].toUpperCase(); fallback.postalCode = location[3]; }
      }
      if (/^\d+$/.test(String(child || "")) && /retailerLocation/i.test(operationName)) fallback.retailerLocationId = String(child);
      visit(child, nextOperation);
    }
  };
  for (const value of encodedJsonScripts(html)) visit(value);
  return fallback;
}

function aldiCollectionRequest(html, pageUrl, maxProducts, pageViewId) {
  const context = collectionContext(html, pageUrl);
  const variables = {
    shopId: context.shopId,
    slug: context.slug,
    filters: [],
    pageViewId,
    itemsDisplayType: "collections_all_items_grid",
    first: maxProducts,
    pageSource: "collections",
    postalCode: context.postalCode,
    zoneId: context.zoneId
  };
  const params = new URLSearchParams({
    operationName: "CollectionProductsWithFeaturedProducts",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: ALDI_GRAPHQL_HASH } })
  });
  return { context, url: `https://www.aldi.us/graphql?${params.toString()}` };
}

function itemImage(item) {
  return item?.viewSection?.itemImage?.url || item?.image?.url || "";
}

function itemPrice(item) {
  return item?.price?.viewSection?.itemCard?.priceString || item?.price?.viewSection?.priceString || item?.price?.priceValueString || null;
}

function itemRegularPrice(item, salePrice) {
  const card = item?.price?.viewSection?.itemCard || {};
  const candidates = [card.fullPriceString, card.plainFullPriceString, card.fullPriceScreenReaderString, item?.price?.viewSection?.fullPriceString];
  for (const candidate of candidates) {
    const value = parsePrice(candidate);
    if (value !== null && (salePrice === null || value > salePrice)) return value;
  }
  return null;
}

function itemRegularPriceCandidate(item) {
  const card = item?.price?.viewSection?.itemCard || {};
  for (const candidate of [card.fullPriceString, card.plainFullPriceString, card.fullPriceScreenReaderString, item?.price?.viewSection?.fullPriceString]) {
    const value = parsePrice(candidate);
    if (value !== null) return value;
  }
  return null;
}

function itemUnitPrice(item) {
  const card = item?.price?.viewSection?.itemCard || {};
  const details = item?.price?.viewSection?.itemDetails || {};
  const candidates = [card.pricingUnitString, details.pricingUnitString, card.pricePerUnitString, details.pricePerUnitString];
  for (const candidate of candidates) {
    if (/\$\s*\d+(?:\.\d+)?\s*\/\s*[a-z]/i.test(String(candidate || ""))) return String(candidate);
  }
  return "";
}

function unitFromPriceText(value) {
  const match = String(value || "").match(/\/\s*(lb|lbs|oz|fl\s*oz|kg|g|ml|l|count|ct|each)\b/i);
  return match ? match[1].toLowerCase().replace(/\s+/g, " ").replace(/^lbs$/, "lb") : "";
}

function itemDiscount(item) {
  const card = item?.price?.viewSection?.itemCard || {};
  const badge = item?.price?.viewSection?.badge || {};
  const text = normalizeRetailerText(badge.offerLabelString, 60) || (card.discountHeaderString ? `${card.discountHeaderString}% off` : "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
  return { text, percent: match ? Number(match[1]) : null };
}

function normalizeAldiItem(item, pageUrl) {
  if (!item || typeof item !== "object") return null;
  const name = normalizeRetailerText(item.name, 200);
  if (!name) return null;
  const rawSize = normalizeRetailerText(item.size, 80);
  const packageInfo = normalizePackage(rawSize);
  const price = parsePrice(itemPrice(item));
  const regularPrice = itemRegularPrice(item, price);
  const regularCandidate = itemRegularPriceCandidate(item);
  const priceConflict = regularCandidate !== null && price !== null && regularCandidate <= price;
  const unitPriceText = itemUnitPrice(item);
  const sourceUnit = unitFromPriceText(unitPriceText);
  const quantity = packageInfo.quantity ?? 1;
  const unit = packageInfo.unit || sourceUnit || "each";
  const card = item?.price?.viewSection?.itemCard || {};
  const details = item?.price?.viewSection?.itemDetails || {};
  const availability = item?.availability || {};
  const availabilityView = availability.viewSection || {};
  const tracking = item?.viewSection?.trackingProperties || {};
  const parWeight = item?.quantityAttributes?.parWeight || item?.quantityAttributesWeight?.parWeight || null;
  const packageWeightText = card.pricingUnitSecondaryString || details.pricingUnitSecondaryString || item?.quantityAttributes?.viewSection?.parWeightDisplayString || item?.price?.parWeightTotalEstimate?.viewSection?.parWeightString || "";
  const discount = itemDiscount(item);
  const estimatedPackage = /\/\s*pkg|per package|\best\.?\b/i.test(String(itemPrice(item) || ""));
  const canonicalUrl = normalizeProductUrl(item?.productCanonicalUrl?.canonicalUrl, pageUrl);
  const productType = normalizeRetailerText(tracking.product_category_name, 100);
  const department = normalizeRetailerText(
    item.department || item.departmentName || item?.viewSection?.department || tracking.department || tracking.departmentName,
    100
  );
  const productId = normalizeRetailerText(item.productId || item.id, 100);
  const slug = normalizeRetailerText(item.evergreenUrl, 180);
  const slugSuffix = slug && slug.startsWith(`${productId}-`) ? slug.slice(productId.length + 1) : slug;
  const productUrl = canonicalUrl || normalizeProductUrl(`/store/aldi/products/${productId}${slugSuffix ? `-${slugSuffix}` : ""}`, pageUrl);
  const image = normalizeImageUrl(itemImage(item), pageUrl);
  const extra = {
    package_price: price,
    estimated_package_price: estimatedPackage ? price : null,
    per_unit_price: parsePrice(unitPriceText),
    per_unit_price_unit: sourceUnit || "",
    per_lb_price: sourceUnit === "lb" ? parsePrice(unitPriceText) : null,
    package_weight: parWeight?.quantity ?? null,
    package_weight_unit: parWeight?.measurementUnit?.costUnit || "",
    package_weight_text: normalizeRetailerText(packageWeightText, 100),
    discount_percent: discount.percent,
    discount_text: discount.text,
    stock_status: normalizeRetailerText(availabilityView.stockLevelLabelString || availability.stockLevel, 80),
    department,
    category: productType,
    subcategory: productType,
    product_type: productType,
    availability_date: normalizeRetailerText(availabilityView.upcomingProductAvailableFromString, 100),
    availability_note: normalizeRetailerText(details.saleDisclaimerString, 120)
  };
  return {
    fields: {
      name,
      brand: normalizeRetailerText(item.brandName, 100),
      price,
      regular_price: regularPrice,
      price_conflict: priceConflict,
      quantity,
      item_size: packageInfo.item_size,
      unit,
      package_type: packageInfo.package_type,
      raw_size_text: packageInfo.raw_text,
      sell_quantity: null,
      sell_unit: "",
      retailer_description: "",
      raw_price_text: normalizeRetailerText(itemPrice(item), 120),
      unit_price: parsePrice(unitPriceText),
      unit_price_unit: sourceUnit || unit,
      estimated_package_price: extra.estimated_package_price,
      per_lb_price: extra.per_lb_price,
      package_weight: extra.package_weight,
      package_weight_unit: extra.package_weight_unit,
      discount_percent: extra.discount_percent,
      stock_status: extra.stock_status,
      department: extra.department,
      category: extra.category,
      subcategory: extra.subcategory,
      product_type: extra.product_type,
      availability_date: extra.availability_date,
      image_url: image,
      product_url: productUrl,
      sku: productId,
      gtin: normalizeRetailerText(item.legacyId || item.legacyV3Id, 40),
      availability: normalizeRetailerText(item.availability?.available === false ? "out of stock" : "in stock", 40)
    },
    confidence: { name: "high", brand: item.brandName ? "high" : "unknown", price: price === null ? "unknown" : "high", regular_price: regularPrice === null ? "unknown" : "high", raw_size_text: rawSize ? "high" : "unknown", quantity: rawSize ? "high" : "medium", item_size: packageInfo.item_size !== null ? "high" : "unknown", unit: packageInfo.unit || sourceUnit ? "high" : "medium", package_type: packageInfo.package_type ? "high" : "unknown", image_url: image ? "high" : "unknown", product_url: productUrl ? "high" : "unknown", sku: productId ? "high" : "unknown", gtin: item.legacyId ? "medium" : "unknown" },
    field_origins: { name: "aldi_graphql_collection", brand: item.brandName ? "aldi_graphql_collection" : "", price: price === null ? "" : "aldi_graphql_collection", regular_price: regularPrice === null ? "" : "aldi_graphql_collection", raw_size_text: rawSize ? "aldi_graphql_collection" : "", unit_price: unitPriceText ? "aldi_graphql_collection" : "", estimated_package_price: extra.estimated_package_price === null ? "" : "aldi_graphql_collection", per_lb_price: extra.per_lb_price === null ? "" : "aldi_graphql_collection", package_weight: extra.package_weight === null ? "" : "aldi_graphql_collection", discount_percent: extra.discount_percent === null ? "" : "aldi_graphql_collection", stock_status: extra.stock_status ? "aldi_graphql_collection" : "", department: extra.department ? "aldi_graphql_collection" : "", category: extra.category ? "aldi_graphql_collection" : "", subcategory: extra.subcategory ? "aldi_graphql_collection" : "", product_type: extra.product_type ? "aldi_graphql_collection" : "", image_url: image ? "aldi_graphql_collection" : "", product_url: "aldi_graphql_collection", sku: productId ? "aldi_graphql_collection" : "", gtin: item.legacyId ? "aldi_graphql_collection" : "" },
    methods_used: ["aldi_graphql_collection"], overall_confidence: price === null ? "medium" : "high", category_relevance: "high", selected_by_default: true,
    metadata: extra,
    warnings: [price === null ? "Price was not present in the ALDI collection data." : "", priceConflict ? "The ALDI source exposed conflicting current and regular prices." : "", image ? "" : "Image source was not present."].filter(Boolean)
  };
}

function extractAldiCollection(data, pageUrl, maxProducts) {
  const collection = data?.data?.collectionProducts || data?.collectionProducts || {};
  const rawItems = Array.isArray(collection.items) ? collection.items : [];
  const products = [];
  const seen = new Set();
  for (const item of rawItems.slice(0, maxProducts)) {
    const product = normalizeAldiItem(item, pageUrl);
    const key = product?.fields?.sku || product?.fields?.product_url;
    if (product && key && !seen.has(key)) { seen.add(key); products.push(product); }
  }
  return { products, itemIds: Array.isArray(collection.itemIds) ? collection.itemIds.slice(0, maxProducts) : [], hasMore: Boolean(collection.hasMore), collection: collection.collection || null };
}

module.exports = { ALDI_GRAPHQL_HASH, collectionContext, aldiCollectionRequest, normalizeAldiItem, extractAldiCollection };
