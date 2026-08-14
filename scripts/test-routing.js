"use strict";

const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const ROOT = path.join(__dirname, "..");
const OWNER_EMAIL = "juricbu@gmail.com";
const OWNER_PASSWORD = "RoutingPass123!";
const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function done(error) { if (error) reject(error); else resolve(this); }));
const close = (db) => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
const freePort = () => new Promise((resolve, reject) => { const socket = net.createServer(); socket.on("error", reject); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });

class Client {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.cookie = ""; }
  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) }; if (this.cookie) headers.cookie = this.cookie;
    const response = await fetch(`${this.baseUrl}${url}`, { ...options, headers, redirect: options.redirect || "manual" });
    const cookie = response.headers.get("set-cookie"); if (cookie) this.cookie = cookie.split(";")[0];
    const body = await response.text();
    return { response, body, json: () => JSON.parse(body) };
  }
  get(url, options) { return this.request(url, options); }
  post(url, body) { return this.request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
}

async function seedOwner(dataDir) {
  const db = new sqlite3.Database(path.join(dataDir, "grocery_radar.sqlite")); const now = new Date().toISOString();
  await run(db, "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT, password_hash TEXT, points INTEGER NOT NULL DEFAULT 0, accuracy_score INTEGER NOT NULL DEFAULT 0, is_email_verified INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_super_admin INTEGER NOT NULL DEFAULT 0, account_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)");
  await run(db, "INSERT INTO users (username,email,password_hash,is_email_verified,email_verified_at,created_at) VALUES ('elcastilo',?,?,1,?,?)", [OWNER_EMAIL, await bcrypt.hash(OWNER_PASSWORD, 12), now, now]);
  await close(db);
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-routing-data-"));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-routing-uploads-"));
  await seedOwner(dataDir); const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, UPLOADS_DIR: uploadsDir, SESSION_SECRET: "routing-test-secret", EMAIL_TEST_MODE: "1", AI_API_KEY: "", OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = []; child.stdout.on("data", (chunk) => output.push(String(chunk))); child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let count = 0; count < 150; count += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) return { baseUrl, dataDir, child }; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(output.join(""));
}

async function stopServer(app) { if (app.child.exitCode !== null) return; app.child.kill("SIGTERM"); await new Promise((resolve) => { const timer = setTimeout(resolve, 2000); app.child.once("exit", () => { clearTimeout(timer); resolve(); }); }); }

