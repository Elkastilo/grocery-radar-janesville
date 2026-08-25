"use strict";

const RETAILER_STORES = Object.freeze([
  Object.freeze({
    retailer: "walmart",
    retailer_store_id: "1305",
    retailer_store_slug: "1305-janesville-wi",
    name_pattern: /walmart/i,
    address_pattern: /3800\s+deerfield/i,
    city: "Janesville",
    state: "WI",
    departments: Object.freeze({ produce: "produce-market" })
  })
]);

function groceryStoreRetailerMetadata(store = {}) {
  return RETAILER_STORES.find((entry) => entry.name_pattern.test(String(store.name || ""))
    && entry.city.toLowerCase() === String(store.city || "").toLowerCase()
    && entry.state.toLowerCase() === String(store.state || "").toLowerCase()
    && (!String(store.address || "").trim() || entry.address_pattern.test(String(store.address)))) || null;
}

function walmartDepartmentForSource(urlValue, title = "") {
  let url;
  try { url = new URL(String(urlValue || "")); } catch { return null; }
  const evidence = `${url.pathname} ${title}`.toLowerCase();
  return /fresh[-_ /]?fruits?|fresh[-_ /]?vegetables?|produce/.test(evidence) ? "produce" : null;
}

function walmartStoreDepartmentUrl(metadata, department) {
  const slug = metadata?.retailer_store_slug;
  const path = metadata?.departments?.[department];
  return slug && path ? `https://www.walmart.com/store/${slug}/${path}` : "";
}

module.exports = { RETAILER_STORES, groceryStoreRetailerMetadata, walmartDepartmentForSource, walmartStoreDepartmentUrl };
