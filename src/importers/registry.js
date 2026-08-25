"use strict";

const STATUS = Object.freeze({ SUPPORTED: "SUPPORTED", PARTIAL: "PARTIAL", UNAVAILABLE: "UNAVAILABLE", UNTESTED: "UNTESTED" });

const RETAILERS = Object.freeze([
  { id: "walmart", label: "Walmart", domains: ["walmart.com"], adapter: "walmart", capabilities: { product: STATUS.SUPPORTED, category: STATUS.SUPPORTED, search: STATUS.SUPPORTED, pagination: STATUS.SUPPORTED, store_price: STATUS.SUPPORTED } },
  { id: "aldi", label: "ALDI", domains: ["aldi.us", "shop.aldi.us"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.PARTIAL, search: STATUS.PARTIAL, pagination: STATUS.PARTIAL, store_price: STATUS.UNAVAILABLE } },
  { id: "woodmans", label: "Woodman's", domains: ["woodmans-food.com", "shopwoodmans.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "target", label: "Target", domains: ["target.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "festival", label: "Festival Foods", domains: ["festivalfoods.net", "cart.festivalfoods.net"], adapter: "festival", capabilities: { product: STATUS.PARTIAL, category: STATUS.SUPPORTED, search: STATUS.SUPPORTED, pagination: STATUS.SUPPORTED, store_price: STATUS.UNAVAILABLE } },
  { id: "hyvee", label: "Hy-Vee", domains: ["hy-vee.com"], adapter: "generic", capabilities: { product: STATUS.SUPPORTED, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "kroger", label: "Pick 'n Save / Kroger", domains: ["picknsave.com", "kroger.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "sentry", label: "Daniels Sentry", domains: ["danielssentry.com", "sentryfoods.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "kwiktrip", label: "Kwik Trip", domains: ["kwiktrip.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "santamaria", label: "Santa Maria Supermarket", domains: [], adapter: "generic", capabilities: { product: STATUS.UNTESTED, category: STATUS.UNTESTED, search: STATUS.UNTESTED, pagination: STATUS.UNTESTED, store_price: STATUS.UNAVAILABLE } },
  { id: "samsclub", label: "Sam's Club", domains: ["samsclub.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.UNAVAILABLE, search: STATUS.UNAVAILABLE, pagination: STATUS.UNAVAILABLE, store_price: STATUS.UNAVAILABLE } },
  { id: "dollartree", label: "Dollar Tree", domains: ["dollartree.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.PARTIAL, search: STATUS.PARTIAL, pagination: STATUS.PARTIAL, store_price: STATUS.UNAVAILABLE } },
  { id: "dollargeneral", label: "Dollar General", domains: ["dollargeneral.com"], adapter: "generic", capabilities: { product: STATUS.PARTIAL, category: STATUS.PARTIAL, search: STATUS.PARTIAL, pagination: STATUS.PARTIAL, store_price: STATUS.UNAVAILABLE } }
]);

function normalizedHostname(value) {
  try { return new URL(String(value || "")).hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, ""); }
  catch { return ""; }
}

function retailerDefinition(value) {
  const hostname = normalizedHostname(value);
  return RETAILERS.find((entry) => entry.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) || null;
}

function classifyUrl(value, retailer = retailerDefinition(value)) {
  let url;
  try { url = new URL(String(value || "")); } catch { return "unsupported"; }
  const path = url.pathname.toLowerCase();
  if (retailer?.id === "walmart" && /^\/store\/\d+-[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(path)) return "store_category";
  if (/\/(?:ip|products?|product-detail|p)\//.test(path) || /\/dp\//.test(path) || /\/view\/\d+/.test(path)) return "product";
  if (/\/(?:search|s)(?:\/|$)/.test(path) || url.searchParams.has("q") || url.searchParams.has("query") || url.searchParams.has("search")) return "search";
  if (/\/(?:browse|category|categories|collections?|aisle|aisles-online\/browse|dept|department|specials)(?:\/|$)/.test(path)) return "category";
  if (/\/store\/[^/]+\/(?:pages|collections)\//.test(path)) return "store_category";
  return "unsupported";
}

function resolveAdapter(value) {
  const retailer = retailerDefinition(value);
  return { retailer, adapter: retailer?.adapter || "generic", page_type: classifyUrl(value, retailer), supported: Boolean(retailer) };
}

function supportMatrix() {
  return RETAILERS.map(({ id, label, adapter, capabilities }) => ({ retailer: id, label, adapter, ...capabilities }));
}

module.exports = { STATUS, RETAILERS, normalizedHostname, retailerDefinition, classifyUrl, resolveAdapter, supportMatrix };
