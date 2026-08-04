"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
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

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function createUsersTable(database) {
  await dbRun(database, `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_hash TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_super_admin INTEGER NOT NULL DEFAULT 0,
      is_email_verified INTEGER NOT NULL DEFAULT 1,
      account_status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    )
  `);
}

async function seedUsers(dataDir, users) {
  fs.mkdirSync(dataDir, { recursive: true });
  const database = openDb(dataDir);

  try {
    await createUsersTable(database);
    for (const user of users) {
      await dbRun(
        database,
        `
          INSERT INTO users (
            username,
            email,
            password_hash,
            is_admin,
            is_super_admin,
            is_email_verified,
            account_status,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, 1, 'active', ?)
        `,
        [
          user.username,
          user.email,
          "test-password-hash-not-secret",
          user.is_admin ? 1 : 0,
          user.is_super_admin ? 1 : 0,
          user.created_at || new Date().toISOString()
        ]
      );
    }
  } finally {
    await closeDb(database);
  }
}

async function allUsers(dataDir) {
  const database = openDb(dataDir);
  try {
    return await dbAll(database, "SELECT id, username, email, is_admin, is_super_admin FROM users ORDER BY id ASC");
  } finally {
    await closeDb(database);
  }
}

async function auditCount(dataDir) {
  const database = openDb(dataDir);
  try {
    const table = await dbGet(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_audit_log'"
    );
    if (!table) return 0;
    const row = await dbGet(database, "SELECT COUNT(*) AS count FROM admin_audit_log");
    return Number(row.count || 0);
  } finally {
    await closeDb(database);
  }
}

async function waitForHealth(baseUrl, child, output) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before health check. Output: ${output.join("")}`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for /health. Output: ${output.join("")}`);
}

async function startServer(dataDir, extraEnv = {}) {
  const port = await freePort();
  const output = [];
  const child = childProcess.spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      UPLOADS_DIR: tempDir("grocery-owner-startup-uploads-"),
      SESSION_SECRET: "owner-startup-repair-test-secret",
      PUBLIC_APP_URL: "https://thegroceryradar.com",
      EMAIL_TEST_MODE: "1",
      ...extraEnv
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, child, output);

  return {
    output,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  };
}