async function main() {
  const routes = await import(path.join(ROOT, "client/src/routes.js"));
  const expected = {
    "/": "home", "/products": "search", "/products/42": "product", "/stores": "stores", "/stores/7": "store",
    "/savings": "deals", "/savings/price-drops": "deals", "/savings/showdown": "deals", "/savings/categories": "deals",
    "/my-list": "cart", "/my-list/compare": "cart", "/submit": "submit", "/my-submissions": "submissions", "/privacy": "privacy", "/terms": "terms"
  };
  for (const [pathname, screen] of Object.entries(expected)) assert.equal(routes.parsePublicRoute(pathname, "").screen, screen, pathname);
  assert.equal(routes.parsePublicRoute("/products/not-a-number", "").screen, "notFound");
  assert.equal(routes.parsePublicRoute("/does-not-exist", "").screen, "notFound");
  assert.equal(routes.publicPathFor("product", { productId: 42 }), "/products/42");
  assert.equal(routes.publicPathFor("store", { storeId: 7 }), "/stores/7");
  assert.equal(routes.publicPathFor("deals", { savingsSection: "showdown" }), "/savings/showdown");
  const controls = routes.savingsControlsFromParams(new URLSearchParams("window=today&offers=unconditional&store=3&category=dairy&sort=percent"));
  assert.deepEqual(controls, { window: "today", mode: "unconditional", store_id: 3, category: "dairy", sort: "percent" });
  assert.deepEqual(routes.savingsControlsFromParams(new URLSearchParams("window=bad&offers=bad&store=secret&category=bad&sort=bad")), { window: "week", mode: "all", store_id: "", category: "", sort: "newest" });

  const app = await startServer();
  try {
    const publicClient = new Client(app.baseUrl);
    const publicPaths = ["/", "/products", "/products/999999", "/stores", "/stores/999999", "/savings", "/savings/price-drops", "/savings/showdown", "/savings/categories", "/my-list", "/my-list/compare", "/submit", "/my-submissions", "/privacy", "/terms", "/whatever-does-not-exist"];
    for (const pathname of publicPaths) {
      const result = await publicClient.get(pathname);
      assert.equal(result.response.status, 200, pathname);
      assert.match(result.response.headers.get("content-type") || "", /text\/html/, pathname);
      assert.match(result.body, /<div id="root"><\/div>/, `${pathname} must receive the public application shell.`);
    }
    const invalidApi = await publicClient.get("/api/some-invalid-endpoint");
    assert.equal(invalidApi.response.status, 404);
    assert.match(invalidApi.response.headers.get("content-type") || "", /application\/json/);
    assert.deepEqual(invalidApi.json(), { error: "API endpoint was not found." });
    assert.doesNotMatch(invalidApi.body, /<div id="root">/);
    const privacyLegacy = await publicClient.get("/privacy.html");
    assert.equal(privacyLegacy.response.status, 308); assert.equal(privacyLegacy.response.headers.get("location"), "/privacy");

    const anonymousAdmin = await publicClient.get("/admin/attention/missing-photo");
    assert.equal(anonymousAdmin.response.status, 403, "Clean Admin routes must retain staff protection.");
    const owner = new Client(app.baseUrl);
    const login = await owner.post("/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    assert.equal(login.response.status, 200, login.body);
    const adminPaths = ["/admin", "/admin/inbox", "/admin/attention", "/admin/attention/missing-photo", "/admin/attention/missing-current-price", "/admin/attention/missing-upc", "/admin/attention/stale-price", "/admin/attention/location-unresolved", "/admin/attention/family-missing", "/admin/attention/substitute-uncertain", "/admin/products", "/admin/stores", "/admin/workers", "/admin/advanced"];
    for (const pathname of adminPaths) {
      const result = await owner.get(pathname);
      assert.equal(result.response.status, 200, pathname);
      assert.match(result.body, /<title>Grocery Radar Admin<\/title>/, `${pathname} must receive the protected Admin shell.`);
      assert.doesNotMatch(result.body, /<div id="root">/);
    }
    const attention = await owner.get("/api/admin/operations/attention?category=missing_photo");
    assert.equal(attention.response.status, 200);
    const attentionJson = attention.json();
    assert.equal(attentionJson.total, attentionJson.queue.count);
    assert.equal(attentionJson.queue.href, "/admin/attention/missing-photo");

    const adminSource = fs.readFileSync(path.join(ROOT, "public/admin.js"), "utf8");
    const publicSource = fs.readFileSync(path.join(ROOT, "client/src/routes.js"), "utf8");
    assert.match(adminSource, /window\.addEventListener\("popstate"/);
    assert.match(adminSource, /attentionKeyFromSlug/);
    assert.match(adminSource, /updateAdminRoute\(route\.tabId, route, "replace"\)/, "Legacy Admin URLs must normalize with replaceState.");
    assert.match(fs.readFileSync(path.join(ROOT, "client/src/App.jsx"), "utf8"), /window\.addEventListener\('popstate'/);
    for (const source of [adminSource, publicSource]) assert.doesNotMatch(source, /params\.set\(["'](?:pin|token|submissionToken|auth|session|api_key|AI_API_KEY)["']/i, "Routing must never serialize secrets.");
  } finally { await stopServer(app); }
  console.log("Public/Admin routes, deep-link fallbacks, API isolation, filters, legacy compatibility, and URL security tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
