const { SUPPORTED_UNITS, normalizeUnit } = require("./unitPrice");

const CATEGORIES = [
  "meat",
  "dairy",
  "produce",
  "pantry",
  "frozen",
  "drinks",
  "snacks",
  "bakery",
  "prepared food",
  "household",
  "personal care",
  "health / personal care",
  "baby",
  "pet",
  "other"
];

const PROOF_TYPES = [
  "shelf_tag_photo",
  "receipt_photo",
  "weekly_ad",
  "no_photo"
];

const VERIFICATION_TYPES = [
  "confirmed",
  "price_different",
  "item_unavailable",
  "wrong_item_store",
  "expired_sale",
  "needs_proof",
  "other"
];

const ADMIN_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "deleted",
  "disputed",
  "needs_proof",
  "needs_update",
  "expired",
  "removed"
];

const REJECTION_REASONS = [
  "No photo uploaded even though photo proof was selected",
  "Wrong store",
  "Wrong item",
  "Wrong price",
  "Blurry or unreadable photo",
  "Duplicate report",
  "Expired sale",
  "Suspicious or fake report",
  "Inappropriate content",
  "Other"
];

const ACCOUNT_STATUSES = [
  "active",
  "warning",
  "suspended",
  "banned",
  "deactivated",
  "deleted"
];

const STORE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "duplicate"
];

const SUGGESTION_TYPES = [
  "new_store",
  "new_item",
  "new_category",
  "wrong_price",
  "feature_idea",
  "allergy_ingredient_issue",
  "other"
];

const SUGGESTION_STATUSES = [
  "pending",
  "reviewed",
  "planned",
  "rejected"
];

const PRODUCT_STATUSES = [
  "active",
  "needs_review",
  "hidden",
  "merged"
];

const CART_BRAND_MODES = [
  "any",
  "preferred",
  "exact"
];

const SPONSOR_TYPES = [
  "business",
  "event",
  "community",
  "deal"
];

const SPONSOR_STATUSES = [
  "draft",
  "active",
  "paused",
  "expired"
];

const ANALYTICS_EVENTS = [
  "search_performed",
  "product_viewed",
  "report_viewed",
  "added_to_cart",
  "cart_item_added_manual",
  "cart_item_removed",
  "cart_compared",
  "cart_mode_selected",
  "missing_price_seen",
  "store_request_created",
  "suggestion_created",
  "sponsor_viewed",
  "sponsor_clicked",
  "sponsor_interested",
  "sponsor_not_interested"
];

const COMMON_AVOID_INGREDIENTS = [
  "peanuts",
  "tree nuts",
  "milk",
  "eggs",
  "soy",
  "wheat",
  "gluten",
  "sesame",
  "shellfish",
  "fish",
  "red dye",
  "artificial sweeteners"
];

const BAN_REASONS = [
  "Fake price reports",
  "Repeated rejected reports",
  "Abusive username",
  "Harassment",
  "Spam",
  "Multiple fake accounts",
  "Reward abuse",
  "Inappropriate uploads",
  "Other"
];

const blockedWords = [
  "admin",
  "moderator",
  "groceryradar",
  "official",
  "support",
  "mikehawk",
  "mycoxlong",
  "typicaltigger",
  "nypicaltigger",
  "walmartofficial",
  "targetofficial",
  "woodmansofficial"
];

const blockedUsernameFragments = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "whore",
  "nigger", "nigga", "faggot", "retard", "kike", "spic", "chink"
];

function usernameSafetyKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/8/g, "b")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1{2,}/g, "$1$1");
}

function usernameSafetyReason(value, additionalBlockedPhrases = []) {
  const raw = String(value || "");
  const key = usernameSafetyKey(raw);
  const phrases = [...blockedWords, ...blockedUsernameFragments, ...additionalBlockedPhrases]
    .map(usernameSafetyKey)
    .filter(Boolean);

  if (raw !== raw.normalize("NFKC") || /[^\x00-\x7F]/.test(raw)) {
    return "Username must use standard English letters, numbers, and underscores.";
  }

  if (phrases.some((phrase) => key.includes(phrase))) {
    return "Username contains a reserved, unsafe, or blocked phrase.";
  }

  return "";
}

function cleanText(value, maxLength = 200) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeItemName(value) {
  return cleanText(value, 120).toLowerCase();
}

function normalizeProductName(value) {
  return cleanText(value, 160).toLowerCase();
}

