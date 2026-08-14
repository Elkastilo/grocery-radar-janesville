"use strict";

const APP_TIME_ZONE = "America/Chicago";
const PRICE_TYPES = Object.freeze([
  "regular", "sale", "one_day_sale", "clearance", "loyalty_price",
  "digital_coupon", "paper_coupon", "multi_buy", "bogo", "bundle",
  "manager_special", "other_promotion"
]);
const PROMOTIONAL_PRICE_TYPES = new Set(PRICE_TYPES.filter((type) => type !== "regular"));
const PUBLIC_REJECTION_REASONS = Object.freeze([
  "price unreadable", "item unreadable", "item could not be identified",
  "price does not match item", "wrong product", "duplicate submission",
  "duplicate price evidence", "wrong store", "store could not be verified",
  "date could not be verified", "promotion dates unclear",
  "promotion conditions unclear", "loyalty/card requirement unclear",
  "coupon requirement unclear", "multi-buy conditions unclear",
  "price not actually shown", "screenshot incomplete", "proof too blurry",
  "proof appears altered", "unsupported estimate", "outdated evidence",
  "not grocery/household related", "other"
]);

function cleanDate(value) {
  const text = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function localDateFor(value = new Date(), timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function normalizePriceType(value, fallback = "regular") {
  const raw = String(value || fallback).trim().toLowerCase();
  const aliases = {
    "member / loyalty": "loyalty_price", "coupon-dependent": "digital_coupon",
    unknown: fallback, one_day: "one_day_sale", one_day_special: "one_day_sale"
  };
  const normalized = raw.replace(/[\s/-]+/g, "_");
  const resolved = aliases[raw] || aliases[normalized] || normalized;
  return PRICE_TYPES.includes(resolved) ? resolved : fallback;
}

function isPromotion(value) {
  return PROMOTIONAL_PRICE_TYPES.has(normalizePriceType(value));
}

function requiresHardDate(value) {
  return ["one_day_sale", "digital_coupon", "paper_coupon"].includes(normalizePriceType(value));
}

function promotionEligibility(input = {}, now = new Date()) {
  const priceType = normalizePriceType(input.price_type || (input.sale_price ? "sale" : "regular"));
  const validFrom = cleanDate(input.valid_from_date || input.valid_start_at);
  const validThrough = cleanDate(input.valid_through_date || input.valid_end_at);
  const today = localDateFor(now);
  if (requiresHardDate(priceType) && (!validFrom || !validThrough)) {
    return { eligible: false, reason: "date_needs_review", today, price_type: priceType };
  }
  if (validFrom && today < validFrom) return { eligible: false, reason: "not_started", today, price_type: priceType };
  if (validThrough && today > validThrough) return { eligible: false, reason: "expired", today, price_type: priceType };
  return { eligible: true, reason: isPromotion(priceType) ? "active_promotion" : "freshness_applies", today, price_type: priceType };
}

function promotionGate(input = {}) {
  const priceType = normalizePriceType(input.price_type || (input.sale_price ? "sale" : "regular"));
  const validFrom = cleanDate(input.valid_from_date || input.valid_start_at);
  const validThrough = cleanDate(input.valid_through_date || input.valid_end_at);
  const conditions = String(input.promotion_conditions || "").trim();
  const offerText = String(input.display_offer_text || input.promotion_text || "").trim();
  const flags = [];
  if (requiresHardDate(priceType) && (!validFrom || !validThrough)) flags.push("DATE NEEDS REVIEW");
  if (["loyalty_price", "digital_coupon", "paper_coupon", "multi_buy", "bogo", "bundle"].includes(priceType) && !conditions) flags.push("PROMOTION CONDITIONS NEED REVIEW");
  if (["multi_buy", "bogo", "bundle"].includes(priceType) && !offerText) flags.push("OFFER TEXT NEEDS REVIEW");
  return { ready: flags.length === 0, flags, price_type: priceType };
}

module.exports = {
  APP_TIME_ZONE, PRICE_TYPES, PROMOTIONAL_PRICE_TYPES, PUBLIC_REJECTION_REASONS,
  cleanDate, localDateFor, normalizePriceType, isPromotion, requiresHardDate,
  promotionEligibility, promotionGate
};
