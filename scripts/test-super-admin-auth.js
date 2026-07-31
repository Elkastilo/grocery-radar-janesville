"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();
const { verificationUrlForToken } = require("../src/email");

const ROOT_DIR = path.join(__dirname, "..");
const OWNER_EMAIL = "juricbu@gmail.com";

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

async function startServer(extraEnv = {}) {
  const dataDir = tempDir("grocery-radar-auth-data-");
  const uploadsDir = tempDir("grocery-radar-auth-uploads-");
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
    SUPER_ADMIN_EMAIL: OWNER_EMAIL,
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

  const app = await startServer({ EMAIL_TEST_MODE: "1" });

  try {
    const ownerClient = new TestClient(app.baseUrl);
    const ownerRegistration = await register(ownerClient, {
      username: "ownerseed",
      email: "JURICBU@GMAIL.COM"
    });
    assert.equal(ownerRegistration.user.email, OWNER_EMAIL);
    assert.equal(ownerRegistration.user.username, "elcastilo");
    assert.equal(ownerRegistration.user.is_admin, true);
    assert.equal(ownerRegistration.user.is_super_admin, true);
    assert.equal(ownerRegistration.verification_email_sent, true);

    const ownerMatches = await usersByEmail(app.dataDir, OWNER_EMAIL);
    assert.equal(ownerMatches.length, 1);

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

    const ownerRecord = await userByEmail(app.dataDir, OWNER_EMAIL);
    assert.match(ownerRecord.email_verification_token, /^[a-f0-9]{64}$/);
    assert.ok(ownerRecord.email_verification_expires);
    const verified = await ownerClient.get(`/api/auth/verify-email?token=${encodeURIComponent(ownerRecord.email_verification_token)}`);
    assert.equal(verified.response.status, 200);
    const verifyAgain = await ownerClient.get(`/api/auth/verify-email?token=${encodeURIComponent(ownerRecord.email_verification_token)}`);
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
      password: ownerRegistration.password
    });
    assert.equal(loginResult.response.status, 200);
    assert.equal(loginResult.body.user.is_admin, true);
    assert.equal(loginResult.body.user.is_super_admin, true);
    const ownerAfterLogin = await usersByEmail(app.dataDir, OWNER_EMAIL);
    assert.equal(ownerAfterLogin.length, 1);
    assert.equal(ownerAfterLogin[0].is_admin, 1);
    assert.equal(ownerAfterLogin[0].is_super_admin, 1);

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
  } finally {
    await app.stop();
  }

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
