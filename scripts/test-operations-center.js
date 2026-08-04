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

    const browse = await normal.get("/api/browse");
    assert.equal(browse.response.status, 200);
    assert.ok(Array.isArray(browse.body.recently_approved_reports));
    assert.equal(
      browse.body.recently_approved_reports.some((report) => /Operations test feedback/i.test(report.item_name || "")),
      false
    );
  } finally {
    await app.stop();
  }

  console.log("Operations Center tests passed.");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