function parseMoney(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round((number + Number.EPSILON) * 100) / 100;
}

function parsePositiveNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function validateUsername(value) {
  const username = cleanText(value, 80);

  if (!username) {
    throw new Error("Username is required.");
  }

  if (username.length < 3 || username.length > 24) {
    throw new Error("Username must be 3 to 24 characters.");
  }

  if (!/^[A-Za-z0-9_]+$/.test(username)) {
    throw new Error("Username can use letters, numbers, and underscores only.");
  }

  if (!/[A-Za-z0-9]/.test(username)) {
    throw new Error("Username cannot be symbols only.");
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
    throw new Error("Username cannot be an email address.");
  }

  if (/\d{3,}/.test(username) && username.replace(/\D/g, "").length >= 7) {
    throw new Error("Username cannot be a phone number.");
  }

  const safetyReason = usernameSafetyReason(username);

  if (safetyReason) {
    throw new Error(safetyReason);
  }

  return username;
}

function validateEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    throw new Error("Email is required.");
  }

  if (!emailPattern.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  return email;
}

function validatePassword(value) {
  const password = String(value || "");

  if (!password) {
    throw new Error("Password is required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (password.length > 200) {
    throw new Error("Password is too long.");
  }

  return password;
}

function validateRegistration(body) {
  const username = validateUsername(body.username);
  const email = validateEmail(body.email);
  const password = validatePassword(body.password);
  const confirmPassword = String(body.confirmPassword || "");

  if (password !== confirmPassword) {
    throw new Error("Password and confirmation must match.");
  }

  return {
    username,
    email,
    password
  };
}

function validateLogin(body) {
  const password = String(body.password || "");

  if (!password) {
    throw new Error("Password is required.");
  }

  return {
    email: validateEmail(body.email),
    password
  };
}

function validatePrice(value, fieldName) {
  const price = parseMoney(value);

  if (price === null || price < 0.01) {
    throw new Error(`${fieldName} must be at least $0.01.`);
  }

  if (price > 999) {
    throw new Error(`${fieldName} cannot be over $999.`);
  }

  return price;
}

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function parseUserExpiration(value) {
  const text = cleanText(value, 20);

  if (!text) {
    return null;
  }

  const date = new Date(`${text}T23:59:59`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Expiration date is not valid.");
  }

  return date.toISOString();
}

function calculateExpiration(category, salePrice, userExpiration) {
  const enteredExpiration = parseUserExpiration(userExpiration);

  if (enteredExpiration) {
    return enteredExpiration;
  }

  if (salePrice) {
    return daysFromNow(3);
  }

  if (category === "produce" || category === "meat") {
    return daysFromNow(2);
  }

  if (category === "dairy") {
    return daysFromNow(5);
  }

  return daysFromNow(14);
}

function validateReport(body, validStoreIds) {
  const itemName = normalizeItemName(body.item_name);

  if (!itemName) {
    throw new Error("Item name is required.");
  }

  const storeId = Number.parseInt(body.store_id, 10);

  if (!Number.isInteger(storeId) || !validStoreIds.includes(storeId)) {
    throw new Error("A valid Janesville store is required.");
  }

  const category = cleanText(body.category, 30).toLowerCase();

  if (!CATEGORIES.includes(category)) {
    throw new Error("A valid category is required.");
  }

  const price = validatePrice(body.price, "Price");
  const regularPriceText = cleanText(body.regular_price, 20);
  const regularPrice = regularPriceText ? parseMoney(regularPriceText) : null;

  if (regularPriceText && regularPrice === null) {
    throw new Error("Regular price must be a number or blank.");
  }

  if (regularPrice !== null && (regularPrice < 0.01 || regularPrice > 999)) {
    throw new Error("Regular price must be between $0.01 and $999.");
  }

  const quantity = parsePositiveNumber(body.quantity);

  if (quantity === null || quantity <= 0 || quantity > 100000) {
    throw new Error("Quantity must be greater than zero.");
  }

  const unit = normalizeUnit(body.unit);

  if (!SUPPORTED_UNITS.includes(unit)) {
    throw new Error("A valid unit is required.");
  }

  const proofType = cleanText(body.proof_type, 40);

  if (!PROOF_TYPES.includes(proofType)) {
    throw new Error("A valid proof type is required.");
  }

  const salePrice = parseBoolean(body.sale_price);
  const productId = Number.parseInt(body.product_id, 10);

  return {
    product_id: Number.isInteger(productId) && productId > 0 ? productId : null,
    item_name: itemName,
    brand: cleanText(body.brand, 80),
    store_id: storeId,
    category,
    price,
    regular_price: regularPrice,
    sale_price: salePrice ? 1 : 0,
    size_text: cleanText(body.size_text, 80),
    quantity,
    unit,
    proof_type: proofType,
    notes: cleanText(body.notes, 500),
    expires_at: calculateExpiration(category, salePrice, body.expires_at)
  };
}

function validateStoreRequest(body) {
  const storeName = cleanText(body.store_name, 120);
  const city = cleanText(body.city || "Janesville", 80);

  if (!storeName) {
    throw new Error("Store name is required.");
  }

  if (!city) {
    throw new Error("City is required.");
  }

  return {
    store_name: storeName,
    address: cleanText(body.address, 160),
    city,
    notes: cleanText(body.notes, 500)
  };
}

function validateSuggestion(body) {
  const suggestionType = cleanText(body.suggestion_type, 40);
  const title = cleanText(body.title, 120);
  const message = cleanText(body.message, 1000);

  if (!SUGGESTION_TYPES.includes(suggestionType)) {
    throw new Error("A valid suggestion type is required.");
  }

  if (!title) {
    throw new Error("Suggestion title is required.");
  }

  if (!message) {
    throw new Error("Suggestion message is required.");
  }

  return {
    suggestion_type: suggestionType,
    title,
    message,
    related_store: cleanText(body.related_store, 120),
    related_item: cleanText(body.related_item, 120)
  };
}

function validateCartItem(body) {
  const itemName = cleanText(body.item_name, 120);

  if (!itemName) {
    throw new Error("Cart item name is required.");
  }

  const category = cleanText(body.category, 30).toLowerCase();
  const brandMode = cleanText(body.brand_mode || "any", 20).toLowerCase();

  if (category && !CATEGORIES.includes(category)) {
    throw new Error("Cart category is not valid.");
  }

  if (!CART_BRAND_MODES.includes(brandMode)) {
    throw new Error("Cart brand choice is not valid.");
  }

  const mustHave = parseBoolean(body.must_have);
  const optionalItem = parseBoolean(body.optional_item);

  return {
    product_id: parseOptionalId(body.product_id),
    item_name: itemName,
    preferred_brand: cleanText(body.preferred_brand, 80),
    brand_mode: brandMode,
    avoid_ingredients: cleanText(body.avoid_ingredients, 500),
    quantity_needed: cleanText(body.quantity_needed, 80),
    size_preference: cleanText(body.size_preference, 80),
    must_have: mustHave ? 1 : 0,
    optional_item: optionalItem && !mustHave ? 1 : 0,
    category,
    notes: cleanText(body.notes, 500)
  };
}

function validateAnalyticsEvent(body) {
  const eventType = cleanText(body.event_type, 60);

  if (!ANALYTICS_EVENTS.includes(eventType)) {
    throw new Error("Analytics event type is not valid.");
  }

  return {
    event_type: eventType,
    product_id: parseOptionalId(body.product_id),
    report_id: parseOptionalId(body.report_id),
    store_id: parseOptionalId(body.store_id),
    sponsor_id: parseOptionalId(body.sponsor_id),
    cart_item_name: cleanText(body.cart_item_name || body.item_name, 120),
    category: cleanText(body.category, 30).toLowerCase(),
    metadata: sanitizeMetadata(body.metadata || body.metadata_json)
  };
}

function sanitizeMetadata(value) {
  let metadata = {};

  if (typeof value === "string" && value.trim()) {
    try {
      metadata = JSON.parse(value);
    } catch (error) {
      metadata = { note: cleanText(value, 300) };
    }
  } else if (value && typeof value === "object" && !Array.isArray(value)) {
    metadata = value;
  }

  const safe = {};

  for (const [key, raw] of Object.entries(metadata).slice(0, 20)) {
    const cleanKey = cleanText(key, 60).replace(/[^a-zA-Z0-9_-]/g, "_");

    if (!cleanKey || /password|secret|token|cookie|email/i.test(cleanKey)) {
      continue;
    }

    if (Array.isArray(raw)) {
      safe[cleanKey] = raw.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 20);
    } else if (typeof raw === "number" || typeof raw === "boolean") {
      safe[cleanKey] = raw;
    } else {
      const text = cleanText(raw, 300);

      if (!/@/.test(text) && !/password|secret|token|cookie/i.test(text)) {
        safe[cleanKey] = text;
      }
    }
  }

  return safe;
}

