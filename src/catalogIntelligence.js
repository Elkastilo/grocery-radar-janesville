"use strict";

const RETAILER_ALIASES = [
  ["ALDI", ["aldi"]], ["Kwik Trip / Kwik Star", ["kwik trip", "kwik star"]],
  ["Pick 'n Save / Kroger", ["pick n save", "picknsave", "kroger"]], ["Walmart", ["walmart", "wal mart"]],
  ["Woodman's", ["woodmans", "woodman's"]], ["Festival Foods", ["festival foods", "festival"]],
  ["Hy-Vee", ["hy vee", "hyvee"]], ["Target", ["target"]], ["Walgreens", ["walgreens"]], ["CVS", ["cvs"]]
];

const PRODUCT_RULES = [
  [/\bbananas?\b/i, { category: "produce", storage_condition: "fresh produce" }],
  [/\bapples?\b/i, { category: "produce", storage_condition: "fresh produce" }],
  [/\bmilk\b/i, { category: "dairy", storage_condition: "refrigerated" }],
  [/\beggs?\b/i, { category: "dairy", storage_condition: "refrigerated" }],
  [/\bice cream\b/i, { category: "frozen", storage_condition: "frozen" }],
  [/\bfrozen pizza\b/i, { category: "frozen", storage_condition: "frozen" }],
  [/\bground beef\b/i, { category: "meat", storage_condition: "refrigerated" }],
  [/\bbread\b/i, { category: "bakery", storage_condition: "shelf stable" }]
];

function compact(value = "") { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }

function normalizedRetailerName(value = "") {
  const text = String(value || "").toLowerCase().trim();
  if (!text || ["unknown", "not sure", "not confirmed", "unidentified"].includes(text)) return "";
  return RETAILER_ALIASES.find(([, aliases]) => aliases.some((alias) => text.includes(alias)))?.[0] || "";
}

function usefulDetectedStoreName(value = "") {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return normalizedRetailerName(cleaned) ? cleaned : "";
}

function closestStoreForAi(name, stores = []) {
  const needle = compact(name);
  if (!needle || ["unknown", "notsure", "notconfirmed", "unidentified"].includes(needle)) return null;
  const exact = stores.find((store) => compact(store.name) === needle);
  if (exact) return exact;
  const candidates = stores.filter((store) => normalizedRetailerName(store.name) && normalizedRetailerName(store.name) === normalizedRetailerName(name));
  return candidates.length === 1 && (needle.includes("janesville") || /\b\d{2,}\b/.test(String(name))) ? candidates[0] : null;
}

function localProductNormalization(name = "") { return PRODUCT_RULES.find(([pattern]) => pattern.test(name))?.[1] || null; }

module.exports = { closestStoreForAi, localProductNormalization, normalizedRetailerName, usefulDetectedStoreName };