async function startServerExpectFailure(dataDir, extraEnv = {}, expectedPattern = /OWNER_REPAIR_ON_START|Owner identity conflict/) {
  const port = await freePort();
  const output = [];
  const child = childProcess.spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      UPLOADS_DIR: tempDir("grocery-owner-startup-fail-uploads-"),
      SESSION_SECRET: "owner-startup-repair-test-secret",
      PUBLIC_APP_URL: "https://thegroceryradar.com",
      EMAIL_TEST_MODE: "1",
      ...extraEnv
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Server started or hung when startup should have failed. Output: ${output.join("")}`));
    }, 10000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  assert.notEqual(child.exitCode, 0);
  assert.match(output.join(""), expectedPattern);
  return output.join("");
}

async function assertSingleOwner(dataDir, expectedId = 1) {
  const users = await allUsers(dataDir);
  const superAdmins = users.filter((user) => Number(user.is_super_admin) === 1);
  assert.equal(superAdmins.length, 1);
  assert.equal(superAdmins[0].id, expectedId);
  assert.equal(String(superAdmins[0].email || "").toLowerCase(), OWNER_EMAIL);
  assert.equal(String(superAdmins[0].username || "").toLowerCase(), OWNER_USERNAME);
  return users;
}

async function testCaseAStartupRepair() {
  const dataDir = tempDir("grocery-owner-startup-a-");
  await seedUsers(dataDir, [
    { username: "oldowner", email: OWNER_EMAIL.toUpperCase() }
  ]);

  const app = await startServer(dataDir, { OWNER_REPAIR_ON_START: "true" });
  try {
    const output = app.output.join("");
    assert.match(output, /OWNER_REPAIR_ON_START result/);
    assert.match(output, /case_a_email_match_username_available/);
    assert.match(output, /must now be removed from Render/);
    const users = await assertSingleOwner(dataDir);
    assert.equal(users.length, 1);
    assert.equal(users[0].username, OWNER_USERNAME);
    assert.equal(await auditCount(dataDir), 1);
  } finally {
    await app.stop();
  }
}

async function testCaseBStartupRepair() {
  const dataDir = tempDir("grocery-owner-startup-b-");
  await seedUsers(dataDir, [
    { username: OWNER_USERNAME.toUpperCase(), email: "wrong-owner-email@example.invalid" }
  ]);

  const app = await startServer(dataDir, { OWNER_REPAIR_ON_START: "true" });
  try {
    const output = app.output.join("");
    assert.match(output, /case_b_username_match_email_available/);
    const users = await assertSingleOwner(dataDir);
    assert.equal(users.length, 1);
    assert.equal(users[0].email, OWNER_EMAIL);
    assert.equal(await auditCount(dataDir), 1);
  } finally {
    await app.stop();
  }
}

async function testExactMatchUnchanged() {
  const dataDir = tempDir("grocery-owner-startup-exact-");
  await seedUsers(dataDir, [
    { username: OWNER_USERNAME, email: OWNER_EMAIL, is_admin: true, is_super_admin: true }
  ]);

  const app = await startServer(dataDir, { OWNER_REPAIR_ON_START: "true" });
  try {
    const output = app.output.join("");
    assert.match(output, /already_repaired/);
    await assertSingleOwner(dataDir);
    assert.equal(await auditCount(dataDir), 0);
  } finally {
    await app.stop();
  }
}

async function testCaseCStopsSafely() {
  const dataDir = tempDir("grocery-owner-startup-c-");
  await seedUsers(dataDir, [
    { username: "emailholder", email: OWNER_EMAIL },
    { username: OWNER_USERNAME, email: "username-holder@example.invalid" }
  ]);

  const output = await startServerExpectFailure(
    dataDir,
    { OWNER_REPAIR_ON_START: "true" },
    /case_c_split_owner_identity/
  );
  assert.match(output, /Strict startup validation was not bypassed/);
  const users = await allUsers(dataDir);
  assert.equal(users[0].username, "emailholder");
  assert.equal(users[0].is_super_admin, 0);
  assert.equal(users[1].email, "username-holder@example.invalid");
  assert.equal(users[1].is_super_admin, 0);
}

async function testCaseDStopsSafely() {
  const dataDir = tempDir("grocery-owner-startup-d-");
  await seedUsers(dataDir, [
    { username: "regularuser", email: "regular@example.invalid" }
  ]);

  await startServerExpectFailure(
    dataDir,
    { OWNER_REPAIR_ON_START: "true" },
    /case_d_owner_identity_missing/
  );
  const users = await allUsers(dataDir);
  assert.equal(users.length, 1);
  assert.equal(users[0].is_super_admin, 0);
}

async function testMissingDatabaseStopsSafely() {
  const dataDir = tempDir("grocery-owner-startup-missing-");
  const output = await startServerExpectFailure(
    dataDir,
    { OWNER_REPAIR_ON_START: "true" },
    /SQLite database file does not exist/
  );
  assert.match(output, /Database initialization failed/);
  assert.equal(fs.existsSync(dbPath(dataDir)), false);
}

async function testNormalStartupUnchangedWithoutFlag() {
  const dataDir = tempDir("grocery-owner-startup-normal-");
  await seedUsers(dataDir, [
    { username: "oldowner", email: OWNER_EMAIL }
  ]);

  await startServerExpectFailure(dataDir, {}, /Owner identity conflict/);
  const users = await allUsers(dataDir);
  assert.equal(users.length, 1);
  assert.equal(users[0].username, "oldowner");
  assert.equal(users[0].is_super_admin, 0);
}

async function testDuplicateOwnerStopsSafely() {
  const dataDir = tempDir("grocery-owner-startup-duplicate-");
  await seedUsers(dataDir, [
    { username: "oldowner", email: OWNER_EMAIL },
    { username: "otherowner", email: "other-owner@example.invalid", is_admin: true, is_super_admin: true }
  ]);

  await startServerExpectFailure(
    dataDir,
    { OWNER_REPAIR_ON_START: "true" },
    /duplicate_owner_or_super_admin/
  );
  const users = await allUsers(dataDir);
  assert.equal(users[0].username, "oldowner");
  assert.equal(users[0].is_super_admin, 0);
  assert.equal(users[1].is_super_admin, 1);
}

async function main() {
  await testCaseAStartupRepair();
  await testCaseBStartupRepair();
  await testExactMatchUnchanged();
  await testCaseCStopsSafely();
  await testCaseDStopsSafely();
  await testMissingDatabaseStopsSafely();
  await testNormalStartupUnchangedWithoutFlag();
  await testDuplicateOwnerStopsSafely();
  console.log("Owner startup repair tests passed.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
