const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "grocery_radar.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

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
      email_verification_token TEXT,
      email_verification_expires TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
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
      category TEXT NOT NULL DEFAULT 'other',
      price REAL,
      regular_price REAL,
      sale_price INTEGER NOT NULL DEFAULT 0,
      coupon_required INTEGER NOT NULL DEFAULT 0,
      deal_limit TEXT,
      size_text TEXT,
      quantity REAL,
      unit TEXT,
      proof_type TEXT NOT NULL DEFAULT 'weekly_ad',
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
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'import_draft',
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
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_batch ON price_import_rows(batch_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_status ON price_import_rows(status, updated_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_price_import_rows_report ON price_import_rows(price_report_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_admin_read ON notifications(admin_only, is_read, created_at)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related ON notifications(related_type, related_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related_report ON notifications(related_report_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related_import_batch ON notifications(related_import_batch_id)");
  await run("CREATE INDEX IF NOT EXISTS idx_notifications_related_import_row ON notifications(related_import_row_id)");
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
  await addColumnIfMissing("users", "email_verification_token", "TEXT");
  await addColumnIfMissing("users", "email_verification_expires", "TEXT");
  await addColumnIfMissing("users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
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

async function migrateProductsTable() {
  await addColumnIfMissing("products", "default_size_text", "TEXT");
  await addColumnIfMissing("products", "default_quantity", "REAL");
  await addColumnIfMissing("products", "default_unit", "TEXT");
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
  await addColumnIfMissing("price_import_batches", "updated_at", "TEXT");
  await run("UPDATE price_import_batches SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?) WHERE updated_at IS NULL OR updated_at = ''", [new Date().toISOString()]);
}

async function migratePriceImportRowsTable() {
  await addColumnIfMissing("price_import_rows", "price_report_id", "INTEGER");
  await addColumnIfMissing("price_import_rows", "product_id", "INTEGER");
  await addColumnIfMissing("price_import_rows", "regular_price", "REAL");
  await addColumnIfMissing("price_import_rows", "sale_price", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_rows", "coupon_required", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("price_import_rows", "deal_limit", "TEXT");
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
  await addColumnIfMissing("price_import_rows", "admin_rejection_note", "TEXT");
  await addColumnIfMissing("price_import_rows", "created_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "updated_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "updated_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "approved_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "approved_at", "TEXT");
  await addColumnIfMissing("price_import_rows", "rejected_by", "INTEGER");
  await addColumnIfMissing("price_import_rows", "rejected_at", "TEXT");
  await run("UPDATE price_import_rows SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, ?) WHERE updated_at IS NULL OR updated_at = ''", [new Date().toISOString()]);
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
  DB_PATH,
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
