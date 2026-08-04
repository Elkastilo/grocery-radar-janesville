"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const ROOT_DIR = path.join(__dirname, "..");
const OWNER_EMAIL = "juricbu@gmail.com";
const OWNER_USERNAME = "elcastilo";

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function dbPath(dataDir) {
  return path.join(dataDir, "grocery_radar.sqlite");
}

function openDb(dataDir) {
  return new sqlite3.Database(dbPath(dataDir));
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

async function createUsersTable(database) {
  await dbRun(database, `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT,
      points INTEGER NOT NULL DEFAULT 0,
      is_email_verified INTEGER NOT NULL DEFAULT 0,
      email_verified_at TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      account_status TEXT NOT NULL DEFAULT 'active',
      admin_note TEXT,
      last_activity_at TEXT,
      last_seen_at TEXT,
      created_at TEXT NOT NULL
    )
  `);
}

async function createActivityTables(database) {
  await dbRun(database, `
    CREATE TABLE price_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
    )
  `);
  await dbRun(database, `
    CREATE TABLE price_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by INTEGER,
      status TEXT NOT NULL DEFAULT 'needs_admin_review'
    )
  `);
  await dbRun(database, `
    CREATE TABLE point_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      points INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function seedUsers(dataDir, rows = []) {
  const database = openDb(dataDir);
  try {
    await createUsersTable(database);
    await createActivityTables(database);

    for (const row of rows) {
      const result = await dbRun(
        database,
        `
          INSERT INTO users (
            username,
            email,
            password_hash,
            points,
            is_email_verified,
            email_verified_at,
            is_admin,
            is_super_admin,
            account_status,
            last_activity_at,
            last_seen_at,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          row.username,
          row.email,
          row.password_hash || "test-password-hash-not-secret",
          row.points || 0,
          row.is_email_verified ? 1 : 0,
          row.is_email_verified ? new Date().toISOString() : null,
          row.is_admin ? 1 : 0,
          row.is_super_admin ? 1 : 0,
          row.account_status || "active",
          row.last_activity_at || null,
          row.last_seen_at || null,
          row.created_at || new Date().toISOString()
        ]
      );

      if (row.price_reports) {
        for (const status of row.price_reports) {
          await dbRun(database, "INSERT INTO price_reports (user_id, status) VALUES (?, ?)", [result.lastID, status]);
        }
      }

      if (row.proof_batches) {
        for (let index = 0; index < row.proof_batches; index += 1) {
          await dbRun(database, "INSERT INTO price_import_batches (created_by) VALUES (?)", [result.lastID]);
        }
      }

      if (row.point_events) {
        for (let index = 0; index < row.point_events; index += 1) {
          await dbRun(database, "INSERT INTO point_events (user_id, points) VALUES (?, 1)", [result.lastID]);
        }
      }
    }
  } finally {
    await closeDb(database);
  }
}

function runRepair(dataDir, args = ["--apply"]) {
  const result = childProcess.spawnSync(
    process.execPath,
    ["scripts/repair-owner-identity.js", ...args],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        DATA_DIR: dataDir
      },
      encoding: "utf8"
    }
  );

  const outputText = result.stdout || result.stderr;
  const output = JSON.parse(outputText);
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes("test-password-hash"), false);
  assert.equal(serialized.includes(OWNER_EMAIL), false);
  return { result, output };
}

async function allUsers(dataDir) {
  const database = openDb(dataDir);
  try {
    return await dbAll(database, "SELECT id, username, email, is_admin, is_super_admin, admin_note FROM users ORDER BY id");
  } finally {
    await closeDb(database);
  }
}

async function auditCounts(dataDir) {
  const database = openDb(dataDir);
  try {
    const audit = await dbGet(database, "SELECT COUNT(*) AS count FROM admin_audit_log");
    const notes = await dbGet(database, "SELECT COUNT(*) AS count FROM user_admin_notes");
    return {
      audit: audit.count,
      notes: notes.count
    };
  } finally {
    await closeDb(database);
  }
}

