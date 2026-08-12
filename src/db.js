const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { APP_VERSION } = require("./version");

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "grocery_radar.sqlite");
const DATA_DIR_EXISTED_AT_START = fs.existsSync(DATA_DIR) && fs.statSync(DATA_DIR).isDirectory();
const DB_FILE_EXISTED_AT_START = fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).isFile();
const OWNER_REPAIR_START_ENABLED = ["1", "true", "yes", "on"].includes(
  String(process.env.OWNER_REPAIR_ON_START || "").trim().toLowerCase()
);
const DB_OPEN_FLAGS = OWNER_REPAIR_START_ENABLED
  ? sqlite3.OPEN_READWRITE
  : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;

if (!OWNER_REPAIR_START_ENABLED) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, DB_OPEN_FLAGS);

const STORE_SEED = [
  {
    name: "Woodman’s Janesville",
    address: "2819 N. Lexington Drive",
    city: "Janesville",
    state: "WI",
    store_type: "grocery",
    active: 1
  },
  {
    name: "Walmart Janesville",
    address: "3800 Deerfield Dr",
    city: "Janesville",
    state: "WI",
    store_type: "supercenter",
    active: 1
  },
  {
    name: "Sam’s Club Janesville",
    address: "3900 Deerfield Dr",
    city: "Janesville",
    state: "WI",
    store_type: "warehouse club",
    active: 1
  },
  {
    name: "ALDI Janesville",
    address: "2901 Deerfield Dr",
    city: "Janesville",
    state: "WI",
    store_type: "grocery",
    active: 1
  },
  {
    name: "Festival Foods Janesville",
    address: "2233 Humes Road",
    city: "Janesville",
    state: "WI",
    store_type: "grocery",
    active: 1
  },
  {
    name: "Hy-Vee Janesville",
    address: "2500 Humes Rd",
    city: "Janesville",
    state: "WI",
    store_type: "grocery",
    active: 1
  },
  {
    name: "Daniels Sentry Janesville",
    address: "2501 West Court Street",
    city: "Janesville",
    state: "WI",
    store_type: "grocery",
    active: 1
  },
  {
    name: "Santa Maria Supermarket Janesville",
    address: "1820 Center Ave",
    city: "Janesville",
    state: "WI",
    store_type: "grocery",
    active: 1
  },
  {
    name: "Target Janesville",
    address: "2017 Humes Rd",
    city: "Janesville",
    state: "WI",
    store_type: "grocery and household",
    active: 1
  },
  {
    name: "Kwik Trip / Stop-N-Go Janesville",
    address:
      "1604 E Racine St; 714 Center Ave; 254 E Memorial Dr; 1919 Humes Rd; 2518 W Court St; 2810 E Milwaukee St; 3123 S US Hwy 51; 3359 Milton Ave; 1100 N Wright Rd",
    city: "Janesville",
    state: "WI",
    store_type: "convenience",
    active: 1
  },
  {
    name: "Dollar Tree Janesville",
    address: "3023 Milton Avenue suite 181; 601 W. Milwaukee Street",
    city: "Janesville",
    state: "WI",
    store_type: "discount",
    active: 1
  },
  {
    name: "Dollar General Janesville",
    address: "6499 N Riverside Dr (Hwy 51); 2019 Center Ave; 2200 W Court St Ste 100",
    city: "Janesville",
    state: "WI",
    store_type: "discount",
    active: 1
  }
];

