"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcrypt");
const sharp = require("sharp");
const sqlite3 = require("sqlite3").verbose();

const ROOT_DIR = path.join(__dirname, "..");
const OWNER_EMAIL = "juricbu@gmail.com";
const OWNER_USERNAME = "elcastilo";
const OWNER_PASSWORD = "OwnerLaunchPass123!";
const ADMIN_PIN = "1234";

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

function dbPath(dataDir) {
  return path.join(dataDir, "grocery_radar.sqlite");
}

function openDb(dataDir) {
  return new sqlite3.Database(dbPath(dataDir));
}

function dbRun(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function dbGet(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
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

async function seedOwner(dataDir) {
  const database = openDb(dataDir);
  try {
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
        is_admin INTEGER NOT NULL DEFAULT 0,
        is_super_admin INTEGER NOT NULL DEFAULT 0,
        account_status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL
      )
    `);
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
        VALUES (?, ?, ?, 0, 0, 1, ?, 0, 0, 'active', ?)
      `,
      [
        OWNER_USERNAME,
        OWNER_EMAIL,
        await bcrypt.hash(OWNER_PASSWORD, 12),
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  } finally {
    await closeDb(database);
  }
}

async function updateTempUser(dataDir, sql, params = []) {
  const database = openDb(dataDir);
  try {
    return await dbRun(database, sql, params);
  } finally {
    await closeDb(database);
  }
}

async function queryTempDb(dataDir, sql, params = []) {
  const database = openDb(dataDir);
  try { return await dbGet(database, sql, params); } finally { await closeDb(database); }
}

async function approvedReportCount(dataDir) {
  const database = openDb(dataDir);
  try {
    const row = await dbGet(database, "SELECT COUNT(*) AS count FROM price_reports WHERE status = 'approved'");
    return row.count || 0;
  } finally {
    await closeDb(database);
  }
}

async function insertProofBatch(dataDir, userId, title = "Admin V2 receipt") {
  const database = openDb(dataDir);
  try {
    const now = new Date().toISOString();
    const result = await dbRun(
      database,
      `
        INSERT INTO price_import_batches (
          source_type, proof_type, photo_path, status, default_store_id, batch_title,
          notes, created_by, created_at, updated_at, review_status
        ) VALUES ('receipt', 'receipt_photo', 'test-receipt.png', 'needs_admin_review', 1, ?, ?, ?, ?, ?, 'waiting')
      `,
      [title, "Proof submission details | Store ID: 1 | Store: Test Store | Proof type: receipt", userId, now, now]
    );
    return result.lastID;
  } finally {
    await closeDb(database);
  }
}

async function insertAiJob(dataDir, proofId, status, options = {}) {
  const now = new Date().toISOString();
  const result = await updateTempUser(dataDir, `INSERT INTO ai_proof_jobs (proof_id, status, attempt_count, manual_requested, request_fingerprint, last_error, queued_at, started_at, completed_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`, [proofId, status, options.attemptCount || 0, `test-${proofId}`, options.lastError || null, now, options.started ? now : null, options.completed ? now : null, now]);
  return result.lastID;
}

async function insertZeroItemAnalysis(dataDir, proofId, jobId) {
  const now = new Date().toISOString();
  return updateTempUser(dataDir, `INSERT INTO ai_proof_analyses (job_id, proof_id, proof_type, detected_store_name, detected_store_confidence, submitted_store_id, source_date_confidence, overall_confidence, warnings_json, structured_json, item_count, ready_count, check_count, unknown_count, created_at, updated_at) VALUES (?, ?, 'receipt_photo', '', 'unknown', 1, 'unknown', 'unknown', '[]', '{"items":[]}', 0, 0, 0, 0, ?, ?)`, [jobId, proofId, now, now]);
}

async function insertLifecycleRow(dataDir, proofId, status = "needs_edit", itemName = "Lifecycle test item") {
  const now = new Date().toISOString();
  return updateTempUser(dataDir, `INSERT INTO price_import_rows (batch_id, store_id, item_name, category, price, quantity, unit, proof_type, status, created_at, updated_at) VALUES (?, 1, ?, 'other', 1.99, 1, 'each', 'receipt_photo', ?, ?, ?)`, [proofId, itemName, status, now, now]);
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

async function startServer() {
  const dataDir = tempDir("grocery-radar-operations-data-");
  const uploadsDir = tempDir("grocery-radar-operations-uploads-");
  await seedOwner(dataDir);
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
    EMAIL_TEST_MODE: "1",
    VERIFICATION_RESEND_COOLDOWN_SECONDS: "60",
    AI_TEST_RESPONSE_JSON: JSON.stringify({
      proof_id: 999999,
      proof_type: "receipt_photo",
      detected_store: "ALDI Janesville",
      detected_store_confidence: "high",
      source_date: "2026-07-04",
      source_date_confidence: "high",
      overall_confidence: "high",
      warnings: [],
      items: [
        { raw_text: "BANANAS 1.23 LB @ 0.59 0.73", normalized_name: "Bananas", quantity: 1.23, package_size: "1.23 lb", price: 0.73, category: "Produce", storage_type: "Fresh produce", price_type: "Regular", confidence: "high", field_confidences: { name: "high", price: "high" }, warnings: [] },
        { raw_text: "MILK 1 GAL 3.49", normalized_name: "Milk", quantity: 1, package_size: "1 gal", price: 3.49, category: "Dairy & Eggs", storage_type: "Refrigerated", price_type: "Regular", confidence: "high", field_confidences: { name: "high", price: "high" }, warnings: [] }
      ]
    }),
    AI_API_KEY: "test-only-key"
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
    output,
    child,
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
  const result = await client.post("/api/auth/register", {
    username: overrides.username,
    email: overrides.email,
    password,
    confirmPassword: password
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  return { ...result.body, password };
}

async function main() {
  const app = await startServer();

  try {
    const owner = new TestClient(app.baseUrl);
    const normal = new TestClient(app.baseUrl);

    const ownerLogin = await owner.post("/api/auth/login", {
      email: OWNER_EMAIL.toUpperCase(),
      password: OWNER_PASSWORD
    });
    assert.equal(ownerLogin.response.status, 200, JSON.stringify(ownerLogin.body));
    assert.equal(ownerLogin.body.user.username, OWNER_USERNAME);
    assert.equal(ownerLogin.body.user.is_super_admin, true);
    const normalRegistration = await register(normal, {
      username: "operationshopper",
      email: "operationshopper@example.invalid"
    });
    const reviewer = new TestClient(app.baseUrl);
    const reviewerRegistration = await register(reviewer, {
      username: "reviewworker",
      email: "reviewworker@example.invalid"
    });
    const dataEntry = new TestClient(app.baseUrl);
    const dataEntryRegistration = await register(dataEntry, {
      username: "dataworker",
      email: "dataworker@example.invalid"
    });

    const reviewerRole = await owner.post(`/api/admin/v2/workers/${reviewerRegistration.user.id}/role`, { role: "reviewer" });
    assert.equal(reviewerRole.response.status, 200, JSON.stringify(reviewerRole.body));
    const dataEntryRole = await owner.post(`/api/admin/v2/workers/${dataEntryRegistration.user.id}/role`, { role: "data_entry" });
    assert.equal(dataEntryRole.response.status, 200, JSON.stringify(dataEntryRole.body));

    await updateTempUser(app.dataDir, "INSERT OR IGNORE INTO stores (name, address, city, state, store_type, active, created_at) VALUES ('ALDI Janesville', 'Test Aldi', 'Janesville', 'WI', 'discount', 1, ?)", [new Date().toISOString()]);
    await updateTempUser(app.dataDir, "INSERT OR IGNORE INTO stores (name, address, city, state, store_type, active, created_at) VALUES ('Walmart Janesville', 'Test Walmart', 'Janesville', 'WI', 'grocery', 1, ?)", [new Date().toISOString()]);
    await updateTempUser(app.dataDir, "INSERT OR IGNORE INTO stores (name, address, city, state, store_type, active, created_at) VALUES ('Kwik Trip Janesville East', 'Test Kwik Trip', 'Janesville', 'WI', 'convenience', 1, ?)", [new Date().toISOString()]);
    const aldiStore = await queryTempDb(app.dataDir, "SELECT id FROM stores WHERE name = 'ALDI Janesville'");
    const walmartStore = await queryTempDb(app.dataDir, "SELECT id FROM stores WHERE name = 'Walmart Janesville'");
    const kwikTripStore = await queryTempDb(app.dataDir, "SELECT id FROM stores WHERE name = 'Kwik Trip Janesville East'");
    fs.writeFileSync(path.join(app.uploadsDir, "test-receipt.png"), Buffer.from("proof-isolation-test"));

    const aiSettings = await owner.post("/api/admin/operations/ai-settings", { enabled: true, manual_only: false, max_analyses_per_hour: 20, max_analyses_per_day: 100, retry_limit: 2, model: "test-model" });
    assert.equal(aiSettings.response.status, 200, JSON.stringify(aiSettings.body));
    const priorWalmartBatch = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Previous Walmart helper proof");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET default_store_id = ?, source_text = 'WALMART OLD HELPER TEXT' WHERE id = ?", [walmartStore.id, priorWalmartBatch]);
    await updateTempUser(app.dataDir, "INSERT INTO price_import_rows (batch_id, store_id, item_name, category, price, quantity, unit, proof_type, status, created_at, updated_at) VALUES (?, ?, 'Walmart old helper item', 'other', 9.99, 1, 'each', 'receipt_photo', 'ready_for_review', ?, ?)", [priorWalmartBatch, walmartStore.id, new Date().toISOString(), new Date().toISOString()]);
    const aiProofBatch = await insertProofBatch(app.dataDir, normalRegistration.user.id, "ALDI image submitted as Woodmans");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/claim`, {})).response.status, 200);
    const queuedAi = await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/re-run-ai`, { reason: "Proof isolation acceptance test" });
    assert.equal(queuedAi.response.status, 202, JSON.stringify(queuedAi.body));
    let aiReview = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      aiReview = result.body;
      if (["ready_for_review", "needs_attention"].includes(aiReview.ai?.job?.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(aiReview.ai.job.status, "ready_for_review", JSON.stringify(aiReview.ai));
    assert.equal(aiReview.ai.analysis.structured.proof_id, aiProofBatch);
    assert.equal(aiReview.ai.analysis.submitted_store_id, 1);
    assert.equal(aiReview.ai.analysis.detected_store_id, aldiStore.id);
    assert.equal(aiReview.ai.analysis.store_mismatch, true);
    assert.equal(aiReview.batch.rows.length, 2);
    assert.deepEqual(aiReview.batch.rows.map((row) => row.item_name), ["Bananas", "Milk"]);
    assert.equal(JSON.stringify(aiReview).includes("Walmart old helper item"), false);
    assert.ok(aiReview.batch.rows.every((row) => row.batch_id === aiProofBatch && row.ai_analysis_id === aiReview.ai.analysis.id));
    const useAldi = await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/store-resolution`, { action: "use_ai" });
    assert.equal(useAldi.response.status, 200, JSON.stringify(useAldi.body));
    const resolvedAiReview = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
    assert.ok(resolvedAiReview.body.batch.rows.every((row) => row.store_id === aldiStore.id));
    const priorReview = await reviewer.get(`/api/admin/v2/reviews/${priorWalmartBatch}`);
    assert.equal(priorReview.body.batch.rows.length, 1);
    assert.equal(priorReview.body.batch.rows[0].item_name, "Walmart old helper item");
    assert.equal(JSON.stringify(priorReview.body).includes("Bananas"), false);

    const analysisId = aiReview.ai.analysis.id;
    await updateTempUser(app.dataDir, "UPDATE ai_proof_analyses SET detected_store_name = 'unknown', detected_store_id = NULL, submitted_store_id = 1, resolved_store_id = NULL, store_resolution = '' WHERE id = ?", [analysisId]);
    await updateTempUser(app.dataDir, "UPDATE price_import_rows SET store_id = NULL WHERE batch_id = ?", [aiProofBatch]);
    const chooseAldiDespiteUnknown = await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/store-resolution`, { action: "choose_store", store_id: String(aldiStore.id) });
    assert.equal(chooseAldiDespiteUnknown.response.status, 200, JSON.stringify(chooseAldiDespiteUnknown.body));
    assert.equal(chooseAldiDespiteUnknown.body.resolved_store.id, aldiStore.id);
    assert.equal(chooseAldiDespiteUnknown.body.resolved_store.name, "ALDI Janesville");
    assert.equal(chooseAldiDespiteUnknown.body.submitted_store_id, 1);
    const persistedAldiResolution = await queryTempDb(app.dataDir, "SELECT submitted_store_id, resolved_store_id, store_resolution FROM ai_proof_analyses WHERE id = ?", [analysisId]);
    assert.equal(persistedAldiResolution.submitted_store_id, 1, "Original submitted Woodman's store must remain unchanged.");
    assert.equal(persistedAldiResolution.resolved_store_id, aldiStore.id);
    assert.equal(persistedAldiResolution.store_resolution, "choose_store");
    assert.equal((await queryTempDb(app.dataDir, "SELECT default_store_id FROM price_import_batches WHERE id = ?", [aiProofBatch])).default_store_id, 1);
    const reloadedAldiResolution = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
    assert.equal(reloadedAldiResolution.body.ai.analysis.resolved_store_id, aldiStore.id);
    assert.ok(reloadedAldiResolution.body.batch.rows.every((row) => row.store_id === aldiStore.id));
    await updateTempUser(app.dataDir, "UPDATE ai_proof_analyses SET detected_store_name = 'Kwik Trip / Kwik Star', detected_store_id = NULL, submitted_store_id = 1, resolved_store_id = NULL, store_resolution = '' WHERE id = ?", [analysisId]);
    await updateTempUser(app.dataDir, "UPDATE price_import_rows SET store_id = NULL WHERE batch_id = ?", [aiProofBatch]);
    const nowForFlagged = new Date().toISOString();
    await updateTempUser(app.dataDir, "INSERT INTO price_import_rows (batch_id, store_id, item_name, category, price, size_text, quantity, unit, proof_type, status, created_at, updated_at, ai_analysis_id, ai_item_index, ai_confidence, ai_warnings_json) VALUES (?, NULL, 'Promotional Buns', 'bakery', 0.99, '8 ct', 1, 'each', 'receipt_photo', 'needs_edit', ?, ?, ?, 2, 'check', '[\"Promotional terms visible\"]')", [aiProofBatch, nowForFlagged, nowForFlagged, analysisId]);
    await updateTempUser(app.dataDir, "INSERT INTO price_import_rows (batch_id, store_id, item_name, category, price, size_text, quantity, unit, proof_type, status, created_at, updated_at, ai_analysis_id, ai_item_index, ai_confidence, ai_warnings_json) VALUES (?, NULL, 'Unknown drink', 'drinks', 1.49, '1 ct', 1, 'each', 'receipt_photo', 'needs_edit', ?, ?, ?, 3, 'unknown', '[]')", [aiProofBatch, nowForFlagged, nowForFlagged, analysisId]);
    const kwikMismatch = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
    assert.equal(kwikMismatch.body.ai.analysis.detected_store_name, "Kwik Trip / Kwik Star");
    assert.equal(kwikMismatch.body.ai.analysis.detected_store_id, null);
    assert.equal(kwikMismatch.body.ai.analysis.submitted_store_id, 1);
    assert.equal(kwikMismatch.body.ai.analysis.resolved_store_id, null);
    assert.equal(kwikMismatch.body.ai.analysis.store_mismatch, true);
    assert.equal(kwikMismatch.body.ai.analysis.exact_store_match_found, false);
    assert.equal(kwikMismatch.body.approval_summary.ready, 2);
    assert.equal(kwikMismatch.body.approval_summary.flagged, 2);
    assert.ok(kwikMismatch.body.stores.some((store) => store.id === kwikTripStore.id));
    assert.equal(JSON.stringify(kwikMismatch.body).includes("Walmart old helper item"), false);
    const chooseKwik = await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/store-resolution`, { action: "choose_store", store_id: kwikTripStore.id });
    assert.equal(chooseKwik.response.status, 200, JSON.stringify(chooseKwik.body));
    const kwikResolved = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
    assert.ok(kwikResolved.body.batch.rows.every((row) => row.store_id === kwikTripStore.id));

    const attemptsBeforeDecisions = await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM ai_proof_attempts WHERE proof_id = ?", [aiProofBatch]);
    const blockedReadyApproval = await dataEntry.post(`/api/admin/v2/reviews/${aiProofBatch}/approve-ready`, {});
    assert.equal(blockedReadyApproval.response.status, 403);
    const approveReady = await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/approve-ready`, {});
    assert.equal(approveReady.response.status, 200, JSON.stringify(approveReady.body));
    assert.equal(approveReady.body.approved_count, 2);
    const afterReady = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
    const flaggedRows = afterReady.body.batch.rows.filter((row) => !["approved", "rejected", "removed"].includes(row.status));
    assert.equal(flaggedRows.length, 2);
    const rejectedFlagged = await reviewer.post(`/api/admin/price-import-rows/${flaggedRows[0].id}/reject`, { rejection_reason: "wrong price", admin_rejection_note: "Price is not legible enough." });
    assert.equal(rejectedFlagged.response.status, 200, JSON.stringify(rejectedFlagged.body));
    const afterSingleRejection = await reviewer.get(`/api/admin/v2/reviews/${aiProofBatch}`);
    assert.equal(afterSingleRejection.body.batch.rows.some((row) => row.id === flaggedRows[0].id), false, "Rejected rows must leave the active review list.");
    assert.equal(afterSingleRejection.body.completed_rows.some((row) => row.id === flaggedRows[0].id && row.status === "rejected"), true, "Rejected rows must remain available as completed history.");
    const rejectedRecord = await queryTempDb(app.dataDir, "SELECT rejection_reason, admin_rejection_note, rejected_by, rejected_at, price_report_id FROM price_import_rows WHERE id = ?", [flaggedRows[0].id]);
    assert.equal(rejectedRecord.rejection_reason, "wrong price");
    assert.equal(rejectedRecord.rejected_by, reviewerRegistration.user.id);
    assert.ok(rejectedRecord.rejected_at);
    assert.equal(rejectedRecord.price_report_id, null);
    const rejectionEvent = await queryTempDb(app.dataDir, "SELECT actor_user_id, reason FROM price_provenance_events WHERE import_row_id = ? AND event_type = 'REJECTED' ORDER BY id DESC LIMIT 1", [flaggedRows[0].id]);
    assert.equal(rejectionEvent.actor_user_id, reviewerRegistration.user.id);
    assert.equal(rejectionEvent.reason, "wrong price");
    const blockedRejectedPublish = await reviewer.post(`/api/admin/price-import-rows/${flaggedRows[0].id}/approve`, {});
    assert.equal(blockedRejectedPublish.response.status, 400);
    const editLastFlagged = await reviewer.post(`/api/admin/price-import-rows/${flaggedRows[1].id}`, { item_name: "Bottled drink", price: 1.49, size_text: "1 ct", category: "drinks", storage_condition: "refrigerated", store_id: kwikTripStore.id, status: "ready_for_review" });
    assert.equal(editLastFlagged.response.status, 200, JSON.stringify(editLastFlagged.body));
    const approveLastFlagged = await reviewer.post(`/api/admin/price-import-rows/${flaggedRows[1].id}/approve`, {});
    assert.equal(approveLastFlagged.response.status, 200, JSON.stringify(approveLastFlagged.body));
    assert.equal(approveLastFlagged.body.review_state.state, "READY_TO_FINISH", "The final row mutation must return authoritative ready-to-finish state without a workspace reload.");
    assert.equal(approveLastFlagged.body.review_state.unresolved_rows, 0);
    const decisionCounts = await queryTempDb(app.dataDir, "SELECT SUM(status = 'approved') AS approved, SUM(status = 'rejected') AS rejected FROM price_import_rows WHERE batch_id = ?", [aiProofBatch]);
    assert.equal(decisionCounts.approved, 3);
    assert.equal(decisionCounts.rejected, 1);
    const attemptsAfterDecisions = await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM ai_proof_attempts WHERE proof_id = ?", [aiProofBatch]);
    assert.equal(attemptsAfterDecisions.count, attemptsBeforeDecisions.count, "Editing, store selection, approval, rejection, and reload must not call AI.");
    const explicitRerun = await reviewer.post(`/api/admin/v2/reviews/${aiProofBatch}/re-run-ai`, { reason: "Explicit retry count test" });
    assert.equal(explicitRerun.response.status, 202, JSON.stringify(explicitRerun.body));
    let attemptsAfterRerun = attemptsAfterDecisions;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      attemptsAfterRerun = await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM ai_proof_attempts WHERE proof_id = ?", [aiProofBatch]);
      if (attemptsAfterRerun.count === attemptsAfterDecisions.count + 1) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(attemptsAfterRerun.count, attemptsAfterDecisions.count + 1, "Explicit Re-run AI must create exactly one authorized attempt.");

    const receiptUpload = new FormData();
    receiptUpload.append("proof_photos", new Blob([Buffer.from("receipt-first-image")], { type: "image/png" }), "receipt-first.png");
    receiptUpload.append("source_type", "receipt");
    receiptUpload.append("proof_type", "receipt_photo");
    receiptUpload.append("default_store_id", String(kwikTripStore.id));
    const receiptUploadResult = await owner.request("/api/admin/price-imports/upload", { method: "POST", body: receiptUpload });
    assert.equal(receiptUploadResult.response.status, 201, JSON.stringify(receiptUploadResult.body));
    assert.equal(receiptUploadResult.body.extraction_attempt.status, "waiting");
    const autoReceiptBatch = receiptUploadResult.body.batches[0].id;
    const weeklyUpload = new FormData();
    weeklyUpload.append("proof_photos", new Blob([Buffer.from("weekly-ad-image")], { type: "image/png" }), "weekly-ad.png");
    weeklyUpload.append("source_type", "weekly_ad");
    weeklyUpload.append("proof_type", "weekly_ad");
    weeklyUpload.append("default_store_id", String(kwikTripStore.id));
    const weeklyUploadResult = await owner.request("/api/admin/price-imports/upload", { method: "POST", body: weeklyUpload });
    assert.equal(weeklyUploadResult.response.status, 201, JSON.stringify(weeklyUploadResult.body));
    assert.equal(weeklyUploadResult.body.extraction_attempt.status, "manual_available");
    const manualWeeklyBatch = weeklyUploadResult.body.batches[0].id;
    assert.ok(await queryTempDb(app.dataDir, "SELECT id FROM ai_proof_jobs WHERE proof_id = ?", [autoReceiptBatch]));
    assert.equal(await queryTempDb(app.dataDir, "SELECT id FROM ai_proof_jobs WHERE proof_id = ?", [manualWeeklyBatch]), undefined);
    const manualOnlySettings = await owner.post("/api/admin/operations/ai-settings", { enabled: true, manual_only: true, max_analyses_per_hour: 20, max_analyses_per_day: 100, retry_limit: 2, primary_model: "test-primary-model", fallback_model: "test-fallback-model" });
    assert.equal(manualOnlySettings.response.status, 200, JSON.stringify(manualOnlySettings.body));
    assert.equal(manualOnlySettings.body.settings.primary_model, "test-primary-model");
    assert.equal(manualOnlySettings.body.settings.fallback_model, "test-fallback-model");
    const manualWeeklyAi = await reviewer.post(`/api/admin/v2/reviews/${manualWeeklyBatch}/re-run-ai`, { reason: "Manual non-receipt AI test" });
    assert.equal(manualWeeklyAi.response.status, 202, JSON.stringify(manualWeeklyAi.body));
    assert.ok(await queryTempDb(app.dataDir, "SELECT id FROM ai_proof_jobs WHERE proof_id = ?", [manualWeeklyBatch]));
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const manualAttempt = await queryTempDb(app.dataDir, "SELECT id FROM ai_proof_attempts WHERE proof_id = ?", [manualWeeklyBatch]);
      if (manualAttempt) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(await queryTempDb(app.dataDir, "SELECT id FROM ai_proof_attempts WHERE proof_id = ?", [manualWeeklyBatch]), "Explicit Run AI must work while automatic processing is in manual-only mode.");
    await owner.post("/api/admin/operations/ai-settings", { enabled: true, manual_only: false, max_analyses_per_hour: 20, max_analyses_per_day: 100, retry_limit: 2, primary_model: "test-model", fallback_model: "" });

    const catalogProductResult = await updateTempUser(app.dataDir, "INSERT INTO products (canonical_name, display_name, category, status, created_at, updated_at) VALUES ('catalog duplicate bread', 'Catalog Duplicate Bread', 'bakery', 'active', ?, ?)", [new Date().toISOString(), new Date().toISOString()]);
    const catalog = await owner.post("/api/admin/catalog-imports", { title: "Three product acceptance catalog", rows: [
      { product_name: "Catalog Alpha Milk", brand: "Test Brand", variant: "2%", size: "1 gal", category: "Dairy & Eggs", image_filename: "alpha-milk.png" },
      { product_name: "Catalog Beta Bananas", size: "per lb", category: "Produce", image_filename: "beta-bananas.png" },
      { product_name: "Catalog Duplicate Bread", size: "20 oz", category: "Bakery" }
    ] });
    assert.equal(catalog.response.status, 201, JSON.stringify(catalog.body));
    assert.equal(catalog.body.batch.rows.length, 3);
    assert.ok(catalog.body.batch.rows.every((row) => row.status === "draft"));
    assert.equal(catalog.body.batch.rows[0].category, "dairy");
    assert.equal(catalog.body.batch.rows[1].category, "produce");
    assert.equal(catalog.body.batch.rows[2].duplicate_product_id, catalogProductResult.lastID);
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: { r: 40, g: 150, b: 90 } } }).png().toBuffer();
    const catalogImagesForm = new FormData();
    catalogImagesForm.append("images", new Blob([png], { type: "image/png" }), "alpha-milk.png");
    catalogImagesForm.append("images", new Blob([png], { type: "image/png" }), "beta-bananas.png");
    catalogImagesForm.append("images", new Blob([png], { type: "image/png" }), "catalog-duplicate-bread-photo.png");
    const catalogImages = await owner.request(`/api/admin/catalog-imports/${catalog.body.batch.id}/images`, { method: "POST", body: catalogImagesForm });
    assert.equal(catalogImages.response.status, 201, JSON.stringify(catalogImages.body));
    assert.equal(catalogImages.body.batch.images.length, 3);
    assert.equal(catalogImages.body.batch.rows[0].image_match_confidence, "high");
    assert.equal(catalogImages.body.batch.rows[1].image_match_confidence, "high");
    assert.equal(catalogImages.body.batch.rows[2].image_match_confidence, "check");
    assert.equal((await normal.get("/api/products?q=Catalog%20Alpha%20Milk")).body.products.length, 0, "Draft catalog products must not be public.");
    const blockedCatalog = await dataEntry.post("/api/admin/catalog-imports", { rows: [{ product_name: "Blocked Product" }] });
    assert.equal(blockedCatalog.response.status, 403);
    const blockedPublicCatalog = await normal.post("/api/admin/catalog-imports", { rows: [{ product_name: "Impersonated Product" }] });
    assert.equal(blockedPublicCatalog.response.status, 403);
    const blockedReviewerAiSettings = await reviewer.post("/api/admin/operations/ai-settings", { enabled: false });
    assert.equal(blockedReviewerAiSettings.response.status, 403);
    const publishCatalog = await owner.post(`/api/admin/catalog-imports/${catalog.body.batch.id}/publish`, {});
    assert.equal(publishCatalog.response.status, 200, JSON.stringify(publishCatalog.body));
    assert.equal(publishCatalog.body.product_ids.length, 2, "The duplicate row must remain a draft unless explicitly overridden.");
    const publicImported = await normal.get("/api/products?q=Catalog%20Alpha%20Milk");
    assert.equal(publicImported.body.products.length, 1);
    assert.match(publicImported.body.products[0].image_url, /\/api\/product-images\//);

    const productImageForm = new FormData();
    productImageForm.append("product_image", new Blob([png], { type: "image/png" }), "catalog-bread.png");
    productImageForm.append("alt_text", "Catalog Duplicate Bread package");
    const productImage = await owner.request(`/api/admin/products/${catalogProductResult.lastID}/images`, { method: "POST", body: productImageForm });
    assert.equal(productImage.response.status, 201, JSON.stringify(productImage.body));
    assert.equal(productImage.body.image.status, "draft");
    const beforeImageApproval = await normal.get(`/api/products/${catalogProductResult.lastID}`);
    assert.equal(beforeImageApproval.body.product.image_url, "");
    const approveImage = await owner.post(`/api/admin/product-images/${productImage.body.image.id}/moderate`, { status: "approved", is_primary: true, alt_text: "Catalog Duplicate Bread package" });
    assert.equal(approveImage.response.status, 200, JSON.stringify(approveImage.body));
    const afterImageApproval = await normal.get(`/api/products/${catalogProductResult.lastID}`);
    assert.match(afterImageApproval.body.product.image_url, /\/api\/product-images\//);
    assert.equal(afterImageApproval.body.product.image_alt_text, "Catalog Duplicate Bread package");
    const publicImage = await normal.get(afterImageApproval.body.product.image_url);
    assert.equal(publicImage.response.status, 200);
    const blockedReviewerImage = await reviewer.request(`/api/admin/products/${catalogProductResult.lastID}/images`, { method: "POST", body: productImageForm });
    assert.equal(blockedReviewerImage.response.status, 403, "Reviewers cannot manage arbitrary product images.");
    const productToolsAfterImage = await owner.get("/api/admin/product-tools");
    const imageManagedProduct = productToolsAfterImage.body.products.find((product) => product.id === catalogProductResult.lastID);
    assert.ok(imageManagedProduct.images.some((image) => image.id === productImage.body.image.id && image.is_primary));
    assert.equal(imageManagedProduct.primary_image.id, productImage.body.image.id);
    assert.equal(imageManagedProduct.missing_primary_image, false);

    const ownerHome = await owner.get("/api/admin/v2/home");
    assert.equal(ownerHome.response.status, 200, JSON.stringify(ownerHome.body));
    assert.equal(ownerHome.body.role, "owner");
    assert.equal(ownerHome.body.system.database, "Reachable");
    const blockedUserHome = await normal.get("/api/admin/v2/home");
    assert.equal(blockedUserHome.response.status, 403);
    const reviewerHome = await reviewer.get("/api/admin/v2/home");
    assert.equal(reviewerHome.response.status, 200, JSON.stringify(reviewerHome.body));
    assert.equal(reviewerHome.body.role, "reviewer");
    const blockedReviewerWorkers = await reviewer.get("/api/admin/v2/workers");
    assert.equal(blockedReviewerWorkers.response.status, 403);
    const blockedDataEntryOperations = await dataEntry.get("/api/admin/operations/overview");
    assert.equal(blockedDataEntryOperations.response.status, 403);

    const reviewBatchId = await insertProofBatch(app.dataDir, normalRegistration.user.id);
    const reviewerInbox = await reviewer.get("/api/admin/v2/inbox");
    assert.equal(reviewerInbox.response.status, 200, JSON.stringify(reviewerInbox.body));
    assert.ok(reviewerInbox.body.items.some((item) => item.target_id === reviewBatchId));
    const firstClaim = await reviewer.post(`/api/admin/v2/reviews/${reviewBatchId}/claim`, {});
    assert.equal(firstClaim.response.status, 200, JSON.stringify(firstClaim.body));
    const conflictingClaim = await owner.post(`/api/admin/v2/reviews/${reviewBatchId}/claim`, {});
    assert.equal(conflictingClaim.response.status, 409);

    const staleClaimId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Expired claim compatibility proof");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET review_claimed_by = ?, review_claimed_at = '2000-01-01T00:00:00.000Z', review_claim_expires_at = '2000-01-01T00:15:00.000Z', review_status = 'in_review' WHERE id = ?", [ownerLogin.body.user.id, staleClaimId]);
    const reclaimedAfterExpiry = await reviewer.post(`/api/admin/v2/reviews/${staleClaimId}/claim`, {});
    assert.equal(reclaimedAfterExpiry.response.status, 200, JSON.stringify(reclaimedAfterExpiry.body));
    const renewedClaim = await queryTempDb(app.dataDir, "SELECT review_claimed_by, review_status, review_claim_expires_at FROM price_import_batches WHERE id = ?", [staleClaimId]);
    assert.equal(renewedClaim.review_claimed_by, reviewerRegistration.user.id);
    assert.equal(renewedClaim.review_status, "in_review");
    assert.ok(renewedClaim.review_claim_expires_at > new Date().toISOString());

    const reviewLaterFirstId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Review Later proof one");
    const reviewLaterSecondId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Review Later proof two");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET created_at = CASE id WHEN ? THEN '2000-01-01T00:00:00.000Z' WHEN ? THEN '2000-01-02T00:00:00.000Z' ELSE created_at END WHERE id IN (?, ?)", [reviewLaterFirstId, reviewLaterSecondId, reviewLaterFirstId, reviewLaterSecondId]);
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${reviewLaterFirstId}/claim`, {})).response.status, 200);
    const reviewLater = await reviewer.post(`/api/admin/v2/reviews/${reviewLaterFirstId}/review-later`, {});
    assert.equal(reviewLater.response.status, 200, JSON.stringify(reviewLater.body));
    const releasedForLater = await queryTempDb(app.dataDir, "SELECT review_status, review_claimed_by, review_claimed_at, review_claim_expires_at FROM price_import_batches WHERE id = ?", [reviewLaterFirstId]);
    assert.equal(releasedForLater.review_status, "waiting");
    assert.equal(releasedForLater.review_claimed_by, null);
    assert.equal(releasedForLater.review_claimed_at, null);
    assert.equal(releasedForLater.review_claim_expires_at, null);
    const nextAfterLater = await reviewer.get(`/api/admin/v2/reviews/next?exclude_proof_id=${reviewLaterFirstId}`);
    assert.equal(nextAfterLater.response.status, 200, JSON.stringify(nextAfterLater.body));
    assert.notEqual(nextAfterLater.body.proof_id, reviewLaterFirstId, "The real next-proof SQL must never return the excluded current proof.");
    assert.equal(nextAfterLater.body.proof_id, reviewLaterSecondId, "After leaving the oldest proof, the next eligible proof should be selected.");

    const canonicalNotStartedId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Canonical AI not started");
    const canonicalNotStarted = await reviewer.get(`/api/admin/v2/reviews/${canonicalNotStartedId}`);
    assert.equal(canonicalNotStarted.body.review_state.state, "AI_NOT_STARTED");
    assert.equal(canonicalNotStarted.body.review_state.ai_started, false);
    assert.equal(canonicalNotStarted.body.review_state.total_rows, 0);
    assert.equal(canonicalNotStarted.body.review_state.can_finish, false);
    assert.equal(canonicalNotStarted.body.review_state.message, "No analysis yet.");

    const canonicalQueuedId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Canonical AI queued");
    await insertAiJob(app.dataDir, canonicalQueuedId, "waiting");
    assert.equal((await reviewer.get(`/api/admin/v2/reviews/${canonicalQueuedId}`)).body.review_state.state, "AI_QUEUED");
    await updateTempUser(app.dataDir, "UPDATE ai_proof_jobs SET status = 'analyzing', started_at = ?, updated_at = ? WHERE proof_id = ?", [new Date().toISOString(), new Date().toISOString(), canonicalQueuedId]);
    assert.equal((await reviewer.get(`/api/admin/v2/reviews/${canonicalQueuedId}`)).body.review_state.state, "AI_RUNNING");

    const canonicalFailedId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Canonical AI failed");
    await insertAiJob(app.dataDir, canonicalFailedId, "ai_failed", { started: true, completed: true, attemptCount: 1, lastError: "Unreadable test proof" });
    const canonicalFailed = await reviewer.get(`/api/admin/v2/reviews/${canonicalFailedId}`);
    assert.equal(canonicalFailed.body.review_state.state, "AI_FAILED");
    assert.match(canonicalFailed.body.review_state.message, /Unreadable test proof/);

    const canonicalZeroId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Canonical AI zero results");
    const canonicalZeroJobId = await insertAiJob(app.dataDir, canonicalZeroId, "needs_attention", { started: true, completed: true, attemptCount: 1 });
    await insertZeroItemAnalysis(app.dataDir, canonicalZeroId, canonicalZeroJobId);
    const canonicalZero = await reviewer.get(`/api/admin/v2/reviews/${canonicalZeroId}`);
    assert.equal(canonicalZero.body.review_state.state, "AI_ZERO_RESULTS");
    assert.equal(canonicalZero.body.review_state.ai_finished, true);
    assert.match(canonicalZero.body.review_state.message, /no usable price items/i);
    assert.notEqual(canonicalZero.body.review_state.state, canonicalNotStarted.body.review_state.state);

    const canonicalReviewingId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Canonical reviewing");
    await insertLifecycleRow(app.dataDir, canonicalReviewingId, "needs_edit");
    const canonicalReviewing = await reviewer.get(`/api/admin/v2/reviews/${canonicalReviewingId}`);
    assert.equal(canonicalReviewing.body.review_state.state, "REVIEWING");
    assert.equal(canonicalReviewing.body.review_state.unresolved_rows, 1);

    const canonicalHelpId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Canonical manager help");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET review_status = 'needs_help', review_escalated_at = ?, review_escalation_reason = 'Manager test' WHERE id = ?", [new Date().toISOString(), canonicalHelpId]);
    assert.equal((await reviewer.get(`/api/admin/v2/reviews/${canonicalHelpId}`)).body.review_state.state, "MANAGER_HELP");
    const canonicalInbox = await reviewer.get("/api/admin/v2/inbox");
    assert.equal(canonicalInbox.body.items.find((item) => item.target_id === canonicalNotStartedId).status, "AI not started");
    assert.equal(canonicalInbox.body.items.find((item) => item.target_id === canonicalZeroId).status, "No usable items found");
    assert.equal(canonicalInbox.body.items.find((item) => item.target_id === canonicalHelpId).status, "Manager help");

    const reviewerManagerDecisionBlocked = await reviewer.post(`/api/admin/v2/reviews/${canonicalHelpId}/manager-decision`, { decision: "return_to_review" });
    assert.equal(reviewerManagerDecisionBlocked.response.status, 403, "Only Owner/Manager may resolve Manager Help.");
    assert.equal((await owner.post(`/api/admin/v2/reviews/${canonicalHelpId}/claim`, {})).response.status, 200);
    const returnedToReview = await owner.post(`/api/admin/v2/reviews/${canonicalHelpId}/manager-decision`, { decision: "return_to_review" });
    assert.equal(returnedToReview.response.status, 200, JSON.stringify(returnedToReview.body));
    assert.equal(returnedToReview.body.terminal, false);
    assert.notEqual(returnedToReview.body.review_state.state, "MANAGER_HELP");
    const returnedBatch = await queryTempDb(app.dataDir, "SELECT review_status, review_escalated_at, review_escalation_reason, review_claimed_by FROM price_import_batches WHERE id = ?", [canonicalHelpId]);
    assert.equal(returnedBatch.review_escalated_at, null);
    assert.equal(returnedBatch.review_escalation_reason, "");
    assert.equal(returnedBatch.review_claimed_by, ownerLogin.body.user.id, "Return to Review keeps the manager's active claim.");
    assert.equal((await owner.post(`/api/admin/v2/reviews/${canonicalHelpId}/review-later`, {})).response.status, 200);

    const duplicateSourceId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Original duplicate source");
    const managerDuplicateId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Manager duplicate terminal regression");
    const duplicateHash = "duplicate-terminal-regression-hash";
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET review_status = 'needs_help', review_escalated_at = ?, review_escalation_reason = 'Possible duplicate receipt', proof_file_hash = ?, duplicate_of_batch_id = ?, duplicate_scope = 'same_user_duplicate' WHERE id = ?", [new Date().toISOString(), duplicateHash, duplicateSourceId, managerDuplicateId]);
    await insertLifecycleRow(app.dataDir, managerDuplicateId, "needs_edit", "Duplicate draft item");
    assert.equal((await owner.post(`/api/admin/v2/reviews/${managerDuplicateId}/claim`, {})).response.status, 200);
    assert.equal((await owner.get(`/api/admin/v2/reviews/${managerDuplicateId}`)).body.review_state.state, "MANAGER_HELP");
    const duplicateDecision = await owner.post(`/api/admin/v2/reviews/${managerDuplicateId}/manager-decision`, { decision: "duplicate", note: "Matched retained source proof." });
    assert.equal(duplicateDecision.response.status, 200, JSON.stringify(duplicateDecision.body));
    assert.equal(duplicateDecision.body.terminal, true);
    assert.equal(duplicateDecision.body.message, "Marked duplicate ✓");
    const terminalDuplicate = await queryTempDb(app.dataDir, "SELECT status, review_status, review_decision, review_claimed_by, review_claimed_at, review_claim_expires_at, review_completed_at, proof_file_hash, duplicate_of_batch_id FROM price_import_batches WHERE id = ?", [managerDuplicateId]);
    assert.equal(terminalDuplicate.status, "duplicate");
    assert.equal(terminalDuplicate.review_status, "completed");
    assert.equal(terminalDuplicate.review_decision, "duplicate");
    assert.equal(terminalDuplicate.review_claimed_by, null);
    assert.equal(terminalDuplicate.review_claimed_at, null);
    assert.equal(terminalDuplicate.review_claim_expires_at, null);
    assert.ok(terminalDuplicate.review_completed_at);
    assert.equal(terminalDuplicate.proof_file_hash, duplicateHash, "Duplicate closure must retain the proof hash.");
    assert.equal(terminalDuplicate.duplicate_of_batch_id, duplicateSourceId, "Duplicate closure must retain its source relationship.");
    assert.equal((await queryTempDb(app.dataDir, "SELECT status FROM price_import_rows WHERE batch_id = ?", [managerDuplicateId])).status, "rejected");
    assert.equal((await owner.get("/api/admin/v2/inbox")).body.items.some((item) => item.target_id === managerDuplicateId), false);
    assert.notEqual((await owner.get(`/api/admin/v2/reviews/next?exclude_proof_id=${managerDuplicateId}`)).body.proof_id, managerDuplicateId);
    const duplicateOutcome = await queryTempDb(app.dataDir, "SELECT outcome_type, public_summary_json FROM submission_outcomes WHERE proof_id = ?", [managerDuplicateId]);
    assert.equal(duplicateOutcome.outcome_type, "duplicate");
    assert.equal(JSON.parse(duplicateOutcome.public_summary_json).public_reason, "duplicate submission");
    assert.equal(JSON.parse(duplicateOutcome.public_summary_json).public_explanation, "This proof was already submitted.");
    assert.equal((await owner.post(`/api/admin/v2/reviews/${managerDuplicateId}/manager-decision`, { decision: "duplicate" })).response.status, 200, "Duplicate finalization must be idempotent.");
    assert.equal((await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM submission_outcomes WHERE proof_id = ?", [managerDuplicateId])).count, 1);

    const zeroUsableProofId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Manager confirms zero usable prices");
    const zeroUsableJobId = await insertAiJob(app.dataDir, zeroUsableProofId, "needs_attention", { started: true, completed: true, attemptCount: 1 });
    await insertZeroItemAnalysis(app.dataDir, zeroUsableProofId, zeroUsableJobId);
    assert.equal((await owner.post(`/api/admin/v2/reviews/${zeroUsableProofId}/claim`, {})).response.status, 200);
    assert.equal((await owner.get(`/api/admin/v2/reviews/${zeroUsableProofId}`)).body.review_state.state, "AI_ZERO_RESULTS");
    const noUsableDecision = await owner.post(`/api/admin/v2/reviews/${zeroUsableProofId}/manager-decision`, { decision: "no_usable_prices" });
    assert.equal(noUsableDecision.response.status, 200, JSON.stringify(noUsableDecision.body));
    const zeroUsableTerminal = await queryTempDb(app.dataDir, "SELECT status, review_status, review_claimed_by, review_completed_at FROM price_import_batches WHERE id = ?", [zeroUsableProofId]);
    assert.equal(zeroUsableTerminal.status, "reviewed_no_prices");
    assert.equal(zeroUsableTerminal.review_status, "completed");
    assert.equal(zeroUsableTerminal.review_claimed_by, null);
    assert.ok(zeroUsableTerminal.review_completed_at);
    assert.equal((await owner.get("/api/admin/v2/inbox")).body.items.some((item) => item.target_id === zeroUsableProofId), false);

    const cantReadProofId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Can't Read terminal regression");
    await insertLifecycleRow(app.dataDir, cantReadProofId, "needs_edit", "Unreadable item");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${cantReadProofId}/claim`, {})).response.status, 200);
    const cantReadClosed = await reviewer.post(`/api/admin/v2/reviews/${cantReadProofId}/reject`, { reason: "proof too blurry", public_explanation: "The proof could not be read clearly enough to verify prices." });
    assert.equal(cantReadClosed.response.status, 200, JSON.stringify(cantReadClosed.body));
    const cantReadTerminal = await queryTempDb(app.dataDir, "SELECT status, review_claimed_by, review_completed_at FROM price_import_batches WHERE id = ?", [cantReadProofId]);
    assert.equal(cantReadTerminal.status, "proof_rejected");
    assert.equal(cantReadTerminal.review_claimed_by, null);
    assert.ok(cantReadTerminal.review_completed_at);
    assert.equal((await reviewer.get("/api/admin/v2/inbox")).body.items.some((item) => item.target_id === cantReadProofId), false);

    const doneReviewingId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Done Reviewing summary regression");
    await insertLifecycleRow(app.dataDir, doneReviewingId, "approved", "Approved item one");
    await insertLifecycleRow(app.dataDir, doneReviewingId, "approved", "Approved item two");
    await insertLifecycleRow(app.dataDir, doneReviewingId, "rejected", "Rejected item");
    assert.equal((await owner.post(`/api/admin/v2/reviews/${doneReviewingId}/claim`, {})).response.status, 200);
    const doneReady = await owner.get(`/api/admin/v2/reviews/${doneReviewingId}`);
    assert.equal(doneReady.body.review_state.state, "READY_TO_FINISH");
    assert.equal(doneReady.body.review_state.approved_rows, 2);
    assert.equal(doneReady.body.review_state.not_approved_rows, 1);
    const doneResult = await owner.post(`/api/admin/v2/reviews/${doneReviewingId}/complete`, {});
    assert.equal(doneResult.response.status, 200, JSON.stringify(doneResult.body));
    const doneTerminal = await queryTempDb(app.dataDir, "SELECT status, review_status, review_claimed_by, review_completed_at FROM price_import_batches WHERE id = ?", [doneReviewingId]);
    assert.equal(doneTerminal.status, "used_for_prices");
    assert.equal(doneTerminal.review_status, "completed");
    assert.equal(doneTerminal.review_claimed_by, null);
    assert.ok(doneTerminal.review_completed_at);
    assert.equal((await owner.get("/api/admin/v2/inbox")).body.items.some((item) => item.target_id === doneReviewingId), false);
    assert.equal((await queryTempDb(app.dataDir, "SELECT approved_count, rejected_count FROM submission_outcomes WHERE proof_id = ?", [doneReviewingId])).approved_count, 2);

    const rejectionCases = [];
    const rejectNotStarted = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state AI not started");
    rejectionCases.push([rejectNotStarted, "AI_NOT_STARTED"]);
    const rejectQueued = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state AI queued");
    await insertAiJob(app.dataDir, rejectQueued, "waiting");
    rejectionCases.push([rejectQueued, "AI_QUEUED"]);
    const rejectRunning = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state AI running");
    await insertAiJob(app.dataDir, rejectRunning, "analyzing", { started: true, attemptCount: 1 });
    rejectionCases.push([rejectRunning, "AI_RUNNING"]);
    const rejectFailed = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state AI failed");
    await insertAiJob(app.dataDir, rejectFailed, "ai_failed", { started: true, completed: true, attemptCount: 1, lastError: "Failure test" });
    rejectionCases.push([rejectFailed, "AI_FAILED"]);
    const rejectZero = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state AI zero");
    const rejectZeroJob = await insertAiJob(app.dataDir, rejectZero, "needs_attention", { started: true, completed: true, attemptCount: 1 });
    await insertZeroItemAnalysis(app.dataDir, rejectZero, rejectZeroJob);
    rejectionCases.push([rejectZero, "AI_ZERO_RESULTS"]);
    const rejectReviewing = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state reviewing");
    await insertLifecycleRow(app.dataDir, rejectReviewing, "needs_edit");
    rejectionCases.push([rejectReviewing, "REVIEWING"]);
    const rejectPartial = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state partial");
    await insertLifecycleRow(app.dataDir, rejectPartial, "rejected", "Resolved item");
    await insertLifecycleRow(app.dataDir, rejectPartial, "needs_edit", "Unresolved item");
    rejectionCases.push([rejectPartial, "REVIEWING"]);
    const rejectReady = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state ready to finish");
    await insertLifecycleRow(app.dataDir, rejectReady, "rejected");
    rejectionCases.push([rejectReady, "READY_TO_FINISH"]);
    const rejectLegacy = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Reject state legacy zero draft");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET review_status = 'in_review', review_decision = 'completed', review_completed_at = ? WHERE id = ?", [new Date().toISOString(), rejectLegacy]);
    rejectionCases.push([rejectLegacy, "AI_NOT_STARTED"]);

    for (const [proofId, expectedState] of rejectionCases) {
      assert.equal((await reviewer.post(`/api/admin/v2/reviews/${proofId}/claim`, {})).response.status, 200, `Claim failed for ${expectedState}`);
      const beforeReject = await reviewer.get(`/api/admin/v2/reviews/${proofId}`);
      assert.equal(beforeReject.body.review_state.state, expectedState, JSON.stringify(beforeReject.body.review_state));
      const rejected = await reviewer.post(`/api/admin/v2/reviews/${proofId}/reject`, { reason: "invalid proof", note: `Rejected from ${expectedState}` });
      assert.equal(rejected.response.status, 200, JSON.stringify(rejected.body));
      assert.equal(rejected.body.review_state.state, "REJECTED");
      const terminal = await queryTempDb(app.dataDir, "SELECT status, review_status, review_decision, review_claimed_by, review_claimed_at, review_claim_expires_at, review_completed_at FROM price_import_batches WHERE id = ?", [proofId]);
      assert.equal(terminal.status, "proof_rejected");
      assert.equal(terminal.review_status, "rejected");
      assert.equal(terminal.review_decision, "rejected");
      assert.equal(terminal.review_claimed_by, null);
      assert.equal(terminal.review_claimed_at, null);
      assert.equal(terminal.review_claim_expires_at, null);
      assert.ok(terminal.review_completed_at);
      assert.equal((await reviewer.get("/api/admin/v2/inbox")).body.items.some((item) => item.target_id === proofId), false);
      assert.notEqual((await reviewer.get(`/api/admin/v2/reviews/next?exclude_proof_id=${proofId}`)).body.proof_id, proofId);
    }

    const rejectProofBatchId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Proof rejection close test");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${rejectProofBatchId}/claim`, {})).response.status, 200);
    const zeroDraftReview = await reviewer.get(`/api/admin/v2/reviews/${rejectProofBatchId}`);
    assert.equal(zeroDraftReview.body.review_state.state, "AI_NOT_STARTED");
    assert.equal(zeroDraftReview.body.review_state.message, "No analysis yet.");
    assert.equal(zeroDraftReview.body.review_lifecycle.can_finish, false);
    const blockedEmptyCompletion = await reviewer.post(`/api/admin/v2/reviews/${rejectProofBatchId}/complete`, {});
    assert.equal(blockedEmptyCompletion.response.status, 409, "A zero-draft proof must require rejection, escalation, or manual entry.");
    const rejectedProof = await reviewer.post(`/api/admin/v2/reviews/${rejectProofBatchId}/reject`, { reason: "proof unreadable", note: "The lower half cannot be verified." });
    assert.equal(rejectedProof.response.status, 200, JSON.stringify(rejectedProof.body));
    const closedProof = await queryTempDb(app.dataDir, "SELECT status, review_status, review_decision, review_claimed_by, review_completed_at FROM price_import_batches WHERE id = ?", [rejectProofBatchId]);
    assert.equal(closedProof.status, "proof_rejected");
    assert.equal(closedProof.review_decision, "rejected");
    assert.equal(closedProof.review_claimed_by, null);
    assert.ok(closedProof.review_completed_at);
    const closedRows = await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM price_import_rows WHERE batch_id = ? AND status != 'rejected'", [rejectProofBatchId]);
    assert.equal(closedRows.count, 0);
    const inboxAfterProofRejection = await reviewer.get("/api/admin/v2/inbox");
    assert.equal(inboxAfterProofRejection.body.items.some((item) => item.target_id === rejectProofBatchId), false, "Rejected proof must leave the Inbox.");

    const completedProofBatchId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Zero unresolved completion test");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${completedProofBatchId}/claim`, {})).response.status, 200);
    const completedProofRows = await reviewer.post(`/api/admin/price-imports/${completedProofBatchId}/parse-price-text`, { source_text: "Bananas | 1 lb | 0.49\nMilk | 1 gal | 3.49" });
    assert.equal(completedProofRows.response.status, 201, JSON.stringify(completedProofRows.body));
    for (const row of completedProofRows.body.rows) {
      const rejectedRow = await reviewer.post(`/api/admin/price-import-rows/${row.id}/reject`, { rejection_reason: "not enough evidence", admin_rejection_note: "Lifecycle completion test." });
      assert.equal(rejectedRow.response.status, 200, JSON.stringify(rejectedRow.body));
    }
    const readyToFinishReview = await reviewer.get(`/api/admin/v2/reviews/${completedProofBatchId}`);
    assert.equal(readyToFinishReview.body.review_state.state, "READY_TO_FINISH");
    assert.equal(readyToFinishReview.body.review_lifecycle.unresolved_rows, 0);
    assert.equal(readyToFinishReview.body.review_lifecycle.can_finish, true);
    const readyToFinishBatch = await queryTempDb(app.dataDir, "SELECT review_status, review_decision, review_claimed_by, review_completed_at FROM price_import_batches WHERE id = ?", [completedProofBatchId]);
    assert.equal(readyToFinishBatch.review_status, "ready_to_finish");
    assert.equal(readyToFinishBatch.review_decision, "ready_to_finish");
    assert.equal(readyToFinishBatch.review_claimed_by, reviewerRegistration.user.id, "Resolving the last row must not silently release the active reviewer.");
    assert.equal(readyToFinishBatch.review_completed_at, null, "Row resolution alone must not falsely finalize the proof.");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET review_status = 'in_review', review_decision = 'completed', review_completed_at = ? WHERE id = ?", [new Date().toISOString(), completedProofBatchId]);
    const legacyZeroUnresolved = await reviewer.get(`/api/admin/v2/reviews/${completedProofBatchId}`);
    assert.equal(legacyZeroUnresolved.body.review_state.state, "READY_TO_FINISH", "Proofs left in the old row-completed state must remain finishable after this hotfix.");
    assert.equal(legacyZeroUnresolved.body.review_lifecycle.can_finish, true);
    const completedProof = await reviewer.post(`/api/admin/v2/reviews/${completedProofBatchId}/complete`, {});
    assert.equal(completedProof.response.status, 200, JSON.stringify(completedProof.body));
    assert.equal(completedProof.body.state, "COMPLETED");
    assert.equal(completedProof.body.status, "reviewed_no_prices");
    const finalizedProof = await queryTempDb(app.dataDir, "SELECT status, review_status, review_decision, review_claimed_by, review_claimed_at, review_claim_expires_at, review_completed_at FROM price_import_batches WHERE id = ?", [completedProofBatchId]);
    assert.equal(finalizedProof.status, "reviewed_no_prices");
    assert.equal(finalizedProof.review_status, "completed");
    assert.equal(finalizedProof.review_decision, "completed");
    assert.equal(finalizedProof.review_claimed_by, null);
    assert.equal(finalizedProof.review_claimed_at, null);
    assert.equal(finalizedProof.review_claim_expires_at, null);
    assert.ok(finalizedProof.review_completed_at);
    const inboxAfterCompletion = await reviewer.get("/api/admin/v2/inbox");
    assert.equal(inboxAfterCompletion.body.items.some((item) => item.target_id === completedProofBatchId), false, "Completed proof must leave the active Inbox.");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${completedProofBatchId}/claim`, {})).response.status, 409, "A completed proof must not be reclaimed by Review Next.");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${completedProofBatchId}/review-later`, {})).response.status, 409, "Review Later must not reopen a completed proof.");
    assert.equal((await owner.post(`/api/admin/v2/reviews/${completedProofBatchId}/reassign`, { user_id: reviewerRegistration.user.id })).response.status, 409, "A completed proof must not be reassigned.");
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${completedProofBatchId}/escalate`, { reason: "Invalid terminal transition test" })).response.status, 409, "A completed proof must not be escalated.");
    const stillFinalizedProof = await queryTempDb(app.dataDir, "SELECT status, review_status, review_claimed_by FROM price_import_batches WHERE id = ?", [completedProofBatchId]);
    assert.equal(stillFinalizedProof.status, "reviewed_no_prices");
    assert.equal(stillFinalizedProof.review_status, "completed");
    assert.equal(stillFinalizedProof.review_claimed_by, null);
    const nextWaitingProofId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Next proof after completion");
    const nextInbox = await reviewer.get("/api/admin/v2/inbox");
    assert.ok(nextInbox.body.items.some((item) => item.target_id === nextWaitingProofId), "The next waiting proof must remain selectable.");
    assert.equal(nextInbox.body.items.some((item) => item.target_id === completedProofBatchId), false);

    const legacyTerminalActionId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Legacy terminal action guard");
    const legacyTerminalAction = await owner.post(`/api/admin/proof-submissions/${legacyTerminalActionId}/status`, { action: "reviewed_no_prices" });
    assert.equal(legacyTerminalAction.response.status, 409, "The legacy importer must not bypass canonical finish/reject transitions.");
    assert.equal((await queryTempDb(app.dataDir, "SELECT status FROM price_import_batches WHERE id = ?", [legacyTerminalActionId])).status, "needs_admin_review");

    const aiDrafts = await dataEntry.post(`/api/admin/price-imports/${reviewBatchId}/parse-price-text`, {
      source_text: "Milk 2% | 1 gal | 3.49\nLarge Eggs | 12 ct | 2.89"
    });
    assert.equal(aiDrafts.response.status, 201, JSON.stringify(aiDrafts.body));
    assert.equal(aiDrafts.body.rows.length, 2);
    assert.ok(aiDrafts.body.rows.every((row) => row.status !== "approved"));
    const blockedDataEntryApproval = await dataEntry.post("/api/admin/price-import-rows/bulk", {
      action: "approve",
      row_ids: aiDrafts.body.rows.map((row) => row.id)
    });
    assert.equal(blockedDataEntryApproval.response.status, 403);

    const approvedDrafts = await reviewer.post("/api/admin/price-import-rows/bulk", {
      action: "approve",
      row_ids: aiDrafts.body.rows.map((row) => row.id)
    });
    assert.equal(approvedDrafts.response.status, 200, JSON.stringify(approvedDrafts.body));
    const approvedResult = approvedDrafts.body.results[0];
    const provenance = await queryTempDb(app.dataDir, "SELECT pr.*, events.actor_user_id, events.submitter_user_id, events.event_type FROM price_reports pr JOIN price_provenance_events events ON events.price_report_id = pr.id WHERE pr.id = ? AND events.event_type = 'APPROVED'", [approvedResult.report_id]);
    assert.equal(provenance.user_id, normalRegistration.user.id);
    assert.equal(provenance.submitted_by_user_id, normalRegistration.user.id);
    assert.equal(provenance.reviewed_by, reviewerRegistration.user.id);
    assert.equal(provenance.actor_user_id, reviewerRegistration.user.id);
    assert.equal(provenance.submitter_user_id, normalRegistration.user.id);
    assert.equal(provenance.source_import_batch_id, reviewBatchId);
    assert.equal(provenance.proof_type, "receipt_photo");
    assert.equal(provenance.source_url || "", "");

    const approvalNotifications = await normal.get("/api/notifications");
    const priceNotification = approvalNotifications.body.notifications.find((item) => item.related_report_id === approvedResult.report_id);
    assert.ok(priceNotification);
    assert.match(priceNotification.target_url, /product=/);
    assert.equal(priceNotification.target_url.includes("admin"), false);

    const productDetail = await normal.get(`/api/products/${approvedResult.product_id}`);
    assert.equal(productDetail.response.status, 200, JSON.stringify(productDetail.body));
    const publicReport = productDetail.body.reports.find((item) => item.id === approvedResult.report_id);
    assert.equal(publicReport.has_private_receipt_proof, true);
    assert.equal(Object.prototype.hasOwnProperty.call(publicReport, "photo_path"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(publicReport, "reviewed_by"), false);
    assert.ok(publicReport.primary_price_label);
    assert.ok(publicReport.freshness_label);

    const noPriceProduct = await updateTempUser(app.dataDir, "INSERT INTO products (canonical_name, display_name, category, status, created_at, updated_at) VALUES ('price needed test item', 'Price Needed Test Item', 'pantry', 'active', ?, ?)", [new Date().toISOString(), new Date().toISOString()]);
    const noPriceSearch = await normal.get("/api/products?q=Price%20Needed%20Test%20Item");
    assert.equal(noPriceSearch.body.products[0].id, noPriceProduct.lastID);
    assert.equal(noPriceSearch.body.products[0].best_price, null);
    assert.equal(noPriceSearch.body.products[0].best_price_label, "Price needed");

    const correctionNow = new Date().toISOString();
    const janesvilleToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const aiMatchedProduct = await updateTempUser(app.dataDir, "INSERT INTO products (canonical_name, display_name, category, default_size_text, status, created_at, updated_at) VALUES ('generic coconut water', 'Generic Coconut Water', 'drinks', '16 oz', 'active', ?, ?)", [correctionNow, correctionNow]);
    const humanMatchedProduct = await updateTempUser(app.dataDir, "INSERT INTO products (canonical_name, display_name, category, default_size_text, status, created_at, updated_at) VALUES ('ib coconut water 16 oz', 'IB Coconut Water 16 Oz', 'drinks', '16 oz', 'active', ?, ?)", [correctionNow, correctionNow]);
    const beforeCorrectionBrowse = await normal.get("/api/products?q=IB%20Coconut%20Water");
    assert.equal(beforeCorrectionBrowse.body.products.find((product) => product.id === humanMatchedProduct.lastID).best_price_label, "Price needed");
    const correctionProofId = await insertProofBatch(app.dataDir, normalRegistration.user.id, "Coconut Water human correction regression");
    await updateTempUser(app.dataDir, "UPDATE price_import_batches SET default_store_id = ? WHERE id = ?", [aldiStore.id, correctionProofId]);
    assert.equal((await reviewer.post(`/api/admin/v2/reviews/${correctionProofId}/claim`, {})).response.status, 200);
    const correctionJobId = await insertAiJob(app.dataDir, correctionProofId, "ready_for_review", { started: true, completed: true, attemptCount: 1 });
    const correctionAnalysis = await insertZeroItemAnalysis(app.dataDir, correctionProofId, correctionJobId);
    await updateTempUser(app.dataDir, "UPDATE ai_proof_analyses SET resolved_store_id = ?, item_count = 1, ready_count = 1 WHERE id = ?", [aldiStore.id, correctionAnalysis.lastID]);
    const correctionRow = await updateTempUser(app.dataDir, `INSERT INTO price_import_rows (batch_id, product_id, store_id, item_name, brand, category, price, comparison_price, comparison_unit, size_text, quantity, unit, proof_type, source_date, storage_condition, price_type, valid_from_date, valid_through_date, promotion_schedule_text, display_offer_text, extracted_item_name, extracted_price, extracted_quantity, extracted_unit, status, ai_analysis_id, ai_item_index, ai_confidence, ai_warnings_json, created_at, updated_at) VALUES (?, ?, ?, 'Coconut Water 16 Oz', 'Generic', 'drinks', 3.96, 3.96, 'each', '16 oz', 1, 'each', 'receipt_photo', ?, 'shelf stable', 'one_day_sale', '2020-01-01', '2020-01-01', 'Today only', '$3.96 today only', 'Coconut Water 16 Oz', 3.96, 1, 'each', 'ready_for_review', ?, 0, 'high', '[]', ?, ?)`, [correctionProofId, aiMatchedProduct.lastID, aldiStore.id, janesvilleToday, correctionAnalysis.lastID, correctionNow, correctionNow]);
    const savedCorrection = await reviewer.post(`/api/admin/price-import-rows/${correctionRow.lastID}`, { product_id: humanMatchedProduct.lastID, item_name: "IB Coconut Water 16 Oz", brand: "IB", price: 3.49, comparison_price: 3.96, size_text: "16 oz", quantity: 1, unit: "each", category: "drinks", storage_condition: "shelf stable", store_id: aldiStore.id, price_type: "one_day_sale", valid_from_date: janesvilleToday, valid_through_date: janesvilleToday, promotion_schedule_text: "Today only", display_offer_text: "$3.49 today only", status: "ready_for_review", edited_fields: ["product_id", "price", "valid_from_date", "valid_through_date"] });
    assert.equal(savedCorrection.response.status, 200, JSON.stringify(savedCorrection.body));
    assert.equal(savedCorrection.body.row.price, 3.49);
    assert.equal(savedCorrection.body.row.comparison_price, 3.49);
    assert.equal(savedCorrection.body.row.product_id, humanMatchedProduct.lastID);
    assert.equal(savedCorrection.body.row.valid_from_date, janesvilleToday);
    const persistedCorrection = await queryTempDb(app.dataDir, "SELECT * FROM price_import_rows WHERE id = ?", [correctionRow.lastID]);
    assert.equal(persistedCorrection.price, 3.49);
    assert.equal(persistedCorrection.comparison_price, 3.49);
    assert.equal(persistedCorrection.product_id, humanMatchedProduct.lastID);
    const staleApproval = await reviewer.post(`/api/admin/price-import-rows/${correctionRow.lastID}/approve`, { expected_draft_updated_at: "2000-01-01T00:00:00.000Z", price: 3.96, product_id: aiMatchedProduct.lastID });
    assert.equal(staleApproval.response.status, 409, "A stale browser revision must never approve old AI values.");
    const correctedApproval = await reviewer.post(`/api/admin/price-import-rows/${correctionRow.lastID}/approve`, { expected_draft_updated_at: savedCorrection.body.row.updated_at, price: 3.96, product_id: aiMatchedProduct.lastID });
    assert.equal(correctedApproval.response.status, 200, JSON.stringify(correctedApproval.body));
    assert.equal(correctedApproval.body.approved_price, 3.49);
    assert.equal(correctedApproval.body.product_id, humanMatchedProduct.lastID);
    assert.equal(correctedApproval.body.validity.valid_from_date, janesvilleToday);
    const correctedReport = await queryTempDb(app.dataDir, "SELECT * FROM price_reports WHERE id = ?", [correctedApproval.body.report_id]);
    assert.equal(correctedReport.price, 3.49);
    assert.equal(correctedReport.comparison_price, 3.49);
    assert.equal(correctedReport.product_id, humanMatchedProduct.lastID);
    assert.equal(correctedReport.valid_from_date, janesvilleToday);
    const immediateCorrectionBrowse = await normal.get("/api/products?q=IB%20Coconut%20Water");
    const correctedProductCard = immediateCorrectionBrowse.body.products.find((product) => product.id === humanMatchedProduct.lastID);
    assert.equal(correctedProductCard.best_price, 3.49);
    const immediateCorrectionDetail = await normal.get(`/api/products/${humanMatchedProduct.lastID}`);
    assert.equal(immediateCorrectionDetail.body.reports.find((report) => report.id === correctedApproval.body.report_id).price, 3.49);
    const draftEditEvent = await queryTempDb(app.dataDir, "SELECT metadata_json FROM price_provenance_events WHERE import_row_id = ? AND event_type = 'DRAFT_EDITED' ORDER BY id DESC LIMIT 1", [correctionRow.lastID]);
    assert.equal(JSON.parse(draftEditEvent.metadata_json).before.price, 3.96);
    assert.equal(JSON.parse(draftEditEvent.metadata_json).after.price, 3.49);
    const approvalEvent = await queryTempDb(app.dataDir, "SELECT metadata_json FROM price_provenance_events WHERE import_row_id = ? AND event_type = 'APPROVED' ORDER BY id DESC LIMIT 1", [correctionRow.lastID]);
    assert.equal(JSON.parse(approvalEvent.metadata_json).original_ai.price, 3.96);
    assert.equal(JSON.parse(approvalEvent.metadata_json).human_approved.price, 3.49);
    assert.equal((await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM price_reports WHERE source_import_row_id = ? AND status = 'approved'", [correctionRow.lastID])).count, 1);
    const correctedAgain = await owner.post(`/api/admin/reports/${correctedApproval.body.report_id}/edit`, { price: 3.29, admin_edit_note: "Owner corrected the human-approved price." });
    assert.equal(correctedAgain.response.status, 200, JSON.stringify(correctedAgain.body));
    assert.equal(correctedAgain.body.report.price, 3.29);
    assert.equal(correctedAgain.body.report.comparison_price, 3.29);
    const correctedAgainBrowse = await normal.get("/api/products?q=IB%20Coconut%20Water");
    assert.equal(correctedAgainBrowse.body.products.find((product) => product.id === humanMatchedProduct.lastID).best_price, 3.29);
    assert.equal((await queryTempDb(app.dataDir, "SELECT COUNT(*) AS count FROM price_reports WHERE source_import_row_id = ? AND status = 'approved'", [correctionRow.lastID])).count, 1, "A correction must not create a second active equivalent price.");

    const nowPrice = new Date().toISOString();
    await updateTempUser(app.dataDir, `INSERT INTO price_reports (user_id, submitted_by_user_id, store_id, product_id, item_name, category, price, quantity, unit, unit_price, comparison_price, comparison_unit, proof_type, confidence, status, source_date, expires_at, submitted_at) SELECT ?, ?, id, ?, 'Milk 2%', 'dairy', 0.55, 1, ?, 0.55, 0.55, ?, 'receipt_photo', 'high', 'approved', ?, '2099-01-01', ? FROM stores WHERE active = 1 ORDER BY id LIMIT 1`, [normalRegistration.user.id, normalRegistration.user.id, approvedResult.product_id, provenance.unit, provenance.unit, nowPrice.slice(0, 10), nowPrice]);
    await updateTempUser(app.dataDir, `INSERT INTO price_reports (user_id, submitted_by_user_id, store_id, product_id, item_name, category, price, quantity, unit, unit_price, comparison_price, comparison_unit, proof_type, confidence, status, source_date, expires_at, submitted_at) SELECT ?, ?, id, ?, 'Milk 2%', 'dairy', 0.10, 1, 'each', 0.10, 0.10, 'each', 'weekly_ad', 'high', 'expired', '2020-01-01', '2020-01-02', ? FROM stores WHERE active = 1 ORDER BY id DESC LIMIT 1`, [normalRegistration.user.id, normalRegistration.user.id, approvedResult.product_id, nowPrice]);
    const publicProducts = await normal.get(`/api/products?q=${encodeURIComponent(productDetail.body.product.display_name)}`);
    const pricedProduct = publicProducts.body.products.find((item) => item.id === approvedResult.product_id);
    assert.equal(pricedProduct.best_price, 0.55, "Expired prices must not become best current prices.");
    assert.equal(pricedProduct.best_price_label, provenance.unit === "each" ? "$0.55 each" : `$0.55/${provenance.unit}`);
    const publicStore = await normal.get(`/api/stores/${provenance.store_id}`);
    assert.equal(publicStore.response.status, 200);
    assert.ok(publicStore.body.products.some((item) => item.id === approvedResult.product_id && item.best_price_label !== "Price needed"));

    const correctedPrice = await owner.post(`/api/admin/reports/${approvedResult.report_id}/edit`, { price: "3.59", admin_edit_note: "Corrected test price while preserving original history." });
    assert.equal(correctedPrice.response.status, 200, JSON.stringify(correctedPrice.body));
    const correctionEvent = await queryTempDb(app.dataDir, "SELECT * FROM price_provenance_events WHERE price_report_id = ? AND event_type = 'CORRECTED' ORDER BY id DESC LIMIT 1", [approvedResult.report_id]);
    assert.ok(correctionEvent);
    assert.equal(JSON.parse(correctionEvent.metadata_json).original.price, 3.49);
    assert.equal(JSON.parse(correctionEvent.metadata_json).corrected.price, 3.59);

    const verifiedQuality = await normal.post("/api/quality-reviews", {
      product_id: approvedResult.product_id,
      store_id: provenance.store_id,
      price_report_id: approvedResult.report_id,
      rating: 4,
      tags: ["good quality"],
      comment: "Fresh this week."
    });
    assert.equal(verifiedQuality.response.status, 201, JSON.stringify(verifiedQuality.body));
    assert.equal(verifiedQuality.body.review.verified_purchase, true);

    const forgedQuality = await reviewer.post("/api/quality-reviews", {
      product_id: approvedResult.product_id,
      store_id: provenance.store_id,
      price_report_id: approvedResult.report_id,
      rating: 2,
      comment: "Different shopper observation."
    });
    assert.equal(forgedQuality.response.status, 201, JSON.stringify(forgedQuality.body));
    assert.equal(forgedQuality.body.review.verified_purchase, false);
    const editOtherReview = await reviewer.request(`/api/quality-reviews/${verifiedQuality.body.review.id}`, { method: "PATCH", json: { rating: 1 } });
    assert.equal(editOtherReview.response.status, 404);
    const qualitySummary = await normal.get(`/api/products/${approvedResult.product_id}/quality?store_id=${provenance.store_id}`);
    assert.equal(qualitySummary.response.status, 200);
    assert.equal(qualitySummary.body.all_time_count, 2);
    assert.equal(qualitySummary.body.recent_rating, 3);
    const helpful = await reviewer.post(`/api/quality-reviews/${verifiedQuality.body.review.id}/helpful`, {});
    assert.equal(helpful.response.status, 200, JSON.stringify(helpful.body));
    const reportedReview = await reviewer.post(`/api/quality-reviews/${verifiedQuality.body.review.id}/report`, { reason: "misleading" });
    assert.equal(reportedReview.response.status, 201, JSON.stringify(reportedReview.body));
    const moderationQueue = await owner.get("/api/admin/quality-reviews/reports");
    assert.equal(moderationQueue.response.status, 200, JSON.stringify(moderationQueue.body));
    assert.ok(moderationQueue.body.reports.some((item) => item.quality_review_id === verifiedQuality.body.review.id && item.reason === "misleading"));
    const hideReview = await owner.post(`/api/admin/quality-reviews/${forgedQuality.body.review.id}/moderate`, { status: "hidden", reason: "Test moderation" });
    assert.equal(hideReview.response.status, 200, JSON.stringify(hideReview.body));
    const hiddenSummary = await normal.get(`/api/products/${approvedResult.product_id}/quality?store_id=${provenance.store_id}`);
    assert.equal(hiddenSummary.body.all_time_count, 1);

    const selfBatchId = await insertProofBatch(app.dataDir, reviewerRegistration.user.id, "Reviewer own receipt");
    const selfDrafts = await reviewer.post(`/api/admin/price-imports/${selfBatchId}/parse-price-text`, { source_text: "Bread | 20 oz | 2.59" });
    assert.equal(selfDrafts.response.status, 201, JSON.stringify(selfDrafts.body));
    const blockedSelfApproval = await reviewer.post("/api/admin/price-import-rows/bulk", { action: "approve", row_ids: selfDrafts.body.rows.map((row) => row.id) });
    assert.equal(blockedSelfApproval.response.status, 409);

    const ownerBatchId = await insertProofBatch(app.dataDir, ownerLogin.body.user.id, "Owner test receipt");
    const ownerDrafts = await owner.post(`/api/admin/price-imports/${ownerBatchId}/parse-price-text`, { source_text: "Coffee | 12 oz | 8.99" });
    assert.equal(ownerDrafts.response.status, 201, JSON.stringify(ownerDrafts.body));
    const ownerNeedsConfirmation = await owner.post("/api/admin/price-import-rows/bulk", { action: "approve", row_ids: ownerDrafts.body.rows.map((row) => row.id) });
    assert.equal(ownerNeedsConfirmation.response.status, 409);
    const ownerOverride = await owner.post("/api/admin/price-import-rows/bulk", { action: "approve", row_ids: ownerDrafts.body.rows.map((row) => row.id), owner_self_approval_override: true, override_reason: "Automated operational test" });
    assert.equal(ownerOverride.response.status, 200, JSON.stringify(ownerOverride.body));
    const overrideEvent = await queryTempDb(app.dataDir, "SELECT * FROM price_provenance_events WHERE import_batch_id = ? AND event_type = 'OWNER_SELF_APPROVAL_OVERRIDE'", [ownerBatchId]);
    assert.equal(overrideEvent.actor_user_id, ownerLogin.body.user.id);

    const heartbeatOne = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatOne.response.status, 200);
    assert.equal(heartbeatOne.body.streak.current, 1);
    const heartbeatSameDay = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatSameDay.body.streak.current, 1);
    const janesvilleDate = (offsetDays) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86400000));
    const yesterday = janesvilleDate(-1);
    await updateTempUser(app.dataDir, "UPDATE user_engagement SET current_streak = 1, last_qualifying_date = ? WHERE user_id = ?", [yesterday, normalRegistration.user.id]);
    const heartbeatNextDay = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatNextDay.body.streak.current, 2);
    const missed = janesvilleDate(-3);
    await updateTempUser(app.dataDir, "UPDATE user_engagement SET current_streak = 7, last_qualifying_date = ? WHERE user_id = ?", [missed, normalRegistration.user.id]);
    const heartbeatAfterMiss = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatAfterMiss.body.streak.current, 1);

    const blockedNormal = await normal.get("/api/admin/operations/overview");
    assert.equal(blockedNormal.response.status, 403);

    const blockedPin = await new TestClient(app.baseUrl).get(`/api/admin/operations/overview?pin=${ADMIN_PIN}`);
    assert.equal(blockedPin.response.status, 403);

    const blockedAdminPage = await normal.get("/admin.html");
    assert.equal(blockedAdminPage.response.status, 403);

    const adminPage = await owner.get("/admin.html");
    assert.equal(adminPage.response.status, 200);
    assert.match(String(adminPage.body), /Operations Center/);

    const categories = await normal.get("/api/feedback/categories");
    assert.equal(categories.response.status, 200);
    assert.ok(categories.body.categories.includes("bug"));
    assert.ok(categories.body.categories.includes("feature_request"));

    const feedback = await normal.post("/api/feedback", {
      category: "bug",
      title: "Operations test feedback",
      message: "Temporary integration feedback ticket.",
      priority: "high",
      source_url: "https://example.invalid/feedback"
    });
    assert.equal(feedback.response.status, 201, JSON.stringify(feedback.body));
    assert.equal(feedback.body.ticket.category, "bug");

    const userFeedback = await normal.get("/api/account/feedback");
    assert.equal(userFeedback.response.status, 200);
    assert.ok(userFeedback.body.tickets.some((ticket) => ticket.id === feedback.body.ticket.id));

    const featureVotes = await normal.get("/api/feature-votes");
    assert.equal(featureVotes.response.status, 200);
    assert.ok(featureVotes.body.options.length >= 1);
    const optionId = featureVotes.body.options[0].id;
    const vote = await normal.post(`/api/feature-votes/${optionId}/vote`, {});
    assert.equal(vote.response.status, 201, JSON.stringify(vote.body));
    const duplicateVote = await normal.post(`/api/feature-votes/${optionId}/vote`, {});
    assert.equal(duplicateVote.response.status, 409);

    await normal.post("/api/analytics/event", {
      event_type: "search_performed",
      cart_item_name: "eggs",
      metadata: { result_count: 0, product_count: 0 }
    });

    const overview = await owner.get("/api/admin/operations/overview");
    assert.equal(overview.response.status, 200, JSON.stringify(overview.body));
    assert.equal(overview.body.is_super_admin, true);
    assert.ok(overview.body.system_health.website_status.status);
    assert.ok(overview.body.live_activity.registered_users >= 2);
    assert.ok(overview.body.feedback.tickets.some((ticket) => ticket.id === feedback.body.ticket.id));
    assert.ok(overview.body.feature_voting.options.some((option) => option.id === optionId && option.votes >= 1));
    assert.ok(overview.body.search_analytics.searches_today >= 1);
    assert.ok(Array.isArray(overview.body.store_health));
    assert.ok(Array.isArray(overview.body.event_feed));
    assert.ok(Array.isArray(overview.body.community_pulse));

    const users = await owner.get("/api/admin/operations/users?q=operationshopper");
    assert.equal(users.response.status, 200);
    assert.equal(users.body.users.length, 1);
    assert.equal(users.body.users[0].id, normalRegistration.user.id);

    const detail = await owner.get(`/api/admin/operations/users/${normalRegistration.user.id}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.user.username, "operationshopper");
    assert.ok(detail.body.activity_history.some((item) => item.type === "feedback"));
    assert.ok(Array.isArray(detail.body.login_history));
    assert.ok(Array.isArray(detail.body.verification_history));

    const feedbackUpdate = await owner.post(`/api/admin/operations/feedback/${feedback.body.ticket.id}`, {
      action: "close",
      priority: "urgent",
      public_response: "Thanks. This has been reviewed.",
      internal_notes: "Closed by automated Operations Center test."
    });
    assert.equal(feedbackUpdate.response.status, 200, JSON.stringify(feedbackUpdate.body));
    assert.equal(feedbackUpdate.body.ticket.status, "closed");
    assert.equal(feedbackUpdate.body.ticket.priority, "urgent");

    const announcement = await owner.post("/api/admin/operations/announcements", {
      announcement_type: "homepage_banner",
      status: "published",
      title: "Operations test announcement",
      body: "Temporary test announcement."
    });
    assert.equal(announcement.response.status, 201, JSON.stringify(announcement.body));

    const publicAnnouncements = await normal.get("/api/announcements");
    assert.equal(publicAnnouncements.response.status, 200);
    assert.ok(publicAnnouncements.body.announcements.some((item) => item.id === announcement.body.announcement.id));

    const adminV2Announcements = await owner.get("/api/admin/v2/announcements");
    assert.equal(adminV2Announcements.response.status, 200, JSON.stringify(adminV2Announcements.body));
    const adminV2Announcement = adminV2Announcements.body.announcements.find((item) => item.id === announcement.body.announcement.id);
    assert.ok(adminV2Announcement, "Admin V2 should return an announcement stored in the canonical body column.");
    assert.equal(adminV2Announcement.message, "Temporary test announcement.");

    const blockedAnnouncement = await normal.post("/api/admin/operations/announcements", {
      title: "Blocked",
      body: "Should not save."
    });
    assert.equal(blockedAnnouncement.response.status, 403);

    const homepage = await normal.get("/");
    assert.equal(homepage.response.status, 200);
    assert.match(String(homepage.body), /Grocery Radar/);

    const initialApprovedCount = await approvedReportCount(app.dataDir);
    const initialHomepageService = await normal.get("/api/homepage-service");
    assert.equal(initialHomepageService.response.status, 200, JSON.stringify(initialHomepageService.body));
    assert.equal(initialHomepageService.body.service.location.city, "Janesville");
    assert.equal(Object.prototype.hasOwnProperty.call(initialHomepageService.body, "cities"), false);
    assert.ok(initialHomepageService.body.patch_notes.some((patch) => patch.status === "published"));
    assert.ok(Array.isArray(initialHomepageService.body.known_issues));
    assert.equal(JSON.stringify(initialHomepageService.body).includes(OWNER_EMAIL), false);
    assert.equal(JSON.stringify(initialHomepageService.body).includes("password"), false);
    assert.equal(initialHomepageService.body.application_version, "0.9.4");
    const initialReleases = await normal.get("/api/releases");
    assert.equal(initialReleases.response.status, 200);
    assert.equal(initialReleases.body.releases.some((release) => release.version_label === "v0.9.4"), false, "The seeded v0.9.4 draft must not be public.");

    const blockedHomepageStatus = await normal.post("/api/admin/operations/homepage-service/status", {
      service_status: "maintenance",
      version_label: "Blocked",
      current_focus: "Blocked"
    });
    assert.equal(blockedHomepageStatus.response.status, 403);

    await updateTempUser(app.dataDir, "UPDATE users SET is_admin = 1 WHERE id = ?", [normalRegistration.user.id]);
    const blockedNormalAdminPatch = await normal.post("/api/admin/operations/homepage-service/patch-notes", {
      version_label: "Blocked 0.0.1",
      title: "Blocked Normal Admin Patch",
      summary: "Normal admins cannot publish homepage service updates.",
      status: "published"
    });
    assert.equal(blockedNormalAdminPatch.response.status, 403);

    const blockedPinPatch = await new TestClient(app.baseUrl).post(`/api/admin/operations/homepage-service/patch-notes?pin=${ADMIN_PIN}`, {
      version_label: "Blocked 0.0.2",
      title: "Blocked PIN Patch",
      summary: "ADMIN_PIN cannot publish homepage service updates.",
      status: "published"
    });
    assert.equal(blockedPinPatch.response.status, 403);

    const maintenanceStatus = await owner.post("/api/admin/operations/homepage-service/status", {
      service_status: "maintenance",
      version_label: "Early Access 0.2.1",
      current_focus: "Adding verified Janesville grocery prices.",
      main_message: "Grocery Radar is live for Janesville shoppers while approved prices continue to fill in.",
      community_mission_title: "Help fill the Janesville radar.",
      community_mission_body: "Submit proof from Janesville receipts, shelf tags, weekly ads, or store links.",
      homepage_announcement: "Short updates may happen while Janesville price coverage grows.",
      maintenance_enabled: true,
      maintenance_title: "Maintenance in Progress",
      maintenance_message: "We are deploying account and price-import improvements.",
      maintenance_impact: "You may briefly experience login problems or missing prices.",
      maintenance_status: "in_progress"
    });
    assert.equal(maintenanceStatus.response.status, 200, JSON.stringify(maintenanceStatus.body));
    assert.equal(maintenanceStatus.body.service.service_status, "maintenance");
    assert.equal(maintenanceStatus.body.service.maintenance.enabled, true);

    const publicPatch = await owner.post("/api/admin/operations/homepage-service/patch-notes", {
      version_label: "Early Access 0.2.1",
      title: "Published Homepage Test Patch",
      summary: "Public patch notes now explain what changed for Janesville shoppers.",
      added: "Live-service homepage\nPatch notes panel",
      changed: "Clearer Janesville early-access messaging",
      fixed: "Empty homepage confusion",
      known_issues: "Initial price coverage is still filling in",
      next_focus: "Import verified Janesville prices",
      status: "published"
    });
    assert.equal(publicPatch.response.status, 201, JSON.stringify(publicPatch.body));

    const hiddenPatch = await owner.post("/api/admin/operations/homepage-service/patch-notes", {
      version_label: "Internal 9.9.9",
      title: "Hidden Draft Patch",
      summary: "This draft must not appear publicly.",
      added: "Private draft item",
      status: "draft"
    });
    assert.equal(hiddenPatch.response.status, 201, JSON.stringify(hiddenPatch.body));
    const ownerReleaseNotes = await owner.get("/api/admin/v2/release-notes");
    assert.equal(ownerReleaseNotes.response.status, 200);
    const seededReleaseDraft = ownerReleaseNotes.body.releases.find((release) => release.version_label === "v0.9.4" && release.status === "draft");
    assert.ok(seededReleaseDraft);
    assert.equal((await reviewer.get("/api/admin/v2/release-notes")).response.status, 403);
    assert.equal((await reviewer.post(`/api/admin/operations/homepage-service/patch-notes/${seededReleaseDraft.id}`, { ...seededReleaseDraft, status: "published" })).response.status, 403);
    const publishSeededRelease = await owner.post(`/api/admin/operations/homepage-service/patch-notes/${seededReleaseDraft.id}`, { ...seededReleaseDraft, status: "published", release_date: "2026-08-11" });
    assert.equal(publishSeededRelease.response.status, 200, JSON.stringify(publishSeededRelease.body));
    const releasesAfterPublish = await normal.get("/api/releases");
    assert.ok(releasesAfterPublish.body.releases.some((release) => release.version_label === "v0.9.4"));
    const publishedRelease = releasesAfterPublish.body.releases.find((release) => release.id === publicPatch.body.patch_note.id);
    assert.ok(publishedRelease);
    assert.deepEqual(publishedRelease.improved, ["Clearer Janesville early-access messaging"]);
    const readRelease = await normal.post(`/api/releases/${publishedRelease.id}/read`, {});
    assert.equal(readRelease.response.status, 200);
    const releasesAfterRead = await normal.get("/api/releases");
    assert.equal(releasesAfterRead.body.releases.find((release) => release.id === publishedRelease.id).is_read, true);

    const publicIssue = await owner.post("/api/admin/operations/homepage-service/known-issues", {
      title: "Published Homepage Test Issue",
      issue_status: "fix_in_progress",
      description: "Some product categories are still being populated from Janesville proof.",
      workaround: "Search a specific item or submit proof.",
      visibility_status: "published"
    });
    assert.equal(publicIssue.response.status, 201, JSON.stringify(publicIssue.body));

    const hiddenIssue = await owner.post("/api/admin/operations/homepage-service/known-issues", {
      title: "Hidden Homepage Test Issue",
      issue_status: "investigating",
      description: "This hidden issue must not appear publicly.",
      visibility_status: "hidden"
    });
    assert.equal(hiddenIssue.response.status, 201, JSON.stringify(hiddenIssue.body));

    const publicHomepageService = await normal.get("/api/homepage-service");
    assert.equal(publicHomepageService.response.status, 200, JSON.stringify(publicHomepageService.body));
    const publicHomepageJson = JSON.stringify(publicHomepageService.body);
    assert.equal(publicHomepageService.body.service.service_status, "maintenance");
    assert.equal(publicHomepageService.body.service.maintenance.enabled, true);
    assert.ok(publicHomepageJson.includes("Published Homepage Test Patch"));
    assert.equal(publicHomepageJson.includes("Hidden Draft Patch"), false);
    assert.ok(publicHomepageJson.includes("Published Homepage Test Issue"));
    assert.equal(publicHomepageJson.includes("Hidden Homepage Test Issue"), false);
    assert.equal(publicHomepageJson.includes(OWNER_EMAIL), false);
    assert.equal(publicHomepageService.body.community_counts.verified_prices, initialApprovedCount);
    assert.equal(publicHomepageService.body.community_counts.janesville_stores_tracked > 0, true);

    const adminHomepageService = await owner.get("/api/admin/operations/homepage-service");
    assert.equal(adminHomepageService.response.status, 200, JSON.stringify(adminHomepageService.body));
    assert.ok(JSON.stringify(adminHomepageService.body).includes("Hidden Draft Patch"));
    assert.ok(JSON.stringify(adminHomepageService.body).includes("Hidden Homepage Test Issue"));

    const savedWidgets = await owner.post("/api/admin/operations/widgets", {
      layout: {
        order: ["live_activity", "system_health"],
        hidden: ["security"],
        sizes: { live_activity: "wide" }
      }
    });
    assert.equal(savedWidgets.response.status, 200, JSON.stringify(savedWidgets.body));
    assert.deepEqual(savedWidgets.body.layout.order.slice(0, 2), ["live_activity", "system_health"]);
    assert.deepEqual(savedWidgets.body.layout.hidden, ["security"]);

    const auditLog = await owner.get("/api/admin/operations/audit-log");
    assert.equal(auditLog.response.status, 200);
    assert.ok(auditLog.body.audit_log.some((entry) => /operations\/feedback/.test(entry.path)));
    assert.ok(auditLog.body.audit_log.every((entry) => !/EMAIL_PASS|SMTP_PASS|password/i.test(JSON.stringify(entry))));

    const errorCenter = await owner.get("/api/admin/operations/errors");
    assert.equal(errorCenter.response.status, 200);
    assert.ok(Number.isInteger(errorCenter.body.failed_emails));

    const liveApprovedBeforeBackup = await approvedReportCount(app.dataDir);
    const backup = await owner.post("/api/admin/operations/backups", {});
    assert.equal(backup.response.status, 201, JSON.stringify(backup.body));
    assert.equal(backup.body.backup.status, "success");
    assert.equal(await approvedReportCount(app.dataDir), liveApprovedBeforeBackup);
    const backups = await owner.get("/api/admin/operations/backups");
    assert.equal(backups.response.status, 200, JSON.stringify(backups.body));
    assert.ok(backups.body.backups.some((item) => item.id === backup.body.backup.id));
    assert.equal(JSON.stringify(backups.body).includes(app.dataDir), false);
    const blockedBackup = await reviewer.post("/api/admin/operations/backups", {});
    assert.equal(blockedBackup.response.status, 403);

    await updateTempUser(
      app.dataDir,
      "INSERT INTO notifications (user_id, admin_only, type, title, message, target_url, is_read, created_at) VALUES (?, 0, 'test', 'Safe target test', 'Must not expose admin route.', '/admin.html?tab=usersTab', 0, ?)",
      [normalRegistration.user.id, new Date().toISOString()]
    );
    const safeNotifications = await normal.get("/api/notifications");
    assert.equal(safeNotifications.response.status, 200);
    const safeTarget = safeNotifications.body.notifications.find((item) => item.title === "Safe target test");
    assert.equal(safeTarget.target_url, "");

    const browse = await normal.get("/api/browse");
    assert.equal(browse.response.status, 200);
    assert.ok(Array.isArray(browse.body.recently_approved_reports));
    assert.equal(await approvedReportCount(app.dataDir), initialApprovedCount);
    assert.equal(
      browse.body.recently_approved_reports.some((report) => /Operations test feedback/i.test(report.item_name || "")),
      false
    );
    const search = await normal.get("/api/search?q=eggs");
    assert.equal(search.response.status, 200);
    assert.ok(Array.isArray(search.body.reports));
  } finally {
    await app.stop();
  }

  console.log("Operations Center tests passed.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