async function testCaseA() {
  const dataDir = tempDir("grocery-owner-repair-a-");
  await seedUsers(dataDir, [
    {
      username: "oldowner",
      email: OWNER_EMAIL.toUpperCase(),
      is_admin: false,
      is_super_admin: false,
      price_reports: ["approved", "rejected"],
      proof_batches: 2,
      point_events: 1,
      created_at: "2026-07-01T00:00:00.000Z"
    },
    {
      username: "legacyadmin",
      email: "legacy-admin@example.invalid",
      is_admin: true,
      is_super_admin: true
    }
  ]);

  const first = runRepair(dataDir);
  assert.equal(first.result.status, 0, first.result.stderr);
  assert.equal(first.output.conflict_category, "case_a_email_match_username_available");
  assert.equal(first.output.preserved_account.id, 1);
  assert.equal(first.output.changes.username_changed, true);
  assert.equal(first.output.changes.email_changed, false);
  assert.deepEqual(first.output.changes.demoted_super_admin_ids, [2]);
  assert.equal(first.output.preserved_account.activity_counts.price_reports, 2);
  assert.equal(first.output.audit.admin_audit_log_id, 1);

  const rows = await allUsers(dataDir);
  assert.equal(rows[0].username, OWNER_USERNAME);
  assert.equal(rows[0].email, OWNER_EMAIL.toUpperCase());
  assert.equal(rows[0].is_admin, 1);
  assert.equal(rows[0].is_super_admin, 1);
  assert.equal(rows[1].is_admin, 1);
  assert.equal(rows[1].is_super_admin, 0);

  const second = runRepair(dataDir);
  assert.equal(second.result.status, 0, second.result.stderr);
  assert.equal(second.output.conflict_category, "already_repaired");
  assert.equal(second.output.applied, false);
  assert.deepEqual(await auditCounts(dataDir), { audit: 1, notes: 1 });
}

async function testCaseB() {
  const dataDir = tempDir("grocery-owner-repair-b-");
  await seedUsers(dataDir, [
    {
      username: OWNER_USERNAME.toUpperCase(),
      email: "wrong-owner-email@example.invalid",
      is_admin: false,
      is_super_admin: false
    }
  ]);

  const first = runRepair(dataDir);
  assert.equal(first.result.status, 0, first.result.stderr);
  assert.equal(first.output.conflict_category, "case_b_username_match_email_available");
  assert.equal(first.output.preserved_account.id, 1);
  assert.equal(first.output.changes.username_changed, false);
  assert.equal(first.output.changes.email_changed, true);

  const rows = await allUsers(dataDir);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, OWNER_USERNAME.toUpperCase());
  assert.equal(rows[0].email, OWNER_EMAIL);
  assert.equal(rows[0].is_admin, 1);
  assert.equal(rows[0].is_super_admin, 1);
}

async function testCaseC() {
  const dataDir = tempDir("grocery-owner-repair-c-");
  await seedUsers(dataDir, [
    {
      username: "emailholder",
      email: OWNER_EMAIL,
      is_admin: false,
      is_super_admin: false,
      price_reports: ["approved"],
      created_at: "2026-06-01T00:00:00.000Z"
    },
    {
      username: OWNER_USERNAME,
      email: "username-holder@example.invalid",
      is_admin: false,
      is_super_admin: false,
      proof_batches: 1,
      created_at: "2026-06-02T00:00:00.000Z"
    }
  ]);

  const first = runRepair(dataDir);
  assert.equal(first.result.status, 2);
  assert.equal(first.output.conflict_category, "case_c_split_owner_identity");
  assert.equal(first.output.safe_accounts.owner_email_matches[0].id, 1);
  assert.equal(first.output.safe_accounts.owner_username_matches[0].id, 2);
  assert.equal(first.output.safe_accounts.owner_email_matches[0].created_at, "2026-06-01T00:00:00.000Z");
  assert.equal(first.output.safe_accounts.owner_username_matches[0].created_at, "2026-06-02T00:00:00.000Z");
  assert.equal(first.output.safe_accounts.owner_email_matches[0].activity_counts.approved_price_reports, 1);
  assert.equal(first.output.safe_accounts.owner_username_matches[0].activity_counts.proof_batches, 1);

  const rows = await allUsers(dataDir);
  assert.equal(rows[0].username, "emailholder");
  assert.equal(rows[0].is_super_admin, 0);
  assert.equal(rows[1].email, "username-holder@example.invalid");
  assert.equal(rows[1].is_super_admin, 0);
}

async function testCaseD() {
  const dataDir = tempDir("grocery-owner-repair-d-");
  await seedUsers(dataDir, [
    {
      username: "regularuser",
      email: "regular@example.invalid",
      is_admin: false,
      is_super_admin: false
    }
  ]);

  const first = runRepair(dataDir);
  assert.equal(first.result.status, 2);
  assert.equal(first.output.conflict_category, "case_d_owner_identity_missing");
  assert.equal(first.output.match_summary.owner_email_match_count, 0);
  assert.equal(first.output.match_summary.owner_username_match_count, 0);

  const rows = await allUsers(dataDir);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].username, "regularuser");
  assert.equal(rows[0].is_super_admin, 0);
}

async function main() {
  await testCaseA();
  await testCaseB();
  await testCaseC();
  await testCaseD();
  console.log("Owner identity repair tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