const FEATURE_VOTE_SEED = [
  { slug: "dark-mode", title: "Dark Mode", description: "A lower-glare display option for night shopping." },
  { slug: "barcode-scanner", title: "Barcode Scanner", description: "Scan grocery items to find or submit prices faster." },
  { slug: "shopping-lists", title: "Shopping Lists", description: "Reusable grocery lists for weekly trips." },
  { slug: "sale-alerts", title: "Sale Alerts", description: "Notify users when watched items get a new approved deal." },
  { slug: "receipt-rewards", title: "Receipt Rewards", description: "More reward tools for accepted receipt proof." },
  { slug: "price-history", title: "Price History", description: "Show how approved prices change over time." },
  { slug: "notifications", title: "Notifications", description: "More control over price and proof notifications." }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

async function initDb() {
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Janesville',
      state TEXT NOT NULL DEFAULT 'WI',
      store_type TEXT NOT NULL DEFAULT 'grocery',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT
    )
  `);

  await migrateStoresTable();

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      accuracy_score INTEGER NOT NULL DEFAULT 0,
      is_email_verified INTEGER NOT NULL DEFAULT 0,
      email_verified_at TEXT,
      email_verification_token TEXT,
      email_verification_expires TEXT,
      verification_email_last_sent_at TEXT,
      verification_email_send_count INTEGER NOT NULL DEFAULT 0,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      staff_role TEXT NOT NULL DEFAULT 'user',
      work_preferences_json TEXT NOT NULL DEFAULT '{}',
      account_status TEXT NOT NULL DEFAULT 'active',
      ban_reason TEXT,
      ban_note TEXT,
      banned_at TEXT,
      banned_by INTEGER,
      hide_from_leaderboard INTEGER NOT NULL DEFAULT 0,
      force_username_change INTEGER NOT NULL DEFAULT 0,
      username_status TEXT NOT NULL DEFAULT 'approved',
      username_moderation_note TEXT,
      admin_note TEXT,
      avoid_ingredients TEXT,
      last_activity_at TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await migrateUsersTable();

  await run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL,
      default_size_text TEXT,
      default_quantity REAL,
      default_unit TEXT,
      default_storage_condition TEXT,
      brand_optional INTEGER NOT NULL DEFAULT 1,
      preferred_brand TEXT,
      common_aliases TEXT,
      ingredient_info_url TEXT,
      allergen_note TEXT,
      admin_safety_note TEXT,
      status TEXT NOT NULL DEFAULT 'needs_review',
      created_by_user_id INTEGER,
      created_by_admin_id INTEGER,
      merged_into_product_id INTEGER,
      admin_note TEXT,
      updated_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (merged_into_product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  await migrateProductsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      original_image_path TEXT,
      original_name TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      alt_text TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'admin_upload',
      source_url TEXT,
      source_note TEXT,
      crop_fit_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'draft',
      is_primary INTEGER NOT NULL DEFAULT 0,
      uploaded_by INTEGER,
      moderated_by INTEGER,
      moderated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      source_format TEXT NOT NULL DEFAULT 'csv',
      row_count INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_import_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      brand TEXT,
      variant TEXT,
      size_text TEXT,
      category TEXT NOT NULL DEFAULT 'other',
      upc TEXT,
      image_filename TEXT,
      matched_image_path TEXT,
      image_match_confidence TEXT NOT NULL DEFAULT 'unknown',
      duplicate_product_id INTEGER,
      suggested_product_id INTEGER,
      warnings_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES catalog_import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (duplicate_product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (suggested_product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS catalog_import_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      matched_row_id INTEGER,
      match_confidence TEXT NOT NULL DEFAULT 'unknown',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES catalog_import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (matched_row_id) REFERENCES catalog_import_rows(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS price_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      product_id INTEGER,
      item_name TEXT NOT NULL,
      brand TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      regular_price REAL,
      sale_price INTEGER NOT NULL DEFAULT 0,
      size_text TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      price_basis TEXT,
      comparison_price REAL,
      comparison_unit TEXT,
      estimated_item_price REAL,
      approximate_item_weight REAL,
      approximate_item_weight_unit TEXT,
      package_price REAL,
      multibuy_quantity REAL,
      multibuy_total_price REAL,
      proof_type TEXT NOT NULL,
      photo_path TEXT,
      photo_original_name TEXT,
      photo_mime_type TEXT,
      photo_size_bytes INTEGER,
      notes TEXT,
      confidence TEXT NOT NULL DEFAULT 'low',
      verification_count INTEGER NOT NULL DEFAULT 0,
      dispute_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_rejection_reason TEXT,
      admin_rejection_note TEXT,
      reviewed_at TEXT,
      reviewed_by INTEGER,
      edited_by INTEGER,
      edited_at TEXT,
      admin_edit_note TEXT,
      last_edited_by INTEGER,
      last_edited_at TEXT,
      edit_note TEXT,
      official_product_url TEXT,
      source_url TEXT,
      source_title TEXT,
      source_domain TEXT,
      source_checked_at TEXT,
      ingredient_info_url TEXT,
      allergen_note TEXT,
      admin_safety_note TEXT,
      submitted_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  await migratePriceReportsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS product_normalization_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      normalized_alias TEXT NOT NULL UNIQUE,
      display_alias TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      category TEXT,
      storage_condition TEXT,
      brand TEXT,
      variant TEXT,
      size_text TEXT,
      confirmation_count INTEGER NOT NULL DEFAULT 1,
      last_approved_report_id INTEGER,
      last_approved_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (last_approved_report_id) REFERENCES price_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (last_approved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS price_provenance_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_report_id INTEGER,
      import_batch_id INTEGER,
      import_row_id INTEGER,
      event_type TEXT NOT NULL,
      actor_user_id INTEGER,
      submitter_user_id INTEGER,
      reason TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (price_report_id) REFERENCES price_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (import_batch_id) REFERENCES price_import_batches(id) ON DELETE SET NULL,
      FOREIGN KEY (import_row_id) REFERENCES price_import_rows(id) ON DELETE SET NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (submitter_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quality_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      store_id INTEGER NOT NULL,
      price_report_id INTEGER,
      import_batch_id INTEGER,
      rating INTEGER NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      comment TEXT,
      purchase_date TEXT,
      review_date TEXT NOT NULL,
      verified_purchase INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'visible',
      moderation_note TEXT,
      moderated_by INTEGER,
      moderated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (price_report_id) REFERENCES price_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (import_batch_id) REFERENCES price_import_batches(id) ON DELETE SET NULL,
      FOREIGN KEY (moderated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quality_review_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quality_review_id INTEGER NOT NULL,
      reporter_user_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_by INTEGER,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (quality_review_id) REFERENCES quality_reviews(id) ON DELETE CASCADE,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(quality_review_id, reporter_user_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quality_review_helpful_votes (
      quality_review_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (quality_review_id, user_id),
      FOREIGN KEY (quality_review_id) REFERENCES quality_reviews(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run("CREATE INDEX IF NOT EXISTS idx_quality_reviews_product_store_date ON quality_reviews(product_id, store_id, review_date DESC)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_provenance_report ON price_provenance_events(price_report_id, created_at)");

  await run(`
    CREATE TABLE IF NOT EXISTS verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      price_report_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      verification_type TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (price_report_id) REFERENCES price_reports(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(price_report_id, user_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS point_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT,
      price_report_id INTEGER,
      related_import_batch_id INTEGER,
      related_import_row_id INTEGER,
      created_by_admin_id INTEGER,
      admin_note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (price_report_id) REFERENCES price_reports(id) ON DELETE SET NULL
    )
  `);

  await migratePointEventsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS store_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_by_user_id INTEGER NOT NULL,
      store_name TEXT NOT NULL,
      address TEXT,
      city TEXT NOT NULL DEFAULT 'Janesville',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      suggestion_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_store TEXT,
      related_item TEXT,
      photo_path TEXT,
      photo_original_name TEXT,
      photo_mime_type TEXT,
      photo_size_bytes INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER,
      item_name TEXT NOT NULL,
      preferred_brand TEXT,
      brand_mode TEXT NOT NULL DEFAULT 'any',
      avoid_ingredients TEXT,
      quantity_needed TEXT,
      size_preference TEXT,
      must_have INTEGER NOT NULL DEFAULT 0,
      optional_item INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  await migrateCartItemsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id INTEGER,
      session_id TEXT,
      product_id INTEGER,
      report_id INTEGER,
      store_id INTEGER,
      sponsor_id INTEGER,
      cart_item_name TEXT,
      category TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (report_id) REFERENCES price_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
    )
  `);

  await migrateAnalyticsEventsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS sponsors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sponsor_name TEXT NOT NULL,
      sponsor_type TEXT NOT NULL DEFAULT 'business',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_url TEXT,
      image_url TEXT,
      starts_at TEXT,
      ends_at TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      weekly_price_note TEXT,
      admin_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await migrateSponsorsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS missing_price_priorities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'priority',
      admin_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(item_name, category)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS price_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL DEFAULT 'weekly_ad',
      proof_type TEXT NOT NULL DEFAULT 'weekly_ad',
      photo_path TEXT NOT NULL,
      photo_original_name TEXT,
      photo_mime_type TEXT,
      photo_size_bytes INTEGER,
      status TEXT NOT NULL DEFAULT 'import_draft',
      source_url TEXT,
      source_title TEXT,
      source_domain TEXT,
      source_checked_at TEXT,
      default_store_id INTEGER,
      batch_title TEXT,
      observed_at TEXT,
      valid_start_at TEXT,
      valid_end_at TEXT,
      source_text TEXT,
      receipt_store_name TEXT,
      receipt_store_address TEXT,
      receipt_purchase_date TEXT,
      receipt_purchase_time TEXT,
      receipt_total REAL,
      receipt_transaction_id TEXT,
      receipt_ocr_text TEXT,
      receipt_ocr_confidence TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await migratePriceImportBatchesTable();

  await run(`
    CREATE TABLE IF NOT EXISTS price_import_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      price_report_id INTEGER,
      product_id INTEGER,
      store_id INTEGER,
      item_name TEXT NOT NULL DEFAULT '',
      brand TEXT,
      variant TEXT,
      category TEXT NOT NULL DEFAULT 'other',
      price REAL,
      regular_price REAL,
      sale_price INTEGER NOT NULL DEFAULT 0,
      member_card_price REAL,
      coupon_required INTEGER NOT NULL DEFAULT 0,
      deal_limit TEXT,
      multibuy_details TEXT,
      promotion_text TEXT,
      size_text TEXT,
      quantity REAL,
      unit TEXT,
      price_basis TEXT,
      comparison_price REAL,
      comparison_unit TEXT,
      estimated_item_price REAL,
      approximate_item_weight REAL,
      approximate_item_weight_unit TEXT,
      package_price REAL,
      proof_type TEXT NOT NULL DEFAULT 'weekly_ad',
      observed_at TEXT,
      valid_start_at TEXT,
      valid_end_at TEXT,
      source_url TEXT,
      source_title TEXT,
      source_domain TEXT,
      source_checked_at TEXT,
      raw_receipt_line TEXT,
      extracted_item_name TEXT,
      extracted_price REAL,
      extracted_quantity REAL,
      extracted_weight REAL,
      extracted_unit TEXT,
      extraction_confidence TEXT NOT NULL DEFAULT 'low',
      extraction_notes TEXT,
      duplicate_warning TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'import_draft',
      rejection_reason TEXT,
      admin_rejection_note TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL,
      approved_by INTEGER,
      approved_at TEXT,
      rejected_by INTEGER,
      rejected_at TEXT,
      FOREIGN KEY (batch_id) REFERENCES price_import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (price_report_id) REFERENCES price_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await migratePriceImportRowsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS ai_processing_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      manual_only INTEGER NOT NULL DEFAULT 1,
      max_analyses_per_hour INTEGER NOT NULL DEFAULT 20,
      max_analyses_per_day INTEGER NOT NULL DEFAULT 100,
      retry_limit INTEGER NOT NULL DEFAULT 2,
      model TEXT NOT NULL DEFAULT '',
      primary_model TEXT NOT NULL DEFAULT '',
      fallback_model TEXT NOT NULL DEFAULT '',
      updated_by INTEGER,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    INSERT OR IGNORE INTO ai_processing_settings (id, enabled, manual_only, max_analyses_per_hour, max_analyses_per_day, retry_limit, model, updated_at)
    VALUES (1, 0, 1, 20, 100, 2, '', ?)
  `, [new Date().toISOString()]);

  await migrateAiProcessingSettingsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS ai_proof_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proof_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'waiting',
      provider TEXT,
      model TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      manual_requested INTEGER NOT NULL DEFAULT 0,
      request_fingerprint TEXT,
      last_error TEXT,
      queued_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (proof_id) REFERENCES price_import_batches(id) ON DELETE CASCADE
    )
  `);

  await migrateAiProofJobsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS ai_proof_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL UNIQUE,
      proof_id INTEGER NOT NULL UNIQUE,
      proof_type TEXT,
      detected_store_name TEXT,
      detected_store_id INTEGER,
      detected_store_confidence TEXT NOT NULL DEFAULT 'unknown',
      submitted_store_id INTEGER,
      resolved_store_id INTEGER,
      store_resolution TEXT NOT NULL DEFAULT 'unresolved',
      source_date TEXT,
      source_date_confidence TEXT NOT NULL DEFAULT 'unknown',
      overall_confidence TEXT NOT NULL DEFAULT 'unknown',
      warnings_json TEXT NOT NULL DEFAULT '[]',
      structured_json TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      ready_count INTEGER NOT NULL DEFAULT 0,
      check_count INTEGER NOT NULL DEFAULT 0,
      unknown_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES ai_proof_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (proof_id) REFERENCES price_import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (detected_store_id) REFERENCES stores(id) ON DELETE SET NULL,
      FOREIGN KEY (submitted_store_id) REFERENCES stores(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_store_id) REFERENCES stores(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ai_proof_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      proof_id INTEGER NOT NULL,
      attempt_number INTEGER NOT NULL,
      attempt_kind TEXT NOT NULL DEFAULT 'initial',
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL DEFAULT 'analyzing',
      request_fingerprint TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      estimated_cost_usd REAL,
      last_error TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(job_id, attempt_number),
      FOREIGN KEY (job_id) REFERENCES ai_proof_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (proof_id) REFERENCES price_import_batches(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      admin_only INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_type TEXT,
      related_id INTEGER,
      related_report_id INTEGER,
      related_import_batch_id INTEGER,
      related_import_row_id INTEGER,
      points_awarded INTEGER,
      target_tab TEXT,
      target_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await migrateNotificationsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS user_admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      admin_user_id INTEGER,
      note_type TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS blocked_username_phrases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phrase TEXT NOT NULL UNIQUE COLLATE NOCASE,
      reason TEXT,
      created_by_admin_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS username_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      old_username TEXT,
      new_username TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      changed_by_admin_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_user_id INTEGER,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      assigned_admin_id INTEGER,
      duplicate_of_ticket_id INTEGER,
      public_response TEXT,
      internal_notes TEXT,
      source_url TEXT,
      related_report_id INTEGER,
      related_store_id INTEGER,
      related_product_id INTEGER,
      city TEXT NOT NULL DEFAULT 'Janesville',
      region TEXT NOT NULL DEFAULT 'WI',
      country_code TEXT NOT NULL DEFAULT 'US',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      closed_at TEXT,
      closed_by INTEGER,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (duplicate_of_ticket_id) REFERENCES feedback_tickets(id) ON DELETE SET NULL,
      FOREIGN KEY (related_report_id) REFERENCES price_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (related_store_id) REFERENCES stores(id) ON DELETE SET NULL,
      FOREIGN KEY (related_product_id) REFERENCES products(id) ON DELETE SET NULL,
      FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feedback_ticket_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      update_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      internal_note TEXT,
      public_response TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (ticket_id) REFERENCES feedback_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feature_vote_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      city TEXT NOT NULL DEFAULT 'Janesville',
      region TEXT NOT NULL DEFAULT 'WI',
      country_code TEXT NOT NULL DEFAULT 'US',
      created_by_admin_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS feature_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      option_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (option_id) REFERENCES feature_vote_options(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(option_id, user_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      announcement_type TEXT NOT NULL DEFAULT 'known_issue',
      status TEXT NOT NULL DEFAULT 'draft',
      scope TEXT NOT NULL DEFAULT 'homepage_banner',
      city TEXT NOT NULL DEFAULT 'Janesville',
      region TEXT NOT NULL DEFAULT 'WI',
      country_code TEXT NOT NULL DEFAULT 'US',
      starts_at TEXT,
      ends_at TEXT,
      published_at TEXT,
      published_by INTEGER,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS homepage_service_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      service_status TEXT NOT NULL DEFAULT 'online',
      version_label TEXT NOT NULL DEFAULT 'Early Access 0.2.0',
      current_focus TEXT NOT NULL DEFAULT 'Adding and verifying Janesville grocery prices.',
      main_message TEXT NOT NULL,
      community_mission_title TEXT NOT NULL DEFAULT 'Help fill the Janesville radar.',
      community_mission_body TEXT NOT NULL,
      homepage_announcement TEXT,
      maintenance_enabled INTEGER NOT NULL DEFAULT 0,
      maintenance_title TEXT,
      maintenance_message TEXT,
      maintenance_impact TEXT,
      maintenance_start_at TEXT,
      maintenance_end_at TEXT,
      maintenance_status TEXT NOT NULL DEFAULT 'monitoring',
      published_at TEXT,
      published_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by INTEGER,
      FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS homepage_patch_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_label TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      added_json TEXT NOT NULL DEFAULT '[]',
      changed_json TEXT NOT NULL DEFAULT '[]',
      fixed_json TEXT NOT NULL DEFAULT '[]',
      known_issues_json TEXT NOT NULL DEFAULT '[]',
      next_focus_json TEXT NOT NULL DEFAULT '[]',
      release_date TEXT,
      internal_commit_hash TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,
      published_by INTEGER,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await migrateHomepagePatchNotesTable();

  await run(`
    CREATE TABLE IF NOT EXISTS user_release_reads (
      user_id INTEGER NOT NULL,
      patch_note_id INTEGER NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (user_id, patch_note_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (patch_note_id) REFERENCES homepage_patch_notes(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS homepage_known_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      issue_status TEXT NOT NULL DEFAULT 'investigating',
      description TEXT NOT NULL,
      workaround TEXT,
      visibility_status TEXT NOT NULL DEFAULT 'draft',
      opened_at TEXT NOT NULL,
      last_updated_at TEXT NOT NULL,
      published_at TEXT,
      published_by INTEGER,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER,
      action TEXT NOT NULL,
      method TEXT,
      path TEXT,
      status_code INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      affected_type TEXT,
      affected_id INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS admin_widget_layouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NOT NULL UNIQUE,
      layout_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS operations_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      error_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      message TEXT NOT NULL,
      source TEXT,
      related_type TEXT,
      related_id INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by INTEGER,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      success INTEGER NOT NULL DEFAULT 1,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS email_verification_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_type TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS backup_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL,
      storage_path TEXT,
      metadata_json TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL
    )
  `);

  await migrateBackupRunsTable();

  await run(`
    CREATE TABLE IF NOT EXISTS activity_presence (
      visitor_key TEXT PRIMARY KEY,
      user_id INTEGER,
      role_category TEXT NOT NULL DEFAULT 'guest',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS activity_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_date TEXT NOT NULL,
      visitor_key TEXT NOT NULL,
      user_id INTEGER,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      heartbeat_count INTEGER NOT NULL DEFAULT 1,
      UNIQUE(local_date, visitor_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_engagement (
      user_id INTEGER PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_qualifying_date TEXT,
      total_qualifying_days INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS review_task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      worker_user_id INTEGER,
      event_type TEXT NOT NULL,
      reason TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES price_import_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (worker_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS worker_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'clocked_in',
      clocked_in_at TEXT NOT NULL,
      break_started_at TEXT,
      total_break_seconds INTEGER NOT NULL DEFAULT 0,
      clocked_out_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS worker_time_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      changed_by INTEGER NOT NULL,
      old_values_json TEXT NOT NULL,
      new_values_json TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (shift_id) REFERENCES worker_shifts(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
    )
  `);

  const now = new Date().toISOString();

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
        maintenance_status,
        published_at,
        created_at,
        updated_at
      )
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `,
    [
      "online",
      "Early Access 0.2.0",
      "Adding and verifying Janesville grocery prices.",
      "Grocery Radar is live, but the radar is still filling up. We are actively adding and verifying grocery prices from Janesville stores using receipts, shelf tags, weekly ads, and community submissions. Some products or categories may temporarily appear empty while prices are being reviewed, updated, or imported.",
      "Help fill the Janesville radar.",
      "One receipt, shelf tag, weekly ad, or store link can help shoppers across Janesville compare prices with better confidence.",
      "Built in Janesville. Powered by neighbors.",
      "monitoring",
      now,
      now,
      now
    ]
  );

  const currentReleaseDraft = await get("SELECT id, fixed_json, status FROM homepage_patch_notes WHERE version_label = ?", [`v${APP_VERSION}`]);
  if (currentReleaseDraft?.status === "draft") {
    let fixedItems = [];
    try { fixedItems = JSON.parse(currentReleaseDraft.fixed_json || "[]"); } catch { fixedItems = []; }
    for (const item of [
      "Review actions now keep your place on long proofs.",
      "Manually choosing a store now saves and persists correctly.",
      "Proof review navigation no longer reopens the proof you just left.",
      "AI-not-started, zero-result, active-review, and completed proofs now display distinct states.",
      "Completing or rejecting a proof reliably removes it from the active review queue.",
      "Review actions no longer unexpectedly move the reviewer around the page."
    ]) {
      if (!fixedItems.includes(item)) fixedItems.push(item);
    }
    await run("UPDATE homepage_patch_notes SET fixed_json = ?, updated_at = ? WHERE id = ? AND status = 'draft'", [JSON.stringify(fixedItems), now, currentReleaseDraft.id]);
  }

  await run(
    `
      INSERT INTO homepage_patch_notes (
        version_label, title, summary, added_json, changed_json, fixed_json,
        known_issues_json, next_focus_json, release_date, internal_commit_hash,
        status, published_at, created_at, updated_at
      )
      SELECT ?, 'Faster Reviews + Product Photos',
        'Receipt review is faster and product photos are easier to manage.',
        ?, ?, ?, ?, '[]', NULL, '', 'draft', NULL, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM homepage_patch_notes WHERE version_label = ?)
    `,
    [
      `v${APP_VERSION}`,
      JSON.stringify([
        "Product photos can now be managed directly from Grocery Radar.",
        "Products missing photos are easier for admins to find."
      ]),
      JSON.stringify([
        "Receipt review stays in place while approving and rejecting items.",
        "Completed items disappear from the active review automatically.",
        "Product cards handle missing images more cleanly."
      ]),
      JSON.stringify([
        "Rejected items no longer remain in the active review list.",
        "Rejected proofs leave the review queue correctly.",
        "Approving items no longer jumps reviewers back to the top of the page.",
        "Review actions now keep your place on long proofs.",
        "Manually choosing a store now saves and persists correctly.",
        "Proof review navigation no longer reopens the proof you just left.",
        "AI-not-started, zero-result, active-review, and completed proofs now display distinct states.",
        "Completing or rejecting a proof reliably removes it from the active review queue.",
        "Review actions no longer unexpectedly move the reviewer around the page."
      ]),
      JSON.stringify([
        "Some products still need real product photos.",
        "AI may still require human correction on unusual proofs."
      ]),
      now,
      now,
      `v${APP_VERSION}`
    ]
  );

  await run(
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
        status,
        published_at,
        created_at,
        updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM homepage_patch_notes WHERE version_label = ?)
    `,
    [
      "Early Access 0.2.0",
      "Operations Update",
      "Grocery Radar now has stronger review tools for managing proof, approved prices, and public service updates.",
      JSON.stringify(["Community feedback", "Feature voting", "Price Intake Center", "Admin Operations Center"]),
      JSON.stringify(["Stronger Owner and Super Admin controls", "Improved price import review", "Clearer public proof-submission workflow"]),
      JSON.stringify(["Safer duplicate-price handling", "Better production deployment checks", "Cleaner approved-price display"]),
      JSON.stringify(["Initial price database is still being populated", "Email verification is being tested", "Short maintenance periods may occur during updates"]),
      JSON.stringify(["Importing the first large set of verified Janesville prices"]),
      now,
      now,
      now,
      "Early Access 0.2.0"
    ]
  );

  await run(
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
        created_at,
        updated_at
      )
      SELECT ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM homepage_known_issues)
    `,
    [
      "Some categories are still filling up",
      "identified",
      "Several Janesville grocery categories may look empty while receipt, shelf tag, and weekly ad proof is being reviewed.",
      "Try searching a specific item, check again after updates, or submit proof to help fill the radar.",
      now,
      now,
      now,
      now,
      now
    ]
  );

  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_item ON price_reports(item_name)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_store ON price_reports(store_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_category ON price_reports(category)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_product ON price_reports(product_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_verifications_report ON verifications(price_report_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_point_events_user ON point_events(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_point_events_import_batch ON point_events(related_import_batch_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_point_events_import_row ON point_events(related_import_row_id)");
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(lower(username))");
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email)) WHERE email IS NOT NULL");
  await run("CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token)");
  await run("CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_status ON price_reports(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_public_product ON price_reports(product_id, status, proof_type, source_date, submitted_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_reports_public_store ON price_reports(store_id, status, product_id, submitted_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_product_normalization_alias ON product_normalization_rules(normalized_alias, product_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_store_requests_status ON store_requests(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items(product_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time ON analytics_events(event_type, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_analytics_events_product ON analytics_events(product_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_analytics_events_report ON analytics_events(report_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_analytics_events_sponsor ON analytics_events(sponsor_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_sponsors_status ON sponsors(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_missing_price_priorities_item ON missing_price_priorities(item_name, category)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_batches_status ON price_import_batches(status, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_batches_source ON price_import_batches(source_type, status, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_batches_store ON price_import_batches(default_store_id, status, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_batches_claim ON price_import_batches(review_status, review_claim_expires_at, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_batch ON price_import_rows(batch_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_status ON price_import_rows(status, updated_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_store_status ON price_import_rows(store_id, status, updated_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_product_store ON price_import_rows(product_id, store_id, status)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_report ON price_import_rows(price_report_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_duplicate_warning ON price_import_rows(duplicate_warning)");
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_price_import_rows_ai_item ON price_import_rows(ai_analysis_id, ai_item_index) WHERE ai_analysis_id IS NOT NULL");
  await run("CREATE INDEX IF NOT EXISTS idx_ai_proof_jobs_status ON ai_proof_jobs(status, queued_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_ai_proof_attempts_started ON ai_proof_attempts(started_at, attempt_kind, status)");
  await run("CREATE INDEX IF NOT EXISTS idx_product_images_product_status ON product_images(product_id, status, is_primary)");
  await run("CREATE INDEX IF NOT EXISTS idx_catalog_import_rows_batch_status ON catalog_import_rows(batch_id, status)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_admin_read ON notifications(admin_only, is_read, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_type, related_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related_report ON notifications(related_report_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related_import_batch ON notifications(related_import_batch_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related_import_row ON notifications(related_import_row_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status_priority ON feedback_tickets(status, priority, updated_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_feedback_tickets_reporter ON feedback_tickets(reporter_user_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_feedback_tickets_category ON feedback_tickets(category, status, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_feedback_ticket_updates_ticket ON feedback_ticket_updates(ticket_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_feature_votes_option ON feature_votes(option_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_feature_votes_user ON feature_votes(user_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_announcements_status_scope ON announcements(status, scope, starts_at, ends_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_homepage_patch_notes_public ON homepage_patch_notes(status, published_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_user_release_reads_user ON user_release_reads(user_id, read_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_homepage_known_issues_public ON homepage_known_issues(visibility_status, last_updated_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_time ON admin_audit_log(admin_user_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_time ON admin_audit_log(action, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_operations_errors_status_time ON operations_errors(status, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_user_login_events_user_time ON user_login_events(user_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_user_login_events_time ON user_login_events(created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_email_verification_events_user_time ON email_verification_events(user_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_email_verification_events_type_time ON email_verification_events(event_type, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_activity_presence_last_seen ON activity_presence(last_seen_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_activity_daily_date ON activity_daily(local_date, last_seen_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_review_task_events_batch ON review_task_events(batch_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_worker_shifts_user_time ON worker_shifts(user_id, clocked_in_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_worker_shifts_status ON worker_shifts(status, updated_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_user_admin_notes_user ON user_admin_notes(user_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_username_history_user ON username_history(user_id, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)");
  await run("CREATE INDEX IF NOT EXISTS idx_products_canonical_name ON products(canonical_name)");
  await run("CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)");

  for (const store of STORE_SEED) {
    await run(
      `
        INSERT INTO stores (name, address, city, state, store_type, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          store_type = excluded.store_type,
          active = excluded.active
      `,
      [store.name, store.address, store.city, store.state, store.store_type, store.active, new Date().toISOString()]
    );
  }

  for (const option of FEATURE_VOTE_SEED) {
    await run(
      `
        INSERT INTO feature_vote_options (slug, title, description, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          updated_at = excluded.updated_at
      `,
      [option.slug, option.title, option.description, new Date().toISOString(), new Date().toISOString()]
    );
  }

  await refreshAllUserAccuracy();
}

async function getTableColumns(tableName) {
  const columns = await all(`PRAGMA table_info(${tableName})`);
  return columns.map((column) => column.name);
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const columns = await getTableColumns(tableName);

  if (!columns.includes(columnName)) {
    await run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function migrateStoresTable() {
  await addColumnIfMissing("stores", "created_at", "TEXT");
  await run("UPDATE stores SET created_at = COALESCE(NULLIF(created_at, ''), ?) WHERE created_at IS NULL OR created_at = ''", [new Date().toISOString()]);
}

async function migrateUsersTable() {
  await addColumnIfMissing("users", "email", "TEXT");
  await addColumnIfMissing("users", "password_hash", "TEXT");
  await addColumnIfMissing("users", "accuracy_score", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "is_email_verified", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "email_verified_at", "TEXT");
  await addColumnIfMissing("users", "email_verification_token", "TEXT");
  await addColumnIfMissing("users", "email_verification_expires", "TEXT");
  await addColumnIfMissing("users", "verification_email_last_sent_at", "TEXT");
  await addColumnIfMissing("users", "verification_email_send_count", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "is_super_admin", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "staff_role", "TEXT NOT NULL DEFAULT 'user'");
  await addColumnIfMissing("users", "work_preferences_json", "TEXT NOT NULL DEFAULT '{}'");
  await addColumnIfMissing("users", "account_status", "TEXT NOT NULL DEFAULT 'active'");
  await addColumnIfMissing("users", "ban_reason", "TEXT");
  await addColumnIfMissing("users", "ban_note", "TEXT");
  await addColumnIfMissing("users", "banned_at", "TEXT");
  await addColumnIfMissing("users", "banned_by", "INTEGER");
  await addColumnIfMissing("users", "hide_from_leaderboard", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "force_username_change", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("users", "username_status", "TEXT NOT NULL DEFAULT 'approved'");
  await addColumnIfMissing("users", "username_moderation_note", "TEXT");
  await addColumnIfMissing("users", "admin_note", "TEXT");
  await addColumnIfMissing("users", "avoid_ingredients", "TEXT");
  await addColumnIfMissing("users", "last_activity_at", "TEXT");
  await addColumnIfMissing("users", "last_seen_at", "TEXT");
}

async function migratePriceReportsTable() {
  await addColumnIfMissing("price_reports", "product_id", "INTEGER");
  await addColumnIfMissing("price_reports", "photo_path", "TEXT");
  await addColumnIfMissing("price_reports", "photo_original_name", "TEXT");
  await addColumnIfMissing("price_reports", "photo_mime_type", "TEXT");
  await addColumnIfMissing("price_reports", "photo_size_bytes", "INTEGER");
  await addColumnIfMissing("price_reports", "admin_rejection_reason", "TEXT");
  await addColumnIfMissing("price_reports", "admin_rejection_note", "TEXT");
  await addColumnIfMissing("price_reports", "reviewed_at", "TEXT");
  await addColumnIfMissing("price_reports", "reviewed_by", "INTEGER");
  await addColumnIfMissing("price_reports", "edited_by", "INTEGER");
  await addColumnIfMissing("price_reports", "edited_at", "TEXT");
  await addColumnIfMissing("price_reports", "admin_edit_note", "TEXT");
  await addColumnIfMissing("price_reports", "last_edited_by", "INTEGER");
  await addColumnIfMissing("price_reports", "last_edited_at", "TEXT");
  await addColumnIfMissing("price_reports", "edit_note", "TEXT");
  await addColumnIfMissing("price_reports", "official_product_url", "TEXT");
  await addColumnIfMissing("price_reports", "source_url", "TEXT");
  await addColumnIfMissing("price_reports", "source_title", "TEXT");
  await addColumnIfMissing("price_reports", "source_domain", "TEXT");
  await addColumnIfMissing("price_reports", "source_checked_at", "TEXT");
  await addColumnIfMissing("price_reports", "ingredient_info_url", "TEXT");
  await addColumnIfMissing("price_reports", "allergen_note", "TEXT");
  await addColumnIfMissing("price_reports", "admin_safety_note", "TEXT");
  await addColumnIfMissing("price_reports", "submitted_by_user_id", "INTEGER");
  await addColumnIfMissing("price_reports", "source_import_batch_id", "INTEGER");
  await addColumnIfMissing("price_reports", "source_import_row_id", "INTEGER");
  await addColumnIfMissing("price_reports", "source_date", "TEXT");
  await addColumnIfMissing("price_reports", "storage_condition", "TEXT");
  await addColumnIfMissing("price_reports", "price_type", "TEXT");
  await addColumnIfMissing("price_reports", "review_started_at", "TEXT");
  await addColumnIfMissing("price_reports", "review_completed_at", "TEXT");
  await addColumnIfMissing("price_reports", "freshness_status", "TEXT NOT NULL DEFAULT 'current'");
  await addColumnIfMissing("price_reports", "price_basis", "TEXT");
  await addColumnIfMissing("price_reports", "comparison_price", "REAL");
  await addColumnIfMissing("price_reports", "comparison_unit", "TEXT");
  await addColumnIfMissing("price_reports", "estimated_item_price", "REAL");
  await addColumnIfMissing("price_reports", "approximate_item_weight", "REAL");
  await addColumnIfMissing("price_reports", "approximate_item_weight_unit", "TEXT");
  await addColumnIfMissing("price_reports", "package_price", "REAL");
  await addColumnIfMissing("price_reports", "multibuy_quantity", "REAL");
  await addColumnIfMissing("price_reports", "multibuy_total_price", "REAL");
  await run("UPDATE price_reports SET submitted_by_user_id = COALESCE(submitted_by_user_id, user_id) WHERE submitted_by_user_id IS NULL");
}

async function migratePointEventsTable() {
  await addColumnIfMissing("point_events", "reason", "TEXT");
  await addColumnIfMissing("point_events", "related_import_batch_id", "INTEGER");
  await addColumnIfMissing("point_events", "related_import_row_id", "INTEGER");
  await addColumnIfMissing("point_events", "created_by_admin_id", "INTEGER");
  await addColumnIfMissing("point_events", "admin_note", "TEXT");
  await run("UPDATE point_events SET reason = COALESCE(NULLIF(reason, ''), action) WHERE reason IS NULL OR reason = ''");
}

async function migrateNotificationsTable() {
  await addColumnIfMissing("notifications", "related_report_id", "INTEGER");
  await addColumnIfMissing("notifications", "related_import_batch_id", "INTEGER");
  await addColumnIfMissing("notifications", "related_import_row_id", "INTEGER");
  await addColumnIfMissing("notifications", "points_awarded", "INTEGER");
}

async function migrateBackupRunsTable() {
  await addColumnIfMissing("backup_runs", "created_by", "INTEGER");
}

async function migrateProductsTable() {
  await addColumnIfMissing("products", "variant", "TEXT");
  await addColumnIfMissing("products", "upc", "TEXT");
  await addColumnIfMissing("products", "description", "TEXT");
  await addColumnIfMissing("products", "default_size_text", "TEXT");
  await addColumnIfMissing("products", "default_quantity", "REAL");
  await addColumnIfMissing("products", "default_unit", "TEXT");
  await addColumnIfMissing("products", "default_storage_condition", "TEXT");
  await addColumnIfMissing("products", "brand_optional", "INTEGER NOT NULL DEFAULT 1");
  await addColumnIfMissing("products", "preferred_brand", "TEXT");
  await addColumnIfMissing("products", "common_aliases", "TEXT");
  await addColumnIfMissing("products", "ingredient_info_url", "TEXT");
  await addColumnIfMissing("products", "allergen_note", "TEXT");
  await addColumnIfMissing("products", "admin_safety_note", "TEXT");
  await addColumnIfMissing("products", "status", "TEXT NOT NULL DEFAULT 'needs_review'");
  await addColumnIfMissing("products", "created_by_user_id", "INTEGER");
  await addColumnIfMissing("products", "created_by_admin_id", "INTEGER");
  await addColumnIfMissing("products", "merged_into_product_id", "INTEGER");
  await addColumnIfMissing("products", "admin_note", "TEXT");
  await addColumnIfMissing("products", "updated_by", "INTEGER");
  await addColumnIfMissing("products", "created_at", "TEXT");
  await addColumnIfMissing("products", "updated_at", "TEXT");
  await run(
    "UPDATE products SET created_at = COALESCE(NULLIF(created_at, ''), ?), updated_at = COALESCE(NULLIF(updated_at, ''), ?) WHERE created_at IS NULL OR created_at = '' OR updated_at IS NULL OR updated_at = ''",
    [new Date().toISOString(), new Date().toISOString()]
  );
}

async function migrateCartItemsTable() {
  await addColumnIfMissing("cart_items", "product_id", "INTEGER");
  await addColumnIfMissing("cart_items", "brand_mode", "TEXT NOT NULL DEFAULT 'any'");
  await addColumnIfMissing("cart_items", "size_preference", "TEXT");
  await addColumnIfMissing("cart_items", "must_have", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("cart_items", "optional_item", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("cart_items", "updated_at", "TEXT");
  await run("UPDATE cart_items SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at) WHERE updated_at IS NULL OR updated_at = ''");
}

async function migrateAnalyticsEventsTable() {
  await addColumnIfMissing("analytics_events", "sponsor_id", "INTEGER");
}

async function migrateSponsorsTable() {
  await addColumnIfMissing("sponsors", "image_url", "TEXT");
  await addColumnIfMissing("sponsors", "weekly_price_note", "TEXT");
  await addColumnIfMissing("sponsors", "admin_note", "TEXT");
  await addColumnIfMissing("sponsors", "updated_at", "TEXT");
  await run("UPDATE sponsors SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?) WHERE updated_at IS NULL OR updated_at = ''", [new Date().toISOString()]);
}

async function migratePriceImportBatchesTable() {
  await addColumnIfMissing("price_import_batches", "source_type", "TEXT NOT NULL DEFAULT 'weekly_ad'");
  await addColumnIfMissing("price_import_batches", "proof_type", "TEXT NOT NULL DEFAULT 'weekly_ad'");
  await addColumnIfMissing("price_import_batches", "photo_original_name", "TEXT");
  await addColumnIfMissing("price_import_batches", "photo_mime_type", "TEXT");
  await addColumnIfMissing("price_import_batches", "photo_size_bytes", "INTEGER");
  await addColumnIfMissing("price_import_batches", "status", "TEXT NOT NULL DEFAULT 'import_draft'");
  await addColumnIfMissing("price_import_batches", "source_url", "TEXT");
  await addColumnIfMissing("price_import_batches", "source_title", "TEXT");
  await addColumnIfMissing("price_import_batches", "source_domain", "TEXT");
  await addColumnIfMissing("price_import_batches", "source_checked_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "default_store_id", "INTEGER");
  await addColumnIfMissing("price_import_batches", "batch_title", "TEXT");
  await addColumnIfMissing("price_import_batches", "observed_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "valid_start_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "valid_end_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "source_text", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_store_name", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_store_address", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_purchase_date", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_purchase_time", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_total", "REAL");
  await addColumnIfMissing("price_import_batches", "receipt_transaction_id", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_ocr_text", "TEXT");
  await addColumnIfMissing("price_import_batches", "receipt_ocr_confidence", "TEXT");
  await addColumnIfMissing("price_import_batches", "notes", "TEXT");
  await addColumnIfMissing("price_import_batches", "created_by", "INTEGER");
  await addColumnIfMissing("price_import_batches", "proof_file_hash", "TEXT");
  await addColumnIfMissing("price_import_batches", "duplicate_of_batch_id", "INTEGER");
  await addColumnIfMissing("price_import_batches", "duplicate_scope", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_priority", "TEXT");
  await addColumnIfMissing("price_import_batches", "proof_quality_flags", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_claimed_by", "INTEGER");
  await addColumnIfMissing("price_import_batches", "review_claimed_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_claim_expires_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_escalated_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_escalation_reason", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_status", "TEXT NOT NULL DEFAULT 'waiting'");
  await addColumnIfMissing("price_import_batches", "review_completed_at", "TEXT");
  await addColumnIfMissing("price_import_batches", "review_decision", "TEXT");
  await addColumnIfMissing("price_import_batches", "approved_item_count", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_batches", "rejected_item_count", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_batches", "escalated_item_count", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_batches", "updated_at", "TEXT");
  await run("UPDATE price_import_batches SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?) WHERE updated_at IS NULL OR updated_at = ''", [new Date().toISOString()]);
}

async function migratePriceImportRowsTable() {
  await addColumnIfMissing("price_import_rows", "price_report_id", "INTEGER");
  await addColumnIfMissing("price_import_rows", "product_id", "INTEGER");
  await addColumnIfMissing("price_import_rows", "store_id", "INTEGER");
  await addColumnIfMissing("price_import_rows", "variant", "TEXT");
  await addColumnIfMissing("price_import_rows", "regular_price", "REAL");
  await addColumnIfMissing("price_import_rows", "sale_price", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_rows", "member_card_price", "REAL");
  await addColumnIfMissing("price_import_rows", "coupon_required", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_rows", "deal_limit", "TEXT");
  await addColumnIfMissing("price_import_rows", "multibuy_details", "TEXT");
  await addColumnIfMissing("price_import_rows", "multibuy_quantity", "REAL");
  await addColumnIfMissing("price_import_rows", "multibuy_total_price", "REAL");
  await addColumnIfMissing("price_import_rows", "price_basis", "TEXT");
  await addColumnIfMissing("price_import_rows", "comparison_price", "REAL");
  await addColumnIfMissing("price_import_rows", "comparison_unit", "TEXT");
  await addColumnIfMissing("price_import_rows", "estimated_item_price", "REAL");
  await addColumnIfMissing("price_import_rows", "approximate_item_weight", "REAL");
  await addColumnIfMissing("price_import_rows", "approximate_item_weight_unit", "TEXT");
  await addColumnIfMissing("price_import_rows", "package_price", "REAL");
  await addColumnIfMissing("price_import_rows", "storage_condition", "TEXT");
  await addColumnIfMissing("price_import_rows", "price_type", "TEXT");
  await addColumnIfMissing("price_import_rows", "source_date", "TEXT");
  await addColumnIfMissing("price_import_rows", "promotion_text", "TEXT");
  await addColumnIfMissing("price_import_rows", "observed_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "valid_start_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "valid_end_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "source_url", "TEXT");
  await addColumnIfMissing("price_import_rows", "source_title", "TEXT");
  await addColumnIfMissing("price_import_rows", "source_domain", "TEXT");
  await addColumnIfMissing("price_import_rows", "source_checked_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "raw_receipt_line", "TEXT");
  await addColumnIfMissing("price_import_rows", "extracted_item_name", "TEXT");
  await addColumnIfMissing("price_import_rows", "extracted_price", "REAL");
  await addColumnIfMissing("price_import_rows", "extracted_quantity", "REAL");
  await addColumnIfMissing("price_import_rows", "extracted_weight", "REAL");
  await addColumnIfMissing("price_import_rows", "extracted_unit", "TEXT");
  await addColumnIfMissing("price_import_rows", "extraction_confidence", "TEXT NOT NULL DEFAULT 'low'");
  await addColumnIfMissing("price_import_rows", "extraction_notes", "TEXT");
  await addColumnIfMissing("price_import_rows", "duplicate_warning", "TEXT");
  await addColumnIfMissing("price_import_rows", "admin_rejection_note", "TEXT");
  await addColumnIfMissing("price_import_rows", "rejection_reason", "TEXT");
  await addColumnIfMissing("price_import_rows", "created_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "updated_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "updated_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "approved_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "approved_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "rejected_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "rejected_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "ai_analysis_id", "INTEGER");
  await addColumnIfMissing("price_import_rows", "ai_item_index", "INTEGER");
  await addColumnIfMissing("price_import_rows", "ai_confidence", "TEXT");
  await addColumnIfMissing("price_import_rows", "ai_field_confidences_json", "TEXT");
  await addColumnIfMissing("price_import_rows", "ai_warnings_json", "TEXT");
  await addColumnIfMissing("price_import_rows", "research_notes", "TEXT");
  await addColumnIfMissing("price_import_rows", "research_sources_json", "TEXT");
  await addColumnIfMissing("price_import_rows", "suggested_new_product", "INTEGER NOT NULL DEFAULT 0");
  await run("UPDATE price_import_rows SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?) WHERE updated_at IS NULL OR updated_at = ''", [new Date().toISOString()]);
}

async function migrateAiProcessingSettingsTable() {
  await addColumnIfMissing("ai_processing_settings", "primary_model", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("ai_processing_settings", "fallback_model", "TEXT NOT NULL DEFAULT ''");
  await run("UPDATE ai_processing_settings SET primary_model = COALESCE(NULLIF(primary_model, ''), model, '') WHERE primary_model IS NULL OR primary_model = ''");
}

async function migrateAiProofJobsTable() {
  await addColumnIfMissing("ai_proof_jobs", "manual_requested", "INTEGER NOT NULL DEFAULT 0");
}

async function migrateHomepagePatchNotesTable() {
  await addColumnIfMissing("homepage_patch_notes", "release_date", "TEXT");
  await addColumnIfMissing("homepage_patch_notes", "internal_commit_hash", "TEXT");
}

async function updateUserAccuracy(userId) {
  const stats = await get(
    `
      SELECT
        COUNT(*) AS submissions,
        SUM(CASE WHEN status = 'disputed' OR status = 'rejected' THEN 1 ELSE 0 END) AS disputed_submissions
      FROM price_reports
      WHERE user_id = ?
    `,
    [userId]
  );
  const submissions = stats.submissions || 0;
  const disputed = stats.disputed_submissions || 0;
  const accuracyScore = submissions
    ? Math.max(0, Math.round(((submissions - disputed) / submissions) * 100))
    : 0;

  await run("UPDATE users SET accuracy_score = ? WHERE id = ?", [accuracyScore, userId]);
  return accuracyScore;
}

async function refreshAllUserAccuracy() {
  const users = await all("SELECT id FROM users");

  for (const user of users) {
    await updateUserAccuracy(user.id);
  }
}

async function addPointEvent(userId, action, points, priceReportId = null, options = {}) {
  const eventPoints = Number.parseInt(points, 10) || 0;

  if (!userId || !eventPoints) {
    return null;
  }

  const reason = String(options.reason || action || "").trim().slice(0, 300);
  const relatedImportBatchId = Number.parseInt(options.related_import_batch_id ?? options.relatedImportBatchId, 10);
  const relatedImportRowId = Number.parseInt(options.related_import_row_id ?? options.relatedImportRowId, 10);
  const createdByAdminId = Number.parseInt(options.created_by_admin_id ?? options.createdByAdminId, 10);
  const adminNote = String(options.admin_note || options.adminNote || "").trim().slice(0, 500);
  const createdAt = options.created_at || options.createdAt || new Date().toISOString();

  await run(
    `
      INSERT INTO point_events (
        user_id,
        action,
        points,
        reason,
        price_report_id,
        related_import_batch_id,
        related_import_row_id,
        created_by_admin_id,
        admin_note,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      action,
      eventPoints,
      reason || action,
      priceReportId,
      Number.isInteger(relatedImportBatchId) && relatedImportBatchId > 0 ? relatedImportBatchId : null,
      Number.isInteger(relatedImportRowId) && relatedImportRowId > 0 ? relatedImportRowId : null,
      Number.isInteger(createdByAdminId) && createdByAdminId > 0 ? createdByAdminId : null,
      adminNote,
      createdAt
    ]
  );

  await run("UPDATE users SET points = points + ? WHERE id = ?", [eventPoints, userId]);
  return eventPoints;
}

async function refreshExpiredReports() {
  await run(
    `
      UPDATE price_reports
      SET status = 'expired', confidence = 'expired'
      WHERE expires_at <= ?
        AND status IN ('pending', 'approved')
    `,
    [new Date().toISOString()]
  );
}

module.exports = {
  db,
  DATA_DIR,
  DB_PATH,
  DATA_DIR_EXISTED_AT_START,
  DB_FILE_EXISTED_AT_START,
  STORE_SEED,
  run,
  get,
  all,
  initDb,
  addPointEvent,
  updateUserAccuracy,
  refreshAllUserAccuracy,
  refreshExpiredReports
};
