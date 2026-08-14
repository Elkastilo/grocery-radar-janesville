require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const childProcess = require("child_process");
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const multer = require("multer");
let tesseract = null;
let sharp = null;

try {
  tesseract = require("tesseract.js");
} catch (error) {
  tesseract = null;
}

try {
  sharp = require("sharp");
} catch (error) {
  sharp = null;
}

const {
  db,
  DATA_DIR,
  DB_PATH,
  DATA_DIR_EXISTED_AT_START,
  DB_FILE_EXISTED_AT_START,
  run,
  get,
  all,
  initDb,
  addPointEvent,
  updateUserAccuracy,
  refreshExpiredReports
} = require("./src/db");
const {
  emailStatus,
  getLastEmailDiagnostic,
  runEmailDiagnostic,
  sendTestEmail,
  sendVerificationEmail,
  sendAdminRegistrationEmail,
  sendAdminReportReviewEmail,
  sendReportRejectionEmail,
  sendAccountBanEmail
} = require("./src/email");
const { calculateUnitPrice, formatUnitPrice } = require("./src/unitPrice");
const {
  priceValue: arenaPriceValue,
  isConditionalOffer,
  productComparison,
  storeLeaderboard,
  categoryLeaderboards,
  optimizeBasket,
  dietaryConflicts,
  sizeCompatible
} = require("./src/priceArena");
const {
  POINTS,
  REWARD_RULES,
  TRUST_LEVELS,
  getSubmissionPoints,
  getRank,
  trustLevelFromStats
} = require("./src/scoring");
const {
  CATEGORIES,
  PROOF_TYPES,
  SUGGESTION_TYPES,
  PRODUCT_STATUSES,
  SPONSOR_TYPES,
  SPONSOR_STATUSES,
  COMMON_AVOID_INGREDIENTS,
  REJECTION_REASONS,
  BAN_REASONS,
  cleanText,
  normalizeProductName,
  validateUsername,
  usernameSafetyReason,
  validateEmail,
  validateRegistration,
  validateLogin,
  validatePassword,
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
} = require("./src/validation");
const {
  compactSearchText: compactIntakeSearchText,
  parsePriceText
} = require("./src/priceIntake");
const { analyzeProof, proofFingerprint, runtimeConfig: aiRuntimeConfig } = require("./src/aiProofEngine");
const { APP_VERSION } = require("./src/version");
const { closestStoreForAi, localProductNormalization, normalizedRetailerName, usefulDetectedStoreName } = require("./src/catalogIntelligence");
const {
  PRICE_TYPES,
  PUBLIC_REJECTION_REASONS,
  normalizePriceType,
  isPromotion,
  promotionEligibility,
  promotionGate
} = require("./src/promotion");

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PIN = process.env.ADMIN_PIN || (process.env.NODE_ENV === "production" ? "" : "1234");
const APP_DOMAIN = "thegroceryradar.com";
const PUBLIC_APP_URL = String(
  process.env.PUBLIC_APP_URL ||
  process.env.APP_BASE_URL ||
  (process.env.NODE_ENV === "production" ? `https://${APP_DOMAIN}` : "http://localhost:3000")
).replace(/\/+$/, "");
const BOOTSTRAP_SUPER_ADMIN_EMAIL = "juricbu@gmail.com";
const BOOTSTRAP_SUPER_ADMIN_USERNAME = "elcastilo";
const OWNER_EMAIL = BOOTSTRAP_SUPER_ADMIN_EMAIL;
const OWNER_USERNAME = BOOTSTRAP_SUPER_ADMIN_USERNAME;
const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;
const VERIFICATION_RESEND_COOLDOWN_SECONDS = Math.max(
  60,
  Number.parseInt(process.env.VERIFICATION_RESEND_COOLDOWN_SECONDS || "300", 10) || 300
);
const SESSION_SECRET = process.env.SESSION_SECRET || "change_this_secret";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;
const PUBLIC_REGISTRATION_ENABLED = process.env.NODE_ENV === "test" || ["1", "true", "yes", "on"].includes(String(process.env.PUBLIC_REGISTRATION_ENABLED || "").toLowerCase());
const PUBLIC_DIR = path.join(__dirname, "public");
const CLIENT_DIST_DIR = process.env.CLIENT_DIST_DIR
  ? path.resolve(process.env.CLIENT_DIST_DIR)
  : path.join(__dirname, "public-tailwind-dist");
const UPLOAD_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, "uploads");
const OCR_TEMP_DIR = path.join(UPLOAD_DIR, ".ocr");
const ALLOWED_IMAGE_UPLOADS = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const FEEDBACK_CATEGORIES = [
  "bug",
  "feature_request",
  "wrong_price",
  "wrong_product",
  "store_issue",
  "question",
  "other"
];
const FEEDBACK_STATUSES = ["open", "in_review", "needs_info", "closed", "merged"];
const FEEDBACK_PRIORITIES = ["low", "normal", "high", "urgent"];
const FEATURE_VOTE_STATUSES = ["active", "trending", "completed", "rejected"];
const ANNOUNCEMENT_TYPES = ["maintenance", "known_issue", "new_feature", "downtime", "homepage_banner"];
const ANNOUNCEMENT_STATUSES = ["draft", "published", "archived"];
const HOMEPAGE_SERVICE_STATUSES = ["online", "maintenance", "degraded", "updating"];
const HOMEPAGE_MAINTENANCE_STATUSES = ["scheduled", "in_progress", "monitoring", "complete"];
const HOMEPAGE_CONTENT_STATUSES = ["draft", "published", "archived"];
const HOMEPAGE_ISSUE_STATUSES = ["investigating", "identified", "fix_in_progress", "monitoring", "resolved"];
const HOMEPAGE_ISSUE_VISIBILITY_STATUSES = ["draft", "published", "hidden"];
const STAFF_ROLES = ["owner", "manager", "reviewer", "data_entry", "user"];
const ACTIVE_USAGE_WINDOW_MINUTES = Math.max(2, Number.parseInt(process.env.ACTIVE_USAGE_WINDOW_MINUTES || "10", 10) || 10);
const REVIEW_CLAIM_MINUTES = Math.max(10, Number.parseInt(process.env.REVIEW_CLAIM_MINUTES || "30", 10) || 30);
const APP_TIME_ZONE = "America/Chicago";
const PRICE_FRESHNESS_DAYS = Object.freeze({ receipt_photo: { current: 14, aging: 30 }, shelf_tag_photo: { current: 10, aging: 21 }, weekly_ad: { current: 7, aging: 14 }, no_photo: { current: 7, aging: 14 } });
const PRICE_REPORT_REASONS = new Set(["price changed", "wrong store", "wrong item", "sale ended", "promotion conditions missing", "other"]);
const PRICE_ISSUE_DISMISS_REASONS = new Set(["price still correct", "duplicate report", "insufficient evidence", "spam/abuse", "other"]);
const DEAL_HISTORY_MIN_OBSERVATIONS = 4;
const DEAL_HISTORY_WINDOW_DAYS = 84;
const STORAGE_CONDITIONS = ["shelf stable", "refrigerated", "frozen", "fresh produce", "hot prepared food", "cold prepared food", "not applicable", "unknown"];
const OPERATIONS_WIDGET_IDS = [
  "system_health",
  "live_activity",
  "user_management",
  "feedback",
  "feature_voting",
  "search_analytics",
  "price_analytics",
  "store_health",
  "event_feed",
  "error_center",
  "announcements",
  "homepage_service",
  "community_pulse",
  "security"
];

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OCR_TEMP_DIR, { recursive: true });

function sanitizeOriginalFilename(value) {
  return path
    .basename(String(value || "proof"))
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function uploadExtensionFor(file) {
  const originalExtension = path.extname(file.originalname || "").toLowerCase();
  const expectedMime = ALLOWED_IMAGE_UPLOADS[originalExtension];

  if (!expectedMime || expectedMime !== file.mimetype) {
    return null;
  }

  return originalExtension === ".jpeg" ? ".jpg" : originalExtension;
}

const storage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, UPLOAD_DIR);
  },
  filename(request, file, callback) {
    const extension = uploadExtensionFor(file);

    if (!extension) {
      callback(new Error("Only JPG, JPEG, PNG, or WebP images can be uploaded."));
      return;
    }

    callback(null, `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${extension}`);
  }
});

function imageFileFilter(request, file, callback) {
  const extension = uploadExtensionFor(file);

  if (!extension) {
    callback(new Error("Only JPG, JPEG, PNG, or WebP images can be uploaded."));
    return;
  }

  callback(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1
  },
  fileFilter: imageFileFilter
});

const priceImportUpload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 50
  },
  fileFilter: imageFileFilter
});

async function validateDecodedImage(file) {
  if (!file?.path || !fs.existsSync(file.path)) throw new Error("Uploaded image was not saved.");
  if (sharp) {
    const metadata = await sharp(file.path, { limitInputPixels: 40000000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error("Image could not be decoded.");
    return { width: metadata.width, height: metadata.height };
  }
  const header = await fs.promises.readFile(file.path).then((buffer) => buffer.subarray(0, 16));
  const valid = header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || header.toString("ascii", 0, 4) === "RIFF";
  if (!valid) throw new Error("Image could not be decoded.");
  return {};
}

const catalogDataUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter(request, file, callback) {
    const extension = path.extname(String(file.originalname || "")).toLowerCase();
    if (extension === ".csv" || file.mimetype === "text/csv" || file.mimetype === "application/json") callback(null, true);
    else callback(new Error("Catalog data must be CSV or JSON."));
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function tailwindIndexPath() {
  return path.join(CLIENT_DIST_DIR, "index.html");
}

function hasTailwindBuild() {
  return fs.existsSync(tailwindIndexPath());
}

function sendPublicApp(response) {
  if (hasTailwindBuild()) {
    response.sendFile(tailwindIndexPath());
    return;
  }

  if (process.env.NODE_ENV === "production") {
    response.status(503).send("Public app build is missing. Run npm run build:client before deployment.");
    return;
  }

  response.sendFile(path.join(PUBLIC_DIR, "index.html"));
}

function sessionExpiresAt(sessionData) {
  const cookieExpires = sessionData?.cookie?.expires
    ? new Date(sessionData.cookie.expires).getTime()
    : 0;

  if (Number.isFinite(cookieExpires) && cookieExpires > Date.now()) {
    return cookieExpires;
  }

  const originalMaxAge = Number(sessionData?.cookie?.originalMaxAge);
  return Date.now() + (Number.isFinite(originalMaxAge) && originalMaxAge > 0 ? originalMaxAge : SESSION_MAX_AGE_MS);
}

class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    this.ready = this.prepare();
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch((error) => {
        console.warn("Session cleanup failed:", error.message);
      });
    }, 1000 * 60 * 60);
    if (typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  async prepare() {
    await run(
      `CREATE TABLE IF NOT EXISTS app_sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      )`
    );
    await run("CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions(expires_at)");
    await this.cleanupExpired();
  }

  async cleanupExpired() {
    await run("DELETE FROM app_sessions WHERE expires_at <= ?", [Date.now()]);
  }

  get(sid, callback) {
    this.ready
      .then(async () => {
        const row = await get("SELECT sess, expires_at FROM app_sessions WHERE sid = ?", [sid]);
        if (!row) {
          callback(null, null);
          return;
        }

        if (Number(row.expires_at) <= Date.now()) {
          await run("DELETE FROM app_sessions WHERE sid = ?", [sid]);
          callback(null, null);
          return;
        }

        try {
          callback(null, JSON.parse(row.sess));
        } catch (error) {
          await run("DELETE FROM app_sessions WHERE sid = ?", [sid]);
          callback(null, null);
        }
      })
      .catch((error) => callback(error));
  }

  set(sid, sessionData, callback = () => {}) {
    this.ready
      .then(async () => {
        await run(
          `INSERT INTO app_sessions (sid, sess, expires_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET
             sess = excluded.sess,
             expires_at = excluded.expires_at,
             updated_at = excluded.updated_at`,
          [sid, JSON.stringify(sessionData), sessionExpiresAt(sessionData), new Date().toISOString()]
        );
        callback(null);
      })
      .catch((error) => callback(error));
  }

  touch(sid, sessionData, callback = () => {}) {
    this.ready
      .then(async () => {
        await run(
          "UPDATE app_sessions SET expires_at = ?, updated_at = ? WHERE sid = ?",
          [sessionExpiresAt(sessionData), new Date().toISOString(), sid]
        );
        callback(null);
      })
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    this.ready
      .then(async () => {
        await run("DELETE FROM app_sessions WHERE sid = ?", [sid]);
        callback(null);
      })
      .catch((error) => callback(error));
  }
}

app.use(
  session({
    name: "grocery_radar_sid",
    store: new SQLiteSessionStore(),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_MS
    }
  })
);

function baseConfidence(proofType) {
  if (proofType === "receipt_photo") {
    return "medium-high";
  }

  if (proofType === "shelf_tag_photo" || proofType === "weekly_ad") {
    return "medium";
  }

  return "low";
}

function calculateConfidence(proofType, verificationCount, disputeCount) {
  if (disputeCount >= 2) {
    return "disputed";
  }

  if (verificationCount >= 2 && disputeCount === 0) {
    return "high";
  }

  if (verificationCount >= 2 && disputeCount === 1) {
    return "medium-high";
  }

  if (disputeCount === 1) {
    return baseConfidence(proofType) === "medium-high" ? "medium" : "low";
  }

  return baseConfidence(proofType);
}

function formatReport(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    item_name: row.item_name,
    brand: row.brand || "",
    store_id: row.store_id,
    store_name: row.store_name,
    store_address: row.store_address,
    product_id: row.product_id || null,
    product_display_name: row.product_display_name || "",
    product_status: row.product_status || "",
    product_default_size_text: row.product_default_size_text || "",
    username: row.username,
    category: row.category,
    price: Number(row.price),
    price_label: row.display_offer_text || `$${Number(row.price).toFixed(2)}`,
    regular_price: row.regular_price === null ? null : Number(row.regular_price),
    sale_price: Boolean(row.sale_price),
    size_text: row.size_text || "",
    quantity: Number(row.quantity),
    unit: row.unit,
    unit_price: Number(row.unit_price),
    unit_price_label: formatUnitPrice(row.unit_price, row.unit),
    price_basis: row.price_basis || priceBasisForUnit(row.comparison_unit || row.unit),
    comparison_price: row.comparison_price === null || row.comparison_price === undefined ? Number(row.unit_price || row.price) : Number(row.comparison_price),
    comparison_unit: normalizePriceUnit(row.comparison_unit || row.unit),
    primary_price_label: row.display_offer_text || primaryPriceLabel(row.comparison_price ?? row.unit_price ?? row.price, row.comparison_unit || row.unit, row.size_text),
    estimated_item_price: row.estimated_item_price === null || row.estimated_item_price === undefined ? null : Number(row.estimated_item_price),
    estimated_item_price_label: row.estimated_item_price === null || row.estimated_item_price === undefined ? "" : `${primaryPriceLabel(row.estimated_item_price, "each")} estimated`,
    approximate_item_weight: row.approximate_item_weight === null || row.approximate_item_weight === undefined ? null : Number(row.approximate_item_weight),
    approximate_item_weight_unit: normalizePriceUnit(row.approximate_item_weight_unit || ""),
    approximate_item_weight_label: row.approximate_item_weight === null || row.approximate_item_weight === undefined ? "" : `About ${Number(row.approximate_item_weight)} ${normalizePriceUnit(row.approximate_item_weight_unit || "lb")} each`,
    package_price: row.package_price === null || row.package_price === undefined ? null : Number(row.package_price),
    multibuy_quantity: row.multibuy_quantity === null || row.multibuy_quantity === undefined ? null : Number(row.multibuy_quantity),
    multibuy_total_price: row.multibuy_total_price === null || row.multibuy_total_price === undefined ? null : Number(row.multibuy_total_price),
    proof_type: row.proof_type,
    photo_path: row.photo_path || "",
    photo_original_name: row.photo_original_name || "",
    photo_mime_type: row.photo_mime_type || "",
    photo_size_bytes: row.photo_size_bytes || 0,
    has_photo_upload: Boolean(row.photo_path),
    has_photo_proof: row.proof_type !== "no_photo",
    notes: row.notes || "",
    confidence: row.confidence,
    verification_count: row.verification_count,
    dispute_count: row.dispute_count,
    status: row.status,
    admin_rejection_reason: row.admin_rejection_reason || "",
    admin_rejection_note: row.admin_rejection_note || "",
    reviewed_at: row.reviewed_at || "",
    reviewed_by: row.reviewed_by || null,
    submitted_by_user_id: row.submitted_by_user_id || row.user_id,
    source_import_batch_id: row.source_import_batch_id || null,
    source_import_row_id: row.source_import_row_id || null,
    source_date: row.source_date || "",
    storage_condition: row.storage_condition || "unknown",
    price_type: normalizePriceType(row.price_type || (row.sale_price ? "sale" : "regular")),
    valid_from_date: row.valid_from_date || dateInputValue(row.valid_start_at),
    valid_through_date: row.valid_through_date || dateInputValue(row.valid_end_at || row.expires_at),
    valid_from_time: row.valid_from_time || "",
    valid_through_time: row.valid_through_time || "",
    promotion_conditions: row.promotion_conditions || "",
    promotion_schedule_text: row.promotion_schedule_text || "",
    display_offer_text: row.display_offer_text || "",
    location_verification_status: row.location_verification_status || "legacy_unknown",
    applicable_city: row.applicable_city || "",
    applicable_state: row.applicable_state || "",
    applicable_store_id: row.applicable_store_id || null,
    location_evidence_text: row.location_evidence_text || "",
    review_started_at: row.review_started_at || "",
    review_completed_at: row.review_completed_at || row.reviewed_at || "",
    freshness_status: freshnessForPrice(row),
    freshness_label: publicFreshnessLabel(row),
    age_days: priceAgeDays(row),
    edited_by: row.edited_by || null,
    edited_at: row.edited_at || "",
    admin_edit_note: row.admin_edit_note || "",
    last_edited_by: row.last_edited_by || null,
    last_edited_at: row.last_edited_at || "",
    edit_note: row.edit_note || "",
    official_product_url: row.official_product_url || "",
    source_url: row.source_url || "",
    source_title: row.source_title || "",
    source_domain: row.source_domain || "",
    source_checked_at: row.source_checked_at || "",
    ingredient_info_url: row.ingredient_info_url || "",
    allergen_note: row.allergen_note || "",
    admin_safety_note: row.admin_safety_note || "",
    submitted_at: row.submitted_at,
    expires_at: row.expires_at
  };
}

function formatPublicReport(row) {
  const report = formatReport(row);
  const isReceiptProof = report.proof_type === "receipt_photo";
  // Anonymous proof approvals are internally owned by the reviewer for legacy
  // price-report compatibility. Never mistake that owner for the submitter.
  const submitterUsername = report.submitted_by_user_id ? (report.username || "Community member") : "Community member";

  delete report.user_id;
  delete report.username;
  delete report.photo_path;
  delete report.photo_original_name;
  delete report.photo_mime_type;
  delete report.photo_size_bytes;
  delete report.notes;
  delete report.admin_rejection_reason;
  delete report.admin_rejection_note;
  delete report.reviewed_by;
  delete report.submitted_by_user_id;
  delete report.source_import_batch_id;
  delete report.source_import_row_id;
  delete report.review_started_at;
  delete report.edited_by;
  delete report.admin_edit_note;
  delete report.edited_at;
  delete report.last_edited_by;
  delete report.last_edited_at;
  delete report.edit_note;
  delete report.official_product_url;
  delete report.ingredient_info_url;
  delete report.allergen_note;
  delete report.admin_safety_note;
  const locationVerified = ["verified_exact_store", "verified_market", "not_required"].includes(report.location_verification_status);
  delete report.location_verification_status;
  delete report.applicable_city;
  delete report.applicable_state;
  delete report.applicable_store_id;
  delete report.location_evidence_text;
  delete report.product_status;
  delete report.dispute_count;

  report.has_photo_upload = false;

  return {
    ...report,
    has_private_receipt_proof: isReceiptProof && Boolean(row.photo_path),
    public_proof_label: isReceiptProof ? "Receipt-backed price" : report.proof_type === "shelf_tag_photo" ? "Shelf-tag-backed price" : report.proof_type === "weekly_ad" ? "Weekly-ad-backed price" : "Source-backed price",
    submitted_by_username: submitterUsername,
    purchased_at: isReceiptProof ? report.source_date : "",
    verified_at: report.review_completed_at || report.reviewed_at,
    trust_label: report.status === "approved" ? "Verified by Grocery Radar" : "",
    location_verified: locationVerified,
    trust_explanation: "A human reviewer checked the submitted proof. Personal receipt details and reviewer identity remain private."
  };
}

async function getActiveStoreIds() {
  const stores = await all("SELECT id FROM stores WHERE active = 1");
  return stores.map((store) => store.id);
}

async function getAllStoreIds() {
  const stores = await all("SELECT id FROM stores");
  return stores.map((store) => store.id);
}

function formatStore(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address || "",
    city: row.city || "Janesville",
    state: row.state || "WI",
    store_type: row.store_type || "grocery",
    active: Boolean(row.active),
    report_count: row.report_count || 0,
    created_at: row.created_at || ""
  };
}

function formatStoreRequest(row) {
  return {
    id: row.id,
    requested_by_user_id: row.requested_by_user_id,
    username: row.username || "",
    user_email: row.user_email || "",
    store_name: row.store_name,
    address: row.address || "",
    city: row.city || "Janesville",
    notes: row.notes || "",
    status: row.status,
    admin_note: row.admin_note || "",
    reviewed_by: row.reviewed_by || null,
    reviewed_by_username: row.reviewed_by_username || "",
    reviewed_at: row.reviewed_at || "",
    created_at: row.created_at
  };
}

function formatSuggestion(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    username: row.username || "",
    user_email: row.user_email || "",
    suggestion_type: row.suggestion_type,
    title: row.title,
    message: row.message,
    related_store: row.related_store || "",
    related_item: row.related_item || "",
    photo_path: row.photo_path || "",
    photo_original_name: row.photo_original_name || "",
    photo_mime_type: row.photo_mime_type || "",
    photo_size_bytes: row.photo_size_bytes || 0,
    status: row.status,
    admin_note: row.admin_note || "",
    reviewed_by: row.reviewed_by || null,
    reviewed_by_username: row.reviewed_by_username || "",
    reviewed_at: row.reviewed_at || "",
    created_at: row.created_at
  };
}

const PRICE_IMPORT_ROW_STATUSES = [
  "import_draft",
  "ready_for_review",
  "approved",
  "rejected",
  "needs_edit",
  "removed"
];

const PRICE_IMPORT_SOURCE_TYPES = [
  "receipt",
  "weekly_ad",
  "shelf_tag",
  "store_deal",
  "website",
  "paste_text",
  "other"
];

const REVIEW_ROW_REJECTION_REASONS = [...PUBLIC_REJECTION_REASONS];
const REVIEW_PROOF_REJECTION_REASONS = [...PUBLIC_REJECTION_REASONS];

function normalizeReviewRejectionReason(value) {
  const reason = cleanText(value, 80).toLowerCase();
  const legacy = {
    "wrong item": "wrong product",
    "wrong price": "price does not match item",
    "wrong size / quantity": "multi-buy conditions unclear",
    duplicate: "duplicate price evidence",
    "unreadable proof": "proof too blurry",
    "promotional terms incomplete": "promotion conditions unclear",
    "not enough evidence": "price not actually shown",
    "proof unreadable": "proof too blurry",
    "wrong store/source": "wrong store",
    "duplicate proof": "duplicate submission",
    "not enough price information": "price not actually shown",
    "invalid proof": "unsupported estimate",
    "out of date": "outdated evidence",
    "private/sensitive information": "screenshot incomplete"
  };
  return legacy[reason] || reason;
}

const PROOF_SUBMISSION_NOTE_PREFIX = "Proof submission details";
const PROOF_SUBMISSION_STATUSES = [
  "needs_admin_review",
  "waiting_for_review",
  "accepted_for_review",
  "proof_reviewed",
  "proof_rejected",
  "needs_clearer_photo",
  "needs_source_link",
  "rejected",
  "duplicate",
  "used_for_prices",
  "reviewed_no_prices"
];
const PUBLIC_PROOF_SUBMISSION_TYPES = {
  receipt: {
    label: "Receipt",
    source_type: "receipt",
    proof_type: "receipt_photo"
  },
  shelf_tag: {
    label: "Shelf tag",
    source_type: "shelf_tag",
    proof_type: "shelf_tag_photo"
  },
  weekly_ad: {
    label: "Weekly ad",
    source_type: "weekly_ad",
    proof_type: "weekly_ad"
  },
  store_page: {
    label: "Store page / source link",
    source_type: "store_deal",
    proof_type: "weekly_ad"
  }
};

function cleanProofSubmissionType(value) {
  const proofType = cleanText(value, 40).toLowerCase();

  if (!Object.prototype.hasOwnProperty.call(PUBLIC_PROOF_SUBMISSION_TYPES, proofType)) {
    throw new Error("Choose receipt, shelf tag, weekly ad, or store page proof.");
  }

  return proofType;
}

function composeProofSubmissionNotes(details = {}) {
  const lines = [
    PROOF_SUBMISSION_NOTE_PREFIX,
    `Store ID: ${details.store_id || ""}`,
    `Store: ${details.store_name || ""}`,
    `Proof type: ${details.public_proof_type || ""}`,
    `Item hint: ${details.item_hint || ""}`,
    `Price hint: ${details.price_hint || ""}`,
    `User notes: ${details.notes || ""}`
  ];

  return cleanText(lines.join(" | "), 500);
}

function parseProofSubmissionNotes(notes) {
  const text = String(notes || "");
  const details = {
    is_proof_submission: text.startsWith(PROOF_SUBMISSION_NOTE_PREFIX),
    store_id: "",
    store_name: "",
    public_proof_type: "",
    item_hint: "",
    price_hint: "",
    user_notes: "",
    review_note: ""
  };

  for (const line of text.split(/\s+\|\s+|\r?\n/)) {
    const match = line.match(/^([^:]+):\s*(.*)$/);

    if (!match) {
      continue;
    }

    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();

    if (key === "store id") {
      details.store_id = value;
    } else if (key === "store") {
      details.store_name = value;
    } else if (key === "proof type") {
      details.public_proof_type = value;
    } else if (key === "item hint") {
      details.item_hint = value;
    } else if (key === "price hint") {
      details.price_hint = value;
    } else if (key === "user notes") {
      details.user_notes = value;
    } else if (key === "review note") {
      details.review_note = value;
    }
  }

  return details;
}

function proofNotesWithReviewNote(notes, reviewNote) {
  const cleanNote = cleanText(reviewNote, 300);
  const parts = String(notes || "")
    .split(/\s+\|\s+|\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^review note:/i.test(part));

  if (cleanNote) {
    parts.push(`Review note: ${cleanNote}`);
  }

  return cleanText(parts.join(" | "), 500);
}

function isProofSubmissionBatch(batch) {
  return PROOF_SUBMISSION_STATUSES.includes(batch.status) ||
    parseProofSubmissionNotes(batch.notes).is_proof_submission;
}

function parseImportBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1" || value === 1;
}

function parseImportNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeImportDate(value, endOfDay = false) {
  const text = cleanText(value, 20);

  if (!text) {
    return "";
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T${endOfDay ? "23:59:59" : "00:00:00"}`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Import date is not valid.");
  }

  return date.toISOString();
}

function dateInputValue(value) {
  const text = String(value || "");

  if (!text) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 10);
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function normalizeOptionalTimestamp(value) {
  const text = cleanText(value, 40);

  if (!text) {
    return "";
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Source checked date is not valid.");
  }

  return date.toISOString();
}

function normalizeSourceUrl(value) {
  const text = String(value || "").trim().slice(0, 1000);

  if (!text) {
    return "";
  }

  let url;

  try {
    url = new URL(text);
  } catch (error) {
    throw new Error("Source URL must be a valid http:// or https:// link.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Source URL must use http:// or https://.");
  }

  return url.href.slice(0, 1000);
}

function sourceDomainFromUrl(sourceUrl) {
  if (!sourceUrl) {
    return "";
  }

  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, "").slice(0, 120);
  } catch (error) {
    return "";
  }
}

function cleanSourceMetadata(body = {}, fallback = {}) {
  const sourceUrl = Object.prototype.hasOwnProperty.call(body, "source_url")
    ? normalizeSourceUrl(body.source_url)
    : fallback.source_url || "";
  const sourceTitle = Object.prototype.hasOwnProperty.call(body, "source_title")
    ? cleanText(body.source_title, 160)
    : fallback.source_title || "";
  const checkedInput = Object.prototype.hasOwnProperty.call(body, "source_checked_at")
    ? body.source_checked_at
    : fallback.source_checked_at || "";
  const sourceCheckedAt = checkedInput ? normalizeOptionalTimestamp(checkedInput) : "";
  const sourceDomain = sourceDomainFromUrl(sourceUrl);

  return {
    source_url: sourceUrl,
    source_title: sourceTitle,
    source_domain: sourceDomain,
    source_checked_at: sourceCheckedAt
  };
}

function cleanImportBatchDefaults(body = {}, fallback = {}) {
  const storeId = Number.parseInt(
    body.default_store_id || body.store_id || fallback.default_store_id,
    10
  );

  return {
    default_store_id: Number.isInteger(storeId) && storeId > 0 ? storeId : null,
    batch_title: cleanText(body.batch_title || fallback.batch_title, 160),
    observed_at: normalizeOptionalTimestamp(body.observed_at || body.observed_date || fallback.observed_at),
    valid_start_at: normalizeImportDate(body.valid_start_at || body.valid_start_date || fallback.valid_start_at, false),
    valid_end_at: normalizeImportDate(body.valid_end_at || body.valid_end_date || body.expires_at || fallback.valid_end_at, true),
    source_text: cleanReceiptSourceText(body.source_text || fallback.source_text || "", 12000),
    notes: cleanText(body.notes || fallback.notes, 500)
  };
}

function importBatchDefaultsForRow(batch = {}, overrides = {}) {
  return {
    store_id: overrides.store_id || batch.default_store_id || "",
    proof_type: overrides.proof_type || batch.proof_type || "weekly_ad",
    source_url: overrides.source_url || batch.source_url || "",
    source_title: overrides.source_title || batch.source_title || "",
    source_checked_at: overrides.source_checked_at || batch.source_checked_at || batch.observed_at || "",
    observed_at: overrides.observed_at || batch.observed_at || "",
    valid_start_at: overrides.valid_start_at || batch.valid_start_at || "",
    valid_end_at: overrides.valid_end_at || batch.valid_end_at || ""
  };
}

function validateImportProofType(value) {
  const proofType = cleanText(value || "weekly_ad", 40);

  if (!PROOF_TYPES.includes(proofType)) {
    throw new Error("Import proof type is not valid.");
  }

  return proofType;
}

function validateImportSourceType(value) {
  const sourceType = cleanText(value || "weekly_ad", 40).toLowerCase();

  if (!PRICE_IMPORT_SOURCE_TYPES.includes(sourceType)) {
    throw new Error("Import source type is not valid.");
  }

  return sourceType;
}

function validateImportRowStatus(value, fallback = "import_draft") {
  const aliases = {
    draft: "import_draft",
    needs_review: "ready_for_review",
    ready: "ready_for_review",
    remove: "removed"
  };
  const rawStatus = cleanText(value || fallback, 40).toLowerCase();
  const status = aliases[rawStatus] || rawStatus;

  if (!PRICE_IMPORT_ROW_STATUSES.includes(status)) {
    throw new Error("Import row status is not valid.");
  }

  return status;
}

function cleanImportRowDraft(body = {}) {
  const storeId = Number.parseInt(body.store_id, 10);
  const productId = Number.parseInt(body.product_id, 10);
  const price = parseImportNumber(body.price);
  const regularPrice = parseImportNumber(body.regular_price);
  const memberCardPrice = parseImportNumber(body.member_card_price);
  const quantity = parseImportNumber(body.quantity);
  const comparisonPrice = parseImportNumber(body.comparison_price ?? body.unit_price ?? body.price);
  const comparisonUnit = normalizePriceUnit(body.comparison_unit || body.unit || "each");
  const categoryAliases = { "dairy & eggs": "dairy", beverages: "drinks", "meat & seafood": "meat", "health / personal care": "health / personal care", "prepared food": "prepared food" };
  const categoryInput = cleanText(body.category || "other", 40).toLowerCase();
  const category = categoryAliases[categoryInput] || categoryInput;
  const source = cleanSourceMetadata(body);
  const extractionConfidence = cleanText(body.extraction_confidence || "low", 20).toLowerCase();

  return {
    product_id: Number.isInteger(productId) && productId > 0 ? productId : null,
    store_id: Number.isInteger(storeId) && storeId > 0 ? storeId : null,
    item_name: cleanText(body.item_name, 120),
    brand: cleanText(body.brand, 80),
    variant: cleanText(body.variant, 80),
    category: CATEGORIES.includes(category) ? category : "other",
    price,
    price_basis: cleanText(body.price_basis || priceBasisForUnit(comparisonUnit), 40),
    comparison_price: comparisonPrice,
    comparison_unit: comparisonUnit,
    estimated_item_price: parseImportNumber(body.estimated_item_price),
    approximate_item_weight: parseImportNumber(body.approximate_item_weight),
    approximate_item_weight_unit: normalizePriceUnit(body.approximate_item_weight_unit || ""),
    package_price: parseImportNumber(body.package_price),
    regular_price: regularPrice,
    sale_price: parseImportBoolean(body.sale_price) ? 1 : 0,
    member_card_price: memberCardPrice,
    coupon_required: parseImportBoolean(body.coupon_required) ? 1 : 0,
    deal_limit: cleanText(body.deal_limit || body.limit, 80),
    multibuy_details: cleanText(body.multibuy_details, 120),
    multibuy_quantity: parseImportNumber(body.multibuy_quantity),
    multibuy_total_price: parseImportNumber(body.multibuy_total_price),
    storage_condition: cleanEnum(cleanText(body.storage_condition || "unknown", 40).toLowerCase(), STORAGE_CONDITIONS, "unknown"),
    price_type: normalizePriceType(body.price_type || (body.sale_price ? "sale" : "regular")),
    promotion_text: cleanText(body.promotion_text, 240),
    display_offer_text: cleanText(body.display_offer_text || body.promotion_text, 240),
    promotion_conditions: cleanText(body.promotion_conditions, 500),
    promotion_schedule_text: cleanText(body.promotion_schedule_text, 240),
    valid_from_date: dateInputValue(body.valid_from_date || body.valid_start_date || body.valid_start_at),
    valid_through_date: dateInputValue(body.valid_through_date || body.valid_end_date || body.valid_end_at || body.expires_at),
    valid_from_time: cleanText(body.valid_from_time, 20),
    valid_through_time: cleanText(body.valid_through_time, 20),
    size_text: cleanText(body.size_text, 80),
    quantity,
    unit: cleanText(body.unit || "each", 30).toLowerCase(),
    proof_type: validateImportProofType(body.proof_type),
    observed_at: normalizeOptionalTimestamp(body.observed_at || body.observed_date),
    source_date: normalizeImportDate(body.source_date || body.purchased_date || body.observed_at || body.observed_date, false),
    valid_start_at: normalizeImportDate(body.valid_start_at || body.valid_start_date, false),
    valid_end_at: normalizeImportDate(body.valid_end_at || body.valid_end_date || body.expires_at, true),
    ...source,
    raw_receipt_line: cleanText(body.raw_receipt_line, 500),
    extracted_item_name: cleanText(body.extracted_item_name, 120),
    extracted_price: parseImportNumber(body.extracted_price),
    extracted_quantity: parseImportNumber(body.extracted_quantity),
    extracted_weight: parseImportNumber(body.extracted_weight),
    extracted_unit: cleanText(body.extracted_unit, 30).toLowerCase(),
    extraction_confidence: ["high", "medium", "low"].includes(extractionConfidence) ? extractionConfidence : "low",
    extraction_notes: cleanText(body.extraction_notes, 500),
    duplicate_warning: cleanText(body.duplicate_warning, 500),
    notes: cleanText(body.notes, 500),
    status: validateImportRowStatus(body.status)
  };
}

function composeImportReportNotes(row) {
  const parts = [
    row.notes || "",
    "Imported through Admin Price Importer after proof review.",
    row.variant ? `Variant: ${row.variant}.` : "",
    row.coupon_required ? "Coupon required." : "Coupon required: no.",
    row.member_card_price ? `Member-card price: $${Number(row.member_card_price).toFixed(2)}.` : "",
    row.multibuy_details ? `Multi-buy details: ${row.multibuy_details}.` : "",
    row.promotion_text ? `Promotion text: ${row.promotion_text}.` : "",
    row.deal_limit ? `Limit: ${row.deal_limit}.` : "",
    row.observed_at ? `Observed: ${dateInputValue(row.observed_at)}.` : "",
    row.valid_start_at || row.valid_end_at
      ? `Valid dates: ${dateInputValue(row.valid_start_at) || "unknown"} to ${dateInputValue(row.valid_end_at) || "unknown"}.`
      : "",
    row.raw_receipt_line ? `Receipt line: ${row.raw_receipt_line}.` : "",
    row.source_domain ? `Source: ${row.source_domain}.` : ""
  ];

  return cleanText(parts.filter(Boolean).join(" "), 500);
}

function importRowToReportBody(row) {
  return {
    product_id: row.product_id || "",
    store_id: row.store_id,
    item_name: row.item_name,
    brand: row.brand || "",
    category: row.category,
    price: row.comparison_price ?? row.price,
    regular_price: row.regular_price === null || row.regular_price === undefined ? "" : row.regular_price,
    sale_price: row.sale_price ? "on" : "",
    size_text: row.size_text || "",
    quantity: row.quantity,
    unit: row.comparison_unit || row.unit,
    proof_type: row.proof_type,
    notes: composeImportReportNotes(row),
    expires_at: dateInputValue(row.valid_end_at)
  };
}

function freshnessForPrice(input = {}, now = new Date()) {
  if (input.status === "disputed" || Number(input.dispute_count || 0) > 0) return "disputed";
  const sourceDate = input.source_date || input.observed_at || input.source_checked_at || input.submitted_at;
  const timestamp = sourceDate ? new Date(sourceDate).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return "aging";
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86400000);
  const rules = PRICE_FRESHNESS_DAYS[input.proof_type] || PRICE_FRESHNESS_DAYS.no_photo;
  const hardValidity = promotionEligibility(input, now);
  if (!hardValidity.eligible && hardValidity.reason === "expired") return "expired";
  return ageDays <= rules.current ? "current" : ageDays <= rules.aging ? "aging" : "expired";
}

function normalizePriceUnit(value = "") {
  const normalized = cleanText(value, 30).toLowerCase();
  const aliases = { pounds: "lb", pound: "lb", lbs: "lb", ounces: "oz", ounce: "oz", ozs: "oz", kilograms: "kg", kilogram: "kg", grams: "g", gram: "g", items: "each", item: "each", ea: "each", package: "package", pkg: "package" };
  return aliases[normalized] || normalized;
}

function priceBasisForUnit(unit) {
  const normalized = normalizePriceUnit(unit);
  return ["lb", "oz", "kg", "g"].includes(normalized) ? `per_${normalized}` : normalized === "each" ? "each" : normalized === "package" ? "package" : normalized ? `per_${normalized}` : "package";
}

function primaryPriceLabel(price, unit, sizeText = "") {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return "Price needed";
  const normalized = normalizePriceUnit(unit);
  if (["lb", "oz", "kg", "g"].includes(normalized)) return `$${amount.toFixed(2)}/${normalized}`;
  if (normalized === "each") return `$${amount.toFixed(2)} each`;
  if (normalized && normalized !== "package") return `$${amount.toFixed(2)}/${normalized}`;
  return sizeText ? `$${amount.toFixed(2)} · ${cleanText(sizeText, 80)}` : `$${amount.toFixed(2)}`;
}

function priceSourceTimestamp(input = {}) {
  return input.source_date || input.observed_at || input.source_checked_at || input.reviewed_at || input.submitted_at || "";
}

function priceAgeDays(input = {}, now = new Date()) {
  const timestamp = new Date(priceSourceTimestamp(input)).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86400000));
}

function publicFreshnessLabel(input = {}, now = new Date()) {
  const freshness = freshnessForPrice(input, now);
  if (freshness === "disputed") return "Disputed";
  if (freshness === "expired") return "Expired";
  const validity = promotionEligibility(input, now);
  if (validity.eligible && input.valid_through_date) return `Sale ends ${dateInputValue(input.valid_through_date)}`;
  if (freshness === "aging") return "Aging";
  const ageDays = priceAgeDays(input, now);
  if (ageDays === 0) return "Verified today";
  if (ageDays === 1) return "Verified yesterday";
  return ageDays === null ? "Recently verified" : `${ageDays} days old`;
}

function publicPriceEligibilitySql(alias = "pr") {
  const receiptDays = PRICE_FRESHNESS_DAYS.receipt_photo.aging;
  const shelfDays = PRICE_FRESHNESS_DAYS.shelf_tag_photo.aging;
  const adDays = PRICE_FRESHNESS_DAYS.weekly_ad.aging;
  const defaultDays = PRICE_FRESHNESS_DAYS.no_photo.aging;
  const janesvilleToday = localDateFor();
  return `
    ${alias}.status = 'approved'
    AND (${alias}.valid_from_date IS NULL OR ${alias}.valid_from_date = '' OR date(${alias}.valid_from_date) <= date('${janesvilleToday}'))
    AND (${alias}.valid_through_date IS NULL OR ${alias}.valid_through_date = '' OR date(${alias}.valid_through_date) >= date('${janesvilleToday}'))
    AND (${alias}.expires_at IS NULL OR ${alias}.expires_at = '' OR COALESCE(${alias}.price_type, 'regular') != 'regular' OR datetime(${alias}.expires_at) >= datetime('now'))
    AND ((COALESCE(${alias}.proof_type, '') != 'store_page' AND NULLIF(${alias}.source_url, '') IS NULL) OR COALESCE(${alias}.location_verification_status, '') IN ('verified_exact_store','verified_market'))
    AND (COALESCE(${alias}.price_type, 'regular') NOT IN ('one_day_sale','digital_coupon','paper_coupon') OR (NULLIF(${alias}.valid_from_date, '') IS NOT NULL AND NULLIF(${alias}.valid_through_date, '') IS NOT NULL))
    AND datetime(COALESCE(NULLIF(${alias}.source_date, ''), NULLIF(${alias}.source_checked_at, ''), NULLIF(${alias}.reviewed_at, ''), ${alias}.submitted_at)) >= datetime('now', CASE ${alias}.proof_type WHEN 'receipt_photo' THEN '-${receiptDays} days' WHEN 'shelf_tag_photo' THEN '-${shelfDays} days' WHEN 'weekly_ad' THEN '-${adDays} days' ELSE '-${defaultDays} days' END)
  `;
}

async function loadSourceFreshnessSettings() {
  const rows = await all("SELECT proof_type, current_days, aging_days FROM source_freshness_settings");
  for (const row of rows) {
    if (!PRICE_FRESHNESS_DAYS[row.proof_type]) continue;
    PRICE_FRESHNESS_DAYS[row.proof_type].current = Math.max(1, Number(row.current_days) || PRICE_FRESHNESS_DAYS[row.proof_type].current);
    PRICE_FRESHNESS_DAYS[row.proof_type].aging = Math.max(PRICE_FRESHNESS_DAYS[row.proof_type].current, Number(row.aging_days) || PRICE_FRESHNESS_DAYS[row.proof_type].aging);
  }
}

function normalizeBarcode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return { valid: false, value: digits, type: "unknown", error: "Barcode must contain 8, 12, 13, or 14 digits." };
  const payload = digits.slice(0, -1).split("").reverse();
  const sum = payload.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  const expected = (10 - (sum % 10)) % 10;
  if (expected !== Number(digits.at(-1))) return { valid: false, value: digits, type: "unknown", error: "Barcode check digit is invalid." };
  return { valid: true, value: digits, type: digits.length === 12 ? "upc_a" : digits.length === 8 ? "ean_8" : digits.length === 13 ? "ean_13" : "gtin_14" };
}

async function recordBarcodeConflict(barcodeValue, existingProductId, attemptedProductId, source = "staff") {
  const now = new Date().toISOString();
  await run(`INSERT INTO product_barcode_conflicts
    (normalized_value, existing_product_id, attempted_product_id, source, status, occurrence_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'open', 1, ?, ?)
    ON CONFLICT(normalized_value, attempted_product_id, status) DO UPDATE SET
      existing_product_id = excluded.existing_product_id,
      occurrence_count = product_barcode_conflicts.occurrence_count + 1,
      updated_at = excluded.updated_at`, [barcodeValue, existingProductId, attemptedProductId || null, cleanText(source, 40), now, now]);
}

async function assignBarcodeToProduct(productId, rawValue, actorUserId = null, source = "staff") {
  const text = cleanText(rawValue, 40);
  if (!text) return null;
  const barcode = normalizeBarcode(text);
  if (!barcode.valid) {
    const error = new Error(barcode.error);
    error.statusCode = 400;
    throw error;
  }
  const conflict = await get("SELECT id, product_id FROM product_barcodes WHERE normalized_value = ? AND status = 'verified'", [barcode.value]);
  if (conflict && Number(conflict.product_id) !== Number(productId)) {
    await recordBarcodeConflict(barcode.value, conflict.product_id, productId, source);
    const error = new Error("This barcode is already assigned to another product. Resolve the UPC conflict in Attention Center.");
    error.statusCode = 409;
    throw error;
  }
  const now = new Date().toISOString();
  await run("INSERT INTO product_barcodes (product_id, barcode_type, normalized_value, status, source, created_by, created_at, updated_at) VALUES (?, ?, ?, 'verified', ?, ?, ?, ?) ON CONFLICT(normalized_value) WHERE status = 'verified' DO UPDATE SET updated_at = excluded.updated_at", [productId, barcode.type, barcode.value, cleanText(source, 40), actorUserId || null, now, now]);
  await run("UPDATE products SET upc = ?, updated_at = ? WHERE id = ?", [barcode.value, now, productId]);
  return barcode;
}

async function assertBarcodeAvailable(productId, rawValue) {
  const text = cleanText(rawValue, 40);
  if (!text) return null;
  const barcode = normalizeBarcode(text);
  if (!barcode.valid) {
    const error = new Error(barcode.error);
    error.statusCode = 400;
    throw error;
  }
  const conflict = await get("SELECT product_id FROM product_barcodes WHERE normalized_value = ? AND status = 'verified'", [barcode.value]);
  if (conflict && Number(conflict.product_id) !== Number(productId || 0)) {
    await recordBarcodeConflict(barcode.value, conflict.product_id, productId, "staff_edit");
    const error = new Error("This barcode is already assigned to another product. Resolve the UPC conflict in Attention Center.");
    error.statusCode = 409;
    throw error;
  }
  return barcode;
}

async function resolvedSearchQuery(rawQuery) {
  const normalized = normalizeProductName(rawQuery);
  if (!normalized) return { normalized: "", effective: "", alias: null };
  const alias = await get("SELECT replacement_query, product_id, category FROM search_aliases WHERE normalized_alias = ? AND status = 'verified'", [normalized]);
  return { normalized, effective: alias?.replacement_query || normalized, alias: alias || null };
}

async function recordSearchDemand(rawQuery, resultCount) {
  const normalized = normalizeProductName(rawQuery);
  if (!normalized || normalized.length < 2) return;
  const display = cleanText(rawQuery, 120);
  const count = Math.max(0, Number(resultCount) || 0);
  const now = new Date().toISOString();
  await run(`INSERT INTO search_demand (normalized_query, display_query, total_searches, zero_result_searches, weak_result_searches, last_result_count, first_searched_at, last_searched_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(normalized_query) DO UPDATE SET display_query = excluded.display_query, total_searches = search_demand.total_searches + 1, zero_result_searches = search_demand.zero_result_searches + excluded.zero_result_searches, weak_result_searches = search_demand.weak_result_searches + excluded.weak_result_searches, last_result_count = excluded.last_result_count, last_searched_at = excluded.last_searched_at`, [normalized, display, count === 0 ? 1 : 0, count > 0 && count <= 2 ? 1 : 0, count, now, now]);
}

async function recordPriceEvent(input = {}) {
  await run(`INSERT INTO price_provenance_events (price_report_id, import_batch_id, import_row_id, event_type, actor_user_id, submitter_user_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [input.reportId || null, input.batchId || null, input.rowId || null, cleanText(input.eventType, 40).toUpperCase(), input.actorUserId || null, input.submitterUserId || null, cleanText(input.reason || "", 300), metadataJson(input.metadata || {}), input.createdAt || new Date().toISOString()]);
}

// Draft autosaves and approval can arrive as separate HTTP requests. Serialize
// mutations for a row so approval cannot observe a half-finished autosave and a
// late autosave cannot reopen an already-approved row.
const priceImportRowMutationTails = new Map();

async function acquirePriceImportRowMutation(rowId) {
  const key = Number(rowId);
  const previous = priceImportRowMutationTails.get(key) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => { releaseCurrent = resolve; });
  priceImportRowMutationTails.set(key, current);
  await previous.catch(() => {});
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseCurrent();
    if (priceImportRowMutationTails.get(key) === current) priceImportRowMutationTails.delete(key);
  };
}

function serializePriceImportRowMutation(request, response, next) {
  acquirePriceImportRowMutation(Number.parseInt(request.params.id, 10))
    .then((release) => {
      response.once("finish", release);
      response.once("close", release);
      next();
    })
    .catch(next);
}

function formatPriceImportRow(row) {
  return {
    id: row.id,
    batch_id: row.batch_id,
    price_report_id: row.price_report_id || null,
    product_id: row.product_id || null,
    product_display_name: row.product_display_name || "",
    product_image_id: row.product_image_id || null,
    product_image_url: row.product_image_id ? `/api/product-images/${row.product_image_id}/file` : "",
    product_image_alt_text: row.product_image_alt_text || "",
    store_id: row.store_id || null,
    store_name: row.store_name || "",
    item_name: row.item_name || "",
    brand: row.brand || "",
    variant: row.variant || "",
    category: row.category || "other",
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    price_label: row.price === null || row.price === undefined ? "" : `$${Number(row.price).toFixed(2)}`,
    price_basis: row.price_basis || priceBasisForUnit(row.comparison_unit || row.unit),
    comparison_price: row.comparison_price == null ? (row.price == null ? null : Number(row.price)) : Number(row.comparison_price),
    comparison_unit: normalizePriceUnit(row.comparison_unit || row.unit),
    primary_price_label: primaryPriceLabel(row.comparison_price ?? row.price, row.comparison_unit || row.unit, row.size_text),
    estimated_item_price: row.estimated_item_price == null ? null : Number(row.estimated_item_price),
    estimated_item_price_label: row.estimated_item_price == null ? "" : `${primaryPriceLabel(row.estimated_item_price, "each")} estimated`,
    approximate_item_weight: row.approximate_item_weight == null ? null : Number(row.approximate_item_weight),
    approximate_item_weight_unit: normalizePriceUnit(row.approximate_item_weight_unit || ""),
    approximate_item_weight_label: row.approximate_item_weight == null ? "" : `About ${Number(row.approximate_item_weight)} ${normalizePriceUnit(row.approximate_item_weight_unit || "lb")} each`,
    package_price: row.package_price == null ? null : Number(row.package_price),
    regular_price: row.regular_price === null || row.regular_price === undefined ? null : Number(row.regular_price),
    sale_price: Boolean(row.sale_price),
    member_card_price: row.member_card_price === null || row.member_card_price === undefined ? null : Number(row.member_card_price),
    member_card_price_label: row.member_card_price === null || row.member_card_price === undefined ? "" : `$${Number(row.member_card_price).toFixed(2)}`,
    coupon_required: Boolean(row.coupon_required),
    deal_limit: row.deal_limit || "",
    multibuy_details: row.multibuy_details || "",
    multibuy_quantity: row.multibuy_quantity == null ? null : Number(row.multibuy_quantity),
    multibuy_total_price: row.multibuy_total_price == null ? null : Number(row.multibuy_total_price),
    storage_condition: row.storage_condition || "unknown",
    price_type: row.price_type || (row.sale_price ? "sale" : "regular"),
    promotion_text: row.promotion_text || "",
    display_offer_text: row.display_offer_text || row.promotion_text || "",
    promotion_conditions: row.promotion_conditions || "",
    promotion_schedule_text: row.promotion_schedule_text || "",
    valid_from_date: row.valid_from_date || dateInputValue(row.valid_start_at),
    valid_through_date: row.valid_through_date || dateInputValue(row.valid_end_at),
    valid_from_time: row.valid_from_time || "",
    valid_through_time: row.valid_through_time || "",
    size_text: row.size_text || "",
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    unit: row.unit || "",
    proof_type: row.proof_type || "weekly_ad",
    observed_at: row.observed_at || "",
    source_date: row.source_date || dateInputValue(row.observed_at),
    observed_date: dateInputValue(row.observed_at),
    valid_start_at: row.valid_start_at || "",
    valid_start_date: dateInputValue(row.valid_start_at),
    valid_end_at: row.valid_end_at || "",
    valid_end_date: dateInputValue(row.valid_end_at),
    source_url: row.source_url || "",
    source_title: row.source_title || "",
    source_domain: row.source_domain || "",
    source_checked_at: row.source_checked_at || "",
    source_checked_date: dateInputValue(row.source_checked_at),
    raw_receipt_line: row.raw_receipt_line || "",
    extracted_item_name: row.extracted_item_name || "",
    extracted_price: row.extracted_price === null || row.extracted_price === undefined ? null : Number(row.extracted_price),
    extracted_quantity: row.extracted_quantity === null || row.extracted_quantity === undefined ? null : Number(row.extracted_quantity),
    extracted_weight: row.extracted_weight === null || row.extracted_weight === undefined ? null : Number(row.extracted_weight),
    extracted_unit: row.extracted_unit || "",
    extraction_confidence: row.extraction_confidence || "low",
    extraction_notes: row.extraction_notes || "",
    duplicate_warning: row.duplicate_warning || "",
    product_matches: row.product_matches || [],
    notes: row.notes || "",
    status: row.status,
    admin_rejection_note: row.admin_rejection_note || "",
    rejection_reason: row.rejection_reason || "",
    public_rejection_reason: row.public_rejection_reason || row.rejection_reason || "",
    public_reviewer_explanation: row.public_reviewer_explanation || "",
    created_by: row.created_by || null,
    created_by_username: row.created_by_username || "",
    created_at: row.created_at,
    updated_by: row.updated_by || null,
    updated_by_username: row.updated_by_username || "",
    updated_at: row.updated_at,
    approved_by: row.approved_by || null,
    approved_by_username: row.approved_by_username || "",
    approved_at: row.approved_at || "",
    rejected_by: row.rejected_by || null,
    rejected_by_username: row.rejected_by_username || "",
    rejected_at: row.rejected_at || "",
    ai_analysis_id: row.ai_analysis_id || null,
    ai_item_index: row.ai_item_index == null ? null : Number(row.ai_item_index),
    ai_confidence: row.ai_confidence || "",
    ai_field_confidences: parseMetadataJson(row.ai_field_confidences_json),
    ai_warnings: parseMetadataJson(row.ai_warnings_json),
    research_notes: row.research_notes || "",
    research_sources: parseMetadataJson(row.research_sources_json),
    suggested_new_product: Boolean(row.suggested_new_product)
  };
}

function formatPriceImportBatch(batch, rows = []) {
  const proofSubmission = parseProofSubmissionNotes(batch.notes);

  return {
    id: batch.id,
    source_type: batch.source_type,
    proof_type: batch.proof_type,
    photo_path: batch.photo_path,
    photo_original_name: batch.photo_original_name || "",
    photo_mime_type: batch.photo_mime_type || "",
    photo_size_bytes: batch.photo_size_bytes || 0,
    status: batch.status,
    source_url: batch.source_url || "",
    source_title: batch.source_title || "",
    source_domain: batch.source_domain || "",
    source_checked_at: batch.source_checked_at || "",
    source_checked_date: dateInputValue(batch.source_checked_at),
    default_store_id: batch.default_store_id || null,
    batch_title: batch.batch_title || "",
    observed_at: batch.observed_at || "",
    observed_date: dateInputValue(batch.observed_at),
    valid_start_at: batch.valid_start_at || "",
    valid_start_date: dateInputValue(batch.valid_start_at),
    valid_end_at: batch.valid_end_at || "",
    valid_end_date: dateInputValue(batch.valid_end_at),
    source_text: batch.source_text || "",
    receipt_store_name: batch.receipt_store_name || "",
    receipt_store_address: batch.receipt_store_address || "",
    receipt_purchase_date: batch.receipt_purchase_date || "",
    receipt_purchase_date_value: dateInputValue(batch.receipt_purchase_date),
    receipt_purchase_time: batch.receipt_purchase_time || "",
    receipt_total: batch.receipt_total === null || batch.receipt_total === undefined ? null : Number(batch.receipt_total),
    receipt_total_label: batch.receipt_total === null || batch.receipt_total === undefined ? "" : `$${Number(batch.receipt_total).toFixed(2)}`,
    receipt_transaction_id: batch.receipt_transaction_id || "",
    receipt_ocr_text: batch.receipt_ocr_text || "",
    receipt_ocr_confidence: batch.receipt_ocr_confidence || "",
    proof_file_hash: batch.proof_file_hash || "",
    duplicate_of_batch_id: batch.duplicate_of_batch_id || null,
    duplicate_scope: batch.duplicate_scope || "",
    review_priority: batch.review_priority || "normal",
    review_status: batch.review_status || "waiting",
    review_claimed_by: batch.review_claimed_by || null,
    review_claimed_by_username: batch.review_claimed_by_username || "",
    review_claimed_at: batch.review_claimed_at || "",
    review_claim_expires_at: batch.review_claim_expires_at || "",
    review_escalated_at: batch.review_escalated_at || "",
    review_escalation_reason: batch.review_escalation_reason || "",
    proof_quality_flags: String(batch.proof_quality_flags || "")
      .split(",")
      .map((flag) => flag.trim())
      .filter(Boolean),
    notes: batch.notes || "",
    is_proof_submission: isProofSubmissionBatch(batch),
    proof_store_id: proofSubmission.store_id || "",
    proof_store_name: batch.receipt_store_name || proofSubmission.store_name || "",
    proof_public_type: proofSubmission.public_proof_type || "",
    proof_item_hint: proofSubmission.item_hint || "",
    proof_price_hint: proofSubmission.price_hint || "",
    proof_user_notes: proofSubmission.user_notes || "",
    created_by: batch.created_by || null,
    created_by_username: batch.created_by_username || "",
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    rows: rows.map(formatPriceImportRow)
  };
}

function proofStatusCopy(status) {
  const key = cleanText(status || "", 80);
  const copy = {
    needs_admin_review: {
      label: "Waiting for review",
      message: "Your proof was received and is waiting for review."
    },
    waiting_for_review: {
      label: "Waiting for review",
      message: "Your proof was received and is waiting for review."
    },
    accepted_for_review: {
      label: "Accepted for review",
      message: "Your proof was accepted for review. Admin will turn useful prices into approved reports."
    },
    proof_reviewed: {
      label: "Reviewed, no prices added",
      message: "Thanks for sending proof. We reviewed it, but no prices were added this time."
    },
    proof_rejected: {
      label: "Not accepted",
      message: "Your proof could not be used."
    },
    needs_clearer_photo: {
      label: "Needs clearer photo",
      message: "We need a clearer photo before we can use this proof."
    },
    needs_source_link: {
      label: "Needs source link",
      message: "We need a source link before we can use this proof."
    },
    ready_for_review: {
      label: "Draft rows ready",
      message: "Admin created draft rows from this proof. Nothing is public until approval."
    },
    approved: {
      label: "Approved",
      message: "This proof has approved public prices."
    },
    rejected: {
      label: "Not accepted",
      message: "Your proof could not be used."
    },
    duplicate: {
      label: "Duplicate proof",
      message: "This proof matched another proof already submitted."
    },
    used_for_prices: {
      label: "Prices approved",
      message: "Your proof helped add approved public prices."
    },
    reviewed_no_prices: {
      label: "Reviewed, no prices added",
      message: "Thanks for sending proof. We reviewed it, but no prices were added this time."
    }
  };

  return copy[key] || {
    label: key ? key.replace(/_/g, " ") : "Proof submitted",
    message: "Proof status is available."
  };
}

async function proofResultSummary(batch, rows = []) {
  const formattedBatch = formatPriceImportBatch(batch, rows);
  const proofSubmission = parseProofSubmissionNotes(batch.notes);
  const approvedRows = rows.filter((row) => row.status === "approved" && row.price_report_id);
  const approvedReportIds = [...new Set(approvedRows.map((row) => row.price_report_id).filter(Boolean))];
  const approvedReports = approvedReportIds.length
    ? await all(
        `
          ${reportSelectWithProduct()}
          WHERE pr.id IN (${approvedReportIds.map(() => "?").join(", ")})
            AND pr.status = 'approved'
          ORDER BY pr.reviewed_at DESC, pr.submitted_at DESC
        `,
        approvedReportIds
      )
    : [];
  const points = batch.created_by
    ? await all(
        `
          SELECT action, points, reason, price_report_id, related_import_batch_id, related_import_row_id, created_at
          FROM point_events
          WHERE user_id = ?
            AND related_import_batch_id = ?
          ORDER BY created_at ASC, id ASC
        `,
        [batch.created_by, batch.id]
      )
    : [];
  const statusCopy = proofStatusCopy(batch.status);
  const outcomeRow = await get("SELECT public_summary_json, approved_count, rejected_count, finalized_at FROM submission_outcomes WHERE proof_id = ?", [batch.id]);
  const outcome = outcomeRow ? parseMetadataJson(outcomeRow.public_summary_json) : null;
  const safeReports = approvedReports.map(formatPublicReport);
  const pointsEarned = points.reduce((sum, event) => sum + Math.max(0, Number(event.points) || 0), 0);
  const reviewedStatuses = new Set([
    "accepted_for_review",
    "proof_reviewed",
    "proof_rejected",
    "needs_clearer_photo",
    "needs_source_link",
    "rejected",
    "duplicate",
    "used_for_prices",
    "reviewed_no_prices"
  ]);

  return {
    id: batch.id,
    status: batch.status,
    status_label: statusCopy.label,
    message: safeReports.length
      ? `Thanks for contributing. Your proof helped add ${safeReports.length} approved price${safeReports.length === 1 ? "" : "s"}.`
      : statusCopy.message,
    store_name: formattedBatch.proof_store_name || formattedBatch.receipt_store_name || "",
    proof_type: formattedBatch.proof_public_type || formattedBatch.source_type || formattedBatch.proof_type,
    submitted_at: formattedBatch.created_at,
    updated_at: formattedBatch.updated_at,
    reviewed_at: reviewedStatuses.has(batch.status) ? formattedBatch.updated_at : "",
    source_url: formattedBatch.source_url,
    source_title: formattedBatch.source_title,
    item_hint: formattedBatch.proof_item_hint,
    price_hint: formattedBatch.proof_price_hint,
    user_notes: formattedBatch.proof_user_notes,
    review_reason: outcome?.public_reason || proofSubmission.review_note,
    outcome,
    not_approved_count: Number(outcomeRow?.rejected_count || 0),
    approved_count: safeReports.length,
    approved_items: safeReports,
    points_earned: pointsEarned,
    point_events: points.map((event) => ({
      action: event.action,
      points: Number(event.points) || 0,
      reason: event.reason || "",
      price_report_id: event.price_report_id || null,
      related_import_batch_id: event.related_import_batch_id || null,
      related_import_row_id: event.related_import_row_id || null,
      created_at: event.created_at
    })),
    needs_resubmit: ["needs_clearer_photo", "needs_source_link"].includes(batch.status),
    privacy_note: batch.proof_type === "receipt_photo"
      ? "Receipt proof is private. Public shoppers only see approved item, price, store, proof type, checked date, and source link when available."
      : "Uploaded proof stays private until admin approval creates public price reports."
  };
}

function trackingTokenHash(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function safeOutcomeRowName(row) {
  return cleanText(row.product_display_name || row.item_name || row.extracted_item_name || "Item", 120);
}

async function ensureSubmissionOutcome(batchId, reviewerId, options = {}) {
  const existing = await get("SELECT * FROM submission_outcomes WHERE proof_id = ?", [batchId]);
  if (existing) return { ...existing, public_summary: parseMetadataJson(existing.public_summary_json) };
  const batch = await priceImportBatchById(batchId);
  if (!batch) return null;
  const rows = await priceImportRowsForBatchIds([batchId]);
  const approved = rows.filter((row) => row.status === "approved").map((row) => ({
    status: "APPROVED",
    product: safeOutcomeRowName(row),
    price: row.display_offer_text || row.price_label || (row.price == null ? "" : `$${Number(row.price).toFixed(2)}`),
    store: row.store_name || "",
    valid_from_date: row.valid_from_date || dateInputValue(row.valid_start_at),
    valid_through_date: row.valid_through_date || dateInputValue(row.valid_end_at),
    promotion_conditions: row.promotion_conditions || ""
  }));
  const rejected = rows.filter((row) => row.status === "rejected").map((row) => ({
    status: "NOT APPROVED",
    product: safeOutcomeRowName(row),
    reason: row.public_rejection_reason || normalizeReviewRejectionReason(row.rejection_reason || options.publicReason || "other"),
    explanation: row.public_reviewer_explanation || ""
  }));
  const proofRejected = options.outcomeType === "proof_rejected" || TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || batch.review_status === "rejected";
  const reviewedNoPrices = options.outcomeType === "reviewed_no_prices" || batch.status === "reviewed_no_prices";
  const summary = proofRejected && !approved.length
    ? { status: "reviewed", outcome: "not_approved", title: "Your submission could not be approved.", public_reason: options.publicReason || rejected[0]?.reason || "other", public_explanation: options.publicExplanation || "You can submit clearer evidence if available.", approved: [], not_approved: [] }
    : reviewedNoPrices && !approved.length
      ? { status: "reviewed", outcome: "not_approved", title: "Your submission was reviewed.", public_reason: options.publicReason || "No usable prices were found.", public_explanation: options.publicExplanation || "No prices could be verified from this proof.", approved: [], not_approved: rejected, reviewed_by: "Grocery Radar" }
    : { status: "reviewed", outcome: "reviewed", title: "Your submission was reviewed", approved, not_approved: rejected, reviewed_by: "Grocery Radar" };
  const now = options.finalizedAt || new Date().toISOString();
  const outcomeType = proofRejected ? (batch.status === "duplicate" ? "duplicate" : "proof_rejected") : reviewedNoPrices ? "reviewed_no_prices" : "reviewed";
  await run(`INSERT OR IGNORE INTO submission_outcomes (proof_id, outcome_type, approved_count, rejected_count, public_summary_json, finalized_by, finalized_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [batchId, outcomeType, approved.length, rejected.length, JSON.stringify(summary), reviewerId || null, now, now, now]);
  if (batch.created_by) {
    await createUniqueUserNotification(batch.created_by, "proof_final_outcome", "proof_submission", batchId, "Your submission was reviewed", approved.length ? `${approved.length} price${approved.length === 1 ? "" : "s"} approved; ${rejected.length} not approved.` : "Your proof review is complete.", { related_import_batch_id: batchId, target_tab: "profile", target_url: `/?tab=accountView&section=proof&proof=${batchId}` });
  }
  const saved = await get("SELECT * FROM submission_outcomes WHERE proof_id = ?", [batchId]);
  return saved ? { ...saved, public_summary: parseMetadataJson(saved.public_summary_json) } : null;
}

function formatProduct(row) {
  const hasCurrentPrice = row.best_price !== null && row.best_price !== undefined;
  return {
    id: row.id,
    canonical_name: row.canonical_name,
    display_name: row.display_name,
    category: row.category,
    default_size_text: row.default_size_text || "",
    default_quantity: row.default_quantity === null || row.default_quantity === undefined
      ? null
      : Number(row.default_quantity),
    default_unit: row.default_unit || "",
    default_storage_condition: row.default_storage_condition || "",
    brand_optional: Boolean(row.brand_optional),
    preferred_brand: row.preferred_brand || "",
    variant: row.variant || "",
    upc: row.upc || "",
    description: row.description || "",
    generic_product_type: row.generic_product_type || "",
    product_attributes: parseMetadataJson(row.product_attributes_json),
    common_aliases: row.common_aliases || "",
    aliases: String(row.common_aliases || "")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean),
    ingredient_info_url: row.ingredient_info_url || "",
    allergen_note: row.allergen_note || "",
    admin_safety_note: row.admin_safety_note || "",
    status: row.status,
    created_by_user_id: row.created_by_user_id || null,
    created_by_admin_id: row.created_by_admin_id || null,
    merged_into_product_id: row.merged_into_product_id || null,
    admin_note: row.admin_note || "",
    updated_by: row.updated_by || null,
    approved_price_count: hasCurrentPrice ? Number(row.approved_price_count || 0) : 0,
    pending_report_count: row.pending_report_count || 0,
    unlinked_report_count: row.unlinked_report_count || 0,
    has_current_price: hasCurrentPrice,
    best_price: hasCurrentPrice ? Number(row.best_price) : null,
    best_price_unit: hasCurrentPrice ? normalizePriceUnit(row.best_price_unit || "") : null,
    best_price_size_text: hasCurrentPrice ? (row.best_price_size_text || "") : null,
    best_price_label: hasCurrentPrice ? primaryPriceLabel(row.best_price, row.best_price_unit, row.best_price_size_text) : "Price needed",
    best_store_name: hasCurrentPrice ? (row.best_store_name || "") : null,
    best_store_id: hasCurrentPrice ? (row.best_store_id || null) : null,
    best_report_id: hasCurrentPrice ? (row.best_report_id || null) : null,
    best_price_freshness: hasCurrentPrice ? publicFreshnessLabel({ source_date: row.best_source_date, submitted_at: row.best_reported_at, proof_type: row.best_proof_type, expires_at: row.best_expires_at }) : "",
    other_store_price_count: Number(row.other_store_price_count || 0),
    image_id: row.image_id || null,
    image_url: row.image_id ? `/api/product-images/${row.image_id}/file` : "",
    image_alt_text: row.image_alt_text || "",
    last_reported_at: row.last_reported_at || "",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function formatPublicProduct(row) {
  const product = formatProduct(row);

  delete product.canonical_name;
  delete product.common_aliases;
  delete product.admin_safety_note;
  delete product.admin_note;
  delete product.created_by_user_id;
  delete product.created_by_admin_id;
  delete product.merged_into_product_id;
  delete product.updated_by;
  delete product.pending_report_count;
  delete product.unlinked_report_count;
  delete product.status;
  delete product.created_at;
  delete product.updated_at;

  return product;
}

function productSelectColumns(alias = "products") {
  const eligible = `${publicPriceEligibilitySql("price_reports")}
    AND (NULLIF(${alias}.default_unit, '') IS NULL OR lower(COALESCE(NULLIF(price_reports.comparison_unit, ''), price_reports.unit)) = lower(${alias}.default_unit))
    AND (lower(COALESCE(NULLIF(price_reports.comparison_unit, ''), price_reports.unit)) NOT IN ('each', 'package') OR NULLIF(${alias}.default_size_text, '') IS NULL OR NULLIF(price_reports.size_text, '') IS NULL OR lower(price_reports.size_text) = lower(${alias}.default_size_text))`;
  const activeUser = "COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')";
  const order = `COALESCE(price_reports.comparison_price, price_reports.unit_price, price_reports.price) ASC, price_reports.submitted_at DESC`;
  return `
    ${alias}.*,
    (
      SELECT product_images.id FROM product_images
      WHERE product_images.product_id = ${alias}.id AND product_images.status = 'approved'
      ORDER BY product_images.is_primary DESC, product_images.id ASC LIMIT 1
    ) AS image_id,
    (
      SELECT product_images.alt_text FROM product_images
      WHERE product_images.product_id = ${alias}.id AND product_images.status = 'approved'
      ORDER BY product_images.is_primary DESC, product_images.id ASC LIMIT 1
    ) AS image_alt_text,
    (
      SELECT COUNT(DISTINCT price_reports.store_id)
      FROM price_reports
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND ${eligible}
        AND ${activeUser}
    ) AS approved_price_count,
    (
      SELECT COUNT(*)
      FROM price_reports
      WHERE price_reports.product_id = ${alias}.id
        AND price_reports.status = 'pending'
    ) AS pending_report_count,
    (
      SELECT COUNT(*)
      FROM price_reports
      WHERE price_reports.product_id IS NULL
        AND lower(price_reports.item_name) = ${alias}.canonical_name
    ) AS unlinked_report_count,
    (
      SELECT COALESCE(price_reports.comparison_price, price_reports.unit_price, price_reports.price)
      FROM price_reports
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND ${eligible}
        AND ${activeUser}
      ORDER BY ${order}
      LIMIT 1
    ) AS best_price,
    (
      SELECT COALESCE(NULLIF(price_reports.comparison_unit, ''), price_reports.unit)
      FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_price_unit,
    (
      SELECT price_reports.size_text FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_price_size_text,
    (
      SELECT stores.name
      FROM price_reports
      JOIN stores ON stores.id = price_reports.store_id
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND ${eligible}
        AND ${activeUser}
      ORDER BY ${order}
      LIMIT 1
    ) AS best_store_name,
    (
      SELECT price_reports.store_id FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_store_id,
    (
      SELECT price_reports.id FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_report_id,
    (
      SELECT price_reports.source_date FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_source_date,
    (
      SELECT price_reports.proof_type FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_proof_type,
    (
      SELECT price_reports.expires_at FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_expires_at,
    (
      SELECT price_reports.submitted_at FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
      ORDER BY ${order} LIMIT 1
    ) AS best_reported_at,
    (
      SELECT MAX(0, COUNT(DISTINCT price_reports.store_id) - 1) FROM price_reports JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id AND ${eligible} AND ${activeUser}
    ) AS other_store_price_count,
    (
      SELECT MAX(price_reports.submitted_at)
      FROM price_reports
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND ${eligible}
        AND ${activeUser}
    ) AS last_reported_at
  `;
}

function productSearchFilter(searchText) {
  const normalized = normalizeProductName(searchText);

  if (!normalized) {
    return { clause: "1 = 1", params: [] };
  }

  return {
    clause: `(
      products.canonical_name LIKE ?
      OR lower(products.display_name) LIKE ?
      OR lower(COALESCE(products.common_aliases, '')) LIKE ?
      OR lower(COALESCE(products.preferred_brand, '')) LIKE ?
      OR lower(COALESCE(products.variant, '')) LIKE ?
      OR lower(COALESCE(products.category, '')) LIKE ?
    )`,
    params: [`%${normalized}%`, `%${normalized}%`, `%${normalized}%`, `%${normalized}%`, `%${normalized}%`, `%${normalized}%`]
  };
}

async function getProductById(productId, includeHidden = false) {
  if (!productId) {
    return null;
  }

  const merged = await get("SELECT id, merged_into_product_id, status FROM products WHERE id = ?", [productId]);
  const resolvedId = merged?.status === "merged" && merged.merged_into_product_id ? merged.merged_into_product_id : productId;
  const filters = ["products.id = ?"];
  const params = [resolvedId];

  if (!includeHidden) {
    filters.push("products.status = 'active'");
  }

  return get(
    `
      SELECT ${productSelectColumns("products")}
      FROM products
      WHERE ${filters.join(" AND ")}
    `,
    params
  );
}

async function findProductForItem(itemName, category = "") {
  const canonical = normalizeProductName(itemName);

  if (!canonical) {
    return null;
  }

  const filters = [
    "products.status IN ('active', 'needs_review')",
    `(
      products.canonical_name = ?
      OR lower(products.display_name) = ?
      OR (',' || lower(COALESCE(products.common_aliases, '')) || ',') LIKE ?
    )`
  ];
  const params = [
    canonical,
    canonical,
    `%,${canonical},%`
  ];

  if (category) {
    filters.push("(products.category = ? OR products.category = 'other')");
    params.push(category);
  }

  return get(
    `
      SELECT ${productSelectColumns("products")}
      FROM products
      WHERE ${filters.join(" AND ")}
      ORDER BY CASE products.status WHEN 'active' THEN 0 ELSE 1 END, products.updated_at DESC
      LIMIT 1
    `,
    params
  );
}

async function createProductCandidateFromReport(cleanReport, userId) {
  const now = new Date().toISOString();
  const canonical = normalizeProductName(cleanReport.item_name);
  const displayName = cleanText(cleanReport.item_name, 160) || canonical;

  const result = await run(
    `
      INSERT INTO products (
        canonical_name,
        display_name,
        category,
        default_size_text,
        default_quantity,
        default_unit,
        brand_optional,
        preferred_brand,
        common_aliases,
        status,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'needs_review', ?, ?, ?)
    `,
    [
      canonical,
      displayName,
      cleanReport.category,
      cleanReport.size_text,
      cleanReport.quantity,
      cleanReport.unit,
      cleanReport.brand,
      canonical,
      userId,
      now,
      now
    ]
  );

  return result.lastID;
}

async function resolveReportProductId(cleanReport, userId) {
  if (cleanReport.product_id) {
    const product = await getProductById(cleanReport.product_id, true);

    if (!product || product.status === "hidden" || product.status === "merged") {
      throw new Error("Selected product is not available.");
    }

    return product.id;
  }

  const match = await findProductForItem(cleanReport.item_name, cleanReport.category);

  if (match) {
    return match.id;
  }

  return createProductCandidateFromReport(cleanReport, userId);
}

async function organizeApprovedReportProduct(report, adminUserId = null) {
  if (!report || !report.product_id) {
    return null;
  }

  const product = await get("SELECT * FROM products WHERE id = ?", [report.product_id]);

  if (!product || product.status === "hidden" || product.status === "merged") {
    return null;
  }

  if (product.status === "needs_review") {
    await run(
      `
        UPDATE products
        SET status = 'active',
            category = COALESCE(NULLIF(category, ''), ?),
            default_size_text = COALESCE(NULLIF(default_size_text, ''), ?),
            default_quantity = COALESCE(default_quantity, ?),
            default_unit = COALESCE(NULLIF(default_unit, ''), ?),
            updated_by = ?,
            updated_at = ?
        WHERE id = ?
      `,
      [
        report.category,
        report.size_text || "",
        report.quantity,
        report.unit,
        adminUserId,
        new Date().toISOString(),
        report.product_id
      ]
    );
  }

  return report.product_id;
}

function formatCartItem(row) {
  return {
    id: row.id,
    product_id: row.product_id || null,
    product_display_name: row.product_display_name || "",
    item_name: row.item_name,
    preferred_brand: row.preferred_brand || "",
    brand_mode: row.brand_mode || "any",
    avoid_ingredients: row.avoid_ingredients || "",
    quantity_needed: row.quantity_needed || "",
    size_preference: row.size_preference || "",
    must_have: Boolean(row.must_have),
    optional_item: Boolean(row.optional_item),
    category: row.category || "",
    notes: row.notes || "",
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at
  };
}

async function cartCountForUser(userId) {
  const row = await get("SELECT COUNT(*) AS count FROM cart_items WHERE user_id = ?", [userId]);
  return row.count || 0;
}

function formatSponsor(row, stats = {}) {
  return {
    id: row.id,
    sponsor_name: row.sponsor_name,
    sponsor_type: row.sponsor_type,
    title: row.title,
    message: row.message,
    link_url: row.link_url || "",
    image_url: row.image_url || "",
    starts_at: row.starts_at || "",
    ends_at: row.ends_at || "",
    status: row.status,
    weekly_price_note: row.weekly_price_note || "",
    admin_note: row.admin_note || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    stats: {
      views: stats.views || 0,
      clicks: stats.clicks || 0,
      interested: stats.interested || 0,
      not_interested: stats.not_interested || 0
    }
  };
}

function publicSponsor(row) {
  return {
    id: row.id,
    sponsor_name: row.sponsor_name,
    sponsor_type: row.sponsor_type,
    title: row.title,
    message: row.message,
    link_url: row.link_url || "",
    image_url: row.image_url || "",
    weekly_price_note: row.weekly_price_note || "",
    starts_at: row.starts_at || "",
    ends_at: row.ends_at || ""
  };
}

function formatNotification(row) {
  const targetUrl = row.target_url || "";
  const safeTargetUrl = !row.admin_only && targetUrl.startsWith("/admin") ? "" : targetUrl;
  return {
    id: row.id,
    user_id: row.user_id || null,
    admin_only: Boolean(row.admin_only),
    type: row.type,
    title: row.title,
    message: row.message,
    related_type: row.related_type || "",
    related_id: row.related_id || null,
    related_report_id: row.related_report_id || null,
    related_import_batch_id: row.related_import_batch_id || null,
    related_import_row_id: row.related_import_row_id || null,
    points_awarded: row.points_awarded || 0,
    target_tab: row.target_tab || "",
    target_url: safeTargetUrl,
    is_read: Boolean(row.is_read),
    created_at: row.created_at,
    read_at: row.read_at || ""
  };
}

function reportSelectWithProduct() {
  return `
    SELECT
      pr.*,
      stores.name AS store_name,
      stores.address AS store_address,
      users.username AS username,
      products.display_name AS product_display_name,
      products.status AS product_status,
      products.default_size_text AS product_default_size_text,
      products.default_unit AS product_default_unit,
      products.generic_product_type AS generic_product_type,
      products.product_attributes_json AS product_attributes_json
    FROM price_reports pr
    JOIN stores ON stores.id = pr.store_id
    JOIN users ON users.id = pr.user_id
    LEFT JOIN products ON products.id = pr.product_id
  `;
}

function baseApprovedReportFilters(item, storeId = null, options = {}) {
  const filters = [
    publicPriceEligibilitySql("pr"),
    "COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')"
  ];
  const params = [];

  if (storeId) {
    filters.push("pr.store_id = ?");
    params.push(storeId);
  }

  const brandPreference = cleanText(item.preferred_brand, 80).toLowerCase();
  const brandMode = cleanText(item.brand_mode || "any", 20).toLowerCase();

  if (brandPreference && brandMode === "exact") {
    filters.push("lower(COALESCE(pr.brand, '')) = ?");
    params.push(brandPreference);
  } else if (brandPreference && brandMode === "preferred") {
    filters.push("(lower(COALESCE(pr.brand, '')) LIKE ? OR COALESCE(pr.brand, '') = '')");
    params.push(`%${brandPreference}%`);
  }

  if (item.category) {
    filters.push("pr.category = ?");
    params.push(item.category);
  }

  const sizePreference = cleanText(item.size_preference, 80).toLowerCase();

  if (sizePreference) {
    filters.push("lower(COALESCE(pr.size_text, '')) LIKE ?");
    params.push(`%${sizePreference}%`);
  }

  if (options.highConfidenceOnly) {
    filters.push("(pr.confidence IN ('high', 'medium-high') OR pr.verification_count > 0)");
  }

  return { filters, params };
}

async function approvedReportForCartItem(item, storeId = null, options = {}) {
  const normalizedItem = normalizeProductName(item.item_name);
  const attempts = [];

  if (item.product_id) {
    attempts.push({
      filter: "pr.product_id = ?",
      params: [item.product_id]
    });
  }

  if (normalizedItem) {
    attempts.push({
      filter: `(
        products.status = 'active'
        AND (
          products.canonical_name LIKE ?
          OR lower(products.display_name) LIKE ?
          OR lower(COALESCE(products.common_aliases, '')) LIKE ?
        )
      )`,
      params: [`%${normalizedItem}%`, `%${normalizedItem}%`, `%${normalizedItem}%`]
    });
    attempts.push({
      filter: "(pr.item_name LIKE ? OR ? LIKE '%' || pr.item_name || '%')",
      params: [`%${normalizedItem}%`, normalizedItem]
    });
  }

  for (const attempt of attempts) {
    const { filters, params } = baseApprovedReportFilters(item, storeId, options);
    filters.push(attempt.filter);
    params.push(...attempt.params);
    const row = await get(
      `
        ${reportSelectWithProduct()}
        WHERE ${filters.join(" AND ")}
        ORDER BY pr.unit_price ASC, pr.price ASC, pr.submitted_at DESC
        LIMIT 1
      `,
      params
    );

    if (row) {
      return formatPublicReport(row);
    }
  }

  return null;
}

function cartItemKey(item) {
  return `${item.id || ""}:${normalizeProductName(item.item_name)}`;
}

function summarizeStoreBreakdown(matches) {
  const byStore = new Map();

  for (const match of matches) {
    const report = match.report;
    const key = report.store_id || report.store_name;
    const existing = byStore.get(key) || {
      store_id: report.store_id,
      store_name: report.store_name,
      estimated_total: 0,
      matched_count: 0,
      items: []
    };

    existing.estimated_total += Number(report.price) || 0;
    existing.matched_count += 1;
    existing.items.push({
      item_name: match.cart_item.product_display_name || match.cart_item.item_name,
      price_label: report.price_label,
      unit_price_label: report.unit_price_label,
      confidence: report.confidence
    });
    byStore.set(key, existing);
  }

  return [...byStore.values()].map((store) => ({
    ...store,
    estimated_total: Number(store.estimated_total.toFixed(2))
  }));
}

function buildCartResult(mode, label, matches, missingItems, explanation, tradeoff) {
  const storesNeeded = [...new Set(matches.map((match) => match.report.store_name).filter(Boolean))];
  const requiredMissing = missingItems.filter((item) => !item.optional_item);
  const mustHaveMissing = missingItems.filter((item) => item.must_have);
  const optionalMissing = missingItems.filter((item) => item.optional_item);
  const optionalMatches = matches.filter((match) => match.cart_item.optional_item);
  const requiredMatches = matches.filter((match) => !match.cart_item.optional_item);
  const estimatedTotal = matches.reduce((sum, match) => sum + (Number(match.report.price) || 0), 0);

  return {
    mode,
    label,
    explanation,
    tradeoff,
    required_wording: "Based on recent approved user reports. Prices may change. Always check the store.",
    estimated_total: Number(estimatedTotal.toFixed(2)),
    store_count: storesNeeded.length,
    stores_needed: storesNeeded,
    matched_count: matches.length,
    required_matched_count: requiredMatches.length,
    optional_matched_count: optionalMatches.length,
    matches,
    optional_matches: optionalMatches,
    missing_items: missingItems,
    required_missing_items: requiredMissing,
    optional_missing_items: optionalMissing,
    must_have_missing_items: mustHaveMissing,
    must_have_warning: mustHaveMissing.length
      ? `${mustHaveMissing.length} must-have item${mustHaveMissing.length === 1 ? "" : "s"} missing approved prices.`
      : "",
    store_breakdown: summarizeStoreBreakdown(matches)
  };
}

async function trackMissingDemandForItems(request, items, mode) {
  for (const item of items) {
    await trackAnalyticsEvent(request, {
      event_type: "missing_price_seen",
      product_id: item.product_id,
      cart_item_name: item.product_display_name || item.item_name,
      category: item.category,
      metadata: {
        mode,
        must_have: Boolean(item.must_have),
        optional_item: Boolean(item.optional_item)
      }
    });
  }
}

async function compareCartForUser(user) {
  const cartItems = await all(
    `
      SELECT
        cart_items.*,
        products.display_name AS product_display_name
      FROM cart_items
      LEFT JOIN products ON products.id = cart_items.product_id
      WHERE cart_items.user_id = ?
      ORDER BY cart_items.created_at ASC
    `,
    [user.id]
  );
  const avoidList = user.avoid_ingredients || "";
  const splitMatches = [];
  const missingItems = [];

  for (const item of cartItems) {
    const match = await approvedReportForCartItem(item);

    if (!match) {
      missingItems.push(formatCartItem(item));
      continue;
    }

    splitMatches.push({
      cart_item: formatCartItem(item),
      report: match,
      allergy_info_unknown: !match.ingredient_info_url && !match.allergen_note,
      check_label_required: true
    });
  }

  const stores = await all("SELECT id, name FROM stores WHERE active = 1 ORDER BY name");
  let bestSingleStore = null;

  for (const store of stores) {
    const matches = [];
    const missing = [];
    let total = 0;

    for (const item of cartItems) {
      const match = await approvedReportForCartItem(item, store.id);

      if (!match) {
        missing.push(formatCartItem(item));
        continue;
      }

      matches.push({
        cart_item: formatCartItem(item),
        report: match,
        allergy_info_unknown: !match.ingredient_info_url && !match.allergen_note,
        check_label_required: true
      });
      total += match.price;
    }

    const candidate = {
      store_id: store.id,
      store_name: store.name,
      matched_count: matches.length,
      required_matched_count: matches.filter((match) => !match.cart_item.optional_item).length,
      must_have_missing_count: missing.filter((item) => item.must_have).length,
      estimated_total: Number(total.toFixed(2)),
      matches,
      missing_items: missing
    };

    if (!bestSingleStore ||
      candidate.required_matched_count > bestSingleStore.required_matched_count ||
      (candidate.required_matched_count === bestSingleStore.required_matched_count && candidate.matched_count > bestSingleStore.matched_count) ||
      (candidate.required_matched_count === bestSingleStore.required_matched_count && candidate.matched_count === bestSingleStore.matched_count && candidate.estimated_total < bestSingleStore.estimated_total)) {
      bestSingleStore = candidate;
    }
  }

  const highConfidenceMatches = [];
  const highConfidenceMissing = [];

  for (const item of cartItems) {
    const match = await approvedReportForCartItem(item, null, { highConfidenceOnly: true });

    if (!match) {
      highConfidenceMissing.push(formatCartItem(item));
      continue;
    }

    highConfidenceMatches.push({
      cart_item: formatCartItem(item),
      report: match,
      allergy_info_unknown: !match.ingredient_info_url && !match.allergen_note,
      check_label_required: true
    });
  }

  const singleMatches = bestSingleStore?.matches || [];
  const missingAfterSingle = bestSingleStore?.missing_items || cartItems.map(formatCartItem);
  let balanceMatches = [...singleMatches];
  let bestSecondStore = null;
  let balanceExplanation = bestSingleStore?.store_name
    ? `${bestSingleStore.store_name} covers the most required cart items in one stop.`
    : "No one-store match is available yet.";

  if (bestSingleStore && missingAfterSingle.length) {
    for (const store of stores.filter((store) => store.id !== bestSingleStore.store_id)) {
      const secondMatches = [];

      for (const missing of missingAfterSingle) {
        const match = await approvedReportForCartItem(missing, store.id);

        if (match) {
          secondMatches.push({
            cart_item: missing,
            report: match,
            allergy_info_unknown: !match.ingredient_info_url && !match.allergen_note,
            check_label_required: true
          });
        }
      }

      const secondTotal = secondMatches.reduce((sum, match) => sum + (Number(match.report.price) || 0), 0);
      const secondCandidate = {
        store,
        matches: secondMatches,
        required_count: secondMatches.filter((match) => !match.cart_item.optional_item).length,
        total: secondTotal
      };

      if (!bestSecondStore ||
        secondCandidate.required_count > bestSecondStore.required_count ||
        (secondCandidate.required_count === bestSecondStore.required_count && secondCandidate.matches.length > bestSecondStore.matches.length) ||
        (secondCandidate.required_count === bestSecondStore.required_count && secondCandidate.matches.length === bestSecondStore.matches.length && secondCandidate.total < bestSecondStore.total)) {
        bestSecondStore = secondCandidate;
      }
    }

    if (bestSecondStore && bestSecondStore.matches.length) {
      const seen = new Set(balanceMatches.map((match) => cartItemKey(match.cart_item)));
      balanceMatches = [
        ...balanceMatches,
        ...bestSecondStore.matches.filter((match) => !seen.has(cartItemKey(match.cart_item)))
      ];
      balanceExplanation = `${bestSingleStore.store_name} covers the most required items, and ${bestSecondStore.store.name} fills in ${bestSecondStore.matches.length} more item${bestSecondStore.matches.length === 1 ? "" : "s"}.`;
    }
  }

  const balanceMatchedKeys = new Set(balanceMatches.map((match) => cartItemKey(match.cart_item)));
  const balanceMissing = cartItems
    .map(formatCartItem)
    .filter((item) => !balanceMatchedKeys.has(cartItemKey(item)));
  const splitResult = buildCartResult(
    "cheapest_split",
    "Cheapest split cart",
    splitMatches,
    missingItems,
    splitMatches.length
      ? `Cheapest split cart uses the lowest approved price found for each matched item across ${new Set(splitMatches.map((match) => match.report.store_name)).size} store${new Set(splitMatches.map((match) => match.report.store_name)).size === 1 ? "" : "s"}.`
      : "No approved prices matched this cart yet.",
    splitMatches.length > 1 ? "This can save the most money, but may require more stops." : "This is the cheapest approved match available right now."
  );
  const singleResult = buildCartResult(
    "best_one_store",
    "Best one-store trip",
    singleMatches,
    bestSingleStore?.missing_items || cartItems.map(formatCartItem),
    bestSingleStore?.store_name
      ? `${bestSingleStore.store_name} is the best one-store option because it has approved prices for ${bestSingleStore.matched_count} of your ${cartItems.length} item${cartItems.length === 1 ? "" : "s"}.`
      : "No store has approved prices for this cart yet.",
    "This is easier for one trip, but may not be the lowest total."
  );
  const balanceResult = buildCartResult(
    "best_balance",
    "Best balance",
    balanceMatches,
    balanceMissing,
    `${balanceExplanation} This is a balanced suggestion, not guaranteed perfect.`,
    "Best balance prefers 1-2 stores while trying to cover more items and keep the estimate practical."
  );
  const highConfidenceResult = buildCartResult(
    "high_confidence",
    "High-confidence only",
    highConfidenceMatches,
    highConfidenceMissing,
    highConfidenceMatches.length
      ? "This mode uses approved prices that are high confidence, medium-high confidence, or have at least one user verification."
      : "No high-confidence approved prices matched this cart yet.",
    "This may miss cheaper approved reports that have not been verified yet."
  );
  const avoidCarefulResult = {
    ...splitResult,
    mode: "avoid_list_careful",
    label: "Avoid-list careful mode",
    explanation: "This uses approved price matches and adds stronger ingredient reminders. It does not verify ingredients or allergy safety.",
    tradeoff: "Always check the package label and manufacturer information before buying or eating."
  };
  const formatShoppingStop = (candidate) => {
    if (!candidate || !candidate.matches?.length) {
      return null;
    }

    return {
      store_id: candidate.store_id || candidate.store?.id || null,
      store_name: candidate.store_name || candidate.store?.name || "",
      matched_count: candidate.matched_count || candidate.matches.length,
      cart_count: cartItems.length,
      estimated_total: Number(Number(candidate.estimated_total ?? candidate.total ?? 0).toFixed(2)),
      summary: `${candidate.store_name || candidate.store?.name} has approved prices for ${candidate.matched_count || candidate.matches.length} of your ${cartItems.length} cart item${cartItems.length === 1 ? "" : "s"}.`,
      items: candidate.matches.map((match) => ({
        cart_item: match.cart_item,
        report: match.report
      }))
    };
  };
  const firstStop = formatShoppingStop(bestSingleStore);
  const secondStop = formatShoppingStop(bestSecondStore);
  const matchedByFirstAndSecond = new Set([
    ...(firstStop?.items || []),
    ...(secondStop?.items || [])
  ].map((match) => cartItemKey(match.cart_item)));
  const remainingAfterStops = cartItems
    .map(formatCartItem)
    .filter((item) => !matchedByFirstAndSecond.has(cartItemKey(item)));
  const itemByItemSavings = singleResult.estimated_total > splitResult.estimated_total
    ? Number((singleResult.estimated_total - splitResult.estimated_total).toFixed(2))
    : 0;
  const shoppingPlan = {
    label: "Estimated from approved prices only.",
    best_first_stop: firstStop,
    second_best_store: secondStop,
    remaining_items: remainingAfterStops,
    missing_price_items: missingItems,
    missing_price_count: missingItems.length,
    cheapest_item_breakdown: splitResult.store_breakdown,
    estimated_savings: itemByItemSavings,
    summary: firstStop
      ? `${firstStop.store_name} should be your first stop based on approved prices for ${firstStop.matched_count} of ${cartItems.length} cart item${cartItems.length === 1 ? "" : "s"}.`
      : "Add items with approved prices to get a first-stop recommendation.",
    warning: "Do not treat totals as complete when items are missing prices."
  };

  return {
    explanation: "Based on recent approved user reports.",
    allergy_warning: "Ingredient alerts are a helper only. Always check the package label before buying or eating. Grocery Radar cannot guarantee allergy safety.",
    avoid_ingredients: avoidList,
    items: cartItems.map(formatCartItem),
    selected_mode: "cheapest_split",
    modes: {
      cheapest_split: splitResult,
      best_one_store: singleResult,
      best_balance: balanceResult,
      high_confidence: highConfidenceResult,
      avoid_list_careful: avoidCarefulResult
    },
    cheapest_split_cart: splitResult,
    best_single_store_match: bestSingleStore || {
      store_id: null,
      store_name: "",
      matched_count: 0,
      estimated_total: 0,
      matches: [],
      missing_items: cartItems.map(formatCartItem)
    },
    best_one_store_trip: singleResult,
    best_balance: balanceResult,
    high_confidence_only: highConfidenceResult,
    avoid_list_careful: avoidCarefulResult,
    shopping_plan: shoppingPlan
  };
}

function deleteUploadedFile(photoPath) {
  if (!photoPath) {
    return;
  }

  const filename = path.basename(String(photoPath).replace(/^\/uploads\//, ""));
  const fullPath = path.join(UPLOAD_DIR, filename);

  if (fullPath.startsWith(UPLOAD_DIR) && fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

function uploadedFileUrl(filename) {
  return `/uploads/${filename}`;
}

function uploadPathFromPhotoPath(photoPath) {
  const filename = path.basename(String(photoPath || "").replace(/^\/uploads\//, ""));
  const fullPath = path.join(UPLOAD_DIR, filename);

  if (!filename || !fullPath.startsWith(UPLOAD_DIR) || !fs.existsSync(fullPath)) {
    return "";
  }

  return fullPath;
}

function uploadFilenameFromParam(value) {
  const rawFilename = String(value || "");
  const filename = path.basename(rawFilename);
  const extension = path.extname(filename).toLowerCase();

  if (!filename || filename !== rawFilename || !ALLOWED_IMAGE_UPLOADS[extension]) {
    return "";
  }

  return filename;
}

function sendUploadFileByFilename(filename, response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.sendFile(path.join(UPLOAD_DIR, filename), (error) => {
    if (error && !response.headersSent) {
      response.status(error.statusCode || 404).send("Upload not found.");
    }
  });
}

async function sendPublicUploadFile(request, response) {
  const filename = uploadFilenameFromParam(request.params.filename);

  if (!filename) {
    response.status(404).send("Upload not found.");
    return;
  }
  // Originals under /uploads are moderation evidence, never public artwork.
  // Approved public product derivatives are served only by the ID-based
  // /api/product-images route after image moderation.
  response.status(404).send("Upload not found.");
}

async function sendAdminUploadFile(request, response) {
  const filename = uploadFilenameFromParam(request.params.filename);

  if (!filename) {
    response.status(404).send("Upload not found.");
    return;
  }

  sendUploadFileByFilename(filename, response);
}

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function isBootstrapSuperAdminIdentity(user = {}) {
  return normalizedEmail(user.email) === OWNER_EMAIL &&
    normalizedUsername(user.username) === OWNER_USERNAME;
}

function isOwnerAccount(user) {
  return isBootstrapSuperAdminIdentity(user);
}

function isSuperAdminAccount(user = {}) {
  return Boolean(user?.is_super_admin) && isOwnerAccount(user);
}

function staffRoleForUser(user = {}) {
  if (isSuperAdminAccount(user) || isOwnerAccount(user)) return "owner";
  const stored = String(user.staff_role || "").trim().toLowerCase();
  if (["manager", "reviewer", "data_entry"].includes(stored)) return stored;
  return user.is_admin ? "manager" : "user";
}

function staffCan(user, permission) {
  const role = staffRoleForUser(user);
  const permissions = {
    owner: ["manage", "review", "approve", "draft", "workers", "operations", "backup"],
    manager: ["manage", "review", "approve", "draft", "workers"],
    reviewer: ["review", "approve", "draft"],
    data_entry: ["review", "draft"],
    user: []
  };
  return (permissions[role] || []).includes(permission);
}

function workPreferencesForUser(user = {}) {
  const allowed = ["larger_text", "focus_mode", "reduced_motion", "keyboard_first", "high_contrast", "quiet_notifications", "one_task_at_a_time"];
  const parsed = parseMetadataJson(user.work_preferences_json);
  return Object.fromEntries(allowed.map((key) => [key, Boolean(parsed[key])]));
}

function envFlagEnabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function pathIsInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertOwnerRepairRuntimeDatabase() {
  if (!process.env.DATA_DIR) {
    throw new Error("OWNER_REPAIR_ON_START requires DATA_DIR to point at the persistent database directory.");
  }

  const resolvedDataDir = path.resolve(DATA_DIR);
  const resolvedDbPath = path.resolve(DB_PATH);

  if (!DATA_DIR_EXISTED_AT_START || !fs.existsSync(resolvedDataDir) || !fs.statSync(resolvedDataDir).isDirectory()) {
    throw new Error("OWNER_REPAIR_ON_START refused to run because DATA_DIR does not exist.");
  }

  if (!pathIsInside(resolvedDataDir, resolvedDbPath)) {
    throw new Error("OWNER_REPAIR_ON_START refused to run because DB_PATH is outside DATA_DIR.");
  }

  if (!DB_FILE_EXISTED_AT_START || !fs.existsSync(resolvedDbPath) || !fs.statSync(resolvedDbPath).isFile()) {
    throw new Error("OWNER_REPAIR_ON_START refused to run because the SQLite database file does not exist.");
  }

  try {
    fs.accessSync(resolvedDataDir, fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(resolvedDbPath, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    throw new Error("OWNER_REPAIR_ON_START refused to run because the SQLite database is not writable.");
  }

  return { resolvedDataDir, resolvedDbPath };
}

function compactStartupRepairOutput(output) {
  return {
    ok: Boolean(output?.ok),
    applied: Boolean(output?.applied),
    conflict_category: output?.conflict_category || "unknown",
    preserved_account_id: output?.preserved_account_id || output?.preserved_account?.id || null,
    username_changed: Boolean(output?.username_changed || output?.changes?.username_changed),
    email_changed: Boolean(output?.email_changed || output?.changes?.email_changed),
    owner_status_changed: Boolean(output?.owner_status_changed || output?.changes?.owner_status_changed),
    audit_entry_succeeded: Boolean(output?.audit_entry_succeeded || output?.audit?.admin_audit_log_id),
    message: output?.message || null
  };
}

async function runOwnerRepairOnStartIfEnabled() {
  if (!envFlagEnabled(process.env.OWNER_REPAIR_ON_START)) {
    return;
  }

  const { resolvedDataDir, resolvedDbPath } = assertOwnerRepairRuntimeDatabase();
  const repairScriptPath = path.join(__dirname, "scripts", "repair-owner-identity.js");
  const repair = childProcess.spawnSync(
    process.execPath,
    [repairScriptPath, "--apply", "--startup"],
    {
      cwd: __dirname,
      env: {
        ...process.env,
        DATA_DIR: resolvedDataDir,
        DB_PATH: resolvedDbPath
      },
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }
  );

  let parsedOutput = null;
  const rawOutput = String(repair.stdout || repair.stderr || "").trim();

  if (rawOutput) {
    try {
      parsedOutput = JSON.parse(rawOutput);
    } catch {
      parsedOutput = {
        ok: false,
        applied: false,
        conflict_category: "owner_repair_unparseable_output",
        message: "Owner startup repair returned output that could not be parsed."
      };
    }
  }

  console.log("OWNER_REPAIR_ON_START result:");
  console.log(JSON.stringify(compactStartupRepairOutput(parsedOutput), null, 2));

  if (repair.status !== 0) {
    throw new Error(`OWNER_REPAIR_ON_START failed with exit status ${repair.status}. Strict startup validation was not bypassed.`);
  }

  console.warn("OWNER_REPAIR_ON_START is enabled and must now be removed from Render.");
}

async function applyBootstrapSuperAdminFlags(user) {
  if (!user || !user.id) {
    return user;
  }

  if (!isOwnerAccount(user)) {
    return user;
  }

  await run(
    `
      UPDATE users
      SET is_admin = 1,
          is_super_admin = 1
      WHERE id = ?
    `,
    [user.id]
  );

  return get("SELECT * FROM users WHERE id = ?", [user.id]);
}

async function ensureBootstrapSuperAdmin() {
  const ownerAccounts = await all(
    `
      SELECT *
      FROM users
      WHERE lower(COALESCE(email, '')) = lower(?)
        AND lower(COALESCE(username, '')) = lower(?)
      ORDER BY id ASC
    `,
    [OWNER_EMAIL, OWNER_USERNAME]
  );

  if (!ownerAccounts.length) {
    throw new Error(
      "Owner identity conflict: no single account has both email juricbu@gmail.com and username elcastilo. Resolve this manually before deployment."
    );
  }

  if (ownerAccounts.length > 1) {
    throw new Error(
      "Owner identity conflict: multiple accounts match the required owner email and username. Resolve duplicates manually before deployment."
    );
  }

  const owner = ownerAccounts[0];
  const relatedIdentityAccounts = await all(
    `
      SELECT id, username, email, is_super_admin
      FROM users
      WHERE id != ?
        AND (
          lower(COALESCE(email, '')) = lower(?)
          OR lower(COALESCE(username, '')) = lower(?)
        )
      ORDER BY id ASC
    `,
    [owner.id, OWNER_EMAIL, OWNER_USERNAME]
  );

  if (relatedIdentityAccounts.length) {
    throw new Error(
      "Owner identity conflict: another account uses the protected owner email or username. Resolve this manually before deployment."
    );
  }

  const superAdminAccounts = await all(
    "SELECT id, username, email FROM users WHERE is_super_admin = 1 ORDER BY id ASC"
  );
  const conflictingSuperAdmins = superAdminAccounts.filter((account) => Number(account.id) !== Number(owner.id));

  if (conflictingSuperAdmins.length) {
    throw new Error(
      "Owner identity conflict: another account is already marked Super Admin. Resolve this manually before deployment."
    );
  }

  const updatedOwner = await applyBootstrapSuperAdminFlags(owner);

  await run(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_super_admin ON users(is_super_admin) WHERE is_super_admin = 1"
  );

  return updatedOwner;
}

async function markVerificationEmailSent(userId) {
  await run(
    `
      UPDATE users
      SET verification_email_last_sent_at = ?,
          verification_email_send_count = COALESCE(verification_email_send_count, 0) + 1
      WHERE id = ?
    `,
    [new Date().toISOString(), userId]
  );
}

function secondsUntilVerificationResendAllowed(user) {
  if (!user?.verification_email_last_sent_at) {
    return 0;
  }

  const lastSentMs = new Date(user.verification_email_last_sent_at).getTime();

  if (!Number.isFinite(lastSentMs)) {
    return 0;
  }

  const elapsedSeconds = Math.floor((Date.now() - lastSentMs) / 1000);
  return Math.max(0, VERIFICATION_RESEND_COOLDOWN_SECONDS - elapsedSeconds);
}

function requestIpAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return cleanText(forwarded || request.ip || request.socket?.remoteAddress || "", 80);
}

function requestUserAgent(request) {
  return cleanText(request.headers["user-agent"] || "", 300);
}

function metadataJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch (error) {
    return "{}";
  }
}

function parseMetadataJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return {};
  }
}

function statusIndicator(status, label, details = {}) {
  return {
    status,
    label,
    ...details
  };
}

function cleanEnum(value, allowed, fallback) {
  const cleaned = cleanText(value, 80).toLowerCase();
  return allowed.includes(cleaned) ? cleaned : fallback;
}

function cleanFeedbackCategory(value) {
  return cleanEnum(value, FEEDBACK_CATEGORIES, "other");
}

function cleanFeedbackStatus(value) {
  return cleanEnum(value, FEEDBACK_STATUSES, "open");
}

function cleanFeedbackPriority(value) {
  return cleanEnum(value, FEEDBACK_PRIORITIES, "normal");
}

function cleanFeatureVoteStatus(value) {
  return cleanEnum(value, FEATURE_VOTE_STATUSES, "active");
}

function cleanAnnouncementType(value) {
  return cleanEnum(value, ANNOUNCEMENT_TYPES, "known_issue");
}

function cleanAnnouncementStatus(value) {
  return cleanEnum(value, ANNOUNCEMENT_STATUSES, "draft");
}

function currentVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    return packageJson.version || "";
  } catch (error) {
    return "";
  }
}

function currentCommitHash() {
  const envCommit = cleanText(
    process.env.RENDER_GIT_COMMIT ||
      process.env.GIT_COMMIT ||
      process.env.SOURCE_VERSION ||
      "",
    80
  );

  if (envCommit) {
    return envCommit;
  }

  try {
    return childProcess
      .execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        cwd: __dirname,
        encoding: "utf8",
        timeout: 1000
      })
      .trim();
  } catch (error) {
    return "";
  }
}

function dateWindowStarts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() - 6);
  const month = new Date(today);
  month.setDate(month.getDate() - 29);

  return {
    todayStart: today.toISOString(),
    weekStart: week.toISOString(),
    monthStart: month.toISOString()
  };
}

async function recordLoginEvent(request, user, success = true) {
  if (!user?.id) {
    return;
  }

  await run(
    `
      INSERT INTO user_login_events (user_id, success, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [user.id, success ? 1 : 0, requestIpAddress(request), requestUserAgent(request), new Date().toISOString()]
  );
}

async function recordEmailVerificationEvent(request, user, eventType) {
  if (!user?.id) {
    return;
  }

  await run(
    `
      INSERT INTO email_verification_events (user_id, event_type, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      user.id,
      cleanText(eventType || "verification_event", 80),
      requestIpAddress(request),
      requestUserAgent(request),
      new Date().toISOString()
    ]
  );
}

async function recordOperationsError(input = {}) {
  const message = cleanText(input.message || "Operation failed.", 500);

  if (!message) {
    return;
  }

  try {
    await run(
      `
        INSERT INTO operations_errors (
          error_type,
          severity,
          message,
          source,
          related_type,
          related_id,
          status,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        cleanText(input.error_type || input.errorType || "system_error", 80),
        cleanEnum(input.severity, ["info", "warning", "critical"], "warning"),
        message,
        cleanText(input.source || "", 120),
        cleanText(input.related_type || input.relatedType || "", 80),
        Number.isInteger(Number(input.related_id || input.relatedId)) ? Number(input.related_id || input.relatedId) : null,
        cleanText(input.status || "open", 40),
        metadataJson(input.metadata || {}),
        new Date().toISOString()
      ]
    );
  } catch (error) {
    console.warn(`Operations error log skipped: ${error.message}`);
  }
}

async function recordAdminAudit(input = {}) {
  try {
    await run(
      `
        INSERT INTO admin_audit_log (
          admin_user_id,
          action,
          method,
          path,
          status_code,
          ip_address,
          user_agent,
          affected_type,
          affected_id,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.admin_user_id || input.adminUserId || null,
        cleanText(input.action || "admin_action", 160),
        cleanText(input.method || "", 12),
        cleanText(input.path || "", 240),
        Number.isInteger(Number(input.status_code || input.statusCode)) ? Number(input.status_code || input.statusCode) : null,
        cleanText(input.ip_address || input.ipAddress || "", 80),
        cleanText(input.user_agent || input.userAgent || "", 300),
        cleanText(input.affected_type || input.affectedType || "", 80),
        Number.isInteger(Number(input.affected_id || input.affectedId)) ? Number(input.affected_id || input.affectedId) : null,
        metadataJson(input.metadata || {}),
        new Date().toISOString()
      ]
    );
  } catch (error) {
    console.warn(`Admin audit log skipped: ${error.message}`);
  }
}

function adminAuditMiddleware(request, response, next) {
  const method = String(request.method || "GET").toUpperCase();

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    next();
    return;
  }

  response.on("finish", () => {
    if (response.statusCode < 200 || response.statusCode >= 400) {
      return;
    }

    recordAdminAudit({
      adminUserId: request.adminUser?.id || null,
      action: `${method} ${request.path}`,
      method,
      path: request.originalUrl || request.path,
      statusCode: response.statusCode,
      ipAddress: requestIpAddress(request),
      userAgent: requestUserAgent(request),
      metadata: {
        via_pin: Boolean(request.adminAccessViaPin),
        super_admin: Boolean(request.adminUser && isSuperAdminAccount(request.adminUser))
      }
    });
  });

  next();
}

function testAccountReason(user = {}) {
  const text = `${user.username || ""} ${user.email || ""}`.toLowerCase();
  const patterns = [
    ["test", "test/dev name"],
    ["example.com", "example.com email"],
    ["demo", "demo name"],
    ["fake", "fake/dev name"],
    ["scratch", "scratch/dev name"],
    ["mvp", "MVP test name"],
    ["proofuser", "proof test name"],
    ["teststaff", "test staff name"],
    ["nodemailer", "email test name"]
  ];
  const match = patterns.find(([pattern]) => text.includes(pattern));

  return match ? match[1] : "";
}

function adminRoleForUser(user = {}) {
  if (isSuperAdminAccount(user) || isOwnerAccount(user)) return "super admin";
  if (user.is_admin) return "admin";
  const text = `${user.username || ""} ${user.email || ""} ${user.admin_note || ""}`.toLowerCase();
  if (["admin", "staff", "owner", "moderator", "reviewer"].some((term) => text.includes(term))) return "staff-like user";
  return "user";
}

function adminCapableWhereClause() {
  return `
    users.is_admin = 1
    OR users.is_super_admin = 1
    OR lower(users.username) LIKE '%admin%'
    OR lower(users.username) LIKE '%staff%'
    OR lower(users.username) LIKE '%owner%'
    OR lower(COALESCE(users.email, '')) LIKE '%admin%'
    OR lower(COALESCE(users.email, '')) LIKE '%staff%'
    OR lower(COALESCE(users.email, '')) LIKE '%owner%'
    OR lower(COALESCE(users.admin_note, '')) LIKE '%admin%'
    OR lower(COALESCE(users.admin_note, '')) LIKE '%staff%'
    OR lower(COALESCE(users.admin_note, '')) LIKE '%owner%'
  `;
}

async function adminAccountAuditRows() {
  const rows = await all(
    `
      SELECT
        users.id,
        users.username,
        users.email,
        users.is_admin,
        users.is_super_admin,
        users.account_status,
        users.is_email_verified,
        users.created_at,
        users.last_activity_at,
        users.last_seen_at,
        users.admin_note,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE price_reports.user_id = users.id
        ) AS report_count,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE price_reports.user_id = users.id
            AND price_reports.status = 'approved'
        ) AS approved_report_count,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE price_reports.reviewed_by = users.id
        ) AS reviewed_report_count,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE price_import_batches.created_by = users.id
        ) AS import_batch_count,
        (
          SELECT COUNT(*)
          FROM price_import_rows
          WHERE price_import_rows.approved_by = users.id
        ) AS approved_import_row_count,
        (
          SELECT COUNT(*)
          FROM point_events
          WHERE point_events.user_id = users.id
        ) AS point_event_count,
        (
          SELECT COUNT(*)
          FROM point_events
          WHERE point_events.created_by_admin_id = users.id
        ) AS admin_point_event_count
      FROM users
      WHERE ${adminCapableWhereClause()}
      ORDER BY users.is_admin DESC, users.id ASC
    `
  );

  return rows.map((row) => {
    const testReason = testAccountReason(row);
    const lastActive = row.last_activity_at || row.last_seen_at || "";

    return {
      id: row.id,
      username: row.username,
      email: row.email || "",
      role: adminRoleForUser(row),
      is_owner: isOwnerAccount(row),
      is_super_admin: isSuperAdminAccount(row),
      is_admin: Boolean(row.is_admin),
      admin_capable: Boolean(row.is_admin || isSuperAdminAccount(row)),
      account_status: row.account_status || "active",
      email_verified: Boolean(row.is_email_verified),
      created_at: row.created_at,
      last_active_at: lastActive,
      is_test_or_dev: Boolean(testReason),
      test_or_dev_reason: testReason,
      counts: {
        reports: row.report_count || 0,
        approved_reports: row.approved_report_count || 0,
        reviewed_reports: row.reviewed_report_count || 0,
        import_batches: row.import_batch_count || 0,
        approved_import_rows: row.approved_import_row_count || 0,
        point_events: row.point_event_count || 0,
        admin_point_events: row.admin_point_event_count || 0
      },
      has_price_or_reward_history: Boolean(
        row.approved_report_count ||
        row.reviewed_report_count ||
        row.import_batch_count ||
        row.approved_import_row_count ||
        row.point_event_count ||
        row.admin_point_event_count
      ),
      admin_note: row.admin_note || ""
    };
  });
}

async function adminAccountAuditSummary() {
  const accounts = await adminAccountAuditRows();
  const adminCapableAccounts = accounts.filter((account) => account.admin_capable);
  const activeAdminCapableAccounts = adminCapableAccounts.filter((account) =>
    !["banned", "deleted", "deactivated", "suspended"].includes(account.account_status || "active")
  );
  const ownerAccount = accounts.find((account) => account.is_super_admin || account.is_owner) || null;

  return {
    owner_identity_configured: Boolean(OWNER_EMAIL && OWNER_USERNAME),
    owner_username: OWNER_USERNAME,
    admin_capable_count: adminCapableAccounts.length,
    super_admin_count: accounts.filter((account) => account.is_super_admin).length,
    active_admin_capable_count: activeAdminCapableAccounts.length,
    staff_like_count: accounts.filter((account) => account.role === "staff-like user").length,
    test_or_dev_count: accounts.filter((account) => account.is_test_or_dev).length,
    owner_account: ownerAccount,
    multiple_admins: adminCapableAccounts.length > 1,
    cleanup_needed: adminCapableAccounts.length > 1 || !ownerAccount,
    recommendation: ownerAccount
      ? `Keep ${ownerAccount.username} as Owner / Super Admin unless you choose otherwise.`
      : "The required Owner account was not found. Resolve the owner identity before changing admin access.",
    accounts
  };
}

async function activeAdminCountExcluding(userId) {
  const row = await get(
    `
      SELECT COUNT(*) AS count
      FROM users
      WHERE is_admin = 1
        AND id != ?
        AND COALESCE(account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated', 'suspended')
    `,
    [userId]
  );

  return row.count || 0;
}

async function appendAdminRoleAuditNote({ targetUserId, adminUserId, note, noteType = "admin_role_change" }) {
  const cleanNote = cleanText(note, 1000);

  if (!targetUserId || !cleanNote) {
    return;
  }

  await run(
    `
      INSERT INTO user_admin_notes (user_id, admin_user_id, note_type, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [targetUserId, adminUserId || null, noteType, cleanNote, new Date().toISOString()]
  );
  await run("UPDATE users SET admin_note = ? WHERE id = ?", [cleanNote, targetUserId]);
}

function generateTemporaryPassword() {
  const token = crypto
    .randomBytes(15)
    .toString("base64")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 18);

  return `GRJ-${token}`;
}

async function getAdminNotificationSummary() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.toISOString();
  const week = new Date(today);
  week.setDate(week.getDate() - 6);
  const weekStart = week.toISOString();
  const activeFiveStart = new Date(Date.now() - 1000 * 60 * 5).toISOString();
  const activeFifteenStart = new Date(Date.now() - 1000 * 60 * 15).toISOString();

  const row = await get(
    `
      SELECT
        (SELECT COUNT(*) FROM price_reports WHERE status = 'pending') AS pending_reviews,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE status = 'approved'
            AND reviewed_at >= ?
        ) AS reports_approved_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS new_users_today,
        (SELECT COUNT(*) FROM price_reports WHERE submitted_at >= ?) AS reports_submitted_today,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE status = 'rejected'
            AND reviewed_at >= ?
        ) AS reports_rejected_today,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE status = 'pending'
            AND proof_type IN ('shelf_tag_photo', 'receipt_photo', 'weekly_ad')
            AND (photo_path IS NULL OR photo_path = '')
        ) AS reports_needing_proof,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE status = 'disputed'
             OR dispute_count > 0
        ) AS flagged_disputed_reports,
        (
          SELECT COUNT(*)
          FROM users
          WHERE account_status IN ('banned', 'suspended')
        ) AS banned_suspended_users,
        (
          SELECT COUNT(*)
          FROM users
          WHERE last_seen_at >= ?
            AND COALESCE(account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated')
        ) AS active_users_now,
        (
          SELECT COUNT(*)
          FROM users
          WHERE last_seen_at >= ?
            AND COALESCE(account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated')
        ) AS active_users_15_min,
        (
          SELECT COUNT(*)
          FROM users
          WHERE last_seen_at >= ?
            AND COALESCE(account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated')
        ) AS users_seen_today,
        (
          SELECT COUNT(*)
          FROM users
        ) AS total_registered_users,
        (
          SELECT COUNT(*)
          FROM store_requests
          WHERE status = 'pending'
        ) AS pending_store_requests,
        (
          SELECT COUNT(*)
          FROM suggestions
          WHERE status = 'pending'
        ) AS pending_suggestions,
        (
          SELECT COUNT(*)
          FROM users
          WHERE account_status IN ('warning', 'suspended')
             OR is_email_verified = 0
        ) AS users_needing_review,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE status = 'approved'
        ) AS public_approved_prices,
        (
          SELECT COUNT(DISTINCT product_id)
          FROM price_reports
          WHERE status = 'approved'
            AND product_id IS NOT NULL
        ) AS public_approved_products,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE product_id IS NULL
            AND status IN ('pending', 'approved')
        ) AS unlinked_reports,
        (
          SELECT COUNT(*)
          FROM sponsors
          WHERE status = 'active'
        ) AS active_sponsor_cards,
        (
          SELECT COUNT(*)
          FROM missing_price_priorities
          WHERE status IN ('priority', 'manual_price_needed', 'suggested_quick_item')
        ) AS missing_price_demand,
        (
          SELECT COUNT(*)
          FROM users
          WHERE is_admin = 1
        ) AS admin_accounts,
        (
          SELECT COUNT(DISTINCT users.id)
          FROM users
          WHERE COALESCE(users.account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated')
            AND (
              EXISTS (SELECT 1 FROM price_reports WHERE price_reports.user_id = users.id AND price_reports.status = 'approved')
              OR EXISTS (
                SELECT 1
                FROM price_import_batches batches
                JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
                WHERE batches.created_by = users.id
              )
            )
        ) AS active_contributors,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status IN ('needs_admin_review', 'waiting_for_review', 'accepted_for_review')
        ) AS pending_proofs,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status = 'needs_clearer_photo'
        ) AS needs_clearer_photo_proofs,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status IN ('proof_rejected', 'rejected')
        ) AS rejected_proofs,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND (status = 'duplicate' OR COALESCE(duplicate_scope, '') != '')
        ) AS duplicate_flagged_proofs,
        (
          SELECT COUNT(DISTINCT batches.id)
          FROM price_import_batches batches
          JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
          WHERE batches.notes LIKE ?
        ) AS proofs_used_for_prices,
        (
          SELECT COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0)
          FROM point_events
          WHERE created_at >= ?
        ) AS points_awarded_this_week
    `,
    [
      todayStart,
      todayStart,
      todayStart,
      todayStart,
      activeFiveStart,
      activeFifteenStart,
      todayStart,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      weekStart
    ]
  );
  const adminAudit = await adminAccountAuditSummary();

  const pendingReviews = row.pending_reviews || 0;
  const currentEmailStatus = emailStatus();
  const lastDiagnostic = getLastEmailDiagnostic();
  const adminNotificationRows = await all(
    `
      SELECT *
      FROM notifications
      WHERE admin_only = 1
      ORDER BY created_at DESC
      LIMIT 25
    `
  );

  return {
    pending_reviews: pendingReviews,
    reports_approved_today: row.reports_approved_today || 0,
    new_users_today: row.new_users_today || 0,
    reports_submitted_today: row.reports_submitted_today || 0,
    reports_rejected_today: row.reports_rejected_today || 0,
    reports_needing_proof: row.reports_needing_proof || 0,
    flagged_disputed_reports: row.flagged_disputed_reports || 0,
    banned_suspended_users: row.banned_suspended_users || 0,
    active_users_now: row.active_users_now || 0,
    active_users_15_min: row.active_users_15_min || 0,
    users_seen_today: row.users_seen_today || 0,
    total_registered_users: row.total_registered_users || 0,
    pending_store_requests: row.pending_store_requests || 0,
    pending_suggestions: row.pending_suggestions || 0,
    users_needing_review: row.users_needing_review || 0,
    public_approved_prices: row.public_approved_prices || 0,
    public_approved_products: row.public_approved_products || 0,
    unlinked_reports: row.unlinked_reports || 0,
    active_sponsor_cards: row.active_sponsor_cards || 0,
    missing_price_demand: row.missing_price_demand || 0,
    pending_proofs: row.pending_proofs || 0,
    active_contributors: row.active_contributors || 0,
    admin_accounts: row.admin_accounts || 0,
    duplicate_flagged_proofs: row.duplicate_flagged_proofs || 0,
    needs_clearer_photo_proofs: row.needs_clearer_photo_proofs || 0,
    rejected_proofs: row.rejected_proofs || 0,
    points_awarded_this_week: row.points_awarded_this_week || 0,
    proofs_used_for_prices: row.proofs_used_for_prices || 0,
    admin_cleanup_warning: adminAudit.multiple_admins
      ? "Multiple admin accounts found. Review Admin Access Cleanup."
      : "",
    admin_account_audit: {
      admin_capable_count: adminAudit.admin_capable_count,
      active_admin_capable_count: adminAudit.active_admin_capable_count,
      cleanup_needed: adminAudit.cleanup_needed,
      recommendation: adminAudit.recommendation
    },
    email_configured: currentEmailStatus.configured,
    last_email_diagnostic: lastDiagnostic,
    unread_admin_notifications: adminNotificationRows.filter((notification) => !notification.is_read).length,
    recent_admin_notifications: adminNotificationRows.map(formatNotification),
    admin_alert_label: `${pendingReviews} pending review${pendingReviews === 1 ? "" : "s"}`
  };
}

function fileExistsInPublic(filename) {
  return fs.existsSync(path.join(PUBLIC_DIR, filename));
}

function betaAction(label, type, target) {
  return { label, type, target };
}

function lastEmailDiagnosticPassed(diagnostic) {
  return Boolean(diagnostic && diagnostic.verify?.ok && diagnostic.send?.ok);
}

async function tableExists(tableName) {
  const row = await get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );

  return Boolean(row);
}

async function getBetaReadinessSummary() {
  const currentEmailStatus = emailStatus();
  const lastDiagnostic = getLastEmailDiagnostic();
  const productsTableExists = await tableExists("products");
  const cartItemsTableExists = await tableExists("cart_items");
  const storeRequestsTableExists = await tableExists("store_requests");
  const suggestionsTableExists = await tableExists("suggestions");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.toISOString();
  const reportCounts = await get(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END) AS removed,
        SUM(CASE WHEN status = 'disputed' OR dispute_count > 0 THEN 1 ELSE 0 END) AS disputed,
        SUM(CASE WHEN status = 'needs_proof' THEN 1 ELSE 0 END) AS needs_proof,
        SUM(CASE WHEN submitted_at >= ? THEN 1 ELSE 0 END) AS submitted_today
      FROM price_reports
    `,
    [todayStart]
  );
  const adminCounts = await get(
    `
      SELECT
        SUM(CASE WHEN is_admin = 1 THEN 1 ELSE 0 END) AS admin_count,
        SUM(CASE WHEN lower(email) = lower(?) AND lower(username) = lower(?) AND is_admin = 1 AND is_super_admin = 1 THEN 1 ELSE 0 END) AS target_admin,
        SUM(CASE WHEN lower(email) = lower(?) AND lower(username) = lower(?) AND is_admin = 1 AND is_super_admin = 1 AND is_email_verified = 1 THEN 1 ELSE 0 END) AS target_admin_verified
      FROM users
      WHERE COALESCE(account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated')
    `,
    [OWNER_EMAIL, OWNER_USERNAME, OWNER_EMAIL, OWNER_USERNAME]
  );
  const userCounts = await get(
    `
      SELECT
        COUNT(*) AS users,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_users_today,
        SUM(CASE WHEN account_status IN ('banned', 'suspended') THEN 1 ELSE 0 END) AS banned_suspended
      FROM users
    `,
    [todayStart]
  );
  const productCounts = productsTableExists
    ? await get(
        `
          SELECT
            COUNT(*) AS products,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN status IN ('hidden', 'merged') THEN 1 ELSE 0 END) AS hidden_merged,
            SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review
          FROM products
        `
      )
    : { products: 0, active: 0, hidden_merged: 0, needs_review: 0 };
  const unlinkedCounts = await get(
    `
      SELECT COUNT(*) AS unlinked_reports
      FROM price_reports
      WHERE product_id IS NULL
        AND status IN ('pending', 'approved')
    `
  );
  const storeCounts = await get(
    `
      SELECT
        COUNT(*) AS stores,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS inactive
      FROM stores
    `
  );
  const pendingStoreRequests = storeRequestsTableExists
    ? await get("SELECT COUNT(*) AS count FROM store_requests WHERE status = 'pending'")
    : { count: 0 };
  const pendingSuggestions = suggestionsTableExists
    ? await get("SELECT COUNT(*) AS count FROM suggestions WHERE status = 'pending'")
    : { count: 0 };
  const cartCounts = cartItemsTableExists
    ? await get("SELECT COUNT(*) AS cart_items FROM cart_items")
    : { cart_items: 0 };
  const proofCounts = await get(
    `
      SELECT
        COUNT(*) AS proof_submissions,
        SUM(CASE WHEN status IN ('needs_admin_review', 'waiting_for_review', 'accepted_for_review') THEN 1 ELSE 0 END) AS pending_proofs,
        SUM(CASE WHEN status IN ('accepted_for_review', 'proof_reviewed', 'reviewed_no_prices', 'used_for_prices') THEN 1 ELSE 0 END) AS accepted_proofs,
        SUM(CASE WHEN status = 'needs_clearer_photo' THEN 1 ELSE 0 END) AS needs_clearer_photo,
        SUM(CASE WHEN status IN ('proof_rejected', 'rejected') THEN 1 ELSE 0 END) AS rejected_proofs,
        SUM(CASE WHEN status = 'duplicate' OR COALESCE(duplicate_scope, '') != '' THEN 1 ELSE 0 END) AS duplicate_proofs
      FROM price_import_batches
      WHERE notes LIKE ?
    `,
    [`${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );
  const proofRowsUsed = await get(
    `
      SELECT COUNT(DISTINCT batches.id) AS proofs_used_for_prices
      FROM price_import_batches batches
      JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
      WHERE batches.notes LIKE ?
    `,
    [`${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );
  const pointCounts = await get(
    `
      SELECT
        COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) AS points_awarded_total,
        COALESCE(SUM(CASE WHEN points > 0 AND created_at >= ? THEN points ELSE 0 END), 0) AS points_awarded_this_week
      FROM point_events
    `,
    [new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()]
  );
  const publicDataHealth = await get(
    `
      SELECT
        (SELECT COUNT(*) FROM price_reports WHERE status = 'approved') AS approved_prices,
        (SELECT COUNT(DISTINCT product_id) FROM price_reports WHERE status = 'approved' AND product_id IS NOT NULL) AS products_with_prices,
        (SELECT COUNT(DISTINCT store_id) FROM price_reports WHERE status = 'approved') AS stores_with_prices
    `
  );
  const usernameModerationCounts = await get(
    `
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN username_status = 'needs_change' OR force_username_change = 1 THEN 1 ELSE 0 END) AS usernames_need_change,
        SUM(CASE WHEN hide_from_leaderboard = 1 THEN 1 ELSE 0 END) AS hidden_from_leaderboard
      FROM users
    `
  );
  const fakeCheck = await get(
    `
      SELECT
        (
          SELECT COUNT(*)
          FROM users
          WHERE lower(username) LIKE '%scratch%'
             OR lower(username) LIKE '%test%'
             OR lower(username) LIKE '%fake%'
             OR lower(username) LIKE '%demo%'
             OR lower(username) LIKE '%example%'
             OR lower(COALESCE(email, '')) LIKE '%scratch%'
             OR lower(COALESCE(email, '')) LIKE '%test%'
             OR lower(COALESCE(email, '')) LIKE '%fake%'
             OR lower(COALESCE(email, '')) LIKE '%demo%'
             OR lower(COALESCE(email, '')) LIKE '%example%'
        ) AS suspicious_users,
        (
          SELECT COUNT(*)
          FROM products
          WHERE lower(display_name) LIKE '%scratch%'
             OR lower(display_name) LIKE '%test%'
             OR lower(display_name) LIKE '%fake%'
             OR lower(display_name) LIKE '%demo%'
             OR lower(display_name) LIKE '%example%'
             OR lower(canonical_name) LIKE '%scratch%'
             OR lower(canonical_name) LIKE '%test%'
             OR lower(canonical_name) LIKE '%fake%'
             OR lower(canonical_name) LIKE '%demo%'
             OR lower(canonical_name) LIKE '%example%'
        ) AS suspicious_products,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE lower(item_name) LIKE '%scratch%'
             OR lower(item_name) LIKE '%test%'
             OR lower(item_name) LIKE '%fake%'
             OR lower(item_name) LIKE '%demo%'
             OR lower(item_name) LIKE '%example%'
             OR lower(COALESCE(brand, '')) LIKE '%scratch%'
             OR lower(COALESCE(brand, '')) LIKE '%test%'
             OR lower(COALESCE(brand, '')) LIKE '%fake%'
             OR lower(COALESCE(brand, '')) LIKE '%demo%'
             OR lower(COALESCE(brand, '')) LIKE '%example%'
        ) AS suspicious_reports
    `
  );
  const legalPages = [
    { label: "Privacy Policy", filename: "privacy.html", critical: true },
    { label: "Terms of Use", filename: "terms.html", critical: true },
    { label: "Price Disclaimer", filename: "price-disclaimer.html", critical: false },
    { label: "Photo Upload Rules", filename: "photo-rules.html", critical: false },
    { label: "Allergy Disclaimer", filename: "allergy-disclaimer.html", critical: false },
    { label: "Community Rules", filename: "community-rules.html", critical: false },
    { label: "Rewards Disclaimer", filename: "rewards-disclaimer.html", critical: false }
  ].map((page) => ({
    ...page,
    exists: fileExistsInPublic(page.filename),
    url: `/${page.filename}`
  }));
  const missingLegalPages = legalPages.filter((page) => !page.exists);
  const missingCriticalLegalPages = missingLegalPages.filter((page) => page.critical);
  const indexHtml = fs.existsSync(path.join(PUBLIC_DIR, "index.html"))
    ? fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8")
    : "";
  const allergyHtml = fs.existsSync(path.join(PUBLIC_DIR, "allergy-disclaimer.html"))
    ? fs.readFileSync(path.join(PUBLIC_DIR, "allergy-disclaimer.html"), "utf8")
    : "";
  const allergyPageExists = fileExistsInPublic("allergy-disclaimer.html");
  const publicAllergyText = `${indexHtml}\n${allergyHtml}`;
  const hasPackageLabelWording = /always check the package label/i.test(publicAllergyText);
  const hasForbiddenAllergyClaim = /\ballergy[- ]free\b|\bguaranteed safe\b|\bsafe for all allergies\b/i.test(publicAllergyText);
  const suspiciousDataTotal =
    (fakeCheck.suspicious_users || 0) +
    (fakeCheck.suspicious_products || 0) +
    (fakeCheck.suspicious_reports || 0);
  const checks = [];

  checks.push({
    id: "email",
    label: "Email sending",
    status: currentEmailStatus.configured
      ? lastEmailDiagnosticPassed(lastDiagnostic) ? "Ready" : lastDiagnostic ? "Critical" : "Warning"
      : "Critical",
    explanation: currentEmailStatus.configured
      ? lastEmailDiagnosticPassed(lastDiagnostic)
        ? "Email is configured and the last diagnostic passed."
        : lastDiagnostic
          ? "Email is configured, but the last diagnostic needs attention."
          : "Email is configured, but no diagnostic has run in this server session."
      : "Email setup is incomplete.",
    actions: [
      betaAction("Run email diagnostic", "diagnostic", "email"),
      betaAction("Go to Email / Diagnostics", "tab", "emailTab")
    ]
  });

  checks.push({
    id: "admin-account",
    label: "Admin account",
    status: (adminCounts.admin_count || 0) === 0
      ? "Critical"
      : (adminCounts.admin_count || 0) > 1 ? "Warning"
        : !adminCounts.target_admin ? "Warning"
          : adminCounts.target_admin && !adminCounts.target_admin_verified ? "Warning" : "Ready",
    explanation: (adminCounts.admin_count || 0) === 0
      ? "No admin user exists yet."
      : (adminCounts.admin_count || 0) > 1
        ? "Multiple admin accounts found. Review Admin Access Cleanup before beta."
        : !adminCounts.target_admin
          ? "One admin exists, but it does not match the configured owner email."
          : adminCounts.target_admin && !adminCounts.target_admin_verified
            ? "The owner admin exists. The owner admin email is not verified yet."
            : "Exactly one owner/admin account is active.",
    counts: {
      admins: adminCounts.admin_count || 0,
      required_owner_username: OWNER_USERNAME,
      owner_admin_present: Boolean(adminCounts.target_admin),
      owner_admin_email_verified: Boolean(adminCounts.target_admin_verified)
    },
    actions: [betaAction("Go to Users", "tab", "usersTab")]
  });

  checks.push({
    id: "public-report-safety",
    label: "Public report safety",
    status: "Ready",
    explanation: "Public search and product routes use approved-only report filters. Pending, rejected, removed, and expired reports stay out of public results.",
    counts: {
      pending: reportCounts.pending || 0,
      approved: reportCounts.approved || 0,
      rejected: reportCounts.rejected || 0,
      removed: reportCounts.removed || 0
    },
    actions: [
      betaAction("Go to Review Queue", "tab", "reviewTab"),
      betaAction("Go to Prices", "tab", "pricesTab")
    ]
  });

  checks.push({
    id: "photo-upload-safety",
    label: "Photo upload safety",
    status: fs.existsSync(UPLOAD_DIR) ? "Ready" : "Warning",
    explanation: "Uploads are restricted to JPG, PNG, and WebP images up to 5 MB. Raw receipts stay private; public upload access excludes receipt proof.",
    reminder: "Users should avoid uploading faces, payment info, or private documents.",
    counts: {
      uploads_folder_exists: fs.existsSync(UPLOAD_DIR),
      max_upload_mb: MAX_UPLOAD_BYTES / (1024 * 1024),
      allowed_types: Object.values(ALLOWED_IMAGE_UPLOADS)
    },
    actions: [betaAction("Go to Photo Upload Rules page", "page", "/photo-rules.html")]
  });

  checks.push({
    id: "products",
    label: "Products system",
    status: productsTableExists
      ? (unlinkedCounts.unlinked_reports || 0) > 20 ? "Warning" : "Ready"
      : "Needs setup",
    explanation: productsTableExists
      ? "Product tools exist and can organize real submitted reports."
      : "Products table is missing.",
    counts: {
      products: productCounts.products || 0,
      active: productCounts.active || 0,
      hidden_merged: productCounts.hidden_merged || 0,
      needs_review: productCounts.needs_review || 0,
      unlinked_reports: unlinkedCounts.unlinked_reports || 0
    },
    actions: [
      betaAction("Go to Product Tools", "tab", "productToolsTab"),
      betaAction("Go to Unlinked Reports", "tab", "productToolsTab")
    ]
  });

  checks.push({
    id: "stores",
    label: "Store setup",
    status: (storeCounts.active || 0) === 0
      ? "Warning"
      : (pendingStoreRequests.count || 0) > 0 ? "Warning" : "Ready",
    explanation: (storeCounts.active || 0) === 0
      ? "No active stores are available."
      : (pendingStoreRequests.count || 0) > 0
        ? "Active stores exist, but pending store requests need review."
        : "Active Janesville stores are available.",
    counts: {
      active: storeCounts.active || 0,
      inactive: storeCounts.inactive || 0,
      pending_store_requests: pendingStoreRequests.count || 0
    },
    actions: [betaAction("Go to Stores", "tab", "storesTab")]
  });

  checks.push({
    id: "cart",
    label: "Cart system",
    status: cartItemsTableExists ? "Ready" : "Needs setup",
    explanation: cartItemsTableExists
      ? "Cart storage and compare route are present. This remains a beta helper, not a full shopping cart."
      : "Cart storage is not set up yet.",
    counts: {
      cart_items: cartCounts.cart_items || 0,
      compare_endpoint: true
    },
    actions: [betaAction("Go to Cart / Product Tools", "tab", "productToolsTab")]
  });

  checks.push({
    id: "proof-submission",
    label: "Proof submission workflow",
    status: (proofCounts.proof_submissions || 0) > 0 ? "Ready" : "Warning",
    explanation: (proofCounts.proof_submissions || 0) > 0
      ? "Proof-only submissions exist and remain private until admin review creates approved prices."
      : "No proof-only submissions exist yet. Run one beta rehearsal proof submission.",
    counts: {
      total_proofs: proofCounts.proof_submissions || 0,
      pending_proofs: proofCounts.pending_proofs || 0,
      accepted_proofs: proofCounts.accepted_proofs || 0,
      proofs_used_for_prices: proofRowsUsed.proofs_used_for_prices || 0,
      needs_clearer_photo: proofCounts.needs_clearer_photo || 0,
      rejected_proofs: proofCounts.rejected_proofs || 0,
      duplicate_proofs: proofCounts.duplicate_proofs || 0
    },
    actions: [betaAction("Go to Price Importer", "tab", "priceImporterTab")]
  });

  checks.push({
    id: "points-notifications",
    label: "Points and notifications",
    status: (pointCounts.points_awarded_total || 0) > 0 ? "Ready" : "Warning",
    explanation: (pointCounts.points_awarded_total || 0) > 0
      ? "Point awards exist. User notifications are active for proof and price review outcomes."
      : "No positive point awards exist yet. Run a proof approval rehearsal before beta.",
    counts: {
      points_awarded_total: pointCounts.points_awarded_total || 0,
      points_awarded_this_week: pointCounts.points_awarded_this_week || 0
    },
    actions: [betaAction("Go to Users", "tab", "usersTab")]
  });

  checks.push({
    id: "leaderboard-username-moderation",
    label: "Leaderboard username moderation",
    status: (usernameModerationCounts.usernames_need_change || 0) > 0 ? "Warning" : "Ready",
    explanation: (usernameModerationCounts.usernames_need_change || 0) > 0
      ? "Some users need username cleanup before appearing on public leaderboards."
      : "No users are currently flagged as needing a username change.",
    counts: {
      total_users: usernameModerationCounts.total_users || 0,
      usernames_need_change: usernameModerationCounts.usernames_need_change || 0,
      hidden_from_leaderboard: usernameModerationCounts.hidden_from_leaderboard || 0
    },
    actions: [betaAction("Go to Users", "tab", "usersTab")]
  });

  checks.push({
    id: "approved-price-target",
    label: "Minimum clean approved prices",
    status: (publicDataHealth.approved_prices || 0) >= 10 ? "Ready" : "Warning",
    explanation: (publicDataHealth.approved_prices || 0) >= 10
      ? "The app has at least 10 approved prices for a small beta demo."
      : "Add more real approved prices before inviting beta testers.",
    counts: {
      approved_prices: publicDataHealth.approved_prices || 0,
      target: 10,
      products_with_prices: publicDataHealth.products_with_prices || 0,
      stores_with_prices: publicDataHealth.stores_with_prices || 0
    },
    actions: [
      betaAction("Go to Prices", "tab", "pricesTab"),
      betaAction("Go to Manual Entry", "tab", "manualTab")
    ]
  });

  checks.push({
    id: "dependency-audit",
    label: "Dependency audit",
    status: "Warning",
    explanation: "Run npm audit --omit=dev in the backend folder before beta. The admin dashboard does not execute shell commands.",
    actions: []
  });

  checks.push({
    id: "manual-beta-rehearsal",
    label: "Manual beta rehearsal",
    status: "Warning",
    explanation: "Run one full phone rehearsal: search, cart compare, submit proof, admin review, approve one price, confirm notification and points.",
    actions: [
      betaAction("Go to Price Importer", "tab", "priceImporterTab"),
      betaAction("Go to Analytics", "tab", "analyticsTab")
    ]
  });

  checks.push({
    id: "allergy",
    label: "Allergy / ingredient safety",
    status: allergyPageExists && hasPackageLabelWording && !hasForbiddenAllergyClaim ? "Ready" : "Warning",
    explanation: allergyPageExists && hasPackageLabelWording && !hasForbiddenAllergyClaim
      ? "Public wording points users back to package labels and avoids guarantee language."
      : "Review allergy wording before beta. Ingredient alerts must stay as helpers only.",
    actions: [betaAction("Go to Allergy Disclaimer page", "page", "/allergy-disclaimer.html")]
  });

  checks.push({
    id: "legal-pages",
    label: "Legal / safety pages",
    status: missingLegalPages.length === 0
      ? "Ready"
      : missingCriticalLegalPages.length ? "Critical" : "Warning",
    explanation: missingLegalPages.length === 0
      ? "All public safety pages are present."
      : `${missingLegalPages.length} safety page${missingLegalPages.length === 1 ? "" : "s"} missing.`,
    counts: {
      total: legalPages.length,
      present: legalPages.length - missingLegalPages.length,
      missing: missingLegalPages.map((page) => page.label)
    },
    actions: legalPages.map((page) => betaAction(`Open ${page.label}`, "page", page.url))
  });

  checks.push({
    id: "suggestions",
    label: "Suggestions / bug reports",
    status: suggestionsTableExists ? "Ready" : "Needs setup",
    explanation: suggestionsTableExists
      ? "Suggestions are available for beta feedback."
      : "Suggestion storage is not set up yet.",
    counts: {
      pending_suggestions: pendingSuggestions.count || 0
    },
    actions: [betaAction("Go to Suggestions", "tab", "suggestionsTab")]
  });

  checks.push({
    id: "no-fake-data",
    label: "No fake data check",
    status: suspiciousDataTotal > 0 ? "Warning" : "Ready",
    explanation: suspiciousDataTotal > 0
      ? "Obvious test/demo-looking names were found. Review them manually before beta."
      : "No obvious test/demo-looking names were found. Admin should still manually confirm no fake demo data remains.",
    counts: {
      users: userCounts.users || 0,
      products: productCounts.products || 0,
      approved_reports: reportCounts.approved || 0,
      pending_reports: reportCounts.pending || 0,
      stores: storeCounts.stores || 0,
      suspicious_users: fakeCheck.suspicious_users || 0,
      suspicious_products: fakeCheck.suspicious_products || 0,
      suspicious_reports: fakeCheck.suspicious_reports || 0
    },
    reminder: "This check only displays counts. It does not prove data is real. Admin should manually confirm no fake demo data remains.",
    actions: [
      betaAction("Go to Users", "tab", "usersTab"),
      betaAction("Go to Product Tools", "tab", "productToolsTab"),
      betaAction("Go to Prices", "tab", "pricesTab")
    ]
  });

  checks.push({
    id: "environment",
    label: "Environment / local testing",
    status: HOST === "0.0.0.0" ? "Ready" : "Warning",
    explanation: HOST === "0.0.0.0"
      ? "The server is configured for local network testing."
      : "Set HOST=0.0.0.0 for easier phone testing on the same Wi-Fi.",
    counts: {
      host: HOST,
      port: PORT,
      public_app_url: PUBLIC_APP_URL
    },
    actions: []
  });

  return {
    generated_at: new Date().toISOString(),
    summary: {
      ready: checks.filter((check) => check.status === "Ready").length,
      warning: checks.filter((check) => check.status === "Warning").length,
      critical: checks.filter((check) => check.status === "Critical").length,
      needs_setup: checks.filter((check) => check.status === "Needs setup").length
    },
    counts: {
      pending_reviews: reportCounts.pending || 0,
      new_users_today: userCounts.new_users_today || 0,
      reports_submitted_today: reportCounts.submitted_today || 0,
      reports_rejected_today: await get(
        "SELECT COUNT(*) AS count FROM price_reports WHERE status = 'rejected' AND reviewed_at >= ?",
        [todayStart]
      ).then((row) => row.count || 0),
      reports_needing_proof: reportCounts.needs_proof || 0,
      flagged_disputed_reports: reportCounts.disputed || 0,
      banned_suspended_users: userCounts.banned_suspended || 0
    },
    legal_pages: legalPages,
    phone_testing: {
      host: HOST,
      port: PORT,
      appBaseUrl: PUBLIC_APP_URL,
      localUrl: `http://localhost:${PORT}`,
      phoneUrl: `http://YOUR-MAC-IP:${PORT}`,
      adminPhoneUrl: `http://YOUR-MAC-IP:${PORT}/admin.html`,
      findIpCommand: "ipconfig getifaddr en0",
      firewallHint: "If phone cannot connect, make sure the phone and Mac are on the same Wi-Fi, the server is listening on 0.0.0.0, and the Mac firewall allows Node."
    },
    checks
  };
}

function dateStarts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date(today);
  week.setDate(week.getDate() - 6);

  return {
    todayStart: today.toISOString(),
    weekStart: week.toISOString()
  };
}

async function eventCount(eventType, since) {
  const row = await get(
    "SELECT COUNT(*) AS count FROM analytics_events WHERE event_type = ? AND created_at >= ?",
    [eventType, since]
  );

  return row.count || 0;
}

async function visitorCountSince(since) {
  const row = await get(
    `
      SELECT COUNT(DISTINCT COALESCE(NULLIF(session_id, ''), CASE WHEN user_id IS NOT NULL THEN 'user:' || user_id ELSE 'event:' || id END)) AS count
      FROM analytics_events
      WHERE created_at >= ?
    `,
    [since]
  );

  return row.count || 0;
}

function aggregateIngredientText(rows) {
  const counts = new Map();

  for (const row of rows) {
    for (const ingredient of String(row.avoid_ingredients || "").split(",")) {
      const cleaned = cleanText(ingredient, 60).toLowerCase();

      if (cleaned) {
        counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([ingredient, count]) => ({ ingredient, count }))
    .sort((a, b) => b.count - a.count || a.ingredient.localeCompare(b.ingredient))
    .slice(0, 20);
}

async function getAdminAnalyticsSummary() {
  const { todayStart, weekStart } = dateStarts();
  const activeFiveStart = new Date(Date.now() - 1000 * 60 * 5).toISOString();
  const activeFifteenStart = new Date(Date.now() - 1000 * 60 * 15).toISOString();
  const [
    searchesToday,
    searchesWeek,
    productViewsToday,
    productViewsWeek,
    cartAddsToday,
    cartAddsWeek,
    cartComparesToday,
    cartComparesWeek
  ] = await Promise.all([
    eventCount("search_performed", todayStart),
    eventCount("search_performed", weekStart),
    eventCount("product_viewed", todayStart),
    eventCount("product_viewed", weekStart),
    eventCount("added_to_cart", todayStart),
    eventCount("added_to_cart", weekStart),
    eventCount("cart_compared", todayStart),
    eventCount("cart_compared", weekStart)
  ]);
  const mostSearchedItems = await all(
    `
      SELECT cart_item_name AS item_name, COUNT(*) AS count
      FROM analytics_events
      WHERE event_type = 'search_performed'
        AND COALESCE(cart_item_name, '') != ''
        AND created_at >= ?
      GROUP BY lower(cart_item_name)
      ORDER BY count DESC, item_name ASC
      LIMIT 20
    `,
    [weekStart]
  );
  const mostViewedProducts = await all(
    `
      SELECT
        COALESCE(products.display_name, analytics_events.cart_item_name, 'Unknown product') AS product_name,
        analytics_events.product_id,
        COUNT(*) AS count
      FROM analytics_events
      LEFT JOIN products ON products.id = analytics_events.product_id
      WHERE analytics_events.event_type = 'product_viewed'
        AND analytics_events.created_at >= ?
      GROUP BY analytics_events.product_id, product_name
      ORDER BY count DESC, product_name ASC
      LIMIT 20
    `,
    [weekStart]
  );
  const mostAddedToCartItems = await all(
    `
      SELECT cart_item_name AS item_name, category, COUNT(*) AS count
      FROM analytics_events
      WHERE event_type = 'added_to_cart'
        AND COALESCE(cart_item_name, '') != ''
        AND created_at >= ?
      GROUP BY lower(cart_item_name), category
      ORDER BY count DESC, item_name ASC
      LIMIT 20
    `,
    [weekStart]
  );
  const mostMissingPriceItems = await all(
    `
      SELECT
        analytics_events.cart_item_name AS item_name,
        analytics_events.category,
        COUNT(*) AS count,
        missing_price_priorities.status AS priority_status
      FROM analytics_events
      LEFT JOIN missing_price_priorities
        ON lower(missing_price_priorities.item_name) = lower(analytics_events.cart_item_name)
       AND COALESCE(missing_price_priorities.category, '') = COALESCE(analytics_events.category, '')
      WHERE analytics_events.event_type = 'missing_price_seen'
        AND COALESCE(analytics_events.cart_item_name, '') != ''
        AND analytics_events.created_at >= ?
      GROUP BY lower(analytics_events.cart_item_name), analytics_events.category
      ORDER BY count DESC, item_name ASC
      LIMIT 25
    `,
    [weekStart]
  );
  const mostComparedCategories = await all(
    `
      SELECT category, COUNT(*) AS count
      FROM analytics_events
      WHERE event_type IN ('added_to_cart', 'missing_price_seen')
        AND COALESCE(category, '') != ''
        AND created_at >= ?
      GROUP BY category
      ORDER BY count DESC, category ASC
      LIMIT 20
    `,
    [weekStart]
  );
  const storesWithMostApprovedReports = await all(
    `
      SELECT stores.id, stores.name, COUNT(price_reports.id) AS approved_reports
      FROM stores
      LEFT JOIN price_reports
        ON price_reports.store_id = stores.id
       AND price_reports.status = 'approved'
      GROUP BY stores.id
      ORDER BY approved_reports DESC, stores.name ASC
      LIMIT 20
    `
  );
  const topCategories = await all(
    `
      SELECT category, COUNT(*) AS count
      FROM analytics_events
      WHERE event_type IN ('search_performed', 'added_to_cart', 'missing_price_seen')
        AND COALESCE(category, '') != ''
        AND created_at >= ?
      GROUP BY category
      ORDER BY count DESC, category ASC
      LIMIT 20
    `,
    [weekStart]
  );
  const avoidRows = await all(
    `
      SELECT avoid_ingredients FROM cart_items WHERE COALESCE(avoid_ingredients, '') != ''
      UNION ALL
      SELECT avoid_ingredients FROM users WHERE COALESCE(avoid_ingredients, '') != ''
    `
  );
  const activeUsers = await get(
    `
      SELECT
        SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS active_now,
        SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS active_15_min,
        SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS users_today,
        COUNT(*) AS total_registered
      FROM users
      WHERE COALESCE(account_status, 'active') NOT IN ('banned', 'deleted', 'deactivated')
    `,
    [activeFiveStart, activeFifteenStart, todayStart]
  );
  const betaMetrics = await get(
    `
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (
          SELECT COUNT(DISTINCT user_id)
          FROM (
            SELECT user_id
            FROM price_reports
            WHERE status = 'approved'
            UNION
            SELECT batches.created_by AS user_id
            FROM price_import_batches batches
            JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
            WHERE batches.created_by IS NOT NULL
          )
        ) AS active_contributors,
        (SELECT COUNT(*) FROM price_reports WHERE status = 'approved') AS total_approved_prices,
        (SELECT COUNT(DISTINCT product_id) FROM price_reports WHERE status = 'approved' AND product_id IS NOT NULL) AS products_with_approved_prices,
        (SELECT COUNT(*) FROM stores WHERE active = 1) AS total_stores,
        (SELECT COUNT(DISTINCT store_id) FROM price_reports WHERE status = 'approved') AS stores_with_prices,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status IN ('needs_admin_review', 'waiting_for_review', 'accepted_for_review')
        ) AS pending_proofs,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status IN ('accepted_for_review', 'proof_reviewed', 'reviewed_no_prices', 'used_for_prices')
        ) AS accepted_proofs,
        (
          SELECT COUNT(DISTINCT batches.id)
          FROM price_import_batches batches
          JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
          WHERE batches.notes LIKE ?
        ) AS proofs_used_for_prices,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status = 'needs_clearer_photo'
        ) AS needs_clearer_photo_count,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND status IN ('proof_rejected', 'rejected')
        ) AS rejected_proof_count,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
            AND (status = 'duplicate' OR COALESCE(duplicate_scope, '') != '')
        ) AS duplicate_proof_count,
        (
          SELECT COUNT(*)
          FROM price_import_batches
          WHERE notes LIKE ?
        ) AS proof_submission_count,
        (
          SELECT COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0)
          FROM point_events
        ) AS points_awarded_total,
        (
          SELECT COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0)
          FROM point_events
          WHERE created_at >= ?
        ) AS points_awarded_this_week,
        (
          SELECT COUNT(*)
          FROM users
          WHERE is_admin = 1
        ) AS admin_accounts
    `,
    [
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      `${PROOF_SUBMISSION_NOTE_PREFIX}%`,
      weekStart
    ]
  );
  const topApprovedProducts = await all(
    `
      SELECT
        COALESCE(products.display_name, price_reports.item_name, 'Unknown product') AS product_name,
        COUNT(price_reports.id) AS approved_prices,
        MIN(price_reports.price) AS lowest_price
      FROM price_reports
      LEFT JOIN products ON products.id = price_reports.product_id
      WHERE price_reports.status = 'approved'
      GROUP BY COALESCE(price_reports.product_id, lower(price_reports.item_name)), product_name
      ORDER BY approved_prices DESC, product_name ASC
      LIMIT 20
    `
  );
  const topApprovedCategories = await all(
    `
      SELECT category, COUNT(*) AS approved_prices
      FROM price_reports
      WHERE status = 'approved'
        AND COALESCE(category, '') != ''
      GROUP BY category
      ORDER BY approved_prices DESC, category ASC
      LIMIT 20
    `
  );
  const proofTypeBreakdown = await all(
    `
      SELECT
        CASE
          WHEN source_type = 'receipt' OR proof_type = 'receipt_photo' THEN 'receipt'
          WHEN source_type = 'weekly_ad' OR proof_type = 'weekly_ad' THEN 'weekly_ad'
          WHEN source_type = 'shelf_tag' OR proof_type = 'shelf_tag_photo' THEN 'shelf_tag'
          WHEN source_type = 'store_deal' OR COALESCE(source_url, '') != '' THEN 'source_link'
          ELSE COALESCE(NULLIF(source_type, ''), NULLIF(proof_type, ''), 'other')
        END AS proof_type,
        COUNT(*) AS count
      FROM price_import_batches
      WHERE notes LIKE ?
      GROUP BY proof_type
      ORDER BY count DESC, proof_type ASC
    `,
    [`${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );
  const adminAudit = await adminAccountAuditSummary();
  const proofSubmissionCount = betaMetrics.proof_submission_count || 0;
  const approvalRate = proofSubmissionCount
    ? Math.round(((betaMetrics.proofs_used_for_prices || 0) / proofSubmissionCount) * 100)
    : 0;
  const rejectionRate = proofSubmissionCount
    ? Math.round(((betaMetrics.rejected_proof_count || 0) / proofSubmissionCount) * 100)
    : 0;
  const duplicateRate = proofSubmissionCount
    ? Math.round(((betaMetrics.duplicate_proof_count || 0) / proofSubmissionCount) * 100)
    : 0;
  const averagePointsPerProof = proofSubmissionCount
    ? Number(((betaMetrics.points_awarded_total || 0) / proofSubmissionCount).toFixed(1))
    : 0;

  return {
    privacy_note: "Analytics are aggregate counts. Do not provide personal user data to sponsors.",
    cards: {
      total_users: betaMetrics.total_users || 0,
      active_contributors: betaMetrics.active_contributors || 0,
      total_approved_prices: betaMetrics.total_approved_prices || 0,
      products_with_approved_prices: betaMetrics.products_with_approved_prices || 0,
      total_stores: betaMetrics.total_stores || 0,
      stores_with_prices: betaMetrics.stores_with_prices || 0,
      pending_proofs: betaMetrics.pending_proofs || 0,
      accepted_proofs: betaMetrics.accepted_proofs || 0,
      proofs_used_for_prices: betaMetrics.proofs_used_for_prices || 0,
      needs_clearer_photo_count: betaMetrics.needs_clearer_photo_count || 0,
      rejected_proof_count: betaMetrics.rejected_proof_count || 0,
      duplicate_proof_count: betaMetrics.duplicate_proof_count || 0,
      points_awarded_total: betaMetrics.points_awarded_total || 0,
      points_awarded_this_week: betaMetrics.points_awarded_this_week || 0,
      average_points_per_proof: averagePointsPerProof,
      approval_rate: approvalRate,
      rejection_rate: rejectionRate,
      duplicate_rate: duplicateRate,
      admin_accounts: betaMetrics.admin_accounts || 0,
      searches_today: searchesToday,
      searches_week: searchesWeek,
      product_views_today: productViewsToday,
      product_views_week: productViewsWeek,
      cart_adds_today: cartAddsToday,
      cart_adds_week: cartAddsWeek,
      cart_compares_today: cartComparesToday,
      cart_compares_week: cartComparesWeek,
      active_users_now: activeUsers.active_now || 0,
      active_users_15_min: activeUsers.active_15_min || 0,
      users_seen_today: activeUsers.users_today || 0,
      total_registered_users: activeUsers.total_registered || 0
    },
    admin_account_audit: {
      admin_capable_count: adminAudit.admin_capable_count,
      active_admin_capable_count: adminAudit.active_admin_capable_count,
      cleanup_needed: adminAudit.cleanup_needed,
      recommendation: adminAudit.recommendation
    },
    proof_status_rates: {
      approval_rate: approvalRate,
      rejection_rate: rejectionRate,
      duplicate_rate: duplicateRate
    },
    public_data_health: {
      approved_prices: betaMetrics.total_approved_prices || 0,
      products_with_prices: betaMetrics.products_with_approved_prices || 0,
      stores_with_prices: betaMetrics.stores_with_prices || 0,
      total_stores: betaMetrics.total_stores || 0
    },
    most_searched_items: mostSearchedItems,
    most_viewed_products: mostViewedProducts,
    most_added_to_cart_items: mostAddedToCartItems,
    most_missing_price_items: mostMissingPriceItems,
    most_compared_categories: mostComparedCategories,
    stores_with_most_approved_reports: storesWithMostApprovedReports,
    stores_with_missing_requested_items: [],
    top_approved_products: topApprovedProducts,
    top_approved_categories: topApprovedCategories,
    proof_type_breakdown: proofTypeBreakdown,
    top_categories: topCategories,
    popular_avoid_ingredients: aggregateIngredientText(avoidRows)
  };
}

async function sponsorStatsById() {
  const rows = await all(
    `
      SELECT
        sponsor_id,
        SUM(CASE WHEN event_type = 'sponsor_viewed' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_type = 'sponsor_clicked' THEN 1 ELSE 0 END) AS clicks,
        SUM(CASE WHEN event_type = 'sponsor_interested' THEN 1 ELSE 0 END) AS interested,
        SUM(CASE WHEN event_type = 'sponsor_not_interested' THEN 1 ELSE 0 END) AS not_interested
      FROM analytics_events
      WHERE sponsor_id IS NOT NULL
      GROUP BY sponsor_id
    `
  );

  return new Map(rows.map((row) => [row.sponsor_id, row]));
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    points: user.points,
    accuracy_score: user.accuracy_score || 0,
    is_email_verified: Boolean(user.is_email_verified),
    reward_eligible: Boolean(user.is_email_verified),
    is_admin: Boolean(user.is_admin),
    is_super_admin: isSuperAdminAccount(user),
    is_owner: isOwnerAccount(user),
    admin_role: staffRoleForUser(user),
    staff_role: staffRoleForUser(user),
    work_preferences: workPreferencesForUser(user),
    account_status: user.account_status || "active",
    hide_from_leaderboard: Boolean(user.hide_from_leaderboard),
    force_username_change: Boolean(user.force_username_change),
    username_status: user.username_status || "approved",
    avoid_ingredients: user.avoid_ingredients || "",
    created_at: user.created_at
  };
}

function isBlockedAccount(user) {
  return ["suspended", "banned", "deleted", "deactivated"].includes(user.account_status || "active");
}

function blockedAccountMessage(user) {
  if ((user.account_status || "active") === "banned") {
    return "Your account is banned and cannot submit or verify prices.";
  }

  if ((user.account_status || "active") === "suspended") {
    return "Your account is suspended and cannot submit or verify prices.";
  }

  if ((user.account_status || "active") === "deleted") {
    return "This account is deleted and cannot submit or verify prices.";
  }

  if ((user.account_status || "active") === "deactivated") {
    return "This account is deactivated and cannot submit or verify prices.";
  }

  return "This account cannot submit or verify prices.";
}

function sessionSave(request) {
  return new Promise((resolve, reject) => {
    request.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function sessionRegenerate(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function sessionDestroy(request) {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function logInSessionUser(request, user) {
  await sessionRegenerate(request);
  request.session.userId = user.id;
  await sessionSave(request);
}

async function getSessionUser(request) {
  if (!request.session || !request.session.userId) {
    return null;
  }

  const user = await get("SELECT * FROM users WHERE id = ?", [request.session.userId]);
  return applyBootstrapSuperAdminFlags(user);
}

async function getAdminAccess(request) {
  const user = await getSessionUser(request);

  if (user && (user.is_admin || isSuperAdminAccount(user)) && !isBlockedAccount(user)) {
    await markUserSeen(user.id);
    return { allowed: true, user, viaPin: false };
  }

  const pin = request.body && request.body.pin;

  if (pin && pin === ADMIN_PIN) {
    return { allowed: true, user: null, viaPin: true };
  }

  return { allowed: false, user, viaPin: false };
}

async function trackAnalyticsEvent(request, eventInput) {
  try {
    const event = validateAnalyticsEvent(eventInput);
    const userId = request.currentUser?.id || request.session?.userId || null;
    const sessionId = request.sessionID || null;
    const category = CATEGORIES.includes(event.category) ? event.category : "";

    await run(
      `
        INSERT INTO analytics_events (
          event_type,
          user_id,
          session_id,
          product_id,
          report_id,
          store_id,
          sponsor_id,
          cart_item_name,
          category,
          metadata_json,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        event.event_type,
        userId,
        sessionId,
        event.product_id,
        event.report_id,
        event.store_id,
        event.sponsor_id,
        event.cart_item_name,
        category,
        JSON.stringify(event.metadata || {}),
        new Date().toISOString()
      ]
    );
  } catch (error) {
    console.warn(`Analytics event skipped: ${error.message}`);
  }
}

async function markUserSeen(userId) {
  if (!userId) {
    return;
  }

  const now = new Date().toISOString();
  await run(
    "UPDATE users SET last_seen_at = ?, last_activity_at = ? WHERE id = ?",
    [now, now, userId]
  );
}

function localDateFor(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function localDateDistance(previousDate, nextDate) {
  if (!previousDate || !nextDate) return null;
  const previous = Date.parse(`${previousDate}T12:00:00Z`);
  const next = Date.parse(`${nextDate}T12:00:00Z`);
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  return Math.round((next - previous) / 86400000);
}

function visitorKeyFor(request, user) {
  if (user?.id) return `user:${user.id}`;
  const raw = cleanText(request.body?.visitor_id || request.get("x-grocery-visitor") || request.sessionID || "guest", 160);
  return `guest:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
}

async function updateUserStreak(userId, localDate, now) {
  if (!userId) return null;
  const existing = await get("SELECT * FROM user_engagement WHERE user_id = ?", [userId]);
  if (existing?.last_qualifying_date === localDate) return existing;
  const distance = localDateDistance(existing?.last_qualifying_date, localDate);
  const current = distance === 1 ? Number(existing?.current_streak || 0) + 1 : 1;
  const longest = Math.max(current, Number(existing?.longest_streak || 0));
  const total = Number(existing?.total_qualifying_days || 0) + 1;
  await run(
    `
      INSERT INTO user_engagement (user_id, current_streak, longest_streak, last_qualifying_date, total_qualifying_days, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        current_streak = excluded.current_streak,
        longest_streak = excluded.longest_streak,
        last_qualifying_date = excluded.last_qualifying_date,
        total_qualifying_days = excluded.total_qualifying_days,
        updated_at = excluded.updated_at
    `,
    [userId, current, longest, localDate, total, now]
  );
  return get("SELECT * FROM user_engagement WHERE user_id = ?", [userId]);
}

async function recordActivityHeartbeat(request, user) {
  const now = new Date().toISOString();
  const localDate = localDateFor(new Date(now));
  const visitorKey = visitorKeyFor(request, user);
  const role = user ? staffRoleForUser(user) : "guest";
  const category = role === "user" ? "member" : role;
  await run(
    `
      INSERT INTO activity_presence (visitor_key, user_id, role_category, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(visitor_key) DO UPDATE SET
        user_id = excluded.user_id,
        role_category = excluded.role_category,
        last_seen_at = excluded.last_seen_at
    `,
    [visitorKey, user?.id || null, category, now, now]
  );
  await run(
    `
      INSERT INTO activity_daily (local_date, visitor_key, user_id, first_seen_at, last_seen_at, heartbeat_count)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(local_date, visitor_key) DO UPDATE SET
        user_id = excluded.user_id,
        last_seen_at = excluded.last_seen_at,
        heartbeat_count = activity_daily.heartbeat_count + 1
    `,
    [localDate, visitorKey, user?.id || null, now, now]
  );
  const streak = await updateUserStreak(user?.id, localDate, now);
  return { now, localDate, streak };
}

async function liveUsageSummary() {
  const cutoff = new Date(Date.now() - ACTIVE_USAGE_WINDOW_MINUTES * 60000).toISOString();
  const today = localDateFor();
  const active = await all(
    "SELECT role_category, COUNT(*) AS count FROM activity_presence WHERE last_seen_at >= ? GROUP BY role_category",
    [cutoff]
  );
  const visitors = await get(
    `
      SELECT COUNT(*) AS visitors,
             SUM(CASE WHEN presence.first_seen_at < daily.first_seen_at THEN 1 ELSE 0 END) AS returning_count
      FROM activity_daily daily
      LEFT JOIN activity_presence presence ON presence.visitor_key = daily.visitor_key
      WHERE daily.local_date = ?
    `,
    [today]
  );
  const byRole = Object.fromEntries(active.map((row) => [row.role_category, row.count || 0]));
  return {
    active_window_minutes: ACTIVE_USAGE_WINDOW_MINUTES,
    active_now: active.reduce((sum, row) => sum + Number(row.count || 0), 0),
    by_role: byRole,
    visitors_today: visitors?.visitors || 0,
    returning_visitors: visitors?.returning_count || 0
  };
}

async function createNotification(input) {
  const title = cleanText(input.title, 160);
  const message = cleanText(input.message, 800);

  if (!title || !message) {
    return null;
  }

  const adminOnly = input.admin_only || input.adminOnly ? 1 : 0;
  const userId = input.user_id || input.userId || null;
  const relatedReportId = Number.parseInt(input.related_report_id ?? input.relatedReportId, 10);
  const relatedImportBatchId = Number.parseInt(input.related_import_batch_id ?? input.relatedImportBatchId, 10);
  const relatedImportRowId = Number.parseInt(input.related_import_row_id ?? input.relatedImportRowId, 10);
  const pointsAwarded = Number.parseInt(input.points_awarded ?? input.pointsAwarded, 10);

  if (!adminOnly && !userId) {
    return null;
  }

  const result = await run(
    `
      INSERT INTO notifications (
        user_id,
        admin_only,
        type,
        title,
        message,
        related_type,
        related_id,
        related_report_id,
        related_import_batch_id,
        related_import_row_id,
        points_awarded,
        target_tab,
        target_url,
        is_read,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `,
    [
      userId,
      adminOnly,
      cleanText(input.type || "general", 80),
      title,
      message,
      cleanText(input.related_type || input.relatedType, 80),
      input.related_id || input.relatedId || null,
      Number.isInteger(relatedReportId) && relatedReportId > 0 ? relatedReportId : null,
      Number.isInteger(relatedImportBatchId) && relatedImportBatchId > 0 ? relatedImportBatchId : null,
      Number.isInteger(relatedImportRowId) && relatedImportRowId > 0 ? relatedImportRowId : null,
      Number.isInteger(pointsAwarded) ? pointsAwarded : null,
      cleanText(input.target_tab || input.targetTab, 80),
      cleanText(input.target_url || input.targetUrl, 300),
      new Date().toISOString()
    ]
  );

  return result.lastID;
}

async function createAdminNotification(type, title, message, options = {}) {
  return createNotification({
    admin_only: true,
    type,
    title,
    message,
    related_type: options.related_type,
    related_id: options.related_id,
    related_report_id: options.related_report_id,
    related_import_batch_id: options.related_import_batch_id,
    related_import_row_id: options.related_import_row_id,
    points_awarded: options.points_awarded,
    target_tab: options.target_tab || "dashboardTab",
    target_url: options.target_url
  });
}

async function createUserNotification(userId, type, title, message, options = {}) {
  return createNotification({
    user_id: userId,
    type,
    title,
    message,
    related_type: options.related_type,
    related_id: options.related_id,
    related_report_id: options.related_report_id,
    related_import_batch_id: options.related_import_batch_id,
    related_import_row_id: options.related_import_row_id,
    points_awarded: options.points_awarded,
    target_tab: options.target_tab,
    target_url: options.target_url
  });
}

async function createUniqueUserNotification(userId, type, relatedType, relatedId, title, message, options = {}) {
  const existing = await get(
    `
      SELECT id
      FROM notifications
      WHERE user_id = ?
        AND type = ?
        AND related_type = ?
        AND related_id = ?
      LIMIT 1
    `,
    [userId, type, relatedType, relatedId]
  );

  if (existing) {
    return existing.id;
  }

  return createUserNotification(userId, type, title, message, {
    ...options,
    related_type: relatedType,
    related_id: relatedId
  });
}

function todayStartIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function daysBetweenNow(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

async function contributorTrustProfile(userId) {
  const user = await get("SELECT * FROM users WHERE id = ?", [userId]);

  if (!user) {
    return TRUST_LEVELS[0];
  }

  const proofStats = await get(
    `
      SELECT
        COUNT(DISTINCT CASE WHEN batches.status IN ('accepted_for_review', 'proof_reviewed', 'ready_for_review', 'approved', 'used_for_prices', 'reviewed_no_prices') THEN batches.id END) AS accepted_proof_count,
        COUNT(CASE WHEN rows.status = 'approved' THEN 1 END) AS approved_prices_from_proof,
        COUNT(DISTINCT CASE WHEN batches.status IN ('proof_rejected', 'rejected') THEN batches.id END) AS rejected_proof_count,
        COUNT(DISTINCT CASE WHEN batches.status = 'duplicate' OR batches.duplicate_scope != '' THEN batches.id END) AS duplicate_proof_count,
        COUNT(DISTINCT CASE WHEN batches.status = 'needs_clearer_photo' THEN batches.id END) AS unclear_proof_count
      FROM price_import_batches batches
      LEFT JOIN price_import_rows rows ON rows.batch_id = batches.id
      WHERE batches.created_by = ?
        AND batches.notes LIKE ?
    `,
    [userId, `${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );

  return trustLevelFromStats({
    ...proofStats,
    is_admin: Boolean(user.is_admin),
    admin_note: user.admin_note || ""
  });
}

function proofFreshnessForPoints(batch, row = null) {
  const sourceType = batch?.source_type || "";
  const proofType = row?.proof_type || batch?.proof_type || "";
  const checkedAt = row?.source_checked_at || batch?.source_checked_at || "";

  if (sourceType === "receipt" || proofType === "receipt_photo") {
    const purchaseDate = batch?.receipt_purchase_date || checkedAt || batch?.created_at;
    const ageDays = daysBetweenNow(purchaseDate);

    if (ageDays === null) {
      return { eligible: false, reason: "receipt purchase date unknown" };
    }

    if (ageDays > 7) {
      return { eligible: false, reason: "receipt older than 7 days" };
    }

    return { eligible: true, reason: "fresh receipt" };
  }

  if (sourceType === "shelf_tag" || proofType === "shelf_tag_photo") {
    const ageDays = daysBetweenNow(checkedAt || batch?.created_at);

    if (ageDays !== null && ageDays <= 7) {
      return { eligible: true, reason: "fresh shelf tag" };
    }

    return { eligible: false, reason: "shelf tag older than 7 days or missing checked date" };
  }

  if (sourceType === "store_deal" && (batch?.source_url || row?.source_url)) {
    return { eligible: true, reason: "source link reviewed by admin" };
  }

  if (sourceType === "weekly_ad" || proofType === "weekly_ad") {
    const validEndAt = row?.valid_end_at || "";

    if (!validEndAt) {
      return { eligible: false, reason: "weekly ad expiration unknown" };
    }

    const validEnd = new Date(validEndAt);

    if (Number.isNaN(validEnd.getTime())) {
      return { eligible: false, reason: "weekly ad expiration invalid" };
    }

    validEnd.setHours(23, 59, 59, 999);

    return validEnd >= new Date()
      ? { eligible: true, reason: "active weekly ad" }
      : { eligible: false, reason: "weekly ad expired" };
  }

  if (batch?.source_url || row?.source_url) {
    return { eligible: true, reason: "source link reviewed by admin" };
  }

  return { eligible: false, reason: "proof freshness needs admin review" };
}

function proofQualityFlagsForBatch(input = {}) {
  const flags = [];

  if (input.duplicate_scope) {
    flags.push(input.duplicate_scope);
  }

  if (!input.source_url) {
    flags.push("missing_source_link");
  }

  if (!input.photo_path && !input.source_url) {
    flags.push("missing_proof");
  }

  const freshness = proofFreshnessForPoints(input);

  if (!freshness.eligible) {
    flags.push(freshness.reason.replace(/\s+/g, "_"));
  }

  return [...new Set(flags)];
}

function reviewPriorityForProof(input = {}, trustProfile = TRUST_LEVELS[0]) {
  const flags = new Set(proofQualityFlagsForBatch(input));

  if (flags.has("same_user_duplicate") || flags.has("missing_proof")) {
    return "low";
  }

  if (flags.has("receipt_purchase_date_unknown") || flags.has("weekly_ad_expiration_unknown")) {
    return "needs_review";
  }

  if (trustProfile.level >= 2 || input.source_url || input.source_type === "weekly_ad") {
    return "high";
  }

  return "normal";
}

function hashUploadedFile(file) {
  if (!file?.path || !fs.existsSync(file.path)) {
    return "";
  }

  return crypto.createHash("sha256").update(fs.readFileSync(file.path)).digest("hex");
}

async function findDuplicateProofBatch({ userId, proofFileHash = "", sourceUrl = "" }) {
  const filters = [];
  const params = [];

  if (proofFileHash) {
    filters.push("proof_file_hash = ?");
    params.push(proofFileHash);
  }

  if (sourceUrl) {
    filters.push("source_url = ?");
    params.push(sourceUrl);
  }

  if (!filters.length) {
    return null;
  }

  const sameUserDuplicate = await get(
    `
      SELECT id, created_by
      FROM price_import_batches
      WHERE created_by = ?
        AND (${filters.join(" OR ")})
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [userId, ...params]
  );

  if (sameUserDuplicate) {
    return {
      duplicate_of_batch_id: sameUserDuplicate.id,
      duplicate_scope: "same_user_duplicate"
    };
  }

  const duplicate = await get(
    `
      SELECT id, created_by
      FROM price_import_batches
      WHERE (${filters.join(" OR ")})
      ORDER BY created_at ASC
      LIMIT 1
    `,
    params
  );

  if (!duplicate) {
    return null;
  }

  return {
    duplicate_of_batch_id: duplicate.id,
    duplicate_scope: Number(duplicate.created_by) === Number(userId)
      ? "same_user_duplicate"
      : "different_user_duplicate"
  };
}

async function proofRewardOwner(batch, adminUser, options = {}) {
  if (!batch || !isProofSubmissionBatch(batch) || !batch.created_by) {
    return null;
  }

  if (!options.adminOverride && adminUser && Number(batch.created_by) === Number(adminUser.id)) {
    return null;
  }

  const user = await get("SELECT * FROM users WHERE id = ?", [batch.created_by]);

  if (!user || isBlockedAccount(user)) {
    return null;
  }

  if (!options.adminOverride && user.is_admin) {
    return null;
  }

  return user;
}

async function proofRewardAlreadyAwarded(userId, action, batchId, rowId) {
  if (rowId) {
    const rowAward = await get(
      `
        SELECT id
        FROM point_events
        WHERE user_id = ?
          AND action = ?
          AND related_import_row_id = ?
        LIMIT 1
      `,
      [userId, action, rowId]
    );

    return Boolean(rowAward);
  }

  if (batchId) {
    const batchAward = await get(
      `
        SELECT id
        FROM point_events
        WHERE user_id = ?
          AND action = ?
          AND related_import_batch_id = ?
        LIMIT 1
      `,
      [userId, action, batchId]
    );

    return Boolean(batchAward);
  }

  return false;
}

async function cappedProofPoints(userId, requestedPoints, batchId) {
  const trustProfile = await contributorTrustProfile(userId);
  const daily = await get(
    `
      SELECT COALESCE(SUM(points), 0) AS total
      FROM point_events
      WHERE user_id = ?
        AND points > 0
        AND created_at >= ?
    `,
    [userId, todayStartIso()]
  );
  const batch = batchId
    ? await get(
      `
        SELECT COALESCE(SUM(points), 0) AS total
        FROM point_events
        WHERE user_id = ?
          AND related_import_batch_id = ?
          AND points > 0
      `,
      [userId, batchId]
    )
    : { total: 0 };
  const dailyCap = trustProfile.daily_cap || POINTS.proof_daily_cap;
  const dailyRemaining = Math.max(0, dailyCap - Number(daily.total || 0));
  const batchRemaining = batchId
    ? Math.max(0, POINTS.proof_batch_cap - Number(batch.total || 0))
    : requestedPoints;

  return Math.max(0, Math.min(requestedPoints, dailyRemaining, batchRemaining));
}

async function awardProofReward({ batch, row = null, report = null, adminUser = null, action, requestedPoints, reason, adminNote = "", adminOverride = false, batchScoped = false, notify = true }) {
  const owner = await proofRewardOwner(batch, adminUser, { adminOverride });

  if (!owner) {
    return { points: 0, user: null, skipped: "no eligible proof owner" };
  }

  if (batch.duplicate_scope === "same_user_duplicate") {
    return { points: 0, user: owner, skipped: "same-user duplicate proof" };
  }

  if (batch.duplicate_scope === "different_user_duplicate" && action !== "duplicate_confirmation") {
    return { points: 0, user: owner, skipped: "duplicate confirmation only" };
  }

  const freshness = proofFreshnessForPoints(batch, row);

  if (!freshness.eligible) {
    return { points: 0, user: owner, skipped: freshness.reason };
  }

  const rowId = batchScoped ? null : row?.id || null;
  const batchId = batch.id;

  if (await proofRewardAlreadyAwarded(owner.id, action, batchId, rowId)) {
    return { points: 0, user: owner, skipped: "duplicate reward" };
  }

  const points = await cappedProofPoints(owner.id, requestedPoints, batchId);

  if (!points) {
    return { points: 0, user: owner, skipped: "reward cap reached" };
  }

  await addPointEvent(owner.id, action, points, report?.id || null, {
    reason,
    related_import_batch_id: batchId,
    related_import_row_id: rowId,
    created_by_admin_id: adminUser?.id || null,
    admin_note: adminNote
  });

  if (notify) {
    await createUserNotification(
      owner.id,
      "proof_points_awarded",
      "Points awarded",
      `You earned ${points} point${points === 1 ? "" : "s"} for approved proof.`,
      {
        related_type: rowId ? "price_import_row" : "price_import_batch",
        related_id: rowId || batchId,
        related_report_id: report?.id || null,
        related_import_batch_id: batchId,
        related_import_row_id: rowId,
        points_awarded: points,
        target_tab: "profile",
        target_url: batchId
          ? `/?tab=accountView&section=proof&proof=${batchId}`
          : "/?tab=accountView&section=notifications"
      }
    );
  }

  return { points, user: owner };
}

async function awardProofAcceptedIfNeeded(batch, adminUser, adminNote = "") {
  if (batch.duplicate_scope === "different_user_duplicate") {
    const duplicateReward = await awardProofReward({
      batch,
      adminUser,
      action: "duplicate_confirmation",
      requestedPoints: POINTS.duplicate_confirmation,
      reason: "Duplicate proof confirmation from a different user",
      adminNote,
      batchScoped: true,
      notify: false
    });

    if (duplicateReward.user && duplicateReward.points > 0) {
      await createUserNotification(
        duplicateReward.user.id,
        "proof_duplicate_confirmed",
        "Proof confirmed",
        `Your proof helped confirm an existing price. You earned ${duplicateReward.points} point${duplicateReward.points === 1 ? "" : "s"}.`,
        {
          related_type: "price_import_batch",
          related_id: batch.id,
          related_import_batch_id: batch.id,
          points_awarded: duplicateReward.points,
          target_tab: "profile",
          target_url: `/?tab=accountView&section=proof&proof=${batch.id}`
        }
      );
    }

    return duplicateReward;
  }

  const accepted = await awardProofReward({
    batch,
    adminUser,
    action: "proof_accepted_reviewable",
    requestedPoints: POINTS.proof_accepted_reviewable,
    reason: "Proof accepted as reviewable",
    adminNote,
    batchScoped: true,
    notify: false
  });
  const awards = [accepted];

  if (accepted.points > 0) {
    if (batch.source_url) {
      awards.push(await awardProofReward({
        batch,
        adminUser,
        action: "proof_source_link_bonus",
        requestedPoints: POINTS.proof_source_link_bonus,
        reason: "Source link included with proof",
        adminNote,
        batchScoped: true,
        notify: false
      }));
    }

    if (batch.photo_path) {
      awards.push(await awardProofReward({
        batch,
        adminUser,
        action: "proof_clear_photo_bonus",
        requestedPoints: POINTS.proof_clear_photo_bonus,
        reason: "Proof photo accepted for review",
        adminNote,
        batchScoped: true,
        notify: false
      }));
    }
  }

  const totalPoints = awards.reduce((sum, reward) => sum + (Number(reward.points) || 0), 0);
  const owner = awards.find((reward) => reward.user)?.user || accepted.user;

  if (owner && totalPoints > 0) {
    const formattedBatch = formatPriceImportBatch(batch, []);
    const storeName = formattedBatch.proof_store_name || formattedBatch.receipt_store_name || "your store";
    const proofType = formattedBatch.proof_public_type || formattedBatch.source_type || formattedBatch.proof_type || "proof";

    await createUserNotification(
      owner.id,
      "proof_accepted",
      "Proof accepted",
      `Your ${storeName} ${String(proofType).replace(/_/g, " ")} was accepted for review. You earned ${totalPoints} point${totalPoints === 1 ? "" : "s"}.`,
      {
        related_type: "price_import_batch",
        related_id: batch.id,
        related_import_batch_id: batch.id,
        points_awarded: totalPoints,
        target_tab: "profile",
        target_url: `/?tab=accountView&section=proof&proof=${batch.id}`
      }
    );
  }

  return {
    ...accepted,
    points: totalPoints,
    awards
  };
}

function proofApprovalPoints(row) {
  return {
    action: "proof_used_for_approved_price",
    points: POINTS.proof_used_for_approved_price,
    reason: "Proof used to add an approved price",
    batchScoped: true
  };
}

async function notifyCartUsersForApprovedReport(report) {
  if (!report || !report.id) {
    return;
  }

  const normalizedItem = normalizeProductName(report.product_display_name || report.item_name);
  const params = [report.user_id];
  const filters = ["cart_items.user_id != ?"];

  if (report.product_id) {
    filters.push("cart_items.product_id = ?");
    params.push(report.product_id);
  }

  if (normalizedItem) {
    filters.push("lower(cart_items.item_name) = ?");
    params.push(normalizedItem);
  }

  if (filters.length === 1) {
    return;
  }

  const cartUsers = await all(
    `
      SELECT DISTINCT cart_items.user_id
      FROM cart_items
      JOIN users ON users.id = cart_items.user_id
      WHERE (${filters.slice(1).join(" OR ")})
        AND cart_items.user_id != ?
        AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
    `,
    [...params.slice(1), report.user_id]
  );

  for (const row of cartUsers) {
    await createUniqueUserNotification(
      row.user_id,
      "cart_price_found",
      "report",
      report.id,
      `New approved price found for ${report.product_display_name || report.item_name}.`,
      `${report.store_name} has an approved reported price for an item in your cart.`,
      {
        target_tab: "cartView",
        target_url: `/?tab=cartView&report=${report.id}`
      }
    );
  }
}

const requireAdminAccess = asyncRoute(async (request, response, next) => {
  const access = await getAdminAccess(request);

  if (!access.allowed) {
    response.status(403).json({ error: "Admin access is required." });
    return;
  }

  request.adminUser = access.user;
  request.adminAccessViaPin = access.viaPin;
  next();
});

function requireLoggedInAdminAction(request, response, next) {
  if (!request.adminUser || request.adminAccessViaPin) {
    response.status(403).json({
      error: "This admin action requires a logged-in admin account. The ADMIN_PIN fallback is read-only."
    });
    return;
  }

  next();
}

const requireSuperAdminAccess = asyncRoute(async (request, response, next) => {
  const access = await getAdminAccess(request);

  if (!access.allowed || access.viaPin || !access.user || !isSuperAdminAccount(access.user)) {
    response.status(403).json({ error: "Super Admin access is required." });
    return;
  }

  request.adminUser = access.user;
  request.adminAccessViaPin = false;
  next();
});

function requireStaffPermission(permission) {
  return (request, response, next) => {
    if (!request.adminUser || request.adminAccessViaPin || !staffCan(request.adminUser, permission)) {
      response.status(403).json({ error: "Your worker role does not allow this action." });
      return;
    }
    next();
  };
}

const adminV2RoleGuard = asyncRoute(async (request, response, next) => {
  const user = await getSessionUser(request);
  const role = staffRoleForUser(user || {});
  if (!["reviewer", "data_entry"].includes(role)) {
    next();
    return;
  }

  const pathname = String(request.originalUrl || request.path).split("?")[0];
  const method = request.method.toUpperCase();
  const sharedRead = method === "GET" && [
    /^\/api\/admin\/notifications$/,
    /^\/api\/admin\/reports$/,
    /^\/api\/admin\/price-imports$/,
    /^\/api\/admin\/product-tools$/,
    /^\/api\/admin\/stores$/,
    /^\/api\/admin\/uploads\//,
    /^\/api\/admin\/v2\//
  ].some((pattern) => pattern.test(pathname));
  const draftWrite = method === "POST" && [
    /^\/api\/admin\/price-imports\/\d+\/(rows|source|parse-price-text)$/,
    /^\/api\/admin\/price-import-rows\/\d+$/,
    /^\/api\/admin\/v2\//
  ].some((pattern) => pattern.test(pathname));
  const reviewerDecision = role === "reviewer" && method === "POST" && [
    /^\/api\/admin\/price-import-rows\/\d+\/(approve|reject)$/,
    /^\/api\/admin\/price-import-rows\/bulk$/,
    /^\/api\/admin\/proof-submissions\/\d+\/status$/
  ].some((pattern) => pattern.test(pathname));

  if (!sharedRead && !draftWrite && !reviewerDecision) {
    response.status(403).json({ error: "This area is not available to your worker role." });
    return;
  }
  next();
});

const requireLogin = asyncRoute(async (request, response, next) => {
  const user = await getSessionUser(request);

  if (!user) {
    response.status(401).json({ error: "You must log in before submitting grocery prices." });
    return;
  }

  if (isBlockedAccount(user)) {
    response.status(403).json({ error: blockedAccountMessage(user) });
    return;
  }

  request.currentUser = user;
  await markUserSeen(user.id);
  next();
});

const requireVerificationLogin = asyncRoute(async (request, response, next) => {
  const user = await getSessionUser(request);

  if (!user) {
    response.status(401).json({ error: "You must log in before verifying grocery prices." });
    return;
  }

  if (isBlockedAccount(user)) {
    response.status(403).json({ error: blockedAccountMessage(user) });
    return;
  }

  request.currentUser = user;
  await markUserSeen(user.id);
  next();
});

function authPage(title, message) {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>
        <main class="app-shell">
          <section class="empty-state">
            <h1>${title}</h1>
            <p>${message}</p>
            <p><a class="admin-link" href="/">Back to Grocery Radar Janesville</a></p>
          </section>
        </main>
      </body>
    </html>
  `;
}

function secondsLabel(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${Math.round(value)} sec`;
  if (value < 3600) return `${Math.round(value / 60)} min`;
  if (value < 86400) return `${Math.round(value / 3600)} hr`;
  return `${Math.round(value / 86400)} day`;
}

function formatUserSummary(row = {}) {
  const trustProfile = trustLevelFromStats({
    accepted_proof_count: row.approved_count || 0,
    approved_prices_from_proof: row.approved_count || 0,
    rejected_proof_count: row.rejected_count || 0,
    duplicate_proof_count: row.duplicate_count || 0,
    unclear_proof_count: row.needs_clearer_count || 0,
    is_admin: Boolean(row.is_admin),
    admin_note: row.admin_note || ""
  });

  return {
    id: row.id,
    username: row.username,
    email: row.email || "",
    role: staffRoleForUser(row),
    verified: Boolean(row.is_email_verified),
    joined_at: row.created_at,
    last_login_at: row.last_login_at || "",
    last_seen_at: row.last_seen_at || "",
    points: row.points || 0,
    trust_level: trustProfile.label,
    trust_level_key: trustProfile.key,
    submissions: row.submission_count || 0,
    approved: row.approved_count || 0,
    rejected: row.rejected_count || 0,
    warnings: row.warning_count || 0,
    suspended: row.account_status === "suspended",
    banned: row.account_status === "banned",
    account_status: row.account_status || "active"
  };
}

function formatFeedbackTicket(row = {}, includeAdminFields = false) {
  const ticket = {
    id: row.id,
    status: row.status || "open",
    priority: row.priority || "normal",
    category: row.category || "other",
    title: row.title || "",
    message: row.message || "",
    reporter: row.reporter_username
      ? {
          id: row.reporter_user_id,
          username: row.reporter_username
        }
      : null,
    public_response: row.public_response || "",
    source_url: row.source_url || "",
    city: row.city || "Janesville",
    region: row.region || "WI",
    country_code: row.country_code || "US",
    created_at: row.created_at,
    updated_at: row.updated_at,
    closed_at: row.closed_at || ""
  };

  if (includeAdminFields) {
    ticket.reporter = row.reporter_username
      ? {
          id: row.reporter_user_id,
          username: row.reporter_username,
          email: row.reporter_email || ""
        }
      : null;
    ticket.assigned_admin = row.assigned_admin_username
      ? {
          id: row.assigned_admin_id,
          username: row.assigned_admin_username
        }
      : null;
    ticket.assigned_admin_id = row.assigned_admin_id || null;
    ticket.duplicate_of_ticket_id = row.duplicate_of_ticket_id || null;
    ticket.internal_notes = row.internal_notes || "";
  }

  return ticket;
}

function feedbackSelectSql() {
  return `
    SELECT
      tickets.*,
      reporters.username AS reporter_username,
      reporters.email AS reporter_email,
      assignees.username AS assigned_admin_username
    FROM feedback_tickets tickets
    LEFT JOIN users reporters ON reporters.id = tickets.reporter_user_id
    LEFT JOIN users assignees ON assignees.id = tickets.assigned_admin_id
  `;
}

async function feedbackTicketById(ticketId) {
  return get(`${feedbackSelectSql()} WHERE tickets.id = ?`, [ticketId]);
}

function formatFeatureVoteOption(row = {}, currentUserVoteIds = new Set()) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description || "",
    status: row.status || "active",
    votes: row.vote_count || 0,
    user_has_voted: currentUserVoteIds.has(Number(row.id)),
    newest_vote_at: row.newest_vote_at || "",
    city: row.city || "Janesville",
    region: row.region || "WI",
    country_code: row.country_code || "US",
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function featureVoteOptionsForUser(userId = null) {
  const [options, userVotes] = await Promise.all([
    all(
      `
        SELECT
          options.*,
          COUNT(votes.id) AS vote_count,
          MAX(votes.created_at) AS newest_vote_at
        FROM feature_vote_options options
        LEFT JOIN feature_votes votes ON votes.option_id = options.id
        GROUP BY options.id
        ORDER BY
          CASE options.status
            WHEN 'trending' THEN 1
            WHEN 'active' THEN 2
            WHEN 'completed' THEN 3
            WHEN 'rejected' THEN 4
            ELSE 5
          END,
          vote_count DESC,
          options.title ASC
      `
    ),
    userId
      ? all("SELECT option_id FROM feature_votes WHERE user_id = ?", [userId])
      : Promise.resolve([])
  ]);
  const votedIds = new Set(userVotes.map((row) => Number(row.option_id)));
  return options.map((row) => formatFeatureVoteOption(row, votedIds));
}

function formatAnnouncement(row = {}, includeAdminFields = false) {
  const announcement = {
    id: row.id,
    title: row.title || "",
    body: row.body || "",
    announcement_type: row.announcement_type || "known_issue",
    status: row.status || "draft",
    scope: row.scope || "homepage_banner",
    city: row.city || "Janesville",
    region: row.region || "WI",
    country_code: row.country_code || "US",
    starts_at: row.starts_at || "",
    ends_at: row.ends_at || "",
    published_at: row.published_at || "",
    updated_at: row.updated_at || row.created_at || ""
  };

  if (includeAdminFields) {
    announcement.created_by = row.created_by || null;
    announcement.updated_by = row.updated_by || null;
    announcement.published_by = row.published_by || null;
  }

  return announcement;
}

function publicAnnouncementWhere(now = new Date().toISOString()) {
  return `
    status = 'published'
    AND (starts_at IS NULL OR starts_at = '' OR starts_at <= ?)
    AND (ends_at IS NULL OR ends_at = '' OR ends_at >= ?)
  `;
}

function cleanAnnouncementPayload(body = {}, adminUserId = null, existing = {}) {
  const now = new Date().toISOString();
  const status = cleanAnnouncementStatus(body.status ?? existing.status ?? "draft");
  const publishedAt = status === "published"
    ? (existing.published_at || now)
    : existing.published_at || null;

  return {
    title: cleanText(body.title ?? existing.title, 160),
    body: cleanText(body.body ?? existing.body, 1200),
    announcement_type: cleanAnnouncementType(body.announcement_type ?? existing.announcement_type),
    status,
    scope: cleanText(body.scope ?? existing.scope ?? "homepage_banner", 80) || "homepage_banner",
    city: cleanText(body.city ?? existing.city ?? "Janesville", 80) || "Janesville",
    region: cleanText(body.region ?? existing.region ?? "WI", 80) || "WI",
    country_code: cleanText(body.country_code ?? existing.country_code ?? "US", 8).toUpperCase() || "US",
    starts_at: body.starts_at ? normalizeOptionalTimestamp(body.starts_at) : existing.starts_at || null,
    ends_at: body.ends_at ? normalizeOptionalTimestamp(body.ends_at) : existing.ends_at || null,
    published_at: publishedAt,
    published_by: status === "published" ? (existing.published_by || adminUserId) : existing.published_by || null,
    created_by: existing.created_by || adminUserId,
    updated_by: adminUserId,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function parseJsonList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 180)).filter(Boolean);
  }

  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.map((item) => cleanText(item, 180)).filter(Boolean)
      : [];
  } catch (error) {
    return [];
  }
}

function cleanTextList(value, maxItems = 8) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, maxItems);
  }

  const raw = String(value || "");
  const trimmed = raw.trim();

  if (trimmed.startsWith("[")) {
    return parseJsonList(trimmed).slice(0, maxItems);
  }

  return raw
    .split(/\r?\n/)
    .map((item) => cleanText(item.replace(/^[-*]\s*/, ""), 180))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanHomepageServiceStatus(value) {
  return cleanEnum(value, HOMEPAGE_SERVICE_STATUSES, "online");
}

function cleanHomepageMaintenanceStatus(value) {
  return cleanEnum(value, HOMEPAGE_MAINTENANCE_STATUSES, "monitoring");
}

function cleanHomepageContentStatus(value) {
  return cleanEnum(value, HOMEPAGE_CONTENT_STATUSES, "draft");
}

function cleanHomepageIssueStatus(value) {
  return cleanEnum(value, HOMEPAGE_ISSUE_STATUSES, "investigating");
}

function cleanHomepageIssueVisibilityStatus(value) {
  return cleanEnum(value, HOMEPAGE_ISSUE_VISIBILITY_STATUSES, "draft");
}

function normalizeOptionalHomepageTimestamp(value, existing = null) {
  if (value === undefined) {
    return existing || null;
  }

  if (value === null || value === "") {
    return null;
  }

  return normalizeOptionalTimestamp(value);
}

function formatHomepageServiceStatus(row = {}, includeAdminFields = false) {
  const maintenance = {
    enabled: Boolean(row.maintenance_enabled),
    title: row.maintenance_title || "",
    message: row.maintenance_message || "",
    impact: row.maintenance_impact || "",
    start_at: row.maintenance_start_at || "",
    expected_end_at: row.maintenance_end_at || "",
    status: row.maintenance_status || "monitoring"
  };

  const formatted = {
    location: {
      city: "Janesville",
      region: "Wisconsin"
    },
    service_status: row.service_status || "online",
    version_label: row.version_label || "Early Access 0.2.0",
    current_focus: row.current_focus || "Adding and verifying Janesville grocery prices.",
    main_message: row.main_message || "Grocery Radar is live, but the radar is still filling up.",
    community_mission_title: row.community_mission_title || "Help fill the Janesville radar.",
    community_mission_body: row.community_mission_body || "One receipt can help shoppers across Janesville.",
    homepage_announcement: row.homepage_announcement || "",
    maintenance,
    published_at: row.published_at || "",
    updated_at: row.updated_at || row.published_at || row.created_at || ""
  };

  if (includeAdminFields) {
    formatted.id = row.id || 1;
    formatted.published_by = row.published_by || null;
    formatted.updated_by = row.updated_by || null;
    formatted.created_at = row.created_at || "";
  }

  return formatted;
}

function cleanHomepageServiceStatusPayload(body = {}, adminUserId = null, existing = {}) {
  const now = new Date().toISOString();
  const serviceStatus = cleanHomepageServiceStatus(body.service_status ?? existing.service_status ?? "online");
  const maintenanceEnabled = parseImportBoolean(body.maintenance_enabled ?? existing.maintenance_enabled);

  return {
    service_status: serviceStatus,
    version_label: cleanText(body.version_label ?? existing.version_label ?? "Early Access 0.2.0", 80) || "Early Access 0.2.0",
    current_focus: cleanText(body.current_focus ?? existing.current_focus, 240) || "Adding and verifying Janesville grocery prices.",
    main_message: cleanText(body.main_message ?? existing.main_message, 1200) || "Grocery Radar is live, but the radar is still filling up.",
    community_mission_title: cleanText(body.community_mission_title ?? existing.community_mission_title, 120) || "Help fill the Janesville radar.",
    community_mission_body: cleanText(body.community_mission_body ?? existing.community_mission_body, 700) || "One receipt can help shoppers across Janesville.",
    homepage_announcement: cleanText(body.homepage_announcement ?? existing.homepage_announcement, 400),
    maintenance_enabled: maintenanceEnabled ? 1 : 0,
    maintenance_title: cleanText(body.maintenance_title ?? existing.maintenance_title, 160),
    maintenance_message: cleanText(body.maintenance_message ?? existing.maintenance_message, 700),
    maintenance_impact: cleanText(body.maintenance_impact ?? existing.maintenance_impact, 500),
    maintenance_start_at: normalizeOptionalHomepageTimestamp(body.maintenance_start_at, existing.maintenance_start_at),
    maintenance_end_at: normalizeOptionalHomepageTimestamp(body.maintenance_end_at, existing.maintenance_end_at),
    maintenance_status: cleanHomepageMaintenanceStatus(body.maintenance_status ?? existing.maintenance_status ?? "monitoring"),
    published_at: existing.published_at || now,
    published_by: existing.published_by || adminUserId,
    updated_by: adminUserId,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function formatHomepagePatchNote(row = {}, includeAdminFields = false) {
  const formatted = {
    id: row.id,
    version: row.version_label || "",
    version_label: row.version_label || "",
    title: row.title || "",
    summary: row.summary || "",
    added: parseJsonList(row.added_json),
    changed: parseJsonList(row.changed_json),
    improved: parseJsonList(row.changed_json),
    fixed: parseJsonList(row.fixed_json),
    known_issues: parseJsonList(row.known_issues_json),
    next_focus: parseJsonList(row.next_focus_json),
    status: row.status || "draft",
    release_date: row.release_date || "",
    published_at: row.published_at || "",
    updated_at: row.updated_at || row.created_at || ""
  };

  if (includeAdminFields) {
    formatted.created_by = row.created_by || null;
    formatted.updated_by = row.updated_by || null;
    formatted.published_by = row.published_by || null;
    formatted.created_at = row.created_at || "";
    formatted.internal_commit_hash = row.internal_commit_hash || "";
  }

  return formatted;
}

function cleanHomepagePatchNotePayload(body = {}, adminUserId = null, existing = {}) {
  const now = new Date().toISOString();
  const status = cleanHomepageContentStatus(body.status ?? existing.status ?? "draft");
  const publishedAt = status === "published" ? (existing.published_at || now) : existing.published_at || null;

  return {
    version_label: cleanText(body.version ?? body.version_label ?? existing.version_label, 80),
    title: cleanText(body.title ?? existing.title, 160),
    summary: cleanText(body.summary ?? existing.summary, 700),
    added_json: JSON.stringify(cleanTextList(body.added ?? existing.added_json)),
    changed_json: JSON.stringify(cleanTextList(body.improved ?? body.changed ?? existing.changed_json)),
    fixed_json: JSON.stringify(cleanTextList(body.fixed ?? existing.fixed_json)),
    known_issues_json: JSON.stringify(cleanTextList(body.known_issues ?? existing.known_issues_json)),
    next_focus_json: JSON.stringify(cleanTextList(body.next_focus ?? existing.next_focus_json)),
    release_date: normalizeImportDate(body.release_date ?? existing.release_date ?? "", false) || (status === "published" ? now.slice(0, 10) : ""),
    internal_commit_hash: cleanText(body.internal_commit_hash ?? existing.internal_commit_hash, 80),
    status,
    published_at: publishedAt,
    published_by: status === "published" ? (existing.published_by || adminUserId) : existing.published_by || null,
    created_by: existing.created_by || adminUserId,
    updated_by: adminUserId,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function formatHomepageKnownIssue(row = {}, includeAdminFields = false) {
  const formatted = {
    id: row.id,
    title: row.title || "",
    status: row.issue_status || "investigating",
    description: row.description || "",
    workaround: row.workaround || "",
    visibility_status: row.visibility_status || "draft",
    opened_at: row.opened_at || "",
    last_updated_at: row.last_updated_at || row.updated_at || ""
  };

  if (includeAdminFields) {
    formatted.created_by = row.created_by || null;
    formatted.updated_by = row.updated_by || null;
    formatted.published_by = row.published_by || null;
    formatted.published_at = row.published_at || "";
    formatted.created_at = row.created_at || "";
    formatted.updated_at = row.updated_at || "";
  }

  return formatted;
}

function cleanHomepageKnownIssuePayload(body = {}, adminUserId = null, existing = {}) {
  const now = new Date().toISOString();
  const visibilityStatus = cleanHomepageIssueVisibilityStatus(body.visibility_status ?? existing.visibility_status ?? "draft");
  const openedAt = normalizeOptionalHomepageTimestamp(body.opened_at, existing.opened_at) || now;

  return {
    title: cleanText(body.title ?? existing.title, 160),
    issue_status: cleanHomepageIssueStatus(body.issue_status ?? body.status ?? existing.issue_status ?? "investigating"),
    description: cleanText(body.description ?? existing.description, 900),
    workaround: cleanText(body.workaround ?? existing.workaround, 500),
    visibility_status: visibilityStatus,
    opened_at: openedAt,
    last_updated_at: normalizeOptionalHomepageTimestamp(body.last_updated_at, existing.last_updated_at) || now,
    published_at: visibilityStatus === "published" ? (existing.published_at || now) : existing.published_at || null,
    published_by: visibilityStatus === "published" ? (existing.published_by || adminUserId) : existing.published_by || null,
    created_by: existing.created_by || adminUserId,
    updated_by: adminUserId,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

async function homepagePublicCounts() {
  const todayStart = todayStartIso();
  const [
    verifiedPrices,
    productsWithPrices,
    storesTracked,
    updatedToday,
    pendingProofs
  ] = await Promise.all([
    get("SELECT COUNT(*) AS count FROM price_reports WHERE status = 'approved'"),
    get("SELECT COUNT(DISTINCT product_id) AS count FROM price_reports WHERE status = 'approved' AND product_id IS NOT NULL"),
    get("SELECT COUNT(*) AS count FROM stores WHERE active = 1"),
    get(
      `
        SELECT COUNT(*) AS count
        FROM price_reports
        WHERE status = 'approved'
          AND COALESCE(source_checked_at, reviewed_at, submitted_at) >= ?
      `,
      [todayStart]
    ),
    get(
      `
        SELECT COUNT(*) AS count
        FROM price_import_batches
        WHERE created_by IS NOT NULL
          AND status IN ('needs_admin_review', 'import_draft', 'ready_for_review', 'needs_edit')
      `
    )
  ]);

  return {
    verified_prices: verifiedPrices?.count || 0,
    products_with_active_prices: productsWithPrices?.count || 0,
    janesville_stores_tracked: storesTracked?.count || 0,
    prices_updated_today: updatedToday?.count || 0,
    community_submissions_awaiting_review: pendingProofs?.count || 0
  };
}

async function homepageServiceData({ includeAdminFields = false } = {}) {
  const [statusRow, patchRows, issueRows, counts] = await Promise.all([
    get("SELECT * FROM homepage_service_status WHERE id = 1"),
    all(
      `
        SELECT *
        FROM homepage_patch_notes
        ${includeAdminFields ? "" : "WHERE status = 'published'"}
        ORDER BY ${includeAdminFields ? "CASE status WHEN 'draft' THEN 1 WHEN 'published' THEN 2 ELSE 3 END, COALESCE(updated_at, created_at) DESC" : "COALESCE(published_at, release_date, updated_at) DESC"}
        LIMIT ?
      `,
      [includeAdminFields ? 100 : 5]
    ),
    all(
      `
        SELECT *
        FROM homepage_known_issues
        ${includeAdminFields ? "" : "WHERE visibility_status = 'published'"}
        ORDER BY
          CASE issue_status
            WHEN 'fix_in_progress' THEN 1
            WHEN 'investigating' THEN 2
            WHEN 'identified' THEN 3
            WHEN 'monitoring' THEN 4
            WHEN 'resolved' THEN 5
            ELSE 6
          END,
          last_updated_at DESC
        LIMIT ?
      `,
      [includeAdminFields ? 100 : 10]
    ),
    homepagePublicCounts()
  ]);

  return {
    application_version: APP_VERSION,
    generated_at: new Date().toISOString(),
    service: formatHomepageServiceStatus(statusRow || {}, includeAdminFields),
    patch_notes: patchRows.map((row) => formatHomepagePatchNote(row, includeAdminFields)),
    known_issues: issueRows.map((row) => formatHomepageKnownIssue(row, includeAdminFields)),
    community_counts: counts,
    price_freshness_labels: ["Updated today", "Updated this week", "Aging", "Needs verification", "Expired"],
    privacy_note: "Public homepage data is aggregate-only. Pending submissions, private feedback, user identities, and raw proof files are not exposed."
  };
}

async function activeSessionCounts() {
  try {
    const row = await get(
      `
        SELECT
          COUNT(*) AS active_sessions,
          COUNT(DISTINCT json_extract(sess, '$.userId')) AS active_user_sessions
        FROM app_sessions
        WHERE expires_at > ?
      `,
      [Date.now()]
    );

    return {
      active_sessions: row.active_sessions || 0,
      active_user_sessions: row.active_user_sessions || 0
    };
  } catch (error) {
    return {
      active_sessions: 0,
      active_user_sessions: 0
    };
  }
}

function searchEventSummary(events = []) {
  const terms = new Map();
  const stores = new Map();
  const noResults = new Map();

  for (const event of events) {
    const term = cleanText(event.cart_item_name, 120).toLowerCase();
    const metadata = parseMetadataJson(event.metadata_json);

    if (term) {
      terms.set(term, (terms.get(term) || 0) + 1);
    }

    if (event.store_id && event.store_name) {
      stores.set(event.store_name, (stores.get(event.store_name) || 0) + 1);
    }

    if (term && Number(metadata.result_count || 0) === 0 && Number(metadata.product_count || 0) === 0) {
      noResults.set(term, (noResults.get(term) || 0) + 1);
    }
  }

  const top = (map, keyName) => [...map.entries()]
    .map(([value, count]) => ({ [keyName]: value, count }))
    .sort((a, b) => b.count - a.count || String(a[keyName]).localeCompare(String(b[keyName])))
    .slice(0, 20);

  return {
    most_searched_products: top(terms, "term"),
    most_searched_stores: top(stores, "store_name"),
    searches_with_no_results: top(noResults, "term")
  };
}

function scoreConfidenceRows(rows = []) {
  const weights = {
    high: 90,
    "medium-high": 75,
    medium: 60,
    low: 30
  };
  let total = 0;
  let count = 0;

  for (const row of rows) {
    const confidence = String(row.extraction_confidence || "").toLowerCase();
    const rowCount = Number(row.count) || 0;
    if (weights[confidence] && rowCount) {
      total += weights[confidence] * rowCount;
      count += rowCount;
    }
  }

  return count ? Math.round(total / count) : 0;
}

async function brokenImageSummary() {
  const rows = await all(
    `
      SELECT 'price_report' AS source, id, photo_path
      FROM price_reports
      WHERE COALESCE(photo_path, '') != ''
      UNION ALL
      SELECT 'price_import_batch' AS source, id, photo_path
      FROM price_import_batches
      WHERE COALESCE(photo_path, '') != ''
    `
  );
  const broken = rows.filter((row) => !uploadPathFromPhotoPath(row.photo_path));

  return {
    checked: rows.length,
    broken_count: broken.length,
    samples: broken.slice(0, 12).map((row) => ({
      source: row.source,
      id: row.id
    }))
  };
}

async function operationsUsers({ q = "", page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 10), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const params = [];
  const filters = ["1 = 1"];

  if (q) {
    filters.push("(lower(users.username) LIKE ? OR lower(COALESCE(users.email, '')) LIKE ?)");
    params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
  }

  const rows = await all(
    `
      SELECT
        users.*,
        (SELECT MAX(created_at) FROM user_login_events WHERE user_id = users.id AND success = 1) AS last_login_at,
        (SELECT COUNT(*) FROM price_reports WHERE user_id = users.id) AS submission_count,
        (SELECT COUNT(*) FROM price_reports WHERE user_id = users.id AND status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM price_reports WHERE user_id = users.id AND status = 'rejected') AS rejected_count,
        (SELECT COUNT(*) FROM price_import_batches WHERE created_by = users.id AND duplicate_scope != '') AS duplicate_count,
        (SELECT COUNT(*) FROM price_import_batches WHERE created_by = users.id AND status = 'needs_clearer_photo') AS needs_clearer_count,
        (SELECT COUNT(*) FROM feedback_tickets WHERE reporter_user_id = users.id AND priority IN ('high', 'urgent')) AS warning_count
      FROM users
      WHERE ${filters.join(" AND ")}
      ORDER BY users.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, offset]
  );
  const countRow = await get(
    `SELECT COUNT(*) AS count FROM users WHERE ${filters.join(" AND ")}`,
    params
  );

  return {
    users: rows.map(formatUserSummary),
    page: safePage,
    limit: safeLimit,
    total: countRow.count || 0
  };
}

async function operationsUserDetail(userId) {
  const user = await get(
    `
      SELECT
        users.*,
        (SELECT MAX(created_at) FROM user_login_events WHERE user_id = users.id AND success = 1) AS last_login_at,
        (SELECT COUNT(*) FROM price_reports WHERE user_id = users.id) AS submission_count,
        (SELECT COUNT(*) FROM price_reports WHERE user_id = users.id AND status = 'approved') AS approved_count,
        (SELECT COUNT(*) FROM price_reports WHERE user_id = users.id AND status = 'rejected') AS rejected_count,
        (SELECT COUNT(*) FROM price_import_batches WHERE created_by = users.id AND duplicate_scope != '') AS duplicate_count,
        (SELECT COUNT(*) FROM price_import_batches WHERE created_by = users.id AND status = 'needs_clearer_photo') AS needs_clearer_count,
        (SELECT COUNT(*) FROM feedback_tickets WHERE reporter_user_id = users.id AND priority IN ('high', 'urgent')) AS warning_count
      FROM users
      WHERE users.id = ?
    `,
    [userId]
  );

  if (!user) {
    return null;
  }

  const [submissions, imports, notes, loginHistory, verificationHistory, feedback] = await Promise.all([
    all(
      `
        SELECT id, item_name, category, price, status, proof_type, submitted_at, reviewed_at
        FROM price_reports
        WHERE user_id = ?
        ORDER BY submitted_at DESC
        LIMIT 50
      `,
      [userId]
    ),
    all(
      `
        SELECT id, source_type, proof_type, status, review_priority, created_at, updated_at
        FROM price_import_batches
        WHERE created_by = ?
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [userId]
    ),
    all(
      `
        SELECT notes.*, admins.username AS admin_username
        FROM user_admin_notes notes
        LEFT JOIN users admins ON admins.id = notes.admin_user_id
        WHERE notes.user_id = ?
        ORDER BY notes.created_at DESC
        LIMIT 50
      `,
      [userId]
    ),
    all(
      `
        SELECT success, ip_address, user_agent, created_at
        FROM user_login_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [userId]
    ),
    all(
      `
        SELECT event_type, ip_address, user_agent, created_at
        FROM email_verification_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `,
      [userId]
    ),
    all(
      `
        ${feedbackSelectSql()}
        WHERE tickets.reporter_user_id = ?
        ORDER BY tickets.updated_at DESC
        LIMIT 50
      `,
      [userId]
    )
  ]);

  return {
    user: formatUserSummary(user),
    activity_history: [
      ...submissions.map((row) => ({
        type: "price_submission",
        title: row.item_name,
        status: row.status,
        created_at: row.submitted_at,
        id: row.id
      })),
      ...imports.map((row) => ({
        type: "proof_submission",
        title: row.source_type,
        status: row.status,
        created_at: row.created_at,
        id: row.id
      })),
      ...feedback.map((row) => ({
        type: "feedback",
        title: row.title,
        status: row.status,
        created_at: row.created_at,
        id: row.id
      }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 75),
    price_submissions: submissions,
    proof_submissions: imports,
    comments: notes.map((row) => ({
      id: row.id,
      note_type: row.note_type,
      note: row.note,
      admin_username: row.admin_username || "",
      created_at: row.created_at
    })),
    reports: submissions,
    account_actions: notes.filter((row) => /ban|moderation|admin|role|reset|delete/i.test(row.note_type || row.note || "")),
    verification_history: verificationHistory,
    login_history: loginHistory,
    feedback: feedback.map((row) => formatFeedbackTicket(row, true))
  };
}

async function operationsFeedback({ q = "", status = "", category = "", page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 10), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;
  const filters = ["1 = 1"];
  const params = [];

  if (q) {
    filters.push("(lower(tickets.title) LIKE ? OR lower(tickets.message) LIKE ? OR lower(COALESCE(reporters.username, '')) LIKE ?)");
    params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
  }

  if (FEEDBACK_STATUSES.includes(status)) {
    filters.push("tickets.status = ?");
    params.push(status);
  }

  if (FEEDBACK_CATEGORIES.includes(category)) {
    filters.push("tickets.category = ?");
    params.push(category);
  }

  const rows = await all(
    `
      ${feedbackSelectSql()}
      WHERE ${filters.join(" AND ")}
      ORDER BY
        CASE tickets.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        tickets.updated_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, offset]
  );
  const countRow = await get(
    `
      SELECT COUNT(*) AS count
      FROM feedback_tickets tickets
      LEFT JOIN users reporters ON reporters.id = tickets.reporter_user_id
      WHERE ${filters.join(" AND ")}
    `,
    params
  );

  return {
    tickets: rows.map((row) => formatFeedbackTicket(row, true)),
    page: safePage,
    limit: safeLimit,
    total: countRow.count || 0
  };
}

async function updateFeedbackTicket(ticketId, body = {}, adminUser, request) {
  const ticket = await feedbackTicketById(ticketId);

  if (!ticket) {
    return null;
  }

  const now = new Date().toISOString();
  const action = cleanText(body.action || "update", 40).toLowerCase();
  const status = action === "close"
    ? "closed"
    : action === "reopen" ? "open"
      : action === "merge" ? "merged"
        : Object.prototype.hasOwnProperty.call(body, "status") ? cleanFeedbackStatus(body.status)
          : ticket.status;
  const priority = Object.prototype.hasOwnProperty.call(body, "priority")
    ? cleanFeedbackPriority(body.priority)
    : ticket.priority;
  const assignedAdminId = Object.prototype.hasOwnProperty.call(body, "assigned_admin_id")
    ? Number.parseInt(body.assigned_admin_id, 10) || null
    : ticket.assigned_admin_id || null;
  const duplicateOf = action === "merge"
    ? Number.parseInt(body.duplicate_of_ticket_id, 10) || null
    : ticket.duplicate_of_ticket_id || null;
  const internalNote = cleanText(body.internal_notes || body.internal_note || "", 1000);
  const publicResponse = Object.prototype.hasOwnProperty.call(body, "public_response")
    ? cleanText(body.public_response, 1000)
    : ticket.public_response || "";

  await run(
    `
      UPDATE feedback_tickets
      SET status = ?,
          priority = ?,
          assigned_admin_id = ?,
          duplicate_of_ticket_id = ?,
          public_response = ?,
          internal_notes = ?,
          updated_at = ?,
          closed_at = CASE WHEN ? = 'closed' THEN COALESCE(closed_at, ?) ELSE closed_at END,
          closed_by = CASE WHEN ? = 'closed' THEN ? ELSE closed_by END
      WHERE id = ?
    `,
    [
      status,
      priority,
      assignedAdminId,
      duplicateOf,
      publicResponse,
      internalNote || ticket.internal_notes || "",
      now,
      status,
      now,
      status,
      adminUser.id,
      ticketId
    ]
  );

  await run(
    `
      INSERT INTO feedback_ticket_updates (
        ticket_id,
        actor_user_id,
        update_type,
        old_value,
        new_value,
        internal_note,
        public_response,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ticketId,
      adminUser.id,
      action,
      ticket.status,
      status,
      internalNote,
      publicResponse,
      now
    ]
  );

  await recordAdminAudit({
    adminUserId: adminUser.id,
    action: `feedback_${action}`,
    method: request.method,
    path: request.originalUrl,
    statusCode: 200,
    ipAddress: requestIpAddress(request),
    userAgent: requestUserAgent(request),
    affectedType: "feedback_ticket",
    affectedId: ticketId
  });

  return feedbackTicketById(ticketId);
}

async function publicFeedbackForUser(userId) {
  const rows = await all(
    `
      ${feedbackSelectSql()}
      WHERE tickets.reporter_user_id = ?
      ORDER BY tickets.updated_at DESC
      LIMIT 50
    `,
    [userId]
  );
  return rows.map(formatFeedbackTicket);
}

async function operationsSearchAnalytics() {
  const { todayStart, weekStart, monthStart } = dateWindowStarts();
  const searchEvents = await all(
    `
      SELECT analytics_events.*, stores.name AS store_name
      FROM analytics_events
      LEFT JOIN stores ON stores.id = analytics_events.store_id
      WHERE analytics_events.event_type = 'search_performed'
        AND analytics_events.created_at >= ?
      ORDER BY analytics_events.created_at DESC
      LIMIT 5000
    `,
    [monthStart]
  );
  const summary = searchEventSummary(searchEvents);

  return {
    searches_today: searchEvents.filter((event) => event.created_at >= todayStart).length,
    searches_this_week: searchEvents.filter((event) => event.created_at >= weekStart).length,
    searches_this_month: searchEvents.length,
    trending_searches: summary.most_searched_products.slice(0, 8),
    ...summary
  };
}

async function operationsPriceAnalytics() {
  const { todayStart, weekStart } = dateWindowStarts();
  const [
    counts,
    duplicateRows,
    approvalStats,
    confidenceRows,
    contributors,
    productsWithoutPrices,
    productsNeedingUpdates,
    oldestPriceByStoreRows,
    categoryCoverageRows,
    totalProductsRow
  ] = await Promise.all([
    get(
      `
        SELECT
          SUM(CASE WHEN submitted_at >= ? THEN 1 ELSE 0 END) AS submitted_today,
          SUM(CASE WHEN status = 'approved' AND reviewed_at >= ? THEN 1 ELSE 0 END) AS approved_today,
          SUM(CASE WHEN status = 'rejected' AND reviewed_at >= ? THEN 1 ELSE 0 END) AS rejected_today
        FROM price_reports
      `,
      [todayStart, todayStart, todayStart]
    ),
    get(
      `
        SELECT
          (SELECT COUNT(*) FROM price_import_batches WHERE COALESCE(duplicate_scope, '') != '' AND created_at >= ?) +
          (SELECT COUNT(*) FROM price_import_rows WHERE COALESCE(duplicate_warning, '') != '' AND updated_at >= ?) AS duplicate_detections
      `,
      [weekStart, weekStart]
    ),
    get(
      `
        SELECT AVG((julianday(reviewed_at) - julianday(submitted_at)) * 86400.0) AS avg_seconds
        FROM price_reports
        WHERE status = 'approved'
          AND reviewed_at IS NOT NULL
          AND submitted_at IS NOT NULL
      `
    ),
    all(
      `
        SELECT extraction_confidence, COUNT(*) AS count
        FROM price_import_rows
        WHERE created_at >= ?
        GROUP BY extraction_confidence
      `,
      [weekStart]
    ),
    all(
      `
        SELECT users.id, users.username, COUNT(price_reports.id) AS approved_count
        FROM price_reports
        JOIN users ON users.id = price_reports.user_id
        WHERE price_reports.status = 'approved'
        GROUP BY users.id
        ORDER BY approved_count DESC, users.username ASC
        LIMIT 12
      `
    ),
    all(
      `
        SELECT id, display_name, category
        FROM products
        WHERE status = 'active'
          AND NOT EXISTS (
            SELECT 1 FROM price_reports WHERE price_reports.product_id = products.id AND price_reports.status = 'approved'
          )
        ORDER BY display_name ASC
        LIMIT 25
      `
    ),
    all(
      `
        SELECT id, display_name, category, last_reported_at
        FROM (
          SELECT
            products.id,
            products.display_name,
            products.category,
            MAX(price_reports.submitted_at) AS last_reported_at
          FROM products
          LEFT JOIN price_reports ON price_reports.product_id = products.id AND price_reports.status = 'approved'
          WHERE products.status = 'active'
          GROUP BY products.id
        )
        WHERE last_reported_at IS NULL OR last_reported_at < ?
        ORDER BY COALESCE(last_reported_at, '') ASC, display_name ASC
        LIMIT 25
      `,
      [new Date(Date.now() - 1000 * 60 * 60 * 24 * 21).toISOString()]
    ),
    all(
      `
        SELECT
          stores.id AS store_id,
          stores.name AS store_name,
          MIN(COALESCE(price_reports.source_checked_at, price_reports.reviewed_at, price_reports.submitted_at)) AS oldest_price_at,
          COUNT(price_reports.id) AS approved_price_count
        FROM stores
        JOIN price_reports ON price_reports.store_id = stores.id
        WHERE price_reports.status = 'approved'
        GROUP BY stores.id
        ORDER BY oldest_price_at ASC
        LIMIT 20
      `
    ),
    all(
      `
        SELECT
          products.category,
          COUNT(DISTINCT products.id) AS products,
          COUNT(DISTINCT price_reports.product_id) AS products_with_prices
        FROM products
        LEFT JOIN price_reports ON price_reports.product_id = products.id AND price_reports.status = 'approved'
        WHERE products.status = 'active'
        GROUP BY products.category
        ORDER BY products.category ASC
      `
    ),
    get("SELECT COUNT(*) AS count FROM products WHERE status = 'active'")
  ]);
  const totalProducts = totalProductsRow.count || 0;

  return {
    prices_submitted_today: counts.submitted_today || 0,
    approved_today: counts.approved_today || 0,
    rejected_today: counts.rejected_today || 0,
    duplicate_detections: duplicateRows.duplicate_detections || 0,
    average_approval_time_seconds: Math.round(approvalStats.avg_seconds || 0),
    average_approval_time_label: secondsLabel(approvalStats.avg_seconds || 0),
    average_parser_confidence: scoreConfidenceRows(confidenceRows),
    most_active_contributors: contributors,
    store_coverage_percentages: [],
    category_coverage_percentages: categoryCoverageRows.map((row) => ({
      category: row.category || "other",
      coverage_percent: row.products ? Math.round(((row.products_with_prices || 0) / row.products) * 100) : 0,
      products: row.products || 0,
      products_with_prices: row.products_with_prices || 0
    })),
    products_without_prices: productsWithoutPrices,
    products_needing_updates: productsNeedingUpdates,
    oldest_price_by_store: oldestPriceByStoreRows,
    total_active_products: totalProducts
  };
}

async function operationsStoreHealth(totalProducts = 0) {
  const stores = await all(
    `
      SELECT
        stores.id,
        stores.name,
        stores.city,
        stores.state,
        COUNT(DISTINCT price_reports.product_id) AS products_with_prices,
        COUNT(price_reports.id) AS verified_prices,
        MAX(COALESCE(price_reports.source_checked_at, price_reports.reviewed_at, price_reports.submitted_at)) AS last_update,
        AVG((julianday('now') - julianday(COALESCE(price_reports.source_checked_at, price_reports.reviewed_at, price_reports.submitted_at)))) AS average_age_days
      FROM stores
      LEFT JOIN price_reports
        ON price_reports.store_id = stores.id
       AND price_reports.status = 'approved'
      WHERE stores.active = 1
      GROUP BY stores.id
      ORDER BY stores.name ASC
    `
  );
  const categoriesByStore = await all(
    `
      SELECT store_id, category, COUNT(*) AS count
      FROM price_reports
      WHERE status = 'approved'
      GROUP BY store_id, category
    `
  );
  const categoryMap = new Map();

  for (const row of categoriesByStore) {
    const set = categoryMap.get(row.store_id) || new Set();
    if (row.category) set.add(row.category);
    categoryMap.set(row.store_id, set);
  }

  return stores.map((store) => {
    const storeCategories = categoryMap.get(store.id) || new Set();
    const coverage = totalProducts ? Math.round(((store.products_with_prices || 0) / totalProducts) * 100) : 0;
    return {
      id: store.id,
      name: store.name,
      city: store.city,
      region: store.state,
      coverage_percent: coverage,
      products: store.products_with_prices || 0,
      verified_prices: store.verified_prices || 0,
      average_age_days: Math.round(Number(store.average_age_days || 0)),
      missing_categories: CATEGORIES.filter((category) => !storeCategories.has(category)).slice(0, 8),
      missing_popular_products: [],
      last_update: store.last_update || "",
      needs_attention: coverage < 50 || !store.last_update || Number(store.average_age_days || 0) > 21
    };
  });
}

async function operationsEventFeed() {
  const [users, verifications, imports, reports, feedback, votes, audit, errors] = await Promise.all([
    all("SELECT id, username, created_at FROM users ORDER BY created_at DESC LIMIT 20"),
    all(
      `
        SELECT events.*, users.username
        FROM email_verification_events events
        LEFT JOIN users ON users.id = events.user_id
        WHERE events.event_type = 'email_verified'
        ORDER BY events.created_at DESC
        LIMIT 20
      `
    ),
    all(
      `
        SELECT batches.id, batches.source_type, batches.proof_type, batches.status, batches.created_at, users.username
        FROM price_import_batches batches
        LEFT JOIN users ON users.id = batches.created_by
        ORDER BY batches.created_at DESC
        LIMIT 30
      `
    ),
    all(
      `
        SELECT price_reports.id, price_reports.item_name, price_reports.status, price_reports.reviewed_at, stores.name AS store_name
        FROM price_reports
        LEFT JOIN stores ON stores.id = price_reports.store_id
        WHERE price_reports.status IN ('approved', 'rejected')
        ORDER BY price_reports.reviewed_at DESC
        LIMIT 30
      `
    ),
    all(
      `
        ${feedbackSelectSql()}
        ORDER BY tickets.created_at DESC
        LIMIT 20
      `
    ),
    all(
      `
        SELECT votes.id, votes.created_at, users.username, options.title
        FROM feature_votes votes
        LEFT JOIN users ON users.id = votes.user_id
        LEFT JOIN feature_vote_options options ON options.id = votes.option_id
        ORDER BY votes.created_at DESC
        LIMIT 20
      `
    ),
    all(
      `
        SELECT audit.*, users.username
        FROM admin_audit_log audit
        LEFT JOIN users ON users.id = audit.admin_user_id
        ORDER BY audit.created_at DESC
        LIMIT 30
      `
    ),
    all("SELECT id, error_type, severity, message, created_at FROM operations_errors ORDER BY created_at DESC LIMIT 20")
  ]);

  return [
    ...users.map((row) => ({ type: "new_user_registered", title: "New user registered", message: row.username, created_at: row.created_at, related_type: "user", related_id: row.id })),
    ...verifications.map((row) => ({ type: "email_verified", title: "Email verified", message: row.username || "User", created_at: row.created_at, related_type: "user", related_id: row.user_id })),
    ...imports.map((row) => ({
      type: `${row.source_type || row.proof_type || "proof"}_uploaded`,
      title: row.source_type === "weekly_ad" ? "Weekly ad imported" : row.source_type === "shelf_tag" ? "Shelf tag uploaded" : row.source_type === "receipt" ? "Receipt uploaded" : "Proof uploaded",
      message: `${row.username || "Admin/user"} submitted ${row.source_type || row.proof_type || "proof"} (${row.status}).`,
      created_at: row.created_at,
      related_type: "price_import_batch",
      related_id: row.id
    })),
    ...reports.filter((row) => row.reviewed_at).map((row) => ({
      type: row.status === "approved" ? "price_approved" : "price_rejected",
      title: row.status === "approved" ? "Price approved" : "Price rejected",
      message: `${row.item_name} ${row.store_name ? `at ${row.store_name}` : ""}`,
      created_at: row.reviewed_at,
      related_type: "report",
      related_id: row.id
    })),
    ...feedback.map((row) => ({ type: "feedback_submitted", title: "Feedback submitted", message: row.title, created_at: row.created_at, related_type: "feedback_ticket", related_id: row.id })),
    ...votes.map((row) => ({ type: "feature_vote", title: "Feature vote", message: `${row.username || "User"} voted for ${row.title || "a feature"}.`, created_at: row.created_at, related_type: "feature_vote", related_id: row.id })),
    ...audit.map((row) => ({ type: row.action === "POST /api/auth/login" ? "admin_login" : "admin_action", title: "Admin action", message: `${row.username || "Admin"}: ${row.action}`, created_at: row.created_at, related_type: "audit_log", related_id: row.id })),
    ...errors.map((row) => ({ type: "system_error", title: `${row.severity} system event`, message: `${row.error_type}: ${row.message}`, created_at: row.created_at, related_type: "operations_error", related_id: row.id }))
  ]
    .filter((event) => event.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 80);
}

async function operationsErrorCenter() {
  const [errors, failedEmails, parserFailures, brokenImages] = await Promise.all([
    all(
      `
        SELECT id, error_type, severity, message, source, related_type, related_id, status, created_at, resolved_at
        FROM operations_errors
        ORDER BY created_at DESC
        LIMIT 100
      `
    ),
    get("SELECT COUNT(*) AS count FROM email_verification_events WHERE event_type LIKE '%failed%'"),
    get("SELECT COUNT(*) AS count FROM price_import_rows WHERE extraction_confidence = 'low' AND status IN ('import_draft', 'ready_for_review', 'needs_edit')"),
    brokenImageSummary()
  ]);

  return {
    failed_emails: failedEmails.count || 0,
    failed_uploads: errors.filter((error) => error.error_type === "upload_failed").length,
    parser_failures: parserFailures.count || 0,
    broken_images: brokenImages,
    unhandled_exceptions: errors.filter((error) => error.error_type === "unhandled_exception").length,
    database_errors: errors.filter((error) => error.error_type === "database_error").length,
    api_failures: errors.filter((error) => error.error_type === "api_failure").length,
    rate_limiting: errors.filter((error) => error.error_type === "rate_limited").length,
    recent_errors: errors
  };
}

async function communityPulse(searchAnalytics, storeHealth) {
  const { todayStart } = dateWindowStarts();
  const [todaySearches, todayReports] = await Promise.all([
    all(
      `
        SELECT cart_item_name, COUNT(*) AS count
        FROM analytics_events
        WHERE event_type = 'search_performed'
          AND created_at >= ?
          AND COALESCE(cart_item_name, '') != ''
        GROUP BY lower(cart_item_name)
        ORDER BY count DESC
        LIMIT 5
      `,
      [todayStart]
    ),
    all(
      `
        SELECT stores.name, COUNT(price_reports.id) AS count
        FROM price_reports
        JOIN stores ON stores.id = price_reports.store_id
        WHERE price_reports.status = 'approved'
          AND price_reports.reviewed_at >= ?
        GROUP BY stores.id
        ORDER BY count DESC
        LIMIT 5
      `,
      [todayStart]
    )
  ]);
  const insights = [];

  for (const row of todaySearches) {
    insights.push(`${row.count} user${row.count === 1 ? "" : "s"} searched ${row.cart_item_name} today.`);
  }

  for (const row of todayReports) {
    insights.push(`${row.name} gained ${row.count} new approved price${row.count === 1 ? "" : "s"} today.`);
  }

  for (const store of storeHealth.filter((entry) => entry.coverage_percent >= 90).slice(0, 3)) {
    insights.push(`${store.name} reached ${store.coverage_percent}% coverage.`);
  }

  const trending = searchAnalytics.trending_searches?.[0];
  if (trending) {
    insights.push(`${trending.term} is trending.`);
  }

  return insights.slice(0, 12);
}

async function operationsOverview(adminUser) {
  const { todayStart, weekStart } = dateWindowStarts();
  const now = new Date().toISOString();
  const email = emailStatus();
  let databaseOk = false;
  let storageOk = false;

  try {
    await get("SELECT 1 AS ok");
    databaseOk = true;
  } catch (error) {
    await recordOperationsError({ error_type: "database_error", severity: "critical", message: error.message, source: "operations_overview" });
  }

  try {
    fs.accessSync(UPLOAD_DIR, fs.constants.W_OK);
    storageOk = true;
  } catch (error) {
    await recordOperationsError({ error_type: "storage_error", severity: "critical", message: "Upload storage is not writable.", source: "operations_overview" });
  }

  const [
    sessions,
    liveCounts,
    userCounts,
    recentRegistrations,
    recentLogins,
    lastBackup,
    searchAnalytics,
    priceAnalytics,
    feedback,
    featureVotes,
    announcements,
    homepageService,
    auditLog
  ] = await Promise.all([
    activeSessionCounts(),
    get(
      `
        SELECT
          SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS current_online_users,
          SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS active_15_min
        FROM users
      `,
      [new Date(Date.now() - 1000 * 60 * 5).toISOString(), new Date(Date.now() - 1000 * 60 * 15).toISOString()]
    ),
    get(
      `
        SELECT
          COUNT(*) AS registered_users,
          SUM(CASE WHEN is_email_verified = 1 THEN 1 ELSE 0 END) AS verified_users,
          SUM(CASE WHEN is_email_verified = 0 THEN 1 ELSE 0 END) AS pending_verification,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_users_today,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_users_this_week
        FROM users
      `,
      [todayStart, weekStart]
    ),
    all("SELECT id, username, email, created_at FROM users ORDER BY created_at DESC LIMIT 10"),
    all(
      `
        SELECT events.created_at, users.id, users.username, users.email, users.is_admin, users.is_super_admin
        FROM user_login_events events
        JOIN users ON users.id = events.user_id
        WHERE events.success = 1
        ORDER BY events.created_at DESC
        LIMIT 15
      `
    ),
    get("SELECT * FROM backup_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1"),
    operationsSearchAnalytics(),
    operationsPriceAnalytics(),
    operationsFeedback({ limit: 25 }),
    featureVoteOptionsForUser(adminUser?.id),
    all("SELECT * FROM announcements ORDER BY updated_at DESC LIMIT 20"),
    homepageServiceData({ includeAdminFields: true }),
    all(
      `
        SELECT audit.*, users.username
        FROM admin_audit_log audit
        LEFT JOIN users ON users.id = audit.admin_user_id
        ORDER BY audit.created_at DESC
        LIMIT 50
      `
    )
  ]);
  const totalProducts = priceAnalytics.total_active_products || 0;
  const storeHealth = await operationsStoreHealth(totalProducts);
  priceAnalytics.store_coverage_percentages = storeHealth.map((store) => ({
    store_id: store.id,
    store_name: store.name,
    coverage_percent: store.coverage_percent,
    products: store.products,
    verified_prices: store.verified_prices
  }));
  const [eventFeed, errorCenter, usersPreview] = await Promise.all([
    operationsEventFeed(),
    operationsErrorCenter(),
    operationsUsers({ limit: 25 })
  ]);
  const returningUsersRow = await get(
    `
      SELECT COUNT(DISTINCT events.user_id) AS returning_users
      FROM user_login_events events
      JOIN users ON users.id = events.user_id
      WHERE events.created_at >= ?
        AND users.created_at < ?
    `,
    [todayStart, todayStart]
  );
  const averageSessionRow = await get(
    `
      SELECT AVG((julianday(users.last_seen_at) - julianday(latest_login.created_at)) * 86400.0) AS avg_seconds
      FROM users
      JOIN (
        SELECT user_id, MAX(created_at) AS created_at
        FROM user_login_events
        WHERE success = 1
        GROUP BY user_id
      ) latest_login ON latest_login.user_id = users.id
      WHERE users.last_seen_at IS NOT NULL
        AND users.last_seen_at >= latest_login.created_at
    `
  );
  const peakUsersRow = await get(
    `
      SELECT MAX(count) AS peak_users
      FROM (
        SELECT strftime('%Y-%m-%dT%H', created_at) AS hour_bucket, COUNT(DISTINCT user_id) AS count
        FROM user_login_events
        WHERE created_at >= ?
          AND success = 1
        GROUP BY hour_bucket
      )
    `,
    [todayStart]
  );

  return {
    generated_at: now,
    is_super_admin: Boolean(adminUser && isSuperAdminAccount(adminUser)),
    system_health: {
      website_status: hasTailwindBuild()
        ? statusIndicator("green", "Website build is present")
        : statusIndicator("red", "Tailwind build is missing"),
      database_status: databaseOk
        ? statusIndicator("green", "Database reachable")
        : statusIndicator("red", "Database check failed"),
      email_smtp_status: email.configured
        ? statusIndicator("green", "SMTP configured", { provider: email.provider })
        : statusIndicator("yellow", "SMTP incomplete", { missing: email.technical?.missing || [] }),
      storage_status: storageOk
        ? statusIndicator("green", "Upload storage writable")
        : statusIndicator("red", "Upload storage not writable"),
      background_jobs: statusIndicator("yellow", "In-process cleanup jobs only", {
        note: "Session cleanup and price expiry run in-process. No separate worker is configured."
      }),
      last_successful_backup: lastBackup
        ? statusIndicator("green", "Backup recorded", { created_at: lastBackup.created_at })
        : statusIndicator("yellow", "No successful backup recorded"),
      current_version: currentVersion(),
      current_commit_hash: currentCommitHash(),
      server_uptime_seconds: Math.round(process.uptime()),
      server_uptime_label: secondsLabel(process.uptime()),
      render_environment: {
        is_render: Boolean(process.env.RENDER),
        service_name: cleanText(process.env.RENDER_SERVICE_NAME || "", 120),
        node_env: process.env.NODE_ENV || "development"
      }
    },
    live_activity: {
      current_online_users: liveCounts.current_online_users || 0,
      visitors_today: await visitorCountSince(todayStart),
      visitors_this_week: await visitorCountSince(weekStart),
      registered_users: userCounts.registered_users || 0,
      verified_users: userCounts.verified_users || 0,
      pending_verification: userCounts.pending_verification || 0,
      new_users_today: userCounts.new_users_today || 0,
      new_users_this_week: userCounts.new_users_this_week || 0,
      returning_users: returningUsersRow.returning_users || 0,
      average_session_length_seconds: Math.round(averageSessionRow.avg_seconds || 0),
      average_session_length_label: secondsLabel(averageSessionRow.avg_seconds || 0),
      current_active_sessions: sessions.active_sessions || 0,
      active_user_sessions: sessions.active_user_sessions || 0,
      peak_users_today: peakUsersRow.peak_users || 0,
      most_recent_login: recentLogins[0] || null,
      recent_registrations: recentRegistrations,
      recent_logins: recentLogins
    },
    users: usersPreview,
    feedback,
    feature_voting: {
      options: featureVotes,
      trending: featureVotes.filter((option) => option.status === "trending").slice(0, 10),
      newest: featureVotes.slice().sort((a, b) => new Date(b.newest_vote_at || b.created_at) - new Date(a.newest_vote_at || a.created_at)).slice(0, 10),
      completed: featureVotes.filter((option) => option.status === "completed"),
      rejected: featureVotes.filter((option) => option.status === "rejected")
    },
    search_analytics: searchAnalytics,
    price_analytics: priceAnalytics,
    store_health: storeHealth,
    event_feed: eventFeed,
    error_center: errorCenter,
    announcements: announcements.map((row) => formatAnnouncement(row, true)),
    homepage_service: homepageService,
    community_pulse: await communityPulse(searchAnalytics, storeHealth),
    audit_log: auditLog.map((row) => ({
      id: row.id,
      admin_user_id: row.admin_user_id || null,
      admin_username: row.username || "",
      action: row.action,
      method: row.method || "",
      path: row.path || "",
      status_code: row.status_code || null,
      affected_type: row.affected_type || "",
      affected_id: row.affected_id || null,
      created_at: row.created_at
    })),
    future_ready: {
      city: "Janesville",
      region: "WI",
      country_code: "US",
      note: "New Operations tables include city, region, and country scope fields for future multi-region support."
    }
  };
}

app.use("/api/admin", adminAuditMiddleware);
app.use("/api/admin", adminV2RoleGuard);

app.get("/health", asyncRoute(async (request, response) => {
  let databaseReachable = false;

  try {
    await get("SELECT 1 AS ok");
    databaseReachable = true;
  } catch (error) {
    databaseReachable = false;
  }

  response.status(databaseReachable ? 200 : 503).json({
    ok: databaseReachable,
    app: "Grocery Radar Janesville",
    version: APP_VERSION,
    domain: APP_DOMAIN,
    environment: process.env.NODE_ENV || "development",
    database_reachable: databaseReachable,
    timestamp: new Date().toISOString()
  });
}));

app.get("/", (request, response) => {
  sendPublicApp(response);
});

async function sendAdminApp(request, response) {
  const access = await getAdminAccess(request);

  if (!access.allowed) {
    response.status(403).send(authPage(
      "Admin Access Required",
      "You must be an admin user or provide the ADMIN_PIN development fallback to view this page."
    ));
    return;
  }

  response.sendFile(path.join(PUBLIC_DIR, "admin.html"));
}

app.get("/admin.html", asyncRoute(sendAdminApp));
app.get(/^\/admin(?:\/.*)?$/, asyncRoute(sendAdminApp));

app.get("/uploads/:filename", asyncRoute(sendPublicUploadFile));
app.get("/api/admin/uploads/:filename", requireAdminAccess, asyncRoute(sendAdminUploadFile));

app.get("/api/stores", asyncRoute(async (request, response) => {
  const stores = await all(
    `
      SELECT stores.id, stores.name, stores.address, stores.city, stores.state, stores.store_type, stores.active,
        COUNT(DISTINCT CASE WHEN ${publicPriceEligibilitySql("pr")} AND COALESCE(users.account_status, 'active') NOT IN ('suspended','banned','deleted','deactivated') THEN pr.id END) AS current_price_count
      FROM stores
      LEFT JOIN price_reports pr ON pr.store_id = stores.id
      LEFT JOIN users ON users.id = pr.user_id
      WHERE stores.active = 1
      GROUP BY stores.id
      ORDER BY stores.name
    `
  );

  response.json({ stores });
}));

app.get("/api/stores/:id", asyncRoute(async (request, response) => {
  const storeId = Number.parseInt(request.params.id, 10);
  const store = await get("SELECT id, name, address, city, state, store_type FROM stores WHERE id = ? AND active = 1", [storeId]);
  if (!store) { response.status(404).json({ error: "Store was not found." }); return; }
  const rows = await all(`SELECT ${productSelectColumns("products")} FROM products WHERE products.status = 'active' AND EXISTS (SELECT 1 FROM price_reports pr JOIN users store_price_users ON store_price_users.id = pr.user_id WHERE pr.product_id = products.id AND pr.store_id = ? AND ${publicPriceEligibilitySql("pr")} AND COALESCE(store_price_users.account_status, 'active') NOT IN ('suspended','banned','deleted','deactivated')) ORDER BY products.category, products.display_name`, [storeId]);
  const reports = await all(`${reportSelectWithProduct()} WHERE pr.store_id = ? AND ${publicPriceEligibilitySql("pr")} AND COALESCE(users.account_status, 'active') NOT IN ('suspended','banned','deleted','deactivated') ORDER BY pr.category, COALESCE(pr.comparison_price, pr.unit_price, pr.price), pr.submitted_at DESC`, [storeId]);
  const publicReports = reports.map(formatPublicReport);
  const categoryCounts = {};
  for (const report of reports) categoryCounts[report.category || "other"] = (categoryCounts[report.category || "other"] || 0) + 1;
  const products = rows.map((row) => {
    const product = formatPublicProduct(row);
    const bestHere = publicReports.filter((report) => Number(report.product_id) === Number(product.id)).sort((left, right) => Number(left.comparison_price ?? left.unit_price ?? left.price) - Number(right.comparison_price ?? right.unit_price ?? right.price))[0];
    return bestHere ? { ...product, best_price: bestHere.comparison_price ?? bestHere.unit_price ?? bestHere.price, best_price_unit: bestHere.comparison_unit || bestHere.unit, best_price_label: bestHere.primary_price_label, best_store_id: store.id, best_store_name: store.name, best_price_freshness: bestHere.freshness_label } : product;
  });
  const week = arenaDateWindow("week");
  const [competitionRows, drops] = await Promise.all([arenaCurrentRows({ window: week }), arenaPriceDrops({ window: week, storeId })]);
  const leaderboard = storeLeaderboard(competitionRows, await arenaSettings(), "all");
  const storeRank = leaderboard.rankings.findIndex((entry) => Number(entry.store_id) === storeId);
  const categoryResults = categoryLeaderboards(competitionRows, {}, "all").map((category) => ({ category: category.category, rank: category.rankings.findIndex((entry) => Number(entry.store_id) === storeId), entry: category.rankings.find((entry) => Number(entry.store_id) === storeId) })).filter((entry) => entry.rank >= 0).sort((left, right) => left.rank - right.rank || right.entry.lowest_count - left.entry.lowest_count);
  response.json({ store: { ...store, current_price_count: reports.length }, products, reports: publicReports, category_counts: categoryCounts, scorecard: { window: week, price_drops: drops.length, lowest_count: storeRank >= 0 ? leaderboard.rankings[storeRank].lowest_count : 0, tied_lowest_count: storeRank >= 0 ? leaderboard.rankings[storeRank].tied_lowest_count : 0, comparison_rank: storeRank >= 0 ? storeRank + 1 : null, comparable_products: leaderboard.comparable_product_count, threshold_met: leaderboard.threshold_met, strongest_observed_category: categoryResults[0]?.category || null, disclaimer: "Observed from current comparable Grocery Radar prices; this is not a universal store rating." } });
}));

app.post("/api/analytics/event", asyncRoute(async (request, response) => {
  await trackAnalyticsEvent(request, request.body || {});
  response.json({ ok: true });
}));

app.get("/api/sponsors", asyncRoute(async (request, response) => {
  const now = new Date().toISOString();
  const placement = cleanText(request.query.placement || "general", 40);
  const sponsors = await all(
    `
      SELECT *
      FROM sponsors
      WHERE status = 'active'
        AND (starts_at IS NULL OR starts_at = '' OR starts_at <= ?)
        AND (ends_at IS NULL OR ends_at = '' OR ends_at >= ?)
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 2
    `,
    [now, now]
  );

  for (const sponsor of sponsors) {
    await trackAnalyticsEvent(request, {
      event_type: "sponsor_viewed",
      sponsor_id: sponsor.id,
      metadata: { placement }
    });
  }

  response.json({
    sponsors: sponsors.map(publicSponsor),
    privacy_note: "Sponsor cards are general local placements. Allergy avoid lists and individual health preferences are not used for sponsor targeting."
  });
}));

app.post("/api/sponsors/:id/event", asyncRoute(async (request, response) => {
  const sponsorId = Number.parseInt(request.params.id, 10);
  const eventType = cleanText(request.body.event_type, 60);
  const placement = cleanText(request.body.placement || "general", 40);

  if (!Number.isInteger(sponsorId)) {
    response.status(400).json({ error: "Sponsor id is not valid." });
    return;
  }

  if (!["sponsor_clicked", "sponsor_interested", "sponsor_not_interested"].includes(eventType)) {
    response.status(400).json({ error: "Sponsor action is not valid." });
    return;
  }

  const sponsor = await get(
    "SELECT id FROM sponsors WHERE id = ? AND status = 'active'",
    [sponsorId]
  );

  if (!sponsor) {
    response.status(404).json({ error: "Sponsor card was not found." });
    return;
  }

  await trackAnalyticsEvent(request, {
    event_type: eventType,
    sponsor_id: sponsorId,
    metadata: { placement }
  });

  response.json({ message: "Sponsor action saved." });
}));

app.post("/api/store-requests", requireLogin, asyncRoute(async (request, response) => {
  const cleanRequest = validateStoreRequest(request.body);
  const result = await run(
    `
      INSERT INTO store_requests (
        requested_by_user_id,
        store_name,
        address,
        city,
        notes,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      request.currentUser.id,
      cleanRequest.store_name,
      cleanRequest.address,
      cleanRequest.city,
      cleanRequest.notes,
      new Date().toISOString()
    ]
  );

  await createAdminNotification(
    "store_request_submitted",
    "New store request",
    `${request.currentUser.username} requested ${cleanRequest.store_name}.`,
    {
      related_type: "store_request",
      related_id: result.lastID,
      target_tab: "storesTab",
      target_url: `/admin.html?tab=storesTab&storeRequest=${result.lastID}`
    }
  );

  response.status(201).json({
    message: "Store request sent. Admin will review it before it becomes public.",
    store_request_id: result.lastID
  });

  await trackAnalyticsEvent(request, {
    event_type: "store_request_created",
    cart_item_name: cleanRequest.store_name,
    metadata: { city: cleanRequest.city }
  });
}));

app.post("/api/suggestions", requireLogin, upload.single("suggestion_photo"), asyncRoute(async (request, response) => {
  let photoPath = request.file ? uploadedFileUrl(request.file.filename) : null;
  const photoOriginalName = request.file ? sanitizeOriginalFilename(request.file.originalname) : null;
  const photoMimeType = request.file ? request.file.mimetype : null;
  const photoSizeBytes = request.file ? request.file.size : null;

  try {
    const suggestion = validateSuggestion(request.body);
    const result = await run(
      `
        INSERT INTO suggestions (
          user_id,
          suggestion_type,
          title,
          message,
          related_store,
          related_item,
          photo_path,
          photo_original_name,
          photo_mime_type,
          photo_size_bytes,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `,
      [
        request.currentUser.id,
        suggestion.suggestion_type,
        suggestion.title,
        suggestion.message,
        suggestion.related_store,
        suggestion.related_item,
        photoPath,
        photoOriginalName,
        photoMimeType,
        photoSizeBytes,
        new Date().toISOString()
      ]
    );

    await trackAnalyticsEvent(request, {
      event_type: "suggestion_created",
      cart_item_name: suggestion.related_item || suggestion.title,
      category: "",
      metadata: {
        suggestion_type: suggestion.suggestion_type,
        related_store: suggestion.related_store
      }
    });

    await createAdminNotification(
      "suggestion_submitted",
      "New suggestion",
      `${request.currentUser.username} sent a ${suggestion.suggestion_type.replace(/_/g, " ")} suggestion: ${suggestion.title}.`,
      {
        related_type: "suggestion",
        related_id: result.lastID,
        target_tab: "suggestionsTab",
        target_url: `/admin.html?tab=suggestionsTab&suggestion=${result.lastID}`
      }
    );

    response.status(201).json({
      message: "Suggestion sent to admin.",
      suggestion_id: result.lastID
    });
  } catch (error) {
    deleteUploadedFile(photoPath);
    photoPath = null;
    throw error;
  }
}));

app.post("/api/preferences/avoid-ingredients", requireLogin, asyncRoute(async (request, response) => {
  const avoidIngredients = validateAvoidIngredients(request.body.avoid_ingredients);

  await run(
    "UPDATE users SET avoid_ingredients = ?, last_activity_at = ? WHERE id = ?",
    [avoidIngredients, new Date().toISOString(), request.currentUser.id]
  );

  const updatedUser = await get("SELECT * FROM users WHERE id = ?", [request.currentUser.id]);

  response.json({
    message: "Ingredient avoid list saved.",
    allergy_warning: "Ingredient alerts are a helper only. Always check the package label before buying or eating. Grocery Radar cannot guarantee allergy safety.",
    common_avoid_ingredients: COMMON_AVOID_INGREDIENTS,
    user: publicUser(updatedUser)
  });
}));

app.get("/api/cart", requireLogin, asyncRoute(async (request, response) => {
  const items = await all(
    `
      SELECT
        cart_items.*,
        products.display_name AS product_display_name
      FROM cart_items
      LEFT JOIN products ON products.id = cart_items.product_id
      WHERE cart_items.user_id = ?
      ORDER BY cart_items.created_at ASC
    `,
    [request.currentUser.id]
  );

  response.json({
    items: items.map(formatCartItem),
    cart_count: items.length,
    avoid_ingredients: request.currentUser.avoid_ingredients || "",
    allergy_warning: "Ingredient alerts are a helper only. Always check the package label before buying or eating. Grocery Radar cannot guarantee allergy safety."
  });
}));

app.post("/api/cart", requireLogin, asyncRoute(async (request, response) => {
  const item = validateCartItem(request.body);

  if (item.product_id) {
    const product = await getProductById(item.product_id, true);

    if (!product || product.status !== "active") {
      response.status(400).json({ error: "Selected product is not available." });
      return;
    }
  }

  const existingCartItem = item.product_id
    ? await get(
        "SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? LIMIT 1",
        [request.currentUser.id, item.product_id]
      )
    : await get(
        `
          SELECT *
          FROM cart_items
          WHERE user_id = ?
            AND product_id IS NULL
            AND lower(item_name) = lower(?)
            AND COALESCE(category, '') = COALESCE(?, '')
          LIMIT 1
        `,
        [request.currentUser.id, item.item_name, item.category]
      );

  if (existingCartItem) {
    await run(
      "UPDATE cart_items SET updated_at = ?, quantity_needed = COALESCE(NULLIF(?, ''), quantity_needed), size_preference = COALESCE(NULLIF(?, ''), size_preference) WHERE id = ?",
      [new Date().toISOString(), item.quantity_needed, item.size_preference, existingCartItem.id]
    );
    const updatedExisting = await get(
      `
        SELECT
          cart_items.*,
          products.display_name AS product_display_name
        FROM cart_items
        LEFT JOIN products ON products.id = cart_items.product_id
        WHERE cart_items.id = ?
      `,
      [existingCartItem.id]
    );

    response.json({
      message: "Already in cart.",
      already_in_cart: true,
      cart_item_id: existingCartItem.id,
      cart_item: formatCartItem(updatedExisting),
      cart_count: await cartCountForUser(request.currentUser.id)
    });
    return;
  }

  const result = await run(
    `
      INSERT INTO cart_items (
        user_id,
        product_id,
        item_name,
        preferred_brand,
        brand_mode,
        avoid_ingredients,
        quantity_needed,
        size_preference,
        must_have,
        optional_item,
        category,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      request.currentUser.id,
      item.product_id,
      item.item_name,
      item.preferred_brand,
      item.brand_mode,
      item.avoid_ingredients,
      item.quantity_needed,
      item.size_preference,
      item.must_have,
      item.optional_item,
      item.category,
      item.notes,
      new Date().toISOString(),
      new Date().toISOString()
    ]
  );

  await trackAnalyticsEvent(request, {
    event_type: "added_to_cart",
    product_id: item.product_id,
    cart_item_name: item.item_name,
    category: item.category,
    metadata: {
      source: cleanText(request.body.source || "manual", 40),
      brand_mode: item.brand_mode,
      must_have: Boolean(item.must_have),
      optional_item: Boolean(item.optional_item)
    }
  });

  if (!item.product_id && cleanText(request.body.source || "manual", 40) === "manual") {
    await trackAnalyticsEvent(request, {
      event_type: "cart_item_added_manual",
      cart_item_name: item.item_name,
      category: item.category,
      metadata: { brand_mode: item.brand_mode }
    });
  }

  response.status(201).json({
    message: "Item added to cart.",
    already_in_cart: false,
    cart_item_id: result.lastID,
    cart_count: await cartCountForUser(request.currentUser.id)
  });
}));

app.post("/api/cart/:id/duplicate", requireLogin, asyncRoute(async (request, response) => {
  const itemId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(itemId)) {
    response.status(400).json({ error: "Cart item id is not valid." });
    return;
  }

  const item = await get("SELECT * FROM cart_items WHERE id = ? AND user_id = ?", [itemId, request.currentUser.id]);

  if (!item) {
    response.status(404).json({ error: "Cart item was not found." });
    return;
  }

  const now = new Date().toISOString();
  const result = await run(
    `
      INSERT INTO cart_items (
        user_id,
        product_id,
        item_name,
        preferred_brand,
        brand_mode,
        avoid_ingredients,
        quantity_needed,
        size_preference,
        must_have,
        optional_item,
        category,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      request.currentUser.id,
      item.product_id,
      item.item_name,
      item.preferred_brand,
      item.brand_mode || "any",
      item.avoid_ingredients,
      item.quantity_needed,
      item.size_preference,
      item.must_have,
      item.optional_item,
      item.category,
      item.notes,
      now,
      now
    ]
  );

  await trackAnalyticsEvent(request, {
    event_type: "added_to_cart",
    product_id: item.product_id,
    cart_item_name: item.item_name,
    category: item.category,
    metadata: { source: "duplicate" }
  });

  response.status(201).json({
    message: "Cart item duplicated.",
    cart_item_id: result.lastID,
    cart_count: await cartCountForUser(request.currentUser.id)
  });
}));

app.put("/api/cart/:id", requireLogin, asyncRoute(async (request, response) => {
  const itemId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(itemId)) {
    response.status(400).json({ error: "Cart item id is not valid." });
    return;
  }

  const existing = await get("SELECT * FROM cart_items WHERE id = ? AND user_id = ?", [itemId, request.currentUser.id]);

  if (!existing) {
    response.status(404).json({ error: "Cart item was not found." });
    return;
  }

  const item = validateCartItem({
    product_id: request.body.product_id ?? existing.product_id,
    item_name: request.body.item_name ?? existing.item_name,
    preferred_brand: request.body.preferred_brand ?? existing.preferred_brand,
    brand_mode: request.body.brand_mode ?? existing.brand_mode,
    avoid_ingredients: request.body.avoid_ingredients ?? existing.avoid_ingredients,
    quantity_needed: request.body.quantity_needed ?? existing.quantity_needed,
    size_preference: request.body.size_preference ?? existing.size_preference,
    must_have: request.body.must_have ?? existing.must_have,
    optional_item: request.body.optional_item ?? existing.optional_item,
    category: request.body.category ?? existing.category,
    notes: request.body.notes ?? existing.notes
  });

  if (item.product_id) {
    const product = await getProductById(item.product_id, true);

    if (!product || product.status !== "active") {
      response.status(400).json({ error: "Selected product is not available." });
      return;
    }
  }

  await run(
    `
      UPDATE cart_items
      SET product_id = ?,
          item_name = ?,
          preferred_brand = ?,
          brand_mode = ?,
          avoid_ingredients = ?,
          quantity_needed = ?,
          size_preference = ?,
          must_have = ?,
          optional_item = ?,
          category = ?,
          notes = ?,
          updated_at = ?
      WHERE id = ?
        AND user_id = ?
    `,
    [
      item.product_id,
      item.item_name,
      item.preferred_brand,
      item.brand_mode,
      item.avoid_ingredients,
      item.quantity_needed,
      item.size_preference,
      item.must_have,
      item.optional_item,
      item.category,
      item.notes,
      new Date().toISOString(),
      itemId,
      request.currentUser.id
    ]
  );

  response.json({
    message: "Cart item saved.",
    cart_count: await cartCountForUser(request.currentUser.id)
  });
}));

app.delete("/api/cart/:id", requireLogin, asyncRoute(async (request, response) => {
  const itemId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(itemId)) {
    response.status(400).json({ error: "Cart item id is not valid." });
    return;
  }

  const item = await get("SELECT * FROM cart_items WHERE id = ? AND user_id = ?", [itemId, request.currentUser.id]);
  await run("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [itemId, request.currentUser.id]);

  if (item) {
    await trackAnalyticsEvent(request, {
      event_type: "cart_item_removed",
      product_id: item.product_id,
      cart_item_name: item.item_name,
      category: item.category
    });
  }

  response.json({
    message: "Cart item removed.",
    cart_count: await cartCountForUser(request.currentUser.id)
  });
}));

app.delete("/api/cart", requireLogin, asyncRoute(async (request, response) => {
  await run("DELETE FROM cart_items WHERE user_id = ?", [request.currentUser.id]);
  response.json({ message: "Cart cleared.", cart_count: 0 });
}));

app.get("/api/cart/compare", requireLogin, asyncRoute(async (request, response) => {
  const mode = cleanText(request.query.mode || "cheapest_split", 40);
  const comparison = await compareCartForUser(request.currentUser);
  const selectedMode = comparison.modes?.[mode] ? mode : "cheapest_split";
  comparison.selected_mode = selectedMode;

  await trackAnalyticsEvent(request, {
    event_type: "cart_compared",
    cart_item_name: selectedMode,
    metadata: {
      mode: selectedMode,
      item_count: comparison.items.length
    }
  });
  await trackAnalyticsEvent(request, {
    event_type: "cart_mode_selected",
    cart_item_name: selectedMode,
    metadata: { mode: selectedMode }
  });

  const selected = comparison.modes?.[selectedMode];

  if (selected?.missing_items?.length) {
    await trackMissingDemandForItems(request, selected.missing_items, selectedMode);
  }

  response.json(comparison);
}));

app.post("/api/auth/register", asyncRoute(async (request, response) => {
  if (!PUBLIC_REGISTRATION_ENABLED) {
    response.status(410).json({ error: "Public account creation is disabled. Grocery Radar browsing and proof submission do not require an account." });
    return;
  }
  const registration = validateRegistration(request.body);
  const moderationReason = await usernameModerationReason(registration.username);

  if (moderationReason) {
    response.status(400).json({ error: moderationReason });
    return;
  }

  const existingUsername = await get(
    "SELECT id FROM users WHERE lower(username) = lower(?)",
    [registration.username]
  );

  if (existingUsername) {
    response.status(409).json({ error: "Username is already registered." });
    return;
  }

  const existingEmail = await get(
    "SELECT id FROM users WHERE lower(email) = lower(?)",
    [registration.email]
  );

  if (existingEmail) {
    response.status(409).json({ error: "Email is already registered." });
    return;
  }

  const passwordHash = await bcrypt.hash(registration.password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();
  const createdAt = new Date().toISOString();
  const isBootstrapAdmin = isBootstrapSuperAdminIdentity({
    email: registration.email,
    username: registration.username
  });
  const result = await run(
    `
      INSERT INTO users (
        username,
        email,
        password_hash,
        points,
        accuracy_score,
        is_email_verified,
        email_verification_token,
        email_verification_expires,
        is_admin,
        is_super_admin,
        created_at
      )
      VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?)
    `,
    [
      registration.username,
      registration.email,
      passwordHash,
      verificationToken,
      verificationExpires,
      isBootstrapAdmin ? 1 : 0,
      isBootstrapAdmin ? 1 : 0,
      createdAt
    ]
  );
  let user = await get("SELECT * FROM users WHERE id = ?", [result.lastID]);
  user = await applyBootstrapSuperAdminFlags(user);
  const verificationEmail = await sendVerificationEmail(user, verificationToken);
  if (verificationEmail.sent) {
    await markVerificationEmailSent(user.id);
    await recordEmailVerificationEvent(request, user, "verification_email_sent");
  } else {
    await recordEmailVerificationEvent(request, user, "verification_email_failed");
  }
  const adminEmail = await sendAdminRegistrationEmail(user);
  const warnings = [verificationEmail.warning, adminEmail.warning].filter(Boolean);

  await logInSessionUser(request, user);
  await markUserSeen(user.id);
  await recordLoginEvent(request, user, true);

  response.status(201).json({
    message: verificationEmail.sent
      ? "Registration complete. Check your email to verify your account."
      : "Registration complete, but the verification email was not sent. Use resend verification after SMTP is configured.",
    user: publicUser(user),
    verification_email_sent: Boolean(verificationEmail.sent),
    warnings
  });
}));

app.get("/api/auth/verify-email", asyncRoute(async (request, response) => {
  const token = cleanText(request.query.token, 200);

  if (!token) {
    response.status(400).send(authPage("Email Verification Failed", "Verification token is required."));
    return;
  }

  const user = await get(
    "SELECT * FROM users WHERE email_verification_token = ?",
    [token]
  );

  if (!user) {
    response.status(400).send(authPage("Email Verification Failed", "Verification token was not found."));
    return;
  }

  if (!user.email_verification_expires || new Date(user.email_verification_expires) < new Date()) {
    response.status(400).send(authPage("Email Verification Failed", "Verification token has expired."));
    return;
  }

  await run(
    `
      UPDATE users
      SET is_email_verified = 1,
          email_verified_at = ?,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE id = ?
    `,
    [new Date().toISOString(), user.id]
  );
  await recordEmailVerificationEvent(request, user, "email_verified");

  response.send(authPage(
    "Email Verified",
    "Your email is verified. Your contributor account is trusted for beta point features."
  ));
}));

app.post("/api/auth/resend-verification", asyncRoute(async (request, response) => {
  const user = await getSessionUser(request);

  if (!user) {
    response.status(401).json({ error: "You must log in to resend verification email." });
    return;
  }

  if (isBlockedAccount(user)) {
    response.status(403).json({ error: blockedAccountMessage(user) });
    return;
  }

  if (user.is_email_verified) {
    response.json({ message: "Your email is already verified." });
    return;
  }

  const retryAfterSeconds = secondsUntilVerificationResendAllowed(user);

  if (retryAfterSeconds > 0) {
    response.status(429).json({
      error: `Please wait ${retryAfterSeconds} seconds before resending verification email.`,
      retry_after_seconds: retryAfterSeconds
    });
    return;
  }

  if (!emailStatus().configured) {
    response.status(400).json({
      error: "Email is not configured yet. Admin must set SMTP settings."
    });
    return;
  }

  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS).toISOString();

  await run(
    `
      UPDATE users
      SET email_verification_token = ?,
          email_verification_expires = ?
      WHERE id = ?
    `,
    [verificationToken, verificationExpires, user.id]
  );

  const updatedUser = await get("SELECT * FROM users WHERE id = ?", [user.id]);
  const verificationEmail = await sendVerificationEmail(updatedUser, verificationToken);

  if (!verificationEmail.sent) {
    await recordEmailVerificationEvent(request, updatedUser, "verification_email_failed");
    response.status(502).json({
      error: "Email could not be sent. Check SMTP setup in .env or Brevo."
    });
    return;
  }

  await markVerificationEmailSent(user.id);
  await recordEmailVerificationEvent(request, updatedUser, "verification_email_sent");

  response.json({ message: "Verification email sent." });
}));

app.post("/api/auth/login", asyncRoute(async (request, response) => {
  const login = validateLogin(request.body);
  let user = await get(
    "SELECT * FROM users WHERE lower(email) = lower(?)",
    [login.email]
  );

  if (!user || !user.password_hash) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const passwordMatches = await bcrypt.compare(login.password, user.password_hash);

  if (!passwordMatches) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  if (["banned", "deleted", "deactivated"].includes(user.account_status || "active")) {
    response.status(403).json({ error: blockedAccountMessage(user) });
    return;
  }

  user = await applyBootstrapSuperAdminFlags(user);

  await logInSessionUser(request, user);
  await markUserSeen(user.id);
  await recordLoginEvent(request, user, true);
  response.json({ message: "Logged in.", user: publicUser(user) });
}));

app.post("/api/auth/logout", asyncRoute(async (request, response) => {
  await sessionDestroy(request);
  response.clearCookie("grocery_radar_sid");
  response.json({ message: "Logged out." });
}));

app.post("/api/auth/change-password", requireLogin, asyncRoute(async (request, response) => {
  const currentPassword = String(request.body.currentPassword || "");
  const newPassword = validatePassword(request.body.newPassword);
  const confirmPassword = String(request.body.confirmPassword || "");

  if (!currentPassword) {
    response.status(400).json({ error: "Current password is required." });
    return;
  }

  if (newPassword !== confirmPassword) {
    response.status(400).json({ error: "New password and confirmation must match." });
    return;
  }

  const user = request.currentUser;
  const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash || "");

  if (!passwordMatches) {
    response.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await run(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [passwordHash, user.id]
  );

  response.json({ message: "Password changed." });
}));

app.get("/api/auth/me", asyncRoute(async (request, response) => {
  const user = await getSessionUser(request);

  if (!user) {
    response.json({ loggedIn: false });
    return;
  }

  if (["banned", "deleted", "deactivated"].includes(user.account_status || "active")) {
    await sessionDestroy(request);
    response.clearCookie("grocery_radar_sid");
    response.json({
      loggedIn: false,
      error: blockedAccountMessage(user)
    });
    return;
  }

  const safeUser = publicUser(user);
  await markUserSeen(user.id);

  response.json({
    loggedIn: true,
    ...safeUser,
    user: safeUser
  });
}));

app.post("/api/heartbeat", asyncRoute(async (request, response) => {
  const user = await getSessionUser(request);
  const activeUser = user && !isBlockedAccount(user) ? user : null;

  if (activeUser) {
    await markUserSeen(activeUser.id);
  }

  const activity = await recordActivityHeartbeat(request, activeUser);

  response.json({
    ok: true,
    loggedIn: Boolean(activeUser),
    active_window_minutes: ACTIVE_USAGE_WINDOW_MINUTES,
    streak: activity.streak ? {
      current: activity.streak.current_streak || 0,
      longest: activity.streak.longest_streak || 0,
      last_qualifying_date: activity.streak.last_qualifying_date || ""
    } : null
  });
}));

app.get("/api/notifications", requireLogin, asyncRoute(async (request, response) => {
  const rows = await all(
    `
      SELECT *
      FROM notifications
      WHERE user_id = ?
        AND admin_only = 0
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [request.currentUser.id]
  );
  const unread = rows.filter((row) => !row.is_read).length;

  response.json({
    unread_count: unread,
    notifications: rows.map(formatNotification)
  });
}));

app.post("/api/notifications/:id/read", requireLogin, asyncRoute(async (request, response) => {
  const notificationId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(notificationId)) {
    response.status(400).json({ error: "Notification id is not valid." });
    return;
  }

  const result = await run(
    `
      UPDATE notifications
      SET is_read = 1,
          read_at = COALESCE(read_at, ?)
      WHERE id = ?
        AND user_id = ?
        AND admin_only = 0
    `,
    [new Date().toISOString(), notificationId, request.currentUser.id]
  );

  if (!result.changes) {
    response.status(404).json({ error: "Notification was not found." });
    return;
  }

  response.json({ message: "Notification marked read." });
}));

app.post("/api/notifications/read-all", requireLogin, asyncRoute(async (request, response) => {
  await run(
    `
      UPDATE notifications
      SET is_read = 1,
          read_at = COALESCE(read_at, ?)
      WHERE user_id = ?
        AND admin_only = 0
        AND is_read = 0
    `,
    [new Date().toISOString(), request.currentUser.id]
  );

  response.json({ message: "All notifications marked read." });
}));

app.get("/api/homepage-service", asyncRoute(async (request, response) => {
  response.json(await homepageServiceData());
}));

app.get("/api/releases", asyncRoute(async (request, response) => {
  const releases = await all("SELECT * FROM homepage_patch_notes WHERE status = 'published' ORDER BY COALESCE(release_date, published_at, updated_at) DESC, id DESC LIMIT 50");
  const userId = Number(request.session?.userId || 0);
  const readIds = userId ? new Set((await all("SELECT patch_note_id FROM user_release_reads WHERE user_id = ?", [userId])).map((row) => Number(row.patch_note_id))) : new Set();
  response.json({ application_version: APP_VERSION, releases: releases.map((row) => ({ ...formatHomepagePatchNote(row), is_read: userId ? readIds.has(Number(row.id)) : null })), newest_release_id: releases[0]?.id || null, has_unread: userId ? Boolean(releases[0] && !readIds.has(Number(releases[0].id))) : null });
}));

app.post("/api/releases/:id/read", requireLogin, asyncRoute(async (request, response) => {
  const patchId = Number.parseInt(request.params.id, 10);
  const release = await get("SELECT id FROM homepage_patch_notes WHERE id = ? AND status = 'published'", [patchId]);
  if (!release) { response.status(404).json({ error: "Published update was not found." }); return; }
  const now = new Date().toISOString();
  await run("INSERT INTO user_release_reads (user_id, patch_note_id, read_at) VALUES (?, ?, ?) ON CONFLICT(user_id, patch_note_id) DO UPDATE SET read_at = excluded.read_at", [request.currentUser.id, patchId, now]);
  response.json({ ok: true, read_at: now });
}));

app.get("/api/announcements", asyncRoute(async (request, response) => {
  const now = new Date().toISOString();
  const rows = await all(
    `
      SELECT *
      FROM announcements
      WHERE ${publicAnnouncementWhere(now)}
      ORDER BY
        CASE announcement_type
          WHEN 'downtime' THEN 1
          WHEN 'maintenance' THEN 2
          WHEN 'known_issue' THEN 3
          WHEN 'new_feature' THEN 4
          ELSE 5
        END,
        published_at DESC,
        updated_at DESC
      LIMIT 5
    `,
    [now, now]
  );

  response.json({
    announcements: rows.map((row) => formatAnnouncement(row, false))
  });
}));

app.get("/api/feedback/categories", asyncRoute(async (request, response) => {
  response.json({
    categories: FEEDBACK_CATEGORIES,
    statuses: FEEDBACK_STATUSES
  });
}));

app.post("/api/feedback", requireLogin, asyncRoute(async (request, response) => {
  const category = cleanFeedbackCategory(request.body.category);
  const title = cleanText(request.body.title, 160);
  const message = cleanText(request.body.message, 2000);
  const priority = cleanFeedbackPriority(request.body.priority || "normal");
  const source = cleanSourceMetadata(request.body);
  const relatedReportId = Number.parseInt(request.body.related_report_id, 10);
  const relatedStoreId = Number.parseInt(request.body.related_store_id, 10);
  const relatedProductId = Number.parseInt(request.body.related_product_id, 10);
  const now = new Date().toISOString();

  if (!title) {
    response.status(400).json({ error: "Feedback title is required." });
    return;
  }

  if (!message) {
    response.status(400).json({ error: "Feedback message is required." });
    return;
  }

  const result = await run(
    `
      INSERT INTO feedback_tickets (
        reporter_user_id,
        category,
        title,
        message,
        status,
        priority,
        source_url,
        related_report_id,
        related_store_id,
        related_product_id,
        city,
        region,
        country_code,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      request.currentUser.id,
      category,
      title,
      message,
      priority,
      source.source_url,
      Number.isInteger(relatedReportId) ? relatedReportId : null,
      Number.isInteger(relatedStoreId) ? relatedStoreId : null,
      Number.isInteger(relatedProductId) ? relatedProductId : null,
      cleanText(request.body.city || "Janesville", 80) || "Janesville",
      cleanText(request.body.region || "WI", 80) || "WI",
      cleanText(request.body.country_code || "US", 8).toUpperCase() || "US",
      now,
      now
    ]
  );

  await createAdminNotification(
    "feedback_submitted",
    "New feedback submitted",
    `${request.currentUser.username} submitted ${category.replace(/_/g, " ")} feedback.`,
    {
      related_type: "feedback_ticket",
      related_id: result.lastID,
      target_tab: "operationsTab",
      target_url: `/admin.html?tab=operationsTab&feedback=${result.lastID}`
    }
  );

  response.status(201).json({
    message: "Feedback submitted.",
    ticket: formatFeedbackTicket(await feedbackTicketById(result.lastID))
  });
}));

app.get("/api/account/feedback", requireLogin, asyncRoute(async (request, response) => {
  response.json({
    tickets: await publicFeedbackForUser(request.currentUser.id)
  });
}));

app.get("/api/feature-votes", asyncRoute(async (request, response) => {
  const user = await getSessionUser(request);
  const options = await featureVoteOptionsForUser(user?.id || null);

  response.json({
    options: options.filter((option) => option.status !== "rejected"),
    user_logged_in: Boolean(user && !isBlockedAccount(user))
  });
}));

app.post("/api/feature-votes/:id/vote", requireLogin, asyncRoute(async (request, response) => {
  const optionId = Number.parseInt(request.params.id, 10);
  const option = await get("SELECT * FROM feature_vote_options WHERE id = ?", [optionId]);

  if (!option || option.status === "rejected") {
    response.status(404).json({ error: "Feature option was not found." });
    return;
  }

  try {
    await run(
      "INSERT INTO feature_votes (option_id, user_id, created_at) VALUES (?, ?, ?)",
      [optionId, request.currentUser.id, new Date().toISOString()]
    );
  } catch (error) {
    if (/UNIQUE|constraint/i.test(error.message || "")) {
      response.status(409).json({ error: "You already voted for this feature." });
      return;
    }

    throw error;
  }

  await createAdminNotification(
    "feature_vote",
    "Feature vote received",
    `${request.currentUser.username} voted for ${option.title}.`,
    {
      related_type: "feature_vote",
      related_id: optionId,
      target_tab: "operationsTab",
      target_url: `/admin.html?tab=operationsTab&feature=${optionId}`
    }
  );

  response.status(201).json({
    message: "Vote saved.",
    options: await featureVoteOptionsForUser(request.currentUser.id)
  });
}));

app.get("/api/account/reports", requireLogin, asyncRoute(async (request, response) => {
  const rows = await all(
    `
      ${reportSelectWithProduct()}
      WHERE pr.user_id = ?
      ORDER BY pr.submitted_at DESC
      LIMIT 100
    `,
    [request.currentUser.id]
  );

  response.json({
    reports: rows.map(formatPublicReport)
  });
}));

app.get("/api/account/verifications", requireLogin, asyncRoute(async (request, response) => {
  const rows = await all(
    `
      SELECT
        verifications.*,
        pr.item_name,
        pr.brand,
        pr.price,
        pr.status AS report_status,
        pr.product_id,
        stores.name AS store_name
      FROM verifications
      JOIN price_reports pr ON pr.id = verifications.price_report_id
      JOIN stores ON stores.id = pr.store_id
      WHERE verifications.user_id = ?
      ORDER BY verifications.created_at DESC
      LIMIT 100
    `,
    [request.currentUser.id]
  );

  response.json({
    verifications: rows.map((row) => ({
      id: row.id,
      price_report_id: row.price_report_id,
      product_id: row.product_id || null,
      item_name: row.item_name,
      brand: row.brand || "",
      store_name: row.store_name,
      price_label: `$${Number(row.price).toFixed(2)}`,
      report_status: row.report_status,
      verification_type: row.verification_type,
      note: row.note || "",
      created_at: row.created_at
    }))
  });
}));

app.get("/api/account/engagement", requireLogin, asyncRoute(async (request, response) => {
  const [engagement, contributionStats, proofStats, recentEvents, impactByStore] = await Promise.all([
    get("SELECT * FROM user_engagement WHERE user_id = ?", [request.currentUser.id]),
    get(
      `SELECT COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_prices, COUNT(*) AS reports FROM price_reports WHERE user_id = ?`,
      [request.currentUser.id]
    ),
    get(
      `SELECT COUNT(*) AS receipts FROM price_import_batches WHERE created_by = ? AND notes LIKE ?`,
      [request.currentUser.id, `${PROOF_SUBMISSION_NOTE_PREFIX}%`]
    ),
    all(
      `SELECT events.action, events.points, events.price_report_id, events.related_import_batch_id, events.created_at, reports.item_name, reports.price, reports.product_id, stores.name AS store_name FROM point_events events LEFT JOIN price_reports reports ON reports.id = events.price_report_id LEFT JOIN stores ON stores.id = reports.store_id WHERE events.user_id = ? ORDER BY events.created_at DESC LIMIT 20`,
      [request.currentUser.id]
    ),
    all(`SELECT stores.id AS store_id, stores.name AS store_name, COUNT(*) AS approved_prices FROM price_reports reports JOIN stores ON stores.id = reports.store_id WHERE COALESCE(reports.submitted_by_user_id, reports.user_id) = ? AND reports.status = 'approved' GROUP BY stores.id, stores.name ORDER BY approved_prices DESC, stores.name`, [request.currentUser.id])
  ]);
  response.json({
    streak: {
      current: engagement?.current_streak || 0,
      longest: engagement?.longest_streak || 0,
      last_qualifying_date: engagement?.last_qualifying_date || "",
      message: engagement?.current_streak
        ? `Thanks for using Grocery Radar ${engagement.current_streak} day${engagement.current_streak === 1 ? "" : "s"} in a row.`
        : "Welcome back. Start a new streak today."
    },
    contributions: {
      approved_prices: contributionStats?.approved_prices || 0,
      reports_submitted: contributionStats?.reports || 0,
      receipts_submitted: proofStats?.receipts || 0
    },
    recent_activity: recentEvents.map((event) => ({
      type: event.action,
      points: event.points || 0,
      report_id: event.price_report_id || null,
      product_id: event.product_id || null,
      proof_id: event.related_import_batch_id || null,
      item_name: event.item_name || "",
      store_name: event.store_name || "",
      price_label: event.price == null ? "" : `$${Number(event.price).toFixed(2)}`,
      target_url: event.product_id ? `/?tab=productView&product=${event.product_id}&report=${event.price_report_id}` : event.related_import_batch_id ? `/?tab=accountView&section=proof&proof=${event.related_import_batch_id}` : "",
      created_at: event.created_at
    })),
    impact_by_store: impactByStore
  });
}));

const BROWSE_GROUPS = {
  food_basics: ["dairy", "produce", "pantry", "bakery"],
  meat_protein: ["meat"],
  drinks: ["drinks"],
  frozen: ["frozen"],
  household: ["household"],
  bathroom_personal_care: ["personal care"],
  pets: ["pet"],
  baby: ["baby"],
  cleaning: ["household"]
};

function browseCategoryFilter(query) {
  const group = cleanText(query.group, 80).toLowerCase();
  const category = cleanText(query.category, 30).toLowerCase();
  const categoriesForGroup = BROWSE_GROUPS[group] || [];

  if (categoriesForGroup.length) {
    return categoriesForGroup;
  }

  if (CATEGORIES.includes(category)) {
    return [category];
  }

  return [];
}

app.get("/api/browse", asyncRoute(async (request, response) => {
  await refreshExpiredReports();

  const categoriesForBrowse = browseCategoryFilter(request.query);
  const categoryWhere = categoriesForBrowse.length
    ? `AND products.category IN (${categoriesForBrowse.map(() => "?").join(", ")})`
    : "";
  const reportCategoryWhere = categoriesForBrowse.length
    ? `AND pr.category IN (${categoriesForBrowse.map(() => "?").join(", ")})`
    : "";

  const [recentReports, productsWithPrices, stores, needsPrices] = await Promise.all([
    all(
      `
        ${reportSelectWithProduct()}
        WHERE ${publicPriceEligibilitySql("pr")}
          AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
          ${reportCategoryWhere}
        ORDER BY pr.reviewed_at DESC, pr.submitted_at DESC
        LIMIT 12
      `,
      categoriesForBrowse
    ),
    all(
      `
        SELECT ${productSelectColumns("products")}
        FROM products
        WHERE products.status = 'active'
          ${categoryWhere}
        ORDER BY CASE WHEN approved_price_count > 0 THEN 0 ELSE 1 END, approved_price_count DESC, last_reported_at DESC, CASE WHEN image_id IS NOT NULL THEN 0 ELSE 1 END, products.display_name ASC
        LIMIT 80
      `,
      categoriesForBrowse
    ),
    all(
      `
        SELECT id, name, address, city, state, store_type
        FROM stores
        WHERE active = 1
        ORDER BY name ASC
      `
    ),
    all(
      `
        SELECT item_name, category, status, updated_at
        FROM missing_price_priorities
        WHERE status IN ('priority', 'manual_price_needed', 'suggested_quick_item')
        ORDER BY updated_at DESC
        LIMIT 12
      `
    )
  ]);

  response.json({
    products: productsWithPrices.map(formatPublicProduct),
    recently_approved_reports: recentReports.map(formatPublicReport),
    stores,
    needs_prices: needsPrices,
    selected_categories: categoriesForBrowse
  });
}));

app.get("/api/search", asyncRoute(async (request, response) => {
  await refreshExpiredReports();

  const rawQuery = cleanText(request.query.q, 120);
  const searchResolution = await resolvedSearchQuery(rawQuery);
  const q = searchResolution.effective;
  const storeId = Number.parseInt(request.query.store, 10);
  const category = cleanText(request.query.category, 30).toLowerCase();
  const sort = cleanText(request.query.sort, 40) || "cheapest_unit_price";
  const filters = [
    publicPriceEligibilitySql("pr"),
    "COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')",
    "(pr.product_id IS NULL OR COALESCE(products.status, 'active') NOT IN ('hidden', 'merged'))"
  ];
  const params = [];

  if (q) {
    filters.push(`(
      pr.item_name LIKE ?
      OR lower(COALESCE(pr.brand, '')) LIKE ?
      OR lower(COALESCE(products.display_name, '')) LIKE ?
      OR lower(COALESCE(products.common_aliases, '')) LIKE ?
    )`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (Number.isInteger(storeId)) {
    filters.push("pr.store_id = ?");
    params.push(storeId);
  }

  if (CATEGORIES.includes(category)) {
    filters.push("pr.category = ?");
    params.push(category);
  }

  let orderBy = "pr.unit_price ASC, pr.price ASC, pr.submitted_at DESC";

  if (sort === "newest_report") {
    orderBy = "pr.submitted_at DESC";
  }

  if (sort === "highest_confidence") {
    orderBy = `
      CASE pr.confidence
        WHEN 'high' THEN 5
        WHEN 'medium-high' THEN 4
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 2
        ELSE 0
      END DESC,
      pr.verification_count DESC,
      pr.submitted_at DESC
    `;
  }

  const reports = await all(
    `
      ${reportSelectWithProduct()}
      WHERE ${filters.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT 100
    `,
    params
  );

  const productFilter = productSearchFilter(q);
  const productFilters = ["products.status = 'active'", productFilter.clause];
  const productParams = [...productFilter.params];

  if (CATEGORIES.includes(category)) {
    productFilters.push("products.category = ?");
    productParams.push(category);
  }

  const products = await all(
    `
      SELECT ${productSelectColumns("products")}
      FROM products
      WHERE ${productFilters.join(" AND ")}
      ORDER BY approved_price_count DESC, last_reported_at DESC, products.display_name ASC
      LIMIT 25
    `,
    productParams
  );

  // Search demand is intentionally aggregate-only. Do not attach this query to a
  // user or session through the legacy per-event analytics table.
  await recordSearchDemand(rawQuery, products.length + reports.length);

  response.json({
    products: products.map(formatPublicProduct),
    reports: reports.map(formatPublicReport),
    search: { normalized_query: searchResolution.normalized, matched_alias: searchResolution.alias ? searchResolution.effective : "" }
  });
}));

app.get("/api/products", asyncRoute(async (request, response) => {
  const q = cleanText(request.query.q, 120);
  const category = cleanText(request.query.category, 30).toLowerCase();
  const productFilter = productSearchFilter(q);
  const filters = ["products.status = 'active'", productFilter.clause];
  const params = [...productFilter.params];

  if (CATEGORIES.includes(category)) {
    filters.push("products.category = ?");
    params.push(category);
  }

  const products = await all(
    `
      SELECT ${productSelectColumns("products")}
      FROM products
      WHERE ${filters.join(" AND ")}
      ORDER BY approved_price_count DESC, last_reported_at DESC, products.display_name ASC
      LIMIT 50
    `,
    params
  );

  response.json({
    products: products.map(formatPublicProduct)
  });
}));

function splitCsvRecord(line) {
  const output = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { output.push(value.trim()); value = ""; }
    else value += character;
  }
  output.push(value.trim());
  return output;
}

function catalogRowsFromInput(input) {
  if (Array.isArray(input)) return input;
  const text = String(input || "").replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.products) ? parsed.products : [parsed];
  }
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((line) => line.trim());
  const headers = splitCsvRecord(lines.shift() || "").map((header) => cleanText(header, 60).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, splitCsvRecord(line)[index] || ""])));
}

function normalizedCatalogCategory(value) {
  const aliases = { "dairy & eggs": "dairy", "meat & seafood": "meat", beverages: "drinks", "prepared food": "prepared food", "health & personal care": "health / personal care" };
  const normalized = cleanText(value || "other", 60).toLowerCase();
  return CATEGORIES.includes(aliases[normalized] || normalized) ? aliases[normalized] || normalized : "other";
}

function formatCatalogRow(row) {
  return { ...row, warnings: parseMetadataJson(row.warnings_json), duplicate_product_id: row.duplicate_product_id || null, suggested_product_id: row.suggested_product_id || null };
}

async function catalogBatchPayload(batchId) {
  const batch = await get("SELECT * FROM catalog_import_batches WHERE id = ?", [batchId]);
  if (!batch) return null;
  const [rows, images] = await Promise.all([all("SELECT * FROM catalog_import_rows WHERE batch_id = ? ORDER BY id", [batchId]), all("SELECT id, original_name, matched_row_id, match_confidence, status, created_at FROM catalog_import_images WHERE batch_id = ? ORDER BY id", [batchId])]);
  const formatted = rows.map(formatCatalogRow);
  const summary = formatted.reduce((counts, row) => {
    const warnings = row.warnings || [];
    const invalid = warnings.some((warning) => /invalid|malformed|required/i.test(warning));
    if (row.status === "published") counts.published += 1;
    else if (invalid) counts.invalid += 1;
    else if (row.duplicate_product_id) counts.likely_existing += 1;
    else if (warnings.length) counts.needs_review += 1;
    else counts.ready += 1;
    return counts;
  }, { ready: 0, likely_existing: 0, needs_review: 0, invalid: 0, published: 0 });
  return { ...batch, summary, rows: formatted, images };
}

app.post("/api/admin/catalog-imports", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), catalogDataUpload.single("catalog_file"), asyncRoute(async (request, response) => {
  const sourceText = request.file ? request.file.buffer.toString("utf8") : request.body.csv_text || request.body.json_text || request.body.rows;
  const incoming = catalogRowsFromInput(sourceText);
  if (!incoming.length || incoming.length > 5000) { response.status(400).json({ error: "Add between 1 and 5,000 catalog rows." }); return; }
  const now = new Date().toISOString();
  const batchResult = await run("INSERT INTO catalog_import_batches (title, status, source_format, row_count, created_by, created_at, updated_at) VALUES (?, 'draft', ?, ?, ?, ?, ?)", [cleanText(request.body.title || request.file?.originalname || "Catalog import", 160), request.file?.originalname?.toLowerCase().endsWith(".json") || String(sourceText).trim().startsWith("[") ? "json" : "csv", incoming.length, request.adminUser.id, now, now]);
  for (const input of incoming) {
    const productName = cleanText(input.product_name || input.display_name || input.name, 160);
    if (!productName) continue;
    const brand = cleanText(input.brand, 100);
    const rawUpc = cleanText(input.upc || input.barcode, 40);
    const barcode = rawUpc ? normalizeBarcode(rawUpc) : null;
    const upc = barcode?.valid ? barcode.value : rawUpc;
    const duplicate = await get("SELECT products.id FROM products LEFT JOIN product_barcodes barcodes ON barcodes.product_id = products.id AND barcodes.status = 'verified' WHERE lower(products.display_name) = lower(?) OR (NULLIF(?, '') IS NOT NULL AND (products.upc = ? OR barcodes.normalized_value = ?)) LIMIT 1", [productName, upc, upc, upc]);
    const warnings = [];
    if (duplicate) warnings.push(`Possible duplicate of product #${duplicate.id}.`);
    if (barcode && !barcode.valid) warnings.push(barcode.error);
    await run("INSERT INTO catalog_import_rows (batch_id, product_name, brand, variant, size_text, unit, category, subcategory, upc, upc_type, aliases, storage_condition, image_filename, duplicate_product_id, warnings_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)", [batchResult.lastID, productName, brand, cleanText(input.variant, 100), cleanText(input.size || input.size_text, 100), cleanText(input.unit, 30), normalizedCatalogCategory(input.category), cleanText(input.subcategory, 80), upc, barcode?.valid ? barcode.type : "", cleanText(input.aliases, 1000), cleanText(input.storage_condition, 80), cleanText(input.image_filename, 180), duplicate?.id || null, JSON.stringify(warnings), now, now]);
  }
  response.status(201).json({ message: "Draft catalog created. Nothing is public until authorized publication.", batch: await catalogBatchPayload(batchResult.lastID) });
}));

app.post("/api/admin/catalog-imports/:id/images", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), priceImportUpload.array("images", 50), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.id, 10);
  const batch = await get("SELECT id FROM catalog_import_batches WHERE id = ? AND status = 'draft'", [batchId]);
  if (!batch) { response.status(404).json({ error: "Draft catalog import was not found." }); return; }
  const rows = await all("SELECT * FROM catalog_import_rows WHERE batch_id = ? ORDER BY id", [batchId]);
  const now = new Date().toISOString();
  for (const file of request.files || []) {
    const original = sanitizeOriginalFilename(file.originalname);
    const explicit = rows.find((row) => String(row.image_filename || "").toLowerCase() === original.toLowerCase());
    const base = compactIntakeSearchText(path.basename(original, path.extname(original)));
    const normalized = explicit || rows.find((row) => base && (base.includes(compactIntakeSearchText(row.product_name)) || compactIntakeSearchText(row.product_name).includes(base)));
    const confidence = explicit ? "high" : normalized ? "check" : "unknown";
    const image = await run("INSERT INTO catalog_import_images (batch_id, image_path, original_name, matched_row_id, match_confidence, status, created_at) VALUES (?, ?, ?, ?, ?, 'draft', ?)", [batchId, uploadedFileUrl(file.filename), original, normalized?.id || null, confidence, now]);
    if (normalized && (!normalized.matched_image_path || confidence === "high")) await run("UPDATE catalog_import_rows SET matched_image_path = ?, image_match_confidence = ?, warnings_json = ?, updated_at = ? WHERE id = ? AND batch_id = ?", [uploadedFileUrl(file.filename), confidence, JSON.stringify(confidence === "check" ? ["Image matched by normalized name; confirm before publication."] : parseMetadataJson(normalized.warnings_json)), now, normalized.id, batchId]);
  }
  response.status(201).json({ message: "Images added to the draft catalog. Uncertain matches remain flagged.", batch: await catalogBatchPayload(batchId) });
}));

app.get("/api/admin/catalog-imports/:id", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const batch = await catalogBatchPayload(Number.parseInt(request.params.id, 10));
  if (!batch) { response.status(404).json({ error: "Catalog import was not found." }); return; }
  response.json({ batch });
}));

app.post("/api/admin/catalog-imports/:id/publish", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.id, 10);
  const requestedIds = parseImportRowIds(request.body.row_ids);
  const rows = await all(`SELECT * FROM catalog_import_rows WHERE batch_id = ? AND status = 'draft' ${requestedIds.length ? `AND id IN (${requestedIds.map(() => "?").join(",")})` : ""}`, [batchId, ...requestedIds]);
  if (!rows.length) { response.status(400).json({ error: "Choose draft catalog rows to publish." }); return; }
  const now = new Date().toISOString();
  const published = [];
  for (const row of rows) {
    const warnings = parseMetadataJson(row.warnings_json);
    if (warnings.some((warning) => /invalid|malformed|required/i.test(warning))) continue;
    if (row.duplicate_product_id && request.body.keep_duplicates !== true) continue;
    if (row.upc) {
      const conflict = await get("SELECT product_id FROM product_barcodes WHERE normalized_value = ? AND status = 'verified'", [row.upc]);
      if (conflict) continue;
    }
    const result = await run("INSERT INTO products (canonical_name, display_name, category, subcategory, default_size_text, default_unit, default_storage_condition, preferred_brand, variant, upc, common_aliases, status, created_by_admin_id, admin_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)", [normalizeProductName(row.product_name), row.product_name, row.category, row.subcategory || "", row.size_text || "", row.unit || "", row.storage_condition || "unknown", row.brand || "", row.variant || "", row.upc || "", row.aliases || "", request.adminUser.id, `Published from catalog import #${batchId}, row #${row.id}.`, now, now]);
    if (row.upc) await assignBarcodeToProduct(result.lastID, row.upc, request.adminUser.id, "catalog_import");
    if (row.matched_image_path && (row.image_match_confidence === "high" || request.body.confirm_image_matches === true)) await run("INSERT INTO product_images (product_id, image_path, original_image_path, alt_text, source_type, source_note, status, is_primary, uploaded_by, moderated_by, moderated_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'catalog_import', ?, 'approved', 1, ?, ?, ?, ?, ?)", [result.lastID, row.matched_image_path, row.matched_image_path, `${row.product_name} product image`, `Catalog import #${batchId}`, request.adminUser.id, request.adminUser.id, now, now, now]);
    await run("UPDATE catalog_import_rows SET suggested_product_id = ?, status = 'published', updated_at = ? WHERE id = ?", [result.lastID, now, row.id]);
    published.push(result.lastID);
  }
  await run("UPDATE catalog_import_batches SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM catalog_import_rows WHERE batch_id = ? AND status = 'draft') THEN 'published' ELSE 'draft' END, updated_at = ? WHERE id = ?", [batchId, now, batchId]);
  response.json({ message: `${published.length} product${published.length === 1 ? "" : "s"} published.`, product_ids: published, batch: await catalogBatchPayload(batchId) });
}));

async function optimizeProductImage(file) {
  const originalPath = uploadedFileUrl(file.filename);
  if (!sharp) return { imagePath: originalPath, originalPath };
  const stem = `${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;
  const variants = { thumbnail: 240, card: 600, detail: 1200 };
  const paths = {};
  for (const [label, size] of Object.entries(variants)) {
    const outputName = `${stem}-${label}.webp`;
    await sharp(file.path, { limitInputPixels: 40000000 }).rotate().resize({ width: size, height: size, fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 }, withoutEnlargement: true }).webp({ quality: label === "thumbnail" ? 78 : 84 }).toFile(path.join(UPLOAD_DIR, outputName));
    paths[`${label}Path`] = uploadedFileUrl(outputName);
  }
  return { imagePath: paths.cardPath, originalPath, ...paths };
}

app.post("/api/admin/products/:id/images", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), upload.single("product_image"), asyncRoute(async (request, response) => {
  const productId = Number.parseInt(request.params.id, 10);
  const product = await get("SELECT id, display_name FROM products WHERE id = ?", [productId]);
  if (!product || !request.file) { response.status(404).json({ error: "Product or image was not found." }); return; }
  const paths = await optimizeProductImage(request.file);
  const now = new Date().toISOString();
  const result = await run("INSERT INTO product_images (product_id, image_path, original_image_path, original_name, mime_type, size_bytes, file_hash, thumbnail_path, card_path, detail_path, alt_text, source_type, source_url, source_note, status, is_primary, uploaded_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin_upload', ?, ?, 'draft', 0, ?, ?, ?)", [productId, paths.imagePath, paths.originalPath, sanitizeOriginalFilename(request.file.originalname), request.file.mimetype, request.file.size, hashUploadedFile(request.file), paths.thumbnailPath || paths.imagePath, paths.cardPath || paths.imagePath, paths.detailPath || paths.imagePath, cleanText(request.body.alt_text || `${product.display_name} product image`, 240), cleanText(request.body.source_url, 500), cleanText(request.body.source_note || "Admin-uploaded product photo", 300), request.adminUser.id, now, now]);
  response.status(201).json({ message: "Product image saved as a moderation draft.", image: { id: result.lastID, status: "draft", alt_text: cleanText(request.body.alt_text || `${product.display_name} product image`, 240) } });
}));

const PRODUCT_IMAGE_SOURCE_TYPES = new Set(["owner_photo", "staff_photo", "community_photo", "authorized_manufacturer_asset", "approved_grocery_radar_image", "proof_derived_approved"]);

async function matchProductImageFilename(originalName) {
  const base = normalizeProductName(path.basename(originalName, path.extname(originalName)).replace(/[_-]+/g, " "));
  const explicitId = originalName.match(/(?:^|[-_])product[-_](\d+)(?:[-_.]|$)/i)?.[1];
  if (explicitId) {
    const product = await get("SELECT id, display_name FROM products WHERE id = ? AND status = 'active'", [Number(explicitId)]);
    if (product) return { product, confidence: "high", method: "explicit_product_id" };
  }
  const products = await all("SELECT id, display_name, canonical_name, common_aliases, preferred_brand, default_size_text, upc FROM products WHERE status = 'active' ORDER BY id");
  const upcDigits = originalName.replace(/\D/g, "");
  const upc = upcDigits.length >= 8 ? products.find((product) => product.upc && String(product.upc) === upcDigits) : null;
  if (upc) return { product: upc, confidence: "high", method: "upc" };
  for (const product of products) {
    const exactNames = [product.canonical_name, product.display_name, ...String(product.common_aliases || "").split(",")].map(normalizeProductName).filter(Boolean);
    if (exactNames.includes(base)) return { product, confidence: "high", method: "exact_alias" };
  }
  const possible = products.filter((product) => {
    const productName = normalizeProductName([product.preferred_brand, product.display_name, product.default_size_text].filter(Boolean).join(" "));
    const canonical = normalizeProductName(product.canonical_name || product.display_name);
    return base && (productName.includes(base) || base.includes(productName) || canonical.includes(base) || base.includes(canonical));
  });
  return possible.length === 1 ? { product: possible[0], confidence: "check", method: "normalized_filename" } : { product: null, confidence: "unknown", method: possible.length > 1 ? "ambiguous" : "no_match", candidates: possible.slice(0, 5).map((product) => ({ id: product.id, display_name: product.display_name })) };
}

async function productImageBatchPayload(batchId) {
  const batch = await get("SELECT * FROM product_image_upload_batches WHERE id = ?", [batchId]);
  if (!batch) return null;
  const items = await all("SELECT items.id, items.original_name, items.file_hash, items.suggested_product_id, items.match_confidence, items.duplicate_of_image_id, items.status, items.error_message, items.created_at, products.display_name AS suggested_product_name FROM product_image_upload_items items LEFT JOIN products ON products.id = items.suggested_product_id WHERE items.batch_id = ? ORDER BY items.id", [batchId]);
  return { batch: { ...batch, items } };
}

app.post("/api/admin/product-images/bulk", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), priceImportUpload.array("images", 50), asyncRoute(async (request, response) => {
  const files = request.files || [];
  if (!files.length) { response.status(400).json({ error: "Choose at least one product image." }); return; }
  const sourceType = cleanText(request.body.source_type || "owner_photo", 60).toLowerCase();
  if (!PRODUCT_IMAGE_SOURCE_TYPES.has(sourceType)) { response.status(400).json({ error: "Choose an approved image source type." }); return; }
  const now = new Date().toISOString();
  const result = await run("INSERT INTO product_image_upload_batches (title, source_type, source_note, status, file_count, created_by, created_at, updated_at) VALUES (?, ?, ?, 'needs_review', ?, ?, ?, ?)", [cleanText(request.body.title || `Bulk product images ${localDateFor()}`, 160), sourceType, cleanText(request.body.source_note, 300), files.length, request.adminUser.id, now, now]);
  for (const file of files) {
    const hash = hashUploadedFile(file);
    let status = "needs_review";
    let errorMessage = "";
    const duplicate = await get("SELECT id FROM product_images WHERE file_hash = ? LIMIT 1", [hash]);
    const uploadDuplicate = duplicate ? null : await get("SELECT id FROM product_image_upload_items WHERE file_hash = ? LIMIT 1", [hash]);
    let match = { product: null, confidence: "unknown" };
    try {
      await validateDecodedImage(file);
      match = await matchProductImageFilename(file.originalname);
      if (duplicate || uploadDuplicate) status = "duplicate";
    } catch (error) {
      status = "failed";
      errorMessage = cleanText(error.message || "Image processing failed.", 300);
    }
    await run("INSERT INTO product_image_upload_items (batch_id, original_path, original_name, mime_type, size_bytes, file_hash, suggested_product_id, match_confidence, duplicate_of_image_id, status, error_message, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [result.lastID, uploadedFileUrl(file.filename), sanitizeOriginalFilename(file.originalname), file.mimetype, file.size, hash, match.product?.id || null, match.confidence, duplicate?.id || null, status, errorMessage, now, now]);
  }
  response.status(201).json({ message: "Product images uploaded as private matching drafts.", ...(await productImageBatchPayload(result.lastID)) });
}));

app.get("/api/admin/product-images/bulk/:id", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const payload = await productImageBatchPayload(Number.parseInt(request.params.id, 10));
  if (!payload) { response.status(404).json({ error: "Product image batch was not found." }); return; }
  response.json(payload);
}));

app.post("/api/admin/product-images/bulk/items/:id/accept", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const item = await get("SELECT items.*, batch.source_type, batch.source_note, batch.created_by FROM product_image_upload_items items JOIN product_image_upload_batches batch ON batch.id = items.batch_id WHERE items.id = ?", [Number.parseInt(request.params.id, 10)]);
  if (!item || item.status === "duplicate" || item.status === "failed") { response.status(409).json({ error: "Choose a valid, non-duplicate image draft." }); return; }
  const productId = Number.parseInt(request.body.product_id || item.suggested_product_id, 10);
  const product = await get("SELECT id, display_name FROM products WHERE id = ? AND status = 'active'", [productId]);
  if (!product) { response.status(400).json({ error: "Choose the correct active product." }); return; }
  const fullPath = uploadPathFromPhotoPath(item.original_path);
  if (!fullPath) { response.status(409).json({ error: "Original private image is unavailable." }); return; }
  const file = { path: fullPath, filename: path.basename(fullPath), originalname: item.original_name, mimetype: item.mime_type, size: item.size_bytes };
  const paths = await optimizeProductImage(file);
  const now = new Date().toISOString();
  const approvePublic = request.body.approve_public === true;
  if (approvePublic) await run("UPDATE product_images SET is_primary = 0, updated_at = ? WHERE product_id = ?", [now, product.id]);
  const image = await run("INSERT INTO product_images (product_id, image_path, original_image_path, original_name, mime_type, size_bytes, file_hash, thumbnail_path, card_path, detail_path, alt_text, source_type, source_note, status, is_primary, uploaded_by, moderated_by, moderated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [product.id, paths.imagePath, paths.originalPath, item.original_name, item.mime_type, item.size_bytes, item.file_hash, paths.thumbnailPath || paths.imagePath, paths.cardPath || paths.imagePath, paths.detailPath || paths.imagePath, cleanText(request.body.alt_text || `${product.display_name} product image`, 240), item.source_type, item.source_note || "", approvePublic ? "approved" : "draft", approvePublic ? 1 : 0, item.created_by, approvePublic ? request.adminUser.id : null, approvePublic ? now : null, now, now]);
  await run("UPDATE product_image_upload_items SET suggested_product_id = ?, match_confidence = 'human_confirmed', status = ?, updated_at = ? WHERE id = ?", [product.id, approvePublic ? "approved" : "matched", now, item.id]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: approvePublic ? "BULK_PRODUCT_IMAGE_APPROVED" : "BULK_PRODUCT_IMAGE_MATCHED", affectedType: "product_image", affectedId: image.lastID, metadata: { product_id: product.id, source_type: item.source_type } });
  response.json({ message: approvePublic ? "Image matched and approved for public product display." : "Image matched as a private moderation draft.", image_id: image.lastID, ...(await productImageBatchPayload(item.batch_id)) });
}));

app.post("/api/admin/product-images/:id/moderate", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const imageId = Number.parseInt(request.params.id, 10);
  const image = await get("SELECT * FROM product_images WHERE id = ?", [imageId]);
  if (!image) { response.status(404).json({ error: "Product image was not found." }); return; }
  const status = cleanEnum(request.body.status, ["approved", "hidden", "rejected"], "hidden");
  const primary = status === "approved" && request.body.is_primary !== false;
  const now = new Date().toISOString();
  if (primary) await run("UPDATE product_images SET is_primary = 0, updated_at = ? WHERE product_id = ?", [now, image.product_id]);
  await run("UPDATE product_images SET status = ?, is_primary = ?, alt_text = ?, source_note = ?, moderated_by = ?, moderated_at = ?, updated_at = ? WHERE id = ?", [status, primary ? 1 : 0, cleanText(request.body.alt_text || image.alt_text, 240), cleanText(request.body.source_note || image.source_note, 300), request.adminUser.id, now, now, imageId]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: `PRODUCT_IMAGE_${status.toUpperCase()}`, affectedType: "product_image", affectedId: imageId, metadata: { product_id: image.product_id, primary } });
  const saved = await get("SELECT id, product_id, alt_text, status, is_primary FROM product_images WHERE id = ?", [imageId]);
  response.json({ message: `Product image ${status}.`, image: { ...saved, image_url: saved.status === "approved" ? `/api/product-images/${saved.id}/file` : "" } });
}));

app.get("/api/admin/product-images/:id/file", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const image = await get("SELECT image_path FROM product_images WHERE id = ?", [Number.parseInt(request.params.id, 10)]);
  if (!image) { response.status(404).send("Image not found."); return; }
  sendUploadFileByFilename(path.basename(image.image_path), response);
}));

app.get("/api/product-images/:id/file", asyncRoute(async (request, response) => {
  const image = await get("SELECT images.image_path FROM product_images images JOIN products ON products.id = images.product_id WHERE images.id = ? AND images.status = 'approved' AND products.status = 'active'", [Number.parseInt(request.params.id, 10)]);
  if (!image) { response.status(404).send("Image not found."); return; }
  const filename = path.basename(image.image_path);
  sendUploadFileByFilename(filename, response);
}));

async function priceHistoryForProduct(product) {
  if (!product?.id) return { sufficient_history: false, observation_count: 0, minimum_observations: DEAL_HISTORY_MIN_OBSERVATIONS, message: "Not enough price history yet" };
  const since = new Date(Date.now() - DEAL_HISTORY_WINDOW_DAYS * 86400000).toISOString();
  const rows = await all(`SELECT id, store_id, price, comparison_price, comparison_unit, unit, size_text, price_type, promotion_conditions, display_offer_text, status, source_date, reviewed_at, submitted_at, valid_from_date, valid_through_date
    FROM price_reports WHERE product_id = ? AND status IN ('approved','expired') AND datetime(COALESCE(NULLIF(source_date,''), NULLIF(reviewed_at,''), submitted_at)) >= datetime(?) ORDER BY datetime(COALESCE(NULLIF(source_date,''), NULLIF(reviewed_at,''), submitted_at)) ASC`, [product.id, since]);
  const targetUnit = String(product.default_unit || "").toLowerCase();
  const targetSize = String(product.default_size_text || "").trim().toLowerCase();
  const comparable = rows.filter((row) => {
    const unit = String(row.comparison_unit || row.unit || "").toLowerCase();
    if (targetUnit && unit !== targetUnit) return false;
    if (["each", "package"].includes(unit) && targetSize && row.size_text && String(row.size_text).trim().toLowerCase() !== targetSize) return false;
    return Number.isFinite(Number(row.comparison_price ?? row.price));
  });
  const observations = [];
  const seen = new Set();
  for (const row of comparable) {
    const observedDate = dateInputValue(row.source_date || row.reviewed_at || row.submitted_at);
    const value = Number(row.comparison_price ?? row.price);
    const key = `${observedDate}:${row.store_id}:${value}`;
    if (!observedDate || seen.has(key)) continue;
    seen.add(key);
    observations.push({ date: observedDate, price: value, store_id: row.store_id, price_type: normalizePriceType(row.price_type), conditions: row.promotion_conditions || row.display_offer_text || "" });
  }
  const distinctDates = new Set(observations.map((item) => item.date)).size;
  if (observations.length < DEAL_HISTORY_MIN_OBSERVATIONS || distinctDates < 3) return { sufficient_history: false, observation_count: observations.length, distinct_date_count: distinctDates, minimum_observations: DEAL_HISTORY_MIN_OBSERVATIONS, window_days: DEAL_HISTORY_WINDOW_DAYS, message: "Not enough price history yet" };
  const values = observations.map((item) => item.price).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const typical = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  const current = await get(`SELECT COALESCE(comparison_price, unit_price, price) AS value FROM price_reports WHERE product_id = ? AND ${publicPriceEligibilitySql("price_reports")} ORDER BY COALESCE(comparison_price, unit_price, price), submitted_at DESC LIMIT 1`, [product.id]);
  const currentValue = current?.value == null ? null : Number(current.value);
  const differencePercent = currentValue == null || !typical ? null : Number((((currentValue - typical) / typical) * 100).toFixed(1));
  let label = "Near recent typical price";
  if (differencePercent != null && differencePercent <= -5) label = currentValue <= values[0] ? "Lowest recently observed" : "Below recent typical price";
  else if (differencePercent != null && differencePercent >= 5) label = "Above recent typical price";
  return { sufficient_history: true, observation_count: observations.length, distinct_date_count: distinctDates, window_days: DEAL_HISTORY_WINDOW_DAYS, recent_typical_price: Number(typical.toFixed(2)), current_price: currentValue, difference_percent: differencePercent, recent_low: values[0], recent_high: values.at(-1), label, observations: observations.slice(-24), comparability: { unit: targetUnit || "report unit", size_text: targetSize || "compatible report size" } };
}

function arenaDateWindow(value = "week") {
  const today = localDateFor();
  const atNoon = new Date(`${today}T12:00:00.000Z`);
  const shift = (days) => { const date = new Date(atNoon); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  if (value === "today") return { key: "today", start_date: today, end_date: today, label: today };
  if (value === "last7") return { key: "last7", start_date: shift(-6), end_date: today, label: `${shift(-6)}–${today}` };
  const mondayOffset = (atNoon.getUTCDay() + 6) % 7;
  return { key: "week", start_date: shift(-mondayOffset), end_date: shift(6 - mondayOffset), label: `${shift(-mondayOffset)}–${shift(6 - mondayOffset)}` };
}

async function activeJanesvilleArenaStores() {
  return all("SELECT id, name, address, city, state FROM stores WHERE active = 1 AND lower(trim(city)) = 'janesville' AND lower(trim(state)) IN ('wi','wisconsin') ORDER BY name");
}

function arenaReportPublicRow(row) {
  const formatted = formatPublicReport(row);
  return {
    ...formatted,
    observed_at: row.observed_at || formatted.source_date || formatted.reviewed_at || formatted.submitted_at,
    product_name: row.product_display_name || formatted.item_name,
    product_size_text: row.product_default_size_text || formatted.size_text,
    product_attributes: parseMetadataJson(row.product_attributes_json),
    generic_product_type: row.generic_product_type || "",
    is_conditional: isConditionalOffer(formatted)
  };
}

async function arenaCurrentRows(options = {}) {
  const filters = [
    "products.status = 'active'",
    "stores.active = 1",
    "lower(trim(stores.city)) = 'janesville'",
    "lower(trim(stores.state)) IN ('wi','wisconsin')",
    publicPriceEligibilitySql("pr"),
    "COALESCE(users.account_status, 'active') NOT IN ('suspended','banned','deleted','deactivated')",
    "(NULLIF(products.default_unit, '') IS NULL OR lower(COALESCE(NULLIF(pr.comparison_unit,''),pr.unit)) = lower(products.default_unit))",
    "(NULLIF(products.default_size_text,'') IS NULL OR (NULLIF(pr.size_text,'') IS NOT NULL AND lower(trim(pr.size_text)) = lower(trim(products.default_size_text))))"
  ];
  const params = [];
  if (options.productId) { filters.push("pr.product_id = ?"); params.push(Number(options.productId)); }
  if (Array.isArray(options.productIds) && options.productIds.length) {
    const productIds = [...new Set(options.productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
    if (productIds.length) { filters.push(`pr.product_id IN (${productIds.map(() => "?").join(",")})`); params.push(...productIds); }
  }
  if (options.category) { filters.push("products.category = ?"); params.push(cleanText(options.category, 40).toLowerCase()); }
  if (options.storeId) { filters.push("pr.store_id = ?"); params.push(Number(options.storeId)); }
  if (options.window) { filters.push("date(COALESCE(NULLIF(pr.source_date,''),NULLIF(pr.reviewed_at,''),pr.submitted_at)) BETWEEN date(?) AND date(?)"); params.push(options.window.start_date, options.window.end_date); }
  const rows = await all(`${reportSelectWithProduct()}
    WHERE ${filters.join(" AND ")}
    ORDER BY pr.product_id, pr.store_id, COALESCE(pr.comparison_price,pr.unit_price,pr.price), datetime(COALESCE(NULLIF(pr.source_date,''),NULLIF(pr.reviewed_at,''),pr.submitted_at)) DESC`, params);
  return rows.map((row) => arenaReportPublicRow({ ...row, observed_at: row.source_date || row.reviewed_at || row.submitted_at }));
}

async function arenaSettings() {
  return (await get("SELECT minimum_broad_products, minimum_broad_categories, no_clear_leader_margin, history_window_days FROM price_arena_settings WHERE id = 1")) || { minimum_broad_products: 20, minimum_broad_categories: 3, no_clear_leader_margin: 1, history_window_days: 30 };
}

async function arenaPriceDrops(options = {}) {
  const window = options.window || arenaDateWindow("week");
  const current = await arenaCurrentRows({ category: options.category, storeId: options.storeId });
  const currentBest = new Map();
  for (const row of current) {
    if (options.mode === "unconditional" && row.is_conditional) continue;
    const key = `${row.product_id}:${row.store_id}`;
    if (!currentBest.has(key) || arenaPriceValue(row) < arenaPriceValue(currentBest.get(key))) currentBest.set(key, row);
  }
  const historyWindowDays = Number((await arenaSettings()).history_window_days || 30);
  const historyRows = currentBest.size ? await all(`${reportSelectWithProduct()}
    WHERE products.status = 'active' AND stores.active = 1
      AND lower(trim(stores.city)) = 'janesville' AND lower(trim(stores.state)) IN ('wi','wisconsin')
      AND pr.status IN ('approved','expired')
      AND date(COALESCE(NULLIF(pr.source_date,''),NULLIF(pr.reviewed_at,''),pr.submitted_at)) >= date(?, '-' || ? || ' days')
      AND ((COALESCE(pr.proof_type,'') != 'store_page' AND NULLIF(pr.source_url,'') IS NULL) OR pr.location_verification_status IN ('verified_exact_store','verified_market'))
    ORDER BY datetime(COALESCE(NULLIF(pr.source_date,''),NULLIF(pr.reviewed_at,''),pr.submitted_at)) DESC`, [window.end_date, historyWindowDays]) : [];
  const historyByKey = new Map();
  for (const historyRow of historyRows) {
    const key = `${historyRow.product_id}:${historyRow.store_id}`;
    if (!historyByKey.has(key)) historyByKey.set(key, []);
    historyByKey.get(key).push(historyRow);
  }
  const drops = [];
  for (const row of currentBest.values()) {
    const currentValue = arenaPriceValue(row);
    const declaredPrevious = Number(row.regular_price);
    if (Number.isFinite(declaredPrevious) && declaredPrevious > currentValue) {
      drops.push({ type: "retailer_declared", label: "Retailer price drop", report: row, previous_price: declaredPrevious, current_price: currentValue, dollar_drop: Number((declaredPrevious - currentValue).toFixed(2)), percent_drop: Number(((declaredPrevious - currentValue) / declaredPrevious * 100).toFixed(1)), observed_at: row.observed_at });
      continue;
    }
    const previous = (historyByKey.get(`${row.product_id}:${row.store_id}`) || []).find((candidate) => candidate.id !== row.id
      && String(candidate.source_date || candidate.reviewed_at || candidate.submitted_at) < String(row.observed_at)
      && String(candidate.comparison_unit || candidate.unit || "").toLowerCase() === String(row.comparison_unit || row.unit || "").toLowerCase()
      && (!["each","count","ct","pack"].includes(String(row.comparison_unit || row.unit || "").toLowerCase()) || String(candidate.size_text || "").toLowerCase() === String(row.size_text || "").toLowerCase()));
    const previousValue = previous ? arenaPriceValue(previous) : null;
    if (previousValue != null && previousValue > currentValue && String(row.observed_at).slice(0, 10) >= window.start_date) drops.push({ type: "observed", label: "Price dropped since last verified observation", report: row, previous_price: previousValue, current_price: currentValue, dollar_drop: Number((previousValue - currentValue).toFixed(2)), percent_drop: Number(((previousValue - currentValue) / previousValue * 100).toFixed(1)), observed_at: row.observed_at });
  }
  const sort = options.sort || "newest";
  drops.sort((a, b) => sort === "percent" ? b.percent_drop - a.percent_drop : sort === "dollars" ? b.dollar_drop - a.dollar_drop : sort === "ending" ? String(a.report.valid_through_date || "9999-12-31").localeCompare(String(b.report.valid_through_date || "9999-12-31")) : String(b.observed_at).localeCompare(String(a.observed_at)));
  return drops;
}

async function publicSubstitutesForProduct(productId, mode = "all") {
  const source = await get("SELECT id, display_name, default_size_text, default_unit, product_attributes_json FROM products WHERE id = ? AND status = 'active'", [productId]);
  if (!source) return [];
  const relations = await all(`SELECT substitutions.*, targets.display_name AS target_name, targets.default_size_text AS target_size_text, targets.default_unit AS target_unit, targets.product_attributes_json AS target_attributes_json
    FROM product_substitutions substitutions JOIN products targets ON targets.id = substitutions.target_product_id
    WHERE substitutions.source_product_id = ? AND substitutions.status IN ('confirmed','alternative_only') AND substitutions.confidence IN ('high','medium') AND targets.status = 'active' ORDER BY CASE substitutions.confidence WHEN 'high' THEN 1 ELSE 2 END, targets.display_name`, [productId]);
  const stores = await activeJanesvilleArenaStores();
  const targetIds = relations.map((relation) => Number(relation.target_product_id));
  const allRows = await arenaCurrentRows({ productIds: [productId, ...targetIds] });
  const sourceComparison = productComparison(allRows.filter((row) => Number(row.product_id) === Number(productId)), stores, mode);
  const sourcePrice = sourceComparison.cheapest_price;
  const output = [];
  for (const relation of relations) {
    const conflicts = dietaryConflicts(source.product_attributes_json, relation.target_attributes_json);
    const compatibleSize = sizeCompatible(source, { default_size_text: relation.target_size_text, default_unit: relation.target_unit });
    if (conflicts.length || !compatibleSize) continue;
    const comparison = productComparison(allRows.filter((row) => Number(row.product_id) === Number(relation.target_product_id)), stores, mode);
    if (!comparison.cheapest_price) continue;
    const savings = sourcePrice == null ? null : Number((sourcePrice - comparison.cheapest_price).toFixed(2));
    output.push({ id: relation.id, product_id: relation.target_product_id, product_name: relation.target_name, size_text: relation.target_size_text || "", substitution_type: relation.status === "alternative_only" ? "alternative" : relation.substitution_type, confidence: relation.confidence, reasons: parseMetadataJson(relation.reasons_json), safety_warnings: [...parseMetadataJson(relation.safety_warnings_json), ...conflicts], size_comparable: compatibleSize, cheapest: comparison.stores[0] || null, potential_savings: savings != null && savings > 0 ? savings : null, same_product: false });
  }
  return output;
}

app.get("/api/savings/products/:id/comparison", asyncRoute(async (request, response) => {
  await refreshExpiredReports();
  const productId = Number.parseInt(request.params.id, 10); const mode = request.query.mode === "unconditional" ? "unconditional" : "all";
  const product = await getProductById(productId); if (!product) { response.status(404).json({ error: "Product was not found." }); return; }
  const stores = await activeJanesvilleArenaStores();
  const rows = await arenaCurrentRows({ productId: product.id });
  response.json({ product: formatPublicProduct(product), comparison: productComparison(rows, stores, mode), coverage: { eligible_janesville_stores: stores.length, compared_stores: new Set(rows.map((row) => row.store_id)).size }, methodology: "Only current, verified, comparable prices from active Janesville stores are included. Missing store prices are not ranked." });
}));

app.get("/api/savings/price-drops", asyncRoute(async (request, response) => {
  const window = arenaDateWindow(cleanText(request.query.window || "week", 20)); const mode = request.query.mode === "unconditional" ? "unconditional" : "all";
  const drops = await arenaPriceDrops({ window, mode, category: request.query.category, storeId: request.query.store_id, sort: request.query.sort });
  response.json({ window, mode, total: drops.length, drops: drops.slice(0, Math.min(100, Math.max(1, Number(request.query.limit) || 50))), methodology: "Retailer-declared drops and Grocery Radar observed decreases are labeled separately." });
}));

app.get("/api/savings/store-showdown", asyncRoute(async (request, response) => {
  const window = arenaDateWindow(cleanText(request.query.window || "week", 20)); const mode = request.query.mode === "unconditional" ? "unconditional" : "all"; const settings = await arenaSettings();
  const stores = await activeJanesvilleArenaStores(); const rows = await arenaCurrentRows({ window, category: request.query.category }); const leaderboard = storeLeaderboard(rows, settings, mode);
  const byId = new Map(leaderboard.rankings.map((entry) => [Number(entry.store_id), entry]));
  response.json({ window, mode, eligible_store_count: stores.length, leaderboard: { ...leaderboard, rankings: stores.map((store) => ({ store_id: store.id, store_name: store.name, current_price_count: byId.get(Number(store.id))?.current_price_count || 0, lowest_count: byId.get(Number(store.id))?.lowest_count || 0, tied_lowest_count: byId.get(Number(store.id))?.tied_lowest_count || 0, category_count: byId.get(Number(store.id))?.category_count || 0 })).sort((a, b) => b.lowest_count - a.lowest_count || b.tied_lowest_count - a.tied_lowest_count || a.store_name.localeCompare(b.store_name)) }, disclaimer: "Based on products currently verified in Grocery Radar. Coverage varies by store; this is not a claim that one store is universally cheapest." });
}));

app.get("/api/savings/categories", asyncRoute(async (request, response) => {
  const window = arenaDateWindow(cleanText(request.query.window || "week", 20)); const mode = request.query.mode === "unconditional" ? "unconditional" : "all";
  response.json({ window, mode, categories: categoryLeaderboards(await arenaCurrentRows({ window }), await arenaSettings(), mode), methodology: "Every eligible comparable product in the selected category and window is included." });
}));

app.get("/api/savings/categories/:category/basket", asyncRoute(async (request, response) => {
  const category = cleanText(request.params.category, 40).toLowerCase(); const mode = request.query.mode === "unconditional" ? "unconditional" : "all";
  const stores = await activeJanesvilleArenaStores(); const rows = await arenaCurrentRows({ category });
  const storeSets = new Map(); for (const row of rows) { if (!storeSets.has(row.product_id)) storeSets.set(row.product_id, new Set()); storeSets.get(row.product_id).add(Number(row.store_id)); }
  const items = [...storeSets.entries()].filter(([, storeIds]) => storeIds.size >= 2).slice(0, 50).map(([productId]) => ({ product_id: Number(productId), quantity: 1 }));
  if (!items.length) { response.json({ category, mode, product_count: 0, store_coverage: [], comparable_subset: { product_count: 0, stores: [] }, message: "Limited comparison data for this category." }); return; }
  const result = optimizeBasket(items, rows, stores, 1, mode); const storeMap = new Map(stores.map((store) => [Number(store.id), store.name]));
  response.json({ category, mode, product_count: items.length, store_coverage: result.store_coverage.map((plan) => ({ ...plan, store_name: storeMap.get(Number(plan.store_ids[0])) || "Store" })), comparable_subset: result.comparable_subset, methodology: "Every eligible comparable product in the category dataset is included; partial totals disclose matched counts." });
}));

app.post("/api/savings/basket", asyncRoute(async (request, response) => {
  const incoming = Array.isArray(request.body.items) ? request.body.items : [];
  const items = incoming.map((item) => ({ product_id: Number(item.product_id), quantity: Math.max(1, Number(item.quantity || 1)), item_name: cleanText(item.item_name, 160) })).filter((item) => Number.isInteger(item.product_id) && item.product_id > 0).slice(0, 100);
  if (!items.length) { response.status(400).json({ error: "Add at least one catalog product to compare." }); return; }
  const mode = request.body.mode === "unconditional" ? "unconditional" : "all"; const stores = await activeJanesvilleArenaStores(); const rows = await arenaCurrentRows({ productIds: items.map((item) => item.product_id) });
  const result = optimizeBasket(items, rows, stores, request.body.max_stores || "any", mode);
  const storeMap = new Map(stores.map((store) => [Number(store.id), store.name]));
  const decorate = (plan) => plan ? { ...plan, stores: plan.store_ids.map((id) => ({ id, name: storeMap.get(Number(id)) || "Store" })) } : null;
  response.json({ ...result, selected: decorate(result.selected), best_one_store: decorate(result.best_one_store), best_two_stores: decorate(result.best_two_stores), cheapest_any_store: decorate(result.cheapest_any_store), store_coverage: result.store_coverage.map(decorate), comparable_subset: { ...result.comparable_subset, stores: result.comparable_subset.stores.map(decorate) }, methodology: "Plans use current verified prices only. Partial totals are never ranked as if missing products were included." });
}));

app.get("/api/savings/products/:id/substitutes", asyncRoute(async (request, response) => {
  const productId = Number.parseInt(request.params.id, 10); const product = await getProductById(productId); if (!product) { response.status(404).json({ error: "Product was not found." }); return; }
  response.json({ product: formatPublicProduct(product), substitutes: await publicSubstitutesForProduct(product.id, request.query.mode === "unconditional" ? "unconditional" : "all"), methodology: "Substitutes are not identical products. Only human-confirmed high/medium relationships are public; unknown dietary compatibility is never claimed." });
}));

app.get("/api/savings/overview", asyncRoute(async (request, response) => {
  const window = arenaDateWindow(cleanText(request.query.window || "week", 20)); const mode = request.query.mode === "unconditional" ? "unconditional" : "all"; const settings = await arenaSettings(); const stores = await activeJanesvilleArenaStores(); const rows = await arenaCurrentRows({ window, category: request.query.category });
  const leaderboard = storeLeaderboard(rows, settings, mode);
  response.json({ window, mode, eligible_stores: stores, leaderboard, categories: categoryLeaderboards(rows, settings, mode).slice(0, 12), price_drops: (await arenaPriceDrops({ window, mode, category: request.query.category, storeId: request.query.store_id, sort: request.query.sort || "newest" })).slice(0, 50), homepage_module_eligible: leaderboard.threshold_met, disclaimer: "All active Janesville stores participate automatically when comparable verified data exists. Missing prices are not treated as higher prices." });
}));

app.get("/api/products/:id", asyncRoute(async (request, response) => {
  await refreshExpiredReports();

  const productId = Number.parseInt(request.params.id, 10);
  const product = await getProductById(productId);

  if (!product) {
    response.status(404).json({ error: "Product was not found." });
    return;
  }

  await trackAnalyticsEvent(request, {
    event_type: "product_viewed",
    product_id: productId,
    cart_item_name: product.display_name,
    category: product.category
  });

  const resolvedProductId = product.id;
  const reports = await all(
    `
      ${reportSelectWithProduct()}
      WHERE pr.product_id = ?
        AND ${publicPriceEligibilitySql("pr")}
        AND (NULLIF(products.default_unit, '') IS NULL OR lower(COALESCE(NULLIF(pr.comparison_unit, ''), pr.unit)) = lower(products.default_unit))
        AND (NULLIF(products.default_size_text, '') IS NULL OR NULLIF(pr.size_text, '') IS NULL OR lower(trim(pr.size_text)) = lower(trim(products.default_size_text)))
        AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
      ORDER BY
        stores.name ASC,
        CASE pr.confidence
          WHEN 'high' THEN 5
          WHEN 'medium-high' THEN 4
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 2
          ELSE 0
        END DESC,
        pr.verification_count DESC,
        pr.submitted_at DESC
    `,
    [resolvedProductId]
  );
  const storeGroups = [];

  for (const report of reports.map(formatPublicReport)) {
    let group = storeGroups.find((item) => item.store_id === report.store_id);

    if (!group) {
      group = {
        store_id: report.store_id,
        store_name: report.store_name,
        reports: []
      };
      storeGroups.push(group);
    }

    group.reports.push(report);
  }

  response.json({
    product: formatPublicProduct(product),
    reports: reports.map(formatPublicReport),
    store_groups: storeGroups,
    quality: await publicQualitySummary(resolvedProductId, null, request.session?.userId || null),
    price_history: await priceHistoryForProduct(product),
    store_comparison: productComparison(await arenaCurrentRows({ productId: resolvedProductId }), await activeJanesvilleArenaStores(), "all"),
    substitutes: await publicSubstitutesForProduct(resolvedProductId, "all"),
    redirected_from_product_id: resolvedProductId !== productId ? productId : null,
    allergy_warning: "Always check the package label before buying or eating."
  });
}));

const QUALITY_TAGS = new Set(["fresh", "good quality", "overripe", "underripe", "bruised / damaged", "mold/spoilage observed", "near expiration", "short shelf life", "great shelf life", "hot when purchased", "cold when purchased", "dry", "overcooked", "undercooked concern", "stale", "packaging damaged", "seal issue", "good condition"]);
const QUALITY_REPORT_REASONS = ["spam", "harassment", "offensive", "not about this product", "misleading", "safety concern", "other"];

function parsedJsonArray(value) {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch (error) { return []; }
}

function formatQualityReview(row, currentUserId = null) {
  return {
    id: row.id,
    product_id: row.product_id,
    store_id: row.store_id,
    store_name: row.store_name,
    username: row.username,
    rating: Number(row.rating),
    rating_label: `${Number(row.rating)} out of 5`,
    tags: parsedJsonArray(row.tags_json),
    comment: row.comment || "",
    purchase_date: row.purchase_date || "",
    review_date: row.review_date,
    verified_purchase: Boolean(row.verified_purchase),
    helpful_count: Number(row.helpful_count || 0),
    is_owner: Number(currentUserId) === Number(row.user_id),
    status: row.status,
    created_at: row.created_at,
    disclaimer: "Quality comments are community observations and may vary by purchase."
  };
}

async function publicQualitySummary(productId, storeId = null, currentUserId = null) {
  const params = [productId];
  const storeFilter = storeId ? "AND qr.store_id = ?" : "";
  if (storeId) params.push(storeId);
  const reviews = await all(`
    SELECT qr.*, users.username, stores.name AS store_name,
      (SELECT COUNT(*) FROM quality_review_helpful_votes votes WHERE votes.quality_review_id = qr.id) AS helpful_count
    FROM quality_reviews qr
    JOIN users ON users.id = qr.user_id
    JOIN stores ON stores.id = qr.store_id
    WHERE qr.product_id = ? ${storeFilter}
      AND qr.status = 'visible'
      AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
    ORDER BY qr.review_date DESC, qr.id DESC LIMIT 100
  `, params);
  const now = Date.now();
  const recent = reviews.filter((row) => now - new Date(row.review_date).getTime() <= 30 * 86400000);
  const average = (rows) => rows.length ? Number((rows.reduce((sum, row) => sum + Number(row.rating), 0) / rows.length).toFixed(1)) : null;
  return {
    recent_rating: average(recent),
    recent_count: recent.length,
    all_time_rating: average(reviews),
    all_time_count: reviews.length,
    reviews: reviews.map((row) => formatQualityReview(row, currentUserId)),
    disclaimer: "Quality comments are community observations and may vary by purchase."
  };
}

app.get("/api/products/:id/quality", asyncRoute(async (request, response) => {
  const productId = Number.parseInt(request.params.id, 10);
  const storeId = Number.parseInt(request.query.store_id, 10);
  response.json(await publicQualitySummary(productId, Number.isInteger(storeId) ? storeId : null, request.session?.userId || null));
}));

app.post("/api/quality-reviews", requireLogin, asyncRoute(async (request, response) => {
  const productId = Number.parseInt(request.body.product_id, 10);
  const storeId = Number.parseInt(request.body.store_id, 10);
  const rating = Number.parseInt(request.body.rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Choose a quality rating from 1 to 5.");
  const [product, store] = await Promise.all([get("SELECT id FROM products WHERE id = ? AND status = 'active'", [productId]), get("SELECT id FROM stores WHERE id = ? AND active = 1", [storeId])]);
  if (!product || !store) { response.status(404).json({ error: "Product or store was not found." }); return; }
  const requestedReportId = Number.parseInt(request.body.price_report_id, 10);
  const linkedReport = Number.isInteger(requestedReportId) ? await get(`SELECT id, source_import_batch_id, source_date FROM price_reports WHERE id = ? AND product_id = ? AND store_id = ? AND status = 'approved' AND COALESCE(submitted_by_user_id, user_id) = ?`, [requestedReportId, productId, storeId, request.currentUser.id]) : null;
  const tags = (Array.isArray(request.body.tags) ? request.body.tags : []).map((tag) => cleanText(tag, 40).toLowerCase()).filter((tag) => QUALITY_TAGS.has(tag)).slice(0, 8);
  const now = new Date().toISOString();
  const result = await run(`INSERT INTO quality_reviews (user_id, product_id, store_id, price_report_id, import_batch_id, rating, tags_json, comment, purchase_date, review_date, verified_purchase, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?, ?)`, [request.currentUser.id, productId, storeId, linkedReport?.id || null, linkedReport?.source_import_batch_id || null, rating, JSON.stringify(tags), cleanText(request.body.comment, 400), linkedReport?.source_date || normalizeImportDate(request.body.purchase_date, false), dateInputValue(now), linkedReport ? 1 : 0, now, now]);
  const review = await get(`SELECT qr.*, users.username, stores.name AS store_name, 0 AS helpful_count FROM quality_reviews qr JOIN users ON users.id = qr.user_id JOIN stores ON stores.id = qr.store_id WHERE qr.id = ?`, [result.lastID]);
  response.status(201).json({ message: linkedReport ? "Quality review posted with verified purchase." : "Quality review posted.", review: formatQualityReview(review, request.currentUser.id) });
}));

app.patch("/api/quality-reviews/:id", requireLogin, asyncRoute(async (request, response) => {
  const id = Number.parseInt(request.params.id, 10);
  const existing = await get("SELECT * FROM quality_reviews WHERE id = ? AND user_id = ? AND status != 'removed'", [id, request.currentUser.id]);
  if (!existing) { response.status(404).json({ error: "Review was not found." }); return; }
  const rating = Number.parseInt(request.body.rating ?? existing.rating, 10);
  if (rating < 1 || rating > 5) throw new Error("Choose a quality rating from 1 to 5.");
  const tags = (Array.isArray(request.body.tags) ? request.body.tags : parsedJsonArray(existing.tags_json)).map((tag) => cleanText(tag, 40).toLowerCase()).filter((tag) => QUALITY_TAGS.has(tag)).slice(0, 8);
  await run("UPDATE quality_reviews SET rating = ?, tags_json = ?, comment = ?, updated_at = ? WHERE id = ?", [rating, JSON.stringify(tags), cleanText(request.body.comment ?? existing.comment, 400), new Date().toISOString(), id]);
  response.json({ message: "Review updated." });
}));

app.delete("/api/quality-reviews/:id", requireLogin, asyncRoute(async (request, response) => {
  const result = await run("UPDATE quality_reviews SET status = 'removed', updated_at = ? WHERE id = ? AND user_id = ?", [new Date().toISOString(), Number.parseInt(request.params.id, 10), request.currentUser.id]);
  if (!result.changes) { response.status(404).json({ error: "Review was not found." }); return; }
  response.json({ message: "Review removed." });
}));

app.post("/api/quality-reviews/:id/report", requireLogin, asyncRoute(async (request, response) => {
  const reviewId = Number.parseInt(request.params.id, 10);
  const reason = cleanText(request.body.reason, 40).toLowerCase();
  if (!QUALITY_REPORT_REASONS.includes(reason)) throw new Error("Choose a valid report reason.");
  const review = await get("SELECT id, user_id FROM quality_reviews WHERE id = ? AND status = 'visible'", [reviewId]);
  if (!review || Number(review.user_id) === Number(request.currentUser.id)) { response.status(400).json({ error: "That review cannot be reported." }); return; }
  await run("INSERT OR IGNORE INTO quality_review_reports (quality_review_id, reporter_user_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?)", [reviewId, request.currentUser.id, reason, cleanText(request.body.details, 300), new Date().toISOString()]);
  response.status(201).json({ message: "Review reported for moderation." });
}));

app.post("/api/quality-reviews/:id/helpful", requireLogin, asyncRoute(async (request, response) => {
  const reviewId = Number.parseInt(request.params.id, 10);
  const review = await get("SELECT id, user_id, product_id FROM quality_reviews WHERE id = ? AND status = 'visible'", [reviewId]);
  if (!review || Number(review.user_id) === Number(request.currentUser.id)) { response.status(400).json({ error: "You cannot mark this review helpful." }); return; }
  const result = await run("INSERT OR IGNORE INTO quality_review_helpful_votes (quality_review_id, user_id, created_at) VALUES (?, ?, ?)", [reviewId, request.currentUser.id, new Date().toISOString()]);
  if (result.changes) await createUserNotification(review.user_id, "quality_review_helpful", "Someone found your review helpful", "A shopper found your quality observation helpful.", { related_type: "quality_review", related_id: reviewId, target_tab: "productView", target_url: `/?tab=productView&product=${review.product_id}&review=${reviewId}` });
  response.json({ message: "Marked helpful." });
}));

app.get("/api/admin/quality-reviews/reports", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const reports = await all(`SELECT reports.*, reviews.product_id, reviews.store_id, reviews.rating, reviews.comment, reviews.status AS review_status, reporter.username AS reporter_username, author.username AS author_username FROM quality_review_reports reports JOIN quality_reviews reviews ON reviews.id = reports.quality_review_id JOIN users reporter ON reporter.id = reports.reporter_user_id JOIN users author ON author.id = reviews.user_id ORDER BY CASE reports.status WHEN 'open' THEN 0 ELSE 1 END, reports.created_at DESC LIMIT 100`);
  response.json({ reports });
}));

app.post("/api/admin/quality-reviews/:id/moderate", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const id = Number.parseInt(request.params.id, 10);
  const status = cleanEnum(request.body.status, ["visible", "hidden", "removed"], "hidden");
  const now = new Date().toISOString();
  const review = await get("SELECT * FROM quality_reviews WHERE id = ?", [id]);
  if (!review) { response.status(404).json({ error: "Review was not found." }); return; }
  const result = await run("UPDATE quality_reviews SET status = ?, moderation_note = ?, moderated_by = ?, moderated_at = ?, updated_at = ? WHERE id = ?", [status, cleanText(request.body.reason, 300), request.adminUser.id, now, now, id]);
  if (!result.changes) { response.status(404).json({ error: "Review was not found." }); return; }
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: `QUALITY_REVIEW_${status.toUpperCase()}`, affectedType: "quality_review", affectedId: id, metadata: { reason: cleanText(request.body.reason, 300) } });
  if (status !== "visible") await createUserNotification(review.user_id, "quality_review_moderated", "Your quality review was moderated", cleanText(request.body.reason, 300) || `Your quality review was ${status}.`, { related_type: "quality_review", related_id: id, target_tab: "productView", target_url: `/?tab=productView&product=${review.product_id}&review=${id}` });
  response.json({ message: `Review ${status}.` });
}));

app.post("/api/proof-submissions", upload.single("proof_photo"), asyncRoute(async (request, response) => {
  let photoPath = request.file ? uploadedFileUrl(request.file.filename) : "";

  try {
    const storeId = Number.parseInt(request.body.store_id, 10);
    const store = Number.isInteger(storeId) && storeId > 0
      ? await get("SELECT * FROM stores WHERE id = ? AND active = 1", [storeId])
      : null;

    if (!store) {
      throw new Error("Choose a store before submitting proof.");
    }

    const publicProofType = cleanProofSubmissionType(request.body.proof_type);
    const proofMapping = PUBLIC_PROOF_SUBMISSION_TYPES[publicProofType];
    const now = new Date().toISOString();
    const source = cleanSourceMetadata(request.body, {
      source_title: request.body.source_url ? proofMapping.label : "",
      source_checked_at: request.body.source_url ? now : ""
    });

    if (!photoPath && !source.source_url) {
      throw new Error("Upload a proof image or add a source link.");
    }

    const user = await getSessionUser(request);
    if (user && isBlockedAccount(user)) throw new Error(blockedAccountMessage(user));
    const trackingToken = user ? "" : crypto.randomBytes(32).toString("base64url");
    const itemHint = cleanText(request.body.item_hint || request.body.item_name, 120);
    const priceHint = cleanText(request.body.price_hint || request.body.price, 40);
    const userNotes = cleanText(request.body.notes, 300);
    const proofFileHash = hashUploadedFile(request.file);
    const duplicate = await findDuplicateProofBatch({
      userId: user?.id || null,
      proofFileHash,
      sourceUrl: source.source_url
    });
    const trustProfile = user ? await contributorTrustProfile(user.id) : TRUST_LEVELS[0];
    const draftBatchForRules = {
      source_type: proofMapping.source_type,
      proof_type: proofMapping.proof_type,
      photo_path: photoPath,
      source_url: source.source_url,
      source_checked_at: source.source_checked_at,
      created_at: now,
      duplicate_scope: duplicate?.duplicate_scope || ""
    };
    const proofQualityFlags = proofQualityFlagsForBatch(draftBatchForRules);
    const reviewPriority = reviewPriorityForProof(draftBatchForRules, trustProfile);
    const notes = composeProofSubmissionNotes({
      store_id: store.id,
      store_name: store.name,
      public_proof_type: publicProofType,
      item_hint: itemHint,
      price_hint: priceHint,
      notes: userNotes
    });

    const result = await run(
      `
        INSERT INTO price_import_batches (
          source_type,
          proof_type,
          photo_path,
          photo_original_name,
          photo_mime_type,
          photo_size_bytes,
          status,
          source_url,
          source_title,
          source_domain,
          source_checked_at,
          default_store_id,
          receipt_store_name,
          receipt_store_address,
          notes,
          created_by,
          proof_file_hash,
          duplicate_of_batch_id,
          duplicate_scope,
          review_priority,
          proof_quality_flags,
          anonymous_tracking_token_hash,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'needs_admin_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        proofMapping.source_type,
        proofMapping.proof_type,
        photoPath,
        request.file ? sanitizeOriginalFilename(request.file.originalname) : null,
        request.file ? request.file.mimetype : null,
        request.file ? request.file.size : null,
        source.source_url,
        source.source_title,
        source.source_domain,
        source.source_checked_at,
        store.id,
        store.name,
        store.address || "",
        notes,
        user?.id || null,
        proofFileHash,
        duplicate?.duplicate_of_batch_id || null,
        duplicate?.duplicate_scope || "",
        reviewPriority,
        proofQualityFlags.join(","),
        trackingToken ? trackingTokenHash(trackingToken) : null,
        now,
        now
      ]
    );

    const aiJob = photoPath ? await ensureAiProofJob(result.lastID, { automatic: true }) : null;

    await createAdminNotification(
      "proof_submission_needs_review",
      "New proof needs review",
      `${user?.username || "An anonymous shopper"} submitted ${proofMapping.label.toLowerCase()} proof for ${store.name}.`,
      {
        related_type: "price_import_batch",
        related_id: result.lastID,
        related_import_batch_id: result.lastID,
        target_tab: "priceImporterTab",
        target_url: `/admin.html?tab=priceImporterTab&batch=${result.lastID}`
      }
    );

    if (user) await createUserNotification(
      user.id,
      "proof_received",
      `${proofMapping.label} received`,
      `Thanks — your ${store.name} ${proofMapping.label.toLowerCase()} proof is waiting for review.`,
      {
        related_type: "price_import_batch",
        related_id: result.lastID,
        related_import_batch_id: result.lastID,
        target_tab: "profile",
        target_url: `/?tab=accountView&section=proof&proof=${result.lastID}`
      }
    );

    const rows = await priceImportRowsForBatchIds([result.lastID]);
    const batch = await priceImportBatchById(result.lastID);

    response.status(201).json({
      message: aiJob ? "Proof saved. Receipt AI preparation is running in the background; a human will make the final decision." : "Proof saved for human review. Staff may run AI manually when useful.",
      batch_id: result.lastID,
      tracking_token: trackingToken || undefined,
      status: "needs_admin_review",
      ai_processing: aiJob ? { status: aiJob.status, proof_id: result.lastID, automatic: true } : { status: "manual_available", proof_id: result.lastID, automatic: false },
      batch: formatPriceImportBatch(batch, rows)
    });
  } catch (error) {
    deleteUploadedFile(photoPath);
    photoPath = null;
    throw error;
  }
}));

app.get("/api/proof-submissions/:batchId", requireLogin, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);

  if (!Number.isInteger(batchId) || batchId <= 0) {
    response.status(400).json({ error: "Proof submission id is not valid." });
    return;
  }

  const batch = await priceImportBatchById(batchId);

  if (!batch || !isProofSubmissionBatch(batch)) {
    response.status(404).json({ error: "Proof submission was not found." });
    return;
  }

  if (Number(batch.created_by) !== Number(request.currentUser.id) && !request.currentUser.is_admin) {
    response.status(404).json({ error: "Proof submission was not found." });
    return;
  }

  const rows = await priceImportRowsForBatchIds([batchId]);

  response.json({
    proof: await proofResultSummary(batch, rows)
  });
}));

app.get("/api/submissions/status/:trackingToken", asyncRoute(async (request, response) => {
  const token = cleanText(request.params.trackingToken, 120);
  if (!/^[A-Za-z0-9_-]{40,120}$/.test(token)) {
    response.status(404).json({ error: "Submission was not found." });
    return;
  }
  const batch = await get("SELECT * FROM price_import_batches WHERE anonymous_tracking_token_hash = ? LIMIT 1", [trackingTokenHash(token)]);
  if (!batch || !isProofSubmissionBatch(batch)) {
    response.status(404).json({ error: "Submission was not found." });
    return;
  }
  const outcome = await get("SELECT approved_count, rejected_count, public_summary_json, finalized_at FROM submission_outcomes WHERE proof_id = ?", [batch.id]);
  const notes = parseProofSubmissionNotes(batch.notes);
  response.json({
    submission: {
      status: outcome ? "reviewed" : "waiting_for_review",
      status_label: outcome ? "Reviewed" : "Waiting for review",
      submitted_at: batch.created_at,
      updated_at: outcome?.finalized_at || batch.updated_at,
      store_name: notes.store_name || batch.receipt_store_name || "",
      proof_type: notes.public_proof_type || batch.source_type || batch.proof_type,
      approved_count: Number(outcome?.approved_count || 0),
      not_approved_count: Number(outcome?.rejected_count || 0),
      outcome: outcome ? parseMetadataJson(outcome.public_summary_json) : null,
      unread: Boolean(outcome)
    }
  });
}));

app.post("/api/reports", requireLogin, upload.single("proof_photo"), asyncRoute(async (request, response) => {
  let photoPath = request.file ? uploadedFileUrl(request.file.filename) : null;
  const photoOriginalName = request.file ? sanitizeOriginalFilename(request.file.originalname) : null;
  const photoMimeType = request.file ? request.file.mimetype : null;
  const photoSizeBytes = request.file ? request.file.size : null;

  try {
    const validStoreIds = await getActiveStoreIds();
    const cleanReport = validateReport(request.body, validStoreIds);
    const submittedAt = new Date().toISOString();
    const source = cleanSourceMetadata(request.body, {
      source_checked_at: request.body.source_url ? submittedAt : ""
    });

    if (cleanReport.proof_type !== "no_photo" && !photoPath) {
      throw new Error("Photo proof is required for this proof type.");
    }

    const unitPrice = calculateUnitPrice(
      cleanReport.price,
      cleanReport.quantity,
      cleanReport.unit
    );
    const user = request.currentUser;
    const confidence = calculateConfidence(cleanReport.proof_type, 0, 0);
    const productId = await resolveReportProductId(cleanReport, user.id);
    const result = await run(
      `
        INSERT INTO price_reports (
          user_id,
          store_id,
          product_id,
          item_name,
          brand,
          category,
          price,
          regular_price,
          sale_price,
          size_text,
          quantity,
          unit,
          unit_price,
          proof_type,
          photo_path,
          photo_original_name,
          photo_mime_type,
          photo_size_bytes,
          notes,
          confidence,
          source_url,
          source_title,
          source_domain,
          source_checked_at,
          verification_count,
          dispute_count,
          status,
          submitted_at,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'pending', ?, ?)
      `,
      [
        user.id,
        cleanReport.store_id,
        productId,
        cleanReport.item_name,
        cleanReport.brand,
        cleanReport.category,
        cleanReport.price,
        cleanReport.regular_price,
        cleanReport.sale_price,
        cleanReport.size_text,
        cleanReport.quantity,
        unitPrice.unit,
        unitPrice.unitPrice,
        cleanReport.proof_type,
        photoPath,
        photoOriginalName,
        photoMimeType,
        photoSizeBytes,
        cleanReport.notes,
        confidence,
        source.source_url,
        source.source_title,
        source.source_domain,
        source.source_checked_at,
        submittedAt,
        cleanReport.expires_at
      ]
    );

    const points = getSubmissionPoints(cleanReport.proof_type);
    const actionByProof = {
      no_photo: "submit_typed_price",
      shelf_tag_photo: "submit_shelf_tag_photo",
      receipt_photo: "submit_receipt_photo",
      weekly_ad: "submit_weekly_ad"
    };

    await addPointEvent(user.id, actionByProof[cleanReport.proof_type], points, result.lastID);
    const accuracyScore = await updateUserAccuracy(user.id);

    const savedReport = await get(
      `
        SELECT
          pr.*,
          stores.name AS store_name,
          users.username AS username,
          users.email AS user_email
        FROM price_reports pr
        JOIN stores ON stores.id = pr.store_id
        JOIN users ON users.id = pr.user_id
        WHERE pr.id = ?
      `,
      [result.lastID]
    );

    await sendAdminReportReviewEmail(savedReport);
    await createAdminNotification(
      "new_report_submitted",
      "New price report needs review",
      `${user.username} submitted ${cleanReport.item_name} at ${savedReport.store_name}.`,
      {
        related_type: "report",
        related_id: result.lastID,
        target_tab: "reviewTab",
        target_url: `/admin.html?tab=reviewTab&report=${result.lastID}`
      }
    );

    if (photoPath) {
      await createAdminNotification(
        "photo_proof_uploaded",
        "Photo proof uploaded",
        `${user.username} uploaded proof for ${cleanReport.item_name}.`,
        {
          related_type: "report",
          related_id: result.lastID,
          target_tab: "reviewTab",
          target_url: `/admin.html?tab=reviewTab&report=${result.lastID}`
        }
      );
    }

    response.status(201).json({
      message: "Submitted for admin review. It will appear publicly after approval.",
      report_id: result.lastID,
      product_id: productId,
      points_awarded: points,
      unit_price_label: unitPrice.formatted,
      user: {
        ...publicUser(user),
        points: user.points + points,
        accuracy_score: accuracyScore
      }
    });
  } catch (error) {
    deleteUploadedFile(photoPath);
    photoPath = null;
    throw error;
  }
}));

app.post("/api/reports/:id/verify", requireVerificationLogin, asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(reportId)) {
    response.status(400).json({ error: "Report id is not valid." });
    return;
  }

  const cleanVerification = validateVerification(request.body);
  const report = await get(
    `
      SELECT pr.*, users.account_status AS owner_account_status
      FROM price_reports pr
      JOIN users ON users.id = pr.user_id
      WHERE pr.id = ?
    `,
    [reportId]
  );

  if (!report ||
    report.status !== "approved" ||
    ["suspended", "banned", "deleted", "deactivated"].includes(report.owner_account_status || "active")) {
    response.status(404).json({ error: "Price report was not found." });
    return;
  }

  const verifier = request.currentUser;

  if (verifier.id === report.user_id) {
    response.status(400).json({ error: "You cannot verify your own report." });
    return;
  }

  const existingVerification = await get(
    "SELECT id FROM verifications WHERE price_report_id = ? AND user_id = ?",
    [reportId, verifier.id]
  );

  if (existingVerification) {
    response.status(409).json({ error: "You already verified or disputed this report." });
    return;
  }

  await run(
    `
      INSERT INTO verifications (
        price_report_id,
        user_id,
        verification_type,
        note,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      reportId,
      verifier.id,
      cleanVerification.verification_type,
      cleanVerification.note,
      new Date().toISOString()
    ]
  );

  let verificationCount = report.verification_count;
  let disputeCount = report.dispute_count;

  if (cleanVerification.verification_type === "confirmed") {
    verificationCount += 1;
  } else {
    disputeCount += 1;
  }

  const confidence = calculateConfidence(report.proof_type, verificationCount, disputeCount);
  let status = report.status;

  if (status !== "expired" && confidence === "disputed") {
    status = "disputed";
  }

  await run(
    `
      UPDATE price_reports
      SET verification_count = ?,
          dispute_count = ?,
          confidence = ?,
          status = ?
      WHERE id = ?
    `,
    [verificationCount, disputeCount, confidence, status, reportId]
  );

  await addPointEvent(
    verifier.id,
    "verify_another_price",
    POINTS.verify_another_price,
    reportId
  );

  if (cleanVerification.verification_type === "confirmed") {
    await addPointEvent(
      report.user_id,
      "submitted_price_verified_bonus",
      POINTS.submitted_price_verified_bonus,
      reportId
    );

    const highConfidenceAlreadyAwarded = await get(
      `
        SELECT id
        FROM point_events
        WHERE price_report_id = ?
          AND user_id = ?
          AND action = 'high_confidence_bonus'
      `,
      [reportId, report.user_id]
    );

    if (confidence === "high" && !highConfidenceAlreadyAwarded) {
      await addPointEvent(
        report.user_id,
        "high_confidence_bonus",
        POINTS.high_confidence_bonus,
        reportId
      );
    }
  }

  await updateUserAccuracy(report.user_id);

  const updatedReport = await get(
    `
      SELECT
        pr.*,
        stores.name AS store_name,
        stores.address AS store_address,
        users.username AS username
      FROM price_reports pr
      JOIN stores ON stores.id = pr.store_id
      JOIN users ON users.id = pr.user_id
      WHERE pr.id = ?
    `,
    [reportId]
  );

  if (cleanVerification.verification_type === "confirmed") {
    await createUserNotification(
      report.user_id,
      "report_verified",
      "Your price was verified.",
      `${verifier.username} verified your ${updatedReport.item_name} price at ${updatedReport.store_name}.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
  } else {
    await createUserNotification(
      report.user_id,
      "report_disputed",
      "Someone reported a price issue.",
      `${verifier.username} marked your ${updatedReport.item_name} report as ${cleanVerification.verification_type.replace(/_/g, " ")}.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
    await createAdminNotification(
      "disputed_report",
      "Price report disputed",
      `${updatedReport.item_name} at ${updatedReport.store_name} was reported as ${cleanVerification.verification_type.replace(/_/g, " ")}.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "pricesTab",
        target_url: `/admin.html?tab=pricesTab&filter=disputed&report=${reportId}`
      }
    );
  }

  response.json({
    message: "Verification saved.",
    report: formatPublicReport(updatedReport),
    points_awarded: POINTS.verify_another_price
  });
}));

app.get("/api/users/:username", asyncRoute(async (request, response) => {
  const username = validateUsername(request.params.username);
  const user = await get("SELECT * FROM users WHERE lower(username) = lower(?)", [username]);

  if (!user) {
  response.json({
    exists: false,
    username,
    points: 0,
    rank: getRank(0),
    submissions: 0,
    verified_submissions: 0,
    accuracy_score: 0
  });
    return;
  }

  const stats = await get(
    `
      SELECT
        COUNT(*) AS submissions,
        SUM(CASE WHEN verification_count > 0 THEN 1 ELSE 0 END) AS verified_submissions,
        SUM(CASE WHEN status = 'disputed' OR status = 'rejected' THEN 1 ELSE 0 END) AS disputed_submissions
      FROM price_reports
      WHERE user_id = ?
    `,
    [user.id]
  );
  const submissions = stats.submissions || 0;
  const disputed = stats.disputed_submissions || 0;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const rewardStats = await get(
    `
      SELECT
        COALESCE(SUM(CASE WHEN point_events.created_at >= ? THEN point_events.points ELSE 0 END), 0) AS points_this_week,
        COUNT(CASE WHEN point_events.action = 'proof_accepted_reviewable' THEN 1 END) AS proof_accepted_count
      FROM point_events
      WHERE point_events.user_id = ?
    `,
    [weekStart.toISOString(), user.id]
  );
  const proofStats = await get(
    `
      SELECT
        COUNT(DISTINCT CASE WHEN batches.status = 'proof_rejected' THEN batches.id END) AS proof_rejected_count,
        COUNT(CASE WHEN rows.status = 'approved' THEN 1 END) AS approved_prices_from_proof
      FROM price_import_batches batches
      LEFT JOIN price_import_rows rows ON rows.batch_id = batches.id
      WHERE batches.created_by = ?
        AND batches.notes LIKE ?
    `,
    [user.id, `${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );
  const accuracyScore = submissions
    ? Math.max(0, Math.round(((submissions - disputed) / submissions) * 100))
    : 0;
  const trustProfile = await contributorTrustProfile(user.id);

  response.json({
    exists: true,
    username: user.username,
    points: user.points,
    rank: getRank(user.points),
    trust_level: trustProfile.label,
    trust_level_key: trustProfile.key,
    submissions,
    verified_submissions: stats.verified_submissions || 0,
    points_this_week: rewardStats.points_this_week || 0,
    proof_accepted_count: rewardStats.proof_accepted_count || 0,
    approved_prices_from_proof: proofStats.approved_prices_from_proof || 0,
    accuracy_score: accuracyScore
  });
}));

async function usernameModerationReason(username) {
  const staticReason = usernameSafetyReason(username);
  if (staticReason) return staticReason;

  const phrases = await all("SELECT phrase FROM blocked_username_phrases ORDER BY phrase");
  return usernameSafetyReason(username, phrases.map((row) => row.phrase));
}

async function auditExistingUsernames() {
  const users = await all("SELECT id, username FROM users");
  for (const user of users) {
    const reason = await usernameModerationReason(user.username);
    if (!reason) continue;
    await run(
      `UPDATE users
       SET username_status = 'needs_change', force_username_change = 1,
           hide_from_leaderboard = 1,
           username_moderation_note = COALESCE(NULLIF(username_moderation_note, ''), ?)
       WHERE id = ?`,
      [reason, user.id]
    );
  }
}

app.post("/api/account/username", requireLogin, asyncRoute(async (request, response) => {
  const username = validateUsername(request.body.username);

  if (isOwnerAccount(request.currentUser) && normalizedUsername(username) !== OWNER_USERNAME) {
    response.status(400).json({ error: "The Owner account username cannot be changed." });
    return;
  }

  const moderationReason = await usernameModerationReason(username);

  if (moderationReason) {
    response.status(400).json({ error: moderationReason });
    return;
  }

  const existing = await get(
    "SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?",
    [username, request.currentUser.id]
  );
  if (existing) {
    response.status(409).json({ error: "Username is already registered." });
    return;
  }

  const oldUsername = request.currentUser.username;
  const restoreLeaderboard = request.currentUser.force_username_change || request.currentUser.username_status === "needs_change";
  await run(
    `UPDATE users
     SET username = ?, username_status = 'approved', force_username_change = 0,
         username_moderation_note = NULL,
         hide_from_leaderboard = CASE WHEN ? THEN 0 ELSE hide_from_leaderboard END
     WHERE id = ?`,
    [username, restoreLeaderboard ? 1 : 0, request.currentUser.id]
  );
  await run(
    `INSERT INTO username_history
      (user_id, old_username, new_username, action, reason, created_at)
     VALUES (?, ?, ?, 'user_change', 'User selected a clean username.', ?)`,
    [request.currentUser.id, oldUsername, username, new Date().toISOString()]
  );

  response.json({
    message: "Username updated. You are eligible for leaderboards when your contributions qualify.",
    user: publicUser(await get("SELECT * FROM users WHERE id = ?", [request.currentUser.id]))
  });
}));

app.get("/api/leaderboard", asyncRoute(async (request, response) => {
  const view = ["week", "month", "all", "approved_proofs", "helpful"].includes(request.query.view)
    ? request.query.view
    : "week";
  const since = view === "week"
    ? new Date(Date.now() - 7 * 86400000).toISOString()
    : view === "month"
      ? new Date(Date.now() - 30 * 86400000).toISOString()
      : null;
  const rows = await all(
    `
      SELECT *
      FROM (
        SELECT
          users.id,
          users.username,
          users.points AS all_time_points,
          COALESCE((
            SELECT SUM(events.points) FROM point_events events
            WHERE events.user_id = users.id AND (? IS NULL OR events.created_at >= ?)
          ), 0) AS period_points,
          (SELECT COUNT(DISTINCT batches.id)
           FROM price_import_batches batches
           JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
           WHERE batches.created_by = users.id) AS approved_proofs,
          (SELECT COUNT(rows.id)
           FROM price_import_batches batches
           JOIN price_import_rows rows ON rows.batch_id = batches.id AND rows.status = 'approved'
           WHERE batches.created_by = users.id) AS approved_contributions,
          users.points,
          users.created_at
        FROM users
        WHERE users.account_status = 'active'
          AND users.hide_from_leaderboard = 0
          AND users.force_username_change = 0
          AND users.username_status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM price_import_batches flagged
            WHERE flagged.created_by = users.id
              AND flagged.duplicate_scope = 'same_user_duplicate'
          )
      )
      WHERE approved_proofs > 0 OR approved_contributions > 0
      ORDER BY
        CASE WHEN ? = 'approved_proofs' THEN approved_proofs END DESC,
        CASE WHEN ? = 'helpful' THEN approved_contributions END DESC,
        CASE WHEN ? IN ('week', 'month') THEN period_points ELSE points END DESC,
        approved_contributions DESC,
        created_at ASC
      LIMIT 25
    `,
    [since, since, view, view, view]
  );

  const leaderboard = [];
  for (const row of rows) {
    if (await usernameModerationReason(row.username)) continue;
    const trust = await contributorTrustProfile(row.id);
    leaderboard.push({
      rank: leaderboard.length + 1,
      username: row.username,
      points: view === "week" || view === "month" ? row.period_points : row.all_time_points,
      trust_level: trust.label,
      approved_proof_count: row.approved_proofs || 0,
      contribution_count: row.approved_contributions || 0
    });
  }

  response.json({ view, leaderboard });
}));

app.get("/api/rewards", (request, response) => {
  response.json({
    points: POINTS,
    rewards_are_informational_only: true,
    beta_rewards_message: "Beta points help track trusted proof contributors. They are not cash, guaranteed money, or promised gift cards.",
    verified_email_required_for_rewards: true,
    reward_rules: REWARD_RULES,
    trust_levels: TRUST_LEVELS,
    proof_reward_rules: {
      proof_accepted_for_review: POINTS.proof_accepted_reviewable,
      proof_used_for_approved_price: POINTS.proof_used_for_approved_price,
      source_link_included: POINTS.proof_source_link_bonus,
      clear_photo_bonus: POINTS.proof_clear_photo_bonus,
      duplicate_confirmation_from_different_user: POINTS.duplicate_confirmation,
      max_points_per_proof_upload: POINTS.proof_batch_cap
    }
  });
});

async function priceImportBatchById(batchId) {
  return get(
    `
      SELECT batches.*, users.username AS created_by_username, reviewer.username AS review_claimed_by_username
      FROM price_import_batches batches
      LEFT JOIN users ON users.id = batches.created_by
      LEFT JOIN users reviewer ON reviewer.id = batches.review_claimed_by
      WHERE batches.id = ?
    `,
    [batchId]
  );
}

async function priceImportRowsForBatchIds(batchIds) {
  if (!batchIds.length) {
    return [];
  }

  return all(
    `
      SELECT
        rows.*,
        stores.name AS store_name,
        products.display_name AS product_display_name,
        (
          SELECT product_images.id FROM product_images
          WHERE product_images.product_id = rows.product_id AND product_images.status = 'approved'
          ORDER BY product_images.is_primary DESC, product_images.id ASC LIMIT 1
        ) AS product_image_id,
        (
          SELECT product_images.alt_text FROM product_images
          WHERE product_images.product_id = rows.product_id AND product_images.status = 'approved'
          ORDER BY product_images.is_primary DESC, product_images.id ASC LIMIT 1
        ) AS product_image_alt_text,
        creator.username AS created_by_username,
        updater.username AS updated_by_username,
        approver.username AS approved_by_username,
        rejecter.username AS rejected_by_username
      FROM price_import_rows rows
      LEFT JOIN stores ON stores.id = rows.store_id
      LEFT JOIN products ON products.id = rows.product_id
      LEFT JOIN users creator ON creator.id = rows.created_by
      LEFT JOIN users updater ON updater.id = rows.updated_by
      LEFT JOIN users approver ON approver.id = rows.approved_by
      LEFT JOIN users rejecter ON rejecter.id = rows.rejected_by
      WHERE rows.batch_id IN (${batchIds.map(() => "?").join(", ")})
      ORDER BY rows.created_at ASC, rows.id ASC
    `,
    batchIds
  );
}

async function priceImportRowById(rowId) {
  return get(
    `
      SELECT
        rows.*,
        batches.photo_path,
        batches.photo_original_name,
        batches.photo_mime_type,
        batches.photo_size_bytes,
        batches.source_type,
        stores.name AS store_name,
        products.display_name AS product_display_name
      FROM price_import_rows rows
      JOIN price_import_batches batches ON batches.id = rows.batch_id
      LEFT JOIN stores ON stores.id = rows.store_id
      LEFT JOIN products ON products.id = rows.product_id
      WHERE rows.id = ?
    `,
    [rowId]
  );
}

const activeAiProofJobs = new Set();
const queuedAiProofJobs = new Set();

async function aiProcessingSettings() {
  const stored = await get("SELECT * FROM ai_processing_settings WHERE id = 1");
  const runtime = aiRuntimeConfig();
  const { todayStart } = dateWindowStarts();
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const monthStart = month.toISOString();
  const [todayUsage, monthUsage] = await Promise.all([
    get(`SELECT COUNT(*) AS analyses, SUM(CASE WHEN attempt_kind = 'retry' THEN 1 ELSE 0 END) AS retries, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failures, SUM(total_tokens) AS total_tokens, SUM(estimated_cost_usd) AS estimated_cost_usd FROM ai_proof_attempts WHERE started_at >= ?`, [todayStart]),
    get(`SELECT COUNT(*) AS analyses, SUM(CASE WHEN attempt_kind = 'retry' THEN 1 ELSE 0 END) AS retries, SUM(total_tokens) AS total_tokens, SUM(estimated_cost_usd) AS estimated_cost_usd FROM ai_proof_attempts WHERE started_at >= ?`, [monthStart])
  ]);
  return {
    enabled: Boolean(stored?.enabled),
    manual_only: Boolean(stored?.manual_only),
    max_analyses_per_hour: Math.max(1, Number(stored?.max_analyses_per_hour || 20)),
    max_analyses_per_day: Math.max(1, Number(stored?.max_analyses_per_day || 100)),
    retry_limit: Math.max(0, Number(stored?.retry_limit || 2)),
    max_concurrency: Math.min(10, Math.max(1, Number(stored?.max_concurrency || 3))),
    max_queued_jobs: Math.min(2000, Math.max(10, Number(stored?.max_queued_jobs || 200))),
    model: stored?.primary_model || stored?.model || runtime.model,
    primary_model: stored?.primary_model || stored?.model || runtime.model,
    fallback_model: stored?.fallback_model || runtime.fallbackModel || "",
    provider: runtime.provider,
    credential_configured: Boolean(runtime.apiKey || runtime.testResponse),
    updated_at: stored?.updated_at || "",
    usage: {
      today: { analyses: Number(todayUsage?.analyses || 0), retries: Number(todayUsage?.retries || 0), failures: Number(todayUsage?.failures || 0), total_tokens: todayUsage?.total_tokens == null ? null : Number(todayUsage.total_tokens), estimated_cost_usd: todayUsage?.estimated_cost_usd == null ? null : Number(todayUsage.estimated_cost_usd) },
      month: { analyses: Number(monthUsage?.analyses || 0), retries: Number(monthUsage?.retries || 0), total_tokens: monthUsage?.total_tokens == null ? null : Number(monthUsage.total_tokens), estimated_cost_usd: monthUsage?.estimated_cost_usd == null ? null : Number(monthUsage.estimated_cost_usd) }
    }
  };
}

async function aiStateForProof(proofId) {
  const job = await get("SELECT * FROM ai_proof_jobs WHERE proof_id = ?", [proofId]);
  const analysis = await get("SELECT * FROM ai_proof_analyses WHERE proof_id = ?", [proofId]);
  const stores = analysis ? await all("SELECT id, name FROM stores WHERE active = 1 ORDER BY name") : [];
  const retailer = normalizedRetailerName(analysis?.detected_store_name);
  const storeCandidates = retailer ? stores.filter((store) => normalizedRetailerName(store.name) === retailer) : [];
  const submittedStore = stores.find((store) => Number(store.id) === Number(analysis?.submitted_store_id)) || null;
  const resolvedStore = stores.find((store) => Number(store.id) === Number(analysis?.resolved_store_id)) || null;
  return {
    job: job ? { ...job, last_error: job.last_error || "" } : null,
    analysis: analysis ? {
      ...analysis,
      warnings: parseMetadataJson(analysis.warnings_json),
      structured: parseMetadataJson(analysis.structured_json),
      detected_retailer: retailer,
      detected_store_name: usefulDetectedStoreName(analysis.detected_store_name),
      store_candidates: storeCandidates,
      store_mismatch: Boolean(retailer && (!analysis.detected_store_id || !analysis.submitted_store_id || Number(analysis.detected_store_id) !== Number(analysis.submitted_store_id))),
      exact_store_match_found: Boolean(analysis.detected_store_id),
      store_needs_resolution: !analysis.resolved_store_id,
      submitted_store: submittedStore,
      resolved_store: resolvedStore
    } : null
  };
}

async function drainAiProofQueue() {
  const settings = await aiProcessingSettings();
  while (activeAiProofJobs.size < settings.max_concurrency && queuedAiProofJobs.size) {
    const proofId = queuedAiProofJobs.values().next().value;
    queuedAiProofJobs.delete(proofId);
    activeAiProofJobs.add(proofId);
    processAiProofJob(proofId)
      .catch((error) => console.warn(`AI proof job ${proofId} failed: ${cleanText(error.message, 180)}`))
      .finally(() => {
        activeAiProofJobs.delete(proofId);
        setImmediate(() => drainAiProofQueue().catch(() => {}));
      });
  }
}

function scheduleAiProofJob(proofId) {
  const id = Number(proofId);
  if (activeAiProofJobs.has(id) || queuedAiProofJobs.has(id)) return;
  queuedAiProofJobs.add(id);
  setImmediate(() => drainAiProofQueue().catch((error) => console.warn(`AI queue failed: ${cleanText(error.message, 180)}`)));
}

async function ensureAiProofJob(proofId, options = {}) {
  const proof = await priceImportBatchById(proofId);
  if (!proof || !proof.photo_path) return null;
  if (options.automatic && proof.source_type !== "receipt" && proof.proof_type !== "receipt_photo") return null;
  const now = new Date().toISOString();
  const fingerprint = proofFingerprint(proof);
  const settings = await aiProcessingSettings();
  const waiting = await get("SELECT COUNT(*) AS count FROM ai_proof_jobs WHERE status IN ('waiting','analyzing')");
  if (Number(waiting?.count || 0) >= settings.max_queued_jobs) return null;
  await run(`INSERT INTO ai_proof_jobs (proof_id, status, attempt_count, manual_requested, request_fingerprint, queued_at, updated_at) VALUES (?, 'waiting', 0, ?, ?, ?, ?) ON CONFLICT(proof_id) DO UPDATE SET status = CASE WHEN ? THEN 'waiting' ELSE ai_proof_jobs.status END, manual_requested = CASE WHEN ? THEN 1 ELSE ai_proof_jobs.manual_requested END, request_fingerprint = excluded.request_fingerprint, last_error = CASE WHEN ? THEN NULL ELSE ai_proof_jobs.last_error END, queued_at = CASE WHEN ? THEN excluded.queued_at ELSE ai_proof_jobs.queued_at END, updated_at = excluded.updated_at`, [proofId, options.force ? 1 : 0, fingerprint, now, now, options.force ? 1 : 0, options.force ? 1 : 0, options.force ? 1 : 0, options.force ? 1 : 0]);
  const job = await get("SELECT * FROM ai_proof_jobs WHERE proof_id = ?", [proofId]);
  if (["waiting", "ai_failed"].includes(job.status) || options.force) scheduleAiProofJob(proofId);
  return job;
}

async function aiUsageAllowed(settings) {
  const now = Date.now();
  const [hour, day] = await Promise.all([
    get("SELECT COUNT(*) AS count FROM ai_proof_attempts WHERE started_at >= ?", [new Date(now - 3600000).toISOString()]),
    get("SELECT COUNT(*) AS count FROM ai_proof_attempts WHERE started_at >= ?", [new Date(now - 86400000).toISOString()])
  ]);
  return Number(hour?.count || 0) < settings.max_analyses_per_hour && Number(day?.count || 0) < settings.max_analyses_per_day;
}

async function learnApprovedProductNormalization(row, reportId, productId, reviewerId) {
  if (!productId) return;
  const alias = normalizeProductName(row.item_name);
  if (!alias) return;
  const now = new Date().toISOString();
  await run(`INSERT INTO product_normalization_rules (normalized_alias, display_alias, product_id, category, storage_condition, brand, variant, size_text, confirmation_count, last_approved_report_id, last_approved_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?) ON CONFLICT(normalized_alias) DO UPDATE SET display_alias = excluded.display_alias, product_id = excluded.product_id, category = excluded.category, storage_condition = excluded.storage_condition, brand = excluded.brand, variant = excluded.variant, size_text = excluded.size_text, confirmation_count = product_normalization_rules.confirmation_count + 1, last_approved_report_id = excluded.last_approved_report_id, last_approved_by = excluded.last_approved_by, updated_at = excluded.updated_at`, [alias, row.item_name, productId, row.category, row.storage_condition, row.brand || "", row.variant || "", row.size_text || "", reportId, reviewerId, now, now]);
  await run("UPDATE products SET default_storage_condition = COALESCE(NULLIF(default_storage_condition, ''), ?), default_size_text = COALESCE(NULLIF(default_size_text, ''), ?), preferred_brand = COALESCE(NULLIF(preferred_brand, ''), ?), variant = COALESCE(NULLIF(variant, ''), ?), updated_at = ? WHERE id = ?", [row.storage_condition || null, row.size_text || null, row.brand || null, row.variant || null, now, productId]);
}

async function upsertAiDrafts(proof, analysisId, result, stores, products, now) {
  const validProductIds = new Set(products.map((product) => Number(product.id)));
  const learnedRules = new Map((await all("SELECT * FROM product_normalization_rules")).map((rule) => [rule.normalized_alias, rule]));
  const detectedStore = closestStoreForAi(result.detected_store, stores);
  const initialStoreId = detectedStore && Number(detectedStore.id) === Number(proof.default_store_id) ? Number(proof.default_store_id) : null;
  for (const item of result.items) {
    const learned = learnedRules.get(normalizeProductName(item.normalized_name));
    const requestedProductId = validProductIds.has(Number(learned?.product_id)) ? Number(learned.product_id) : validProductIds.has(Number(item.existing_product_match_id)) && item.existing_product_match_confidence === "high" ? Number(item.existing_product_match_id) : null;
    const knownProduct = requestedProductId ? products.find((product) => Number(product.id) === requestedProductId) : null;
    const localDefaults = localProductNormalization(item.normalized_name);
    const draft = cleanImportRowDraft({
      product_id: requestedProductId,
      store_id: initialStoreId,
      item_name: item.normalized_name || "Unknown item",
      brand: item.brand,
      variant: item.variant,
      category: learned?.category || knownProduct?.category || localDefaults?.category || item.category,
      price: item.price,
      price_basis: item.price_basis,
      comparison_price: item.comparison_price ?? item.unit_price ?? item.price,
      comparison_unit: item.comparison_unit || "each",
      estimated_item_price: item.estimated_item_price,
      approximate_item_weight: item.approximate_item_weight,
      approximate_item_weight_unit: item.approximate_item_weight_unit,
      package_price: item.package_price,
      size_text: item.package_size,
      quantity: item.quantity || 1,
      unit: item.comparison_unit || "each",
      proof_type: proof.proof_type,
      observed_at: result.source_date,
      source_date: result.source_date,
      storage_condition: learned?.storage_condition || knownProduct?.default_storage_condition || localDefaults?.storage_condition || item.storage_type,
      price_type: item.price_type,
      valid_from_date: item.valid_from_date,
      valid_through_date: item.valid_through_date,
      valid_start_at: item.valid_from_date,
      valid_end_at: item.valid_through_date,
      promotion_conditions: item.promotion_conditions,
      promotion_schedule_text: item.promotion_schedule_text,
      display_offer_text: item.display_offer_text,
      promotion_text: item.display_offer_text,
      multibuy_quantity: item.multi_buy_quantity,
      multibuy_total_price: item.multi_buy_total,
      raw_receipt_line: item.raw_text,
      extraction_confidence: item.confidence === "high" ? "high" : item.confidence === "check" ? "medium" : "low",
      extraction_notes: item.research_notes,
      notes: "Prepared by server-side AI. Human review and approval required.",
      status: item.confidence === "high" && promotionGate(item).ready ? "ready_for_review" : "needs_edit"
    });
    const existing = await get("SELECT id, status FROM price_import_rows WHERE ai_analysis_id = ? AND ai_item_index = ?", [analysisId, item.item_index]);
    let rowId = existing?.id;
    if (!existing) rowId = await insertPriceImportRowDraft(proof.id, draft, null, now);
    else if (!['approved', 'rejected'].includes(existing.status)) await run(`UPDATE price_import_rows SET product_id = ?, store_id = ?, item_name = ?, brand = ?, variant = ?, category = ?, price = ?, price_basis = ?, comparison_price = ?, comparison_unit = ?, estimated_item_price = ?, approximate_item_weight = ?, approximate_item_weight_unit = ?, package_price = ?, size_text = ?, quantity = ?, unit = ?, proof_type = ?, observed_at = ?, source_date = ?, storage_condition = ?, price_type = ?, valid_from_date = ?, valid_through_date = ?, valid_start_at = ?, valid_end_at = ?, promotion_conditions = ?, promotion_schedule_text = ?, display_offer_text = ?, promotion_text = ?, multibuy_quantity = ?, multibuy_total_price = ?, raw_receipt_line = ?, extraction_confidence = ?, extraction_notes = ?, notes = ?, status = ?, updated_at = ? WHERE id = ? AND batch_id = ?`, [draft.product_id, draft.store_id, draft.item_name, draft.brand, draft.variant, draft.category, draft.price, draft.price_basis, draft.comparison_price, draft.comparison_unit, draft.estimated_item_price, draft.approximate_item_weight, draft.approximate_item_weight_unit, draft.package_price, draft.size_text, draft.quantity, draft.unit, draft.proof_type, draft.observed_at, draft.source_date, draft.storage_condition, draft.price_type, draft.valid_from_date, draft.valid_through_date, draft.valid_start_at, draft.valid_end_at, draft.promotion_conditions, draft.promotion_schedule_text, draft.display_offer_text, draft.promotion_text, draft.multibuy_quantity, draft.multibuy_total_price, draft.raw_receipt_line, draft.extraction_confidence, draft.extraction_notes, draft.notes, draft.status, now, rowId, proof.id]);
    const safetyWarnings = promotionGate(draft).flags;
    await run("UPDATE price_import_rows SET ai_analysis_id = ?, ai_item_index = ?, ai_confidence = ?, ai_field_confidences_json = ?, ai_warnings_json = ?, research_notes = ?, research_sources_json = ?, suggested_new_product = ?, updated_at = ? WHERE id = ? AND batch_id = ?", [analysisId, item.item_index, item.confidence, JSON.stringify(item.field_confidences), JSON.stringify([...new Set([...(item.warnings || []), ...safetyWarnings])]), item.research_notes, JSON.stringify(item.research_sources), item.suggested_new_product ? 1 : 0, now, rowId, proof.id]);
  }
  await run("UPDATE price_import_rows SET status = 'removed', updated_at = ? WHERE ai_analysis_id = ? AND ai_item_index >= ? AND status NOT IN ('approved','rejected')", [now, analysisId, result.items.length]);
}

async function processAiProofJob(proofId) {
  const settings = await aiProcessingSettings();
  const job = await get("SELECT * FROM ai_proof_jobs WHERE proof_id = ?", [proofId]);
  if (!job || job.status !== "waiting") return;
  const bulkControl = await get("SELECT bulk.paused FROM price_import_batches proofs JOIN bulk_intake_batches bulk ON bulk.id = proofs.bulk_intake_batch_id WHERE proofs.id = ?", [proofId]);
  if (bulkControl?.paused) return;
  if (!settings.enabled || (settings.manual_only && !job.manual_requested) || !settings.credential_configured) {
    await run("UPDATE ai_proof_jobs SET status = 'needs_attention', last_error = ?, updated_at = ? WHERE id = ?", [!settings.enabled ? "AI processing is disabled." : settings.manual_only ? "AI processing is in manual-only mode. Use Run AI to process this proof." : "AI credentials are not configured.", new Date().toISOString(), job.id]);
    return;
  }
  if (!(await aiUsageAllowed(settings))) {
    await run("UPDATE ai_proof_jobs SET status = 'needs_attention', last_error = 'AI usage guard reached. Re-run later or use manual fallback.', updated_at = ? WHERE id = ?", [new Date().toISOString(), job.id]);
    return;
  }
  const now = new Date().toISOString();
  const claimed = await run("UPDATE ai_proof_jobs SET status = 'analyzing', attempt_count = attempt_count + 1, provider = ?, model = ?, started_at = ?, last_error = NULL, updated_at = ? WHERE id = ? AND status = 'waiting'", [settings.provider, settings.model, now, now, job.id]);
  if (!claimed.changes) return;
  const attemptNumber = Number(job.attempt_count || 0) + 1;
  const attemptKind = attemptNumber === 1 ? "initial" : "retry";
  await run("INSERT OR IGNORE INTO ai_proof_attempts (job_id, proof_id, attempt_number, attempt_kind, provider, model, status, request_fingerprint, started_at) VALUES (?, ?, ?, ?, ?, ?, 'analyzing', ?, ?)", [job.id, proofId, attemptNumber, attemptKind, settings.provider, settings.model, job.request_fingerprint || "", now]);
  try {
    const proof = await priceImportBatchById(proofId);
    const fullPath = uploadPathFromPhotoPath(proof.photo_path);
    if (!fullPath) throw new Error("Original proof image could not be found.");
    const [stores, products] = await Promise.all([all("SELECT id, name FROM stores WHERE active = 1 ORDER BY name"), all("SELECT id, display_name, category, default_storage_condition, preferred_brand, common_aliases, variant, upc FROM products WHERE status = 'active' ORDER BY (SELECT COUNT(*) FROM price_reports WHERE price_reports.product_id = products.id AND price_reports.status = 'approved') DESC, display_name LIMIT 500")]);
    const submittedStore = stores.find((store) => Number(store.id) === Number(proof.default_store_id));
    const result = await analyzeProof({ proof, imageBuffer: await fs.promises.readFile(fullPath), mimeType: proof.photo_mime_type || "image/jpeg", submittedStore: submittedStore?.name || "", stores, products, env: { ...process.env, AI_MODEL: settings.model, AI_PRIMARY_MODEL: settings.model } });
    if (!normalizedRetailerName(result.detected_store)) {
      const retailerSignal = normalizedRetailerName([proof.source_domain, proof.source_title, proof.source_url, result.detected_store].filter(Boolean).join(" "));
      if (retailerSignal) {
        result.detected_store = retailerSignal;
        result.detected_store_confidence = result.detected_store_confidence === "unknown" ? "check" : result.detected_store_confidence;
      }
    }
    const detectedStore = closestStoreForAi(result.detected_store, stores);
    const completedAt = new Date().toISOString();
    const latestProof = await priceImportBatchById(proofId);
    if (TERMINAL_REJECTED_PROOF_STATUSES.has(latestProof?.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(latestProof?.status) || ["completed", "rejected"].includes(latestProof?.review_status)) {
      await run("UPDATE ai_proof_attempts SET status = 'completed', last_error = 'Proof closed during analysis; result was not applied.', completed_at = ? WHERE job_id = ? AND attempt_number = ?", [completedAt, job.id, attemptNumber]);
      return;
    }
    await run(`INSERT INTO ai_proof_analyses (job_id, proof_id, proof_type, detected_store_name, detected_store_id, detected_store_confidence, submitted_store_id, source_date, source_date_confidence, overall_confidence, warnings_json, structured_json, item_count, ready_count, check_count, unknown_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(proof_id) DO UPDATE SET job_id = excluded.job_id, proof_type = excluded.proof_type, detected_store_name = excluded.detected_store_name, detected_store_id = excluded.detected_store_id, detected_store_confidence = excluded.detected_store_confidence, submitted_store_id = excluded.submitted_store_id, source_date = excluded.source_date, source_date_confidence = excluded.source_date_confidence, overall_confidence = excluded.overall_confidence, warnings_json = excluded.warnings_json, structured_json = excluded.structured_json, item_count = excluded.item_count, ready_count = excluded.ready_count, check_count = excluded.check_count, unknown_count = excluded.unknown_count, updated_at = excluded.updated_at`, [job.id, proofId, result.proof_type, result.detected_store, detectedStore?.id || null, result.detected_store_confidence, proof.default_store_id || null, result.source_date, result.source_date_confidence, result.overall_confidence, JSON.stringify(result.warnings), JSON.stringify(result), result.items.length, result.counts.high, result.counts.check, result.counts.unknown, completedAt, completedAt]);
    const analysis = await get("SELECT * FROM ai_proof_analyses WHERE proof_id = ?", [proofId]);
    await upsertAiDrafts(proof, analysis.id, result, stores, products, completedAt);
    const finalStatus = result.items.length && !result.counts.unknown ? "ready_for_review" : "needs_attention";
    await run("UPDATE ai_proof_jobs SET status = ?, manual_requested = 0, completed_at = ?, updated_at = ? WHERE id = ?", [finalStatus, completedAt, completedAt, job.id]);
    const usage = result.provider_usage || {};
    await run("UPDATE ai_proof_attempts SET status = 'completed', prompt_tokens = ?, completion_tokens = ?, total_tokens = ?, completed_at = ? WHERE job_id = ? AND attempt_number = ?", [usage.prompt_tokens ?? null, usage.completion_tokens ?? null, usage.total_tokens ?? null, completedAt, job.id, attemptNumber]);
    await run("UPDATE price_import_batches SET status = CASE WHEN status = 'needs_admin_review' THEN status ELSE 'ready_for_review' END, updated_at = ? WHERE id = ? AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') AND COALESCE(review_status, '') NOT IN ('completed','rejected')", [completedAt, proofId]);
    await recordPriceEvent({ batchId: proofId, eventType: "AI_PREPARED", submitterUserId: proof.created_by, reason: `AI prepared ${result.items.length} draft items.`, metadata: { analysis_id: analysis.id, ready: result.counts.high, check: result.counts.check, unknown: result.counts.unknown } });
  } catch (error) {
    const current = await get("SELECT attempt_count FROM ai_proof_jobs WHERE id = ?", [job.id]);
    const retryable = Number(current?.attempt_count || 0) <= settings.retry_limit;
    await run("UPDATE ai_proof_jobs SET status = ?, manual_requested = 0, last_error = ?, completed_at = ?, updated_at = ? WHERE id = ?", [retryable ? "ai_failed" : "needs_attention", cleanText(error.message || "AI analysis failed.", 300), new Date().toISOString(), new Date().toISOString(), job.id]);
    await run("UPDATE ai_proof_attempts SET status = 'failed', last_error = ?, completed_at = ? WHERE job_id = ? AND attempt_number = ?", [cleanText(error.message || "AI analysis failed.", 300), new Date().toISOString(), job.id, attemptNumber]);
  }
}

function parseImportRowIds(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values
    .map((item) => Number.parseInt(item, 10))
    .filter((id) => Number.isInteger(id) && id > 0))];
}

const SOURCE_TEXT_MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

function isoDateFromMonthDay(monthText, dayText, year) {
  const month = SOURCE_TEXT_MONTHS[String(monthText || "").toLowerCase()];
  const day = Number.parseInt(dayText, 10);

  if (!month || !Number.isInteger(day) || day < 1 || day > 31) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sourceTextDateYear() {
  return Number.parseInt(process.env.SOURCE_TEXT_PARSE_YEAR, 10) || new Date().getFullYear();
}

function parseSourceTextForImport(sourceText) {
  const text = cleanText(sourceText, 2000);

  if (!text) {
    return {
      ok: false,
      error: "Source text could not be parsed. Add rows manually."
    };
  }

  const priceMatch = text.match(/\$(\d+(?:\.\d{1,2})?)/);
  const price = priceMatch ? Number(priceMatch[1]) : null;
  let itemName = "";
  const afterPrice = priceMatch ? text.slice(priceMatch.index + priceMatch[0].length).trim() : "";
  const itemAfterPrice = afterPrice.match(/^([^.!?]+?)(?=\.\s|!\s|\?\s|$)/);

  if (itemAfterPrice) {
    itemName = cleanText(itemAfterPrice[1].replace(/\bon sale\b.*$/i, ""), 120);
  }

  if (!itemName && priceMatch) {
    const beforePrice = text.slice(0, priceMatch.index).trim();
    const beforeParts = beforePrice.split(/[.!?]/).map((part) => part.trim()).filter(Boolean);
    itemName = cleanText(beforeParts[beforeParts.length - 1] || "", 120);
  }

  const sizeMatch = text.match(/\((\d+(?:\.\d+)?)\s*(fl oz|gallon|count|each|pack|roll|bottle|can|bag|ct|oz|lb)s?\)/i);
  const quantity = sizeMatch ? Number(sizeMatch[1]) : null;
  const unit = sizeMatch ? sizeMatch[2].toLowerCase() : "";
  const sizeText = sizeMatch ? `${sizeMatch[1]} ${unit}` : "";
  const limitMatch = text.match(/\blimit\s+([0-9]+)\b/i);
  const dateMatch = text.match(/(?:mon|tue|wed|thu|fri|sat|sun)?\.?\s*([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(?:mon|tue|wed|thu|fri|sat|sun)?\.?\s*([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i);
  let validStartAt = "";
  let validEndAt = "";

  if (dateMatch) {
    const year = sourceTextDateYear();
    validStartAt = isoDateFromMonthDay(dateMatch[1], dateMatch[2], year);
    validEndAt = isoDateFromMonthDay(dateMatch[3], dateMatch[4], year);

    if (validStartAt && validEndAt && validEndAt < validStartAt) {
      validEndAt = isoDateFromMonthDay(dateMatch[3], dateMatch[4], year + 1);
    }
  }

  const hasPrice = Number.isFinite(price);
  const hasItem = Boolean(itemName);
  const hasSize = Boolean(sizeText);
  const extractionConfidence = hasPrice && hasItem && hasSize
    ? "high"
    : hasPrice && hasItem
      ? "medium"
      : "low";

  if (!hasPrice && !hasItem) {
    return {
      ok: false,
      error: "Source text could not be parsed. Add rows manually."
    };
  }

  const notes = [
    "Parsed from pasted source text. Admin review required.",
    limitMatch ? `Limit ${limitMatch[1]}.` : "",
    validStartAt || validEndAt ? `Parsed valid dates ${validStartAt || "unknown"} to ${validEndAt || "unknown"}.` : ""
  ].filter(Boolean).join(" ");

  return {
    ok: true,
    draft: {
      item_name: itemName,
      price: hasPrice ? String(price.toFixed(2)) : "",
      size_text: sizeText,
      quantity: quantity || "",
      unit: unit || "",
      deal_limit: limitMatch ? limitMatch[1] : "",
      valid_start_at: validStartAt,
      valid_end_at: validEndAt,
      sale_price: hasPrice,
      extraction_confidence: extractionConfidence,
      extraction_notes: extractionConfidence === "high"
        ? "High: price, item, and size detected from pasted source text."
        : extractionConfidence === "medium"
          ? "Medium: price and item detected, but size may need review."
          : "Low: parsed text needs manual review.",
      notes
    }
  };
}

const RECEIPT_SKIP_LINE_PATTERN = /\b(sub\s*total|subtotal|tax|total|total number of items sold|balance|cash|credit|debit|change|penny rounding|rounding|rewards?|authorization|auth|approved|visa|mastercard|amex|discover|card|acct|account|phone|tel|cashier|checker|thank you|member|loyalty|payment|tender|amount due|ebt|snap|wic|barcode|return policy|policy|feedback|survey|questions?|www\.|\.com|terminal|network|approval code|tc#)\b/i;
const RECEIPT_TOTAL_PATTERN = /^\s*(?:grand\s+)?total\b/i;

function parseReceiptMoney(value) {
  const text = cleanText(value, 40).replace(/[$,]/g, "");
  const number = Number.parseFloat(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeReceiptText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanReceiptSourceText(value, maxLength = 8000) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength);
}

function normalizeReceiptLineForParsing(line) {
  return cleanText(line, 500)
    .replace(/(\d)[°º]\s*(\d{2})\b/g, "$1.$2")
    .replace(/(\d)\.\s+(\d{2,3})\b/g, "$1.$2")
    .replace(/(\d),(\d{2})\b/g, "$1.$2")
    .replace(/(\d)\s*-\s*(\d{2})\b/g, "$1.$2")
    .replace(/\b(\d+\.\d{2})\d+\b/g, "$1");
}

function hasReceiptItemNameText(value) {
  return (String(value || "").match(/[a-z]/gi) || []).length >= 2;
}

function receiptSkipReason(line) {
  const text = normalizeReceiptLineForParsing(line);

  if (!text) return "blank";
  if (RECEIPT_SKIP_LINE_PATTERN.test(text)) return "receipt total, payment, tax, or footer line";
  if (/^\d{8,}$/.test(text.replace(/\s/g, ""))) return "barcode or transaction number";
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(text)) return "receipt date or transaction footer";
  if (!/-?\$?\d+(?:\.\d{2})\b/.test(text)) return "no price detected";
  return "line did not match supported receipt item format";
}

function compactSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReceiptDate(month, day, year) {
  const parsedMonth = Number.parseInt(month, 10);
  const parsedDay = Number.parseInt(day, 10);
  let parsedYear = Number.parseInt(year, 10);

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12 || !Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
    return "";
  }

  if (!Number.isInteger(parsedYear)) {
    parsedYear = new Date().getFullYear();
  } else if (parsedYear < 100) {
    parsedYear += parsedYear >= 70 ? 1900 : 2000;
  }

  return `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
}

function parseReceiptMetadata(lines, stores = []) {
  const fullText = lines.join("\n");
  const lowerText = compactSearchText(fullText);
  const metadata = {
    receipt_store_name: "",
    receipt_store_address: "",
    receipt_purchase_date: "",
    receipt_purchase_time: "",
    receipt_total: null,
    receipt_transaction_id: "",
    matched_store_id: null,
    needs_store_review: true
  };
  const dateMatch = fullText.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  const isoDateMatch = fullText.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  const timeMatch = fullText.match(/\b(\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM)?)\b/i);
  const totalLine = lines.find((line) =>
    RECEIPT_TOTAL_PATTERN.test(line) &&
    !/\b(subtotal|tax|total number of items sold)\b/i.test(line)
  );
  const transactionLine = lines.find((line) => /\b(trans(?:action)?|trx|tc#|receipt|order)\b/i.test(line));

  if (dateMatch) {
    metadata.receipt_purchase_date = normalizeReceiptDate(dateMatch[1], dateMatch[2], dateMatch[3]);
  } else if (isoDateMatch) {
    metadata.receipt_purchase_date = normalizeReceiptDate(isoDateMatch[2], isoDateMatch[3], isoDateMatch[1]);
  }

  if (timeMatch) {
    metadata.receipt_purchase_time = cleanText(timeMatch[1], 20);
  }

  if (totalLine) {
    const totalMatch = totalLine.match(/(-?\$?\d+(?:\.\d{2})?)\s*$/);
    metadata.receipt_total = totalMatch ? parseReceiptMoney(totalMatch[1]) : null;
  }

  if (transactionLine) {
    const transactionMatch = transactionLine.match(/(?:trans(?:action)?|trx|tc#|receipt|order)[\s#:.-]*([a-z0-9-]{4,40})/i);
    metadata.receipt_transaction_id = transactionMatch ? cleanText(transactionMatch[1], 80) : "";
  }

  const storeAliases = [
    ["walmart", "walmart janesville"],
    ["aldi", "aldi janesville"],
    ["festival foods", "festival foods janesville"],
    ["hy vee", "hy-vee janesville"],
    ["hy-vee", "hy-vee janesville"],
    ["kwik trip", "kwik trip / stop-n-go janesville"],
    ["kwik star", "kwik trip / stop-n-go janesville"],
    ["stop n go", "kwik trip / stop-n-go janesville"],
    ["stop-n-go", "kwik trip / stop-n-go janesville"],
    ["woodman", "woodman’s janesville"],
    ["woodmans", "woodman’s janesville"],
    ["daniels", "daniels foods sentry"],
    ["sentry", "daniels foods sentry"],
    ["pick n save", "pick ’n save"],
    ["pick n' save", "pick ’n save"],
    ["target", "target"],
    ["walgreens", "walgreens"],
    ["cvs", "cvs"],
    ["santa maria", "santa maria mexican food mart"]
  ];
  let bestStore = null;
  let bestScore = 0;

  for (const store of stores) {
    const storeName = compactSearchText(store.name);
    const address = compactSearchText(store.address);
    let score = 0;

    if (storeName && lowerText.includes(storeName)) {
      score += 8;
    }

    for (const [alias, target] of storeAliases) {
      if (lowerText.includes(compactSearchText(alias)) && storeName.includes(compactSearchText(target).split(" ")[0])) {
        score += 5;
      }
    }

    if (address && lowerText.includes(address.split(" ").slice(0, 2).join(" "))) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestStore = store;
    }
  }

  if (bestStore && bestScore >= 5) {
    metadata.matched_store_id = bestStore.id;
    metadata.receipt_store_name = bestStore.name;
    metadata.receipt_store_address = bestStore.address || "";
    metadata.needs_store_review = false;
  } else {
    const possibleStore = lines.find((line) => /walmart|aldi|festival|hy-?vee|kwik|woodman|daniels|sentry|pick|target|walgreens|cvs|santa maria/i.test(line));
    metadata.receipt_store_name = cleanText(possibleStore || "", 120);
  }

  return metadata;
}

function guessReceiptCategory(itemName) {
  const text = compactSearchText(itemName);

  if (/\b(beef|chicken|pork|turkey|sausage|bacon|ham|steak|meat)\b/.test(text)) return "meat";
  if (/\b(milk|cheese|yogurt|butter|cream|egg|eggs)\b/.test(text)) return "dairy";
  if (/\b(banana|apple|orange|lettuce|tomato|pepper|onion|potato|produce|avocado|berry|berries)\b/.test(text)) return "produce";
  if (/\b(frozen|ice cream|pizza)\b/.test(text)) return "frozen";
  if (/\b(detergent|paper|towel|toilet|cleaner|soap|trash|household)\b/.test(text)) return "household";
  if (/\b(diaper|baby|formula)\b/.test(text)) return "baby";
  if (/\b(shampoo|toothpaste|deodorant|bath|bathroom)\b/.test(text)) return "personal care";
  if (/\b(bread|bun|bagel|bakery)\b/.test(text)) return "bakery";
  if (/\b(chips|snack|cookie|cracker|candy)\b/.test(text)) return "snacks";
  if (/\b(soda|water|juice|coffee|tea|drink)\b/.test(text)) return "drinks";
  return "other";
}

function cleanReceiptItemName(value) {
  return cleanText(
    String(value || "")
      .replace(/\b(FS|F|T|N|X)\b$/i, "")
      .replace(/\b(save|discount|coupon)\b.*$/i, "")
      .replace(/^[#*:;|\\/\-.[\] ]+/, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
    120
  );
}

function normalizeReceiptSizeUnit(unit) {
  const text = cleanText(unit, 12).toLowerCase().replace(/\./g, "");

  if (text === "z" || text === "oz" || text === "ounce" || text === "ounces") return "oz";
  if (text === "c" || text === "ct" || text === "count" || text === "counts") return "ct";
  if (text === "lb" || text === "lbs" || text === "pound" || text === "pounds") return "lb";
  if (text === "fl oz" || text === "floz" || text === "fo") return "fl oz";
  if (text === "pk" || text === "pack") return "pack";
  if (text === "roll" || text === "rolls") return "roll";
  return text;
}

function extractReceiptPackageSize(value) {
  const original = cleanText(value, 160);
  const sizePattern = /\b(\d+(?:\.\d+)?)\s*(FL\s*OZ|FLOZ|OZ|Z|LB|LBS|CT|C|COUNT|PK|PACK|ROLLS?|CAN|BOTTLE|BAG)\b/i;
  const match = original.match(sizePattern);

  if (!match) {
    return {
      item_name: cleanReceiptItemName(original),
      size_text: "",
      size_quantity: null,
      size_unit: ""
    };
  }

  const quantity = Number.parseFloat(match[1]);
  const unit = normalizeReceiptSizeUnit(match[2].replace(/\s+/g, " "));
  const sizeText = Number.isFinite(quantity) && unit ? `${quantity} ${unit}` : "";
  const itemName = cleanReceiptItemName(
    `${original.slice(0, match.index)} ${original.slice(match.index + match[0].length)}`
  );

  return {
    item_name: itemName,
    size_text: sizeText,
    size_quantity: Number.isFinite(quantity) ? quantity : null,
    size_unit: unit
  };
}

function parseReceiptItemLine(line) {
  const rawText = cleanText(line, 500);
  const text = normalizeReceiptLineForParsing(rawText);

  if (!text || RECEIPT_SKIP_LINE_PATTERN.test(text) || /^\d{3,}$/.test(text.replace(/\s/g, ""))) {
    return null;
  }

  const leadingQuantityMatch = text.match(/^(\d+(?:\.\d+)?)\s*@\s*\$?(\d+(?:\.\d{2})?)\s+(.+?)\s+(-?\$?\d+(?:\.\d{2}))\s*[A-Z]?$/i);

  if (leadingQuantityMatch) {
    const purchasedQuantity = Number.parseFloat(leadingQuantityMatch[1]);
    const eachPrice = parseReceiptMoney(leadingQuantityMatch[2]);
    const totalPrice = parseReceiptMoney(leadingQuantityMatch[4]);
    const sized = extractReceiptPackageSize(leadingQuantityMatch[3]);

    if (
      sized.item_name &&
      hasReceiptItemNameText(sized.item_name) &&
      eachPrice !== null &&
      totalPrice !== null &&
      Number.isFinite(purchasedQuantity)
    ) {
      return {
        raw_receipt_line: rawText,
        item_name: sized.item_name,
        price: eachPrice,
        quantity: 1,
        unit: "each",
        size_text: sized.size_text || "",
        extracted_quantity: purchasedQuantity,
        extracted_unit: "each",
        confidence: "high",
        notes: [
          `Receipt line total $${Number(totalPrice).toFixed(2)} for ${purchasedQuantity} items at $${Number(eachPrice).toFixed(2)} each.`,
          sized.size_text ? `Package size detected: ${sized.size_text}.` : ""
        ].filter(Boolean).join(" ")
      };
    }
  }

  const weightedMatch = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(LB|LBS|OZ)\s*@\s*\$?(\d+(?:\.\d{2})?)\s+(-?\$?\d+(?:\.\d{2})?)\s*[A-Z]?$/i);

  if (weightedMatch) {
    const itemName = cleanReceiptItemName(weightedMatch[1]);
    const weight = Number.parseFloat(weightedMatch[2]);
    const unit = weightedMatch[3].toLowerCase().replace("lbs", "lb");
    const price = parseReceiptMoney(weightedMatch[5]);

    if (itemName && hasReceiptItemNameText(itemName) && price !== null) {
      return {
        raw_receipt_line: rawText,
        item_name: itemName,
        price,
        quantity: weight,
        unit,
        size_text: `${weight} ${unit}`,
        extracted_weight: weight,
        extracted_unit: unit,
        confidence: "high",
        notes: `Weighted receipt item parsed at ${weightedMatch[2]} ${unit} @ $${Number(weightedMatch[4]).toFixed(2)}.`
      };
    }
  }

  const quantityMatch = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*@\s*\$?(\d+(?:\.\d{2})?)\s+(-?\$?\d+(?:\.\d{2})?)\s*[A-Z]?$/i);

  if (quantityMatch) {
    const sized = extractReceiptPackageSize(quantityMatch[1]);
    const quantity = Number.parseFloat(quantityMatch[2]);
    const eachPrice = parseReceiptMoney(quantityMatch[3]);
    const totalPrice = parseReceiptMoney(quantityMatch[4]);

    if (sized.item_name && hasReceiptItemNameText(sized.item_name) && eachPrice !== null && totalPrice !== null) {
      return {
        raw_receipt_line: rawText,
        item_name: sized.item_name,
        price: eachPrice,
        quantity: 1,
        unit: "each",
        size_text: sized.size_text || "",
        extracted_quantity: quantity,
        extracted_unit: "each",
        confidence: "high",
        notes: [
          `Receipt line total $${Number(totalPrice).toFixed(2)} for ${quantity} items at $${Number(eachPrice).toFixed(2)} each.`,
          sized.size_text ? `Package size detected: ${sized.size_text}.` : ""
        ].filter(Boolean).join(" ")
      };
    }
  }

  const lineMatch = text.match(/^(.+?)\s+(-?\$?\d+(?:\.\d{2}))\s*[A-Z]?$/);

  if (!lineMatch) {
    return null;
  }

  const sized = extractReceiptPackageSize(lineMatch[1]);
  const itemName = sized.item_name;
  const price = parseReceiptMoney(lineMatch[2]);

  if (!itemName || !hasReceiptItemNameText(itemName) || price === null || price <= 0 || itemName.length < 2 || RECEIPT_SKIP_LINE_PATTERN.test(itemName)) {
    return null;
  }

  return {
    raw_receipt_line: rawText,
    item_name: itemName,
    price,
    quantity: 1,
    unit: "each",
    size_text: sized.size_text || "",
    extracted_quantity: "",
    extracted_unit: "",
    confidence: sized.size_text ? "high" : "medium",
    notes: [
      "Receipt line parsed from item name with price at end.",
      sized.size_text ? `Package size detected: ${sized.size_text}.` : ""
    ].filter(Boolean).join(" ")
  };
}

function parseReceiptTextForImport(receiptText, stores = []) {
  const lines = normalizeReceiptText(receiptText);

  if (!lines.length) {
    return {
      ok: false,
      error: "Receipt text could not be parsed. Paste receipt text or add rows manually."
    };
  }

  const metadata = parseReceiptMetadata(lines, stores);
  const rows = [];
  const skippedLines = [];
  const seen = new Set();

  for (const line of lines) {
    const item = parseReceiptItemLine(line);

    if (!item) {
      skippedLines.push({
        line,
        reason: receiptSkipReason(line)
      });
      continue;
    }

    const key = `${compactSearchText(item.item_name)}|${item.price.toFixed(2)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    const confidence = metadata.matched_store_id
      ? item.confidence
      : item.confidence === "high" ? "medium" : "low";

    rows.push({
      product_id: "",
      store_id: metadata.matched_store_id || "",
      item_name: item.item_name,
      brand: "",
      category: guessReceiptCategory(item.item_name),
      price: item.price.toFixed(2),
      regular_price: "",
      sale_price: false,
      coupon_required: false,
      deal_limit: "",
      size_text: item.size_text || "",
      quantity: item.quantity || 1,
      unit: item.unit || "each",
      proof_type: "receipt_photo",
      valid_start_at: "",
      valid_end_at: "",
      source_url: "",
      source_title: "Receipt",
      source_checked_at: metadata.receipt_purchase_date || "",
      raw_receipt_line: item.raw_receipt_line,
      extracted_item_name: item.item_name,
      extracted_price: item.price.toFixed(2),
      extracted_quantity: item.extracted_quantity || item.quantity || "",
      extracted_weight: item.extracted_weight || "",
      extracted_unit: item.extracted_unit || item.unit || "",
      extraction_confidence: confidence,
      extraction_notes: confidence === "high"
        ? "High: receipt item, price, and store detected."
        : confidence === "medium"
          ? "Medium: item and price detected; review store, size, or receipt context."
          : "Low: item and price need careful admin review.",
      notes: [item.notes, "Parsed from receipt text. Admin review required."].filter(Boolean).join(" "),
      status: metadata.matched_store_id ? "ready_for_review" : "needs_edit"
    });
  }

  if (!rows.length) {
    return {
      ok: false,
      error: "No receipt item rows were detected. Totals, tax, and payment lines were ignored.",
      metadata,
      ignored_line_count: skippedLines.length,
      skipped_lines: skippedLines
    };
  }

  return {
    ok: true,
    metadata,
    rows,
    ignored_line_count: skippedLines.length,
    skipped_lines: skippedLines
  };
}

function receiptCropRegion(metadata) {
  const width = Number(metadata.width);
  const height = Number(metadata.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 100 || height < 100) {
    return null;
  }

  const portrait = height >= width;
  const leftRatio = portrait ? 0.16 : 0.22;
  const widthRatio = portrait ? 0.72 : 0.58;
  const topRatio = 0.01;
  const heightRatio = 0.98;
  const left = Math.max(0, Math.round(width * leftRatio));
  const top = Math.max(0, Math.round(height * topRatio));
  const cropWidth = Math.min(width - left, Math.round(width * widthRatio));
  const cropHeight = Math.min(height - top, Math.round(height * heightRatio));

  if (cropWidth < 100 || cropHeight < 100) {
    return null;
  }

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight
  };
}

function receiptItemsCropRegion(metadata) {
  const width = Number(metadata.width);
  const height = Number(metadata.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 100 || height < 100) {
    return null;
  }

  const portrait = height >= width;
  const leftRatio = portrait ? 0.28 : 0.28;
  const topRatio = portrait ? 0.29 : 0.30;
  const widthRatio = portrait ? 0.46 : 0.46;
  const heightRatio = portrait ? 0.27 : 0.32;
  const left = Math.max(0, Math.round(width * leftRatio));
  const top = Math.max(0, Math.round(height * topRatio));
  const cropWidth = Math.min(width - left, Math.round(width * widthRatio));
  const cropHeight = Math.min(height - top, Math.round(height * heightRatio));

  if (cropWidth < 100 || cropHeight < 100) {
    return null;
  }

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight
  };
}

async function writeReceiptOcrVariant(inputPath, label, configurePipeline) {
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${label}.png`;
  const outputPath = path.join(OCR_TEMP_DIR, filename);
  let pipeline = sharp(inputPath, { limitInputPixels: false }).rotate();
  pipeline = configurePipeline(pipeline);
  await pipeline.png({ compressionLevel: 6 }).toFile(outputPath);

  return {
    label,
    path: outputPath,
    cleanup: true
  };
}

async function buildReceiptOcrVariants(inputPath) {
  const variants = [{ label: "original", path: inputPath, cleanup: false }];

  if (!sharp) {
    return variants;
  }

  try {
    const metadata = await sharp(inputPath, { limitInputPixels: false }).metadata();
    const swapsOrientation = [5, 6, 7, 8].includes(Number(metadata.orientation));
    const orientedMetadata = {
      ...metadata,
      width: swapsOrientation ? metadata.height : metadata.width,
      height: swapsOrientation ? metadata.width : metadata.height
    };
    const crop = receiptCropRegion(orientedMetadata || {});
    const itemsCrop = receiptItemsCropRegion(orientedMetadata || {});
    const baseResize = { width: 1900, withoutEnlargement: false };
    const croppedResize = { width: 1700, withoutEnlargement: false };
    const itemsResize = { width: 2200, withoutEnlargement: false };

    variants.push(await writeReceiptOcrVariant(inputPath, "full-contrast", (pipeline) =>
      pipeline
        .resize(baseResize)
        .grayscale()
        .normalize()
        .linear(1.28, -18)
        .sharpen({ sigma: 1.2, m1: 1.4, m2: 0.7 })
    ));

    if (crop) {
      variants.push(await writeReceiptOcrVariant(inputPath, "receipt-crop-contrast", (pipeline) =>
        pipeline
          .extract(crop)
          .resize(croppedResize)
          .grayscale()
          .normalize()
          .linear(1.35, -24)
          .sharpen({ sigma: 1.1, m1: 1.5, m2: 0.8 })
      ));

      variants.push(await writeReceiptOcrVariant(inputPath, "receipt-crop-threshold", (pipeline) =>
        pipeline
          .extract(crop)
          .resize(croppedResize)
          .grayscale()
          .normalize()
          .linear(1.45, -30)
          .threshold(162)
          .sharpen()
      ));

      variants.push(await writeReceiptOcrVariant(inputPath, "receipt-crop-tilt", (pipeline) =>
        pipeline
          .extract(crop)
          .rotate(-1.4, { background: "#ffffff" })
          .resize(croppedResize)
          .grayscale()
          .normalize()
          .linear(1.32, -18)
          .sharpen({ sigma: 1.1, m1: 1.4, m2: 0.8 })
      ));
    }

    if (itemsCrop) {
      variants.push(await writeReceiptOcrVariant(inputPath, "receipt-items-contrast", (pipeline) =>
        pipeline
          .extract(itemsCrop)
          .resize(itemsResize)
          .grayscale()
          .normalize()
          .linear(1.42, -24)
          .sharpen({ sigma: 1.1, m1: 1.6, m2: 0.85 })
      ));
    }
  } catch (error) {
    return variants;
  }

  return variants;
}

function receiptOcrScore(text, confidence) {
  const clean = cleanReceiptSourceText(text, 8000);
  const lines = normalizeReceiptText(clean);
  const moneyLines = lines.filter((line) => /\b\d+\.\d{2}\b/.test(line)).length;
  const receiptSignals = [
    /woodman/i,
    /market/i,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
    /\b(items?|purchased|balance|tax|cash|change)\b/i,
    /@\s*\d+\.\d{2}/
  ].reduce((score, pattern) => score + (pattern.test(clean) ? 10 : 0), 0);
  const confidenceScore = Number.isFinite(confidence) ? confidence : 0;

  return receiptSignals + (moneyLines * 8) + Math.min(lines.length, 30) + Math.min(clean.length / 40, 35) + confidenceScore;
}

async function recognizeReceiptVariant(worker, variant) {
  const result = await worker.recognize(variant.path);
  const text = cleanReceiptSourceText(result?.data?.text || "", 8000);
  const confidenceNumber = Number(result?.data?.confidence);

  return {
    variant: variant.label,
    text,
    confidence_number: Number.isFinite(confidenceNumber) ? confidenceNumber : null,
    score: receiptOcrScore(text, confidenceNumber)
  };
}

async function cleanupReceiptOcrVariants(variants) {
  await Promise.all(
    variants
      .filter((variant) => variant.cleanup)
      .map((variant) => fs.promises.unlink(variant.path).catch(() => {}))
  );
}

async function runReceiptOcr(batch) {
  if (!tesseract) {
    return {
      status: "unavailable",
      text: "",
      confidence: "",
      message: "Local OCR is not available. Paste receipt text below."
    };
  }

  const fullPath = uploadPathFromPhotoPath(batch.photo_path);

  if (!fullPath) {
    return {
      status: "failed",
      text: "",
      confidence: "",
      message: "Receipt image file was not found for OCR."
    };
  }

  let worker = null;
  let variants = [{ label: "original", path: fullPath, cleanup: false }];

  try {
    variants = await buildReceiptOcrVariants(fullPath);
    worker = await tesseract.createWorker("eng", 1, {
      errorHandler() {
        // Tesseract can emit worker errors outside the recognition promise.
        // Swallow here so unreadable images fall back to manual text entry.
      }
    });

    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1"
    }).catch(() => {});

    const attempts = [];

    for (const variant of variants) {
      try {
        attempts.push(await recognizeReceiptVariant(worker, variant));
      } catch (error) {
        attempts.push({
          variant: variant.label,
          text: "",
          confidence_number: null,
          score: 0,
          error: cleanText(error.message || "OCR failed for variant.", 160)
        });
      }
    }

    const best = attempts.sort((left, right) => right.score - left.score)[0] || {
      variant: "original",
      text: "",
      confidence_number: null,
      score: 0
    };
    const text = best.text;
    const confidenceNumber = Number(best.confidence_number);
    const confidence = Number.isFinite(confidenceNumber)
      ? confidenceNumber >= 75 ? "high" : confidenceNumber >= 45 ? "medium" : "low"
      : "low";
    const attemptSummary = attempts
      .map((attempt) => `${attempt.variant}: ${attempt.text ? `${normalizeReceiptText(attempt.text).length} lines` : "no text"}${Number.isFinite(attempt.confidence_number) ? `, ${Math.round(attempt.confidence_number)}%` : ""}`)
      .join("; ");

    if (!text) {
      return {
        status: "failed",
        text: "",
        confidence: "low",
        message: "Receipt saved as proof. Enter the item and price manually.",
        debug: attemptSummary
      };
    }

    return {
      status: "parsed",
      text,
      confidence,
      message: `OCR text extracted from ${best.variant}. Review parsed rows before approval.`,
      debug: attemptSummary
    };
  } catch (error) {
    return {
      status: "failed",
      text: "",
      confidence: "low",
      message: "Receipt saved as proof. Enter the item and price manually.",
      debug: cleanText(error.message || "", 300)
    };
  } finally {
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    await cleanupReceiptOcrVariants(variants);
  }
}

async function firstEditableImportRowForBatch(batchId) {
  return get(
    `
      SELECT *
      FROM price_import_rows
      WHERE batch_id = ?
        AND status NOT IN ('approved', 'removed')
      ORDER BY id ASC
      LIMIT 1
    `,
    [batchId]
  );
}

async function duplicateImportRowForDraft(batchId, draft, excludeRowId = null) {
  const params = [
    batchId,
    cleanText(draft.item_name, 120).toLowerCase(),
    draft.price,
    draft.proof_type || ""
  ];
  let storeClause = "";
  let excludeClause = "";

  if (draft.store_id) {
    storeClause = "AND COALESCE(store_id, 0) = ?";
    params.push(draft.store_id);
  }

  if (excludeRowId) {
    excludeClause = "AND id != ?";
    params.push(excludeRowId);
  }

  return get(
    `
      SELECT *
      FROM price_import_rows
      WHERE batch_id = ?
        AND LOWER(TRIM(item_name)) = ?
        AND price = ?
        AND proof_type = ?
        AND status NOT IN ('rejected', 'removed')
        ${storeClause}
        ${excludeClause}
      ORDER BY id ASC
      LIMIT 1
    `,
    params
  );
}

async function approvedEquivalentReportForDraft(draft, options = {}) {
  if (!draft?.store_id || draft.price === null || draft.price === undefined) {
    return null;
  }

  const filters = [
    "pr.status = 'approved'",
    "pr.store_id = ?",
    "ABS(pr.price - ?) < 0.005"
  ];
  const params = [draft.store_id, draft.price];
  const productId = Number.parseInt(draft.product_id || options.productId, 10);
  const itemName = cleanText(draft.item_name, 120).toLowerCase();
  const sizeText = cleanText(draft.size_text, 80).toLowerCase();

  if (Number.isInteger(productId) && productId > 0) {
    filters.push("(pr.product_id = ? OR LOWER(TRIM(pr.item_name)) = ?)");
    params.push(productId, itemName);
  } else if (itemName) {
    filters.push("LOWER(TRIM(pr.item_name)) = ?");
    params.push(itemName);
  }

  if (sizeText) {
    filters.push("LOWER(TRIM(COALESCE(pr.size_text, ''))) = ?");
    params.push(sizeText);
  }

  if (options.excludeReportId) {
    filters.push("pr.id != ?");
    params.push(options.excludeReportId);
  }

  return get(
    `
      ${reportSelectWithProduct()}
      WHERE ${filters.join(" AND ")}
      ORDER BY pr.reviewed_at DESC, pr.id DESC
      LIMIT 1
    `,
    params
  );
}

async function duplicateWarningForDraft(draft, options = {}) {
  const approved = await approvedEquivalentReportForDraft(draft, options);

  if (approved) {
    return `Likely duplicate of approved report #${approved.id} (${approved.store_name}, $${Number(approved.price).toFixed(2)}).`;
  }

  if (draft.valid_end_at) {
    const validEnd = new Date(draft.valid_end_at);

    if (!Number.isNaN(validEnd.getTime()) && validEnd < new Date()) {
      return "Sale date appears expired. Confirm before approval.";
    }
  }

  return "";
}

async function productsForImportMatching() {
  return all(
    `
      SELECT id, display_name, canonical_name, category, default_size_text, default_unit, preferred_brand, common_aliases, status
      FROM products
      WHERE status IN ('active', 'needs_review')
      ORDER BY status ASC, display_name ASC
      LIMIT 500
    `
  );
}

function productMatchScoreForRow(row, product) {
  const itemName = compactIntakeSearchText(row.item_name || row.extracted_item_name);
  const displayName = compactIntakeSearchText(product.display_name);
  const canonicalName = compactIntakeSearchText(product.canonical_name);
  const aliases = String(product.common_aliases || "")
    .split(/[,;\n]/)
    .map(compactIntakeSearchText)
    .filter(Boolean);
  let score = 0;

  if (!itemName) {
    return 0;
  }

  if (itemName === displayName || itemName === canonicalName || aliases.includes(itemName)) {
    score += 100;
  } else if (displayName && (itemName.includes(displayName) || displayName.includes(itemName))) {
    score += 65;
  } else if (canonicalName && (itemName.includes(canonicalName) || canonicalName.includes(itemName))) {
    score += 60;
  } else {
    const itemWords = new Set(itemName.split(" ").filter((word) => word.length > 2));
    const productWords = new Set([displayName, canonicalName, ...aliases].join(" ").split(" ").filter((word) => word.length > 2));
    const overlap = [...itemWords].filter((word) => productWords.has(word)).length;

    score += overlap * 16;
  }

  if (row.category && product.category && row.category === product.category) {
    score += 10;
  }

  if (row.size_text && product.default_size_text && compactIntakeSearchText(row.size_text) === compactIntakeSearchText(product.default_size_text)) {
    score += 10;
  }

  if (row.unit && product.default_unit && row.unit === product.default_unit) {
    score += 5;
  }

  if (row.brand && product.preferred_brand && compactIntakeSearchText(row.brand) === compactIntakeSearchText(product.preferred_brand)) {
    score += 8;
  }

  if (product.status === "active") {
    score += 3;
  }

  return score;
}

async function addReviewHintsToImportRows(rows) {
  if (!rows.length) {
    return rows;
  }

  const products = await productsForImportMatching();

  return rows.map((row) => {
    const matches = products
      .map((product) => ({
        id: product.id,
        display_name: product.display_name,
        category: product.category,
        default_size_text: product.default_size_text || "",
        status: product.status,
        score: productMatchScoreForRow(row, product)
      }))
      .filter((match) => match.score >= 45)
      .sort((left, right) => right.score - left.score)
      .slice(0, 4);

    return {
      ...row,
      product_matches: matches
    };
  });
}

async function insertPriceImportRowDraft(batchId, draft, adminUserId, now) {
  const result = await run(
    `
      INSERT INTO price_import_rows (
        batch_id,
        product_id,
        store_id,
        item_name,
        brand,
        variant,
        category,
        price,
        price_basis,
        comparison_price,
        comparison_unit,
        estimated_item_price,
        approximate_item_weight,
        approximate_item_weight_unit,
        package_price,
        regular_price,
        sale_price,
        member_card_price,
        coupon_required,
        deal_limit,
        multibuy_details,
        multibuy_quantity,
        multibuy_total_price,
        storage_condition,
        price_type,
        promotion_text,
        display_offer_text,
        promotion_conditions,
        promotion_schedule_text,
        valid_from_date,
        valid_through_date,
        valid_from_time,
        valid_through_time,
        size_text,
        quantity,
        unit,
        proof_type,
        observed_at,
        source_date,
        valid_start_at,
        valid_end_at,
        source_url,
        source_title,
        source_domain,
        source_checked_at,
        raw_receipt_line,
        extracted_item_name,
        extracted_price,
        extracted_quantity,
        extracted_weight,
        extracted_unit,
        extraction_confidence,
        extraction_notes,
        duplicate_warning,
        notes,
        status,
        created_by,
        created_at,
        updated_by,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      batchId,
      draft.product_id,
      draft.store_id,
      draft.item_name,
      draft.brand,
      draft.variant,
      draft.category,
      draft.price,
      draft.price_basis,
      draft.comparison_price,
      draft.comparison_unit,
      draft.estimated_item_price,
      draft.approximate_item_weight,
      draft.approximate_item_weight_unit,
      draft.package_price,
      draft.regular_price,
      draft.sale_price,
      draft.member_card_price,
      draft.coupon_required,
      draft.deal_limit,
      draft.multibuy_details,
      draft.multibuy_quantity,
      draft.multibuy_total_price,
      draft.storage_condition,
      draft.price_type,
      draft.promotion_text,
      draft.display_offer_text,
      draft.promotion_conditions,
      draft.promotion_schedule_text,
      draft.valid_from_date,
      draft.valid_through_date,
      draft.valid_from_time,
      draft.valid_through_time,
      draft.size_text,
      draft.quantity,
      draft.unit,
      draft.proof_type,
      draft.observed_at,
      draft.source_date,
      draft.valid_start_at,
      draft.valid_end_at,
      draft.source_url,
      draft.source_title,
      draft.source_domain,
      draft.source_checked_at,
      draft.raw_receipt_line,
      draft.extracted_item_name,
      draft.extracted_price,
      draft.extracted_quantity,
      draft.extracted_weight,
      draft.extracted_unit,
      draft.extraction_confidence,
      draft.extraction_notes,
      draft.duplicate_warning,
      draft.notes,
      draft.status,
      adminUserId,
      now,
      adminUserId,
      now
    ]
  );

  return result.lastID;
}

async function updateReceiptBatchMetadata(batchId, metadata, options = {}) {
  const now = options.now || new Date().toISOString();
  const status = options.status || (metadata.needs_store_review ? "needs_store_review" : "ready_for_review");

  await run(
    `
      UPDATE price_import_batches
      SET status = ?,
          receipt_store_name = ?,
          receipt_store_address = ?,
          receipt_purchase_date = ?,
          receipt_purchase_time = ?,
          receipt_total = ?,
          receipt_transaction_id = ?,
          receipt_ocr_text = COALESCE(NULLIF(?, ''), receipt_ocr_text),
          receipt_ocr_confidence = COALESCE(NULLIF(?, ''), receipt_ocr_confidence),
          source_checked_at = COALESCE(NULLIF(?, ''), source_checked_at),
          updated_at = ?
      WHERE id = ?
    `,
    [
      status,
      metadata.receipt_store_name || "",
      metadata.receipt_store_address || "",
      metadata.receipt_purchase_date || "",
      metadata.receipt_purchase_time || "",
      metadata.receipt_total,
      metadata.receipt_transaction_id || "",
      options.ocrText || "",
      options.ocrConfidence || "",
      metadata.receipt_purchase_date || "",
      now,
      batchId
    ]
  );
}

async function createReceiptDraftRows(batch, receiptText, adminUser, options = {}) {
  const stores = await all("SELECT id, name, address FROM stores WHERE active = 1");
  const parsed = parseReceiptTextForImport(receiptText, stores);

  if (!parsed.ok) {
    return parsed;
  }

  const now = new Date().toISOString();
  const createdRows = [];
  const skippedDuplicates = [];
  await updateReceiptBatchMetadata(batch.id, parsed.metadata, {
    now,
    ocrText: options.ocrText || receiptText,
    ocrConfidence: options.ocrConfidence || batch.receipt_ocr_confidence || ""
  });

  for (const parsedRow of parsed.rows) {
    const draft = cleanImportRowDraft({
      source_url: batch.source_url || "",
      source_title: batch.source_title || "Receipt",
      source_checked_at: parsedRow.source_checked_at || parsed.metadata.receipt_purchase_date || batch.source_checked_at || "",
      ...parsedRow
    });
    const duplicate = await duplicateImportRowForDraft(batch.id, draft);

    if (duplicate) {
      skippedDuplicates.push(duplicate.id);
      continue;
    }

    const rowId = await insertPriceImportRowDraft(batch.id, draft, adminUser ? adminUser.id : null, now);
    createdRows.push(await priceImportRowById(rowId));
  }

  return {
    ok: true,
    metadata: parsed.metadata,
    created_rows: createdRows,
    created_count: createdRows.length,
    skipped_duplicate_row_ids: skippedDuplicates,
    ignored_line_count: parsed.ignored_line_count,
    skipped_lines: parsed.skipped_lines || []
  };
}

async function createPriceTextDraftRows(batch, sourceText, adminUser, options = {}) {
  const defaults = {
    ...importBatchDefaultsForRow(batch, options),
    source_type: batch.source_type || options.source_type || "paste_text",
    year: Number.parseInt(process.env.SOURCE_TEXT_PARSE_YEAR, 10) || new Date().getFullYear()
  };
  const parsed = parsePriceText(sourceText, defaults);

  if (!parsed.ok) {
    return parsed;
  }

  const now = new Date().toISOString();
  const createdRows = [];
  const skippedDuplicates = [];
  const skippedLines = [...(parsed.skipped_lines || [])];

  await run(
    `
      UPDATE price_import_batches
      SET source_text = ?,
          source_url = COALESCE(NULLIF(?, ''), source_url),
          source_title = COALESCE(NULLIF(?, ''), source_title),
          source_domain = COALESCE(NULLIF(?, ''), source_domain),
          source_checked_at = COALESCE(NULLIF(?, ''), source_checked_at),
          default_store_id = COALESCE(?, default_store_id),
          observed_at = COALESCE(NULLIF(?, ''), observed_at),
          valid_start_at = COALESCE(NULLIF(?, ''), valid_start_at),
          valid_end_at = COALESCE(NULLIF(?, ''), valid_end_at),
          status = CASE WHEN status IN ('needs_admin_review', 'accepted_for_review') THEN status ELSE 'ready_for_review' END,
          updated_at = ?
      WHERE id = ?
    `,
    [
      cleanReceiptSourceText(sourceText, 12000),
      defaults.source_url,
      defaults.source_title,
      sourceDomainFromUrl(defaults.source_url),
      defaults.source_checked_at,
      defaults.store_id ? Number.parseInt(defaults.store_id, 10) : null,
      defaults.observed_at,
      defaults.valid_start_at,
      defaults.valid_end_at,
      now,
      batch.id
    ]
  );

  for (const parsedRow of parsed.rows) {
    const draft = cleanImportRowDraft({
      ...parsedRow,
      source_url: parsedRow.source_url || defaults.source_url || "",
      source_title: parsedRow.source_title || defaults.source_title || "",
      source_checked_at: parsedRow.source_checked_at || defaults.source_checked_at || "",
      observed_at: parsedRow.observed_at || defaults.observed_at || "",
      valid_start_at: parsedRow.valid_start_at || defaults.valid_start_at || "",
      valid_end_at: parsedRow.valid_end_at || defaults.valid_end_at || "",
      proof_type: parsedRow.proof_type || defaults.proof_type || batch.proof_type || "weekly_ad"
    });
    const duplicate = await duplicateImportRowForDraft(batch.id, draft);

    if (duplicate) {
      skippedDuplicates.push(duplicate.id);
      skippedLines.push({
        line: parsedRow.promotion_text || parsedRow.item_name,
        reason: `matching draft row already exists (#${duplicate.id})`
      });
      continue;
    }

    draft.duplicate_warning = await duplicateWarningForDraft(draft);
    const rowId = await insertPriceImportRowDraft(batch.id, draft, adminUser ? adminUser.id : null, now);
    createdRows.push(await priceImportRowById(rowId));
  }

  return {
    ok: true,
    created_rows: createdRows,
    created_count: createdRows.length,
    skipped_duplicate_row_ids: skippedDuplicates,
    ignored_line_count: skippedLines.length,
    skipped_lines: skippedLines
  };
}

function receiptLineFromApprovedReport(report) {
  const notes = String(report.notes || "");
  const match = notes.match(/Receipt line:\s*(.+)$/i);

  if (!match) {
    return "";
  }

  return cleanText(match[1].replace(/\.$/, ""), 240);
}

function receiptCleanupCandidate(report) {
  if (report.status !== "approved" || report.proof_type !== "receipt_photo") {
    return null;
  }

  const rawReceiptLine = receiptLineFromApprovedReport(report);
  const lineForParser = rawReceiptLine || report.item_name;
  const parsed = parseReceiptItemLine(lineForParser);
  const flags = [];

  if (/^\d+\s*@\s*\$?\d+(?:\.\d{2})?/i.test(report.item_name || "")) {
    flags.push("Item name appears to include receipt quantity pricing.");
  }

  if (rawReceiptLine && /^\d+\s*@\s*\$?\d+(?:\.\d{2})?/i.test(rawReceiptLine)) {
    flags.push("Receipt line uses quantity pricing; compare item price against line total.");
  }

  if (parsed) {
    const reportPrice = Number(report.price);

    if (Number.isFinite(reportPrice) && Math.abs(reportPrice - parsed.price) > 0.005) {
      flags.push(`Approved price is $${reportPrice.toFixed(2)}, but comparable item price looks like $${parsed.price.toFixed(2)}.`);
    }

    if (!cleanText(report.size_text, 80) && parsed.size_text) {
      flags.push(`Package size looks embedded in receipt text: ${parsed.size_text}.`);
    }

    if (compactSearchText(report.item_name) !== compactSearchText(parsed.item_name)) {
      flags.push(`Item name may need cleanup to "${parsed.item_name}".`);
    }
  }

  if (!flags.length) {
    return null;
  }

  return {
    report: formatReport(report),
    raw_receipt_line: rawReceiptLine,
    flags,
    suggested: parsed
      ? {
          item_name: parsed.item_name,
          price: parsed.price.toFixed(2),
          price_label: `$${parsed.price.toFixed(2)}`,
          size_text: parsed.size_text || "",
          quantity: parsed.quantity || 1,
          unit: parsed.unit || "each",
          notes: parsed.notes || ""
        }
      : null
  };
}

async function approvedReceiptCleanupReport() {
  const reports = await all(
    `
      ${reportSelectWithProduct()}
      WHERE pr.status = 'approved'
        AND pr.proof_type = 'receipt_photo'
      ORDER BY pr.reviewed_at DESC, pr.id DESC
      LIMIT 100
    `
  );
  const candidates = reports
    .map(receiptCleanupCandidate)
    .filter(Boolean);

  return {
    title: "Approved receipt cleanup report",
    message: candidates.length
      ? "Review these approved receipt rows before relying on them. They may use line totals or embedded package sizes from older receipt parsing."
      : "No older approved receipt rows look suspicious from the current cleanup rules.",
    count: candidates.length,
    candidates
  };
}

async function locationResolutionForImportRow(row, cleanReport) {
  const requiresVerification = cleanReport.proof_type === "store_page" || Boolean(String(row.source_url || "").trim());
  const store = await get("SELECT id, city, state FROM stores WHERE id = ? AND active = 1", [cleanReport.store_id]);
  if (!requiresVerification) return { status: "not_required", city: store?.city || "", state: store?.state || "", store_id: store?.id || null, evidence: "Physical/local proof with human-resolved store." };
  const [analysis, batch] = await Promise.all([
    get("SELECT resolved_store_id, store_resolution FROM ai_proof_analyses WHERE proof_id = ?", [row.batch_id]),
    get("SELECT location_verification_status, applicable_store_id, location_evidence_text FROM price_import_batches WHERE id = ?", [row.batch_id])
  ]);
  const isJanesville = store && String(store.city || "").trim().toLowerCase() === "janesville" && ["wi", "wisconsin"].includes(String(store.state || "").trim().toLowerCase());
  const verifiedByAiReview = Number(analysis?.resolved_store_id) === Number(cleanReport.store_id);
  const verifiedByManualImportReview = batch?.location_verification_status === "verified_exact_store" && Number(batch?.applicable_store_id) === Number(cleanReport.store_id);
  const verified = isJanesville && (verifiedByAiReview || verifiedByManualImportReview);
  return { status: verified ? "verified_exact_store" : "needs_review", city: verified ? store.city : "", state: verified ? store.state : "", store_id: verified ? store.id : null, evidence: verified ? (batch?.location_evidence_text || `Human store resolution: ${analysis?.store_resolution || "resolved exact store"}.`) : "Online source location was not established for the selected Janesville store." };
}

async function approvePriceImportRow(rowId, adminUser, options = {}) {
  if (!adminUser) {
    const error = new Error("Approving imported prices requires a logged-in admin account.");
    error.statusCode = 403;
    throw error;
  }

  const row = await priceImportRowById(rowId);

  if (!row) {
    const error = new Error("Import row was not found.");
    error.statusCode = 404;
    throw error;
  }

  if (row.status === "approved" && row.price_report_id) {
    const approvedReport = await get(`${reportSelectWithProduct()} WHERE pr.id = ?`, [row.price_report_id]);
    return {
      row,
      report_id: row.price_report_id,
      product_id: approvedReport?.product_id || row.product_id || null,
      approved_price: approvedReport?.price == null ? null : Number(approvedReport.price),
      approved_size: approvedReport?.size_text || "",
      store_id: approvedReport?.store_id || row.store_id || null,
      validity: approvedReport ? { valid_from_date: approvedReport.valid_from_date || null, valid_through_date: approvedReport.valid_through_date || null } : null,
      publication_state: approvedReport?.status || "approved",
      message: "Import row was already approved."
    };
  }

  if (options.expectedDraftUpdatedAt && String(row.updated_at || "") !== String(options.expectedDraftUpdatedAt)) {
    const error = new Error("This draft changed after the version shown in your browser. Review the latest saved values before approving.");
    error.statusCode = 409;
    error.code = "STALE_DRAFT_REVISION";
    throw error;
  }

  if (row.status === "rejected") {
    throw new Error("Rejected import rows must be edited before approval.");
  }

  if (row.ai_analysis_id) {
    const analysis = await get("SELECT resolved_store_id FROM ai_proof_analyses WHERE id = ? AND proof_id = ?", [row.ai_analysis_id, row.batch_id]);
    if (analysis && !analysis.resolved_store_id) throw new Error("Resolve the proof store before approving AI-prepared items.");
  }

  if (!row.photo_path && !row.source_url) {
    throw new Error("Import approval requires a linked proof image or source link.");
  }

  if (row.proof_type === "no_photo" && !row.source_url) {
    throw new Error("Imported prices must use receipt, shelf tag, weekly ad, or source link proof.");
  }

  const importBatch = await priceImportBatchById(row.batch_id);
  if (isProofSubmissionBatch(importBatch)) {
    if (TERMINAL_REJECTED_PROOF_STATUSES.has(importBatch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(importBatch.status) || ["completed", "rejected"].includes(importBatch.review_status)) {
      const error = new Error("This proof is already closed and cannot publish another item.");
      error.statusCode = 409;
      throw error;
    }
    if (Number(importBatch.review_claimed_by) !== Number(adminUser.id) && !staffCan(adminUser, "manage")) {
      const error = new Error(importBatch.review_claimed_by ? `Currently being reviewed by ${importBatch.review_claimed_by_username || "another worker"}.` : "Claim this proof before approving an item.");
      error.statusCode = 409;
      throw error;
    }
  }
  const submittedByUserId = Number(importBatch?.created_by || row.created_by) || null;
  const reportOwnerUserId = submittedByUserId || Number(adminUser.id);
  const submitterUserId = submittedByUserId;
  const isSelfApproval = submittedByUserId === Number(adminUser.id) && isProofSubmissionBatch(importBatch);
  if (isSelfApproval && staffRoleForUser(adminUser) !== "owner") {
    const error = new Error("You cannot approve your own community proof. Ask another reviewer or a Manager to take it.");
    error.statusCode = 409;
    throw error;
  }
  if (isSelfApproval && staffRoleForUser(adminUser) === "owner" && !options.ownerSelfApprovalOverride) {
    const error = new Error("Owner confirmation is required to approve your own proof. Confirm the self-approval override to continue.");
    error.statusCode = 409;
    error.code = "OWNER_SELF_APPROVAL_CONFIRMATION_REQUIRED";
    throw error;
  }
  if (isSelfApproval) {
    await recordPriceEvent({ batchId: row.batch_id, rowId, eventType: "OWNER_SELF_APPROVAL_OVERRIDE", actorUserId: adminUser.id, submitterUserId, reason: options.overrideReason || "Owner operational override confirmed." });
    await recordAdminAudit({ adminUserId: adminUser.id, action: "OWNER_SELF_APPROVAL_OVERRIDE", affectedType: "price_import_row", affectedId: rowId, metadata: { batch_id: row.batch_id } });
  }
  const validStoreIds = await getActiveStoreIds();
  const promotionSafety = promotionGate(row);
  if (!promotionSafety.ready) {
    const error = new Error(`This promotion is not ready to publish: ${promotionSafety.flags.join("; ")}.`);
    error.statusCode = 409;
    throw error;
  }
  const cleanReport = validateReport(importRowToReportBody(row), validStoreIds);
  const locationResolution = await locationResolutionForImportRow(row, cleanReport);
  if (locationResolution.status === "needs_review") {
    const error = new Error("LOCATION NEEDS REVIEW: establish the exact Janesville store or applicable Janesville market before publication.");
    error.statusCode = 409;
    throw error;
  }
  const unitPrice = calculateUnitPrice(cleanReport.price, cleanReport.quantity, cleanReport.unit);
  const submittedAt = new Date().toISOString();
  const productId = await resolveReportProductId(cleanReport, adminUser.id);
  const equivalentReport = await approvedEquivalentReportForDraft(
    {
      ...row,
      product_id: productId,
      store_id: cleanReport.store_id,
      item_name: cleanReport.item_name,
      price: cleanReport.price,
      size_text: cleanReport.size_text
    },
    { productId }
  );

  if (equivalentReport) {
    await run(
      `
        UPDATE price_import_rows
        SET status = 'approved',
            price_report_id = ?,
            product_id = ?,
            duplicate_warning = ?,
            approved_by = ?,
            approved_at = ?,
            updated_by = ?,
            updated_at = ?
        WHERE id = ?
      `,
      [
        equivalentReport.id,
        productId,
        `Linked to existing approved report #${equivalentReport.id}; no duplicate public report was created.`,
        adminUser.id,
        submittedAt,
        adminUser.id,
        submittedAt,
        rowId
      ]
    );

    await run(
      `
        UPDATE price_import_batches
        SET status = CASE
              WHEN ? THEN 'used_for_prices'
              WHEN NOT EXISTS (
                SELECT 1
                FROM price_import_rows
                WHERE batch_id = ?
                  AND status NOT IN ('approved', 'rejected', 'removed')
              )
              THEN 'ready_for_review'
              ELSE status
            END,
            updated_at = ?
        WHERE id = ?
      `,
      [importBatch && isProofSubmissionBatch(importBatch) ? 1 : 0, row.batch_id, submittedAt, row.batch_id]
    );

    return {
      row: await priceImportRowById(rowId),
      report_id: equivalentReport.id,
      product_id: productId,
      approved_price: Number(equivalentReport.price),
      approved_size: equivalentReport.size_text || "",
      store_id: equivalentReport.store_id,
      validity: { valid_from_date: equivalentReport.valid_from_date || null, valid_through_date: equivalentReport.valid_through_date || null },
      publication_state: equivalentReport.status,
      unit_price_label: formatUnitPrice(equivalentReport.unit_price, equivalentReport.unit),
      duplicate: true,
      message: `Import row linked to existing approved report #${equivalentReport.id}. No duplicate public price was created.`
    };
  }

  const confidence = baseConfidence(cleanReport.proof_type);
  const result = await run(
    `
      INSERT INTO price_reports (
        user_id,
        submitted_by_user_id,
        source_import_batch_id,
        source_import_row_id,
        store_id,
        product_id,
        item_name,
        brand,
        category,
        price,
        regular_price,
        sale_price,
        size_text,
        quantity,
        unit,
        unit_price,
        price_basis,
        comparison_price,
        comparison_unit,
        estimated_item_price,
        approximate_item_weight,
        approximate_item_weight_unit,
        package_price,
        multibuy_quantity,
        multibuy_total_price,
        proof_type,
        source_date,
        storage_condition,
        price_type,
        valid_from_date,
        valid_through_date,
        valid_from_time,
        valid_through_time,
        promotion_conditions,
        promotion_schedule_text,
        display_offer_text,
        photo_path,
        photo_original_name,
        photo_mime_type,
        photo_size_bytes,
        notes,
        confidence,
        source_url,
        source_title,
        source_domain,
        source_checked_at,
        location_verification_status,
        applicable_city,
        applicable_state,
        applicable_store_id,
        location_evidence_text,
        verification_count,
        dispute_count,
        status,
        admin_rejection_reason,
        admin_rejection_note,
        reviewed_at,
        reviewed_by,
        review_started_at,
        review_completed_at,
        freshness_status,
        submitted_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'approved', NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      reportOwnerUserId,
      submitterUserId,
      row.batch_id,
      row.id,
      cleanReport.store_id,
      productId,
      cleanReport.item_name,
      cleanReport.brand,
      cleanReport.category,
      cleanReport.price,
      cleanReport.regular_price,
      cleanReport.sale_price,
      cleanReport.size_text,
      cleanReport.quantity,
      unitPrice.unit,
      unitPrice.unitPrice,
      row.price_basis || priceBasisForUnit(row.comparison_unit || unitPrice.unit),
      row.comparison_price ?? unitPrice.unitPrice,
      normalizePriceUnit(row.comparison_unit || unitPrice.unit),
      row.estimated_item_price,
      row.approximate_item_weight,
      normalizePriceUnit(row.approximate_item_weight_unit || ""),
      row.package_price,
      row.multibuy_quantity,
      row.multibuy_total_price,
      cleanReport.proof_type,
      row.source_date || dateInputValue(row.observed_at) || dateInputValue(importBatch?.receipt_purchase_date) || dateInputValue(importBatch?.observed_at),
      row.storage_condition || "unknown",
      normalizePriceType(row.price_type || (row.sale_price ? "sale" : "regular")),
      row.valid_from_date || dateInputValue(row.valid_start_at),
      row.valid_through_date || dateInputValue(row.valid_end_at),
      row.valid_from_time || "",
      row.valid_through_time || "",
      row.promotion_conditions || "",
      row.promotion_schedule_text || "",
      row.display_offer_text || row.promotion_text || "",
      row.photo_path,
      row.photo_original_name,
      row.photo_mime_type,
      row.photo_size_bytes,
      cleanReport.notes,
      confidence,
      row.source_url || "",
      row.source_title || "",
      row.source_domain || sourceDomainFromUrl(row.source_url || ""),
      row.source_checked_at || submittedAt,
      locationResolution.status,
      locationResolution.city,
      locationResolution.state,
      locationResolution.store_id,
      locationResolution.evidence,
      submittedAt,
      adminUser.id,
      importBatch?.review_claimed_at || submittedAt,
      submittedAt,
      freshnessForPrice({ ...row, submitted_at: submittedAt }),
      submittedAt,
      cleanReport.expires_at
    ]
  );

  const updatedReport = await get(
    `
      ${reportSelectWithProduct()}
      WHERE pr.id = ?
    `,
    [result.lastID]
  );

  await organizeApprovedReportProduct(updatedReport, adminUser.id);
  await learnApprovedProductNormalization(row, result.lastID, productId, adminUser.id);
  await notifyCartUsersForApprovedReport(updatedReport);
  if (submitterUserId) await updateUserAccuracy(submitterUserId);
  await recordPriceEvent({ reportId: result.lastID, batchId: row.batch_id, rowId: row.id, eventType: "APPROVED", actorUserId: adminUser.id, submitterUserId, reason: "Human reviewer approved draft price.", metadata: { product_id: productId, store_id: cleanReport.store_id, price: cleanReport.price, unit: cleanReport.unit, ai_analysis_id: row.ai_analysis_id || null, original_ai: row.ai_analysis_id ? { item_name: row.extracted_item_name || row.raw_receipt_line || "", price: row.extracted_price, quantity: row.extracted_quantity, unit: row.extracted_unit, field_confidences: parseMetadataJson(row.ai_field_confidences_json) } : null, human_approved: { product_id: productId, store_id: cleanReport.store_id, item_name: row.item_name, brand: row.brand, category: row.category, storage_condition: row.storage_condition, size_text: row.size_text, quantity: row.quantity, unit: row.unit, price: cleanReport.price, comparison_price: row.comparison_price, comparison_unit: row.comparison_unit, estimated_item_price: row.estimated_item_price, price_type: row.price_type, valid_from_date: row.valid_from_date, valid_through_date: row.valid_through_date, promotion_conditions: row.promotion_conditions, display_offer_text: row.display_offer_text } } });

  await run(
    `
      UPDATE price_import_rows
      SET status = 'approved',
          price_report_id = ?,
          product_id = ?,
          approved_by = ?,
          approved_at = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      result.lastID,
      productId,
      adminUser.id,
      submittedAt,
      adminUser.id,
      submittedAt,
      rowId
    ]
  );

  await run(
    `
      UPDATE price_import_batches
      SET status = CASE
            WHEN ? THEN 'used_for_prices'
            WHEN NOT EXISTS (
              SELECT 1
              FROM price_import_rows
              WHERE batch_id = ?
                AND status NOT IN ('approved', 'rejected', 'removed')
            )
            THEN 'ready_for_review'
            ELSE status
          END,
          approved_item_count = (SELECT COUNT(*) FROM price_import_rows WHERE batch_id = ? AND status = 'approved'),
          review_status = CASE WHEN NOT EXISTS (SELECT 1 FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved', 'rejected', 'removed')) THEN 'ready_to_finish' ELSE review_status END,
          review_decision = CASE WHEN NOT EXISTS (SELECT 1 FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved', 'rejected', 'removed')) THEN 'ready_to_finish' ELSE review_decision END,
          updated_at = ?
      WHERE id = ?
    `,
    [importBatch && isProofSubmissionBatch(importBatch) ? 1 : 0, row.batch_id, row.batch_id, row.batch_id, row.batch_id, submittedAt, row.batch_id]
  );
  const unfinishedAfterApproval = await get("SELECT COUNT(*) AS count FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [row.batch_id]);
  if (!Number(unfinishedAfterApproval?.count || 0)) {
    await run("UPDATE ai_proof_jobs SET status = 'human_complete', completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE proof_id = ?", [submittedAt, submittedAt, row.batch_id]);
  }

  if (importBatch && isProofSubmissionBatch(importBatch)) {
    const rewardRule = proofApprovalPoints(row);
    const reward = await awardProofReward({
      batch: importBatch,
      row,
      report: updatedReport,
      adminUser,
      action: rewardRule.action,
      requestedPoints: rewardRule.points,
      reason: rewardRule.reason,
      adminNote: `Import row #${row.id} approved into report #${result.lastID}.`,
      batchScoped: rewardRule.batchScoped,
      notify: false
    });
    const proofOwner = reward.user || await proofRewardOwner(importBatch, adminUser);

    if (proofOwner) {
      const earnedText = reward.points > 0
        ? ` You earned ${reward.points} point${reward.points === 1 ? "" : "s"}.`
        : "";
      await createUserNotification(
        proofOwner.id,
        "proof_price_approved",
        "Price approved from your proof",
        `Your proof helped add ${updatedReport.item_name} — $${Number(updatedReport.price).toFixed(2)} at ${updatedReport.store_name}.${earnedText}`,
        {
          related_type: "report",
          related_id: result.lastID,
          related_report_id: result.lastID,
          related_import_batch_id: importBatch.id,
          related_import_row_id: row.id,
          points_awarded: reward.points || 0,
          target_tab: "profile",
          target_url: productId ? `/?tab=productView&product=${productId}&store=${cleanReport.store_id}&report=${result.lastID}` : `/?tab=accountView&section=proof&proof=${importBatch.id}&report=${result.lastID}`
        }
      );
    }
  }

  return {
    row: await priceImportRowById(rowId),
    report_id: result.lastID,
    product_id: productId,
    approved_price: Number(updatedReport.price),
    approved_size: updatedReport.size_text || "",
    store_id: updatedReport.store_id,
    validity: { valid_from_date: updatedReport.valid_from_date || null, valid_through_date: updatedReport.valid_through_date || null },
    publication_state: updatedReport.status,
    unit_price_label: unitPrice.formatted,
    message: "Import row approved into public price reports."
  };
}

app.get("/api/admin/price-imports", requireAdminAccess, asyncRoute(async (request, response) => {
  const cleanupReport = await approvedReceiptCleanupReport();
  const batches = await all(
    `
      SELECT batches.*, users.username AS created_by_username, reviewer.username AS review_claimed_by_username
      FROM price_import_batches batches
      LEFT JOIN users ON users.id = batches.created_by
      LEFT JOIN users reviewer ON reviewer.id = batches.review_claimed_by
      ORDER BY
        CASE batches.review_priority
          WHEN 'high' THEN 1
          WHEN 'needs_review' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
          ELSE 3
        END ASC,
        batches.created_at DESC
      LIMIT 50
    `
  );
  const rows = await addReviewHintsToImportRows(await priceImportRowsForBatchIds(batches.map((batch) => batch.id)));
  const rowsByBatch = new Map();

  for (const row of rows) {
    if (!rowsByBatch.has(row.batch_id)) {
      rowsByBatch.set(row.batch_id, []);
    }

    rowsByBatch.get(row.batch_id).push(row);
  }

  const formattedBatches = batches.map((batch) => formatPriceImportBatch(batch, rowsByBatch.get(batch.id) || []));

  response.json({
    warning: "Imported prices are not public until approved.",
    row_statuses: PRICE_IMPORT_ROW_STATUSES,
    source_types: PRICE_IMPORT_SOURCE_TYPES,
    proof_types: PROOF_TYPES,
    cleanup_report: cleanupReport,
    proof_inbox: formattedBatches.filter((batch) => batch.is_proof_submission),
    history: formattedBatches.map((batch) => {
      const rows = batch.rows || [];

      return {
        id: batch.id,
        title: batch.batch_title || `${String(batch.source_type || "proof").replace(/_/g, " ")} #${batch.id}`,
        source_type: batch.source_type,
        proof_type: batch.proof_type,
        store_id: batch.default_store_id,
        source_domain: batch.source_domain,
        source_url: batch.source_url,
        created_by_username: batch.created_by_username,
        created_at: batch.created_at,
        status: batch.status,
        parsed_count: rows.length,
        approved_count: rows.filter((row) => row.status === "approved").length,
        rejected_count: rows.filter((row) => row.status === "rejected").length,
        needs_review_count: rows.filter((row) => !["approved", "rejected", "removed"].includes(row.status)).length,
        duplicate_count: rows.filter((row) => row.duplicate_warning).length
      };
    }),
    batches: formattedBatches
  });
}));

app.post("/api/admin/proof-submissions/:batchId/status", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Proof submission was not found." });
    return;
  }

  if (!isProofSubmissionBatch(batch)) {
    response.status(400).json({ error: "That import batch is not a proof inbox submission." });
    return;
  }

  const action = cleanText(request.body.action, 40).toLowerCase();
  const statusByAction = {
    accept_for_review: "accepted_for_review",
    accepted_for_review: "accepted_for_review",
    accept: "accepted_for_review",
    reviewed: "reviewed_no_prices",
    mark_reviewed: "reviewed_no_prices",
    reviewed_no_prices: "reviewed_no_prices",
    reject: "rejected",
    rejected: "rejected",
    needs_clearer_photo: "needs_clearer_photo",
    needs_source_link: "needs_source_link",
    duplicate: "duplicate",
    mark_duplicate: "duplicate"
  };
  const nextStatus = statusByAction[action];

  if (!nextStatus) {
    response.status(400).json({ error: "Choose a valid proof inbox action." });
    return;
  }

  if (["reviewed_no_prices", "rejected", "duplicate"].includes(nextStatus)) {
    response.status(409).json({ error: "Finish or reject this proof in the Review Workspace so its rows, claim, and audit history close together." });
    return;
  }

  const now = new Date().toISOString();
  const adminReason = cleanText(request.body.admin_reason || request.body.reason || request.body.admin_note, 300);
  const updatedNotes = proofNotesWithReviewNote(batch.notes, adminReason);
  await run(
    `
      UPDATE price_import_batches
      SET status = ?,
          notes = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [nextStatus, updatedNotes, now, batchId]
  );

  const rows = await priceImportRowsForBatchIds([batchId]);
  const updatedBatch = await priceImportBatchById(batchId);
  let reward = { points: 0, user: null, skipped: "" };

  if (nextStatus === "accepted_for_review") {
    reward = await awardProofAcceptedIfNeeded(updatedBatch, request.adminUser, "Proof accepted for review by admin.");
  } else if (nextStatus === "duplicate" && updatedBatch.duplicate_scope === "different_user_duplicate") {
    reward = await awardProofAcceptedIfNeeded(updatedBatch, request.adminUser, "Duplicate proof confirmed by admin.");
  }

  const notificationByStatus = {
    needs_clearer_photo: {
      type: "proof_needs_clearer_photo",
      title: "Clearer photo needed",
      message: "We couldn't read your receipt clearly enough. Please upload a clearer photo."
    },
    needs_source_link: {
      type: "proof_needs_source_link",
      title: "Proof needs source link",
      message: "Your proof needs a source link before we can use it."
    },
    rejected: {
      type: "proof_rejected",
      title: "Proof not accepted",
      message: adminReason
        ? `Your proof could not be used: ${adminReason}`
        : "Your proof could not be used."
    },
    reviewed_no_prices: {
      type: "proof_reviewed_no_prices",
      title: "Proof reviewed",
      message: "Thanks for sending proof. We reviewed it, but no prices were added this time."
    },
    duplicate: {
      type: "proof_duplicate",
      title: reward.points > 0 ? "Proof confirmed" : "Duplicate proof",
      message: reward.points > 0
        ? `Your proof helped confirm an existing price. You earned ${reward.points} point${reward.points === 1 ? "" : "s"}.`
        : "This proof matched another proof already submitted, so no points were awarded."
    }
  };
  const notification = notificationByStatus[nextStatus];

  if (updatedBatch.created_by && notification && !(nextStatus === "duplicate" && reward.points > 0)) {
    const userTargetUrl = ["needs_clearer_photo", "needs_source_link"].includes(nextStatus)
      ? `/?tab=submitView&proof=${batchId}`
      : `/?tab=accountView&section=proof&proof=${batchId}`;
    await createUserNotification(
      updatedBatch.created_by,
      notification.type,
      notification.title,
      notification.message,
      {
        related_type: "price_import_batch",
        related_id: batchId,
        related_import_batch_id: batchId,
        points_awarded: reward.points || 0,
        target_tab: ["needs_clearer_photo", "needs_source_link"].includes(nextStatus) ? "submitView" : "profile",
        target_url: userTargetUrl
      }
    );
  }

  response.json({
    message: `Proof submission marked ${nextStatus.replace(/_/g, " ")}.`,
    batch: formatPriceImportBatch(updatedBatch, rows)
  });
}));

app.post("/api/admin/price-imports/upload", requireAdminAccess, requireLoggedInAdminAction, priceImportUpload.array("proof_photos", 10), asyncRoute(async (request, response) => {
  const files = request.files || [];

  if (!files.length) {
    response.status(400).json({ error: "Upload at least one proof image." });
    return;
  }

  const sourceType = validateImportSourceType(request.body.source_type);
  const proofType = validateImportProofType(request.body.proof_type);
  const now = new Date().toISOString();
  const source = cleanSourceMetadata(request.body, {
    source_checked_at: request.body.source_url ? now : ""
  });
  const defaults = cleanImportBatchDefaults(request.body);
  const created = [];

  try {
    for (const file of files) {
      const proofFileHash = hashUploadedFile(file);
      const duplicate = await findDuplicateProofBatch({
        userId: request.adminUser ? request.adminUser.id : null,
        proofFileHash,
        sourceUrl: ""
      });
      const draftBatchForRules = {
        source_type: sourceType,
        proof_type: proofType,
        photo_path: uploadedFileUrl(file.filename),
        source_url: source.source_url,
        source_checked_at: source.source_checked_at || defaults.observed_at,
        created_at: now,
        duplicate_scope: duplicate?.duplicate_scope || ""
      };
      const trustProfile = request.adminUser
        ? await contributorTrustProfile(request.adminUser.id)
        : TRUST_LEVELS[0];
      const proofQualityFlags = proofQualityFlagsForBatch(draftBatchForRules);
      const reviewPriority = reviewPriorityForProof(draftBatchForRules, trustProfile);
      const result = await run(
        `
          INSERT INTO price_import_batches (
            source_type,
            proof_type,
            photo_path,
            photo_original_name,
            photo_mime_type,
            photo_size_bytes,
            status,
            source_url,
            source_title,
            source_domain,
            source_checked_at,
            default_store_id,
            batch_title,
            observed_at,
            valid_start_at,
            valid_end_at,
            source_text,
            notes,
            proof_file_hash,
            duplicate_of_batch_id,
            duplicate_scope,
            review_priority,
            proof_quality_flags,
            created_by,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, 'import_draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          sourceType,
          proofType,
          uploadedFileUrl(file.filename),
          sanitizeOriginalFilename(file.originalname),
          file.mimetype,
          file.size,
          source.source_url,
          source.source_title,
          source.source_domain,
          source.source_checked_at,
          defaults.default_store_id,
          defaults.batch_title,
          defaults.observed_at,
          defaults.valid_start_at,
          defaults.valid_end_at,
          defaults.source_text,
          defaults.notes,
          proofFileHash,
          duplicate?.duplicate_of_batch_id || null,
          duplicate?.duplicate_scope || "",
          reviewPriority,
          proofQualityFlags.join(","),
          request.adminUser ? request.adminUser.id : null,
          now,
          now
        ]
      );

      created.push(await priceImportBatchById(result.lastID));
      await ensureAiProofJob(result.lastID, { automatic: true });
    }
  } catch (error) {
    for (const file of files) {
      deleteUploadedFile(uploadedFileUrl(file.filename));
    }

    throw error;
  }

  response.status(201).json({
    message: sourceType === "receipt" || proofType === "receipt_photo" ? "Receipt uploaded. AI preparation is queued; human approval is still required." : "Proof image uploaded for human review. Run AI manually if useful.",
    extraction_attempt: {
      status: sourceType === "receipt" || proofType === "receipt_photo" ? "waiting" : "manual_available",
      message: sourceType === "receipt" || proofType === "receipt_photo" ? "AI is preparing proof-scoped draft suggestions in the background. Paste or manual entry remain available." : "AI was not started automatically for this non-receipt proof.",
      attempts: created.map((batch) => ({ batch_id: batch.id, status: sourceType === "receipt" || proofType === "receipt_photo" ? "waiting" : "manual_available" }))
    },
    batches: created.map((batch) => formatPriceImportBatch(batch, []))
  });
}));

app.post("/api/admin/price-intake/batches", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const sourceType = validateImportSourceType(request.body.source_type || "paste_text");
  const proofType = validateImportProofType(request.body.proof_type || "weekly_ad");
  const now = new Date().toISOString();
  const source = cleanSourceMetadata(request.body, {
    source_checked_at: request.body.source_url ? now : ""
  });
  const defaults = cleanImportBatchDefaults(request.body);

  if (!source.source_url && !defaults.source_text) {
    response.status(400).json({ error: "Add a source link, pasted source text, or upload a proof image." });
    return;
  }

  if (sourceType === "website" && !source.source_url) {
    response.status(400).json({ error: "Website intake requires a source URL." });
    return;
  }

  const duplicate = await findDuplicateProofBatch({
    userId: request.adminUser ? request.adminUser.id : null,
    proofFileHash: "",
    sourceUrl: source.source_url
  });
  const draftBatchForRules = {
    source_type: sourceType,
    proof_type: proofType,
    photo_path: "",
    source_url: source.source_url,
    source_checked_at: source.source_checked_at || defaults.observed_at,
    created_at: now,
    duplicate_scope: duplicate?.duplicate_scope || ""
  };
  const trustProfile = request.adminUser
    ? await contributorTrustProfile(request.adminUser.id)
    : TRUST_LEVELS[0];
  const proofQualityFlags = proofQualityFlagsForBatch(draftBatchForRules);
  const reviewPriority = reviewPriorityForProof(draftBatchForRules, trustProfile);
  const result = await run(
    `
      INSERT INTO price_import_batches (
        source_type,
        proof_type,
        photo_path,
        status,
        source_url,
        source_title,
        source_domain,
        source_checked_at,
        default_store_id,
        batch_title,
        observed_at,
        valid_start_at,
        valid_end_at,
        source_text,
        notes,
        duplicate_of_batch_id,
        duplicate_scope,
        review_priority,
        proof_quality_flags,
        created_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, '', 'import_draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sourceType,
      proofType,
      source.source_url,
      source.source_title,
      source.source_domain,
      source.source_checked_at,
      defaults.default_store_id,
      defaults.batch_title,
      defaults.observed_at,
      defaults.valid_start_at,
      defaults.valid_end_at,
      defaults.source_text,
      defaults.notes,
      duplicate?.duplicate_of_batch_id || null,
      duplicate?.duplicate_scope || "",
      reviewPriority,
      proofQualityFlags.join(","),
      request.adminUser ? request.adminUser.id : null,
      now,
      now
    ]
  );

  let batch = await priceImportBatchById(result.lastID);
  let parsed = {
    ok: true,
    created_count: 0,
    skipped_duplicate_row_ids: [],
    ignored_line_count: 0,
    skipped_lines: []
  };

  if (defaults.source_text) {
    parsed = await createPriceTextDraftRows(batch, defaults.source_text, request.adminUser, {
      store_id: defaults.default_store_id || "",
      observed_at: defaults.observed_at,
      valid_start_at: defaults.valid_start_at,
      valid_end_at: defaults.valid_end_at,
      source_url: source.source_url,
      source_title: source.source_title,
      source_checked_at: source.source_checked_at || defaults.observed_at
    });

    if (!parsed.ok) {
      parsed = {
        ok: false,
        created_count: 0,
        skipped_duplicate_row_ids: [],
        ignored_line_count: parsed.ignored_line_count || 0,
        skipped_lines: parsed.skipped_lines || [],
        error: parsed.error
      };
    }
  }

  batch = await priceImportBatchById(result.lastID);
  const rows = await addReviewHintsToImportRows(await priceImportRowsForBatchIds([batch.id]));

  response.status(201).json({
    message: parsed.created_count
      ? `Source batch created with ${parsed.created_count} draft row${parsed.created_count === 1 ? "" : "s"}.`
      : "Source batch created. Add or paste price text to create draft rows.",
    extraction_attempt: {
      status: parsed.created_count ? "parsed" : parsed.ok === false ? "failed" : "draft_only",
      message: parsed.error || (parsed.created_count ? "Pasted source text parsed into draft rows for admin review." : "No draft rows were created automatically."),
      ignored_line_count: parsed.ignored_line_count || 0,
      skipped_duplicate_row_ids: parsed.skipped_duplicate_row_ids || [],
      skipped_lines: parsed.skipped_lines || []
    },
    batch: formatPriceImportBatch(batch, rows)
  });
}));

app.post("/api/admin/price-imports/:batchId/source", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Import batch was not found." });
    return;
  }

  const now = new Date().toISOString();
  const source = cleanSourceMetadata(request.body, {
    source_url: batch.source_url || "",
    source_title: batch.source_title || "",
    source_checked_at: batch.source_checked_at || (request.body.source_url ? now : "")
  });

  await run(
    `
      UPDATE price_import_batches
      SET source_url = ?,
          source_title = ?,
          source_domain = ?,
          source_checked_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      source.source_url,
      source.source_title,
      source.source_domain,
      source.source_checked_at,
      now,
      batchId
    ]
  );

  await run(
    `
      UPDATE price_import_rows
      SET source_url = ?,
          source_title = ?,
          source_domain = ?,
          source_checked_at = ?,
          updated_by = ?,
          updated_at = ?
      WHERE batch_id = ?
        AND status != 'approved'
        AND (
          COALESCE(source_url, '') = ''
          OR COALESCE(source_url, '') = ?
        )
    `,
    [
      source.source_url,
      source.source_title,
      source.source_domain,
      source.source_checked_at,
      request.adminUser ? request.adminUser.id : null,
      now,
      batchId,
      batch.source_url || ""
    ]
  );

  const rows = await priceImportRowsForBatchIds([batchId]);

  response.json({
    message: source.source_url ? "Proof source saved." : "Proof source cleared.",
    batch: formatPriceImportBatch(await priceImportBatchById(batchId), rows)
  });
}));

app.post("/api/admin/price-imports/:batchId/rows", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Import batch was not found." });
    return;
  }

  const draft = cleanImportRowDraft({
    ...importBatchDefaultsForRow(batch),
    extraction_confidence: "low",
    extraction_notes: "",
    ...request.body
  });
  const now = new Date().toISOString();
  const duplicate = await duplicateImportRowForDraft(batchId, draft);

  if (duplicate) {
    response.status(409).json({
      error: "A matching import row already exists for this proof. Review the existing row instead.",
      duplicate_row_id: duplicate.id,
      row: formatPriceImportRow(await priceImportRowById(duplicate.id))
    });
    return;
  }

  draft.duplicate_warning = await duplicateWarningForDraft(draft);
  const rowId = await insertPriceImportRowDraft(
    batchId,
    draft,
    request.adminUser ? request.adminUser.id : null,
    now
  );

  await run(
    "UPDATE price_import_batches SET status = CASE WHEN ? THEN 'accepted_for_review' ELSE 'ready_for_review' END, updated_at = ? WHERE id = ?",
    [isProofSubmissionBatch(batch) ? 1 : 0, now, batchId]
  );
  await awardProofAcceptedIfNeeded(batch, request.adminUser, "Draft price row created from proof.");

  response.status(201).json({
    message: "Draft import row created.",
    row: formatPriceImportRow(await priceImportRowById(rowId))
  });
}));

app.post("/api/admin/price-imports/:batchId/parse-price-text", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Import batch was not found." });
    return;
  }

  const sourceText = cleanReceiptSourceText(request.body.source_text || request.body.price_text || "", 12000);

  if (!sourceText) {
    response.status(400).json({ error: "Paste price text before parsing." });
    return;
  }

  const source = cleanSourceMetadata(request.body, {
    source_url: batch.source_url || "",
    source_title: batch.source_title || "",
    source_checked_at: batch.source_checked_at || batch.observed_at || (request.body.source_url ? new Date().toISOString() : "")
  });
  const defaults = cleanImportBatchDefaults(request.body, {
    default_store_id: batch.default_store_id,
    observed_at: batch.observed_at,
    valid_start_at: batch.valid_start_at,
    valid_end_at: batch.valid_end_at,
    source_text: batch.source_text || ""
  });
  const parsed = await createPriceTextDraftRows(batch, sourceText, request.adminUser, {
    store_id: defaults.default_store_id || batch.default_store_id || "",
    observed_at: defaults.observed_at || batch.observed_at || "",
    valid_start_at: defaults.valid_start_at || batch.valid_start_at || "",
    valid_end_at: defaults.valid_end_at || batch.valid_end_at || "",
    source_url: source.source_url,
    source_title: source.source_title,
    source_checked_at: source.source_checked_at
  });

  if (!parsed.ok) {
    response.status(422).json({
      error: parsed.error,
      extraction_attempt: {
        status: "failed",
        message: parsed.error,
        ignored_line_count: parsed.ignored_line_count || 0,
        skipped_lines: parsed.skipped_lines || []
      }
    });
    return;
  }

  const rows = await addReviewHintsToImportRows(await priceImportRowsForBatchIds([batchId]));

  if (parsed.created_count && isProofSubmissionBatch(batch)) {
    await awardProofAcceptedIfNeeded(batch, request.adminUser, "Price text created draft rows from proof.");
  }

  response.status(parsed.created_count ? 201 : 200).json({
    message: parsed.created_count
      ? `${parsed.created_count} draft row${parsed.created_count === 1 ? "" : "s"} created from price text. Review before approval.`
      : "No new rows were created because matching draft rows already exist.",
    extraction_attempt: {
      status: parsed.created_count ? "parsed" : "duplicate",
      message: parsed.created_count ? "Parsed rows are draft-only until approved." : "Duplicate price text was not added again.",
      ignored_line_count: parsed.ignored_line_count || 0,
      skipped_duplicate_row_ids: parsed.skipped_duplicate_row_ids || [],
      skipped_lines: parsed.skipped_lines || []
    },
    batch: formatPriceImportBatch(await priceImportBatchById(batchId), rows),
    rows: rows.map(formatPriceImportRow)
  });
}));

app.post("/api/admin/price-imports/:batchId/extract-text", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Import batch was not found." });
    return;
  }

  const parsed = parseSourceTextForImport(request.body.source_text);

  if (!parsed.ok) {
    response.status(422).json({
      error: parsed.error,
      extraction_attempt: {
        status: "failed",
        message: parsed.error
      }
    });
    return;
  }

  const now = new Date().toISOString();
  const source = cleanSourceMetadata(request.body, {
    source_url: batch.source_url || "",
    source_title: batch.source_title || "",
    source_checked_at: batch.source_checked_at || (request.body.source_url ? now : "")
  });

  await run(
    `
      UPDATE price_import_batches
      SET source_url = ?,
          source_title = ?,
          source_domain = ?,
          source_checked_at = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      source.source_url,
      source.source_title,
      source.source_domain,
      source.source_checked_at,
      now,
      batchId
    ]
  );

  const requestedRowId = Number.parseInt(request.body.row_id, 10);
  const existing = Number.isInteger(requestedRowId) && requestedRowId > 0
    ? await priceImportRowById(requestedRowId)
    : await firstEditableImportRowForBatch(batchId);

  if (existing && Number(existing.batch_id) !== batchId) {
    response.status(400).json({ error: "Import row does not belong to this proof batch." });
    return;
  }

  if (existing?.status === "approved") {
    response.status(400).json({ error: "Approved import rows cannot be edited." });
    return;
  }

  const parsedValues = Object.fromEntries(
    Object.entries(parsed.draft).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
  const draft = cleanImportRowDraft({
    ...(existing || {}),
    source_url: source.source_url,
    source_title: source.source_title,
    source_checked_at: source.source_checked_at,
    proof_type: existing?.proof_type || batch.proof_type || "weekly_ad",
    status: existing?.status || "ready_for_review",
    ...parsedValues,
    ...["store_id", "brand", "category", "product_id", "proof_type"].reduce((fields, key) => {
      if (Object.prototype.hasOwnProperty.call(request.body, key) && request.body[key] !== "") {
        fields[key] = request.body[key];
      }

      return fields;
    }, {})
  });
  const duplicate = await duplicateImportRowForDraft(batchId, draft, existing?.id || null);

  if (duplicate) {
    response.json({
      message: "A matching import row already exists. Review the existing row instead.",
      duplicate: true,
      extraction_attempt: {
        status: "duplicate",
        confidence: duplicate.extraction_confidence || "low",
        message: "Duplicate source text was not added again."
      },
      row: formatPriceImportRow(await priceImportRowById(duplicate.id))
    });
    return;
  }

  if (existing) {
    await run(
      `
        UPDATE price_import_rows
        SET product_id = ?,
            store_id = ?,
            item_name = ?,
            brand = ?,
            category = ?,
            price = ?,
            regular_price = ?,
            sale_price = ?,
            coupon_required = ?,
            deal_limit = ?,
            size_text = ?,
            quantity = ?,
            unit = ?,
            proof_type = ?,
            valid_start_at = ?,
            valid_end_at = ?,
            source_url = ?,
            source_title = ?,
            source_domain = ?,
            source_checked_at = ?,
            extraction_confidence = ?,
            extraction_notes = ?,
            notes = ?,
            status = ?,
            admin_rejection_note = NULL,
            updated_by = ?,
            updated_at = ?
        WHERE id = ?
      `,
      [
        draft.product_id,
        draft.store_id,
        draft.item_name,
        draft.brand,
        draft.category,
        draft.price,
        draft.regular_price,
        draft.sale_price,
        draft.coupon_required,
        draft.deal_limit,
        draft.size_text,
        draft.quantity,
        draft.unit,
        draft.proof_type,
        draft.valid_start_at,
        draft.valid_end_at,
        draft.source_url,
        draft.source_title,
        draft.source_domain,
        draft.source_checked_at,
        draft.extraction_confidence,
        draft.extraction_notes,
        draft.notes,
        draft.status,
        request.adminUser ? request.adminUser.id : null,
        now,
        existing.id
      ]
    );
    if (isProofSubmissionBatch(batch)) {
      await run(
        "UPDATE price_import_batches SET status = 'accepted_for_review', updated_at = ? WHERE id = ?",
        [now, batchId]
      );
    }
    await awardProofAcceptedIfNeeded(batch, request.adminUser, "Source text reviewed for proof.");

    response.json({
      message: "Source text parsed into the existing draft row. Review before approval.",
      extraction_attempt: {
        status: "parsed",
        confidence: draft.extraction_confidence,
        message: draft.extraction_notes
      },
      row: formatPriceImportRow(await priceImportRowById(existing.id))
    });
    return;
  }

  const result = await run(
    `
      INSERT INTO price_import_rows (
        batch_id,
        product_id,
        store_id,
        item_name,
        brand,
        category,
        price,
        regular_price,
        sale_price,
        coupon_required,
        deal_limit,
        size_text,
        quantity,
        unit,
        proof_type,
        valid_start_at,
        valid_end_at,
        source_url,
        source_title,
        source_domain,
        source_checked_at,
        extraction_confidence,
        extraction_notes,
        notes,
        status,
        created_by,
        created_at,
        updated_by,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      batchId,
      draft.product_id,
      draft.store_id,
      draft.item_name,
      draft.brand,
      draft.category,
      draft.price,
      draft.regular_price,
      draft.sale_price,
      draft.coupon_required,
      draft.deal_limit,
      draft.size_text,
      draft.quantity,
      draft.unit,
      draft.proof_type,
      draft.valid_start_at,
      draft.valid_end_at,
      draft.source_url,
      draft.source_title,
      draft.source_domain,
      draft.source_checked_at,
      draft.extraction_confidence,
      draft.extraction_notes,
      draft.notes,
      draft.status,
      request.adminUser ? request.adminUser.id : null,
      now,
      request.adminUser ? request.adminUser.id : null,
      now
    ]
  );

  await run(
    "UPDATE price_import_batches SET status = CASE WHEN ? THEN 'accepted_for_review' ELSE 'ready_for_review' END, updated_at = ? WHERE id = ?",
    [isProofSubmissionBatch(batch) ? 1 : 0, now, batchId]
  );
  await awardProofAcceptedIfNeeded(batch, request.adminUser, "Source text created a draft price row from proof.");

  response.status(201).json({
    message: "Source text parsed into a new draft row. Review before approval.",
    extraction_attempt: {
      status: "parsed",
      confidence: draft.extraction_confidence,
      message: draft.extraction_notes
    },
    row: formatPriceImportRow(await priceImportRowById(result.lastID))
  });
}));

app.post("/api/admin/price-imports/:batchId/parse-receipt", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Import batch was not found." });
    return;
  }

  if (batch.source_type !== "receipt" && batch.proof_type !== "receipt_photo") {
    response.status(400).json({ error: "Receipt parsing is only available for receipt imports." });
    return;
  }

  const receiptText = cleanReceiptSourceText(request.body.receipt_text || request.body.source_text || "", 8000);
  const parsed = await createReceiptDraftRows(batch, receiptText, request.adminUser, {
    ocrText: receiptText,
    ocrConfidence: batch.receipt_ocr_confidence || ""
  });

  if (!parsed.ok) {
    response.status(422).json({
      error: parsed.error,
      extraction_attempt: {
        status: "failed",
        message: parsed.error
      }
    });
    return;
  }

  const rows = await priceImportRowsForBatchIds([batchId]);

  if (parsed.created_count) {
    if (isProofSubmissionBatch(batch)) {
      await run(
        "UPDATE price_import_batches SET status = 'accepted_for_review', updated_at = ? WHERE id = ?",
        [new Date().toISOString(), batchId]
      );
    }
    await awardProofAcceptedIfNeeded(batch, request.adminUser, "Receipt helper created draft rows from proof.");
  }

  response.status(parsed.created_count ? 201 : 200).json({
    message: parsed.created_count
      ? `${parsed.created_count} receipt draft row${parsed.created_count === 1 ? "" : "s"} created. Review before approval.`
      : "No new receipt rows were created because matching rows already exist.",
    extraction_attempt: {
      status: parsed.created_count ? "parsed" : "duplicate",
      confidence: parsed.metadata.needs_store_review ? "medium" : "high",
      message: parsed.metadata.needs_store_review
        ? "Receipt rows need store review before approval."
        : "Receipt rows are ready for admin review.",
      ignored_line_count: parsed.ignored_line_count,
      skipped_duplicate_row_ids: parsed.skipped_duplicate_row_ids,
      skipped_lines: parsed.skipped_lines || []
    },
    batch: formatPriceImportBatch(await priceImportBatchById(batchId), rows),
    rows: rows.map(formatPriceImportRow)
  });
}));

app.post("/api/admin/price-import-rows/bulk", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const action = cleanText(request.body.action, 20).toLowerCase();
  const rowIds = parseImportRowIds(request.body.row_ids || request.body.rowIds);

  if (!rowIds.length) {
    response.status(400).json({ error: "Choose at least one import row." });
    return;
  }

  if (action === "approve") {
    const results = [];

    for (const rowId of rowIds) {
      results.push(await approvePriceImportRow(rowId, request.adminUser, {
        ownerSelfApprovalOverride: request.body.owner_self_approval_override === true,
        overrideReason: request.body.override_reason
      }));
    }

    const summaries = new Map();

    for (const result of results) {
      if (!result.row?.batch_id) {
        continue;
      }

      const batch = await priceImportBatchById(result.row.batch_id);
      const owner = await proofRewardOwner(batch, request.adminUser);

      if (!owner) {
        continue;
      }

      const key = `${owner.id}:${batch.id}`;
      const current = summaries.get(key) || { owner, batch, count: 0 };
      current.count += 1;
      summaries.set(key, current);
    }

    for (const summary of summaries.values()) {
      if (summary.count > 1) {
        await createUserNotification(
          summary.owner.id,
          "proof_multiple_prices_approved",
          "Multiple prices approved from your proof",
          `Your proof helped add ${summary.count} prices.`,
          {
            related_type: "price_import_batch",
            related_id: summary.batch.id,
            related_import_batch_id: summary.batch.id,
            target_tab: "profile",
            target_url: `/?tab=accountView&section=proof&proof=${summary.batch.id}`
          }
        );
      }
    }

    response.json({
      message: `${results.length} import row${results.length === 1 ? "" : "s"} approved.`,
      results
    });
    return;
  }

  if (action === "reject") {
    const now = new Date().toISOString();
    await run(
      `
        UPDATE price_import_rows
        SET status = 'rejected',
            admin_rejection_note = ?,
            rejected_by = ?,
            rejected_at = ?,
            updated_by = ?,
            updated_at = ?
        WHERE id IN (${rowIds.map(() => "?").join(", ")})
          AND status != 'approved'
      `,
      [
        cleanText(request.body.admin_rejection_note || "Bulk rejected by admin.", 500),
        request.adminUser ? request.adminUser.id : null,
        now,
        request.adminUser ? request.adminUser.id : null,
        now,
        ...rowIds
      ]
    );

    response.json({ message: `${rowIds.length} import row${rowIds.length === 1 ? "" : "s"} rejected.` });
    return;
  }

  if (action === "remove") {
    const now = new Date().toISOString();
    await run(
      `
        UPDATE price_import_rows
        SET status = 'removed',
            admin_rejection_note = ?,
            updated_by = ?,
            updated_at = ?
        WHERE id IN (${rowIds.map(() => "?").join(", ")})
          AND status != 'approved'
      `,
      [
        cleanText(request.body.admin_rejection_note || "Removed from draft review by admin.", 500),
        request.adminUser ? request.adminUser.id : null,
        now,
        ...rowIds
      ]
    );

    response.json({ message: `${rowIds.length} import row${rowIds.length === 1 ? "" : "s"} removed from draft review.` });
    return;
  }

  if (action === "update") {
    const updates = [];
    const params = [];
    const now = new Date().toISOString();

    if (Object.prototype.hasOwnProperty.call(request.body, "store_id") && request.body.store_id !== "") {
      const storeId = Number.parseInt(request.body.store_id, 10);

      if (!Number.isInteger(storeId) || storeId <= 0) {
        response.status(400).json({ error: "Bulk store is not valid." });
        return;
      }

      updates.push("store_id = ?");
      params.push(storeId);
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "category") && request.body.category !== "") {
      const category = cleanText(request.body.category, 30).toLowerCase();

      if (!CATEGORIES.includes(category)) {
        response.status(400).json({ error: "Bulk category is not valid." });
        return;
      }

      updates.push("category = ?");
      params.push(category);
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "proof_type") && request.body.proof_type !== "") {
      updates.push("proof_type = ?");
      params.push(validateImportProofType(request.body.proof_type));
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "observed_at") && request.body.observed_at !== "") {
      updates.push("observed_at = ?");
      params.push(normalizeOptionalTimestamp(request.body.observed_at));
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "valid_start_at") && request.body.valid_start_at !== "") {
      updates.push("valid_start_at = ?");
      params.push(normalizeImportDate(request.body.valid_start_at, false));
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "valid_end_at") && request.body.valid_end_at !== "") {
      updates.push("valid_end_at = ?");
      params.push(normalizeImportDate(request.body.valid_end_at, true));
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "source_url") || Object.prototype.hasOwnProperty.call(request.body, "source_title") || Object.prototype.hasOwnProperty.call(request.body, "source_checked_at")) {
      const source = cleanSourceMetadata(request.body);
      updates.push("source_url = ?", "source_title = ?", "source_domain = ?", "source_checked_at = ?");
      params.push(source.source_url, source.source_title, source.source_domain, source.source_checked_at);
    }

    if (Object.prototype.hasOwnProperty.call(request.body, "status") && request.body.status !== "") {
      const nextStatus = validateImportRowStatus(request.body.status);

      if (nextStatus === "approved") {
        response.status(400).json({ error: "Use the approve action for public approval." });
        return;
      }

      updates.push("status = ?");
      params.push(nextStatus);
    }

    if (!updates.length) {
      response.status(400).json({ error: "Choose at least one bulk field to update." });
      return;
    }

    await run(
      `
        UPDATE price_import_rows
        SET ${updates.join(", ")},
            updated_by = ?,
            updated_at = ?
        WHERE id IN (${rowIds.map(() => "?").join(", ")})
          AND status NOT IN ('approved', 'removed')
      `,
      [
        ...params,
        request.adminUser ? request.adminUser.id : null,
        now,
        ...rowIds
      ]
    );

    for (const rowId of rowIds) {
      const row = await priceImportRowById(rowId);

      if (!row || row.status === "approved" || row.status === "removed") {
        continue;
      }

      await run(
        "UPDATE price_import_rows SET duplicate_warning = ?, updated_at = ? WHERE id = ?",
        [await duplicateWarningForDraft(row), now, rowId]
      );
    }

    response.json({ message: `${rowIds.length} import row${rowIds.length === 1 ? "" : "s"} updated.` });
    return;
  }

  response.status(400).json({ error: "Bulk import action is not valid." });
}));

app.post("/api/admin/price-imports/:batchId/undo-approval", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);

  if (!batch) {
    response.status(404).json({ error: "Import batch was not found." });
    return;
  }

  const approvedRows = await all(
    `
      SELECT
        rows.id AS row_id,
        rows.price_report_id,
        rows.approved_at,
        rows.approved_by,
        rows.duplicate_warning,
        pr.status AS report_status,
        pr.user_id AS report_user_id,
        pr.verification_count,
        pr.dispute_count,
        pr.submitted_at
      FROM price_import_rows rows
      JOIN price_reports pr ON pr.id = rows.price_report_id
      WHERE rows.batch_id = ?
        AND rows.status = 'approved'
        AND rows.price_report_id IS NOT NULL
    `,
    [batchId]
  );

  const createdRows = approvedRows.filter((row) => {
    const linkedDuplicate = /^linked to existing approved report/i.test(row.duplicate_warning || "");
    const sameAdmin = Number(row.report_user_id) === Number(row.approved_by);
    const approvedAt = row.approved_at ? new Date(row.approved_at).getTime() : 0;
    const submittedAt = row.submitted_at ? new Date(row.submitted_at).getTime() : 0;
    const closeSubmitTime = approvedAt && submittedAt && Math.abs(approvedAt - submittedAt) <= 60 * 1000;

    return !linkedDuplicate && sameAdmin && closeSubmitTime;
  });

  if (!createdRows.length) {
    response.status(400).json({ error: "No safely undoable approved reports were found for this batch." });
    return;
  }

  const unsafe = createdRows.filter((row) =>
    row.report_status !== "approved" ||
    Number(row.verification_count || 0) > 0 ||
    Number(row.dispute_count || 0) > 0
  );

  if (unsafe.length) {
    response.status(409).json({
      error: "This batch cannot be undone automatically because one or more approved reports has user verification, dispute, or status history.",
      unsafe_report_ids: unsafe.map((row) => row.price_report_id)
    });
    return;
  }

  const now = new Date().toISOString();
  const reportIds = createdRows.map((row) => row.price_report_id);
  const rowIds = createdRows.map((row) => row.row_id);

  await run(
    `
      UPDATE price_reports
      SET status = 'removed',
          confidence = 'disputed',
          admin_rejection_reason = ?,
          admin_rejection_note = ?,
          reviewed_at = ?,
          reviewed_by = ?
      WHERE id IN (${reportIds.map(() => "?").join(", ")})
    `,
    [
      "import_undo",
      `Admin undid price import batch #${batchId}.`,
      now,
      request.adminUser ? request.adminUser.id : null,
      ...reportIds
    ]
  );

  await run(
    `
      UPDATE price_import_rows
      SET status = 'ready_for_review',
          price_report_id = NULL,
          approved_by = NULL,
          approved_at = NULL,
          duplicate_warning = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id IN (${rowIds.map(() => "?").join(", ")})
    `,
    [
      `Approval undone by admin at ${now}; public report removed.`,
      request.adminUser ? request.adminUser.id : null,
      now,
      ...rowIds
    ]
  );

  await run(
    "UPDATE price_import_batches SET status = 'ready_for_review', updated_at = ? WHERE id = ?",
    [now, batchId]
  );

  response.json({
    message: `${reportIds.length} public report${reportIds.length === 1 ? "" : "s"} removed and returned to draft review.`,
    removed_report_ids: reportIds,
    row_ids: rowIds
  });
}));

app.post("/api/admin/price-import-rows/:id", requireAdminAccess, requireLoggedInAdminAction, serializePriceImportRowMutation, asyncRoute(async (request, response) => {
  const rowId = Number.parseInt(request.params.id, 10);
  const existing = await priceImportRowById(rowId);

  if (!existing) {
    response.status(404).json({ error: "Import row was not found." });
    return;
  }

  if (existing.status === "approved") {
    response.status(400).json({ error: "Approved import rows cannot be edited." });
    return;
  }

  const proofBatch = await priceImportBatchById(existing.batch_id);
  if (isProofSubmissionBatch(proofBatch)) {
    if (TERMINAL_REJECTED_PROOF_STATUSES.has(proofBatch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(proofBatch.status) || ["completed", "rejected"].includes(proofBatch.review_status)) {
      response.status(409).json({ error: "This proof is already closed." });
      return;
    }
    if (Number(proofBatch.review_claimed_by) !== Number(request.adminUser.id) && !staffCan(request.adminUser, "manage")) {
      response.status(409).json({ error: proofBatch.review_claimed_by ? `Currently being reviewed by ${proofBatch.review_claimed_by_username || "another worker"}.` : "Claim this proof before editing an item." });
      return;
    }
  }

  const editedFields = Array.isArray(request.body.edited_fields) ? request.body.edited_fields.map((field) => cleanText(field, 40)) : [];
  const primaryPriceCorrection = editedFields.includes("price") && !editedFields.includes("comparison_price") && Number(existing.comparison_price ?? existing.price) === Number(existing.price);
  const primaryUnitCorrection = editedFields.includes("unit") && !editedFields.includes("comparison_unit") && String(existing.comparison_unit || existing.unit || "") === String(existing.unit || "");
  const draft = cleanImportRowDraft({
    ...existing,
    ...request.body,
    comparison_price: primaryPriceCorrection ? request.body.price : (request.body.comparison_price ?? request.body.price ?? existing.comparison_price),
    comparison_unit: primaryUnitCorrection ? request.body.unit : (request.body.comparison_unit ?? request.body.unit ?? existing.comparison_unit),
    status: request.body.status || existing.status
  });
  if (draft.product_id) {
    const selectedProduct = await getProductById(draft.product_id, true);
    if (!selectedProduct || ["hidden", "merged"].includes(selectedProduct.status)) {
      response.status(400).json({ error: "Selected product is not available." });
      return;
    }
  }
  const now = new Date().toISOString();
  draft.duplicate_warning = await duplicateWarningForDraft(draft);

  await run(
    `
      UPDATE price_import_rows
      SET product_id = ?,
          store_id = ?,
          item_name = ?,
          brand = ?,
          variant = ?,
          category = ?,
          price = ?,
          price_basis = ?,
          comparison_price = ?,
          comparison_unit = ?,
          estimated_item_price = ?,
          approximate_item_weight = ?,
          approximate_item_weight_unit = ?,
          package_price = ?,
          regular_price = ?,
          sale_price = ?,
          member_card_price = ?,
          coupon_required = ?,
          deal_limit = ?,
          multibuy_details = ?,
          multibuy_quantity = ?,
          multibuy_total_price = ?,
          storage_condition = ?,
          price_type = ?,
          promotion_text = ?,
          display_offer_text = ?,
          promotion_conditions = ?,
          promotion_schedule_text = ?,
          valid_from_date = ?,
          valid_through_date = ?,
          valid_from_time = ?,
          valid_through_time = ?,
          size_text = ?,
          quantity = ?,
          unit = ?,
          proof_type = ?,
          observed_at = ?,
          source_date = ?,
          valid_start_at = ?,
          valid_end_at = ?,
          source_url = ?,
          source_title = ?,
          source_domain = ?,
          source_checked_at = ?,
          extraction_confidence = ?,
          extraction_notes = ?,
          duplicate_warning = ?,
          notes = ?,
          status = ?,
          rejection_reason = NULL,
          admin_rejection_note = NULL,
          rejected_by = NULL,
          rejected_at = NULL,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      draft.product_id,
      draft.store_id,
      draft.item_name,
      draft.brand,
      draft.variant,
      draft.category,
      draft.price,
      draft.price_basis,
      draft.comparison_price,
      draft.comparison_unit,
      draft.estimated_item_price,
      draft.approximate_item_weight,
      draft.approximate_item_weight_unit,
      draft.package_price,
      draft.regular_price,
      draft.sale_price,
      draft.member_card_price,
      draft.coupon_required,
      draft.deal_limit,
      draft.multibuy_details,
      draft.multibuy_quantity,
      draft.multibuy_total_price,
      draft.storage_condition,
      draft.price_type,
      draft.promotion_text,
      draft.display_offer_text,
      draft.promotion_conditions,
      draft.promotion_schedule_text,
      draft.valid_from_date,
      draft.valid_through_date,
      draft.valid_from_time,
      draft.valid_through_time,
      draft.size_text,
      draft.quantity,
      draft.unit,
      draft.proof_type,
      draft.observed_at,
      draft.source_date,
      draft.valid_start_at,
      draft.valid_end_at,
      draft.source_url,
      draft.source_title,
      draft.source_domain,
      draft.source_checked_at,
      draft.extraction_confidence,
      draft.extraction_notes,
      draft.duplicate_warning,
      draft.notes,
      draft.status,
      request.adminUser ? request.adminUser.id : null,
      now,
      rowId
    ]
  );

  if (draft.status === "removed" && isProofSubmissionBatch(proofBatch)) {
    await run(
      "UPDATE price_import_batches SET review_status = CASE WHEN NOT EXISTS (SELECT 1 FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')) THEN 'ready_to_finish' ELSE review_status END, review_decision = CASE WHEN NOT EXISTS (SELECT 1 FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')) THEN 'ready_to_finish' ELSE review_decision END, updated_at = ? WHERE id = ?",
      [existing.batch_id, existing.batch_id, now, existing.batch_id]
    );
  }

  const savedRow = await priceImportRowById(rowId);
  const auditedFields = ["product_id", "store_id", "item_name", "brand", "variant", "category", "price", "comparison_price", "comparison_unit", "estimated_item_price", "package_price", "size_text", "quantity", "unit", "storage_condition", "price_type", "valid_from_date", "valid_through_date", "valid_from_time", "valid_through_time", "promotion_conditions", "promotion_schedule_text", "display_offer_text", "multibuy_quantity", "multibuy_total_price"];
  const correctedFields = auditedFields.filter((field) => String(existing[field] ?? "") !== String(savedRow[field] ?? ""));
  if (correctedFields.length) {
    await recordPriceEvent({
      batchId: existing.batch_id,
      rowId,
      eventType: "DRAFT_EDITED",
      actorUserId: request.adminUser?.id,
      submitterUserId: proofBatch?.created_by || existing.created_by || null,
      reason: "Human reviewer corrected draft fields before approval.",
      metadata: {
        corrected_fields: correctedFields,
        before: Object.fromEntries(correctedFields.map((field) => [field, existing[field] ?? null])),
        after: Object.fromEntries(correctedFields.map((field) => [field, savedRow[field] ?? null])),
        ai_analysis_id: existing.ai_analysis_id || null
      }
    });
  }

  const review = isProofSubmissionBatch(proofBatch)
    ? await reviewSnapshotForBatchId(existing.batch_id, request.adminUser)
    : null;

  response.json({
    message: "Import row saved.",
    row: formatPriceImportRow(savedRow),
    proof_id: existing.batch_id,
    review_state: review?.review_state || null,
    approval_summary: review?.approval_summary || null,
    completed_rows: review?.completed_rows || []
  });
}));

app.post("/api/admin/price-import-rows/:id/approve", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("approve"), serializePriceImportRowMutation, asyncRoute(async (request, response) => {
  const rowId = Number.parseInt(request.params.id, 10);
  const result = await approvePriceImportRow(rowId, request.adminUser, {
    ownerSelfApprovalOverride: request.body.owner_self_approval_override === true,
    overrideReason: request.body.override_reason,
    expectedDraftUpdatedAt: request.body.expected_draft_updated_at
  });

  const review = await reviewSnapshotForBatchId(result.row.batch_id, request.adminUser);
  response.json({ ...result, proof_id: result.row.batch_id, review_state: review?.review_state || null, approval_summary: review?.approval_summary || null, completed_rows: review?.completed_rows || [] });
}));

app.post("/api/admin/price-import-rows/:id/reject", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const rowId = Number.parseInt(request.params.id, 10);
  const existing = await priceImportRowById(rowId);

  if (!existing) {
    response.status(404).json({ error: "Import row was not found." });
    return;
  }

  if (existing.status === "approved") {
    response.status(400).json({ error: "Approved import rows cannot be rejected." });
    return;
  }

  const proofBatch = await priceImportBatchById(existing.batch_id);
  if (isProofSubmissionBatch(proofBatch)) {
    if (TERMINAL_REJECTED_PROOF_STATUSES.has(proofBatch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(proofBatch.status) || ["completed", "rejected"].includes(proofBatch.review_status)) {
      response.status(409).json({ error: "This proof is already closed." });
      return;
    }
    if (Number(proofBatch.review_claimed_by) !== Number(request.adminUser.id) && !staffCan(request.adminUser, "manage")) {
      response.status(409).json({ error: proofBatch.review_claimed_by ? `Currently being reviewed by ${proofBatch.review_claimed_by_username || "another worker"}.` : "Claim this proof before rejecting an item." });
      return;
    }
  }

  const requestedRejectionReason = cleanText(request.body.rejection_reason, 80).toLowerCase();
  const rejectionReason = normalizeReviewRejectionReason(requestedRejectionReason);
  if (!REVIEW_ROW_REJECTION_REASONS.includes(rejectionReason)) {
    response.status(400).json({ error: "Choose a valid rejection reason." });
    return;
  }
  const now = new Date().toISOString();
  await run(
    `
      UPDATE price_import_rows
      SET status = 'rejected',
          rejection_reason = ?,
          public_rejection_reason = ?,
          public_reviewer_explanation = ?,
          admin_rejection_note = ?,
          rejected_by = ?,
          rejected_at = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      requestedRejectionReason,
      rejectionReason,
      cleanText(request.body.public_reviewer_explanation || "", 300),
      cleanText(request.body.admin_rejection_note || "", 500),
      request.adminUser ? request.adminUser.id : null,
      now,
      request.adminUser ? request.adminUser.id : null,
      now,
      rowId
    ]
  );
  const batch = proofBatch || await priceImportBatchById(existing.batch_id);
  await recordPriceEvent({ batchId: existing.batch_id, rowId, eventType: "REJECTED", actorUserId: request.adminUser.id, submitterUserId: batch?.created_by, reason: requestedRejectionReason, metadata: { public_rejection_reason: rejectionReason, reviewer_note: cleanText(request.body.admin_rejection_note || "", 500) } });
  await run("UPDATE price_import_batches SET rejected_item_count = (SELECT COUNT(*) FROM price_import_rows WHERE batch_id = ? AND status = 'rejected'), review_status = CASE WHEN NOT EXISTS (SELECT 1 FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')) THEN 'ready_to_finish' ELSE review_status END, review_decision = CASE WHEN NOT EXISTS (SELECT 1 FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')) THEN 'ready_to_finish' ELSE review_decision END, updated_at = ? WHERE id = ?", [existing.batch_id, existing.batch_id, existing.batch_id, now, existing.batch_id]);
  const unfinished = await get("SELECT COUNT(*) AS count FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [existing.batch_id]);
  if (!Number(unfinished?.count || 0)) await run("UPDATE ai_proof_jobs SET status = 'human_complete', completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE proof_id = ?", [now, now, existing.batch_id]);

  const review = await reviewSnapshotForBatchId(existing.batch_id, request.adminUser);
  response.json({
    message: "Import row rejected.",
    row: formatPriceImportRow(await priceImportRowById(rowId)),
    proof_id: existing.batch_id,
    review_state: review?.review_state || null,
    approval_summary: review?.approval_summary || null,
    completed_rows: review?.completed_rows || []
  });
}));

app.post("/api/admin/price-import-rows/:id/create-product", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const rowId = Number.parseInt(request.params.id, 10);
  const row = await priceImportRowById(rowId);

  if (!row) {
    response.status(404).json({ error: "Import row was not found." });
    return;
  }

  if (!row.item_name) {
    response.status(400).json({ error: "Item name is required before creating a product." });
    return;
  }

  const product = validateProduct({
    display_name: row.item_name,
    canonical_name: row.item_name,
    category: row.category,
    default_size_text: row.size_text,
    default_quantity: row.quantity,
    default_unit: row.unit,
    preferred_brand: row.brand,
    common_aliases: row.item_name,
    status: "active",
    admin_note: `Created from price import row ${row.id}.`
  }, { defaultActive: true });
  const now = new Date().toISOString();
  const result = await run(
    `
      INSERT INTO products (
        canonical_name,
        display_name,
        category,
        default_size_text,
        default_quantity,
        default_unit,
        brand_optional,
        preferred_brand,
        common_aliases,
        ingredient_info_url,
        allergen_note,
        admin_safety_note,
        status,
        created_by_admin_id,
        admin_note,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      product.canonical_name,
      product.display_name,
      product.category,
      product.default_size_text,
      product.default_quantity,
      product.default_unit,
      product.brand_optional,
      product.preferred_brand,
      product.common_aliases,
      product.ingredient_info_url,
      product.allergen_note,
      product.admin_safety_note,
      product.status,
      request.adminUser ? request.adminUser.id : null,
      product.admin_note,
      request.adminUser ? request.adminUser.id : null,
      now,
      now
    ]
  );

  await run(
    `
      UPDATE price_import_rows
      SET product_id = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      result.lastID,
      request.adminUser ? request.adminUser.id : null,
      now,
      rowId
    ]
  );

  response.status(201).json({
    message: "Product created and linked to import row.",
    product_id: result.lastID,
    row: formatPriceImportRow(await priceImportRowById(rowId))
  });
}));

app.get("/api/admin/reports", requireAdminAccess, asyncRoute(async (request, response) => {
  await refreshExpiredReports();

  const reports = await all(
    `
      SELECT
        pr.*,
        stores.name AS store_name,
        stores.address AS store_address,
        users.username AS username,
        users.email AS user_email,
        users.is_email_verified AS user_email_verified,
        users.points AS user_points,
        products.display_name AS product_display_name,
        products.status AS product_status,
        products.default_size_text AS product_default_size_text,
        reviewer.username AS reviewed_by_username
      FROM price_reports pr
      JOIN stores ON stores.id = pr.store_id
      JOIN users ON users.id = pr.user_id
      LEFT JOIN products ON products.id = pr.product_id
      LEFT JOIN users reviewer ON reviewer.id = pr.reviewed_by
      ORDER BY pr.submitted_at DESC
    `
  );

  response.json({
    reports: reports.map((report) => {
      const flags = [];

      if (report.dispute_count >= 2 || report.status === "disputed") {
        flags.push("disputed");
      }

      if (report.status === "rejected") {
        flags.push("rejected");
      }

      if (report.price > 500) {
        flags.push("high price");
      }

      if (report.price > 100 && report.proof_type === "no_photo") {
        flags.push("high price without proof");
      }

      return {
        ...formatReport(report),
        user_email: report.user_email,
        user_email_verified: Boolean(report.user_email_verified),
        user_points: report.user_points,
        reviewed_by_username: report.reviewed_by_username || "",
        suspicious_activity: flags
      };
    }),
    database_path: DB_PATH
  });
}));

app.get("/api/admin/notifications", requireAdminAccess, asyncRoute(async (request, response) => {
  await refreshExpiredReports();
  response.json({ notifications: await getAdminNotificationSummary() });
}));

app.post("/api/admin/notifications/:id/read", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const notificationId = Number.parseInt(request.params.id, 10);

  if (!Number.isInteger(notificationId)) {
    response.status(400).json({ error: "Notification id is not valid." });
    return;
  }

  const result = await run(
    `
      UPDATE notifications
      SET is_read = 1,
          read_at = COALESCE(read_at, ?)
      WHERE id = ?
        AND admin_only = 1
    `,
    [new Date().toISOString(), notificationId]
  );

  if (!result.changes) {
    response.status(404).json({ error: "Notification was not found." });
    return;
  }

  response.json({ message: "Admin notification marked read." });
}));

app.get("/api/admin/beta-readiness", requireAdminAccess, asyncRoute(async (request, response) => {
  await refreshExpiredReports();
  response.json(await getBetaReadinessSummary());
}));

app.get("/api/admin/email/status", requireAdminAccess, asyncRoute(async (request, response) => {
  response.json(emailStatus());
}));

app.post("/api/admin/email/test", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const status = emailStatus();
  const recipient = cleanText(request.body.to, 254) || status.adminNotifyEmail;

  if (!recipient) {
    response.status(400).json({
      success: false,
      error: "A test email address is required."
    });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    response.status(400).json({
      success: false,
      error: "A valid test email address is required."
    });
    return;
  }

  if (!status.configured) {
    response.json({
      success: false,
      error: "Email could not be sent. Check SMTP setup in .env or Brevo."
    });
    return;
  }

  const result = await sendTestEmail(recipient);

  if (!result.sent) {
    response.json({
      success: false,
      error: result.error || "Email could not be sent. Check SMTP setup in .env or Brevo.",
      details: result.details || null
    });
    return;
  }

  response.json({
    success: true,
    message: "Test email sent. Check inbox/spam."
  });
}));

app.post("/api/admin/email/diagnostic", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const recipient = cleanText(request.body.to, 254) || emailStatus().adminNotifyEmail;

  if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    response.status(400).json({ error: "A valid diagnostic email address is required." });
    return;
  }

  const result = await runEmailDiagnostic(recipient);
  response.json({ diagnostic: result });
}));

app.get("/api/admin/analytics", requireAdminAccess, asyncRoute(async (request, response) => {
  response.json(await getAdminAnalyticsSummary());
}));

app.post("/api/admin/analytics/missing-demand/priority", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const itemName = cleanText(request.body.item_name, 120);
  const category = cleanText(request.body.category, 30).toLowerCase();
  const status = cleanText(request.body.status || "priority", 40).toLowerCase();
  const allowedStatuses = ["priority", "suggested_quick_item", "manual_price_needed"];

  if (!itemName) {
    response.status(400).json({ error: "Item name is required." });
    return;
  }

  if (category && !CATEGORIES.includes(category)) {
    response.status(400).json({ error: "Category is not valid." });
    return;
  }

  if (!allowedStatuses.includes(status)) {
    response.status(400).json({ error: "Missing demand status is not valid." });
    return;
  }

  const now = new Date().toISOString();
  await run(
    `
      INSERT INTO missing_price_priorities (item_name, category, status, admin_note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_name, category) DO UPDATE SET
        status = excluded.status,
        admin_note = excluded.admin_note,
        updated_at = excluded.updated_at
    `,
    [
      itemName,
      category,
      status,
      cleanText(request.body.admin_note, 500),
      now,
      now
    ]
  );

  response.json({ message: "Missing price demand marked." });
}));

const TERMINAL_REJECTED_PROOF_STATUSES = new Set(["proof_rejected", "rejected", "duplicate"]);
const TERMINAL_COMPLETED_PROOF_STATUSES = new Set(["reviewed_no_prices", "proof_reviewed", "completed"]);
const RESOLVED_REVIEW_ROW_STATUSES = new Set(["approved", "rejected", "removed"]);

function deriveProofReviewState({ batch = {}, job = null, analysis = null, rows = [], counts = null, now = new Date().toISOString() }) {
  const totalRows = counts ? Number(counts.total_rows || 0) : rows.length;
  const unresolvedRows = counts ? Number(counts.unresolved_rows || 0) : rows.filter((row) => !RESOLVED_REVIEW_ROW_STATUSES.has(row.status)).length;
  const approvedRows = counts ? Number(counts.approved_rows || 0) : rows.filter((row) => row.status === "approved").length;
  const rejectedRows = counts ? Number(counts.rejected_rows || 0) : rows.filter((row) => row.status === "rejected").length;
  const activeClaim = Boolean(batch.review_claimed_by && batch.review_claim_expires_at && batch.review_claim_expires_at > now);
  const proofRejected = TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || batch.review_status === "rejected" || batch.review_decision === "rejected";
  const proofCompleted = TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || batch.review_status === "completed";
  const managerHelp = !proofRejected && !proofCompleted && (batch.review_status === "needs_help" || Boolean(batch.review_escalated_at));
  const jobStatus = job?.status || "";
  const analysisCompleted = Boolean(analysis?.id && (analysis.updated_at || job?.completed_at));
  const aiItemCount = analysis ? Number(analysis.item_count || 0) : null;
  let state;
  let label;
  let message;

  if (proofRejected) {
    state = "REJECTED";
    label = "Rejected";
    message = "This proof is closed and was not accepted.";
  } else if (proofCompleted) {
    state = "COMPLETED";
    label = "Completed";
    message = "This proof review is complete.";
  } else if (managerHelp) {
    state = "MANAGER_HELP";
    label = "Manager help";
    message = batch.review_escalation_reason || "A Manager needs to review this proof.";
  } else if (jobStatus === "waiting") {
    state = "AI_QUEUED";
    label = "Waiting for AI";
    message = "Grocery Radar is preparing this proof.";
  } else if (jobStatus === "analyzing") {
    state = "AI_RUNNING";
    label = "AI running";
    message = "AI is analyzing this proof.";
  } else if (totalRows > 0 && unresolvedRows === 0) {
    state = "READY_TO_FINISH";
    label = "Ready to finish";
    message = "All items have been resolved.";
  } else if (totalRows > 0) {
    state = "REVIEWING";
    label = "Ready for review";
    message = `${unresolvedRows} item${unresolvedRows === 1 ? "" : "s"} still need a decision.`;
  } else if (!job && !analysis) {
    state = "AI_NOT_STARTED";
    label = "AI not started";
    message = "No analysis yet.";
  } else if (analysisCompleted && aiItemCount === 0) {
    state = "AI_ZERO_RESULTS";
    label = "No usable items found";
    message = "AI finished, but no usable price items were found.";
  } else if (["ai_failed", "needs_attention"].includes(jobStatus)) {
    state = "AI_FAILED";
    label = "AI needs attention";
    message = job?.last_error || "AI could not analyze this proof.";
  } else if (analysisCompleted) {
    state = "AI_ZERO_RESULTS";
    label = "No usable items found";
    message = "AI finished, but no usable price items were found.";
  } else {
    state = "AI_NOT_STARTED";
    label = "AI not started";
    message = "No analysis yet.";
  }

  const terminal = state === "COMPLETED" || state === "REJECTED";
  const notApprovedRows = Math.max(0, totalRows - approvedRows);
  return {
    state,
    label,
    message,
    total_rows: totalRows,
    unresolved_rows: unresolvedRows,
    resolved_rows: Math.max(0, totalRows - unresolvedRows),
    approved_rows: approvedRows,
    rejected_rows: rejectedRows,
    not_approved_rows: notApprovedRows,
    ai_job_status: jobStatus || "not_started",
    ai_started: Boolean(job || analysis),
    ai_finished: analysisCompleted || Boolean(job?.completed_at),
    ai_produced_rows: totalRows > 0,
    resolved_store_id: analysis?.resolved_store_id || null,
    store_resolved: Boolean(analysis?.resolved_store_id),
    claim_active: activeClaim,
    claimed_by: activeClaim ? batch.review_claimed_by : null,
    claimed_by_username: activeClaim ? batch.review_claimed_by_username || "" : "",
    claim_expires_at: activeClaim ? batch.review_claim_expires_at : "",
    can_finish: state === "READY_TO_FINISH",
    can_manager_resolve: state === "MANAGER_HELP" || state === "AI_ZERO_RESULTS",
    can_review_later: !terminal,
    can_reject: !terminal,
    can_run_ai: ["AI_NOT_STARTED", "AI_FAILED", "AI_ZERO_RESULTS"].includes(state),
    is_terminal: terminal,
    appears_in_active_inbox: !terminal
  };
}

async function adminV2Home(user) {
  const today = localDateFor();
  const todayStart = `${today}T00:00:00.000Z`;
  const [attention, todayCounts, feedback, live, workers, systemError, backup] = await Promise.all([
    get(
      `
        SELECT
          COUNT(CASE WHEN notes LIKE ? AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') AND COALESCE(review_status, '') NOT IN ('completed','rejected') THEN 1 END) AS proofs_waiting,
          COUNT(CASE WHEN review_escalated_at IS NOT NULL AND review_status = 'needs_help' THEN 1 END) AS escalations,
          (SELECT COUNT(*) FROM price_reports WHERE status = 'disputed') AS disputes
        FROM price_import_batches
      `,
      [`${PROOF_SUBMISSION_NOTE_PREFIX}%`]
    ),
    get(
      `
        SELECT
          (SELECT COUNT(*) FROM price_reports WHERE status = 'approved' AND reviewed_at >= ?) AS prices_approved,
          (SELECT COUNT(DISTINCT batch_id) FROM price_import_rows WHERE approved_at >= ?) AS receipts_reviewed,
          (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS new_users,
          (SELECT COUNT(*) FROM price_import_batches WHERE notes LIKE ? AND created_at >= ?) AS receipts_submitted,
          (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'search_performed' AND created_at >= ?) AS searches
      `,
      [todayStart, todayStart, todayStart, `${PROOF_SUBMISSION_NOTE_PREFIX}%`, todayStart, todayStart]
    ),
    get("SELECT COUNT(*) AS count FROM feedback_tickets WHERE status IN ('open','in_review') AND created_at >= ?", [todayStart]),
    liveUsageSummary(),
    get("SELECT COUNT(*) AS count FROM activity_presence WHERE role_category IN ('manager','reviewer','data_entry','owner') AND last_seen_at >= ?", [new Date(Date.now() - ACTIVE_USAGE_WINDOW_MINUTES * 60000).toISOString()]),
    get("SELECT COUNT(*) AS count FROM operations_errors WHERE status = 'open' AND severity IN ('error','critical')"),
    get("SELECT id, status, created_at, storage_path FROM backup_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1")
  ]);
  let databaseReachable = true;
  try { await get("SELECT 1 AS ok"); } catch (error) { databaseReachable = false; }
  const storageAvailable = fs.existsSync(DATA_DIR) && fs.existsSync(UPLOAD_DIR);
  return {
    generated_at: new Date().toISOString(),
    greeting_name: user.username,
    role: staffRoleForUser(user),
    needs_attention: {
      proofs_waiting: attention?.proofs_waiting || 0,
      worker_escalations: attention?.escalations || 0,
      price_disputes: attention?.disputes || 0,
      system_problems: systemError?.count || 0
    },
    today: {
      prices_approved: todayCounts?.prices_approved || 0,
      receipts_reviewed: todayCounts?.receipts_reviewed || 0,
      new_users: todayCounts?.new_users || 0,
      feedback_messages: feedback?.count || 0,
      searches: todayCounts?.searches || 0,
      receipts_submitted: todayCounts?.receipts_submitted || 0
    },
    live,
    team: { workers_active: workers?.count || 0, unfinished_reviews: attention?.proofs_waiting || 0, urgent_problems: attention?.escalations || 0 },
    system: {
      website: "Online",
      database: databaseReachable ? "Reachable" : "Needs attention",
      persistent_storage: storageAvailable ? "Available" : "Needs attention",
      email: emailStatus().configured ? "Configured" : "Not configured",
      backup: backup ? `Last backup ${backup.created_at}` : "No backup recorded"
    }
  };
}

async function activeProofReviewRows(options = {}) {
  const excludeProofId = Number.parseInt(options.excludeProofId, 10);
  const reviewerId = Number.parseInt(options.reviewerId, 10);
  const now = new Date().toISOString();
  const params = [`${PROOF_SUBMISSION_NOTE_PREFIX}%`];
  const exclusionSql = Number.isInteger(excludeProofId) && excludeProofId > 0 ? "AND batches.id != ?" : "";
  if (exclusionSql) params.push(excludeProofId);
  const claimSql = Number.isInteger(reviewerId) && reviewerId > 0
    ? "AND (batches.review_claimed_by IS NULL OR batches.review_claim_expires_at <= ? OR batches.review_claimed_by = ?)"
    : "";
  if (claimSql) params.push(now, reviewerId);
  const aiSql = options.includePreparing === false
    ? "AND COALESCE(jobs.status, '') NOT IN ('waiting','analyzing')"
    : "";
  const managerHelpSql = options.includeManagerHelp === false
    ? "AND COALESCE(batches.review_status, '') != 'needs_help'"
    : "";
  return all(
    `
      SELECT batches.*, creator.username AS created_by_username, reviewer.username AS review_claimed_by_username,
             stores.name AS store_name,
             jobs.id AS ai_job_id, jobs.status AS ai_job_status, jobs.last_error AS ai_last_error,
             jobs.started_at AS ai_started_at, jobs.completed_at AS ai_completed_at,
             analyses.id AS ai_analysis_id, analyses.item_count AS ai_item_count,
             analyses.resolved_store_id AS ai_resolved_store_id, analyses.updated_at AS ai_analysis_updated_at,
             COUNT(rows.id) AS total_row_count,
             SUM(CASE WHEN rows.id IS NOT NULL AND rows.status NOT IN ('approved','rejected','removed') THEN 1 ELSE 0 END) AS unresolved_row_count,
             SUM(CASE WHEN rows.status = 'approved' THEN 1 ELSE 0 END) AS approved_row_count,
             SUM(CASE WHEN rows.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_row_count
      FROM price_import_batches batches
      LEFT JOIN users creator ON creator.id = batches.created_by
      LEFT JOIN users reviewer ON reviewer.id = batches.review_claimed_by
      LEFT JOIN stores ON stores.id = batches.default_store_id
      LEFT JOIN ai_proof_jobs jobs ON jobs.proof_id = batches.id
      LEFT JOIN ai_proof_analyses analyses ON analyses.proof_id = batches.id
      LEFT JOIN price_import_rows rows ON rows.batch_id = batches.id
      WHERE batches.notes LIKE ?
        ${exclusionSql}
        ${claimSql}
        ${aiSql}
        ${managerHelpSql}
        AND batches.status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed')
        AND COALESCE(batches.review_status, '') NOT IN ('completed','rejected')
      GROUP BY batches.id
      ORDER BY
        CASE WHEN batches.review_status = 'needs_help' THEN 1 WHEN batches.review_claimed_by IS NULL OR batches.review_claim_expires_at <= ? THEN 2 ELSE 3 END,
        batches.created_at ASC
      LIMIT 100
    `,
    [...params, now]
  );
}

function lifecycleFromInboxRow(batch) {
  return deriveProofReviewState({
    batch,
    job: batch.ai_job_id ? { id: batch.ai_job_id, status: batch.ai_job_status, last_error: batch.ai_last_error, started_at: batch.ai_started_at, completed_at: batch.ai_completed_at } : null,
    analysis: batch.ai_analysis_id ? { id: batch.ai_analysis_id, item_count: batch.ai_item_count, resolved_store_id: batch.ai_resolved_store_id, updated_at: batch.ai_analysis_updated_at } : null,
    counts: {
      total_rows: batch.total_row_count,
      unresolved_rows: batch.unresolved_row_count,
      approved_rows: batch.approved_row_count,
      rejected_rows: batch.rejected_row_count
    }
  });
}

async function adminV2Inbox(options = {}) {
  const batches = await activeProofReviewRows(options);
  const disputes = await all(
    `${reportSelectWithProduct()} WHERE pr.status = 'disputed' ORDER BY pr.submitted_at ASC LIMIT 50`
  );
  return {
    claim_window_minutes: REVIEW_CLAIM_MINUTES,
    items: [
      ...batches.map((batch) => {
        const lifecycle = lifecycleFromInboxRow(batch);
        return {
        id: `receipt:${batch.id}`,
        target_type: "price_import_batch",
        target_id: batch.id,
        type: lifecycle.state === "MANAGER_HELP" ? "needs_help" : "receipt",
        title: batch.store_name || batch.receipt_store_name || batch.batch_title || `Receipt #${batch.id}`,
        submitted_at: batch.created_at,
        possible_price_count: lifecycle.unresolved_rows,
        status: lifecycle.label,
        review_state: lifecycle.state,
        lifecycle,
        claimed_by: lifecycle.claimed_by,
        claimed_by_username: lifecycle.claimed_by_username,
        claim_expires_at: lifecycle.claim_expires_at,
        escalation_reason: batch.review_escalation_reason || "",
        priority: lifecycle.state === "MANAGER_HELP" ? 1 : 2,
        target_url: `/admin.html?tab=inboxTab&batch=${batch.id}`
      }; }),
      ...disputes.map((report) => ({
        id: `dispute:${report.id}`,
        target_type: "report",
        target_id: report.id,
        type: "dispute",
        title: report.product_display_name || report.item_name,
        subtitle: report.store_name,
        price: report.price,
        submitted_at: report.submitted_at,
        status: "Waiting",
        priority: 3,
        target_url: `/admin.html?tab=pricesTab&filter=disputed&report=${report.id}`
      }))
    ].sort((a, b) => a.priority - b.priority || String(a.submitted_at).localeCompare(String(b.submitted_at)))
  };
}

async function findNextReviewableProof({ reviewerId, role, excludeProofId }) {
  const batches = await activeProofReviewRows({
    excludeProofId,
    reviewerId,
    includePreparing: false,
    includeManagerHelp: ["owner", "manager"].includes(role)
  });
  return batches.find((batch) => lifecycleFromInboxRow(batch).appears_in_active_inbox) || null;
}

async function bulkIntakePayload(batchId) {
  const batch = await get("SELECT bulk.*, stores.name AS submitted_store_name, users.username AS created_by_username FROM bulk_intake_batches bulk LEFT JOIN stores ON stores.id = bulk.submitted_store_id LEFT JOIN users ON users.id = bulk.created_by WHERE bulk.id = ?", [batchId]);
  if (!batch) return null;
  const items = await all(`SELECT items.*, jobs.status AS ai_status, jobs.attempt_count, jobs.model, jobs.last_error, proofs.status AS proof_status, proofs.review_status, (SELECT COUNT(*) FROM price_import_rows rows WHERE rows.batch_id = items.proof_id) AS draft_count FROM bulk_intake_items items LEFT JOIN ai_proof_jobs jobs ON jobs.proof_id = items.proof_id LEFT JOIN price_import_batches proofs ON proofs.id = items.proof_id WHERE items.bulk_batch_id = ? ORDER BY items.id`, [batchId]);
  const attempts = await get(`SELECT COUNT(*) AS attempts, SUM(CASE WHEN attempts.attempt_kind = 'retry' THEN 1 ELSE 0 END) AS retries, SUM(CASE WHEN attempts.status = 'failed' THEN 1 ELSE 0 END) AS failures, SUM(attempts.prompt_tokens) AS prompt_tokens, SUM(attempts.completion_tokens) AS completion_tokens, SUM(attempts.total_tokens) AS total_tokens FROM ai_proof_attempts attempts JOIN price_import_batches proofs ON proofs.id = attempts.proof_id WHERE proofs.bulk_intake_batch_id = ?`, [batchId]);
  const formatted = items.map((item) => {
    let status = item.status;
    if (!["duplicate", "failed", "needs_attention"].includes(status)) {
      if (["completed", "rejected"].includes(item.review_status) || ["used_for_prices", "reviewed_no_prices", "proof_rejected"].includes(item.proof_status)) status = "reviewed";
      else if (["ai_failed", "needs_attention"].includes(item.ai_status)) status = item.ai_status === "ai_failed" ? "failed" : "needs_attention";
      else if (item.ai_status === "analyzing") status = "processing";
      else if (Number(item.draft_count || 0) > 0 || item.ai_status === "ready_for_review") status = "ready";
      else status = "queued";
    }
    return { id: item.id, proof_id: item.proof_id || null, original_name: item.original_name, status, duplicate_of_proof_id: item.duplicate_of_proof_id || null, error: item.error_message || item.last_error || "", draft_count: Number(item.draft_count || 0), ai_attempts: Number(item.attempt_count || 0), model: item.model || "" };
  });
  const counts = formatted.reduce((output, item) => { output[item.status] = (output[item.status] || 0) + 1; return output; }, {});
  return { batch: { id: batch.id, title: batch.title, submitted_store_id: batch.submitted_store_id || null, submitted_store_name: batch.submitted_store_name || "", proof_type: batch.proof_type, source_url: batch.source_url || "", known_valid_from_date: batch.known_valid_from_date || "", known_valid_through_date: batch.known_valid_through_date || "", notes: batch.notes || "", status: batch.paused ? "paused" : "processing", paused: Boolean(batch.paused), file_count: Number(batch.file_count), created_at: batch.created_at, updated_at: batch.updated_at, counts, items: formatted, usage: { attempts: Number(attempts?.attempts || 0), retries: Number(attempts?.retries || 0), failures: Number(attempts?.failures || 0), prompt_tokens: attempts?.prompt_tokens == null ? null : Number(attempts.prompt_tokens), completion_tokens: attempts?.completion_tokens == null ? null : Number(attempts.completion_tokens), total_tokens: attempts?.total_tokens == null ? null : Number(attempts.total_tokens) } } };
}

async function createProofForBulkItem({ bulk, itemId, file, fileHash, processDuplicate = false }) {
  const duplicate = fileHash ? await get("SELECT id FROM price_import_batches WHERE proof_file_hash = ? ORDER BY id LIMIT 1", [fileHash]) : null;
  const now = new Date().toISOString();
  if (duplicate && !processDuplicate) {
    await run("UPDATE bulk_intake_items SET status = 'duplicate', duplicate_of_proof_id = ?, updated_at = ? WHERE id = ?", [duplicate.id, now, itemId]);
    return null;
  }
  const mapping = PUBLIC_PROOF_SUBMISSION_TYPES[bulk.proof_type];
  const store = bulk.submitted_store_id ? await get("SELECT id, name FROM stores WHERE id = ? AND active = 1", [bulk.submitted_store_id]) : null;
  const notes = composeProofSubmissionNotes({ store_id: store?.id || "", store_name: store?.name || "", public_proof_type: bulk.proof_type, notes: bulk.notes || "Bulk staff intake" });
  const proof = await run(`INSERT INTO price_import_batches (source_type, proof_type, photo_path, photo_original_name, photo_mime_type, photo_size_bytes, status, source_url, default_store_id, notes, created_by, proof_file_hash, duplicate_of_batch_id, duplicate_scope, review_priority, proof_quality_flags, bulk_intake_batch_id, known_valid_from_date, known_valid_through_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'needs_admin_review', ?, ?, ?, NULL, ?, ?, ?, 'normal', '', ?, ?, ?, ?, ?)`, [mapping.source_type, mapping.proof_type, uploadedFileUrl(file.filename), sanitizeOriginalFilename(file.originalname), file.mimetype, file.size, bulk.source_url || "", store?.id || null, notes, fileHash, duplicate?.id || null, duplicate ? "staff_process_anyway" : "", bulk.id, bulk.known_valid_from_date || "", bulk.known_valid_through_date || "", now, now]);
  await run("UPDATE bulk_intake_items SET proof_id = ?, status = 'queued', updated_at = ? WHERE id = ?", [proof.lastID, now, itemId]);
  const job = await ensureAiProofJob(proof.lastID);
  if (!job) await run("UPDATE bulk_intake_items SET status = 'needs_attention', error_message = 'AI queue limit reached. Retry this image after capacity is available.', updated_at = ? WHERE id = ?", [new Date().toISOString(), itemId]);
  return proof.lastID;
}

app.post("/api/admin/bulk-price-intake", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), priceImportUpload.array("screenshots", 50), asyncRoute(async (request, response) => {
  const files = request.files || [];
  if (!files.length) { response.status(400).json({ error: "Choose at least one screenshot." }); return; }
  const proofType = cleanProofSubmissionType(request.body.proof_type || "store_page");
  const submittedStoreId = Number.parseInt(request.body.store_id, 10);
  const submittedStore = Number.isInteger(submittedStoreId) ? await get("SELECT id FROM stores WHERE id = ? AND active = 1", [submittedStoreId]) : null;
  const now = new Date().toISOString();
  const result = await run("INSERT INTO bulk_intake_batches (title, submitted_store_id, proof_type, source_url, known_valid_from_date, known_valid_through_date, notes, status, file_count, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)", [cleanText(request.body.title || `Bulk price intake ${localDateFor()}`, 160), submittedStore?.id || null, proofType, cleanText(request.body.source_url, 500), dateInputValue(request.body.known_valid_from_date), dateInputValue(request.body.known_valid_through_date), cleanText(request.body.notes, 500), files.length, request.adminUser.id, now, now]);
  const bulk = await get("SELECT * FROM bulk_intake_batches WHERE id = ?", [result.lastID]);
  for (const file of files) {
    const hash = hashUploadedFile(file);
    const item = await run("INSERT INTO bulk_intake_items (bulk_batch_id, original_name, uploaded_path, file_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)", [bulk.id, sanitizeOriginalFilename(file.originalname), uploadedFileUrl(file.filename), hash, now, now]);
    try {
      await validateDecodedImage(file);
      await createProofForBulkItem({ bulk, itemId: item.lastID, file, fileHash: hash });
    } catch (error) {
      await run("UPDATE bulk_intake_items SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?", [cleanText(error.message || "Image processing failed.", 300), new Date().toISOString(), item.lastID]);
    }
  }
  response.status(201).json({ message: "Bulk upload saved. Processing continues in the background.", ...(await bulkIntakePayload(bulk.id)) });
}));

app.get("/api/admin/bulk-price-intake/:id", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const payload = await bulkIntakePayload(Number.parseInt(request.params.id, 10));
  if (!payload) { response.status(404).json({ error: "Bulk intake batch was not found." }); return; }
  response.json(payload);
}));

app.post("/api/admin/bulk-price-intake/:id/pause", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const paused = request.body.paused !== false;
  const id = Number.parseInt(request.params.id, 10);
  const now = new Date().toISOString();
  const changed = await run("UPDATE bulk_intake_batches SET paused = ?, status = ?, updated_at = ? WHERE id = ?", [paused ? 1 : 0, paused ? "paused" : "processing", now, id]);
  if (!changed.changes) { response.status(404).json({ error: "Bulk intake batch was not found." }); return; }
  if (!paused) {
    const waiting = await all("SELECT proofs.id FROM price_import_batches proofs JOIN ai_proof_jobs jobs ON jobs.proof_id = proofs.id WHERE proofs.bulk_intake_batch_id = ? AND jobs.status = 'waiting'", [id]);
    waiting.forEach((proof) => scheduleAiProofJob(proof.id));
  }
  response.json({ message: paused ? "Batch processing paused after active jobs finish." : "Batch processing resumed.", ...(await bulkIntakePayload(id)) });
}));

app.post("/api/admin/bulk-price-intake/items/:itemId/retry", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const item = await get("SELECT items.*, bulk.paused FROM bulk_intake_items items JOIN bulk_intake_batches bulk ON bulk.id = items.bulk_batch_id WHERE items.id = ?", [Number.parseInt(request.params.itemId, 10)]);
  if (!item) { response.status(404).json({ error: "Batch image was not found." }); return; }
  if (item.paused) { response.status(409).json({ error: "Resume the batch before retrying this image." }); return; }
  if (!item.proof_id) { response.status(409).json({ error: "Upload a valid replacement image; this file could not be decoded." }); return; }
  const job = await ensureAiProofJob(item.proof_id, { force: true });
  if (!job) { response.status(429).json({ error: "AI queue limit reached. Retry this image after capacity is available." }); return; }
  await run("UPDATE bulk_intake_items SET status = 'queued', error_message = NULL, updated_at = ? WHERE id = ?", [new Date().toISOString(), item.id]);
  response.status(202).json({ message: "Only this failed image was queued again." });
}));

app.post("/api/admin/bulk-price-intake/items/:itemId/process-anyway", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const item = await get("SELECT items.*, bulk.proof_type, bulk.submitted_store_id, bulk.source_url, bulk.known_valid_from_date, bulk.known_valid_through_date, bulk.notes FROM bulk_intake_items items JOIN bulk_intake_batches bulk ON bulk.id = items.bulk_batch_id WHERE items.id = ?", [Number.parseInt(request.params.itemId, 10)]);
  if (!item || item.status !== "duplicate") { response.status(409).json({ error: "An exact duplicate batch image was not found." }); return; }
  const fullPath = uploadPathFromPhotoPath(item.uploaded_path);
  if (!fullPath) { response.status(409).json({ error: "The retained duplicate file is unavailable." }); return; }
  const file = { path: fullPath, filename: path.basename(fullPath), originalname: item.original_name, mimetype: ALLOWED_IMAGE_UPLOADS[path.extname(fullPath).toLowerCase()] || "image/jpeg", size: fs.statSync(fullPath).size };
  await createProofForBulkItem({ bulk: { ...item, id: item.bulk_batch_id }, itemId: item.id, file, fileHash: item.file_hash, processDuplicate: true });
  response.status(202).json({ message: "Duplicate retained and explicitly queued for processing.", ...(await bulkIntakePayload(item.bulk_batch_id)) });
}));

app.get("/api/admin/v2/home", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  response.json(await adminV2Home(request.adminUser));
}));

app.get("/api/admin/v2/inbox", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  response.json(await adminV2Inbox());
}));

app.get("/api/admin/v2/reviews/next", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const excludeProofId = Number.parseInt(request.query.exclude_proof_id, 10);
  const role = staffRoleForUser(request.adminUser);
  const candidate = await findNextReviewableProof({ reviewerId: request.adminUser.id, role, excludeProofId });
  response.json({
    proof_id: candidate?.id || null,
    excluded_proof_id: Number.isInteger(excludeProofId) ? excludeProofId : null,
    review_state: candidate ? lifecycleFromInboxRow(candidate) : null,
    message: candidate ? "Next proof found." : "No more proofs waiting."
  });
}));

app.get("/api/admin/v2/feedback", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const rows = await all("SELECT id, category, title, status, priority, created_at, updated_at FROM feedback_tickets ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, updated_at DESC LIMIT 100");
  response.json({ feedback: rows });
}));

app.get("/api/admin/v2/announcements", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const rows = await all("SELECT id, announcement_type, title, body AS message, status, published_at, updated_at FROM announcements ORDER BY updated_at DESC LIMIT 50");
  response.json({ announcements: rows });
}));

app.get("/api/admin/v2/release-notes", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const rows = await all("SELECT * FROM homepage_patch_notes ORDER BY COALESCE(release_date, published_at, updated_at) DESC, id DESC LIMIT 100");
  response.json({ application_version: APP_VERSION, releases: rows.map((row) => formatHomepagePatchNote(row, true)) });
}));

async function reviewSnapshotForBatchId(batchId, user = null) {
  const batch = await priceImportBatchById(batchId);
  if (!batch || !isProofSubmissionBatch(batch)) return null;
  const rows = await addReviewHintsToImportRows(await priceImportRowsForBatchIds([batchId]));
  const formattedRows = rows.map(formatPriceImportRow);
  const ai = await aiStateForProof(batchId);
  const unresolvedRows = formattedRows.filter((row) => !["approved", "rejected", "removed"].includes(row.status));
  const readyRows = unresolvedRows.filter((row) => row.status === "ready_for_review" && row.ai_confidence === "high");
  const approvableRows = readyRows.filter((row) => ai.analysis?.resolved_store_id && row.store_id && row.item_name && Number(row.price) > 0 && row.unit && !(row.ai_warnings || []).length && !row.duplicate_warning && promotionGate(row).ready);
  const lifecycle = deriveProofReviewState({ batch, job: ai.job, analysis: ai.analysis, rows: formattedRows });
  return {
    batch: formatPriceImportBatch(batch, unresolvedRows),
    completed_rows: formattedRows.filter((row) => ["approved", "rejected", "removed"].includes(row.status)),
    ai,
    stores: await all("SELECT id, name FROM stores WHERE active = 1 ORDER BY name"),
    approval_summary: { ready: readyRows.length, flagged: unresolvedRows.length - readyRows.length, approvable_ready: approvableRows.length, unresolved: unresolvedRows.length },
    review_state: lifecycle,
    review_lifecycle: lifecycle,
    proof_url: batch.photo_path ? `/api/admin/uploads/${encodeURIComponent(path.basename(batch.photo_path))}` : "",
    can_review: user ? staffCan(user, "review") : false,
    can_approve: user ? staffCan(user, "approve") : false,
    can_manage: user ? staffCan(user, "manage") : false,
    can_manage_images: user ? staffCan(user, "manage") : false,
    focus_mode_available: true
  };
}

app.get("/api/admin/v2/reviews/:batchId", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const snapshot = await reviewSnapshotForBatchId(batchId, request.adminUser);
  if (!snapshot) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  response.json(snapshot);
}));

app.post("/api/admin/v2/reviews/:batchId/re-run-ai", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch || !batch.photo_path) {
    response.status(404).json({ error: "An eligible proof image was not found." });
    return;
  }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) {
    response.status(409).json({ error: "This proof is already closed." });
    return;
  }
  const settings = await aiProcessingSettings();
  if (!settings.enabled) {
    response.status(409).json({ error: "AI processing is disabled. Paste from ChatGPT or enter items manually." });
    return;
  }
  const job = await get("SELECT * FROM ai_proof_jobs WHERE proof_id = ?", [batchId]);
  if (job?.status === "analyzing") {
    response.status(409).json({ error: "This proof is already being analyzed." });
    return;
  }
  if (Number(job?.attempt_count || 0) >= 1 + settings.retry_limit) {
    response.status(429).json({ error: "AI retry limit reached. Use manual fallback or change the Owner limit before retrying." });
    return;
  }
  const queuedJob = await ensureAiProofJob(batchId, { force: true });
  if (!queuedJob) { response.status(429).json({ error: "AI queue limit reached. Retry after capacity is available." }); return; }
  await recordPriceEvent({ batchId, eventType: job ? "AI_RETRY_REQUESTED" : "AI_MANUAL_REQUESTED", actorUserId: request.adminUser.id, submitterUserId: batch.created_by, reason: cleanText(request.body.reason || (job ? "Staff requested AI re-run." : "Staff requested AI analysis."), 300) });
  response.status(202).json({ message: job ? "AI analysis queued again." : "AI analysis queued.", ai: await aiStateForProof(batchId) });
}));

app.post("/api/admin/v2/reviews/:batchId/store-resolution", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const analysis = await get("SELECT * FROM ai_proof_analyses WHERE proof_id = ?", [batchId]);
  const batch = await priceImportBatchById(batchId);
  if (!analysis || !batch) { response.status(404).json({ error: "AI store analysis was not found for this proof." }); return; }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) { response.status(409).json({ error: "This proof is already closed." }); return; }
  const action = cleanEnum(request.body.action, ["use_ai", "keep_submitted", "choose_store", "not_sure"], "not_sure");
  const requestedStoreId = Number.parseInt(request.body.store_id, 10);
  if (action === "choose_store" && !Number.isInteger(requestedStoreId)) { response.status(400).json({ error: "Choose an active Grocery Radar store." }); return; }
  const requestedResolutionId = action === "use_ai" ? analysis.detected_store_id : action === "keep_submitted" ? analysis.submitted_store_id : action === "choose_store" ? requestedStoreId : null;
  const resolvedStore = requestedResolutionId ? await get("SELECT id, name, city, state FROM stores WHERE id = ? AND active = 1", [requestedResolutionId]) : null;
  const resolvedStoreId = resolvedStore?.id || null;
  if (action !== "not_sure" && !resolvedStoreId) { response.status(400).json({ error: "The selected active store is unavailable." }); return; }
  const now = new Date().toISOString();
  const savedAnalysis = await run("UPDATE ai_proof_analyses SET resolved_store_id = ?, store_resolution = ?, updated_at = ? WHERE proof_id = ?", [resolvedStoreId, action, now, batchId]);
  if (!savedAnalysis.changes) { console.error("Store resolution did not update an analysis", { batchId, action, requestedStoreId }); response.status(500).json({ error: "Could not save store. Please try again." }); return; }
  let inheritedRowCount = 0;
  if (resolvedStoreId) {
    const inherited = await run("UPDATE price_import_rows SET store_id = ?, updated_by = ?, updated_at = ? WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [resolvedStoreId, request.adminUser.id, now, batchId]);
    inheritedRowCount = inherited.changes || 0;
    await run("UPDATE price_import_batches SET review_status = CASE WHEN review_status = 'needs_help' THEN 'in_review' ELSE review_status END, review_escalated_at = NULL, review_escalation_reason = '', updated_at = ? WHERE id = ?", [now, batchId]);
  }
  if (action === "not_sure") await run("UPDATE price_import_batches SET review_status = 'needs_help', review_escalated_at = ?, review_escalation_reason = 'Store could not be resolved', updated_at = ? WHERE id = ?", [now, now, batchId]);
  await recordPriceEvent({ batchId, eventType: "STORE_RESOLVED", actorUserId: request.adminUser.id, submitterUserId: batch.created_by, reason: action, metadata: { submitted_store_id: analysis.submitted_store_id, detected_store_id: analysis.detected_store_id, resolved_store_id: resolvedStoreId } });
  const persisted = await get("SELECT submitted_store_id, detected_store_id, resolved_store_id, store_resolution FROM ai_proof_analyses WHERE proof_id = ?", [batchId]);
  const review = await reviewSnapshotForBatchId(batchId, request.adminUser);
  response.json({
    message: action === "not_sure" ? "Store left unresolved and sent for Manager help." : `Store resolved to ${resolvedStore.name}.`,
    resolved_store: resolvedStore ? { id: resolvedStore.id, name: resolvedStore.name, city: resolvedStore.city || "", state: resolvedStore.state || "" } : null,
    submitted_store_id: persisted.submitted_store_id || null,
    inherited_row_count: inheritedRowCount,
    ai: review?.ai || await aiStateForProof(batchId),
    review_state: review?.review_state || null,
    approval_summary: review?.approval_summary || null
  });
}));

app.post("/api/admin/v2/reviews/:batchId/approve-ready", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("approve"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const [batch, analysis, rows, activeStores] = await Promise.all([
    priceImportBatchById(batchId),
    get("SELECT * FROM ai_proof_analyses WHERE proof_id = ?", [batchId]),
    priceImportRowsForBatchIds([batchId]),
    getActiveStoreIds()
  ]);
  if (!batch) { response.status(404).json({ error: "Proof review was not found." }); return; }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) { response.status(409).json({ error: "This proof is already closed." }); return; }
  if (!analysis?.resolved_store_id) { response.status(409).json({ error: "Resolve the exact price store before approving ready items." }); return; }
  const eligible = rows.filter((row) => row.status === "ready_for_review" && row.ai_confidence === "high" && row.item_name && Number(row.price) > 0 && row.unit && activeStores.includes(Number(row.store_id)) && !row.duplicate_warning && !parseMetadataJson(row.ai_warnings_json).length && promotionGate(row).ready);
  if (!eligible.length) { response.status(400).json({ error: "No high-confidence items currently meet every publication requirement." }); return; }
  const results = [];
  for (const row of eligible) {
    results.push(await approvePriceImportRow(row.id, request.adminUser, { ownerSelfApprovalOverride: request.body.owner_self_approval_override === true, overrideReason: request.body.override_reason }));
  }
  const review = await reviewSnapshotForBatchId(batchId, request.adminUser);
  response.json({ message: `${results.length} ready item${results.length === 1 ? "" : "s"} approved. Flagged items were left unresolved.`, proof_id: batchId, approved_count: results.length, approved_row_ids: results.map((result) => result.row.id), results, review_state: review?.review_state || null, approval_summary: review?.approval_summary || null, completed_rows: review?.completed_rows || [] });
}));

async function finalizeRejectedProofDisposition({ batch, reviewer, status = "proof_rejected", decision = "rejected", reason, publicExplanation = "", note = "" }) {
  const batchId = batch.id;
  const now = new Date().toISOString();
  const unresolved = await all("SELECT id FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [batchId]);
  await run("UPDATE price_import_rows SET status = 'rejected', rejection_reason = ?, public_rejection_reason = ?, public_reviewer_explanation = ?, admin_rejection_note = ?, rejected_by = ?, rejected_at = ?, updated_by = ?, updated_at = ? WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [reason, reason, publicExplanation, note, reviewer.id, now, reviewer.id, now, batchId]);
  await run("UPDATE price_import_batches SET status = ?, review_status = ?, review_decision = ?, review_completed_at = ?, rejected_item_count = (SELECT COUNT(*) FROM price_import_rows WHERE batch_id = ? AND status = 'rejected'), review_claimed_by = NULL, review_claimed_at = NULL, review_claim_expires_at = NULL, notes = COALESCE(notes, '') || ?, updated_at = ? WHERE id = ?", [status, status === "duplicate" ? "completed" : "rejected", decision, now, batchId, `\nProof ${decision}: ${reason}${note ? ` — ${note}` : ""}`, now, batchId]);
  for (const row of unresolved) await recordPriceEvent({ batchId, rowId: row.id, eventType: decision === "duplicate" ? "DUPLICATE" : "REJECTED", actorUserId: reviewer.id, submitterUserId: batch.created_by, reason, metadata: { reviewer_note: note, proof_level_decision: true } });
  await recordPriceEvent({ batchId, eventType: decision === "duplicate" ? "DUPLICATE" : "REJECTED", actorUserId: reviewer.id, submitterUserId: batch.created_by, reason, metadata: { reviewer_note: note, proof_level_decision: true, rejected_draft_count: unresolved.length, duplicate_of_batch_id: batch.duplicate_of_batch_id || null, proof_file_hash_retained: Boolean(batch.proof_file_hash) } });
  await run("INSERT INTO review_task_events (batch_id, worker_user_id, event_type, reason, created_at) VALUES (?, ?, ?, ?, ?)", [batchId, reviewer.id, decision === "duplicate" ? "duplicate" : "rejected", reason, now]);
  await run("UPDATE ai_proof_jobs SET status = 'human_complete', updated_at = ? WHERE proof_id = ?", [now, batchId]);
  const outcome = await ensureSubmissionOutcome(batchId, reviewer.id, { outcomeType: "proof_rejected", publicReason: reason, publicExplanation, finalizedAt: now });
  return { now, unresolved, outcome, review: await reviewSnapshotForBatchId(batchId, reviewer) };
}

async function finalizeNoUsablePrices({ batch, reviewer, publicExplanation = "" }) {
  const batchId = batch.id;
  const approved = await get("SELECT COUNT(*) AS count FROM price_import_rows WHERE batch_id = ? AND status = 'approved'", [batchId]);
  if (Number(approved?.count || 0)) {
    const error = new Error("This proof already has approved prices. Resolve remaining rows and use Done Reviewing instead.");
    error.statusCode = 409;
    throw error;
  }
  const now = new Date().toISOString();
  const unresolved = await all("SELECT id FROM price_import_rows WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [batchId]);
  await run("UPDATE price_import_rows SET status = 'removed', updated_by = ?, updated_at = ? WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [reviewer.id, now, batchId]);
  await run("UPDATE price_import_batches SET status = 'reviewed_no_prices', review_status = 'completed', review_decision = 'completed_no_usable_prices', review_completed_at = ?, review_claimed_by = NULL, review_claimed_at = NULL, review_claim_expires_at = NULL, updated_at = ? WHERE id = ?", [now, now, batchId]);
  for (const row of unresolved) await recordPriceEvent({ batchId, rowId: row.id, eventType: "REMOVED", actorUserId: reviewer.id, submitterUserId: batch.created_by, reason: "Manager confirmed no usable prices in the proof.", metadata: { proof_level_decision: true } });
  await recordPriceEvent({ batchId, eventType: "REVIEW_COMPLETED", actorUserId: reviewer.id, submitterUserId: batch.created_by, reason: "Manager confirmed no usable prices.", metadata: { total_rows: unresolved.length, approved_rows: 0, disposition: "no_usable_prices" } });
  await run("INSERT INTO review_task_events (batch_id, worker_user_id, event_type, reason, created_at) VALUES (?, ?, 'completed', 'No usable prices confirmed', ?)", [batchId, reviewer.id, now]);
  await run("UPDATE ai_proof_jobs SET status = 'human_complete', completed_at = COALESCE(completed_at, ?), updated_at = ? WHERE proof_id = ?", [now, now, batchId]);
  const outcome = await ensureSubmissionOutcome(batchId, reviewer.id, { outcomeType: "reviewed_no_prices", publicReason: "No usable prices were found.", publicExplanation, finalizedAt: now });
  return { now, unresolved, outcome, review: await reviewSnapshotForBatchId(batchId, reviewer) };
}

app.post("/api/admin/v2/reviews/:batchId/complete", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch || !isProofSubmissionBatch(batch)) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  if (TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || batch.review_status === "completed") {
    const outcome = await ensureSubmissionOutcome(batchId, batch.review_claimed_by || request.adminUser.id);
    response.json({ message: "Review was already complete.", batch_id: batchId, state: "COMPLETED", outcome_created: Boolean(outcome) }); return;
  }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || batch.review_status === "rejected") { response.status(409).json({ error: "This proof is already rejected." }); return; }
  if ((!batch.review_claimed_by || batch.review_claim_expires_at <= new Date().toISOString() || Number(batch.review_claimed_by) !== Number(request.adminUser.id)) && !staffCan(request.adminUser, "manage")) {
    response.status(403).json({ error: batch.review_claimed_by ? `Currently being reviewed by ${batch.review_claimed_by_username || "another worker"}.` : "Claim this proof before finishing its review." });
    return;
  }
  const before = await reviewSnapshotForBatchId(batchId, request.adminUser);
  if (before?.review_state?.state !== "READY_TO_FINISH") { response.status(409).json({ error: `Cannot finish this proof while it is ${String(before?.review_state?.label || "not ready").toLowerCase()}.` }); return; }
  const counts = { total: before.review_state.total_rows, approved: before.review_state.approved_rows };
  const now = new Date().toISOString();
  const finalStatus = Number(counts.approved || 0) > 0 ? "used_for_prices" : "reviewed_no_prices";
  await run("UPDATE price_import_batches SET status = ?, review_status = 'completed', review_decision = 'completed', review_completed_at = ?, review_claimed_by = NULL, review_claimed_at = NULL, review_claim_expires_at = NULL, updated_at = ? WHERE id = ?", [finalStatus, now, now, batchId]);
  await run("INSERT INTO review_task_events (batch_id, worker_user_id, event_type, reason, created_at) VALUES (?, ?, 'completed', 'All discovered rows resolved', ?)", [batchId, request.adminUser.id, now]);
  await recordPriceEvent({ batchId, eventType: "REVIEW_COMPLETED", actorUserId: request.adminUser.id, submitterUserId: batch.created_by, reason: "All discovered rows resolved.", metadata: { total_rows: Number(counts.total), approved_rows: Number(counts.approved || 0) } });
  const outcome = await ensureSubmissionOutcome(batchId, request.adminUser.id, { finalizedAt: now });
  const review = await reviewSnapshotForBatchId(batchId, request.adminUser);
  response.json({ message: "Review complete.", batch_id: batchId, state: "COMPLETED", status: finalStatus, outcome_created: Boolean(outcome), review_state: review?.review_state || null });
}));

app.post("/api/admin/v2/reviews/:batchId/reject", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch || !isProofSubmissionBatch(batch)) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) { response.status(409).json({ error: "This proof is already closed." }); return; }
  if ((!batch.review_claimed_by || batch.review_claim_expires_at <= new Date().toISOString() || Number(batch.review_claimed_by) !== Number(request.adminUser.id)) && !staffCan(request.adminUser, "manage")) {
    response.status(403).json({ error: "Only the current reviewer or a Manager can reject this proof." });
    return;
  }
  const reason = normalizeReviewRejectionReason(request.body.reason);
  if (!REVIEW_PROOF_REJECTION_REASONS.includes(reason)) { response.status(400).json({ error: "Choose a valid proof rejection reason." }); return; }
  const note = cleanText(request.body.note || "", 500);
  const publicExplanation = cleanText(request.body.public_explanation || "", 300);
  const finalized = await finalizeRejectedProofDisposition({ batch, reviewer: request.adminUser, reason, publicExplanation, note });
  response.json({ message: "Proof rejected and removed from the review queue.", proof_id: batchId, rejected_row_count: finalized.unresolved.length, outcome_created: Boolean(finalized.outcome), review_state: finalized.review?.review_state || null });
}));

app.post("/api/admin/v2/reviews/:batchId/manager-decision", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch || !isProofSubmissionBatch(batch)) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  const decision = cleanText(request.body.decision, 50).toLowerCase();
  if (batch.status === "duplicate" && decision === "duplicate") {
    const outcome = await ensureSubmissionOutcome(batchId, request.adminUser.id, { outcomeType: "proof_rejected", publicReason: "duplicate submission", publicExplanation: "This proof was already submitted." });
    response.json({ message: "Proof was already marked duplicate.", proof_id: batchId, terminal: true, outcome_created: Boolean(outcome) });
    return;
  }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) {
    response.status(409).json({ error: "This proof is already closed." });
    return;
  }
  if (decision === "return_to_review") {
    const now = new Date().toISOString();
    await run("UPDATE price_import_batches SET review_status = CASE WHEN review_decision = 'ready_to_finish' THEN 'ready_to_finish' ELSE 'in_review' END, review_decision = CASE WHEN review_decision = 'ready_to_finish' THEN review_decision ELSE '' END, review_escalated_at = NULL, review_escalation_reason = '', updated_at = ? WHERE id = ?", [now, batchId]);
    await run("INSERT INTO review_task_events (batch_id, worker_user_id, event_type, reason, created_at) VALUES (?, ?, 'manager_returned', 'Manager returned proof to normal review', ?)", [batchId, request.adminUser.id, now]);
    await recordPriceEvent({ batchId, eventType: "MANAGER_RETURNED_TO_REVIEW", actorUserId: request.adminUser.id, submitterUserId: batch.created_by, reason: "Manager cleared the escalation and returned the proof to normal review." });
    const review = await reviewSnapshotForBatchId(batchId, request.adminUser);
    response.json({ message: "Manager help cleared. Continue normal review.", proof_id: batchId, terminal: false, review_state: review?.review_state || null, approval_summary: review?.approval_summary || null, completed_rows: review?.completed_rows || [] });
    return;
  }
  if (decision === "no_usable_prices") {
    const finalized = await finalizeNoUsablePrices({ batch, reviewer: request.adminUser, publicExplanation: cleanText(request.body.public_explanation, 300) });
    response.json({ message: "Review closed with no usable prices.", proof_id: batchId, terminal: true, removed_row_count: finalized.unresolved.length, outcome_created: Boolean(finalized.outcome), review_state: finalized.review?.review_state || null });
    return;
  }
  const dispositions = {
    duplicate: { status: "duplicate", reviewDecision: "duplicate", reason: "duplicate submission", explanation: "This proof was already submitted." },
    cant_verify: { reason: "price not actually shown", explanation: "The proof did not provide enough verifiable price evidence." },
    cant_read: { reason: "proof too blurry", explanation: "The proof could not be read clearly enough to verify prices." },
    wrong_store_unusable: { reason: "store could not be verified", explanation: "The store shown in the proof could not be verified." },
    reject: { reason: "other", explanation: "The proof could not be approved." },
    other: { reason: normalizeReviewRejectionReason(request.body.reason || "other"), explanation: cleanText(request.body.public_explanation, 300) || "The proof could not be approved." }
  };
  const disposition = dispositions[decision];
  if (!disposition || !REVIEW_PROOF_REJECTION_REASONS.includes(disposition.reason)) {
    response.status(400).json({ error: "Choose a valid final manager disposition." });
    return;
  }
  const finalized = await finalizeRejectedProofDisposition({ batch, reviewer: request.adminUser, status: disposition.status || "proof_rejected", decision: disposition.reviewDecision || "rejected", reason: disposition.reason, publicExplanation: disposition.explanation, note: cleanText(request.body.note, 500) });
  response.json({ message: decision === "duplicate" ? "Marked duplicate ✓" : "Manager decision saved and proof closed.", proof_id: batchId, terminal: true, rejected_row_count: finalized.unresolved.length, outcome_created: Boolean(finalized.outcome), review_state: finalized.review?.review_state || null });
}));

app.get("/api/admin/operations/ai-settings", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json({ settings: await aiProcessingSettings() });
}));

app.post("/api/admin/operations/ai-settings", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const current = await aiProcessingSettings();
  const enabled = request.body.enabled === true;
  const manualOnly = request.body.manual_only !== false;
  const hourly = Math.min(200, Math.max(1, Number.parseInt(request.body.max_analyses_per_hour || current.max_analyses_per_hour, 10)));
  const daily = Math.min(2000, Math.max(hourly, Number.parseInt(request.body.max_analyses_per_day || current.max_analyses_per_day, 10)));
  const retries = Math.min(5, Math.max(0, Number.parseInt(request.body.retry_limit ?? current.retry_limit, 10)));
  const maxConcurrency = Math.min(10, Math.max(1, Number.parseInt(request.body.max_concurrency ?? current.max_concurrency, 10)));
  const maxQueuedJobs = Math.min(2000, Math.max(10, Number.parseInt(request.body.max_queued_jobs ?? current.max_queued_jobs, 10)));
  const primaryModel = cleanText(request.body.primary_model || request.body.model || current.primary_model, 100);
  const fallbackModel = cleanText(request.body.fallback_model ?? current.fallback_model, 100);
  const now = new Date().toISOString();
  await run("UPDATE ai_processing_settings SET enabled = ?, manual_only = ?, max_analyses_per_hour = ?, max_analyses_per_day = ?, retry_limit = ?, max_concurrency = ?, max_queued_jobs = ?, model = ?, primary_model = ?, fallback_model = ?, updated_by = ?, updated_at = ? WHERE id = 1", [enabled ? 1 : 0, manualOnly ? 1 : 0, hourly, daily, retries, maxConcurrency, maxQueuedJobs, primaryModel, primaryModel, fallbackModel, request.adminUser.id, now]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: "AI_SETTINGS_UPDATED", affectedType: "ai_processing_settings", affectedId: 1, metadata: { enabled, manual_only: manualOnly, hourly, daily, retries, max_concurrency: maxConcurrency, max_queued_jobs: maxQueuedJobs, primary_model: primaryModel, fallback_model: fallbackModel } });
  response.json({ message: "AI processing controls saved.", settings: await aiProcessingSettings() });
}));

app.post("/api/admin/v2/reviews/:batchId/claim", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + REVIEW_CLAIM_MINUTES * 60000).toISOString();
  const result = await run(
    `
      UPDATE price_import_batches
      SET review_claimed_by = ?, review_claimed_at = ?, review_claim_expires_at = ?, review_status = CASE WHEN review_decision = 'ready_to_finish' THEN 'ready_to_finish' ELSE 'in_review' END, updated_at = ?
      WHERE id = ? AND notes LIKE ?
        AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed')
        AND COALESCE(review_status, '') NOT IN ('completed','rejected')
        AND (review_claimed_by IS NULL OR review_claim_expires_at <= ? OR review_claimed_by = ?)
    `,
    [request.adminUser.id, nowIso, expiresAt, nowIso, batchId, `${PROOF_SUBMISSION_NOTE_PREFIX}%`, nowIso, request.adminUser.id]
  );
  if (!result.changes) {
    const current = await priceImportBatchById(batchId);
    response.status(409).json({
      error: current?.review_claimed_by_username
        ? `Currently being reviewed by ${current.review_claimed_by_username}.`
        : "This receipt is already being reviewed.",
      claimed_by: current?.review_claimed_by || null,
      claimed_by_username: current?.review_claimed_by_username || "",
      claim_expires_at: current?.review_claim_expires_at || ""
    });
    return;
  }
  await run(
    "INSERT INTO review_task_events (batch_id, worker_user_id, event_type, created_at) VALUES (?, ?, 'claimed', ?)",
    [batchId, request.adminUser.id, nowIso]
  );
  const review = await reviewSnapshotForBatchId(batchId, request.adminUser);
  response.json({ message: "Receipt claimed for review.", batch: formatPriceImportBatch(await priceImportBatchById(batchId), []), review_state: review?.review_state || null });
}));

async function handleReviewRelease(request, response) {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch) {
    response.status(404).json({ error: "Receipt review was not found." });
    return;
  }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) {
    response.status(409).json({ error: "A completed or rejected proof cannot be returned to the review queue." });
    return;
  }
  if (Number(batch.review_claimed_by) !== Number(request.adminUser.id) && !staffCan(request.adminUser, "manage")) {
    response.status(403).json({ error: "Only the current reviewer or a Manager can release this review." });
    return;
  }
  const now = new Date().toISOString();
  await run(
    "UPDATE price_import_batches SET review_claimed_by = NULL, review_claimed_at = NULL, review_claim_expires_at = NULL, review_status = CASE WHEN review_decision = 'ready_to_finish' THEN 'ready_to_finish' WHEN review_escalated_at IS NULL THEN 'waiting' ELSE 'needs_help' END, updated_at = ? WHERE id = ?",
    [now, batchId]
  );
  await run("INSERT INTO review_task_events (batch_id, worker_user_id, event_type, created_at) VALUES (?, ?, 'released', ?)", [batchId, request.adminUser.id, now]);
  const review = await reviewSnapshotForBatchId(batchId, request.adminUser);
  response.json({ message: "Review saved for later and claim released.", proof_id: batchId, review_state: review?.review_state || null });
}

app.post("/api/admin/v2/reviews/:batchId/release", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(handleReviewRelease));
app.post("/api/admin/v2/reviews/:batchId/review-later", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(handleReviewRelease));

app.post("/api/admin/v2/reviews/:batchId/reassign", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch || !isProofSubmissionBatch(batch)) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) {
    response.status(409).json({ error: "A completed or rejected proof cannot be reassigned." });
    return;
  }
  const workerId = Number.parseInt(request.body.user_id, 10);
  const worker = await get("SELECT * FROM users WHERE id = ?", [workerId]);
  if (!worker || !staffCan(worker, "review")) {
    response.status(400).json({ error: "Choose a Manager, Reviewer, or Data Entry worker." });
    return;
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REVIEW_CLAIM_MINUTES * 60000).toISOString();
  const result = await run(
    "UPDATE price_import_batches SET review_claimed_by = ?, review_claimed_at = ?, review_claim_expires_at = ?, review_status = 'in_review', updated_at = ? WHERE id = ? AND notes LIKE ? AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') AND COALESCE(review_status, '') NOT IN ('completed','rejected')",
    [workerId, now.toISOString(), expiresAt, now.toISOString(), batchId, `${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );
  if (!result.changes) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  await run("INSERT INTO review_task_events (batch_id, worker_user_id, event_type, reason, created_at) VALUES (?, ?, 'reassigned', ?, ?)", [batchId, request.adminUser.id, `Assigned to user #${workerId}`, now.toISOString()]);
  response.json({ message: `Review assigned to ${worker.username}.` });
}));

app.post("/api/admin/v2/reviews/:batchId/escalate", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("review"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.batchId, 10);
  const batch = await priceImportBatchById(batchId);
  if (!batch || !isProofSubmissionBatch(batch)) { response.status(404).json({ error: "Receipt review was not found." }); return; }
  if (TERMINAL_REJECTED_PROOF_STATUSES.has(batch.status) || TERMINAL_COMPLETED_PROOF_STATUSES.has(batch.status) || ["completed", "rejected"].includes(batch.review_status)) {
    response.status(409).json({ error: "A completed or rejected proof cannot be escalated." });
    return;
  }
  const reason = cleanText(request.body.reason, 500);
  if (!reason) {
    response.status(400).json({ error: "Explain what help is needed." });
    return;
  }
  const now = new Date().toISOString();
  const result = await run(
    "UPDATE price_import_batches SET review_status = 'needs_help', review_escalated_at = ?, review_escalation_reason = ?, review_claimed_by = NULL, review_claimed_at = NULL, review_claim_expires_at = NULL, updated_at = ? WHERE id = ? AND notes LIKE ? AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') AND COALESCE(review_status, '') NOT IN ('completed','rejected')",
    [now, reason, now, batchId, `${PROOF_SUBMISSION_NOTE_PREFIX}%`]
  );
  if (!result.changes) {
    response.status(404).json({ error: "Receipt review was not found." });
    return;
  }
  await run(
    "INSERT INTO review_task_events (batch_id, worker_user_id, event_type, reason, created_at) VALUES (?, ?, 'escalated', ?, ?)",
    [batchId, request.adminUser.id, reason, now]
  );
  await createAdminNotification("worker_needs_help", "Worker needs help", `Receipt #${batchId}: ${reason}`, {
    related_type: "price_import_batch", related_id: batchId, related_import_batch_id: batchId,
    target_tab: "inboxTab", target_url: `/admin.html?tab=inboxTab&batch=${batchId}`
  });
  response.json({ message: "A Manager has been asked to help." });
}));

app.get("/api/admin/v2/workers", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("workers"), asyncRoute(async (request, response) => {
  const rows = await all(
    `
      SELECT users.id, users.username, users.email, users.staff_role, users.is_admin, users.is_super_admin,
             presence.last_seen_at, shifts.id AS shift_id, shifts.status AS shift_status, shifts.clocked_in_at,
             batches.id AS current_batch_id,
             (SELECT COUNT(*) FROM price_import_rows rows WHERE rows.approved_by = users.id AND rows.approved_at >= ?) AS reviews_today
      FROM users
      LEFT JOIN activity_presence presence ON presence.user_id = users.id
      LEFT JOIN worker_shifts shifts ON shifts.user_id = users.id AND shifts.clocked_out_at IS NULL
      LEFT JOIN price_import_batches batches ON batches.review_claimed_by = users.id AND batches.review_claim_expires_at > ?
      WHERE users.is_admin = 1 OR users.is_super_admin = 1 OR users.staff_role IN ('manager','reviewer','data_entry')
      GROUP BY users.id
      ORDER BY users.is_super_admin DESC, users.username
    `,
    [`${localDateFor()}T00:00:00.000Z`, new Date().toISOString()]
  );
  response.json({ workers: rows.map((row) => ({
    id: row.id, username: row.username, email: row.email || "", role: staffRoleForUser(row),
    active_now: Boolean(row.last_seen_at && row.last_seen_at >= new Date(Date.now() - ACTIVE_USAGE_WINDOW_MINUTES * 60000).toISOString()),
    last_seen_at: row.last_seen_at || "", shift: row.shift_id ? { id: row.shift_id, status: row.shift_status, clocked_in_at: row.clocked_in_at } : null,
    current_batch_id: row.current_batch_id || null, reviews_today: row.reviews_today || 0
  })) });
}));

app.post("/api/admin/v2/workers/:userId/role", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.userId, 10);
  const role = cleanText(request.body.role, 30).toLowerCase();
  if (!["manager", "reviewer", "data_entry", "user"].includes(role)) {
    response.status(400).json({ error: "Choose Manager, Reviewer, Data Entry, or User." });
    return;
  }
  const target = await get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!target) {
    response.status(404).json({ error: "User was not found." });
    return;
  }
  if (isOwnerAccount(target)) {
    response.status(400).json({ error: "The protected Owner role cannot be changed here." });
    return;
  }
  await run("UPDATE users SET staff_role = ?, is_admin = ? WHERE id = ?", [role, role === "user" ? 0 : 1, userId]);
  await appendAdminRoleAuditNote({ targetUserId: userId, adminUserId: request.adminUser.id, note: `Admin V2 role changed to ${role}.` });
  response.json({ message: `Worker role changed to ${role.replace(/_/g, " ")}.` });
}));

app.post("/api/admin/v2/preferences", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const preferences = workPreferencesForUser({ work_preferences_json: JSON.stringify(request.body || {}) });
  await run("UPDATE users SET work_preferences_json = ? WHERE id = ?", [JSON.stringify(preferences), request.adminUser.id]);
  response.json({ message: "Work preferences saved.", preferences });
}));

app.post("/api/admin/v2/shifts/:action", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const action = cleanText(request.params.action, 30).toLowerCase();
  const now = new Date().toISOString();
  const shift = await get("SELECT * FROM worker_shifts WHERE user_id = ? AND clocked_out_at IS NULL ORDER BY id DESC LIMIT 1", [request.adminUser.id]);
  if (action === "clock-in") {
    if (shift) { response.status(409).json({ error: "You are already clocked in." }); return; }
    const result = await run("INSERT INTO worker_shifts (user_id, status, clocked_in_at, created_at, updated_at) VALUES (?, 'clocked_in', ?, ?, ?)", [request.adminUser.id, now, now, now]);
    response.status(201).json({ message: "Clocked in.", shift_id: result.lastID });
    return;
  }
  if (!shift) { response.status(409).json({ error: "Clock in before changing your shift." }); return; }
  if (action === "take-break") {
    if (shift.status === "on_break") { response.status(409).json({ error: "You are already on break." }); return; }
    await run("UPDATE worker_shifts SET status = 'on_break', break_started_at = ?, updated_at = ? WHERE id = ?", [now, now, shift.id]);
  } else if (action === "return") {
    if (shift.status !== "on_break") { response.status(409).json({ error: "Your shift is not currently on break." }); return; }
    const breakSeconds = Math.max(0, Math.round((Date.now() - Date.parse(shift.break_started_at)) / 1000));
    await run("UPDATE worker_shifts SET status = 'clocked_in', break_started_at = NULL, total_break_seconds = total_break_seconds + ?, updated_at = ? WHERE id = ?", [breakSeconds, now, shift.id]);
  } else if (action === "clock-out") {
    let extraBreak = 0;
    if (shift.status === "on_break" && shift.break_started_at) extraBreak = Math.max(0, Math.round((Date.now() - Date.parse(shift.break_started_at)) / 1000));
    await run("UPDATE worker_shifts SET status = 'clocked_out', break_started_at = NULL, total_break_seconds = total_break_seconds + ?, clocked_out_at = ?, updated_at = ? WHERE id = ?", [extraBreak, now, now, shift.id]);
  } else {
    response.status(400).json({ error: "Shift action is not valid." }); return;
  }
  response.json({ message: action === "take-break" ? "Break started." : action === "return" ? "Welcome back." : "Clocked out." });
}));

function createSqliteBackup(destination) {
  return new Promise((resolve, reject) => {
    const backup = db.backup(destination);
    backup.step(-1, (stepError) => {
      backup.finish((finishError) => {
        if (stepError || finishError) reject(stepError || finishError);
        else resolve();
      });
    });
  });
}

function safeBackupSummary(row) {
  return row ? { id: row.id, status: row.status, filename: row.storage_path ? path.basename(row.storage_path) : "", created_at: row.created_at } : null;
}

app.get("/api/admin/operations/backups", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const rows = await all("SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT 25");
  response.json({ note: "Local backups are a same-disk safety layer, not disaster recovery. Off-site backups should be added later.", backups: rows.map(safeBackupSummary) });
}));

app.post("/api/admin/operations/backups", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const backupDir = path.join(DATA_DIR, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `grocery_radar-${stamp}.sqlite`;
  const destination = path.join(backupDir, filename);
  const createdAt = new Date().toISOString();
  try {
    await createSqliteBackup(destination);
    const check = fs.statSync(destination);
    if (!check.isFile() || check.size <= 0) throw new Error("Backup verification failed.");
    const result = await run("INSERT INTO backup_runs (status, storage_path, metadata_json, created_by, created_at) VALUES ('success', ?, ?, ?, ?)", [destination, JSON.stringify({ size_bytes: check.size, method: "sqlite_backup_api" }), request.adminUser.id, createdAt]);
    response.status(201).json({ message: "Database backup created and verified.", backup: safeBackupSummary({ id: result.lastID, status: "success", storage_path: destination, created_at: createdAt }) });
  } catch (error) {
    await run("INSERT INTO backup_runs (status, storage_path, metadata_json, created_by, created_at) VALUES ('failed', ?, ?, ?, ?)", [destination, JSON.stringify({ error: cleanText(error.message, 300) }), request.adminUser.id, createdAt]);
    response.status(500).json({ error: "The database backup could not be completed." });
  }
}));

app.get("/api/admin/operations/backups/:id/download", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const backup = await get("SELECT * FROM backup_runs WHERE id = ? AND status = 'success'", [Number.parseInt(request.params.id, 10)]);
  const backupDir = path.join(DATA_DIR, "backups");
  if (!backup || !backup.storage_path || !pathIsInside(backupDir, backup.storage_path) || !fs.existsSync(backup.storage_path)) {
    response.status(404).json({ error: "Backup file was not found." });
    return;
  }
  response.download(backup.storage_path, path.basename(backup.storage_path));
}));

app.get("/api/admin/operations/overview", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json(await operationsOverview(request.adminUser));
}));

app.get("/api/admin/operations/users", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json(await operationsUsers({
    q: cleanText(request.query.q, 120),
    page: Number.parseInt(request.query.page, 10) || 1,
    limit: Number.parseInt(request.query.limit, 10) || 50
  }));
}));

app.get("/api/admin/operations/users/:id", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const detail = await operationsUserDetail(userId);

  if (!detail) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  response.json(detail);
}));

app.get("/api/admin/operations/feedback", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json(await operationsFeedback({
    q: cleanText(request.query.q, 120),
    status: cleanText(request.query.status, 40).toLowerCase(),
    category: cleanText(request.query.category, 40).toLowerCase(),
    page: Number.parseInt(request.query.page, 10) || 1,
    limit: Number.parseInt(request.query.limit, 10) || 50
  }));
}));

app.post("/api/admin/operations/feedback/:id", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const ticketId = Number.parseInt(request.params.id, 10);
  const ticket = await updateFeedbackTicket(ticketId, request.body, request.adminUser, request);

  if (!ticket) {
    response.status(404).json({ error: "Feedback ticket was not found." });
    return;
  }

  response.json({
    message: "Feedback ticket updated.",
    ticket: formatFeedbackTicket(ticket, true)
  });
}));

app.get("/api/admin/operations/feature-votes", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const options = await featureVoteOptionsForUser(request.adminUser.id);
  response.json({
    options,
    trending: options.filter((option) => option.status === "trending"),
    newest: options.slice().sort((a, b) => new Date(b.newest_vote_at || b.created_at) - new Date(a.newest_vote_at || a.created_at)).slice(0, 20),
    completed: options.filter((option) => option.status === "completed"),
    rejected: options.filter((option) => option.status === "rejected")
  });
}));

app.post("/api/admin/operations/feature-votes/:id/status", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const optionId = Number.parseInt(request.params.id, 10);
  const status = cleanFeatureVoteStatus(request.body.status);
  const result = await run(
    "UPDATE feature_vote_options SET status = ?, updated_at = ? WHERE id = ?",
    [status, new Date().toISOString(), optionId]
  );

  if (!result.changes) {
    response.status(404).json({ error: "Feature vote option was not found." });
    return;
  }

  response.json({
    message: "Feature vote status updated.",
    options: await featureVoteOptionsForUser(request.adminUser.id)
  });
}));

app.get("/api/admin/operations/announcements", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const rows = await all("SELECT * FROM announcements ORDER BY updated_at DESC LIMIT 100");
  response.json({
    announcements: rows.map((row) => formatAnnouncement(row, true)),
    types: ANNOUNCEMENT_TYPES,
    statuses: ANNOUNCEMENT_STATUSES
  });
}));

app.post("/api/admin/operations/announcements", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const announcement = cleanAnnouncementPayload(request.body, request.adminUser.id);

  if (!announcement.title || !announcement.body) {
    response.status(400).json({ error: "Announcement title and body are required." });
    return;
  }

  const result = await run(
    `
      INSERT INTO announcements (
        title,
        body,
        announcement_type,
        status,
        scope,
        city,
        region,
        country_code,
        starts_at,
        ends_at,
        published_at,
        published_by,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      announcement.title,
      announcement.body,
      announcement.announcement_type,
      announcement.status,
      announcement.scope,
      announcement.city,
      announcement.region,
      announcement.country_code,
      announcement.starts_at,
      announcement.ends_at,
      announcement.published_at,
      announcement.published_by,
      announcement.created_by,
      announcement.updated_by,
      announcement.created_at,
      announcement.updated_at
    ]
  );

  response.status(201).json({
    message: "Announcement saved.",
    announcement: formatAnnouncement(await get("SELECT * FROM announcements WHERE id = ?", [result.lastID]), true)
  });
}));

app.post("/api/admin/operations/announcements/:id", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const announcementId = Number.parseInt(request.params.id, 10);
  const existing = await get("SELECT * FROM announcements WHERE id = ?", [announcementId]);

  if (!existing) {
    response.status(404).json({ error: "Announcement was not found." });
    return;
  }

  const announcement = cleanAnnouncementPayload(request.body, request.adminUser.id, existing);

  if (!announcement.title || !announcement.body) {
    response.status(400).json({ error: "Announcement title and body are required." });
    return;
  }

  await run(
    `
      UPDATE announcements
      SET title = ?,
          body = ?,
          announcement_type = ?,
          status = ?,
          scope = ?,
          city = ?,
          region = ?,
          country_code = ?,
          starts_at = ?,
          ends_at = ?,
          published_at = ?,
          published_by = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      announcement.title,
      announcement.body,
      announcement.announcement_type,
      announcement.status,
      announcement.scope,
      announcement.city,
      announcement.region,
      announcement.country_code,
      announcement.starts_at,
      announcement.ends_at,
      announcement.published_at,
      announcement.published_by,
      announcement.updated_by,
      announcement.updated_at,
      announcementId
    ]
  );

  response.json({
    message: "Announcement updated.",
    announcement: formatAnnouncement(await get("SELECT * FROM announcements WHERE id = ?", [announcementId]), true)
  });
}));

app.get("/api/admin/operations/homepage-service", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json(await homepageServiceData({ includeAdminFields: true }));
}));

app.post("/api/admin/operations/homepage-service/status", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const existing = await get("SELECT * FROM homepage_service_status WHERE id = 1");
  const status = cleanHomepageServiceStatusPayload(request.body, request.adminUser.id, existing || {});

  await run(
    `
      INSERT INTO homepage_service_status (
        id,
        service_status,
        version_label,
        current_focus,
        main_message,
        community_mission_title,
        community_mission_body,
        homepage_announcement,
        maintenance_enabled,
        maintenance_title,
        maintenance_message,
        maintenance_impact,
        maintenance_start_at,
        maintenance_end_at,
        maintenance_status,
        published_at,
        published_by,
        created_at,
        updated_at,
        updated_by
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        service_status = excluded.service_status,
        version_label = excluded.version_label,
        current_focus = excluded.current_focus,
        main_message = excluded.main_message,
        community_mission_title = excluded.community_mission_title,
        community_mission_body = excluded.community_mission_body,
        homepage_announcement = excluded.homepage_announcement,
        maintenance_enabled = excluded.maintenance_enabled,
        maintenance_title = excluded.maintenance_title,
        maintenance_message = excluded.maintenance_message,
        maintenance_impact = excluded.maintenance_impact,
        maintenance_start_at = excluded.maintenance_start_at,
        maintenance_end_at = excluded.maintenance_end_at,
        maintenance_status = excluded.maintenance_status,
        published_at = excluded.published_at,
        published_by = excluded.published_by,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `,
    [
      status.service_status,
      status.version_label,
      status.current_focus,
      status.main_message,
      status.community_mission_title,
      status.community_mission_body,
      status.homepage_announcement,
      status.maintenance_enabled,
      status.maintenance_title,
      status.maintenance_message,
      status.maintenance_impact,
      status.maintenance_start_at,
      status.maintenance_end_at,
      status.maintenance_status,
      status.published_at,
      status.published_by,
      status.created_at,
      status.updated_at,
      status.updated_by
    ]
  );

  response.json({
    message: "Homepage service status saved.",
    service: formatHomepageServiceStatus(await get("SELECT * FROM homepage_service_status WHERE id = 1"), true)
  });
}));

app.post("/api/admin/operations/homepage-service/patch-notes", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const patch = cleanHomepagePatchNotePayload(request.body, request.adminUser.id);

  if (!patch.version_label || !patch.title || !patch.summary) {
    response.status(400).json({ error: "Patch note version, title, and summary are required." });
    return;
  }

  const result = await run(
    `
      INSERT INTO homepage_patch_notes (
        version_label,
        title,
        summary,
        added_json,
        changed_json,
        fixed_json,
        known_issues_json,
        next_focus_json,
        release_date,
        internal_commit_hash,
        status,
        published_at,
        published_by,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      patch.version_label,
      patch.title,
      patch.summary,
      patch.added_json,
      patch.changed_json,
      patch.fixed_json,
      patch.known_issues_json,
      patch.next_focus_json,
      patch.release_date,
      patch.internal_commit_hash,
      patch.status,
      patch.published_at,
      patch.published_by,
      patch.created_by,
      patch.updated_by,
      patch.created_at,
      patch.updated_at
    ]
  );

  response.status(201).json({
    message: "Homepage patch note saved.",
    patch_note: formatHomepagePatchNote(await get("SELECT * FROM homepage_patch_notes WHERE id = ?", [result.lastID]), true)
  });
}));

app.post("/api/admin/operations/homepage-service/patch-notes/:id", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const patchId = Number.parseInt(request.params.id, 10);
  const existing = await get("SELECT * FROM homepage_patch_notes WHERE id = ?", [patchId]);

  if (!existing) {
    response.status(404).json({ error: "Homepage patch note was not found." });
    return;
  }

  const patch = cleanHomepagePatchNotePayload(request.body, request.adminUser.id, existing);

  if (!patch.version_label || !patch.title || !patch.summary) {
    response.status(400).json({ error: "Patch note version, title, and summary are required." });
    return;
  }

  await run(
    `
      UPDATE homepage_patch_notes
      SET version_label = ?,
          title = ?,
          summary = ?,
          added_json = ?,
          changed_json = ?,
          fixed_json = ?,
          known_issues_json = ?,
          next_focus_json = ?,
          release_date = ?,
          internal_commit_hash = ?,
          status = ?,
          published_at = ?,
          published_by = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      patch.version_label,
      patch.title,
      patch.summary,
      patch.added_json,
      patch.changed_json,
      patch.fixed_json,
      patch.known_issues_json,
      patch.next_focus_json,
      patch.release_date,
      patch.internal_commit_hash,
      patch.status,
      patch.published_at,
      patch.published_by,
      patch.updated_by,
      patch.updated_at,
      patchId
    ]
  );

  response.json({
    message: "Homepage patch note updated.",
    patch_note: formatHomepagePatchNote(await get("SELECT * FROM homepage_patch_notes WHERE id = ?", [patchId]), true)
  });
}));

app.post("/api/admin/operations/homepage-service/known-issues", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const issue = cleanHomepageKnownIssuePayload(request.body, request.adminUser.id);

  if (!issue.title || !issue.description) {
    response.status(400).json({ error: "Known issue title and description are required." });
    return;
  }

  const result = await run(
    `
      INSERT INTO homepage_known_issues (
        title,
        issue_status,
        description,
        workaround,
        visibility_status,
        opened_at,
        last_updated_at,
        published_at,
        published_by,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      issue.title,
      issue.issue_status,
      issue.description,
      issue.workaround,
      issue.visibility_status,
      issue.opened_at,
      issue.last_updated_at,
      issue.published_at,
      issue.published_by,
      issue.created_by,
      issue.updated_by,
      issue.created_at,
      issue.updated_at
    ]
  );

  response.status(201).json({
    message: "Homepage known issue saved.",
    known_issue: formatHomepageKnownIssue(await get("SELECT * FROM homepage_known_issues WHERE id = ?", [result.lastID]), true)
  });
}));

app.post("/api/admin/operations/homepage-service/known-issues/:id", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const issueId = Number.parseInt(request.params.id, 10);
  const existing = await get("SELECT * FROM homepage_known_issues WHERE id = ?", [issueId]);

  if (!existing) {
    response.status(404).json({ error: "Homepage known issue was not found." });
    return;
  }

  const issue = cleanHomepageKnownIssuePayload(request.body, request.adminUser.id, existing);

  if (!issue.title || !issue.description) {
    response.status(400).json({ error: "Known issue title and description are required." });
    return;
  }

  await run(
    `
      UPDATE homepage_known_issues
      SET title = ?,
          issue_status = ?,
          description = ?,
          workaround = ?,
          visibility_status = ?,
          opened_at = ?,
          last_updated_at = ?,
          published_at = ?,
          published_by = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      issue.title,
      issue.issue_status,
      issue.description,
      issue.workaround,
      issue.visibility_status,
      issue.opened_at,
      issue.last_updated_at,
      issue.published_at,
      issue.published_by,
      issue.updated_by,
      issue.updated_at,
      issueId
    ]
  );

  response.json({
    message: "Homepage known issue updated.",
    known_issue: formatHomepageKnownIssue(await get("SELECT * FROM homepage_known_issues WHERE id = ?", [issueId]), true)
  });
}));

app.get("/api/admin/operations/widgets", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const row = await get("SELECT layout_json FROM admin_widget_layouts WHERE admin_user_id = ?", [request.adminUser.id]);
  response.json({
    widget_ids: OPERATIONS_WIDGET_IDS,
    layout: parseMetadataJson(row?.layout_json)
  });
}));

app.post("/api/admin/operations/widgets", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const layout = request.body.layout && typeof request.body.layout === "object" ? request.body.layout : {};
  const order = Array.isArray(layout.order)
    ? layout.order.filter((id) => OPERATIONS_WIDGET_IDS.includes(id))
    : OPERATIONS_WIDGET_IDS;
  const hidden = Array.isArray(layout.hidden)
    ? layout.hidden.filter((id) => OPERATIONS_WIDGET_IDS.includes(id))
    : [];
  const sizes = layout.sizes && typeof layout.sizes === "object"
    ? Object.fromEntries(Object.entries(layout.sizes).filter(([id, size]) =>
        OPERATIONS_WIDGET_IDS.includes(id) && ["compact", "normal", "wide"].includes(size)
      ))
    : {};
  const cleanLayout = { order, hidden, sizes };
  const now = new Date().toISOString();

  await run(
    `
      INSERT INTO admin_widget_layouts (admin_user_id, layout_json, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(admin_user_id) DO UPDATE SET
        layout_json = excluded.layout_json,
        updated_at = excluded.updated_at
    `,
    [request.adminUser.id, JSON.stringify(cleanLayout), now, now]
  );

  response.json({
    message: "Operations widget layout saved.",
    layout: cleanLayout
  });
}));

app.get("/api/admin/operations/audit-log", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const rows = await all(
    `
      SELECT audit.*, users.username
      FROM admin_audit_log audit
      LEFT JOIN users ON users.id = audit.admin_user_id
      ORDER BY audit.created_at DESC
      LIMIT 200
    `
  );
  response.json({
    audit_log: rows.map((row) => ({
      id: row.id,
      admin_user_id: row.admin_user_id,
      admin_username: row.username || "",
      action: row.action,
      method: row.method || "",
      path: row.path || "",
      status_code: row.status_code || null,
      affected_type: row.affected_type || "",
      affected_id: row.affected_id || null,
      created_at: row.created_at
    }))
  });
}));

app.get("/api/admin/operations/events", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json({
    events: await operationsEventFeed()
  });
}));

app.get("/api/admin/operations/errors", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json(await operationsErrorCenter());
}));

app.get("/api/admin/sponsors", requireAdminAccess, asyncRoute(async (request, response) => {
  const sponsors = await all("SELECT * FROM sponsors ORDER BY updated_at DESC, created_at DESC");
  const stats = await sponsorStatsById();

  response.json({
    sponsor_types: SPONSOR_TYPES,
    sponsor_statuses: SPONSOR_STATUSES,
    privacy_note: "Sponsor stats are anonymous aggregate counts. Do not provide personal user data to sponsors.",
    sponsors: sponsors.map((sponsor) => formatSponsor(sponsor, stats.get(sponsor.id)))
  });
}));

app.post("/api/admin/sponsors", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const sponsor = validateSponsor(request.body);
  const now = new Date().toISOString();
  const result = await run(
    `
      INSERT INTO sponsors (
        sponsor_name,
        sponsor_type,
        title,
        message,
        link_url,
        image_url,
        starts_at,
        ends_at,
        status,
        weekly_price_note,
        admin_note,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sponsor.sponsor_name,
      sponsor.sponsor_type,
      sponsor.title,
      sponsor.message,
      sponsor.link_url,
      sponsor.image_url,
      sponsor.starts_at,
      sponsor.ends_at,
      sponsor.status,
      sponsor.weekly_price_note,
      sponsor.admin_note,
      now,
      now
    ]
  );

  response.status(201).json({
    message: "Sponsor card created.",
    sponsor_id: result.lastID
  });
}));

app.post("/api/admin/sponsors/:id", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const sponsorId = Number.parseInt(request.params.id, 10);
  const existing = await get("SELECT * FROM sponsors WHERE id = ?", [sponsorId]);

  if (!existing) {
    response.status(404).json({ error: "Sponsor card was not found." });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(request.body, "status_only")) {
    const status = validateSponsorStatus(request.body.status);

    await run(
      "UPDATE sponsors SET status = ?, updated_at = ? WHERE id = ?",
      [status, new Date().toISOString(), sponsorId]
    );
    response.json({ message: `Sponsor card marked ${status}.` });
    return;
  }

  const sponsor = validateSponsor({
    sponsor_name: request.body.sponsor_name ?? existing.sponsor_name,
    sponsor_type: request.body.sponsor_type ?? existing.sponsor_type,
    title: request.body.title ?? existing.title,
    message: request.body.message ?? existing.message,
    link_url: request.body.link_url ?? existing.link_url,
    image_url: request.body.image_url ?? existing.image_url,
    starts_at: request.body.starts_at ?? existing.starts_at,
    ends_at: request.body.ends_at ?? existing.ends_at,
    status: request.body.status ?? existing.status,
    weekly_price_note: request.body.weekly_price_note ?? existing.weekly_price_note,
    admin_note: request.body.admin_note ?? existing.admin_note
  });

  await run(
    `
      UPDATE sponsors
      SET sponsor_name = ?,
          sponsor_type = ?,
          title = ?,
          message = ?,
          link_url = ?,
          image_url = ?,
          starts_at = ?,
          ends_at = ?,
          status = ?,
          weekly_price_note = ?,
          admin_note = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      sponsor.sponsor_name,
      sponsor.sponsor_type,
      sponsor.title,
      sponsor.message,
      sponsor.link_url,
      sponsor.image_url,
      sponsor.starts_at,
      sponsor.ends_at,
      sponsor.status,
      sponsor.weekly_price_note,
      sponsor.admin_note,
      new Date().toISOString(),
      sponsorId
    ]
  );

  response.json({ message: "Sponsor card saved." });
}));

app.get("/api/admin/users", requireAdminAccess, asyncRoute(async (request, response) => {
  const users = await all(
    `
      SELECT
        users.id,
        users.username,
        users.email,
        users.points,
        users.accuracy_score,
        users.is_email_verified,
        users.is_admin,
        users.is_super_admin,
        users.account_status,
        users.ban_reason,
        users.ban_note,
        users.banned_at,
        users.banned_by,
        users.hide_from_leaderboard,
        users.force_username_change,
        users.username_status,
        users.username_moderation_note,
        users.admin_note,
        users.avoid_ingredients,
        users.last_activity_at,
        users.created_at,
        (SELECT COUNT(*) FROM price_reports WHERE price_reports.user_id = users.id) AS report_count,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE price_reports.user_id = users.id
            AND price_reports.status = 'approved'
        ) AS approved_report_count,
        (SELECT COUNT(*) FROM verifications WHERE verifications.user_id = users.id) AS verification_count,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE price_reports.user_id = users.id
            AND price_reports.status = 'rejected'
        ) AS rejected_report_count,
        (
          SELECT COUNT(*)
          FROM price_reports
          WHERE price_reports.user_id = users.id
            AND price_reports.status = 'disputed'
        ) AS disputed_submissions,
        (
          SELECT note
          FROM user_admin_notes
          WHERE user_admin_notes.user_id = users.id
          ORDER BY created_at DESC
          LIMIT 1
        ) AS latest_admin_note
      FROM users
      ORDER BY users.points DESC, users.created_at ASC
    `
  );

  const recentUsers = await all(
    `
      SELECT
        id,
        username,
        email,
        points,
        accuracy_score,
        is_email_verified,
        is_admin,
        is_super_admin,
        account_status,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `
  );

  response.json({
    users: users.map((user) => {
      const notes = [];

      if (!user.is_email_verified) {
        notes.push("email not verified");
      }

      if (user.rejected_report_count >= 2) {
        notes.push("multiple rejected reports");
      }

      if (user.disputed_submissions >= 2) {
        notes.push("multiple disputed or rejected reports");
      }

      if (user.account_status !== "active") {
        notes.push(`account ${user.account_status}`);
      }

      if (user.hide_from_leaderboard) {
        notes.push("hidden from leaderboard");
      }

      if (user.force_username_change) {
        notes.push("username change required");
      }

      const trustProfile = trustLevelFromStats({
        accepted_proof_count: user.approved_report_count || 0,
        approved_prices_from_proof: user.approved_report_count || 0,
        rejected_proof_count: user.rejected_report_count || 0,
        duplicate_proof_count: 0,
        unclear_proof_count: 0,
        is_admin: Boolean(user.is_admin),
        admin_note: user.admin_note || ""
      });

      return {
        ...user,
        email_verified: Boolean(user.is_email_verified),
        is_admin: Boolean(user.is_admin),
        is_super_admin: isSuperAdminAccount(user),
        hide_from_leaderboard: Boolean(user.hide_from_leaderboard),
        force_username_change: Boolean(user.force_username_change),
        trust_level: trustProfile.label,
        trust_level_key: trustProfile.key,
        proof_daily_cap: trustProfile.daily_cap,
        suspicious_activity_notes: notes
      };
    }),
    recent_users: recentUsers.map((user) => ({
      ...user,
      email_verified: Boolean(user.is_email_verified),
      is_admin: Boolean(user.is_admin),
      is_super_admin: isSuperAdminAccount(user),
      account_status: user.account_status || "active"
    }))
  });
}));

app.get("/api/admin/admin-accounts", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  response.json(await adminAccountAuditSummary());
}));

app.post("/api/admin/admin-accounts/:id/role", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  if (!request.adminUser || request.adminAccessViaPin) {
    response.status(403).json({
      error: "Admin role cleanup requires a logged-in admin session. The ADMIN_PIN fallback cannot change admin access."
    });
    return;
  }

  const userId = Number.parseInt(request.params.id, 10);
  const target = await get("SELECT * FROM users WHERE id = ?", [userId]);

  if (!target) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const action = cleanText(request.body.action, 40).toLowerCase();
  const confirmation = cleanText(request.body.confirmation, 80);
  const adminNote = cleanText(request.body.admin_note || request.body.adminNote, 500);
  const now = new Date().toISOString();
  let message = "";
  let auditNote = "";

  if (action === "demote_admin") {
    if (confirmation !== "DEMOTE ADMIN") {
      response.status(400).json({ error: "Type DEMOTE ADMIN to confirm removing admin access." });
      return;
    }

    if (!target.is_admin) {
      response.status(400).json({ error: "This account is not currently an admin." });
      return;
    }

    if (isOwnerAccount(target)) {
      response.status(400).json({ error: "The bootstrap Super Admin account cannot be demoted." });
      return;
    }

    if ((await activeAdminCountExcluding(userId)) < 1) {
      response.status(400).json({ error: "Cannot demote the last active admin account." });
      return;
    }

    await run("UPDATE users SET is_admin = 0, is_super_admin = 0 WHERE id = ?", [userId]);
    message = "Admin access removed. User data was not deleted.";
    auditNote = `Admin access removed by ${request.adminUser.username}. ${adminNote}`.trim();
  } else if (action === "promote_admin") {
    if (confirmation !== "MAKE ADMIN") {
      response.status(400).json({ error: "Type MAKE ADMIN to confirm granting admin access." });
      return;
    }

    if (isBlockedAccount(target)) {
      response.status(400).json({ error: "Blocked, suspended, deleted, or deactivated accounts cannot be promoted to admin." });
      return;
    }

    await run("UPDATE users SET is_admin = 1 WHERE id = ?", [userId]);
    message = "Admin access granted.";
    auditNote = `Admin access granted by ${request.adminUser.username}. ${adminNote}`.trim();
  } else if (action === "suspend_test") {
    if (confirmation !== "SUSPEND TEST") {
      response.status(400).json({ error: "Type SUSPEND TEST to confirm suspending this test/dev account." });
      return;
    }

    if (isOwnerAccount(target)) {
      response.status(400).json({ error: "The bootstrap Super Admin account cannot be suspended." });
      return;
    }

    if (target.is_admin && (await activeAdminCountExcluding(userId)) < 1) {
      response.status(400).json({ error: "Cannot suspend the last active admin account." });
      return;
    }

    await run(
      `
        UPDATE users
        SET is_admin = 0,
            account_status = 'suspended',
            hide_from_leaderboard = 1,
            ban_reason = COALESCE(NULLIF(ban_reason, ''), 'Test/dev account cleanup'),
            ban_note = ?,
            banned_at = ?,
            banned_by = ?
        WHERE id = ?
      `,
      [
        adminNote || "Suspended from Admin Access Cleanup. Data retained for audit.",
        now,
        request.adminUser.id,
        userId
      ]
    );
    message = "Test/dev account suspended and admin access removed. User data was not deleted.";
    auditNote = `Test/dev account suspended by ${request.adminUser.username}. ${adminNote}`.trim();
  } else {
    response.status(400).json({ error: "Choose demote_admin, promote_admin, or suspend_test." });
    return;
  }

  await appendAdminRoleAuditNote({
    targetUserId: userId,
    adminUserId: request.adminUser.id,
    note: auditNote || message
  });

  response.json({
    message,
    admin_account_audit: await adminAccountAuditSummary()
  });
}));

app.post("/api/admin/reports/:id/status", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10);
  const status = validateAdminStatus(request.body.status);
  const report = await get(
    `
      SELECT
        pr.*,
        stores.name AS store_name,
        users.email AS user_email,
        users.username AS username
      FROM price_reports pr
      JOIN stores ON stores.id = pr.store_id
      JOIN users ON users.id = pr.user_id
      WHERE pr.id = ?
    `,
    [reportId]
  );

  if (!report) {
    response.status(404).json({ error: "Report was not found." });
    return;
  }

  if (status === "deleted") {
    deleteUploadedFile(report.photo_path);
    await run("DELETE FROM price_reports WHERE id = ?", [reportId]);
    await updateUserAccuracy(report.user_id);
    response.json({ message: "Report deleted." });
    return;
  }

  const rejection = status === "rejected"
    ? validateRejectionDetails(request.body)
    : {
        reason: cleanText(request.body.rejection_reason || request.body.admin_rejection_reason, 120),
        note: cleanText(request.body.rejection_note || request.body.admin_rejection_note, 500)
      };
  let confidence = calculateConfidence(
    report.proof_type,
    report.verification_count,
    report.dispute_count
  );

  if (status === "approved") {
    confidence = report.verification_count >= 2
      ? "high"
      : baseConfidence(report.proof_type);
  }

  if (status === "rejected" || status === "disputed" || status === "removed") {
    confidence = "disputed";
  }

  if (status === "expired") {
    confidence = "expired";
  }

  if (status === "needs_proof" || status === "needs_update") {
    confidence = "low";
  }

  await run(
    `
      UPDATE price_reports
      SET status = ?,
          confidence = ?,
          admin_rejection_reason = ?,
          admin_rejection_note = ?,
          reviewed_at = ?,
          reviewed_by = ?
      WHERE id = ?
    `,
    [
      status,
      confidence,
      rejection.reason || null,
      rejection.note || null,
      new Date().toISOString(),
      request.adminUser ? request.adminUser.id : null,
      reportId
    ]
  );
  await updateUserAccuracy(report.user_id);
  let emailWarning = null;

  if (status === "rejected") {
    const existingPenalty = await get(
      `
        SELECT id
        FROM point_events
        WHERE user_id = ?
          AND price_report_id = ?
          AND action = 'wrong_fake_report_penalty'
      `,
      [report.user_id, reportId]
    );

    if (!existingPenalty) {
      await addPointEvent(
        report.user_id,
        "wrong_fake_report_penalty",
        POINTS.wrong_fake_report_penalty,
        reportId
      );
    }

    const rejectionEmail = await sendReportRejectionEmail(
      {
        username: report.username,
        email: report.user_email
      },
      report,
      rejection
    );
    emailWarning = rejectionEmail.warning;
  }

  const updatedReport = await get(
    `
      ${reportSelectWithProduct()}
      WHERE pr.id = ?
    `,
    [reportId]
  );

  if (status === "approved") {
    await organizeApprovedReportProduct(updatedReport, request.adminUser ? request.adminUser.id : null);
    await createUserNotification(
      report.user_id,
      "report_approved",
      "Your price was approved.",
      `Your ${report.item_name} report at ${report.store_name} is now public as a cheapest reported price.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
    await notifyCartUsersForApprovedReport(updatedReport);

    if (updatedReport && !updatedReport.product_id) {
      await createAdminNotification(
        "unlinked_report_created",
        "Approved report needs product link",
        `${updatedReport.item_name} was approved but is not linked to a product.`,
        {
          related_type: "report",
          related_id: reportId,
          target_tab: "productToolsTab",
          target_url: `/admin.html?tab=productToolsTab&filter=unlinked&report=${reportId}`
        }
      );
    }
  } else if (status === "rejected") {
    await createUserNotification(
      report.user_id,
      "report_rejected",
      "Your price was rejected.",
      rejection.reason
        ? `Your ${report.item_name} report was rejected: ${rejection.reason}.`
        : `Your ${report.item_name} report was rejected.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
  } else if (status === "needs_proof") {
    await createUserNotification(
      report.user_id,
      "report_needs_proof",
      "Your price needs photo proof.",
      `Admin marked your ${report.item_name} report as needing proof before it can go public.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
  } else if (status === "needs_update") {
    await createUserNotification(
      report.user_id,
      "report_needs_update",
      "Your price needs an update.",
      `Admin marked your ${report.item_name} report as needing an update.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
  } else if (status === "disputed") {
    await createUserNotification(
      report.user_id,
      "report_disputed",
      "Your price was marked disputed.",
      `Admin marked your ${report.item_name} report as disputed.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
    await createAdminNotification(
      "disputed_report",
      "Report marked disputed",
      `${report.item_name} at ${report.store_name} was marked disputed.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "pricesTab",
        target_url: `/admin.html?tab=pricesTab&filter=disputed&report=${reportId}`
      }
    );
  } else if (status === "removed" || status === "expired") {
    await createUserNotification(
      report.user_id,
      `report_${status}`,
      `Your price was marked ${status}.`,
      `Your ${report.item_name} report at ${report.store_name} was marked ${status}.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
  }

  response.json({
    message: `Report marked ${status}.`,
    warning: emailWarning
  });
}));

app.post("/api/admin/reports/manual", requireAdminAccess, requireLoggedInAdminAction, upload.single("proof_photo"), asyncRoute(async (request, response) => {
  if (!request.adminUser) {
    response.status(403).json({ error: "Manual entry requires a logged-in admin account." });
    return;
  }

  let photoPath = request.file ? uploadedFileUrl(request.file.filename) : null;
  const photoOriginalName = request.file ? sanitizeOriginalFilename(request.file.originalname) : null;
  const photoMimeType = request.file ? request.file.mimetype : null;
  const photoSizeBytes = request.file ? request.file.size : null;

  try {
    const validStoreIds = await getActiveStoreIds();
    const cleanReport = validateReport(request.body, validStoreIds);

    if (cleanReport.proof_type !== "no_photo" && !photoPath) {
      throw new Error("Photo proof is required for this proof type.");
    }

    const unitPrice = calculateUnitPrice(
      cleanReport.price,
      cleanReport.quantity,
      cleanReport.unit
    );
    const approveImmediately = request.body.approve_immediately === "on" ||
      request.body.approve_immediately === "true" ||
      request.body.approve_immediately === true;
    const submittedAt = new Date().toISOString();
    const status = approveImmediately ? "approved" : "pending";
    const confidence = approveImmediately
      ? baseConfidence(cleanReport.proof_type)
      : calculateConfidence(cleanReport.proof_type, 0, 0);
    const productId = await resolveReportProductId(cleanReport, request.adminUser.id);
    const result = await run(
      `
        INSERT INTO price_reports (
          user_id,
          store_id,
          product_id,
          item_name,
          brand,
          category,
          price,
          regular_price,
          sale_price,
          size_text,
          quantity,
          unit,
          unit_price,
          proof_type,
          photo_path,
          photo_original_name,
          photo_mime_type,
          photo_size_bytes,
          notes,
          confidence,
          verification_count,
          dispute_count,
          status,
          admin_rejection_reason,
          admin_rejection_note,
          reviewed_at,
          reviewed_by,
          submitted_at,
          expires_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, NULL, ?, ?, ?, ?)
      `,
      [
        request.adminUser.id,
        cleanReport.store_id,
        productId,
        cleanReport.item_name,
        cleanReport.brand,
        cleanReport.category,
        cleanReport.price,
        cleanReport.regular_price,
        cleanReport.sale_price,
        cleanReport.size_text,
        cleanReport.quantity,
        unitPrice.unit,
        unitPrice.unitPrice,
        cleanReport.proof_type,
        photoPath,
        photoOriginalName,
        photoMimeType,
        photoSizeBytes,
        cleanReport.notes,
        confidence,
        status,
        approveImmediately ? submittedAt : null,
        approveImmediately ? request.adminUser.id : null,
        submittedAt,
        cleanReport.expires_at
      ]
    );

    const savedManualReport = await get(
      `
        ${reportSelectWithProduct()}
        WHERE pr.id = ?
      `,
      [result.lastID]
    );

    if (approveImmediately) {
      await organizeApprovedReportProduct(savedManualReport, request.adminUser.id);
      await notifyCartUsersForApprovedReport(savedManualReport);
    } else {
      await createAdminNotification(
        "new_report_submitted",
        "Manual report needs review",
        `${request.adminUser.username} created ${cleanReport.item_name} for review.`,
        {
          related_type: "report",
          related_id: result.lastID,
          target_tab: "reviewTab",
          target_url: `/admin.html?tab=reviewTab&report=${result.lastID}`
        }
      );
    }

    response.status(201).json({
      message: approveImmediately
        ? "Manual report created and approved."
        : "Manual report created for review.",
      report_id: result.lastID,
      product_id: productId,
      status,
      unit_price_label: unitPrice.formatted
    });
  } catch (error) {
    deleteUploadedFile(photoPath);
    photoPath = null;
    throw error;
  }
}));

app.post("/api/admin/reports/:id/edit", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10);
  const report = await get("SELECT * FROM price_reports WHERE id = ?", [reportId]);

  if (!report) {
    response.status(404).json({ error: "Report was not found." });
    return;
  }

  const mergedReport = {
    product_id: request.body.product_id ?? report.product_id,
    store_id: request.body.store_id ?? report.store_id,
    item_name: request.body.item_name ?? report.item_name,
    brand: request.body.brand ?? report.brand,
    category: request.body.category ?? report.category,
    price: request.body.price ?? report.price,
    regular_price: request.body.regular_price ?? report.regular_price,
    sale_price: request.body.sale_price ?? (report.sale_price ? "1" : "0"),
    size_text: request.body.size_text ?? report.size_text,
    quantity: request.body.quantity ?? report.quantity,
    unit: request.body.unit ?? report.unit,
    storage_condition: request.body.storage_condition ?? report.storage_condition,
    proof_type: request.body.proof_type ?? report.proof_type,
    notes: request.body.notes ?? report.notes,
    expires_at: request.body.expires_at || (report.expires_at ? String(report.expires_at).slice(0, 10) : "")
  };
  const validStoreIds = await getAllStoreIds();
  const cleanReport = validateReport(mergedReport, validStoreIds);

  if (cleanReport.proof_type !== "no_photo" && !report.photo_path) {
    response.status(400).json({ error: "Photo proof is required for this proof type." });
    return;
  }

  const unitPrice = calculateUnitPrice(cleanReport.price, cleanReport.quantity, cleanReport.unit);
  const comparisonPrice = Object.prototype.hasOwnProperty.call(request.body, "comparison_price")
    ? parseImportNumber(request.body.comparison_price)
    : (["price", "quantity", "unit"].some((field) => Object.prototype.hasOwnProperty.call(request.body, field))
        ? unitPrice.unitPrice
        : (report.comparison_price ?? unitPrice.unitPrice));
  const comparisonUnit = Object.prototype.hasOwnProperty.call(request.body, "comparison_unit")
    ? normalizePriceUnit(request.body.comparison_unit)
    : (["price", "quantity", "unit"].some((field) => Object.prototype.hasOwnProperty.call(request.body, field))
        ? unitPrice.unit
        : normalizePriceUnit(report.comparison_unit || unitPrice.unit));
  const now = new Date().toISOString();
  const adminId = request.adminUser ? request.adminUser.id : null;
  const adminEditNote = cleanText(request.body.admin_edit_note || request.body.edit_note, 500);
  const approveAfterEdit = request.body.approve_after_edit === true ||
    request.body.approve_after_edit === "true" ||
    request.body.approve_after_edit === "on";
  const officialProductUrl = cleanText(request.body.official_product_url ?? report.official_product_url, 300);
  const ingredientInfoUrl = cleanText(request.body.ingredient_info_url ?? report.ingredient_info_url, 300);
  const allergenNote = cleanText(request.body.allergen_note ?? report.allergen_note, 500);
  const adminSafetyNote = cleanText(request.body.admin_safety_note ?? report.admin_safety_note, 500);
  const comparableFieldsChanged = [
    String(report.item_name || "") !== String(cleanReport.item_name || ""),
    String(report.brand || "") !== String(cleanReport.brand || ""),
    String(report.category || "") !== String(cleanReport.category || ""),
    Number(report.price) !== Number(cleanReport.price),
    String(report.size_text || "") !== String(cleanReport.size_text || ""),
    Number(report.quantity) !== Number(cleanReport.quantity),
    String(report.unit || "") !== String(cleanReport.unit || ""),
    Number(report.product_id || 0) !== Number(cleanReport.product_id || 0),
    Number(report.store_id || 0) !== Number(cleanReport.store_id || 0),
    String(report.price_type || "") !== String(request.body.price_type ?? report.price_type ?? ""),
    String(report.valid_from_date || "") !== String(request.body.valid_from_date ?? report.valid_from_date ?? ""),
    String(report.valid_through_date || "") !== String(request.body.valid_through_date ?? report.valid_through_date ?? ""),
    String(report.promotion_conditions || "") !== String(request.body.promotion_conditions ?? report.promotion_conditions ?? ""),
    String(report.display_offer_text || "") !== String(request.body.display_offer_text ?? report.display_offer_text ?? "")
  ].some(Boolean);
  if (report.status === "approved" && comparableFieldsChanged && !adminEditNote) {
    response.status(400).json({ error: "An audit reason is required when correcting a published price." });
    return;
  }
  let nextStatus = report.status;
  let reviewedAt = report.reviewed_at;
  let reviewedBy = report.reviewed_by;
  let confidence = report.confidence;
  let productId = cleanReport.product_id;

  if (productId && Object.prototype.hasOwnProperty.call(request.body, "product_id")) {
    const product = await getProductById(productId, true);

    if (!product || product.status === "hidden" || product.status === "merged") {
      response.status(400).json({ error: "Selected product is not available." });
      return;
    }
  }

  if (approveAfterEdit) {
    nextStatus = "approved";
    reviewedAt = now;
    reviewedBy = adminId;
    confidence = baseConfidence(cleanReport.proof_type);
  }

  await run(
    `
      UPDATE price_reports
      SET product_id = ?,
          store_id = ?,
          item_name = ?,
          brand = ?,
          category = ?,
          price = ?,
          regular_price = ?,
          sale_price = ?,
          size_text = ?,
          quantity = ?,
          unit = ?,
          unit_price = ?,
          comparison_price = ?,
          comparison_unit = ?,
          estimated_item_price = ?,
          package_price = ?,
          storage_condition = ?,
          price_type = ?,
          valid_from_date = ?,
          valid_through_date = ?,
          valid_from_time = ?,
          valid_through_time = ?,
          promotion_conditions = ?,
          promotion_schedule_text = ?,
          display_offer_text = ?,
          multibuy_quantity = ?,
          multibuy_total_price = ?,
          proof_type = ?,
          notes = ?,
          status = ?,
          confidence = ?,
          reviewed_at = ?,
          reviewed_by = ?,
          edited_by = ?,
          edited_at = ?,
          admin_edit_note = ?,
          last_edited_by = ?,
          last_edited_at = ?,
          edit_note = ?,
          official_product_url = ?,
          ingredient_info_url = ?,
          allergen_note = ?,
          admin_safety_note = ?,
          expires_at = ?
      WHERE id = ?
    `,
    [
      productId,
      cleanReport.store_id,
      cleanReport.item_name,
      cleanReport.brand,
      cleanReport.category,
      cleanReport.price,
      cleanReport.regular_price,
      cleanReport.sale_price,
      cleanReport.size_text,
      cleanReport.quantity,
      unitPrice.unit,
      unitPrice.unitPrice,
      comparisonPrice,
      comparisonUnit,
      Object.prototype.hasOwnProperty.call(request.body, "estimated_item_price") ? parseImportNumber(request.body.estimated_item_price) : report.estimated_item_price,
      Object.prototype.hasOwnProperty.call(request.body, "package_price") ? parseImportNumber(request.body.package_price) : report.package_price,
      cleanText(request.body.storage_condition ?? report.storage_condition ?? "unknown", 40).toLowerCase(),
      normalizePriceType(request.body.price_type ?? report.price_type ?? (cleanReport.sale_price ? "sale" : "regular")),
      cleanText(request.body.valid_from_date ?? report.valid_from_date, 10),
      cleanText(request.body.valid_through_date ?? report.valid_through_date, 10),
      cleanText(request.body.valid_from_time ?? report.valid_from_time, 20),
      cleanText(request.body.valid_through_time ?? report.valid_through_time, 20),
      cleanText(request.body.promotion_conditions ?? report.promotion_conditions, 500),
      cleanText(request.body.promotion_schedule_text ?? report.promotion_schedule_text, 160),
      cleanText(request.body.display_offer_text ?? report.display_offer_text, 200),
      Object.prototype.hasOwnProperty.call(request.body, "multibuy_quantity") ? parseImportNumber(request.body.multibuy_quantity) : report.multibuy_quantity,
      Object.prototype.hasOwnProperty.call(request.body, "multibuy_total_price") ? parseImportNumber(request.body.multibuy_total_price) : report.multibuy_total_price,
      cleanReport.proof_type,
      cleanReport.notes,
      nextStatus,
      confidence,
      reviewedAt,
      reviewedBy,
      adminId,
      now,
      adminEditNote,
      adminId,
      now,
      adminEditNote,
      officialProductUrl,
      ingredientInfoUrl,
      allergenNote,
      adminSafetyNote,
      cleanReport.expires_at,
      reportId
    ]
  );

  if (report.status === "approved" && comparableFieldsChanged) {
    const savedCorrection = await get("SELECT * FROM price_reports WHERE id = ?", [reportId]);
    const correctionFields = ["product_id", "store_id", "item_name", "brand", "category", "price", "regular_price", "size_text", "quantity", "unit", "unit_price", "comparison_price", "comparison_unit", "storage_condition", "price_type", "valid_from_date", "valid_through_date", "promotion_conditions", "display_offer_text", "status"];
    const snapshot = (row) => Object.fromEntries(correctionFields.map((field) => [field, row?.[field] ?? null]));
    await run("INSERT INTO price_corrections (price_report_id, action, before_json, after_json, reason, corrected_by, created_at) VALUES (?, 'corrected', ?, ?, ?, ?, ?)", [reportId, JSON.stringify(snapshot(report)), JSON.stringify(snapshot(savedCorrection)), adminEditNote, adminId, now]);
  }

  await updateUserAccuracy(report.user_id);

  if (comparableFieldsChanged && report.status === "approved") {
    await recordPriceEvent({
      reportId,
      batchId: report.source_import_batch_id,
      rowId: report.source_import_row_id,
      eventType: "CORRECTED",
      actorUserId: adminId,
      submitterUserId: report.submitted_by_user_id || report.user_id,
      reason: adminEditNote || "Approved price corrected by admin.",
      metadata: {
        original: { product_id: report.product_id, store_id: report.store_id, item_name: report.item_name, brand: report.brand, category: report.category, price: report.price, comparison_price: report.comparison_price, comparison_unit: report.comparison_unit, size_text: report.size_text, quantity: report.quantity, unit: report.unit, price_type: report.price_type, valid_from_date: report.valid_from_date, valid_through_date: report.valid_through_date, promotion_conditions: report.promotion_conditions, display_offer_text: report.display_offer_text },
        corrected: { product_id: cleanReport.product_id, store_id: cleanReport.store_id, item_name: cleanReport.item_name, brand: cleanReport.brand, category: cleanReport.category, price: cleanReport.price, comparison_price: comparisonPrice, comparison_unit: comparisonUnit, size_text: cleanReport.size_text, quantity: cleanReport.quantity, unit: unitPrice.unit, price_type: normalizePriceType(request.body.price_type ?? report.price_type), valid_from_date: cleanText(request.body.valid_from_date ?? report.valid_from_date, 10), valid_through_date: cleanText(request.body.valid_through_date ?? report.valid_through_date, 10), promotion_conditions: cleanText(request.body.promotion_conditions ?? report.promotion_conditions, 500), display_offer_text: cleanText(request.body.display_offer_text ?? report.display_offer_text, 200) }
      }
    });
    const importLink = await get(
      `
        SELECT *
        FROM price_import_rows
        WHERE price_report_id = ?
        LIMIT 1
      `,
      [reportId]
    );

    if (importLink?.batch_id) {
      const importBatch = await priceImportBatchById(importLink.batch_id);
      const owner = await proofRewardOwner(importBatch, request.adminUser);

      if (owner) {
        const updatedReportForCorrection = await get(
          `
            ${reportSelectWithProduct()}
            WHERE pr.id = ?
          `,
          [reportId]
        );

        await createUserNotification(
          owner.id,
          "proof_price_corrected",
          "Price corrected",
          "A price from your proof was corrected by admin.",
          {
            related_type: "report",
            related_id: reportId,
            related_report_id: reportId,
            related_import_batch_id: importBatch.id,
            related_import_row_id: importLink.id,
            target_tab: "profile",
            target_url: `/?tab=accountView&section=proof&proof=${importBatch.id}&report=${reportId}`
          }
        );
        await awardProofReward({
          batch: importBatch,
          row: importLink,
          report: updatedReportForCorrection,
          adminUser: request.adminUser,
          action: "verified_correction",
          requestedPoints: POINTS.verified_correction,
          reason: "Verified correction from proof",
          adminNote: `Admin corrected report #${reportId}.`
        });
      }
    }
  }

  if (approveAfterEdit) {
    const updatedReport = await get(
      `
        ${reportSelectWithProduct()}
        WHERE pr.id = ?
      `,
      [reportId]
    );

    await organizeApprovedReportProduct(updatedReport, adminId);
    await createUserNotification(
      report.user_id,
      "report_approved",
      "Your price was approved.",
      `Your ${cleanReport.item_name} report is now public as a cheapest reported price.`,
      {
        related_type: "report",
        related_id: reportId,
        target_tab: "myReports",
        target_url: `/?tab=accountView&section=reports&report=${reportId}`
      }
    );
    await notifyCartUsersForApprovedReport(updatedReport);
  }

  const authoritativeReport = await get(`${reportSelectWithProduct()} WHERE pr.id = ?`, [reportId]);
  response.json({
    message: approveAfterEdit ? "Report edited and approved." : "Report edits saved.",
    unit_price_label: formatUnitPrice(authoritativeReport?.comparison_price ?? authoritativeReport?.unit_price, authoritativeReport?.comparison_unit || authoritativeReport?.unit),
    report: authoritativeReport ? formatPublicReport(authoritativeReport) : null
  });
}));

app.get("/api/admin/stores", requireAdminAccess, asyncRoute(async (request, response) => {
  const stores = await all(
    `
      SELECT
        stores.*,
        COUNT(price_reports.id) AS report_count
      FROM stores
      LEFT JOIN price_reports ON price_reports.store_id = stores.id
      GROUP BY stores.id
      ORDER BY stores.active DESC, stores.name ASC
    `
  );
  const requests = await all(
    `
      SELECT
        sr.*,
        users.username AS username,
        users.email AS user_email,
        reviewer.username AS reviewed_by_username
      FROM store_requests sr
      JOIN users ON users.id = sr.requested_by_user_id
      LEFT JOIN users reviewer ON reviewer.id = sr.reviewed_by
      ORDER BY sr.created_at DESC
    `
  );

  response.json({
    stores: stores.map(formatStore),
    store_requests: requests.map(formatStoreRequest)
  });
}));

app.post("/api/admin/stores", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const store = validateAdminStore(request.body);
  const result = await run(
    `
      INSERT INTO stores (name, address, city, state, store_type, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      store.name,
      store.address,
      store.city,
      store.state,
      store.store_type,
      store.active,
      new Date().toISOString()
    ]
  );

  response.status(201).json({
    message: "Store added.",
    store_id: result.lastID
  });
}));

app.post("/api/admin/stores/:id", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const storeId = Number.parseInt(request.params.id, 10);
  const existing = await get(
    `
      SELECT
        stores.*,
        COUNT(price_reports.id) AS report_count
      FROM stores
      LEFT JOIN price_reports ON price_reports.store_id = stores.id
      WHERE stores.id = ?
      GROUP BY stores.id
    `,
    [storeId]
  );

  if (!existing) {
    response.status(404).json({ error: "Store was not found." });
    return;
  }

  if (request.body.action === "disable" && existing.report_count > 0) {
    await run("UPDATE stores SET active = 0 WHERE id = ?", [storeId]);
    response.json({ message: "Store disabled. Existing reports remain for audit." });
    return;
  }

  if (request.body.action === "enable") {
    await run("UPDATE stores SET active = 1 WHERE id = ?", [storeId]);
    response.json({ message: "Store enabled." });
    return;
  }

  const store = validateAdminStore({
    name: request.body.name ?? existing.name,
    address: request.body.address ?? existing.address,
    city: request.body.city ?? existing.city,
    state: request.body.state ?? existing.state,
    store_type: request.body.store_type ?? existing.store_type,
    active: Object.prototype.hasOwnProperty.call(request.body, "active")
      ? request.body.active
      : existing.active
  });

  await run(
    `
      UPDATE stores
      SET name = ?,
          address = ?,
          city = ?,
          state = ?,
          store_type = ?,
          active = ?
      WHERE id = ?
    `,
    [store.name, store.address, store.city, store.state, store.store_type, store.active, storeId]
  );

  response.json({ message: "Store updated." });
}));

app.post("/api/admin/store-requests/:id/status", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const requestId = Number.parseInt(request.params.id, 10);
  const status = validateStoreRequestStatus(request.body.status);
  const storeRequest = await get("SELECT * FROM store_requests WHERE id = ?", [requestId]);

  if (!storeRequest) {
    response.status(404).json({ error: "Store request was not found." });
    return;
  }

  let createdStoreId = null;

  if (status === "approved") {
    const existingStore = await get(
      "SELECT id FROM stores WHERE lower(name) = lower(?)",
      [storeRequest.store_name]
    );

    if (existingStore) {
      response.status(409).json({ error: "A store with this name already exists. Mark the request duplicate if needed." });
      return;
    }

    const result = await run(
      `
        INSERT INTO stores (name, address, city, state, store_type, active, created_at)
        VALUES (?, ?, ?, 'WI', 'grocery', 1, ?)
      `,
      [
        storeRequest.store_name,
        storeRequest.address || "",
        storeRequest.city || "Janesville",
        new Date().toISOString()
      ]
    );
    createdStoreId = result.lastID;
  }

  await run(
    `
      UPDATE store_requests
      SET status = ?,
          admin_note = ?,
          reviewed_by = ?,
          reviewed_at = ?
      WHERE id = ?
    `,
    [
      status,
      cleanText(request.body.admin_note, 500),
      request.adminUser ? request.adminUser.id : null,
      new Date().toISOString(),
      requestId
    ]
  );

  await createUserNotification(
    storeRequest.requested_by_user_id,
    `store_request_${status}`,
    `Your store request was marked ${status}.`,
    status === "approved"
      ? `${storeRequest.store_name} was approved and added to the store list.`
      : `${storeRequest.store_name} was marked ${status}.`,
    {
      related_type: "store_request",
      related_id: requestId,
      target_tab: status === "approved" ? "submitView" : "accountView",
      target_url: status === "approved" ? "/?tab=submitView" : "/?tab=accountView&section=notifications"
    }
  );

  response.json({
    message: status === "approved" ? "Store request approved and store created." : `Store request marked ${status}.`,
    store_id: createdStoreId
  });
}));

app.get("/api/admin/suggestions", requireAdminAccess, asyncRoute(async (request, response) => {
  const suggestions = await all(
    `
      SELECT
        suggestions.*,
        users.username AS username,
        users.email AS user_email,
        reviewer.username AS reviewed_by_username
      FROM suggestions
      JOIN users ON users.id = suggestions.user_id
      LEFT JOIN users reviewer ON reviewer.id = suggestions.reviewed_by
      ORDER BY suggestions.created_at DESC
    `
  );

  response.json({
    suggestion_types: SUGGESTION_TYPES,
    suggestions: suggestions.map(formatSuggestion)
  });
}));

app.post("/api/admin/suggestions/:id/status", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const suggestionId = Number.parseInt(request.params.id, 10);
  const status = validateSuggestionStatus(request.body.status);
  const suggestion = await get("SELECT * FROM suggestions WHERE id = ?", [suggestionId]);

  if (!suggestion) {
    response.status(404).json({ error: "Suggestion was not found." });
    return;
  }

  await run(
    `
      UPDATE suggestions
      SET status = ?,
          admin_note = ?,
          reviewed_by = ?,
          reviewed_at = ?
      WHERE id = ?
    `,
    [
      status,
      cleanText(request.body.admin_note, 500),
      request.adminUser ? request.adminUser.id : null,
      new Date().toISOString(),
      suggestionId
    ]
  );

  await createUserNotification(
    suggestion.user_id,
    `suggestion_${status}`,
    `Your suggestion was marked ${status}.`,
    suggestion.admin_note
      ? `Admin reviewed "${suggestion.title}" and marked it ${status}.`
      : `"${suggestion.title}" was marked ${status}.`,
    {
      related_type: "suggestion",
      related_id: suggestionId,
      target_tab: "accountView",
      target_url: "/?tab=accountView&section=notifications"
    }
  );

  response.json({ message: `Suggestion marked ${status}.` });
}));

app.get("/api/admin/product-tools", requireAdminAccess, asyncRoute(async (request, response) => {
  const products = await all(
    `
      SELECT ${productSelectColumns("products")}
      FROM products
      ORDER BY
        CASE products.status
          WHEN 'needs_review' THEN 0
          WHEN 'active' THEN 1
          WHEN 'hidden' THEN 2
          ELSE 3
        END,
        products.updated_at DESC
      LIMIT 200
    `
  );
  const unlinkedReports = await all(
    `
      ${reportSelectWithProduct()}
      WHERE pr.status IN ('pending', 'approved')
        AND (
          pr.product_id IS NULL
          OR COALESCE(pr.size_text, '') = ''
          OR COALESCE(pr.category, '') = ''
        )
      ORDER BY pr.submitted_at DESC
      LIMIT 60
    `
  );
  const productInfoNeeds = await all(
    `
      ${reportSelectWithProduct()}
      WHERE pr.status = 'approved'
        AND pr.product_id IS NOT NULL
        AND (
          COALESCE(products.ingredient_info_url, '') = ''
          OR COALESCE(products.allergen_note, '') = ''
          OR COALESCE(products.default_size_text, '') = ''
        )
      ORDER BY pr.submitted_at DESC
      LIMIT 60
    `
  );
  const popularCartItems = await all(
    `
      SELECT
        cart_items.item_name,
        cart_items.product_id,
        products.display_name AS product_display_name,
        COUNT(*) AS count
      FROM cart_items
      LEFT JOIN products ON products.id = cart_items.product_id
      GROUP BY lower(item_name)
      ORDER BY count DESC, item_name ASC
      LIMIT 20
    `
  );
  const productIds = products.map((product) => product.id);
  const productImages = productIds.length ? await all(`SELECT id, product_id, alt_text, source_type, source_note, status, is_primary, uploaded_by, moderated_by, moderated_at, created_at FROM product_images WHERE product_id IN (${productIds.map(() => "?").join(",")}) ORDER BY product_id, is_primary DESC, id ASC`, productIds) : [];
  const imagesByProduct = new Map();
  for (const image of productImages) {
    const list = imagesByProduct.get(image.product_id) || [];
    list.push({ ...image, image_url: image.status === "approved" ? `/api/product-images/${image.id}/file` : `/api/admin/product-images/${image.id}/file` });
    imagesByProduct.set(image.product_id, list);
  }
  const formattedProducts = products.map((product) => {
    const images = imagesByProduct.get(product.id) || [];
    const primaryImage = images.find((image) => image.status === "approved" && image.is_primary) || null;
    return { ...formatProduct(product), images, primary_image: primaryImage, missing_primary_image: !primaryImage };
  });

  response.json({
    message: "Product tools help organize real user reports into admin-controlled products.",
    product_statuses: PRODUCT_STATUSES,
    products: formattedProducts,
    missing_photo_count: formattedProducts.filter((product) => (product.status === "active" || product.approved_price_count > 0) && product.missing_primary_image).length,
    pending_product_candidates: products.filter((product) => product.status === "needs_review").map(formatProduct),
    unlinked_reports: unlinkedReports.map(formatReport),
    reports_missing_product_info: productInfoNeeds.map(formatReport),
    popular_cart_items: popularCartItems
  });
}));

app.post("/api/admin/products", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const product = validateProduct(request.body, { defaultActive: true });
  const now = new Date().toISOString();
  const requestedBarcode = await assertBarcodeAvailable(null, request.body.upc);
  const result = await run(
    `
      INSERT INTO products (
        canonical_name,
        display_name,
        category,
        default_size_text,
        default_quantity,
        default_unit,
        brand_optional,
        preferred_brand,
        variant,
        upc,
        description,
        common_aliases,
        ingredient_info_url,
        allergen_note,
        admin_safety_note,
        status,
        created_by_admin_id,
        admin_note,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      product.canonical_name,
      product.display_name,
      product.category,
      product.default_size_text,
      product.default_quantity,
      product.default_unit,
      product.brand_optional,
      product.preferred_brand,
      cleanText(request.body.variant, 100),
      cleanText(request.body.upc, 40),
      cleanText(request.body.description, 1000),
      product.common_aliases,
      product.ingredient_info_url,
      product.allergen_note,
      product.admin_safety_note,
      product.status,
      request.adminUser ? request.adminUser.id : null,
      product.admin_note,
      request.adminUser ? request.adminUser.id : null,
      now,
      now
    ]
  );

  if (requestedBarcode) await assignBarcodeToProduct(result.lastID, requestedBarcode.value, request.adminUser?.id, "staff");

  response.status(201).json({
    message: "Product created.",
    product_id: result.lastID
  });
}));

app.post("/api/admin/products/:id", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const productId = Number.parseInt(request.params.id, 10);
  const existing = await get("SELECT * FROM products WHERE id = ?", [productId]);

  if (!existing) {
    response.status(404).json({ error: "Product was not found." });
    return;
  }

  const product = validateProduct({
    canonical_name: request.body.canonical_name ?? existing.canonical_name,
    display_name: request.body.display_name ?? existing.display_name,
    category: request.body.category ?? existing.category,
    default_size_text: request.body.default_size_text ?? existing.default_size_text,
    default_quantity: request.body.default_quantity ?? existing.default_quantity,
    default_unit: request.body.default_unit ?? existing.default_unit,
    brand_optional: request.body.brand_optional ?? existing.brand_optional,
    preferred_brand: request.body.preferred_brand ?? existing.preferred_brand,
    common_aliases: request.body.common_aliases ?? existing.common_aliases,
    ingredient_info_url: request.body.ingredient_info_url ?? existing.ingredient_info_url,
    allergen_note: request.body.allergen_note ?? existing.allergen_note,
    admin_safety_note: request.body.admin_safety_note ?? existing.admin_safety_note,
    status: request.body.status ?? existing.status,
    admin_note: request.body.admin_note ?? existing.admin_note
  });
  const now = new Date().toISOString();
  const requestedBarcode = await assertBarcodeAvailable(productId, request.body.upc ?? existing.upc);

  await run(
    `
      UPDATE products
      SET canonical_name = ?,
          display_name = ?,
          category = ?,
          default_size_text = ?,
          default_quantity = ?,
          default_unit = ?,
          brand_optional = ?,
          preferred_brand = ?,
          variant = ?,
          upc = ?,
          description = ?,
          common_aliases = ?,
          ingredient_info_url = ?,
          allergen_note = ?,
          admin_safety_note = ?,
          status = ?,
          admin_note = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [
      product.canonical_name,
      product.display_name,
      product.category,
      product.default_size_text,
      product.default_quantity,
      product.default_unit,
      product.brand_optional,
      product.preferred_brand,
      cleanText(request.body.variant ?? existing.variant, 100),
      cleanText(request.body.upc ?? existing.upc, 40),
      cleanText(request.body.description ?? existing.description, 1000),
      product.common_aliases,
      product.ingredient_info_url,
      product.allergen_note,
      product.admin_safety_note,
      product.status,
      product.admin_note,
      request.adminUser ? request.adminUser.id : null,
      now,
      productId
    ]
  );

  if (requestedBarcode) await assignBarcodeToProduct(productId, requestedBarcode.value, request.adminUser?.id, "staff");

  response.json({ message: "Product updated." });
}));

app.post("/api/admin/products/:id/merge", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const sourceId = Number.parseInt(request.params.id, 10);
  const targetId = Number.parseInt(request.body.target_product_id, 10);
  const adminNote = cleanText(request.body.admin_note, 500);

  if (!Number.isInteger(sourceId) || !Number.isInteger(targetId) || sourceId === targetId) {
    response.status(400).json({ error: "Choose two different products to merge." });
    return;
  }

  const source = await get("SELECT * FROM products WHERE id = ?", [sourceId]);
  const target = await get("SELECT * FROM products WHERE id = ?", [targetId]);

  if (!source || !target || target.status === "hidden" || target.status === "merged") {
    response.status(400).json({ error: "Both products must exist and the target must be active or needs review." });
    return;
  }

  const [sourceBarcodes, targetBarcodes] = await Promise.all([
    all("SELECT normalized_value FROM product_barcodes WHERE product_id = ? AND status = 'verified'", [sourceId]),
    all("SELECT normalized_value FROM product_barcodes WHERE product_id = ? AND status = 'verified'", [targetId])
  ]);
  const sourceValues = new Set(sourceBarcodes.map((row) => row.normalized_value));
  const targetValues = new Set(targetBarcodes.map((row) => row.normalized_value));
  if (sourceValues.size && targetValues.size && [...sourceValues].some((value) => !targetValues.has(value))) {
    response.status(409).json({ error: "Merge blocked: these products have conflicting verified barcodes. Resolve the UPC conflict first." });
    return;
  }

  const now = new Date().toISOString();
  const aliases = [...new Set([target.display_name, source.display_name, ...String(target.common_aliases || "").split(","), ...String(source.common_aliases || "").split(",")].map((value) => cleanText(value, 160)).filter(Boolean))].join(", ");
  await run("BEGIN IMMEDIATE");
  try {
    await run("UPDATE price_reports SET product_id = ? WHERE product_id = ?", [targetId, sourceId]);
    await run("UPDATE price_import_rows SET product_id = ? WHERE product_id = ?", [targetId, sourceId]);
    await run("UPDATE cart_items SET product_id = ? WHERE product_id = ?", [targetId, sourceId]);
    await run("UPDATE quality_reviews SET product_id = ? WHERE product_id = ?", [targetId, sourceId]);
    await run("UPDATE product_normalization_rules SET product_id = ?, updated_at = ? WHERE product_id = ?", [targetId, now, sourceId]);
    await run("UPDATE search_aliases SET product_id = ?, updated_at = ? WHERE product_id = ?", [targetId, now, sourceId]);
    await run("UPDATE product_barcodes SET product_id = ?, updated_at = ? WHERE product_id = ?", [targetId, now, sourceId]);
    const targetPrimary = await get("SELECT id FROM product_images WHERE product_id = ? AND status = 'approved' AND is_primary = 1 LIMIT 1", [targetId]);
    if (targetPrimary) await run("UPDATE product_images SET is_primary = 0 WHERE product_id = ?", [sourceId]);
    await run("UPDATE product_images SET product_id = ?, updated_at = ? WHERE product_id = ?", [targetId, now, sourceId]);
    await run("UPDATE product_image_upload_items SET suggested_product_id = ? WHERE suggested_product_id = ?", [targetId, sourceId]);
    await run("UPDATE catalog_import_rows SET suggested_product_id = ? WHERE suggested_product_id = ?", [targetId, sourceId]);
    await run("UPDATE catalog_import_rows SET duplicate_product_id = ? WHERE duplicate_product_id = ?", [targetId, sourceId]);
    await run("UPDATE products SET common_aliases = ?, updated_by = ?, updated_at = ? WHERE id = ?", [aliases, request.adminUser.id, now, targetId]);
    await run("UPDATE products SET status = 'merged', merged_into_product_id = ?, admin_note = ?, updated_by = ?, updated_at = ? WHERE id = ?", [targetId, adminNote, request.adminUser.id, now, sourceId]);
    await run("INSERT INTO product_merge_events (source_product_id, target_product_id, merged_by, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)", [sourceId, targetId, request.adminUser.id, adminNote || "Confirmed duplicate product", JSON.stringify({ preserved: ["prices", "historical prices", "proof links", "aliases", "barcodes", "images", "quality reviews", "lists", "provenance"] }), now]);
    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    throw error;
  }
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: "PRODUCT_MERGED", affectedType: "product", affectedId: sourceId, metadata: { canonical_product_id: targetId, reason: adminNote } });
  response.json({ message: "Product merged safely. History and linked data now resolve to the canonical product.", source_product_id: sourceId, canonical_product_id: targetId });
}));

app.post("/api/admin/reports/:id/link-product", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10);
  const action = cleanText(request.body.action || "link", 30);
  const report = await get("SELECT * FROM price_reports WHERE id = ?", [reportId]);

  if (!report) {
    response.status(404).json({ error: "Report was not found." });
    return;
  }

  if (action === "unlink") {
    await run(
      "UPDATE price_reports SET product_id = NULL, edited_by = ?, edited_at = ?, admin_edit_note = ? WHERE id = ?",
      [
        request.adminUser ? request.adminUser.id : null,
        new Date().toISOString(),
        cleanText(request.body.admin_note || "Unlinked from product", 500),
        reportId
      ]
    );
    response.json({ message: "Report unlinked from product." });
    return;
  }

  let productId = Number.parseInt(request.body.product_id, 10);

  if (action === "create") {
    const product = validateProduct({
      canonical_name: request.body.canonical_name || report.item_name,
      display_name: request.body.display_name || report.item_name,
      category: request.body.category || report.category,
      default_size_text: request.body.default_size_text || report.size_text,
      default_quantity: request.body.default_quantity || report.quantity,
      default_unit: request.body.default_unit || report.unit,
      preferred_brand: request.body.preferred_brand || report.brand,
      common_aliases: request.body.common_aliases || report.item_name,
      ingredient_info_url: request.body.ingredient_info_url || report.ingredient_info_url,
      allergen_note: request.body.allergen_note || report.allergen_note,
      admin_safety_note: request.body.admin_safety_note || report.admin_safety_note,
      status: request.body.status || "active",
      admin_note: request.body.admin_note
    }, { defaultActive: true });
    const now = new Date().toISOString();
    const result = await run(
      `
        INSERT INTO products (
          canonical_name,
          display_name,
          category,
          default_size_text,
          default_quantity,
          default_unit,
          brand_optional,
          preferred_brand,
          common_aliases,
          ingredient_info_url,
          allergen_note,
          admin_safety_note,
          status,
          created_by_admin_id,
          admin_note,
          updated_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        product.canonical_name,
        product.display_name,
        product.category,
        product.default_size_text,
        product.default_quantity,
        product.default_unit,
        product.brand_optional,
        product.preferred_brand,
        product.common_aliases,
        product.ingredient_info_url,
        product.allergen_note,
        product.admin_safety_note,
        product.status,
        request.adminUser ? request.adminUser.id : null,
        product.admin_note,
        request.adminUser ? request.adminUser.id : null,
        now,
        now
      ]
    );
    productId = result.lastID;
  }

  const product = await getProductById(productId, true);

  if (!product || product.status === "hidden" || product.status === "merged") {
    response.status(400).json({ error: "Selected product is not available." });
    return;
  }

  await run(
    "UPDATE price_reports SET product_id = ?, edited_by = ?, edited_at = ?, admin_edit_note = ? WHERE id = ?",
    [
      productId,
      request.adminUser ? request.adminUser.id : null,
      new Date().toISOString(),
      cleanText(request.body.admin_note || "Linked to product", 500),
      reportId
    ]
  );

  response.json({
    message: action === "create" ? "Product created and report linked." : "Report linked to product.",
    product_id: productId
  });
}));

app.post("/api/admin/users/:id/reset-password", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT id, username, email FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const hasProvidedPassword = typeof request.body.newPassword === "string" &&
    request.body.newPassword.length > 0;
  const temporaryPassword = hasProvidedPassword
    ? request.body.newPassword
    : generateTemporaryPassword();
  const validPassword = validatePassword(temporaryPassword);
  const passwordHash = await bcrypt.hash(validPassword, 12);

  await run(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    [passwordHash, user.id]
  );

  response.json({
    message: hasProvidedPassword
      ? "Temporary password saved."
      : "Temporary password generated. Show it once and copy it now.",
    generated: !hasProvidedPassword,
    temporary_password: hasProvidedPassword ? undefined : temporaryPassword
  });
}));

app.post("/api/admin/users/:id/profile", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT * FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(request.body, "username")) {
    const username = validateUsername(request.body.username);
    const existing = await get(
      "SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?",
      [username, userId]
    );

    if (existing) {
      response.status(409).json({ error: "Username is already registered." });
      return;
    }

    updates.push("username = ?");
    params.push(username);
  }

  if (Object.prototype.hasOwnProperty.call(request.body, "email")) {
    if (request.body.confirm_email_edit !== "EDIT EMAIL") {
      response.status(400).json({ error: "Type EDIT EMAIL to confirm changing a user's email." });
      return;
    }

    const email = validateEmail(request.body.email);
    const existing = await get(
      "SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?",
      [email, userId]
    );

    if (existing) {
      response.status(409).json({ error: "Email is already registered." });
      return;
    }

    updates.push("email = ?");
    params.push(email);
  }

  if (Object.prototype.hasOwnProperty.call(request.body, "admin_note")) {
    updates.push("admin_note = ?");
    params.push(cleanText(request.body.admin_note, 1000));
  }

  if (!updates.length) {
    response.status(400).json({ error: "No profile updates were provided." });
    return;
  }

  params.push(userId);
  await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  response.json({ message: "User profile updated." });
}));

app.post("/api/admin/users/:id/notes", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT id FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const noteType = cleanText(request.body.note_type || "other", 80);
  const note = cleanText(request.body.note, 1000);

  if (!note) {
    response.status(400).json({ error: "Admin note is required." });
    return;
  }

  await run(
    `
      INSERT INTO user_admin_notes (user_id, admin_user_id, note_type, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      userId,
      request.adminUser ? request.adminUser.id : null,
      noteType,
      note,
      new Date().toISOString()
    ]
  );
  await run("UPDATE users SET admin_note = ? WHERE id = ?", [note, userId]);

  response.status(201).json({ message: "Admin note saved." });
}));

app.post("/api/admin/users/:id/flags", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT id, username, is_admin FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(request.body, "is_email_verified")) {
    updates.push("is_email_verified = ?");
    params.push(request.body.is_email_verified ? 1 : 0);
  }

  if (Object.prototype.hasOwnProperty.call(request.body, "is_admin")) {
    response.status(400).json({
      error: "Use Admin Access Cleanup for admin role changes. PIN fallback cannot change admin access."
    });
    return;
  }

  if (!updates.length) {
    response.status(400).json({ error: "No user flags were provided." });
    return;
  }

  params.push(userId);
  await run(
    `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = ?
    `,
    params
  );

  response.json({ message: "User account flags updated." });
}));

app.get("/api/admin/users/:id/points", requireAdminAccess, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT id, username, points FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const events = await all(
    `
      SELECT
        point_events.*,
        admin.username AS created_by_admin_username
      FROM point_events
      LEFT JOIN users admin ON admin.id = point_events.created_by_admin_id
      WHERE point_events.user_id = ?
      ORDER BY point_events.created_at DESC
      LIMIT 100
    `,
    [userId]
  );

  response.json({
    user: {
      id: user.id,
      username: user.username,
      points: user.points
    },
    events
  });
}));

app.post("/api/admin/users/:id/points", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT * FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  const points = Number.parseInt(request.body.points, 10);
  const reason = cleanText(request.body.reason, 300);
  const adminNote = cleanText(request.body.admin_note || request.body.adminNote, 500);

  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1000) {
    response.status(400).json({ error: "Point adjustment must be a nonzero integer between -1000 and 1000." });
    return;
  }

  if (!reason) {
    response.status(400).json({ error: "A reason is required for manual point adjustments." });
    return;
  }

  await addPointEvent(user.id, "admin_manual_point_adjustment", points, null, {
    reason,
    created_by_admin_id: request.adminUser ? request.adminUser.id : null,
    admin_note: adminNote
  });

  await createUserNotification(
    user.id,
    "points_adjusted_by_admin",
    "Points adjusted",
    `Admin adjusted your points by ${points > 0 ? "+" : ""}${points}.`,
    {
      points_awarded: points,
      target_tab: "profile",
      target_url: "/?tab=accountView&section=notifications"
    }
  );

  const updatedUser = await get("SELECT id, username, points FROM users WHERE id = ?", [user.id]);

  response.json({
    message: "Point adjustment saved.",
    user: updatedUser
  });
}));

app.post("/api/admin/users/:id/reset-points", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const user = await get("SELECT * FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  if (user.points !== 0) {
    await addPointEvent(user.id, "admin_reset_points", -user.points, null);
  }

  await run("UPDATE users SET points = 0 WHERE id = ?", [user.id]);
  response.json({ message: "User points reset." });
}));

app.post("/api/admin/users/:id/moderation", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const userId = Number.parseInt(request.params.id, 10);
  const action = cleanText(request.body.action, 40).toLowerCase();
  const user = await get("SELECT * FROM users WHERE id = ?", [userId]);

  if (!user) {
    response.status(404).json({ error: "User was not found." });
    return;
  }

  let message = "User moderation updated.";
  let emailWarning = null;

  if (["active", "warning", "suspended", "banned", "deleted", "deactivated"].includes(action)) {
    const status = validateAccountStatus(action);
    let ban = { reason: null, note: null };
    let bannedAt = null;
    let bannedBy = null;

    if (["deleted", "deactivated"].includes(status) && !isSuperAdminAccount(request.adminUser)) {
      response.status(403).json({ error: "Super Admin access is required to delete or deactivate users." });
      return;
    }

    if (isOwnerAccount(user) && status !== "active") {
      response.status(400).json({ error: "The bootstrap Super Admin account cannot be moderated to a blocked status." });
      return;
    }

    if (status === "banned") {
      ban = validateBanDetails(request.body);
      bannedAt = new Date().toISOString();
      bannedBy = request.adminUser ? request.adminUser.id : null;
    }

    await run(
      `
        UPDATE users
        SET account_status = ?,
            ban_reason = ?,
            ban_note = ?,
            banned_at = ?,
            banned_by = ?
        WHERE id = ?
      `,
      [
        status,
        status === "banned" ? ban.reason : null,
        status === "banned" ? ban.note : null,
        bannedAt,
        bannedBy,
        userId
      ]
    );

    if (status === "deleted" || status === "deactivated") {
      await run(
        "UPDATE users SET hide_from_leaderboard = 1 WHERE id = ?",
        [userId]
      );
    }

    if (status === "banned") {
      const banEmail = await sendAccountBanEmail(user, ban);
      emailWarning = banEmail.warning;
    }

    message = `User marked ${status}.`;
  } else if (action === "hide_leaderboard") {
    await run("UPDATE users SET hide_from_leaderboard = 1 WHERE id = ?", [userId]);
    message = "User hidden from leaderboard.";
  } else if (action === "show_leaderboard") {
    await run("UPDATE users SET hide_from_leaderboard = 0 WHERE id = ?", [userId]);
    message = "User restored to leaderboard eligibility.";
  } else if (action === "force_username_change") {
    const reason = cleanText(request.body.reason || "Username did not meet community standards.", 300);
    await run(
      "UPDATE users SET force_username_change = 1, hide_from_leaderboard = 1, username_status = 'needs_change', username_moderation_note = ? WHERE id = ?",
      [reason, userId]
    );
    await run(
      `INSERT INTO username_history
        (user_id, old_username, new_username, action, reason, changed_by_admin_id, created_at)
       VALUES (?, ?, ?, 'force_change', ?, ?, ?)`,
      [userId, user.username, user.username, reason, request.adminUser?.id || null, new Date().toISOString()]
    );
    await createUserNotification(
      userId,
      "username_change_required",
      "Choose a new username",
      "Your username needs to be changed before you can appear on leaderboards.",
      { related_type: "user", related_id: userId, target_tab: "accountView", target_url: "/?tab=accountView&section=username" }
    );
    message = "Username change flag set.";
  } else if (action === "clear_username_change") {
    const restoreLeaderboard = user.force_username_change || user.username_status === "needs_change";
    await run(
      "UPDATE users SET force_username_change = 0, username_status = 'approved', username_moderation_note = NULL, hide_from_leaderboard = CASE WHEN ? THEN 0 ELSE hide_from_leaderboard END WHERE id = ?",
      [restoreLeaderboard ? 1 : 0, userId]
    );
    message = "Username change flag cleared.";
  } else if (action === "approve_username") {
    const reason = await usernameModerationReason(user.username);
    if (reason) {
      response.status(400).json({ error: `Username cannot be approved: ${reason}` });
      return;
    }
    const restoreLeaderboard = user.force_username_change || user.username_status === "needs_change";
    await run(
      "UPDATE users SET force_username_change = 0, username_status = 'approved', username_moderation_note = NULL, hide_from_leaderboard = CASE WHEN ? THEN 0 ELSE hide_from_leaderboard END WHERE id = ?",
      [restoreLeaderboard ? 1 : 0, userId]
    );
    message = "Username approved.";
  } else {
    response.status(400).json({ error: "Moderation action is not valid." });
    return;
  }

  if (["warning", "suspended", "banned", "deactivated"].includes(action)) {
    await createUserNotification(
      userId,
      `account_${action}`,
      `Account ${action} notice`,
      action === "warning"
        ? "Admin added a warning to your account. Check community rules before submitting more reports."
        : `Your account was marked ${action}. Contact admin if you think this is a mistake.`,
      {
        related_type: "user",
        related_id: userId,
        target_tab: "accountView",
        target_url: "/?tab=accountView&section=notifications"
      }
    );
  }

  response.json({
    message,
    warning: emailWarning
  });
}));

app.get("/api/admin/username-moderation", requireAdminAccess, asyncRoute(async (request, response) => {
  const phrases = await all(
    `SELECT blocked_username_phrases.id, blocked_username_phrases.phrase,
            blocked_username_phrases.reason, blocked_username_phrases.created_at,
            users.username AS created_by_username
     FROM blocked_username_phrases
     LEFT JOIN users ON users.id = blocked_username_phrases.created_by_admin_id
     ORDER BY blocked_username_phrases.phrase`
  );
  response.json({ phrases });
}));

app.post("/api/admin/username-moderation/phrases", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const phrase = cleanText(request.body.phrase, 80).toLowerCase();
  const reason = cleanText(request.body.reason || "Blocked by username moderation.", 300);
  if (!phrase || phrase.length < 2) {
    response.status(400).json({ error: "Blocked phrase must be at least 2 characters." });
    return;
  }
  await run(
    `INSERT INTO blocked_username_phrases (phrase, reason, created_by_admin_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(phrase) DO UPDATE SET reason = excluded.reason`,
    [phrase, reason, request.adminUser?.id || null, new Date().toISOString()]
  );
  response.status(201).json({ message: "Blocked username phrase saved." });
}));

app.delete("/api/admin/username-moderation/phrases/:id", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  await run("DELETE FROM blocked_username_phrases WHERE id = ?", [Number.parseInt(request.params.id, 10)]);
  response.json({ message: "Blocked username phrase removed." });
}));

app.get("/api/admin/users/:id/username-history", requireAdminAccess, asyncRoute(async (request, response) => {
  const history = await all(
    `SELECT username_history.*, users.username AS changed_by_admin_username
     FROM username_history
     LEFT JOIN users ON users.id = username_history.changed_by_admin_id
     WHERE username_history.user_id = ?
     ORDER BY username_history.created_at DESC`,
    [Number.parseInt(request.params.id, 10)]
  );
  response.json({ history });
}));

function diskHealth() {
  try {
    const stats = fs.statfsSync(DATA_DIR);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10 : null;
    return { status: usedPercent == null ? "unknown" : usedPercent >= 90 ? "critical" : usedPercent >= 80 ? "warning" : "normal", used_percent: usedPercent, free_bytes: freeBytes, total_bytes: totalBytes };
  } catch (error) {
    return { status: "unknown", used_percent: null, free_bytes: null, total_bytes: null, message: "Disk usage is unavailable on this runtime." };
  }
}

function attentionEntry(key, label, count, level, tab, filter, description = "") {
  const hasRecordQueue = !["disk_warning", "backup_warning"].includes(key);
  const targetPath = { inboxTab: "/admin/inbox", productToolsTab: "/admin/products", priceImporterTab: "/admin/imports", operationsTab: "/admin/operations", pricesTab: "/admin/prices" }[tab] || "/admin/attention";
  return {
    key,
    label,
    count: Number(count || 0),
    level,
    description,
    target: { tab, filter },
    href: hasRecordQueue
      ? `/admin/attention/${encodeURIComponent(key.replaceAll("_", "-"))}`
      : `${targetPath}?filter=${encodeURIComponent(filter || key)}`,
    workspace_href: `${targetPath}?filter=${encodeURIComponent(filter || key)}`
  };
}

async function attentionCenterSummary() {
  const agingCase = `CASE proof_type WHEN 'receipt_photo' THEN ${PRICE_FRESHNESS_DAYS.receipt_photo.aging} WHEN 'shelf_tag_photo' THEN ${PRICE_FRESHNESS_DAYS.shelf_tag_photo.aging} WHEN 'weekly_ad' THEN ${PRICE_FRESHNESS_DAYS.weekly_ad.aging} ELSE ${PRICE_FRESHNESS_DAYS.no_photo.aging} END`;
  const [proofs, prices, products, imports, system, activeReviewRows, lastBackup] = await Promise.all([
    get(`SELECT
      SUM(CASE WHEN COALESCE(review_status,'') NOT IN ('completed','rejected') AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN review_status = 'needs_help' THEN 1 ELSE 0 END) AS manager_help,
      SUM(CASE WHEN duplicate_of_batch_id IS NOT NULL AND status NOT IN ('duplicate','proof_rejected','rejected') THEN 1 ELSE 0 END) AS possible_duplicate,
      SUM(CASE WHEN status = 'duplicate' THEN 1 ELSE 0 END) AS duplicate_history,
      SUM(CASE WHEN status = 'reviewed_no_prices' THEN 1 ELSE 0 END) AS no_usable
      FROM price_import_batches WHERE notes LIKE ?`, [`${PROOF_SUBMISSION_NOTE_PREFIX}%`]),
    get(`SELECT
      SUM(CASE WHEN status = 'approved' AND COALESCE(price_type,'regular') = 'regular' AND datetime(COALESCE(NULLIF(source_date,''),NULLIF(source_checked_at,''),NULLIF(reviewed_at,''),submitted_at)) < datetime('now', '-' || (${agingCase}) || ' days') THEN 1 ELSE 0 END) AS stale,
      SUM(CASE WHEN status = 'approved' AND valid_through_date = ? THEN 1 ELSE 0 END) AS ending_today,
      (SELECT COUNT(*) FROM price_import_rows WHERE status NOT IN ('approved','rejected','removed') AND COALESCE(price_type,'regular') IN ('one_day_sale','digital_coupon','paper_coupon') AND (NULLIF(valid_from_date,'') IS NULL OR NULLIF(valid_through_date,'') IS NULL)) AS missing_date,
      (SELECT COUNT(*) FROM price_import_rows WHERE status NOT IN ('approved','rejected','removed') AND COALESCE(price_type,'regular') != 'regular' AND NULLIF(promotion_conditions,'') IS NULL) AS conditions_unclear,
      (SELECT COUNT(*) FROM price_import_rows WHERE status NOT IN ('approved','rejected','removed') AND store_id IS NULL) AS store_unresolved,
      (SELECT COUNT(*) FROM price_issue_reports WHERE status IN ('open','in_review')) AS reported
      FROM price_reports`, [localDateFor()]),
    get(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM price_reports pr WHERE pr.product_id = products.id AND ${publicPriceEligibilitySql("pr")}) THEN 1 ELSE 0 END) AS missing_price,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM product_images images WHERE images.product_id = products.id AND images.status = 'approved') THEN 1 ELSE 0 END) AS missing_photo,
      SUM(CASE WHEN NULLIF(category,'') IS NULL OR category = 'other' THEN 1 ELSE 0 END) AS missing_category,
      SUM(CASE WHEN NULLIF(default_size_text,'') IS NULL THEN 1 ELSE 0 END) AS missing_size,
      SUM(CASE WHEN NULLIF(upc,'') IS NULL AND NOT EXISTS (SELECT 1 FROM product_barcodes barcodes WHERE barcodes.product_id = products.id AND barcodes.status = 'verified') THEN 1 ELSE 0 END) AS missing_upc,
      (SELECT COUNT(*) FROM product_barcode_conflicts WHERE status = 'open') AS upc_conflicts,
      (SELECT COALESCE(SUM(group_count - 1),0) FROM (SELECT COUNT(*) AS group_count FROM products p WHERE p.status = 'active' GROUP BY lower(p.canonical_name), lower(COALESCE(p.preferred_brand,'')), lower(COALESCE(p.default_size_text,'')) HAVING COUNT(*) > 1)) AS possible_duplicates,
      (SELECT COUNT(*) FROM catalog_import_rows WHERE status = 'draft' AND suggested_product_id IS NULL AND duplicate_product_id IS NULL AND warnings_json != '[]') AS unmatched_catalog
      FROM products WHERE status = 'active'`),
    get(`SELECT
      (SELECT COUNT(*) FROM ai_proof_jobs WHERE status = 'ai_failed') AS ai_failed,
      (SELECT COUNT(*) FROM ai_proof_jobs WHERE status IN ('waiting','analyzing')) AS ai_waiting,
      (SELECT COUNT(*) FROM bulk_intake_batches WHERE paused = 1) AS paused,
      (SELECT COUNT(*) FROM bulk_intake_items WHERE status = 'duplicate') AS duplicate_screenshots,
      (SELECT COUNT(*) FROM bulk_intake_items WHERE status = 'failed') AS failed_import_items,
      (SELECT COUNT(*) FROM product_image_upload_items WHERE status = 'failed') AS failed_images,
      (SELECT COUNT(*) FROM product_image_upload_items WHERE status = 'needs_review' AND suggested_product_id IS NULL) AS unmatched_images`),
    get("SELECT COUNT(*) AS open_errors, SUM(CASE WHEN severity IN ('error','critical') THEN 1 ELSE 0 END) AS serious_errors FROM operations_errors WHERE status = 'open'"),
    activeProofReviewRows(),
    get("SELECT created_at FROM backup_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1")
  ]);
  const lifecycleCounts = activeReviewRows.reduce((counts, batch) => { const state = lifecycleFromInboxRow(batch).state; counts[state] = (counts[state] || 0) + 1; return counts; }, {});
  const arenaAttention = await get(`SELECT
    (SELECT COUNT(*) FROM price_reports reports WHERE reports.status = 'approved' AND (COALESCE(reports.proof_type,'') = 'store_page' OR NULLIF(reports.source_url,'') IS NOT NULL) AND reports.location_verification_status NOT IN ('verified_exact_store','verified_market')) AS location_unresolved,
    (SELECT COUNT(*) FROM products product WHERE product.status = 'active' AND NOT EXISTS (SELECT 1 FROM product_family_members member WHERE member.product_id = product.id AND member.human_confirmed = 1)) AS family_missing,
    ((SELECT COUNT(*) FROM product_substitutions WHERE status = 'suggested' OR confidence = 'low') + (SELECT COUNT(*) FROM product_family_members first JOIN product_family_members second ON second.family_id = first.family_id AND second.product_id != first.product_id WHERE first.human_confirmed = 1 AND second.human_confirmed = 1 AND NOT EXISTS (SELECT 1 FROM product_substitutions existing WHERE existing.source_product_id = first.product_id AND existing.target_product_id = second.product_id))) AS substitute_uncertain,
    (SELECT COUNT(*) FROM price_reports reports JOIN products product ON product.id = reports.product_id WHERE reports.status = 'approved' AND NULLIF(product.default_unit,'') IS NOT NULL AND NULLIF(COALESCE(NULLIF(reports.comparison_unit,''),reports.unit),'') IS NOT NULL AND lower(product.default_unit) != lower(COALESCE(NULLIF(reports.comparison_unit,''),reports.unit))) AS package_mismatch`);
  const disk = diskHealth();
  const backupWarning = !lastBackup || Date.now() - Date.parse(lastBackup.created_at) > 7 * 86400000;
  const groups = {
    proofs: [
      attentionEntry("proofs_ready", "Ready for review", Number(lifecycleCounts.REVIEWING || 0) + Number(lifecycleCounts.READY_TO_FINISH || 0), "needs_action", "inboxTab", "receipt"),
      attentionEntry("manager_help", "Manager help", lifecycleCounts.MANAGER_HELP, "needs_action", "inboxTab", "needs_help"),
      attentionEntry("store_unresolved", "Store unresolved", prices?.store_unresolved, "needs_action", "inboxTab", "store_unresolved"),
      attentionEntry("possible_duplicate_proof", "Possible duplicate", proofs?.possible_duplicate, "needs_action", "inboxTab", "possible_duplicate"),
      attentionEntry("ai_failed", "AI failed", imports?.ai_failed, "needs_action", "attentionCenterTab", "ai_failed"),
      attentionEntry("ai_zero_results", "AI zero results", lifecycleCounts.AI_ZERO_RESULTS, "needs_action", "inboxTab", "needs_help"),
      attentionEntry("ai_waiting", "AI queued or processing", imports?.ai_waiting, "waiting", "attentionCenterTab", "ai_waiting"),
      attentionEntry("no_usable_prices", "No usable prices", proofs?.no_usable, "cleanup", "attentionCenterTab", "no_usable_prices")
    ],
    prices: [
      attentionEntry("missing_sale_date", "Missing sale date", prices?.missing_date, "needs_action", "attentionCenterTab", "missing_sale_date"),
      attentionEntry("promotion_conditions", "Promotion conditions unclear", prices?.conditions_unclear, "needs_action", "attentionCenterTab", "promotion_conditions"),
      attentionEntry("stale_price", "Stale price", prices?.stale, "cleanup", "attentionCenterTab", "stale_price"),
      attentionEntry("reported_price", "Reported incorrect price", prices?.reported, "needs_action", "attentionCenterTab", "reported_price"),
      attentionEntry("location_unresolved", "Location needs review", arenaAttention?.location_unresolved, "needs_action", "attentionCenterTab", "location_unresolved"),
      attentionEntry("package_mismatch", "Comparison package mismatch", arenaAttention?.package_mismatch, "needs_action", "attentionCenterTab", "package_mismatch")
    ],
    products: [
      attentionEntry("missing_current_price", "Missing current price", products?.missing_price, "cleanup", "productToolsTab", "missing_current_price"),
      attentionEntry("missing_photo", "Missing photo", products?.missing_photo, "cleanup", "productToolsTab", "missing_photo"),
      attentionEntry("missing_category", "Missing category", products?.missing_category, "cleanup", "productToolsTab", "missing_category"),
      attentionEntry("missing_size", "Missing size", products?.missing_size, "cleanup", "productToolsTab", "missing_size"),
      attentionEntry("missing_upc", "Missing UPC", products?.missing_upc, "cleanup", "productToolsTab", "missing_upc"),
      attentionEntry("upc_conflict", "UPC assignment conflict", products?.upc_conflicts, "needs_action", "attentionCenterTab", "upc_conflict"),
      attentionEntry("possible_duplicate_product", "Possible duplicate product", products?.possible_duplicates, "cleanup", "attentionCenterTab", "possible_duplicate_product"),
      attentionEntry("unmatched_catalog", "Unmatched catalog item", products?.unmatched_catalog, "needs_action", "attentionCenterTab", "unmatched_catalog"),
      attentionEntry("family_missing", "Product family missing", arenaAttention?.family_missing, "cleanup", "attentionCenterTab", "family_missing"),
      attentionEntry("substitute_uncertain", "Substitute relationship uncertain", arenaAttention?.substitute_uncertain, "needs_action", "attentionCenterTab", "substitute_uncertain")
    ],
    import_ai: [
      attentionEntry("failed_import", "Failed bulk import item", imports?.failed_import_items, "needs_action", "attentionCenterTab", "failed_import"),
      attentionEntry("paused_batch", "Paused batch", imports?.paused, "waiting", "priceImporterTab", "paused"),
      attentionEntry("duplicate_screenshot", "Duplicate screenshot", imports?.duplicate_screenshots, "cleanup", "priceImporterTab", "duplicate"),
      attentionEntry("failed_image", "Image processing failure", imports?.failed_images, "needs_action", "attentionCenterTab", "failed_image"),
      attentionEntry("unmatched_image", "Unmatched image", imports?.unmatched_images, "needs_action", "attentionCenterTab", "unmatched_image")
    ],
    system: [
      attentionEntry("system_error", "Recent server error", system?.serious_errors, "system", "operationsTab", "errors"),
      attentionEntry("disk_warning", "Disk warning", ["warning","critical"].includes(disk.status) ? 1 : 0, "system", "operationsTab", "disk"),
      attentionEntry("backup_warning", "Backup warning", backupWarning ? 1 : 0, "system", "operationsTab", "backups")
    ]
  };
  const entries = Object.values(groups).flat();
  const queueCounts = await attentionQueueCounts(entries.map((item) => item.key));
  for (const item of entries) {
    if (Object.prototype.hasOwnProperty.call(queueCounts, item.key)) item.count = queueCounts[item.key];
  }
  return { groups, totals: { needs_action: entries.filter((item) => item.level === "needs_action").reduce((sum, item) => sum + item.count, 0), waiting: entries.filter((item) => item.level === "waiting").reduce((sum, item) => sum + item.count, 0), cleanup: entries.filter((item) => item.level === "cleanup").reduce((sum, item) => sum + item.count, 0), system: entries.filter((item) => item.level === "system").reduce((sum, item) => sum + item.count, 0) } };
}

function attentionQueueSql(key) {
  const productBase = "SELECT id, display_name AS title, category, default_size_text AS detail, updated_at FROM products WHERE status = 'active'";
  const queries = {
    proofs_ready: "SELECT id, COALESCE(batch_title, photo_original_name, 'Proof #' || id) AS title, COALESCE(review_status,status) AS detail, updated_at FROM price_import_batches WHERE review_status IN ('waiting','in_review','ready_to_finish') AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') ORDER BY updated_at",
    manager_help: "SELECT id, COALESCE(batch_title, photo_original_name, 'Proof #' || id) AS title, COALESCE(review_escalation_reason,'Manager decision required') AS detail, updated_at FROM price_import_batches WHERE review_status = 'needs_help' AND status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') ORDER BY updated_at",
    possible_duplicate_proof: "SELECT id, COALESCE(batch_title, photo_original_name, 'Proof #' || id) AS title, 'Possible duplicate of proof #' || duplicate_of_batch_id AS detail, updated_at FROM price_import_batches WHERE duplicate_of_batch_id IS NOT NULL AND status NOT IN ('duplicate','proof_rejected','rejected','reviewed_no_prices','proof_reviewed','completed') ORDER BY updated_at",
    no_usable_prices: "SELECT id, COALESCE(batch_title, photo_original_name, 'Proof #' || id) AS title, 'Reviewed with no usable prices' AS detail, updated_at FROM price_import_batches WHERE status = 'reviewed_no_prices' ORDER BY updated_at DESC",
    ai_zero_results: "SELECT proofs.id, COALESCE(proofs.batch_title, proofs.photo_original_name, 'Proof #' || proofs.id) AS title, 'AI prepared zero candidate prices; human confirmation required' AS detail, analyses.updated_at FROM ai_proof_analyses analyses JOIN price_import_batches proofs ON proofs.id = analyses.proof_id WHERE analyses.item_count = 0 AND proofs.status NOT IN ('proof_rejected','rejected','duplicate','reviewed_no_prices','proof_reviewed','completed') ORDER BY analyses.updated_at DESC",
    ai_waiting: "SELECT jobs.id, COALESCE(proofs.batch_title, proofs.photo_original_name, 'Proof #' || proofs.id) AS title, jobs.status AS detail, jobs.updated_at FROM ai_proof_jobs jobs JOIN price_import_batches proofs ON proofs.id = jobs.proof_id WHERE jobs.status IN ('waiting','analyzing') ORDER BY jobs.updated_at",
    store_unresolved: "SELECT rows.id, rows.item_name AS title, 'Exact store requires human resolution' AS detail, rows.updated_at FROM price_import_rows rows WHERE rows.store_id IS NULL AND rows.status NOT IN ('approved','rejected','removed') ORDER BY rows.updated_at",
    missing_current_price: `${productBase} AND NOT EXISTS (SELECT 1 FROM price_reports pr WHERE pr.product_id = products.id AND ${publicPriceEligibilitySql("pr")}) ORDER BY display_name`,
    missing_photo: `${productBase} AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_images.product_id = products.id AND product_images.status = 'approved') ORDER BY display_name`,
    missing_upc: `${productBase} AND NULLIF(upc,'') IS NULL AND NOT EXISTS (SELECT 1 FROM product_barcodes WHERE product_barcodes.product_id = products.id AND product_barcodes.status = 'verified') ORDER BY display_name`,
    missing_size: `${productBase} AND NULLIF(default_size_text,'') IS NULL ORDER BY display_name`,
    missing_category: `${productBase} AND (NULLIF(category,'') IS NULL OR category = 'other') ORDER BY display_name`,
    reported_price: `SELECT issues.id, issues.price_report_id, products.display_name AS title,
      stores.name || ' · ' || printf('$%.2f', reports.price) || ' · ' || upper(issues.reason) AS detail,
      issues.duplicate_count AS count, issues.status, issues.public_note, issues.created_at, issues.updated_at
      FROM price_issue_reports issues
      JOIN price_reports reports ON reports.id = issues.price_report_id
      LEFT JOIN products ON products.id = COALESCE(issues.product_id, reports.product_id)
      LEFT JOIN stores ON stores.id = reports.store_id
      WHERE issues.status IN ('open','in_review')
      ORDER BY issues.duplicate_count DESC, issues.updated_at DESC`,
    ai_failed: "SELECT jobs.id, COALESCE(proofs.batch_title, proofs.photo_original_name, 'Proof #' || proofs.id) AS title, jobs.last_error AS detail, jobs.updated_at FROM ai_proof_jobs jobs JOIN price_import_batches proofs ON proofs.id = jobs.proof_id WHERE jobs.status = 'ai_failed' ORDER BY jobs.updated_at DESC",
    failed_image: "SELECT items.id, items.original_name AS title, items.error_message AS detail, items.updated_at FROM product_image_upload_items items WHERE items.status = 'failed' ORDER BY items.updated_at DESC",
    unmatched_image: "SELECT items.id, items.original_name AS title, items.match_confidence AS detail, items.updated_at FROM product_image_upload_items items WHERE items.status = 'needs_review' AND items.suggested_product_id IS NULL ORDER BY items.updated_at DESC",
    upc_conflict: "SELECT conflicts.id, 'Barcode ' || conflicts.normalized_value AS title, existing.display_name || ' ↔ ' || COALESCE(attempted.display_name, 'Unmatched catalog product') AS detail, conflicts.occurrence_count AS count, conflicts.updated_at FROM product_barcode_conflicts conflicts JOIN products existing ON existing.id = conflicts.existing_product_id LEFT JOIN products attempted ON attempted.id = conflicts.attempted_product_id WHERE conflicts.status = 'open' ORDER BY conflicts.updated_at DESC",
    failed_import: "SELECT items.id, items.original_name AS title, items.error_message AS detail, items.updated_at FROM bulk_intake_items items WHERE items.status = 'failed' ORDER BY items.updated_at DESC",
    paused_batch: "SELECT id, COALESCE(title, 'Bulk batch #' || id) AS title, 'Processing paused' AS detail, updated_at FROM bulk_intake_batches WHERE paused = 1 ORDER BY updated_at DESC",
    duplicate_screenshot: "SELECT items.id, items.original_name AS title, 'Exact duplicate screenshot; no automatic AI call' AS detail, items.updated_at FROM bulk_intake_items items WHERE items.status = 'duplicate' ORDER BY items.updated_at DESC",
    unmatched_catalog: "SELECT rows.id, rows.product_name AS title, rows.warnings_json AS detail, rows.updated_at FROM catalog_import_rows rows WHERE rows.status = 'draft' AND rows.suggested_product_id IS NULL AND rows.duplicate_product_id IS NULL AND rows.warnings_json != '[]' ORDER BY rows.updated_at DESC",
    missing_sale_date: "SELECT rows.id, rows.item_name AS title, 'Promotion date requires review' AS detail, rows.updated_at FROM price_import_rows rows WHERE rows.status NOT IN ('approved','rejected','removed') AND COALESCE(rows.price_type,'regular') IN ('one_day_sale','digital_coupon','paper_coupon') AND (NULLIF(rows.valid_from_date,'') IS NULL OR NULLIF(rows.valid_through_date,'') IS NULL) ORDER BY rows.updated_at DESC",
    promotion_conditions: "SELECT rows.id, rows.item_name AS title, 'Promotion conditions require review' AS detail, rows.updated_at FROM price_import_rows rows WHERE rows.status NOT IN ('approved','rejected','removed') AND COALESCE(rows.price_type,'regular') != 'regular' AND NULLIF(rows.promotion_conditions,'') IS NULL ORDER BY rows.updated_at DESC",
    location_unresolved: "SELECT reports.id, products.display_name AS title, stores.name || ' · online location applicability not verified' AS detail, reports.submitted_at AS updated_at FROM price_reports reports JOIN products ON products.id = reports.product_id JOIN stores ON stores.id = reports.store_id WHERE reports.status = 'approved' AND (COALESCE(reports.proof_type,'') = 'store_page' OR NULLIF(reports.source_url,'') IS NOT NULL) AND reports.location_verification_status NOT IN ('verified_exact_store','verified_market') ORDER BY reports.submitted_at DESC",
    package_mismatch: "SELECT reports.id, products.display_name AS title, COALESCE(reports.size_text,'No report size') || ' ↔ ' || COALESCE(products.default_size_text,'No catalog size') AS detail, reports.submitted_at AS updated_at FROM price_reports reports JOIN products ON products.id = reports.product_id WHERE reports.status = 'approved' AND NULLIF(products.default_unit,'') IS NOT NULL AND NULLIF(COALESCE(NULLIF(reports.comparison_unit,''),reports.unit),'') IS NOT NULL AND lower(products.default_unit) != lower(COALESCE(NULLIF(reports.comparison_unit,''),reports.unit)) ORDER BY reports.submitted_at DESC",
    family_missing: "SELECT products.id, products.display_name AS title, 'Human-confirmed product family is missing' AS detail, products.updated_at FROM products WHERE products.status = 'active' AND NOT EXISTS (SELECT 1 FROM product_family_members members WHERE members.product_id = products.id AND members.human_confirmed = 1) ORDER BY products.updated_at DESC",
    substitute_uncertain: `SELECT * FROM (
      SELECT substitutions.id, substitutions.source_product_id, substitutions.target_product_id, sources.display_name || ' → ' || targets.display_name AS title, substitutions.confidence || ' · human substitute decision required' AS detail, substitutions.updated_at
      FROM product_substitutions substitutions JOIN products sources ON sources.id = substitutions.source_product_id JOIN products targets ON targets.id = substitutions.target_product_id WHERE substitutions.status = 'suggested' OR substitutions.confidence = 'low'
      UNION ALL
      SELECT -(first.product_id * 1000000 + second.product_id) AS id, first.product_id, second.product_id, sources.display_name || ' → ' || targets.display_name AS title, 'Same confirmed product family · human substitute decision required' AS detail, families.updated_at
      FROM product_family_members first JOIN product_family_members second ON second.family_id = first.family_id AND second.product_id != first.product_id JOIN product_families families ON families.id = first.family_id JOIN products sources ON sources.id = first.product_id JOIN products targets ON targets.id = second.product_id
      WHERE first.human_confirmed = 1 AND second.human_confirmed = 1 AND NOT EXISTS (SELECT 1 FROM product_substitutions existing WHERE existing.source_product_id = first.product_id AND existing.target_product_id = second.product_id)
    ) ORDER BY updated_at DESC`,
    system_error: "SELECT id, error_type AS title, message AS detail, created_at AS updated_at FROM operations_errors WHERE status = 'open' AND severity IN ('error','critical') ORDER BY created_at DESC"
  };
  if (key === "possible_duplicate_product") return "SELECT MIN(id) AS id, GROUP_CONCAT(display_name, ' ↔ ') AS title, COUNT(*) || ' matching catalog records' AS detail, MAX(updated_at) AS updated_at FROM products WHERE status = 'active' GROUP BY lower(canonical_name), lower(COALESCE(preferred_brand,'')), lower(COALESCE(default_size_text,'')) HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC";
  if (key === "stale_price") {
    const agingCase = `CASE reports.proof_type WHEN 'receipt_photo' THEN ${PRICE_FRESHNESS_DAYS.receipt_photo.aging} WHEN 'shelf_tag_photo' THEN ${PRICE_FRESHNESS_DAYS.shelf_tag_photo.aging} WHEN 'weekly_ad' THEN ${PRICE_FRESHNESS_DAYS.weekly_ad.aging} ELSE ${PRICE_FRESHNESS_DAYS.no_photo.aging} END`;
    return `SELECT reports.id, products.display_name AS title, stores.name || ' · last verified ' || COALESCE(reports.source_date,reports.reviewed_at,reports.submitted_at) AS detail, reports.submitted_at AS updated_at FROM price_reports reports LEFT JOIN products ON products.id = reports.product_id JOIN stores ON stores.id = reports.store_id WHERE reports.status = 'approved' AND COALESCE(reports.price_type,'regular') = 'regular' AND datetime(COALESCE(NULLIF(reports.source_date,''),NULLIF(reports.reviewed_at,''),reports.submitted_at)) < datetime('now', '-' || (${agingCase}) || ' days') ORDER BY reports.submitted_at`;
  }
  return queries[key] || "";
}

async function attentionItems(key, limit = 100, offset = 0) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const sql = attentionQueueSql(key);
  return sql ? all(`${sql} LIMIT ? OFFSET ?`, [safeLimit, safeOffset]) : [];
}

async function attentionQueueCounts(keys) {
  const queueKeys = keys.filter((key) => attentionQueueSql(key));
  if (!queueKeys.length) return {};
  const rows = await all(queueKeys.map((key) => `SELECT '${key}' AS key, COUNT(*) AS count FROM (${attentionQueueSql(key)})`).join(" UNION ALL "));
  return Object.fromEntries(rows.map((row) => [row.key, Number(row.count || 0)]));
}

async function catalogCoverageSummary() {
  const [catalog, stores] = await Promise.all([
    get(`SELECT COUNT(*) AS products,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM price_reports pr WHERE pr.product_id = products.id AND ${publicPriceEligibilitySql("pr")}) THEN 1 ELSE 0 END) AS products_with_current_price,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM price_reports pr WHERE pr.product_id = products.id AND ${publicPriceEligibilitySql("pr")}) THEN 1 ELSE 0 END) AS products_without_current_price,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM product_images images WHERE images.product_id = products.id AND images.status = 'approved') THEN 1 ELSE 0 END) AS products_with_images,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM product_images images WHERE images.product_id = products.id AND images.status = 'approved') THEN 1 ELSE 0 END) AS products_missing_images,
      SUM(CASE WHEN NULLIF(upc,'') IS NOT NULL OR EXISTS (SELECT 1 FROM product_barcodes barcodes WHERE barcodes.product_id = products.id AND barcodes.status = 'verified') THEN 1 ELSE 0 END) AS products_with_upc
      FROM products WHERE status = 'active'`),
    all(`SELECT stores.id, stores.name,
      COUNT(DISTINCT CASE WHEN ${publicPriceEligibilitySql("pr")} THEN pr.id END) AS current_prices,
      COUNT(DISTINCT CASE WHEN ${publicPriceEligibilitySql("pr")} THEN pr.product_id END) AS products,
      COUNT(DISTINCT CASE WHEN pr.status = 'approved' AND NOT (${publicPriceEligibilitySql("pr")}) THEN pr.id END) AS stale_or_expired,
      (SELECT COUNT(*) FROM price_import_batches batches WHERE batches.default_store_id = stores.id AND COALESCE(batches.review_status,'') NOT IN ('completed','rejected') AND batches.status NOT IN ('duplicate','proof_rejected','reviewed_no_prices')) AS unresolved_proofs
      FROM stores LEFT JOIN price_reports pr ON pr.store_id = stores.id WHERE stores.active = 1 GROUP BY stores.id ORDER BY current_prices ASC, stale_or_expired DESC, stores.name`)
  ]);
  const currentPrices = await get(`SELECT COUNT(*) AS count FROM price_reports pr WHERE ${publicPriceEligibilitySql("pr")}`);
  const stale = await attentionCenterSummary();
  return { catalog: { products: Number(catalog?.products || 0), current_prices: Number(currentPrices?.count || 0), products_with_current_price: Number(catalog?.products_with_current_price || 0), products_without_current_price: Number(catalog?.products_without_current_price || 0), products_with_images: Number(catalog?.products_with_images || 0), products_missing_images: Number(catalog?.products_missing_images || 0), products_with_upc: Number(catalog?.products_with_upc || 0), products_missing_upc: Number(catalog?.products || 0) - Number(catalog?.products_with_upc || 0), stale_prices: stale.groups.prices.find((item) => item.key === "stale_price")?.count || 0, promotions_ending_today: Number((await get("SELECT COUNT(*) AS count FROM price_reports WHERE status = 'approved' AND valid_through_date = ?", [localDateFor()]))?.count || 0) }, stores: stores.map((store) => ({ ...store, current_prices: Number(store.current_prices || 0), products: Number(store.products || 0), stale_or_expired: Number(store.stale_or_expired || 0), unresolved_proofs: Number(store.unresolved_proofs || 0), priority_label: Number(store.current_prices || 0) < 10 || Number(store.stale_or_expired || 0) > Number(store.current_prices || 0) ? "Needs more coverage" : "Coverage active" })) };
}

async function sinceLastDashboardVisit(userId) {
  const visit = await get("SELECT last_seen_at FROM admin_dashboard_visits WHERE admin_user_id = ?", [userId]);
  const since = visit?.last_seen_at || new Date(Date.now() - 86400000).toISOString();
  const now = new Date().toISOString();
  const counts = await get(`SELECT
    (SELECT COUNT(*) FROM price_import_batches WHERE notes LIKE ? AND created_at > ?) AS new_proofs,
    (SELECT COUNT(*) FROM price_import_rows WHERE created_at > ?) AS candidate_prices,
    (SELECT COUNT(*) FROM price_reports WHERE status = 'approved' AND reviewed_at > ?) AS prices_approved,
    (SELECT COUNT(*) FROM price_import_batches WHERE review_status = 'needs_help') AS manager_decisions,
    (SELECT COUNT(*) FROM products p WHERE p.status = 'active' AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id AND i.status = 'approved')) AS products_missing_photos,
    (SELECT COUNT(*) FROM price_reports WHERE valid_through_date IS NOT NULL AND valid_through_date < ? AND valid_through_date >= substr(?,1,10)) AS prices_expired,
    (SELECT COUNT(*) FROM ai_proof_jobs WHERE status = 'ai_failed' AND updated_at > ?) AS ai_failed`, [`${PROOF_SUBMISSION_NOTE_PREFIX}%`, since, since, since, localDateFor(), since, since]);
  await run("INSERT INTO admin_dashboard_visits (admin_user_id, last_seen_at, previous_seen_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(admin_user_id) DO UPDATE SET previous_seen_at = admin_dashboard_visits.last_seen_at, last_seen_at = excluded.last_seen_at, updated_at = excluded.updated_at", [userId, now, since, now]);
  return { since, ...Object.fromEntries(Object.entries(counts || {}).map(([key, value]) => [key, Number(value || 0)])) };
}

app.get("/api/admin/operations/command-center", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const [attention, coverage, since, searchDemand] = await Promise.all([attentionCenterSummary(), catalogCoverageSummary(), sinceLastDashboardVisit(request.adminUser.id), all("SELECT normalized_query, display_query, total_searches, zero_result_searches, weak_result_searches, last_result_count, last_searched_at FROM search_demand ORDER BY zero_result_searches DESC, total_searches DESC, last_searched_at DESC LIMIT 50")]);
  response.json({ generated_at: new Date().toISOString(), attention, coverage, since_last_visit: since, search_demand: { could_not_find: searchDemand.filter((row) => Number(row.zero_result_searches) > 0), most_searched: [...searchDemand].sort((a, b) => Number(b.total_searches) - Number(a.total_searches)).slice(0, 20) } });
}));

app.get("/api/admin/operations/attention", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const category = cleanText(request.query.category, 80);
  const summary = await attentionCenterSummary();
  const queue = Object.values(summary.groups).flat().find((item) => item.key === category) || null;
  const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 100));
  const offset = Math.max(0, Number(request.query.offset) || 0);
  const items = category ? await attentionItems(category, limit, offset) : [];
  const total = Number(queue?.count || 0);
  response.json({ summary, category, queue, total, limit, offset, has_more: offset + items.length < total, items });
}));

app.get("/api/admin/operations/health", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  let database = { status: "healthy" };
  try { const check = await get("PRAGMA quick_check"); database = { status: Object.values(check || {})[0] === "ok" ? "healthy" : "warning", result: Object.values(check || {})[0] || "unknown" }; } catch { database = { status: "critical", result: "Database check failed" }; }
  const [queue, failed, errors, backup] = await Promise.all([get("SELECT COUNT(*) AS count FROM ai_proof_jobs WHERE status IN ('waiting','analyzing')"), get("SELECT COUNT(*) AS count FROM ai_proof_jobs WHERE status = 'ai_failed'"), all("SELECT error_type, severity, source, COUNT(*) AS count, MAX(created_at) AS last_seen_at FROM operations_errors WHERE status = 'open' GROUP BY error_type, severity, source ORDER BY last_seen_at DESC LIMIT 30"), get("SELECT * FROM backup_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1")]);
  let backupSummary = safeBackupSummary(backup);
  if (backupSummary && backup.storage_path && fs.existsSync(backup.storage_path)) backupSummary = { ...backupSummary, size_bytes: fs.statSync(backup.storage_path).size };
  response.json({ application: { status: hasTailwindBuild() ? "healthy" : "warning", uptime_seconds: Math.round(process.uptime()), version: currentVersion() }, database, uploads: { status: fs.existsSync(UPLOAD_DIR) ? "healthy" : "critical" }, disk: diskHealth(), ai_queue: { status: Number(failed?.count || 0) ? "warning" : "healthy", waiting: Number(queue?.count || 0), failed: Number(failed?.count || 0) }, email: { status: emailStatus().configured ? "configured" : "not_configured" }, recent_errors: errors, backup: backupSummary || { status: "warning", message: "No successful backup recorded" } });
}));

app.get("/api/admin/products/barcode/:barcode", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const barcode = normalizeBarcode(request.params.barcode);
  if (!barcode.valid) { response.status(400).json({ error: barcode.error }); return; }
  const match = await get("SELECT products.id, products.display_name, products.preferred_brand, products.default_size_text, products.status FROM product_barcodes JOIN products ON products.id = product_barcodes.product_id WHERE product_barcodes.normalized_value = ? AND product_barcodes.status = 'verified'", [barcode.value]);
  response.json({ barcode, match: match || null, requires_human_confirmation: !match });
}));

app.post("/api/admin/barcode-conflicts/:id/resolve", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const conflictId = Number.parseInt(request.params.id, 10);
  const conflict = await get("SELECT * FROM product_barcode_conflicts WHERE id = ? AND status = 'open'", [conflictId]);
  if (!conflict) { response.status(404).json({ error: "The open barcode conflict was not found." }); return; }
  const note = cleanText(request.body.resolution_note || "Existing verified assignment retained after human review.", 500);
  const now = new Date().toISOString();
  await run("UPDATE product_barcode_conflicts SET status = 'resolved', resolved_by = ?, resolution_note = ?, resolved_at = ?, updated_at = ? WHERE id = ?", [request.adminUser.id, note, now, now, conflictId]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: "BARCODE_CONFLICT_RESOLVED", affectedType: "product_barcode_conflict", affectedId: conflictId, metadata: { normalized_value: conflict.normalized_value, existing_product_id: conflict.existing_product_id, attempted_product_id: conflict.attempted_product_id } });
  response.json({ message: "Barcode conflict reviewed. The existing verified assignment was retained." });
}));

app.post("/api/price-reports/:id/issues", asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10);
  const reason = cleanText(request.body.reason, 80).toLowerCase();
  if (!PRICE_REPORT_REASONS.has(reason)) { response.status(400).json({ error: "Choose a valid price report reason." }); return; }
  const report = await get(`SELECT reports.id, reports.product_id, reports.store_id, reports.status, reports.price,
    products.display_name AS product_name, stores.name AS store_name
    FROM price_reports reports
    LEFT JOIN products ON products.id = reports.product_id
    LEFT JOIN stores ON stores.id = reports.store_id
    WHERE reports.id = ?`, [reportId]);
  if (!report || report.status !== "approved") { response.status(404).json({ error: "The approved price was not found." }); return; }
  const note = cleanText(request.body.note, 300);
  const day = localDateFor();
  const rateHash = crypto.createHmac("sha256", SESSION_SECRET).update(`${day}:${request.ip || "unknown"}`).digest("hex");
  const recent = await get("SELECT COUNT(*) AS count FROM price_issue_reports WHERE rate_limit_bucket_hash = ? AND created_at >= ?", [rateHash, `${day}T00:00:00.000Z`]);
  if (Number(recent?.count || 0) >= 10) { response.status(429).json({ error: "Too many reports were submitted from this connection today. Try again later." }); return; }
  const fingerprint = crypto.createHash("sha256").update(`${reportId}:${reason}`).digest("hex");
  const duplicateCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const existing = await get("SELECT id, duplicate_count, rate_limit_bucket_hash FROM price_issue_reports WHERE price_report_id = ? AND reason = ? AND status IN ('open','in_review') AND created_at >= ? ORDER BY created_at DESC LIMIT 1", [reportId, reason, duplicateCutoff]);
  const now = new Date().toISOString();
  if (existing && existing.rate_limit_bucket_hash === rateHash && Number(existing.duplicate_count || 0) >= 10) { response.status(429).json({ error: "Too many equivalent reports were submitted from this connection today. Try again later." }); return; }
  let issueId;
  let consolidated = false;
  if (existing) {
    await run("UPDATE price_issue_reports SET duplicate_count = duplicate_count + 1, public_note = CASE WHEN NULLIF(public_note,'') IS NULL THEN ? ELSE public_note END, updated_at = ? WHERE id = ?", [note, now, existing.id]);
    issueId = existing.id;
    consolidated = true;
  } else {
    await run("BEGIN IMMEDIATE");
    try {
      const result = await run("INSERT INTO price_issue_reports (price_report_id, product_id, reason, public_note, status, rate_limit_bucket_hash, fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)", [reportId, report.product_id || null, reason, note, rateHash, fingerprint, now, now]);
      issueId = result.lastID;
      await createAdminNotification("price_issue_report", `Price report: ${reason.charAt(0).toUpperCase()}${reason.slice(1)} — ${report.product_name || "Grocery price"}`, `${report.store_name || "Store unresolved"} · $${Number(report.price).toFixed(2)}`, { related_type: "price_issue_report", related_id: issueId, related_report_id: reportId, target_tab: "attentionCenterTab", target_url: `/admin/attention/reported-price/${issueId}` });
      await run("COMMIT");
    } catch (error) { await run("ROLLBACK").catch(() => {}); throw error; }
  }
  response.status(consolidated ? 200 : 201).json({ issue_id: issueId, consolidated, message: "Thanks. Grocery Radar staff will review this price report. The public price was not changed automatically." });
}));

async function priceIssueDetail(issueId) {
  const row = await get(`SELECT issues.id, issues.price_report_id, issues.product_id AS reported_product_id, issues.reason, issues.public_note,
    issues.status, issues.duplicate_count, issues.created_at, issues.updated_at, issues.resolved_at, issues.resolution_note,
    reports.product_id, reports.store_id, reports.price, reports.unit, reports.size_text, reports.price_type,
    reports.valid_from_date, reports.valid_through_date, reports.promotion_conditions, reports.promotion_schedule_text,
    reports.display_offer_text, reports.source_date, reports.submitted_at AS price_submitted_at,
    reports.source_import_batch_id AS proof_id, reports.source_import_row_id, reports.proof_type, reports.source_url,
    products.display_name AS product_name, products.preferred_brand AS brand, products.default_size_text,
    stores.name AS store_name,
    (SELECT id FROM product_images images WHERE images.product_id = reports.product_id AND images.status = 'approved' ORDER BY images.is_primary DESC, images.id DESC LIMIT 1) AS product_image_id
    FROM price_issue_reports issues
    JOIN price_reports reports ON reports.id = issues.price_report_id
    LEFT JOIN products ON products.id = reports.product_id
    LEFT JOIN stores ON stores.id = reports.store_id
    WHERE issues.id = ?`, [issueId]);
  return row ? { ...row, product_image_url: row.product_image_id ? `/api/product-images/${row.product_image_id}/file` : "" } : null;
}

app.get("/api/admin/price-issues/:id", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const issueId = Number.parseInt(request.params.id, 10);
  const issue = await priceIssueDetail(issueId);
  if (!issue) { response.status(404).json({ error: "Price report task was not found." }); return; }
  response.json({ issue });
}));

app.post("/api/admin/price-issues/:id/review", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const issueId = Number.parseInt(request.params.id, 10);
  const issue = await get("SELECT * FROM price_issue_reports WHERE id = ?", [issueId]);
  if (!issue) { response.status(404).json({ error: "Price report task was not found." }); return; }
  if (["resolved", "dismissed"].includes(issue.status)) { response.status(409).json({ error: "This price report task is already closed." }); return; }
  const now = new Date().toISOString();
  await run("UPDATE price_issue_reports SET status = 'in_review', updated_at = ? WHERE id = ? AND status = 'open'", [now, issueId]);
  response.json({ issue: await priceIssueDetail(issueId) });
}));

async function closePriceIssue(request, response, forcedStatus = "") {
  const issueId = Number.parseInt(request.params.id, 10);
  const issue = await get("SELECT * FROM price_issue_reports WHERE id = ?", [issueId]);
  if (!issue) { response.status(404).json({ error: "Price report task was not found." }); return; }
  if (["resolved", "dismissed"].includes(issue.status)) { response.json({ message: "Price report task was already closed.", status: issue.status, idempotent: true }); return; }
  const status = forcedStatus || cleanText(request.body.status || "resolved", 30).toLowerCase();
  if (!new Set(["resolved", "dismissed"]).has(status)) { response.status(400).json({ error: "Choose resolved or dismissed." }); return; }
  const dismissReason = cleanText(request.body.dismiss_reason, 80).toLowerCase();
  if (status === "dismissed" && !PRICE_ISSUE_DISMISS_REASONS.has(dismissReason)) { response.status(400).json({ error: "Choose a valid dismissal reason." }); return; }
  const correctionId = Number.parseInt(request.body.correction_id, 10);
  const correction = Number.isInteger(correctionId) ? await get("SELECT id, price_report_id, action FROM price_corrections WHERE id = ?", [correctionId]) : null;
  if (Number.isInteger(correctionId) && (!correction || Number(correction.price_report_id) !== Number(issue.price_report_id))) { response.status(400).json({ error: "The correction does not belong to this reported price." }); return; }
  const now = new Date().toISOString();
  const note = cleanText(request.body.resolution_note || (status === "dismissed" ? `${dismissReason.charAt(0).toUpperCase()}${dismissReason.slice(1)}` : "Reviewed by staff"), 500);
  await run("UPDATE price_issue_reports SET status = ?, resolved_by = ?, resolution_note = ?, resolved_at = ?, updated_at = ? WHERE id = ?", [status, request.adminUser.id, note, now, now, issueId]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: status === "dismissed" ? "PRICE_ISSUE_DISMISSED" : "PRICE_ISSUE_RESOLVED", affectedType: "price_issue_report", affectedId: issueId, metadata: { price_report_id: issue.price_report_id, dismiss_reason: dismissReason || null, correction_id: correction?.id || null, correction_action: correction?.action || null } });
  response.json({ message: status === "dismissed" ? "Price report dismissed. Moderation history was preserved." : "Price report resolved. Audit history was preserved.", status, correction_id: correction?.id || null });
}

app.post("/api/admin/price-issues/:id/decision", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => closePriceIssue(request, response)));
app.post("/api/admin/price-issues/:id/resolve", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => closePriceIssue(request, response, "resolved")));

app.post("/api/admin/prices/:id/correct", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10);
  const report = await get("SELECT * FROM price_reports WHERE id = ?", [reportId]);
  if (!report) { response.status(404).json({ error: "Published price was not found." }); return; }
  const reason = cleanText(request.body.reason, 500);
  if (!reason) { response.status(400).json({ error: "An audit reason is required." }); return; }
  const action = cleanText(request.body.action || "correct", 40).toLowerCase();
  const nextProductId = Number.parseInt(request.body.product_id ?? report.product_id, 10);
  const nextStoreId = Number.parseInt(request.body.store_id ?? report.store_id, 10);
  const nextProduct = Number.isInteger(nextProductId) ? await get("SELECT id FROM products WHERE id = ? AND status = 'active'", [nextProductId]) : null;
  const nextStore = Number.isInteger(nextStoreId) ? await get("SELECT id FROM stores WHERE id = ? AND active = 1", [nextStoreId]) : null;
  if (!nextProduct || !nextStore) { response.status(400).json({ error: "Choose an active product and store." }); return; }
  const nextPrice = action === "correct" ? Number(request.body.price ?? report.price) : Number(report.price);
  if (!Number.isFinite(nextPrice) || nextPrice <= 0) { response.status(400).json({ error: "Enter a valid corrected price." }); return; }
  const nextStatus = action === "expire" ? "expired" : action === "invalidate" ? "removed" : "approved";
  const before = { price: report.price, product_id: report.product_id, store_id: report.store_id, status: report.status, valid_from_date: report.valid_from_date, valid_through_date: report.valid_through_date, promotion_conditions: report.promotion_conditions };
  const after = { price: nextPrice, product_id: nextProduct.id, store_id: nextStore.id, status: nextStatus, valid_from_date: dateInputValue(request.body.valid_from_date ?? report.valid_from_date), valid_through_date: dateInputValue(request.body.valid_through_date ?? report.valid_through_date), promotion_conditions: cleanText(request.body.promotion_conditions ?? report.promotion_conditions, 500) };
  const now = new Date().toISOString();
  let correctionId = null;
  await run("BEGIN IMMEDIATE");
  try {
    const correction = await run("INSERT INTO price_corrections (price_report_id, action, before_json, after_json, reason, corrected_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [reportId, action, JSON.stringify(before), JSON.stringify(after), reason, request.adminUser.id, now]);
    correctionId = correction.lastID;
    await run("UPDATE price_reports SET price = ?, product_id = ?, store_id = ?, status = ?, valid_from_date = ?, valid_through_date = ?, promotion_conditions = ?, last_edited_by = ?, last_edited_at = ?, edit_note = ? WHERE id = ?", [after.price, after.product_id, after.store_id, after.status, after.valid_from_date, after.valid_through_date, after.promotion_conditions, request.adminUser.id, now, reason, reportId]);
    await recordPriceEvent({ reportId, eventType: action === "expire" ? "EXPIRED_BY_OWNER" : action === "invalidate" ? "INVALIDATED_BY_OWNER" : "PRICE_CORRECTED", actorUserId: request.adminUser.id, submitterUserId: report.submitted_by_user_id || report.user_id, reason, metadata: { before, after } });
    await run("COMMIT");
  } catch (error) { await run("ROLLBACK").catch(() => {}); throw error; }
  response.json({ success: true, correction_id: correctionId, report_id: reportId, publication_state: after.status, approved_price: after.status === "approved" ? after.price : null, product_id: after.product_id, store_id: after.store_id, validity: { valid_from_date: after.valid_from_date, valid_through_date: after.valid_through_date }, message: action === "correct" ? "Published price corrected. Public queries now use the corrected value." : action === "expire" ? "Price expired and removed from current results." : "Price marked invalid and removed from public results." });
}));

app.get("/api/admin/operations/freshness", requireSuperAdminAccess, asyncRoute(async (request, response) => response.json({ settings: await all("SELECT proof_type, current_days, aging_days, updated_at FROM source_freshness_settings ORDER BY proof_type") })));
app.post("/api/admin/operations/freshness", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const proofType = cleanText(request.body.proof_type, 50);
  if (!PRICE_FRESHNESS_DAYS[proofType]) { response.status(400).json({ error: "Choose a supported proof type." }); return; }
  const currentDays = Math.min(365, Math.max(1, Number.parseInt(request.body.current_days, 10)));
  const agingDays = Math.min(730, Math.max(currentDays, Number.parseInt(request.body.aging_days, 10)));
  const now = new Date().toISOString();
  await run("UPDATE source_freshness_settings SET current_days = ?, aging_days = ?, updated_by = ?, updated_at = ? WHERE proof_type = ?", [currentDays, agingDays, request.adminUser.id, now, proofType]);
  PRICE_FRESHNESS_DAYS[proofType].current = currentDays; PRICE_FRESHNESS_DAYS[proofType].aging = agingDays;
  response.json({ message: "Freshness policy updated.", proof_type: proofType, current_days: currentDays, aging_days: agingDays });
}));

function csvCell(value) { const text = value == null ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function csvResponse(response, filename, rows, columns) { response.setHeader("Content-Type", "text/csv; charset=utf-8"); response.setHeader("Content-Disposition", `attachment; filename="${filename}"`); response.send([columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n")); }

app.get("/api/admin/exports/:kind", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const kind = cleanText(request.params.kind, 40).toLowerCase();
  if (kind === "products") { const rows = await all("SELECT id, display_name, preferred_brand, variant, category, subcategory, default_size_text, default_quantity, default_unit, default_storage_condition, upc, common_aliases, status, merged_into_product_id, created_at, updated_at FROM products ORDER BY id"); csvResponse(response, "products.csv", rows, Object.keys(rows[0] || { id: "", display_name: "", category: "", status: "" })); return; }
  if (kind === "current-prices") { const rows = await all(`SELECT pr.id, pr.product_id, products.display_name AS product_name, pr.store_id, stores.name AS store_name, pr.price, pr.size_text, pr.unit, pr.price_type, pr.valid_from_date, pr.valid_through_date, pr.promotion_conditions, pr.source_date, pr.reviewed_at FROM price_reports pr LEFT JOIN products ON products.id = pr.product_id JOIN stores ON stores.id = pr.store_id WHERE ${publicPriceEligibilitySql("pr")} ORDER BY products.display_name, stores.name`); csvResponse(response, "current-prices.csv", rows, Object.keys(rows[0] || { id: "", product_id: "", product_name: "", price: "" })); return; }
  if (kind === "historical-prices") { const rows = await all("SELECT id, product_id, store_id, price, size_text, unit, price_type, valid_from_date, valid_through_date, promotion_conditions, status, source_date, submitted_at, reviewed_at FROM price_reports ORDER BY submitted_at"); csvResponse(response, "historical-prices.csv", rows, Object.keys(rows[0] || { id: "", product_id: "", price: "", status: "" })); return; }
  if (kind === "stores") { const rows = await all("SELECT id, name, address, city, state, store_type, active, created_at FROM stores ORDER BY name"); csvResponse(response, "stores.csv", rows, Object.keys(rows[0] || { id: "", name: "", city: "", active: "" })); return; }
  if (kind === "catalog-json") { const products = await all("SELECT id, display_name, preferred_brand, variant, category, subcategory, default_size_text, default_unit, default_storage_condition, upc, common_aliases, status, merged_into_product_id FROM products ORDER BY id"); response.setHeader("Content-Disposition", 'attachment; filename="catalog.json"'); response.json({ exported_at: new Date().toISOString(), products }); return; }
  response.status(404).json({ error: "Export type was not found." });
}));

app.get("/api/categories", asyncRoute(async (request, response) => {
  const rows = await all("SELECT id, slug, display_name, parent_id, sort_order FROM category_nodes WHERE status = 'active' ORDER BY sort_order, display_name");
  const byId = new Map(rows.map((row) => [row.id, { ...row, children: [] }]));
  const roots = [];
  for (const row of byId.values()) { if (row.parent_id && byId.has(row.parent_id)) byId.get(row.parent_id).children.push(row); else roots.push(row); }
  response.json({ categories: roots, publication_requires_category: false });
}));

app.get("/api/admin/products/duplicates", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const candidates = await all(`SELECT lower(a.canonical_name) AS match_key, a.id AS product_a_id, a.display_name AS product_a_name, a.preferred_brand AS product_a_brand, a.default_size_text AS product_a_size, a.upc AS product_a_upc, b.id AS product_b_id, b.display_name AS product_b_name, b.preferred_brand AS product_b_brand, b.default_size_text AS product_b_size, b.upc AS product_b_upc
    FROM products a JOIN products b ON b.id > a.id AND b.status = 'active' AND a.status = 'active' AND lower(b.canonical_name) = lower(a.canonical_name) AND lower(COALESCE(b.preferred_brand,'')) = lower(COALESCE(a.preferred_brand,'')) AND lower(COALESCE(b.default_size_text,'')) = lower(COALESCE(a.default_size_text,''))
    WHERE NOT EXISTS (SELECT 1 FROM product_duplicate_decisions decisions WHERE decisions.product_a_id = a.id AND decisions.product_b_id = b.id AND decisions.decision = 'not_duplicate') ORDER BY a.display_name LIMIT 200`);
  response.json({ candidates: candidates.map((row) => ({ ...row, confidence: "high", reason: "Matching normalized name, brand, and size" })) });
}));

app.get("/api/admin/products/:id/merge-preview", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const sourceId = Number.parseInt(request.params.id, 10); const targetId = Number.parseInt(request.query.target_product_id, 10);
  const productSummary = async (id) => {
    const product = await get("SELECT * FROM products WHERE id = ?", [id]); if (!product) return null;
    const [barcodes, images, prices, aliases] = await Promise.all([all("SELECT barcode_type, normalized_value FROM product_barcodes WHERE product_id = ? AND status = 'verified'", [id]), get("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?", [id]), get("SELECT COUNT(*) AS count FROM price_reports WHERE product_id = ?", [id]), all("SELECT display_alias FROM product_normalization_rules WHERE product_id = ?", [id])]);
    return { id: product.id, display_name: product.display_name, brand: product.preferred_brand || "", size: product.default_size_text || "", category: product.category, upc: product.upc || "", barcodes, image_count: Number(images?.count || 0), price_count: Number(prices?.count || 0), aliases: [...String(product.common_aliases || "").split(",").filter(Boolean), ...aliases.map((row) => row.display_alias)] };
  };
  const [source, target] = await Promise.all([productSummary(sourceId), productSummary(targetId)]);
  if (!source || !target) { response.status(404).json({ error: "Both products must exist." }); return; }
  const sourceCodes = new Set(source.barcodes.map((row) => row.normalized_value)); const targetCodes = new Set(target.barcodes.map((row) => row.normalized_value));
  response.json({ source, target, blocked: sourceCodes.size > 0 && targetCodes.size > 0 && [...sourceCodes].some((value) => !targetCodes.has(value)), block_reason: "Conflicting verified barcodes require manual resolution before merge." });
}));

app.post("/api/admin/products/duplicates/not-duplicate", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const a = Number.parseInt(request.body.product_a_id, 10); const b = Number.parseInt(request.body.product_b_id, 10);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) { response.status(400).json({ error: "Choose two different products." }); return; }
  const [first, second] = a < b ? [a, b] : [b, a];
  await run("INSERT INTO product_duplicate_decisions (product_a_id, product_b_id, decision, decided_by, reason, created_at) VALUES (?, ?, 'not_duplicate', ?, ?, ?) ON CONFLICT(product_a_id, product_b_id) DO UPDATE SET decision = 'not_duplicate', decided_by = excluded.decided_by, reason = excluded.reason, created_at = excluded.created_at", [first, second, request.adminUser.id, cleanText(request.body.reason || "Human confirmed separate products", 300), new Date().toISOString()]);
  response.json({ message: "Products marked as separate. They will no longer appear as this duplicate candidate." });
}));

app.post("/api/admin/search-aliases", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const alias = normalizeProductName(request.body.alias); const replacement = cleanText(request.body.replacement_query, 120).toLowerCase(); const productId = Number.parseInt(request.body.product_id, 10);
  if (!alias || !replacement) { response.status(400).json({ error: "Alias and replacement query are required." }); return; }
  const now = new Date().toISOString();
  await run("INSERT INTO search_aliases (normalized_alias, replacement_query, product_id, category, status, confirmed_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'verified', ?, ?, ?) ON CONFLICT(normalized_alias) DO UPDATE SET replacement_query = excluded.replacement_query, product_id = excluded.product_id, category = excluded.category, status = 'verified', confirmed_by = excluded.confirmed_by, updated_at = excluded.updated_at", [alias, replacement, Number.isInteger(productId) ? productId : null, cleanText(request.body.category, 60), request.adminUser.id, now, now]);
  response.status(201).json({ message: "Verified search alias saved." });
}));

app.get("/api/admin/catalog-template.csv", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  response.setHeader("Content-Type", "text/csv; charset=utf-8"); response.setHeader("Content-Disposition", 'attachment; filename="grocery-radar-catalog-template.csv"');
  response.send("product_name,brand,size,unit,category,subcategory,UPC,aliases,storage_condition\nBananas,,,lb,produce,fruit,,banana,fresh produce\n");
}));

app.post("/api/admin/operations/failed-jobs/:type/:id/retry", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const type = cleanText(request.params.type, 40); const id = Number.parseInt(request.params.id, 10); const now = new Date().toISOString();
  if (type === "ai") {
    const job = await get("SELECT * FROM ai_proof_jobs WHERE id = ?", [id]); if (!job || job.status !== "ai_failed") { response.status(409).json({ error: "Choose a failed AI job." }); return; }
    const queued = await ensureAiProofJob(job.proof_id, { force: true }); if (!queued) { response.status(429).json({ error: "AI queue or usage limit reached. Retry later." }); return; }
    response.status(202).json({ message: "AI retry queued within existing cost and retry controls.", job_id: job.id }); return;
  }
  if (type === "image") {
    const item = await get("SELECT * FROM product_image_upload_items WHERE id = ?", [id]); if (!item || item.status !== "failed") { response.status(409).json({ error: "Choose a failed image item." }); return; }
    const match = await matchProductImageFilename(item.original_name); await run("UPDATE product_image_upload_items SET status = 'needs_review', suggested_product_id = ?, match_confidence = ?, error_message = '', updated_at = ? WHERE id = ?", [match.product?.id || null, match.confidence || "unknown", now, id]);
    response.json({ message: "Image returned to matching review. No duplicate public image was created." }); return;
  }
  if (type === "bulk") {
    const item = await get("SELECT * FROM bulk_intake_items WHERE id = ?", [id]); if (!item || item.status !== "failed" || !item.proof_id) { response.status(409).json({ error: "Choose a failed bulk item with retained proof." }); return; }
    const queued = await ensureAiProofJob(item.proof_id, { force: true }); if (!queued) { response.status(429).json({ error: "AI queue or usage limit reached. Retry later." }); return; }
    await run("UPDATE bulk_intake_items SET status = 'queued', error_message = '', updated_at = ? WHERE id = ?", [now, id]); response.status(202).json({ message: "Failed batch item requeued without restarting successful items." }); return;
  }
  response.status(400).json({ error: "Retry type is not supported." });
}));

app.get("/api/admin/price-arena/settings", requireSuperAdminAccess, asyncRoute(async (request, response) => response.json({ settings: await arenaSettings() })));

app.post("/api/admin/price-arena/settings", requireSuperAdminAccess, asyncRoute(async (request, response) => {
  const minimumProducts = Math.min(500, Math.max(2, Number.parseInt(request.body.minimum_broad_products, 10) || 20));
  const minimumCategories = Math.min(20, Math.max(1, Number.parseInt(request.body.minimum_broad_categories, 10) || 3));
  const leaderMargin = Math.min(20, Math.max(0, Number.parseInt(request.body.no_clear_leader_margin, 10) || 1));
  const historyDays = Math.min(365, Math.max(7, Number.parseInt(request.body.history_window_days, 10) || 30));
  const now = new Date().toISOString();
  await run("UPDATE price_arena_settings SET minimum_broad_products = ?, minimum_broad_categories = ?, no_clear_leader_margin = ?, history_window_days = ?, updated_by = ?, updated_at = ? WHERE id = 1", [minimumProducts, minimumCategories, leaderMargin, historyDays, request.adminUser.id, now]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: "PRICE_ARENA_SETTINGS_UPDATED", affectedType: "price_arena_settings", affectedId: 1, metadata: { minimumProducts, minimumCategories, leaderMargin, historyDays } });
  response.json({ message: "Price Arena evidence thresholds updated.", settings: await arenaSettings() });
}));

app.post("/api/admin/price-import-batches/:id/location", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const batchId = Number.parseInt(request.params.id, 10); const storeId = Number.parseInt(request.body.store_id, 10);
  const [batch, store] = await Promise.all([get("SELECT id FROM price_import_batches WHERE id = ?", [batchId]), get("SELECT id, name, city, state FROM stores WHERE id = ? AND active = 1", [storeId])]);
  if (!batch) { response.status(404).json({ error: "Import batch was not found." }); return; }
  const isJanesville = store && String(store.city || "").trim().toLowerCase() === "janesville" && ["wi","wisconsin"].includes(String(store.state || "").trim().toLowerCase());
  if (!isJanesville) { response.status(409).json({ error: "Only a verified active Janesville store can be assigned to this online import." }); return; }
  const evidence = cleanText(request.body.evidence_note, 500); if (!evidence) { response.status(400).json({ error: "Describe the visible Janesville location evidence." }); return; }
  const now = new Date().toISOString();
  await run("BEGIN IMMEDIATE");
  try {
    await run("UPDATE price_import_batches SET default_store_id = ?, location_verification_status = 'verified_exact_store', applicable_store_id = ?, location_evidence_text = ?, updated_at = ? WHERE id = ?", [store.id, store.id, evidence, now, batchId]);
    await run("UPDATE price_import_rows SET store_id = ?, updated_by = ?, updated_at = ? WHERE batch_id = ? AND status NOT IN ('approved','rejected','removed')", [store.id, request.adminUser.id, now, batchId]);
    await run("COMMIT");
  } catch (error) { await run("ROLLBACK"); throw error; }
  await recordPriceEvent({ batchId, eventType: "IMPORT_LOCATION_RESOLVED", actorUserId: request.adminUser.id, reason: evidence, metadata: { store_id: store.id, city: store.city, state: store.state } });
  response.json({ message: "Online import verified for the selected Janesville store.", batch_id: batchId, store: { id: store.id, name: store.name } });
}));

app.post("/api/admin/prices/:id/location", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const reportId = Number.parseInt(request.params.id, 10); const report = await get("SELECT * FROM price_reports WHERE id = ?", [reportId]);
  if (!report) { response.status(404).json({ error: "Price was not found." }); return; }
  const status = cleanText(request.body.status, 40);
  if (!["verified_exact_store", "verified_market", "needs_review"].includes(status)) { response.status(400).json({ error: "Choose a valid location resolution." }); return; }
  const store = await get("SELECT id, city, state FROM stores WHERE id = ? AND active = 1", [Number(request.body.store_id || report.store_id)]);
  const isJanesville = store && String(store.city).toLowerCase() === "janesville" && ["wi", "wisconsin"].includes(String(store.state).toLowerCase());
  if (status !== "needs_review" && !isJanesville) { response.status(409).json({ error: "Only a verified active Janesville store or market can enter Janesville comparisons." }); return; }
  const note = cleanText(request.body.evidence_note, 500); if (status !== "needs_review" && !note) { response.status(400).json({ error: "Describe the visible location evidence." }); return; }
  const now = new Date().toISOString();
  await run("UPDATE price_reports SET store_id = CASE WHEN ? = 'needs_review' THEN store_id ELSE ? END, location_verification_status = ?, applicable_city = ?, applicable_state = ?, applicable_store_id = ?, location_evidence_text = ?, last_edited_by = ?, last_edited_at = ? WHERE id = ?", [status, store?.id || report.store_id, status, status === "needs_review" ? "" : store.city, status === "needs_review" ? "" : store.state, status === "needs_review" ? null : store.id, note, request.adminUser.id, now, reportId]);
  await recordPriceEvent({ reportId, eventType: "LOCATION_RESOLVED", actorUserId: request.adminUser.id, submitterUserId: report.submitted_by_user_id || report.user_id, reason: note, metadata: { status, previous_store_id: report.store_id, store_id: status === "needs_review" ? null : store.id } });
  response.json({ message: status === "needs_review" ? "Price held for location review." : "Janesville applicability verified.", report_id: reportId, location_verification_status: status });
}));

app.post("/api/admin/product-families", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const displayName = cleanText(request.body.display_name, 120); const genericType = cleanText(request.body.generic_product_type || displayName, 120).toLowerCase();
  if (!displayName || !genericType) { response.status(400).json({ error: "Family name and generic product type are required." }); return; }
  const slug = normalizeProductName(request.body.slug || displayName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); const now = new Date().toISOString();
  const result = await run("INSERT INTO product_families (slug, display_name, category, generic_product_type, key_attributes_json, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET display_name = excluded.display_name, category = excluded.category, generic_product_type = excluded.generic_product_type, key_attributes_json = excluded.key_attributes_json, updated_at = excluded.updated_at", [slug, displayName, cleanText(request.body.category, 40).toLowerCase(), genericType, JSON.stringify(request.body.key_attributes || {}), request.adminUser.id, now, now]);
  const family = await get("SELECT * FROM product_families WHERE slug = ?", [slug]); response.status(result.lastID ? 201 : 200).json({ message: "Product family saved.", family });
}));

app.post("/api/admin/product-families/:id/members", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const familyId = Number.parseInt(request.params.id, 10); const productId = Number.parseInt(request.body.product_id, 10); const now = new Date().toISOString();
  const [family, product] = await Promise.all([get("SELECT id FROM product_families WHERE id = ? AND status = 'active'", [familyId]), get("SELECT id FROM products WHERE id = ? AND status = 'active'", [productId])]);
  if (!family || !product) { response.status(404).json({ error: "Active family or product was not found." }); return; }
  await run("INSERT INTO product_family_members (family_id, product_id, member_attributes_json, confidence, source, human_confirmed, confirmed_by, confirmed_at, created_at, updated_at) VALUES (?, ?, ?, 'high', 'staff', 1, ?, ?, ?, ?) ON CONFLICT(product_id) DO UPDATE SET family_id = excluded.family_id, member_attributes_json = excluded.member_attributes_json, confidence = 'high', source = 'staff', human_confirmed = 1, confirmed_by = excluded.confirmed_by, confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at", [familyId, productId, JSON.stringify(request.body.attributes || {}), request.adminUser.id, now, now, now]);
  response.json({ message: "Product family membership confirmed." });
}));

app.get("/api/admin/substitutions", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const status = cleanText(request.query.status || "suggested", 30);
  const stored = await all(`SELECT substitutions.*, sources.display_name AS source_name, targets.display_name AS target_name FROM product_substitutions substitutions JOIN products sources ON sources.id = substitutions.source_product_id JOIN products targets ON targets.id = substitutions.target_product_id WHERE substitutions.status = ? ORDER BY substitutions.updated_at DESC LIMIT 200`, [status]);
  const familyCandidates = status === "suggested" ? await all(`SELECT a.product_id AS source_product_id, source.display_name AS source_name, b.product_id AS target_product_id, target.display_name AS target_name, families.display_name AS family_name, a.member_attributes_json AS source_attributes_json, b.member_attributes_json AS target_attributes_json
    FROM product_family_members a JOIN product_family_members b ON b.family_id = a.family_id AND b.product_id != a.product_id JOIN product_families families ON families.id = a.family_id JOIN products source ON source.id = a.product_id JOIN products target ON target.id = b.product_id
    WHERE a.human_confirmed = 1 AND b.human_confirmed = 1 AND source.status = 'active' AND target.status = 'active' AND NOT EXISTS (SELECT 1 FROM product_substitutions existing WHERE existing.source_product_id = a.product_id AND existing.target_product_id = b.product_id) ORDER BY families.display_name, source.display_name LIMIT 200`) : [];
  response.json({ substitutions: stored.map((row) => ({ ...row, reasons: parseMetadataJson(row.reasons_json), safety_warnings: parseMetadataJson(row.safety_warnings_json) })), family_candidates: familyCandidates });
}));

app.post("/api/admin/substitutions/:sourceId/:targetId/decision", requireAdminAccess, requireLoggedInAdminAction, requireStaffPermission("manage"), asyncRoute(async (request, response) => {
  const sourceId = Number.parseInt(request.params.sourceId, 10); const targetId = Number.parseInt(request.params.targetId, 10); const decision = cleanText(request.body.decision, 30);
  if (!["confirm", "alternative_only", "not_related"].includes(decision) || sourceId === targetId) { response.status(400).json({ error: "Choose a valid substitution decision." }); return; }
  const [source, target] = await Promise.all([get("SELECT * FROM products WHERE id = ? AND status = 'active'", [sourceId]), get("SELECT * FROM products WHERE id = ? AND status = 'active'", [targetId])]);
  if (!source || !target) { response.status(404).json({ error: "Both active products are required." }); return; }
  const conflicts = dietaryConflicts(source.product_attributes_json, target.product_attributes_json); const compatible = sizeCompatible(source, target);
  const requestedConfidence = cleanText(request.body.confidence || "medium", 20); const confidence = ["high","medium","low"].includes(requestedConfidence) ? requestedConfidence : "medium";
  if (decision === "confirm" && confidence === "high" && (conflicts.length || !compatible)) { response.status(409).json({ error: "High-confidence substitute blocked by size or dietary compatibility safeguards.", conflicts, size_comparable: compatible }); return; }
  const status = decision === "not_related" ? "rejected" : decision === "alternative_only" ? "alternative_only" : "confirmed"; const type = decision === "alternative_only" ? "alternative" : cleanText(request.body.substitution_type || "very_similar", 30); const now = new Date().toISOString();
  const reasons = Array.isArray(request.body.reasons) ? request.body.reasons.map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 10) : [];
  await run("INSERT INTO product_substitutions (source_product_id,target_product_id,substitution_type,confidence,reasons_json,safety_warnings_json,source,status,reviewed_by,reviewed_at,review_note,created_at,updated_at) VALUES (?,?,?,?,?,?,'staff_review',?,?,?,?,?,?) ON CONFLICT(source_product_id,target_product_id) DO UPDATE SET substitution_type=excluded.substitution_type,confidence=excluded.confidence,reasons_json=excluded.reasons_json,safety_warnings_json=excluded.safety_warnings_json,source='staff_review',status=excluded.status,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at,review_note=excluded.review_note,updated_at=excluded.updated_at", [sourceId,targetId,type,confidence,JSON.stringify(reasons),JSON.stringify(conflicts),status,request.adminUser.id,now,cleanText(request.body.review_note,500),now,now]);
  await recordAdminAudit({ adminUserId: request.adminUser.id, action: "SUBSTITUTE_DECISION", affectedType: "product_substitution", affectedId: sourceId, metadata: { target_product_id: targetId, status, confidence, conflicts } });
  response.json({ message: status === "rejected" ? "Products marked not related." : "Substitute relationship saved for public use.", status, confidence, safety_warnings: conflicts, size_comparable: compatible });
}));

app.use("/api", (request, response) => {
  response.status(404).json({ error: "API endpoint was not found." });
});

app.get("/privacy.html", (request, response) => response.redirect(308, "/privacy"));
app.get("/terms.html", (request, response) => response.redirect(308, "/terms"));

app.use(express.static(CLIENT_DIST_DIR, { index: false }));
app.use(express.static(PUBLIC_DIR));

app.get(/^\/(?!api\/|admin(?:\.html|\/|$)|uploads\/|health$).*/, (request, response, next) => {
  if (!hasTailwindBuild()) {
    next();
    return;
  }

  sendPublicApp(response);
});

app.use((error, request, response, next) => {
  if (request.file) {
    deleteUploadedFile(`/uploads/${request.file.filename}`);
  }

  if (Array.isArray(request.files)) {
    for (const file of request.files) {
      deleteUploadedFile(`/uploads/${file.filename}`);
    }
  }

  if (error instanceof multer.MulterError) {
    recordOperationsError({
      error_type: "upload_failed",
      severity: "warning",
      message: error.code || "Upload failed.",
      source: request.originalUrl || request.path
    });

    if (error.code === "LIMIT_FILE_SIZE") {
      response.status(400).json({ error: "Upload failed: image must be 5 MB or smaller." });
      return;
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      response.status(400).json({ error: "Upload failed: use the expected image upload field." });
      return;
    }

    response.status(400).json({ error: `Upload failed: ${error.message}` });
    return;
  }

  recordOperationsError({
    error_type: error.statusCode && error.statusCode < 500 ? "api_failure" : "unhandled_exception",
    severity: error.statusCode && error.statusCode < 500 ? "warning" : "critical",
    message: error.message || "Unhandled server error.",
    source: request.originalUrl || request.path
  });

  response.status(error.statusCode || 400).json({ error: error.message || "Something went wrong." });
});

async function resumeAiProofJobs() {
  const staleBefore = new Date(Date.now() - 15 * 60000).toISOString();
  await run("UPDATE ai_proof_jobs SET status = 'waiting', last_error = 'Recovered after interrupted analysis.', updated_at = ? WHERE status = 'analyzing' AND started_at < ?", [new Date().toISOString(), staleBefore]);
  const jobs = await all("SELECT proof_id FROM ai_proof_jobs WHERE status = 'waiting' ORDER BY queued_at ASC LIMIT 25");
  for (const job of jobs) scheduleAiProofJob(job.proof_id);
}

Promise.resolve()
  .then(runOwnerRepairOnStartIfEnabled)
  .then(initDb)
  .then(loadSourceFreshnessSettings)
  .then(ensureBootstrapSuperAdmin)
  .then(auditExistingUsernames)
  .then(resumeAiProofJobs)
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Grocery Radar Janesville running at http://localhost:${PORT}`);
      console.log(`Network testing: open http://YOUR-MAC-IP:${PORT} on your phone`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
