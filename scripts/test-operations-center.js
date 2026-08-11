"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const bcrypt = require("bcrypt");
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
    VERIFICATION_RESEND_COOLDOWN_SECONDS: "60"
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

    const heartbeatOne = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatOne.response.status, 200);
    assert.equal(heartbeatOne.body.streak.current, 1);
    const heartbeatSameDay = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatSameDay.body.streak.current, 1);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await updateTempUser(app.dataDir, "UPDATE user_engagement SET current_streak = 1, last_qualifying_date = ? WHERE user_id = ?", [yesterday, normalRegistration.user.id]);
    const heartbeatNextDay = await normal.post("/api/heartbeat", { visitor_id: "operations-test-visitor" });
    assert.equal(heartbeatNextDay.body.streak.current, 2);
    const missed = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
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