function parseOptionalId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeAliasList(value) {
  if (Array.isArray(value)) {
    return value
      .map((alias) => normalizeProductName(alias))
      .filter(Boolean)
      .slice(0, 30);
  }

  return String(value || "")
    .split(/[\n,]/)
    .map((alias) => normalizeProductName(alias))
    .filter(Boolean)
    .slice(0, 30);
}

function validateProduct(body, options = {}) {
  const displayName = cleanText(body.display_name || body.canonical_name, 160);
  const canonicalName = normalizeProductName(body.canonical_name || displayName);
  const category = cleanText(body.category, 30).toLowerCase();
  const status = cleanText(body.status || "needs_review", 30).toLowerCase();
  const defaultQuantityText = cleanText(body.default_quantity, 30);
  const defaultQuantity = defaultQuantityText ? parsePositiveNumber(defaultQuantityText) : null;
  const defaultUnit = cleanText(body.default_unit, 30) ? normalizeUnit(body.default_unit) : "";

  if (!canonicalName || !displayName) {
    throw new Error("Product name is required.");
  }

  if (!CATEGORIES.includes(category)) {
    throw new Error("A valid product category is required.");
  }

  if (!PRODUCT_STATUSES.includes(status)) {
    throw new Error("A valid product status is required.");
  }

  if (defaultQuantityText && (defaultQuantity === null || defaultQuantity <= 0)) {
    throw new Error("Default quantity must be a number greater than zero or blank.");
  }

  if (defaultUnit && !SUPPORTED_UNITS.includes(defaultUnit)) {
    throw new Error("A valid default unit is required.");
  }

  return {
    canonical_name: canonicalName,
    display_name: displayName,
    category,
    default_size_text: cleanText(body.default_size_text, 80),
    default_quantity: defaultQuantity,
    default_unit: defaultUnit,
    brand_optional: Object.prototype.hasOwnProperty.call(body, "brand_optional")
      ? parseBoolean(body.brand_optional) ? 1 : 0
      : 1,
    preferred_brand: cleanText(body.preferred_brand, 80),
    common_aliases: normalizeAliasList(body.common_aliases).join(", "),
    ingredient_info_url: cleanText(body.ingredient_info_url, 300),
    allergen_note: cleanText(body.allergen_note, 500),
    admin_safety_note: cleanText(body.admin_safety_note, 500),
    status: options.defaultActive && !body.status ? "active" : status,
    admin_note: cleanText(body.admin_note, 500)
  };
}

