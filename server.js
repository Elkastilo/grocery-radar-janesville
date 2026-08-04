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
  DB_PATH,
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
    files: 10
  },
  fileFilter: imageFileFilter
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
    price_label: `$${Number(row.price).toFixed(2)}`,
    regular_price: row.regular_price === null ? null : Number(row.regular_price),
    sale_price: Boolean(row.sale_price),
    size_text: row.size_text || "",
    quantity: Number(row.quantity),
    unit: row.unit,
    unit_price: Number(row.unit_price),
    unit_price_label: formatUnitPrice(row.unit_price, row.unit),
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
  delete report.product_status;
  delete report.dispute_count;

  report.has_photo_upload = false;

  return {
    ...report,
    has_private_receipt_proof: isReceiptProof && Boolean(row.photo_path),
    public_proof_label: isReceiptProof ? "Receipt proof" : report.proof_type,
    trust_label: report.status === "approved" ? "Verified by admin" : ""
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
  const category = cleanText(body.category || "other", 30).toLowerCase();
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
    regular_price: regularPrice,
    sale_price: parseImportBoolean(body.sale_price) ? 1 : 0,
    member_card_price: memberCardPrice,
    coupon_required: parseImportBoolean(body.coupon_required) ? 1 : 0,
    deal_limit: cleanText(body.deal_limit || body.limit, 80),
    multibuy_details: cleanText(body.multibuy_details, 120),
    promotion_text: cleanText(body.promotion_text, 240),
    size_text: cleanText(body.size_text, 80),
    quantity,
    unit: cleanText(body.unit || "each", 30).toLowerCase(),
    proof_type: validateImportProofType(body.proof_type),
    observed_at: normalizeOptionalTimestamp(body.observed_at || body.observed_date),
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
    price: row.price,
    regular_price: row.regular_price === null || row.regular_price === undefined ? "" : row.regular_price,
    sale_price: row.sale_price ? "on" : "",
    size_text: row.size_text || "",
    quantity: row.quantity,
    unit: row.unit,
    proof_type: row.proof_type,
    notes: composeImportReportNotes(row),
    expires_at: dateInputValue(row.valid_end_at)
  };
}

