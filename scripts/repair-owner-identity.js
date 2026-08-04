#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const OWNER_EMAIL = "juricbu@gmail.com";
const OWNER_USERNAME = "elcastilo";
const SCRIPT_NAME = "scripts/repair-owner-identity.js";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(DATA_DIR, "grocery_radar.sqlite");

const APPLY = process.argv.includes("--apply");

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

function dbGet(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function dbAll(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function dbRun(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function closeDb(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeInteger(value) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) ? number : 0;
}

async function tableExists(database, tableName) {
  const row = await dbGet(
    database,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName]
  );
  return Boolean(row);
}

async function tableColumns(database, tableName) {
  if (!(await tableExists(database, tableName))) {
    return [];
  }

  const rows = await dbAll(database, `PRAGMA table_info(${tableName})`);
  return rows.map((row) => row.name);
}

async function addColumnIfMissing(database, tableName, columnName, definition) {
  const columns = await tableColumns(database, tableName);

  if (!columns.includes(columnName)) {
    await dbRun(database, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureRepairSchema(database) {
  if (!(await tableExists(database, "users"))) {
    return { ok: false, reason: "users_table_missing" };
  }

  const userColumns = await tableColumns(database, "users");
  const missingRequired = ["id", "username", "email"].filter((column) => !userColumns.includes(column));

  if (missingRequired.length) {
    return { ok: false, reason: "users_schema_missing_required_columns", missing_columns: missingRequired };
  }

  await addColumnIfMissing(database, "users", "is_admin", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(database, "users", "is_super_admin", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing(database, "users", "admin_note", "TEXT");

  await dbRun(database, `
    CREATE TABLE IF NOT EXISTS user_admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      admin_user_id INTEGER,
      note_type TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await dbRun(database, `
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
      created_at TEXT NOT NULL
    )
  `);

  return { ok: true };
}

async function safeCount(database, tableName, columnName, userId, extraWhere = "") {
  if (!(await tableExists(database, tableName))) {
    return 0;
  }

  const columns = await tableColumns(database, tableName);
  if (!columns.includes(columnName)) {
    return 0;
  }

  const row = await dbGet(
    database,
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${columnName} = ? ${extraWhere}`,
    [userId]
  );
  return safeInteger(row?.count);
}

async function activityCounts(database, userId) {
  return {
    price_reports: await safeCount(database, "price_reports", "user_id", userId),
    approved_price_reports: await safeCount(database, "price_reports", "user_id", userId, "AND status = 'approved'"),
    rejected_price_reports: await safeCount(database, "price_reports", "user_id", userId, "AND status = 'rejected'"),
    proof_batches: await safeCount(database, "price_import_batches", "created_by", userId),
    point_events: await safeCount(database, "point_events", "user_id", userId),
    feedback_tickets: await safeCount(database, "feedback_tickets", "reporter_user_id", userId),
    feature_votes: await safeCount(database, "feature_votes", "user_id", userId),
    login_events: await safeCount(database, "user_login_events", "user_id", userId)
  };
}

async function safeAccount(database, row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username || "",
    created_at: row.created_at || null,
    last_seen_at: row.last_seen_at || null,
    last_activity_at: row.last_activity_at || null,
    account_status: row.account_status || "active",
    is_admin: Boolean(row.is_admin),
    is_super_admin: Boolean(row.is_super_admin),
    is_email_verified: Boolean(row.is_email_verified),
    activity_counts: await activityCounts(database, row.id)
  };
}

async function loadOwnerCandidates(database) {
  const selectSafeUser = `
    SELECT
      id,
      username,
      email,
      created_at,
      last_seen_at,
      last_activity_at,
      account_status,
      is_email_verified,
      is_admin,
      is_super_admin
    FROM users
  `;

  const emailMatches = await dbAll(
    database,
    `${selectSafeUser} WHERE lower(COALESCE(email, '')) = lower(?) ORDER BY id ASC`,
    [OWNER_EMAIL]
  );
  const usernameMatches = await dbAll(
    database,
    `${selectSafeUser} WHERE lower(COALESCE(username, '')) = lower(?) ORDER BY id ASC`,
    [OWNER_USERNAME]
  );
  const exactMatches = emailMatches.filter((emailMatch) =>
    normalize(emailMatch.username) === OWNER_USERNAME
  );
  const superAdmins = await dbAll(
    database,
    `${selectSafeUser} WHERE is_super_admin = 1 ORDER BY id ASC`
  );

  return {
    emailMatches,
    usernameMatches,
    exactMatches,
    superAdmins
  };
}

function classify(candidates) {
  const { emailMatches, usernameMatches, exactMatches } = candidates;

  if (exactMatches.length > 1) return "multiple_exact_owner_matches";
  if (emailMatches.length > 1) return "multiple_owner_email_matches";
  if (usernameMatches.length > 1) return "multiple_owner_username_matches";

  if (exactMatches.length === 1) {
    return "already_exact_owner";
  }

  if (emailMatches.length === 1 && usernameMatches.length === 0) {
    return "case_a_email_match_username_available";
  }

  if (usernameMatches.length === 1 && emailMatches.length === 0) {
    return "case_b_username_match_email_available";
  }

  if (emailMatches.length === 1 && usernameMatches.length === 1 && emailMatches[0].id !== usernameMatches[0].id) {
    return "case_c_split_owner_identity";
  }

  if (emailMatches.length === 0 && usernameMatches.length === 0) {
    return "case_d_owner_identity_missing";
  }

  return "unsupported_owner_identity_conflict";
}

async function insertAuditRows(database, ownerId, category, changes) {
  const now = new Date().toISOString();
  const note = [
    "Owner identity repaired by maintenance script.",
    `Category: ${category}.`,
    "Existing account history was preserved.",
    "No password was reset and no account was created."
  ].join(" ");

  const audit = await dbRun(
    database,
    `
      INSERT INTO admin_audit_log (
        admin_user_id,
        action,
        method,
        path,
        status_code,
        affected_type,
        affected_id,
        metadata_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ownerId,
      "maintenance_owner_identity_repair",
      "SCRIPT",
      SCRIPT_NAME,
      200,
      "user",
      ownerId,
      JSON.stringify({
        category,
        username_changed: Boolean(changes.username_changed),
        email_changed: Boolean(changes.email_changed),
        owner_status_changed: Boolean(changes.owner_status_changed),
        demoted_super_admin_ids: changes.demoted_super_admin_ids || []
      }),
      now
    ]
  );

  const noteInsert = await dbRun(
    database,
    `
      INSERT INTO user_admin_notes (user_id, admin_user_id, note_type, note, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [ownerId, ownerId, "owner_identity_repair", note, now]
  );

  await dbRun(database, "UPDATE users SET admin_note = ? WHERE id = ?", [note, ownerId]);

  return {
    admin_audit_log_id: audit.lastID || null,
    user_admin_note_id: noteInsert.lastID || null
  };
}

async function repair(database, category, candidates) {
  const changes = {
    username_changed: false,
    email_changed: false,
    owner_status_changed: false,
    demoted_super_admin_ids: []
  };

  let owner = null;

  if (category === "already_exact_owner") {
    owner = candidates.exactMatches[0];
  } else if (category === "case_a_email_match_username_available") {
    owner = candidates.emailMatches[0];
    changes.username_changed = normalize(owner.username) !== OWNER_USERNAME;
  } else if (category === "case_b_username_match_email_available") {
    owner = candidates.usernameMatches[0];
    changes.email_changed = normalize(owner.email) !== OWNER_EMAIL;
  } else {
    return null;
  }

  changes.owner_status_changed = !owner.is_admin || !owner.is_super_admin;
  changes.demoted_super_admin_ids = candidates.superAdmins
    .filter((account) => Number(account.id) !== Number(owner.id))
    .map((account) => account.id);

  if (
    APPLY &&
    category === "already_exact_owner" &&
    !changes.username_changed &&
    !changes.email_changed &&
    !changes.owner_status_changed &&
    changes.demoted_super_admin_ids.length === 0
  ) {
    return { owner, changes, audit: null, no_changes: true };
  }

  if (!APPLY) {
    return { owner, changes, audit: null };
  }

  await dbRun(database, "BEGIN IMMEDIATE");

  try {
    if (category === "case_a_email_match_username_available") {
      await dbRun(database, "UPDATE users SET username = ? WHERE id = ?", [OWNER_USERNAME, owner.id]);
    }

    if (category === "case_b_username_match_email_available") {
      await dbRun(database, "UPDATE users SET email = ? WHERE id = ?", [OWNER_EMAIL, owner.id]);
    }

    await dbRun(
      database,
      "UPDATE users SET is_admin = 1, is_super_admin = 1 WHERE id = ?",
      [owner.id]
    );
    await dbRun(
      database,
      "UPDATE users SET is_super_admin = 0 WHERE id != ? AND is_super_admin = 1",
      [owner.id]
    );

    const audit = await insertAuditRows(database, owner.id, category, changes);
    await dbRun(
      database,
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_single_super_admin ON users(is_super_admin) WHERE is_super_admin = 1"
    );
    await dbRun(database, "COMMIT");

    const refreshed = await dbGet(database, "SELECT * FROM users WHERE id = ?", [owner.id]);
    return { owner: refreshed, changes, audit };
  } catch (error) {
    await dbRun(database, "ROLLBACK").catch(() => {});
    throw error;
  }
}

async function buildResult(database, category, candidates, repairResult = null) {
  const outputCategory = repairResult?.no_changes ? "already_repaired" : category;
  const safeEmailMatches = [];
  for (const row of candidates.emailMatches) {
    safeEmailMatches.push(await safeAccount(database, row));
  }

  const safeUsernameMatches = [];
  for (const row of candidates.usernameMatches) {
    safeUsernameMatches.push(await safeAccount(database, row));
  }

  const safeSuperAdmins = [];
  for (const row of candidates.superAdmins) {
    safeSuperAdmins.push(await safeAccount(database, row));
  }

  const finalCandidates = await loadOwnerCandidates(database);

  return {
    ok: ["already_repaired", "already_exact_owner", "case_a_email_match_username_available", "case_b_username_match_email_available"].includes(outputCategory),
    applied: APPLY && Boolean(repairResult) && !repairResult.no_changes,
    dry_run: !APPLY,
    conflict_category: outputCategory,
    database: {
      configured_data_dir: Boolean(process.env.DATA_DIR),
      configured_db_path: Boolean(process.env.DB_PATH)
    },
    match_summary: {
      owner_email_match_count: candidates.emailMatches.length,
      owner_username_match_count: candidates.usernameMatches.length,
      exact_owner_match_count: candidates.exactMatches.length,
      super_admin_count_before: candidates.superAdmins.length,
      exact_owner_match_count_after: finalCandidates.exactMatches.length,
      super_admin_count_after: finalCandidates.superAdmins.length
    },
    safe_accounts: {
      owner_email_matches: safeEmailMatches,
      owner_username_matches: safeUsernameMatches,
      super_admins_before: safeSuperAdmins
    },
    preserved_account: repairResult?.owner ? await safeAccount(database, repairResult.owner) : null,
    changes: repairResult?.changes || {
      username_changed: false,
      email_changed: false,
      owner_status_changed: false,
      demoted_super_admin_ids: []
    },
    audit: repairResult?.audit || null,
    next_action: APPLY
      ? "Restart the service and verify /health after this command succeeds."
      : "Dry run only. Run again with --apply to perform a supported safe repair."
  };
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log(JSON.stringify({
      ok: false,
      applied: false,
      dry_run: !APPLY,
      conflict_category: "case_d_owner_identity_missing",
      database: {
        configured_data_dir: Boolean(process.env.DATA_DIR),
        configured_db_path: Boolean(process.env.DB_PATH),
        database_file_exists: false
      },
      message: "The configured database file does not exist. No Owner account was created."
    }, null, 2));
    process.exitCode = 2;
    return;
  }

  const database = openDb();

  try {
    const schema = await ensureRepairSchema(database);

    if (!schema.ok) {
      console.log(JSON.stringify({
        ok: false,
        applied: false,
        dry_run: !APPLY,
        conflict_category: schema.reason,
        missing_columns: schema.missing_columns || [],
        message: "The users table is not compatible with the owner repair script. No changes were made."
      }, null, 2));
      process.exitCode = 2;
      return;
    }

    const candidates = await loadOwnerCandidates(database);
    const category = classify(candidates);
    const supported = ["already_exact_owner", "case_a_email_match_username_available", "case_b_username_match_email_available"].includes(category);
    const repairResult = supported ? await repair(database, category, candidates) : null;
    const result = await buildResult(database, category, candidates, repairResult);

    console.log(JSON.stringify(result, null, 2));

    if (!supported) {
      process.exitCode = 2;
    }
  } finally {
    await closeDb(database);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    applied: false,
    dry_run: !APPLY,
    conflict_category: "repair_script_error",
    error: error.message
  }, null, 2));
  process.exitCode = 1;
});