function validateProductStatus(value) {
  const status = cleanText(value, 30).toLowerCase();

  if (!PRODUCT_STATUSES.includes(status)) {
    throw new Error("A valid product status is required.");
  }

  return status;
}

function validateSponsor(body) {
  const sponsorName = cleanText(body.sponsor_name, 120);
  const sponsorType = cleanText(body.sponsor_type || "business", 40).toLowerCase();
  const title = cleanText(body.title, 140);
  const message = cleanText(body.message, 500);
  const status = cleanText(body.status || "draft", 30).toLowerCase();

  if (!sponsorName) {
    throw new Error("Sponsor name is required.");
  }

  if (!SPONSOR_TYPES.includes(sponsorType)) {
    throw new Error("Sponsor type is not valid.");
  }

  if (!title) {
    throw new Error("Sponsor title is required.");
  }

  if (!message) {
    throw new Error("Sponsor message is required.");
  }

  if (!SPONSOR_STATUSES.includes(status)) {
    throw new Error("Sponsor status is not valid.");
  }

  return {
    sponsor_name: sponsorName,
    sponsor_type: sponsorType,
    title,
    message,
    link_url: cleanText(body.link_url, 300),
    image_url: cleanText(body.image_url, 300),
    starts_at: cleanText(body.starts_at, 40),
    ends_at: cleanText(body.ends_at, 40),
    status,
    weekly_price_note: cleanText(body.weekly_price_note, 300),
    admin_note: cleanText(body.admin_note, 500)
  };
}

function validateSponsorStatus(value) {
  const status = cleanText(value, 30).toLowerCase();

  if (!SPONSOR_STATUSES.includes(status)) {
    throw new Error("Sponsor status is not valid.");
  }

  return status;
}