function formatPriceImportRow(row) {
  return {
    id: row.id,
    batch_id: row.batch_id,
    price_report_id: row.price_report_id || null,
    product_id: row.product_id || null,
    product_display_name: row.product_display_name || "",
    store_id: row.store_id || null,
    store_name: row.store_name || "",
    item_name: row.item_name || "",
    brand: row.brand || "",
    variant: row.variant || "",
    category: row.category || "other",
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    price_label: row.price === null || row.price === undefined ? "" : `$${Number(row.price).toFixed(2)}`,
    regular_price: row.regular_price === null || row.regular_price === undefined ? null : Number(row.regular_price),
    sale_price: Boolean(row.sale_price),
    member_card_price: row.member_card_price === null || row.member_card_price === undefined ? null : Number(row.member_card_price),
    member_card_price_label: row.member_card_price === null || row.member_card_price === undefined ? "" : `$${Number(row.member_card_price).toFixed(2)}`,
    coupon_required: Boolean(row.coupon_required),
    deal_limit: row.deal_limit || "",
    multibuy_details: row.multibuy_details || "",
    promotion_text: row.promotion_text || "",
    size_text: row.size_text || "",
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    unit: row.unit || "",
    proof_type: row.proof_type || "weekly_ad",
    observed_at: row.observed_at || "",
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
    rejected_at: row.rejected_at || ""
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
    review_reason: proofSubmission.review_note,
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

function formatProduct(row) {
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
    brand_optional: Boolean(row.brand_optional),
    preferred_brand: row.preferred_brand || "",
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
    approved_price_count: row.approved_price_count || 0,
    pending_report_count: row.pending_report_count || 0,
    unlinked_report_count: row.unlinked_report_count || 0,
    best_price: row.best_price === null || row.best_price === undefined ? null : Number(row.best_price),
    best_price_label: row.best_price === null || row.best_price === undefined ? "" : `$${Number(row.best_price).toFixed(2)}`,
    best_store_name: row.best_store_name || "",
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
  return `
    ${alias}.*,
    (
      SELECT COUNT(*)
      FROM price_reports
      WHERE price_reports.product_id = ${alias}.id
        AND price_reports.status = 'approved'
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
      SELECT price_reports.price
      FROM price_reports
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND price_reports.status = 'approved'
        AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
      ORDER BY price_reports.unit_price ASC, price_reports.price ASC, price_reports.submitted_at DESC
      LIMIT 1
    ) AS best_price,
    (
      SELECT stores.name
      FROM price_reports
      JOIN stores ON stores.id = price_reports.store_id
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND price_reports.status = 'approved'
        AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
      ORDER BY price_reports.unit_price ASC, price_reports.price ASC, price_reports.submitted_at DESC
      LIMIT 1
    ) AS best_store_name,
    (
      SELECT MAX(price_reports.submitted_at)
      FROM price_reports
      JOIN users ON users.id = price_reports.user_id
      WHERE price_reports.product_id = ${alias}.id
        AND price_reports.status = 'approved'
        AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
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
    )`,
    params: [`%${normalized}%`, `%${normalized}%`, `%${normalized}%`]
  };
}

async function getProductById(productId, includeHidden = false) {
  if (!productId) {
    return null;
  }

  const filters = ["products.id = ?"];
  const params = [productId];

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
    target_url: row.target_url || "",
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
      products.default_size_text AS product_default_size_text
    FROM price_reports pr
    JOIN stores ON stores.id = pr.store_id
    JOIN users ON users.id = pr.user_id
    LEFT JOIN products ON products.id = pr.product_id
  `;
}

function baseApprovedReportFilters(item, storeId = null, options = {}) {
  const filters = [
    "pr.status = 'approved'",
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

  const approvedReport = await get(
    `
      SELECT pr.id, pr.proof_type
      FROM price_reports pr
      JOIN users ON users.id = pr.user_id
      WHERE pr.photo_path = ?
        AND pr.status = 'approved'
        AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
      LIMIT 1
    `,
    [uploadedFileUrl(filename)]
  );

  if (!approvedReport || approvedReport.proof_type === "receipt_photo") {
    response.status(404).send("Upload not found.");
    return;
  }

  sendUploadFileByFilename(filename, response);
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
      adminPhoneUrl: `http://YOUR-MAC-IP:${PORT}/admin.html?pin=YOUR_ADMIN_PIN`,
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
    admin_role: isSuperAdminAccount(user) ? "super_admin" : user.is_admin ? "admin" : "user",
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

  const pin = request.query.pin || (request.body && request.body.pin);

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
    role: isSuperAdminAccount(row) ? "super_admin" : row.is_admin ? "admin" : "user",
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
    domain: APP_DOMAIN,
    environment: process.env.NODE_ENV || "development",
    database_reachable: databaseReachable,
    timestamp: new Date().toISOString()
  });
}));

app.get("/", (request, response) => {
  sendPublicApp(response);
});

app.get("/admin.html", asyncRoute(async (request, response) => {
  const access = await getAdminAccess(request);

  if (!access.allowed) {
    response.status(403).send(authPage(
      "Admin Access Required",
      "You must be an admin user or provide the ADMIN_PIN development fallback to view this page."
    ));
    return;
  }

  response.sendFile(path.join(PUBLIC_DIR, "admin.html"));
}));

app.get("/uploads/:filename", asyncRoute(sendPublicUploadFile));
app.get("/api/admin/uploads/:filename", requireAdminAccess, asyncRoute(sendAdminUploadFile));

