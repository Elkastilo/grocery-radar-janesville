"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const { verificationUrlForToken } = require("../src/email");

const ROOT_DIR = path.join(__dirname, "..");
const OWNER_EMAIL = "juricbu@gmail.com";
const OWNER_USERNAME = "elcastilo";
const OWNER_PASSWORD = "OwnerLaunchPass123!";

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

async function withDb(dataDir, callback) {
  const database = openDb(dataDir);
  try { return await callback(database); }
  finally { await closeDb(database); }
}

async function createUsersTable(database) {
  await dbRun(database, `
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
}

async function seedUsers(dataDir, seedRows = []) {
  if (!seedRows.length) return;
  const database = openDb(dataDir);
  try {
    await createUsersTable(database);
    for (const row of seedRows) {
      const passwordHash = await bcrypt.hash(row.password || "LaunchPass123!", 12);
      await dbRun(
        database,
        `
          INSERT INTO users (
            username,
            email,
            password_hash,
            points,
            accuracy_score,
            is_email_verified,
            email_verified_at,
            is_admin,
            is_super_admin,
            account_status,
            created_at
          )
          VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', ?)
        `,
        [
          row.username,
          row.email,
          passwordHash,
          row.points || 0,
          row.is_email_verified === false ? 0 : 1,
          row.is_email_verified === false ? null : new Date().toISOString(),
          row.is_admin ? 1 : 0,
          row.is_super_admin ? 1 : 0,
          row.created_at || new Date().toISOString()
        ]
      );
    }
  } finally {
    await closeDb(database);
  }
}

function ownerSeed(overrides = {}) {
  return {
    username: OWNER_USERNAME,
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    is_admin: false,
    is_super_admin: false,
    is_email_verified: true,
    ...overrides
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(baseUrl, child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 15000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before health check. Exit code ${child.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error("Timed out waiting for /health.");
}

async function startServer(extraEnv = {}, options = {}) {
  const dataDir = options.dataDir || tempDir("grocery-radar-auth-data-");
  const uploadsDir = options.uploadsDir || tempDir("grocery-radar-auth-uploads-");
  const seedRows = Object.prototype.hasOwnProperty.call(options, "seedUsers")
    ? options.seedUsers
    : [ownerSeed()];
  await seedUsers(dataDir, seedRows);
  const port = await freePort();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: dataDir,
    UPLOADS_DIR: uploadsDir,
    SESSION_SECRET: "test-session-secret",
    PUBLIC_APP_URL: "https://thegroceryradar.com",
    SUPER_ADMIN_EMAIL: "attacker@example.invalid",
    OWNER_EMAIL: "attacker@example.invalid",
    VERIFICATION_RESEND_COOLDOWN_SECONDS: "60",
    ...extraEnv
  };
  const child = childProcess.spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];

  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHealth(baseUrl, child);

  return {
    baseUrl,
    dataDir,
    uploadsDir,
    child,
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

async function startServerExpectFailure(extraEnv = {}, options = {}, expectedMessage = /Owner identity conflict/) {
  const dataDir = options.dataDir || tempDir("grocery-radar-auth-fail-data-");
  const uploadsDir = options.uploadsDir || tempDir("grocery-radar-auth-fail-uploads-");
  await seedUsers(dataDir, Object.prototype.hasOwnProperty.call(options, "seedUsers") ? options.seedUsers : []);
  const port = await freePort();
  const env = {
    ...process.env,
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: dataDir,
    UPLOADS_DIR: uploadsDir,
    SESSION_SECRET: "test-session-secret",
    PUBLIC_APP_URL: "https://thegroceryradar.com",
    SUPER_ADMIN_EMAIL: "attacker@example.invalid",
    OWNER_EMAIL: "attacker@example.invalid",
    VERIFICATION_RESEND_COOLDOWN_SECONDS: "60",
    ...extraEnv
  };
  const child = childProcess.spawn(process.execPath, ["server.js"], {
    cwd: ROOT_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Server started or hung when owner bootstrap should have failed."));
    }, 8000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  assert.notEqual(child.exitCode, 0, "Owner bootstrap conflict should exit non-zero.");
  assert.match(output.join(""), expectedMessage);
  return { dataDir, uploadsDir, output };
}

class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(pathname, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.cookie) headers.cookie = this.cookie;
    if (options.json) headers["content-type"] = "application/json";

    const response = await fetch(`${this.baseUrl}${pathname}`, {
      ...options,
      headers,
      body: options.json ? JSON.stringify(options.json) : options.body,
      redirect: options.redirect || "manual"
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    return { response, body };
  }

  get(pathname) {
    return this.request(pathname);
  }

  post(pathname, json) {
    return this.request(pathname, { method: "POST", json });
  }
}

async function register(client, overrides = {}) {
  const password = overrides.password || "LaunchPass123!";
  const payload = {
    username: overrides.username,
    email: overrides.email,
    password,
    confirmPassword: password
  };
  const result = await client.post("/api/auth/register", payload);
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  return { ...result.body, password };
}

async function userByEmail(dataDir, email) {
  const database = openDb(dataDir);
  try {
    return await dbGet(database, "SELECT * FROM users WHERE lower(email) = lower(?) ORDER BY id ASC", [email]);
  } finally {
    await closeDb(database);
  }
}

async function usersByEmail(dataDir, email) {
  const database = openDb(dataDir);
  try {
    return await dbAll(database, "SELECT * FROM users WHERE lower(email) = lower(?) ORDER BY id ASC", [email]);
  } finally {
    await closeDb(database);
  }
}

async function updateUser(dataDir, sql, params = []) {
  const database = openDb(dataDir);
  try {
    await dbRun(database, sql, params);
  } finally {
    await closeDb(database);
  }
}

async function queryOne(dataDir, sql, params = []) {
  const database = openDb(dataDir);
  try {
    return await dbGet(database, sql, params);
  } finally {
    await closeDb(database);
  }
}

function approvedReportCountForItem(browse, itemName) {
  const reports = browse.recently_approved_reports || [];
  return reports.filter((report) => String(report.item_name || "").toLowerCase() === itemName.toLowerCase()).length;
}

async function main() {
  const originalPublicAppUrl = process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL = "https://thegroceryradar.com";
  assert.match(verificationUrlForToken("sample-token"), /^https:\/\/thegroceryradar\.com\/api\/auth\/verify-email\?token=/);
  if (originalPublicAppUrl === undefined) {
    delete process.env.PUBLIC_APP_URL;
  } else {
    process.env.PUBLIC_APP_URL = originalPublicAppUrl;
  }

  const app = await startServer({ EMAIL_TEST_MODE: "1", ADMIN_PIN: "2468" });

  try {
    const anonymousClient = new TestClient(app.baseUrl);
    const anonymousUrlAnalyze = await anonymousClient.post("/api/admin/product-url-imports/analyze", { url: "https://www.walmart.com/ip/test" });
    assert.equal(anonymousUrlAnalyze.response.status, 403);
    const anonymousCategoryAnalyze = await anonymousClient.post("/api/admin/product-url-imports/analyze", { url: "https://www.walmart.com/browse/food/fresh-fruits/123", max_products: 50 });
    assert.equal(anonymousCategoryAnalyze.response.status, 403);

    const ownerClient = new TestClient(app.baseUrl);
    const ownerLogin = await ownerClient.post("/api/auth/login", {
      email: OWNER_EMAIL.toUpperCase(),
      password: OWNER_PASSWORD
    });
    assert.equal(ownerLogin.response.status, 200, JSON.stringify(ownerLogin.body));
    assert.equal(ownerLogin.body.user.email, OWNER_EMAIL);
    assert.equal(ownerLogin.body.user.username, OWNER_USERNAME);
    assert.equal(ownerLogin.body.user.is_admin, true);
    assert.equal(ownerLogin.body.user.is_super_admin, true);

    const ownerMatches = await usersByEmail(app.dataDir, OWNER_EMAIL);
    assert.equal(ownerMatches.length, 1);
    assert.equal(ownerMatches[0].username, OWNER_USERNAME);
    assert.equal(ownerMatches[0].is_admin, 1);
    assert.equal(ownerMatches[0].is_super_admin, 1);

    const spoofedOwnerChange = await ownerClient.post("/api/account/username", { username: "owneraway" });
    assert.equal(spoofedOwnerChange.response.status, 400);

    const normalClient = new TestClient(app.baseUrl);
    const normalRegistration = await register(normalClient, {
      username: "janeshopper",
      email: "janeshopper@shopper.invalid"
    });
    assert.equal(normalRegistration.user.is_admin, false);
    assert.equal(normalRegistration.user.is_super_admin, false);

    const storesForProof = await normalClient.get("/api/stores");
    assert.equal(storesForProof.response.status, 200);
    const proofStore = storesForProof.body.stores.find((store) => /woodman/i.test(store.name));
    assert.ok(proofStore);

    const proofForm = new FormData();
    proofForm.set("store_id", String(proofStore.id));
    proofForm.set("proof_type", "receipt");
    proofForm.set("source_url", "https://example.invalid/temporary-receipt-proof");
    proofForm.set("notes", "Temporary proof-only integration test. No public price should be created.");
    const proofSubmission = await normalClient.request("/api/proof-submissions", {
      method: "POST",
      body: proofForm
    });
    assert.equal(proofSubmission.response.status, 201, JSON.stringify(proofSubmission.body));
    assert.equal(proofSubmission.body.status, "needs_admin_review");

    const browseAfterProofOnly = await normalClient.get("/api/browse");
    assert.equal(approvedReportCountForItem(browseAfterProofOnly.body, "Temporary"), 0);

    const blockedIntake = await normalClient.post("/api/admin/price-intake/batches", {
      source_type: "paste_text",
      proof_type: "weekly_ad",
      source_text: "$2.99 Milk 1 gal",
      source_url: "https://example.invalid/ad"
    });
    assert.equal(blockedIntake.response.status, 403);

    const blockedUrlAnalyze = await normalClient.post("/api/admin/product-url-imports/analyze", {
      url: "https://www.walmart.com/ip/test"
    });
    assert.equal(blockedUrlAnalyze.response.status, 403);
    const blockedUrlSave = await normalClient.post("/api/admin/product-url-imports", {
      name: "Unauthorized product", source_url: "https://www.walmart.com/ip/test"
    });
    assert.equal(blockedUrlSave.response.status, 403);
    const blockedCategorySave = await normalClient.post("/api/admin/product-url-imports/batch", {
      category_source_url: "https://www.walmart.com/browse/food/fresh-fruits/123",
      items: [{ name: "Unauthorized category item", product_url: "https://www.walmart.com/ip/test" }]
    });
    assert.equal(blockedCategorySave.response.status, 403);
    const pinOnlyClient = new TestClient(app.baseUrl);
    const pinOnlyCategorySave = await pinOnlyClient.post("/api/admin/product-url-imports/batch", {
      pin: "2468", category_source_url: "https://www.walmart.com/browse/food/fresh-fruits/123",
      items: [{ name: "PIN-only category item", product_url: "https://www.walmart.com/ip/test" }]
    });
    assert.equal(pinOnlyCategorySave.response.status, 403);

    const ownerUrlSave = await ownerClient.post("/api/admin/product-url-imports", {
      name: "Importer Authorization Fixture",
      brand: "Fixture Brand",
      price: "3.99",
      quantity: "12",
      item_size: "12",
      unit: "fl_oz",
      size_text: "12 x 12 fl oz",
      store_id: proofStore.id,
      source_url: "https://www.walmart.com/ip/importer-auth-fixture",
      fetched_url: "https://www.walmart.com/ip/importer-auth-fixture",
      retailer_name: "Walmart",
      extraction_methods: ["json_ld"],
      field_confidences: { name: "high", price: "high" },
      price_location_confidence: "unknown"
    });
    assert.equal(ownerUrlSave.response.status, 201, JSON.stringify(ownerUrlSave.body));
    const savedUrlImport = await withDb(app.dataDir, (database) => dbGet(database, `
      SELECT rows.status AS row_status, batches.status AS batch_status, reports.id AS public_report_id, imports.source_domain
      FROM product_url_imports imports
      JOIN price_import_rows rows ON rows.id = imports.row_id
      JOIN price_import_batches batches ON batches.id = imports.batch_id
      LEFT JOIN price_reports reports ON reports.id = rows.price_report_id
      WHERE imports.id = (SELECT MAX(id) FROM product_url_imports)
    `));
    assert.equal(savedUrlImport.row_status, "ready_for_review");
    assert.equal(savedUrlImport.batch_status, "ready_for_review");
    assert.equal(savedUrlImport.public_report_id, null);
    assert.equal(savedUrlImport.source_domain, "walmart.com");

    const ownerCategorySave = await ownerClient.post("/api/admin/product-url-imports/batch", {
      category_source_url: "https://www.walmart.com/browse/food/fresh-fruits/123",
      retailer_name: "Walmart",
      store_id: proofStore.id,
      price_location_confidence: "confirmed_janesville",
      location_evidence_text: "Fixture admin explicitly selected the Janesville store; approval is still required.",
      items: [
        { name: "Category Bananas Fixture", price: 0.27, quantity: 1, unit: "each", size_text: "1 each", product_url: "https://www.walmart.com/ip/category-bananas/1001", sku: "CAT-1001", overall_confidence: "high", extraction_methods: ["walmart_serialized_data"] },
        { name: "Category Strawberries Fixture", price: 2.98, quantity: 1, item_size: 1, unit: "lb", size_text: "1 lb", product_url: "https://www.walmart.com/ip/category-strawberries/1002", sku: "CAT-1002", overall_confidence: "high", extraction_methods: ["walmart_serialized_data"] }
      ]
    });
    assert.equal(ownerCategorySave.response.status, 201, JSON.stringify(ownerCategorySave.body));
    assert.equal(ownerCategorySave.body.imports.length, 2);
    const categoryPersistence = await withDb(app.dataDir, async (database) => ({
      rows: await dbGet(database, "SELECT COUNT(*) AS count FROM price_import_rows WHERE item_name LIKE 'Category % Fixture' AND status = 'ready_for_review'"),
      batches: await dbGet(database, "SELECT COUNT(*) AS count FROM price_import_batches WHERE batch_title LIKE 'Category URL import:%' AND status = 'ready_for_review'"),
      reports: await dbGet(database, "SELECT COUNT(*) AS count FROM price_reports WHERE item_name LIKE 'Category % Fixture'")
    }));
    assert.equal(categoryPersistence.rows.count, 2);
    assert.equal(categoryPersistence.batches.count, 2);
    assert.equal(categoryPersistence.reports.count, 0);

    const blockedOperations = await normalClient.get("/api/admin/operations/overview");
    assert.equal(blockedOperations.response.status, 403);

    await updateUser(app.dataDir, "UPDATE users SET is_admin = 1 WHERE id = ?", [normalRegistration.user.id]);
    const normalAdminIntake = await normalClient.get("/api/admin/price-imports");
    assert.equal(normalAdminIntake.response.status, 200, JSON.stringify(normalAdminIntake.body));
    const normalAdminOperations = await normalClient.get("/api/admin/operations/overview");
    assert.equal(normalAdminOperations.response.status, 403);
    const normalAdminAccountAudit = await normalClient.get("/api/admin/admin-accounts");
    assert.equal(normalAdminAccountAudit.response.status, 403);
    const normalAdminAnnouncement = await normalClient.post("/api/admin/operations/announcements", {
      announcement_type: "homepage_banner",
      status: "published",
      title: "Blocked announcement",
      body: "Normal admins cannot publish owner-only announcements."
    });
    assert.equal(normalAdminAnnouncement.response.status, 403);
    const normalAdminRoleChange = await normalClient.post(`/api/admin/admin-accounts/${normalRegistration.user.id}/role`, {
      action: "promote_admin",
      confirmation: "MAKE ADMIN",
      is_super_admin: true
    });
    assert.equal(normalAdminRoleChange.response.status, 403);

    const supportClient = new TestClient(app.baseUrl);
    const supportRegistration = await register(supportClient, {
      username: "janebuyer",
      email: "supportshopper@shopper.invalid"
    });
    const peerAdminClient = new TestClient(app.baseUrl);
    const peerAdminRegistration = await register(peerAdminClient, {
      username: "alicejanes",
      email: "peeradmin@shopper.invalid"
    });
    await updateUser(
      app.dataDir,
      "UPDATE users SET is_admin = 1, staff_role = 'manager' WHERE id = ?",
      [peerAdminRegistration.user.id]
    );

    const managerOwnerReset = await normalClient.post(`/api/admin/users/${ownerMatches[0].id}/reset-password`, {
      newPassword: "StolenOwnerPass123!"
    });
    assert.equal(managerOwnerReset.response.status, 403);
    const managerOwnerProfile = await normalClient.post(`/api/admin/users/${ownerMatches[0].id}/profile`, {
      username: "stolenowner",
      admin_note: "manager must not mutate owner"
    });
    assert.equal(managerOwnerProfile.response.status, 403);
    const managerOwnerModeration = await normalClient.post(`/api/admin/users/${ownerMatches[0].id}/moderation`, {
      action: "suspended"
    });
    assert.equal(managerOwnerModeration.response.status, 403);

    const managerPeerReset = await normalClient.post(`/api/admin/users/${peerAdminRegistration.user.id}/reset-password`, {
      newPassword: "PeerTakeoverPass123!"
    });
    assert.equal(managerPeerReset.response.status, 403);
    const managerPeerProfile = await normalClient.post(`/api/admin/users/${peerAdminRegistration.user.id}/profile`, {
      email: "peerchanged@shopper.invalid",
      confirm_email_edit: "EDIT EMAIL"
    });
    assert.equal(managerPeerProfile.response.status, 403);
    const managerPeerFlags = await normalClient.post(`/api/admin/users/${peerAdminRegistration.user.id}/flags`, {
      is_email_verified: false
    });
    assert.equal(managerPeerFlags.response.status, 403);
    const managerPeerModeration = await normalClient.post(`/api/admin/users/${peerAdminRegistration.user.id}/moderation`, {
      action: "suspended"
    });
    assert.equal(managerPeerModeration.response.status, 403);

    const reservedUsernameTransfer = await normalClient.post(`/api/admin/users/${supportRegistration.user.id}/profile`, {
      username: OWNER_USERNAME
    });
    assert.equal(reservedUsernameTransfer.response.status, 400);
    const reservedEmailTransfer = await normalClient.post(`/api/admin/users/${supportRegistration.user.id}/profile`, {
      email: OWNER_EMAIL.toUpperCase(),
      confirm_email_edit: "EDIT EMAIL"
    });
    assert.equal(reservedEmailTransfer.response.status, 400);

    const reservedRegistrationUsername = await new TestClient(app.baseUrl).post("/api/auth/register", {
      username: OWNER_USERNAME.toUpperCase(),
      email: "reserved-name@shopper.invalid",
      password: "LaunchPass123!",
      confirmPassword: "LaunchPass123!"
    });
    assert.equal(reservedRegistrationUsername.response.status, 409);
    const reservedRegistrationEmail = await new TestClient(app.baseUrl).post("/api/auth/register", {
      username: "reservedemail",
      email: OWNER_EMAIL.toUpperCase(),
      password: "LaunchPass123!",
      confirmPassword: "LaunchPass123!"
    });
    assert.equal(reservedRegistrationEmail.response.status, 409);

    const managerNormalProfile = await normalClient.post(`/api/admin/users/${supportRegistration.user.id}/profile`, {
      username: "janebuyer2",
      email: "supportshopper2@shopper.invalid",
      confirm_email_edit: "EDIT EMAIL",
      is_admin: true,
      is_super_admin: true,
      staff_role: "owner"
    });
    assert.equal(managerNormalProfile.response.status, 200, JSON.stringify(managerNormalProfile.body));
    const normalAfterProfile = await userByEmail(app.dataDir, "supportshopper2@shopper.invalid");
    assert.equal(normalAfterProfile.is_admin, 0);
    assert.equal(normalAfterProfile.is_super_admin, 0);
    assert.equal(normalAfterProfile.staff_role, "user");

    const managerNormalReset = await normalClient.post(`/api/admin/users/${supportRegistration.user.id}/reset-password`, {
      newPassword: "SupportResetPass123!"
    });
    assert.equal(managerNormalReset.response.status, 200, JSON.stringify(managerNormalReset.body));
    assert.equal(Object.prototype.hasOwnProperty.call(managerNormalReset.body, "password_hash"), false);
    const revokedSession = await supportClient.get("/api/auth/me");
    assert.equal(revokedSession.response.status, 200);
    assert.equal(revokedSession.body.loggedIn, false);
    const oldPasswordLogin = await new TestClient(app.baseUrl).post("/api/auth/login", {
      email: "supportshopper2@shopper.invalid",
      password: supportRegistration.password
    });
    assert.equal(oldPasswordLogin.response.status, 401);
    const resetPasswordLogin = await new TestClient(app.baseUrl).post("/api/auth/login", {
      email: "supportshopper2@shopper.invalid",
      password: "SupportResetPass123!"
    });
    assert.equal(resetPasswordLogin.response.status, 200, JSON.stringify(resetPasswordLogin.body));
    const passwordResetAudit = await queryOne(
      app.dataDir,
      "SELECT * FROM admin_audit_log WHERE action = 'ADMIN_PASSWORD_RESET' AND affected_id = ? ORDER BY id DESC LIMIT 1",
      [supportRegistration.user.id]
    );
    assert.ok(passwordResetAudit);
    assert.equal(passwordResetAudit.admin_user_id, normalRegistration.user.id);
    const passwordResetNotice = await queryOne(
      app.dataDir,
      "SELECT * FROM notifications WHERE user_id = ? AND type = 'admin_password_reset' ORDER BY id DESC LIMIT 1",
      [supportRegistration.user.id]
    );
    assert.ok(passwordResetNotice);

    const ownerManagesNormalRole = await ownerClient.post(`/api/admin/v2/workers/${supportRegistration.user.id}/role`, {
      role: "data_entry"
    });
    assert.equal(ownerManagesNormalRole.response.status, 200, JSON.stringify(ownerManagesNormalRole.body));
    const ownerRestoresNormalRole = await ownerClient.post(`/api/admin/v2/workers/${supportRegistration.user.id}/role`, {
      role: "user"
    });
    assert.equal(ownerRestoresNormalRole.response.status, 200, JSON.stringify(ownerRestoresNormalRole.body));
    const ownerCannotTransferReservedIdentity = await ownerClient.post(`/api/admin/users/${supportRegistration.user.id}/profile`, {
      username: OWNER_USERNAME
    });
    assert.equal(ownerCannotTransferReservedIdentity.response.status, 400);

    const ownerSelfReset = await ownerClient.post(`/api/admin/users/${ownerMatches[0].id}/reset-password`, {
      newPassword: "OwnerAdminReset123!"
    });
    assert.equal(ownerSelfReset.response.status, 403);
    const ownerSelfProfile = await ownerClient.post(`/api/admin/users/${ownerMatches[0].id}/profile`, {
      email: "owner-away@example.invalid",
      confirm_email_edit: "EDIT EMAIL"
    });
    assert.equal(ownerSelfProfile.response.status, 403);
    const ownerSelfRole = await ownerClient.post(`/api/admin/v2/workers/${ownerMatches[0].id}/role`, {
      role: "manager"
    });
    assert.equal(ownerSelfRole.response.status, 403);

    const ownerAfterTransferAttempts = await userByEmail(app.dataDir, OWNER_EMAIL);
    assert.equal(ownerAfterTransferAttempts.id, ownerMatches[0].id);
    assert.equal(ownerAfterTransferAttempts.username, OWNER_USERNAME);
    assert.equal(ownerAfterTransferAttempts.is_super_admin, 1);
    const managerAfterTransferAttempts = await userByEmail(app.dataDir, "janeshopper@shopper.invalid");
    assert.equal(managerAfterTransferAttempts.is_super_admin, 0);

    const normalAdminDeactivate = await normalClient.post(`/api/admin/users/${normalRegistration.user.id}/moderation`, {
      action: "deactivated"
    });
    assert.equal(normalAdminDeactivate.response.status, 403);
    const clientSpoof = await normalClient.post("/api/admin/operations/widgets", {
      is_super_admin: true,
      user: { is_super_admin: true },
      layout: { order: ["system_health"] }
    });
    assert.equal(clientSpoof.response.status, 403);
    const pinOperations = await new TestClient(app.baseUrl).get("/api/admin/operations/overview?pin=1234");
    assert.equal(pinOperations.response.status, 403);
    const pinRoleChange = await new TestClient(app.baseUrl).post(`/api/admin/admin-accounts/${normalRegistration.user.id}/role?pin=1234`, {
      action: "promote_admin",
      confirmation: "MAKE ADMIN"
    });
    assert.equal(pinRoleChange.response.status, 403);
    const pinDeactivate = await new TestClient(app.baseUrl).post(`/api/admin/users/${normalRegistration.user.id}/moderation?pin=1234`, {
      action: "deactivated"
    });
    assert.equal(pinDeactivate.response.status, 403);

    const normalRecord = await userByEmail(app.dataDir, "janeshopper@shopper.invalid");
    assert.match(normalRecord.email_verification_token, /^[a-f0-9]{64}$/);
    assert.ok(normalRecord.email_verification_expires);
    const verified = await normalClient.get(`/api/auth/verify-email?token=${encodeURIComponent(normalRecord.email_verification_token)}`);
    assert.equal(verified.response.status, 200);
    const verifyAgain = await normalClient.get(`/api/auth/verify-email?token=${encodeURIComponent(normalRecord.email_verification_token)}`);
    assert.equal(verifyAgain.response.status, 400);
    const invalidVerify = await ownerClient.get("/api/auth/verify-email?token=invalid-token");
    assert.equal(invalidVerify.response.status, 400);

    const expiredClient = new TestClient(app.baseUrl);
    await register(expiredClient, {
      username: "expiredshopper",
      email: "expired@shopper.invalid"
    });
    const expiredUser = await userByEmail(app.dataDir, "expired@shopper.invalid");
    await updateUser(app.dataDir, "UPDATE users SET email_verification_expires = ? WHERE id = ?", [
      new Date(Date.now() - 1000).toISOString(),
      expiredUser.id
    ]);
    const expiredResult = await expiredClient.get(`/api/auth/verify-email?token=${encodeURIComponent(expiredUser.email_verification_token)}`);
    assert.equal(expiredResult.response.status, 400);

    const resendClient = new TestClient(app.baseUrl);
    await register(resendClient, {
      username: "resendshopper",
      email: "resend@shopper.invalid"
    });
    const resendUser = await userByEmail(app.dataDir, "resend@shopper.invalid");
    await updateUser(app.dataDir, "UPDATE users SET verification_email_last_sent_at = NULL WHERE id = ?", [resendUser.id]);
    const resendOk = await resendClient.post("/api/auth/resend-verification", {});
    assert.equal(resendOk.response.status, 200, JSON.stringify(resendOk.body));
    const resendLimited = await resendClient.post("/api/auth/resend-verification", {});
    assert.equal(resendLimited.response.status, 429);
    assert.ok(resendLimited.body.retry_after_seconds > 0);

    await updateUser(app.dataDir, "UPDATE users SET is_admin = 0, is_super_admin = 0 WHERE lower(email) = lower(?)", [OWNER_EMAIL]);
    const loginResult = await ownerClient.post("/api/auth/login", {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });
    assert.equal(loginResult.response.status, 200);
    assert.equal(loginResult.body.user.is_admin, true);
    assert.equal(loginResult.body.user.is_super_admin, true);
    const ownerAfterLogin = await usersByEmail(app.dataDir, OWNER_EMAIL);
    assert.equal(ownerAfterLogin.length, 1);
    assert.equal(ownerAfterLogin[0].is_admin, 1);
    assert.equal(ownerAfterLogin[0].is_super_admin, 1);

    const publicOwnerProfile = await normalClient.get(`/api/users/${OWNER_USERNAME}`);
    assert.equal(publicOwnerProfile.response.status, 200);
    assert.equal(JSON.stringify(publicOwnerProfile.body).includes(OWNER_EMAIL), false);
    const publicLeaderboard = await normalClient.get("/api/leaderboard");
    assert.equal(publicLeaderboard.response.status, 200);
    assert.equal(JSON.stringify(publicLeaderboard.body).includes(OWNER_EMAIL), false);
    const publicBrowse = await normalClient.get("/api/browse");
    assert.equal(publicBrowse.response.status, 200);
    assert.equal(JSON.stringify(publicBrowse.body).includes(OWNER_EMAIL), false);

    const storesResponse = await ownerClient.get("/api/stores");
    assert.equal(storesResponse.response.status, 200);
    const woodmans = storesResponse.body.stores.find((store) => /woodman/i.test(store.name));
    assert.ok(woodmans);

    const adminImports = await ownerClient.get("/api/admin/price-imports");
    assert.equal(adminImports.response.status, 200);
    assert.ok(adminImports.body.batches.some((batch) => batch.id === proofSubmission.body.batch_id));

    const initialBrowse = await ownerClient.get("/api/browse");
    assert.equal(initialBrowse.response.status, 200);
    assert.equal(approvedReportCountForItem(initialBrowse.body, "Milk"), 0);

    const draftBatch = await ownerClient.post("/api/admin/price-intake/batches", {
      source_type: "paste_text",
      proof_type: "weekly_ad",
      default_store_id: woodmans.id,
      category: "dairy",
      source_url: "https://example.invalid/grocery-ad-1",
      source_title: "Temporary integration test ad",
      source_text: "$2.99 Milk 1 gal"
    });
    assert.equal(draftBatch.response.status, 201, JSON.stringify(draftBatch.body));
    assert.equal(draftBatch.body.batch.rows.length, 1);
    const draftRowId = draftBatch.body.batch.rows[0].id;
    const locationResolution = await ownerClient.post(`/api/admin/price-import-batches/${draftBatch.body.batch.id}/location`, { store_id: woodmans.id, evidence_note: "Fixture explicitly establishes the Janesville Woodman's location." });
    assert.equal(locationResolution.response.status, 200, JSON.stringify(locationResolution.body));

    const browseWithDraft = await ownerClient.get("/api/browse");
    assert.equal(approvedReportCountForItem(browseWithDraft.body, "Milk"), 0);

    const approveResult = await ownerClient.post("/api/admin/price-import-rows/bulk", {
      action: "approve",
      row_ids: [draftRowId]
    });
    assert.equal(approveResult.response.status, 200, JSON.stringify(approveResult.body));
    assert.notEqual(approveResult.body.results[0].duplicate, true);

    const browseAfterApproval = await ownerClient.get("/api/browse");
    assert.equal(approvedReportCountForItem(browseAfterApproval.body, "Milk"), 1);

    const duplicateBatch = await ownerClient.post("/api/admin/price-intake/batches", {
      source_type: "paste_text",
      proof_type: "weekly_ad",
      default_store_id: woodmans.id,
      category: "dairy",
      source_url: "https://example.invalid/grocery-ad-2",
      source_title: "Temporary integration test ad duplicate",
      source_text: "$2.99 Milk 1 gal"
    });
    const duplicateLocationResolution = await ownerClient.post(`/api/admin/price-import-batches/${duplicateBatch.body.batch.id}/location`, { store_id: woodmans.id, evidence_note: "Fixture explicitly establishes the Janesville Woodman's location." });
    assert.equal(duplicateLocationResolution.response.status, 200, JSON.stringify(duplicateLocationResolution.body));
    assert.equal(duplicateBatch.response.status, 201, JSON.stringify(duplicateBatch.body));
    assert.equal(duplicateBatch.body.batch.rows.length, 1);
    const duplicateApprove = await ownerClient.post("/api/admin/price-import-rows/bulk", {
      action: "approve",
      row_ids: [duplicateBatch.body.batch.rows[0].id]
    });
    assert.equal(duplicateApprove.response.status, 200, JSON.stringify(duplicateApprove.body));
    assert.equal(duplicateApprove.body.results[0].duplicate, true);
    const browseAfterDuplicate = await ownerClient.get("/api/browse");
    assert.equal(approvedReportCountForItem(browseAfterDuplicate.body, "Milk"), 1);

    await app.stop();
    const restartedApp = await startServer(
      { EMAIL_TEST_MODE: "1" },
      { dataDir: app.dataDir, uploadsDir: app.uploadsDir, seedUsers: [] }
    );
    try {
      const restartedOwnerRows = await usersByEmail(restartedApp.dataDir, OWNER_EMAIL);
      assert.equal(restartedOwnerRows.length, 1);
      assert.equal(restartedOwnerRows[0].username, OWNER_USERNAME);
      assert.equal(restartedOwnerRows[0].is_admin, 1);
      assert.equal(restartedOwnerRows[0].is_super_admin, 1);
      const restartedOwner = new TestClient(restartedApp.baseUrl);
      const restartedLogin = await restartedOwner.post("/api/auth/login", {
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD
      });
      assert.equal(restartedLogin.response.status, 200);
      assert.equal(restartedLogin.body.user.is_super_admin, true);
    } finally {
      await restartedApp.stop();
    }
  } finally {
    await app.stop();
  }

  const caseInsensitiveApp = await startServer(
    { EMAIL_TEST_MODE: "1" },
    {
      seedUsers: [
        ownerSeed({
          username: "ELCASTILO",
          email: "JURICBU@GMAIL.COM",
          password: OWNER_PASSWORD,
          is_admin: false,
          is_super_admin: false
        })
      ]
    }
  );
  try {
    const rows = await usersByEmail(caseInsensitiveApp.dataDir, OWNER_EMAIL);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_admin, 1);
    assert.equal(rows[0].is_super_admin, 1);
    const caseClient = new TestClient(caseInsensitiveApp.baseUrl);
    const login = await caseClient.post("/api/auth/login", {
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.is_super_admin, true);
  } finally {
    await caseInsensitiveApp.stop();
  }

  await startServerExpectFailure(
    { EMAIL_TEST_MODE: "1" },
    {
      seedUsers: [
        {
          username: "ownerwrongname",
          email: OWNER_EMAIL,
          password: "WrongOwnerPass123!",
          is_admin: false,
          is_super_admin: false
        }
      ]
    }
  );

  await startServerExpectFailure(
    { EMAIL_TEST_MODE: "1" },
    {
      seedUsers: [
        {
          username: "ELCASTILO",
          email: "not-owner@example.invalid",
          password: "WrongOwnerPass123!",
          is_admin: false,
          is_super_admin: false
        }
      ]
    }
  );

  await startServerExpectFailure(
    { EMAIL_TEST_MODE: "1" },
    {
      seedUsers: [
        ownerSeed({ is_admin: true, is_super_admin: true }),
        {
          username: "secondsuper",
          email: "secondsuper@example.invalid",
          password: "SecondSuperPass123!",
          is_admin: true,
          is_super_admin: true
        }
      ]
    }
  );

  await startServerExpectFailure(
    { EMAIL_TEST_MODE: "1" },
    {
      seedUsers: [
        {
          username: "elcastilo-wrong",
          email: OWNER_EMAIL,
          password: OWNER_PASSWORD,
          is_admin: false,
          is_super_admin: false
        },
        {
          username: OWNER_USERNAME,
          email: "wrong-owner@example.invalid",
          password: "WrongOwnerPass123!",
          is_admin: false,
          is_super_admin: false
        }
      ]
    }
  );

  const smtpFailureApp = await startServer({
    EMAIL_TEST_MODE: "0",
    EMAIL_HOST: " ",
    SMTP_HOST: " ",
    EMAIL_PORT: " ",
    SMTP_PORT: " ",
    EMAIL_USER: " ",
    SMTP_USER: " ",
    EMAIL_PASS: " ",
    SMTP_PASS: " ",
    EMAIL_FROM: " ",
    SMTP_FROM: " ",
    ADMIN_NOTIFY_EMAIL: " "
  });

  try {
    const failureClient = new TestClient(smtpFailureApp.baseUrl);
    const registration = await register(failureClient, {
      username: "smtpdown",
      email: "smtpdown@shopper.invalid"
    });
    assert.equal(registration.verification_email_sent, false);
    assert.match(registration.message, /verification email was not sent/i);
    const resend = await failureClient.post("/api/auth/resend-verification", {});
    assert.equal(resend.response.status, 400);
    assert.match(resend.body.error, /Email is not configured/i);
  } finally {
    await smtpFailureApp.stop();
  }

  console.log("Super Admin, verification, and Price Intake auth tests passed.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