function normalizeAvoidIngredients(value) {
  return String(value || "")
    .split(",")
    .map((ingredient) => cleanText(ingredient, 60).toLowerCase())
    .filter(Boolean)
    .slice(0, 30);
}

function validateAvoidIngredients(value) {
  return normalizeAvoidIngredients(value).join(", ");
}

function validateAdminStore(body) {
  const name = cleanText(body.name || body.store_name, 120);

  if (!name) {
    throw new Error("Store name is required.");
  }

  return {
    name,
    address: cleanText(body.address, 160),
    city: cleanText(body.city || "Janesville", 80),
    state: cleanText(body.state || "WI", 20),
    store_type: cleanText(body.store_type || "grocery", 80),
    active: Object.prototype.hasOwnProperty.call(body, "active")
      ? parseBoolean(body.active) ? 1 : 0
      : 1
  };
}

function validateStoreRequestStatus(value) {
  const status = cleanText(value, 20).toLowerCase();

  if (!STORE_REQUEST_STATUSES.includes(status)) {
    throw new Error("Store request status is not valid.");
  }

  return status;
}

function validateSuggestionStatus(value) {
  const status = cleanText(value, 20).toLowerCase();

  if (!SUGGESTION_STATUSES.includes(status)) {
    throw new Error("Suggestion status is not valid.");
  }

  return status;
}

function validateVerification(body) {
  const verificationType = cleanText(body.verification_type, 40);

  if (!VERIFICATION_TYPES.includes(verificationType)) {
    throw new Error("A valid verification option is required.");
  }

  return {
    verification_type: verificationType,
    note: cleanText(body.note, 300)
  };
}

function validateAdminStatus(value) {
  const status = cleanText(value, 20).toLowerCase();

  if (!ADMIN_STATUSES.includes(status)) {
    throw new Error("Admin status is not valid.");
  }

  return status;
}

function validateRejectionDetails(body) {
  const reason = cleanText(body.rejection_reason || body.admin_rejection_reason, 120);
  const note = cleanText(body.rejection_note || body.admin_rejection_note, 500);

  if (!reason) {
    throw new Error("Rejection reason is required.");
  }

  if (!REJECTION_REASONS.includes(reason)) {
    throw new Error("Rejection reason is not valid.");
  }

  if (reason === "Other" && !note) {
    throw new Error("A note is required when rejection reason is Other.");
  }

  return { reason, note };
}

function validateAccountStatus(value) {
  const status = cleanText(value, 20).toLowerCase();

  if (!ACCOUNT_STATUSES.includes(status)) {
    throw new Error("Account status is not valid.");
  }

  return status;
}

function validateBanDetails(body) {
  const reason = cleanText(body.ban_reason, 120);
  const note = cleanText(body.ban_note, 500);

  if (!reason) {
    throw new Error("Ban reason is required.");
  }

  if (!BAN_REASONS.includes(reason)) {
    throw new Error("Ban reason is not valid.");
  }

  if (reason === "Other" && !note) {
    throw new Error("A note is required when ban reason is Other.");
  }

  return { reason, note };
}

module.exports = {
  CATEGORIES,
  PROOF_TYPES,
  VERIFICATION_TYPES,
  ADMIN_STATUSES,
  REJECTION_REASONS,
  ACCOUNT_STATUSES,
  BAN_REASONS,
  STORE_REQUEST_STATUSES,
  SUGGESTION_TYPES,
  SUGGESTION_STATUSES,
  PRODUCT_STATUSES,
  CART_BRAND_MODES,
  SPONSOR_TYPES,
  SPONSOR_STATUSES,
  ANALYTICS_EVENTS,
  COMMON_AVOID_INGREDIENTS,
  blockedWords,
  usernameSafetyKey,
  usernameSafetyReason,
  cleanText,
  normalizeProductName,
  validateUsername,
  validateEmail,
  validatePassword,
  validateRegistration,
  validateLogin,
  validateReport,
  validateStoreRequest,
  validateSuggestion,
  validateCartItem,
  validateAnalyticsEvent,
  validateAvoidIngredients,
  validateProduct,
  validateProductStatus,
  validateSponsor,
  validateSponsorStatus,
  validateAdminStore,
  validateStoreRequestStatus,
  validateSuggestionStatus,
  validateVerification,
  validateAdminStatus,
  validateRejectionDetails,
  validateAccountStatus,
  validateBanDetails
};