app.get("/api/stores", asyncRoute(async (request, response) => {
  const stores = await all(
    `
      SELECT id, name, address, city, state, store_type, active
      FROM stores
      WHERE active = 1
      ORDER BY id
    `
  );

  response.json({ stores });
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

  if (user && !isBlockedAccount(user)) {
    await markUserSeen(user.id);
  }

  response.json({
    ok: true,
    loggedIn: Boolean(user && !isBlockedAccount(user))
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
        WHERE pr.status = 'approved'
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
          AND EXISTS (
            SELECT 1
            FROM price_reports
            JOIN users ON users.id = price_reports.user_id
            WHERE price_reports.product_id = products.id
              AND price_reports.status = 'approved'
              AND COALESCE(users.account_status, 'active') NOT IN ('suspended', 'banned', 'deleted', 'deactivated')
          )
        ORDER BY approved_price_count DESC, last_reported_at DESC, products.display_name ASC
        LIMIT 36
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

  const q = cleanText(request.query.q, 120).toLowerCase();
  const storeId = Number.parseInt(request.query.store, 10);
  const category = cleanText(request.query.category, 30).toLowerCase();
  const sort = cleanText(request.query.sort, 40) || "cheapest_unit_price";
  const filters = [
    "pr.status = 'approved'",
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

  await trackAnalyticsEvent(request, {
    event_type: "search_performed",
    cart_item_name: q,
    store_id: Number.isInteger(storeId) ? storeId : null,
    category: CATEGORIES.includes(category) ? category : "",
    metadata: {
      sort,
      result_count: reports.length,
      product_count: products.length
    }
  });

  response.json({
    products: products.map(formatPublicProduct),
    reports: reports.map(formatPublicReport)
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

  const reports = await all(
    `
      ${reportSelectWithProduct()}
      WHERE pr.product_id = ?
        AND pr.status = 'approved'
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
    [productId]
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
    allergy_warning: "Always check the package label before buying or eating."
  });
}));

app.post("/api/proof-submissions", requireLogin, upload.single("proof_photo"), asyncRoute(async (request, response) => {
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

    const user = request.currentUser;
    const itemHint = cleanText(request.body.item_hint || request.body.item_name, 120);
    const priceHint = cleanText(request.body.price_hint || request.body.price, 40);
    const userNotes = cleanText(request.body.notes, 300);
    const proofFileHash = hashUploadedFile(request.file);
    const duplicate = await findDuplicateProofBatch({
      userId: user.id,
      proofFileHash,
      sourceUrl: source.source_url
    });
    const trustProfile = await contributorTrustProfile(user.id);
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
          receipt_store_name,
          receipt_store_address,
          notes,
          created_by,
          proof_file_hash,
          duplicate_of_batch_id,
          duplicate_scope,
          review_priority,
          proof_quality_flags,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'needs_admin_review', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        store.name,
        store.address || "",
        notes,
        user.id,
        proofFileHash,
        duplicate?.duplicate_of_batch_id || null,
        duplicate?.duplicate_scope || "",
        reviewPriority,
        proofQualityFlags.join(","),
        now,
        now
      ]
    );

    let ocrHelper = {
      ran: false,
      status: "not_run",
      confidence: "",
      has_text: false
    };

    if (publicProofType === "receipt" && photoPath) {
      const batch = await priceImportBatchById(result.lastID);
      const ocr = await runReceiptOcr(batch);

      ocrHelper = {
        ran: true,
        status: ocr.text ? "helper_text" : ocr.status,
        confidence: ocr.confidence || "low",
        has_text: Boolean(ocr.text)
      };

      await run(
        `
          UPDATE price_import_batches
          SET receipt_ocr_text = ?,
              receipt_ocr_confidence = ?,
              updated_at = ?
          WHERE id = ?
        `,
        [
          ocr.text || "",
          ocr.confidence || "low",
          now,
          result.lastID
        ]
      );
    }

    await createAdminNotification(
      "proof_submission_needs_review",
      "New proof needs review",
      `${user.username} submitted ${proofMapping.label.toLowerCase()} proof for ${store.name}.`,
      {
        related_type: "price_import_batch",
        related_id: result.lastID,
        related_import_batch_id: result.lastID,
        target_tab: "priceImporterTab",
        target_url: `/admin.html?tab=priceImporterTab&batch=${result.lastID}`
      }
    );

    await createUserNotification(
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
      message: ocrHelper.ran && ocrHelper.has_text
        ? "Proof saved. OCR helper text was captured for admin review."
        : "Proof saved. We'll review it manually.",
      batch_id: result.lastID,
      status: "needs_admin_review",
      ocr_helper: ocrHelper,
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
      SELECT batches.*, users.username AS created_by_username
      FROM price_import_batches batches
      LEFT JOIN users ON users.id = batches.created_by
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
        regular_price,
        sale_price,
        member_card_price,
        coupon_required,
        deal_limit,
        multibuy_details,
        promotion_text,
        size_text,
        quantity,
        unit,
        proof_type,
        observed_at,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      draft.regular_price,
      draft.sale_price,
      draft.member_card_price,
      draft.coupon_required,
      draft.deal_limit,
      draft.multibuy_details,
      draft.promotion_text,
      draft.size_text,
      draft.quantity,
      draft.unit,
      draft.proof_type,
      draft.observed_at,
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

async function approvePriceImportRow(rowId, adminUser) {
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
    return {
      row,
      report_id: row.price_report_id,
      message: "Import row was already approved."
    };
  }

  if (row.status === "rejected") {
    throw new Error("Rejected import rows must be edited before approval.");
  }

  if (!row.photo_path && !row.source_url) {
    throw new Error("Import approval requires a linked proof image or source link.");
  }

  if (row.proof_type === "no_photo" && !row.source_url) {
    throw new Error("Imported prices must use receipt, shelf tag, weekly ad, or source link proof.");
  }

  const importBatch = await priceImportBatchById(row.batch_id);
  const validStoreIds = await getActiveStoreIds();
  const cleanReport = validateReport(importRowToReportBody(row), validStoreIds);
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
        admin_rejection_reason,
        admin_rejection_note,
        reviewed_at,
        reviewed_by,
        submitted_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'approved', NULL, NULL, ?, ?, ?, ?)
    `,
    [
      adminUser.id,
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
      submittedAt,
      adminUser.id,
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
  await notifyCartUsersForApprovedReport(updatedReport);
  await updateUserAccuracy(adminUser.id);

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
          updated_at = ?
      WHERE id = ?
    `,
    [importBatch && isProofSubmissionBatch(importBatch) ? 1 : 0, row.batch_id, submittedAt, row.batch_id]
  );

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
          target_url: `/?tab=accountView&section=proof&proof=${importBatch.id}&report=${result.lastID}`
        }
      );
    }
  }

  return {
    row: await priceImportRowById(rowId),
    report_id: result.lastID,
    product_id: productId,
    unit_price_label: unitPrice.formatted,
    message: "Import row approved into public price reports."
  };
}

app.get("/api/admin/price-imports", requireAdminAccess, asyncRoute(async (request, response) => {
  const cleanupReport = await approvedReceiptCleanupReport();
  const batches = await all(
    `
      SELECT batches.*, users.username AS created_by_username
      FROM price_import_batches batches
      LEFT JOIN users ON users.id = batches.created_by
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
          VALUES (?, ?, ?, ?, ?, ?, 'import_draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    }
  } catch (error) {
    for (const file of files) {
      deleteUploadedFile(uploadedFileUrl(file.filename));
    }

    throw error;
  }

  const extractionAttempts = [];
  let responseBatches = created;

  if (sourceType === "receipt" || proofType === "receipt_photo") {
    responseBatches = [];

    for (const batch of created) {
      const ocr = await runReceiptOcr(batch);

      if (ocr.text) {
        await run(
          `
            UPDATE price_import_batches
            SET receipt_ocr_text = ?,
                receipt_ocr_confidence = ?,
                updated_at = ?
            WHERE id = ?
          `,
          [ocr.text, ocr.confidence || "low", now, batch.id]
        );
      } else {
        await run(
          `
            UPDATE price_import_batches
            SET receipt_ocr_confidence = ?,
                updated_at = ?
            WHERE id = ?
          `,
          [ocr.confidence || "low", now, batch.id]
        );
      }

      extractionAttempts.push({
        batch_id: batch.id,
        status: ocr.text ? "helper_text" : ocr.status,
        confidence: ocr.confidence || "low",
        message: ocr.text
          ? "Receipt saved as proof. OCR found helper text, but no rows were created automatically. Enter the item and price manually."
          : "Receipt saved as proof. Enter the item and price manually.",
        created_count: 0,
        skipped_duplicate_row_ids: [],
        ignored_line_count: 0,
        skipped_lines: [],
        debug: ocr.debug || ""
      });

      const rows = await priceImportRowsForBatchIds([batch.id]);
      responseBatches.push(formatPriceImportBatch(await priceImportBatchById(batch.id), rows));
    }
  }

  response.status(201).json({
    message: "Proof image uploaded. Add or edit draft rows before approval.",
    extraction_attempt: {
      status: extractionAttempts.length
        ? extractionAttempts.some((attempt) => attempt.status === "helper_text") ? "helper_text" : "failed"
        : "failed",
      message: extractionAttempts.length
        ? extractionAttempts.map((attempt) => attempt.message).join(" ")
        : "Image OCR is not available yet. Use Source Text Autofill below or add rows manually.",
      attempts: extractionAttempts
    },
    batches: responseBatches.map((batch) => batch.rows ? batch : formatPriceImportBatch(batch, []))
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
      results.push(await approvePriceImportRow(rowId, request.adminUser));
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

app.post("/api/admin/price-import-rows/:id", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
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

  const draft = cleanImportRowDraft({
    ...existing,
    ...request.body,
    status: request.body.status || existing.status
  });
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
          regular_price = ?,
          sale_price = ?,
          member_card_price = ?,
          coupon_required = ?,
          deal_limit = ?,
          multibuy_details = ?,
          promotion_text = ?,
          size_text = ?,
          quantity = ?,
          unit = ?,
          proof_type = ?,
          observed_at = ?,
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
      draft.variant,
      draft.category,
      draft.price,
      draft.regular_price,
      draft.sale_price,
      draft.member_card_price,
      draft.coupon_required,
      draft.deal_limit,
      draft.multibuy_details,
      draft.promotion_text,
      draft.size_text,
      draft.quantity,
      draft.unit,
      draft.proof_type,
      draft.observed_at,
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

  response.json({
    message: "Import row saved.",
    row: formatPriceImportRow(await priceImportRowById(rowId))
  });
}));

app.post("/api/admin/price-import-rows/:id/approve", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const rowId = Number.parseInt(request.params.id, 10);
  const result = await approvePriceImportRow(rowId, request.adminUser);

  response.json(result);
}));

app.post("/api/admin/price-import-rows/:id/reject", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
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
      WHERE id = ?
    `,
    [
      cleanText(request.body.admin_rejection_note || "Rejected by admin.", 500),
      request.adminUser ? request.adminUser.id : null,
      now,
      request.adminUser ? request.adminUser.id : null,
      now,
      rowId
    ]
  );

  response.json({
    message: "Import row rejected.",
    row: formatPriceImportRow(await priceImportRowById(rowId))
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
    String(report.unit || "") !== String(cleanReport.unit || "")
  ].some(Boolean);
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

  await updateUserAccuracy(report.user_id);

  if (comparableFieldsChanged && report.status === "approved") {
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

  response.json({
    message: approveAfterEdit ? "Report edited and approved." : "Report edits saved.",
    unit_price_label: unitPrice.formatted
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

  response.json({
    message: "Product tools help organize real user reports into admin-controlled products.",
    product_statuses: PRODUCT_STATUSES,
    products: products.map(formatProduct),
    pending_product_candidates: products.filter((product) => product.status === "needs_review").map(formatProduct),
    unlinked_reports: unlinkedReports.map(formatReport),
    reports_missing_product_info: productInfoNeeds.map(formatReport),
    popular_cart_items: popularCartItems
  });
}));

app.post("/api/admin/products", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
  const product = validateProduct(request.body, { defaultActive: true });
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

  response.status(201).json({
    message: "Product created.",
    product_id: result.lastID
  });
}));

app.post("/api/admin/products/:id", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
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

  response.json({ message: "Product updated." });
}));

app.post("/api/admin/products/:id/merge", requireAdminAccess, requireLoggedInAdminAction, asyncRoute(async (request, response) => {
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

  const now = new Date().toISOString();
  await run("UPDATE price_reports SET product_id = ? WHERE product_id = ?", [targetId, sourceId]);
  await run("UPDATE cart_items SET product_id = ? WHERE product_id = ?", [targetId, sourceId]);
  await run(
    `
      UPDATE products
      SET status = 'merged',
          merged_into_product_id = ?,
          admin_note = ?,
          updated_by = ?,
          updated_at = ?
      WHERE id = ?
    `,
    [targetId, adminNote, request.adminUser ? request.adminUser.id : null, now, sourceId]
  );

  response.json({ message: "Product merged. Linked reports were moved to the surviving product." });
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

app.use(express.static(CLIENT_DIST_DIR, { index: false }));
app.use(express.static(PUBLIC_DIR));

app.get(/^\/(?!api\/|admin\.html$|uploads\/|health$).*/, (request, response, next) => {
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

initDb()
  .then(ensureBootstrapSuperAdmin)
  .then(auditExistingUsernames)
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
