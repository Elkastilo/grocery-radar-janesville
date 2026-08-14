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
const OWNER_PASSWORD = "ShopperReportPass123!";
const openDb = (dataDir) => new sqlite3.Database(path.join(dataDir, "grocery_radar.sqlite"));
const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function done(error) { if (error) reject(error); else resolve(this); }));
const get = (db, sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
const all = (db, sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const close = (db) => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
const freePort = () => new Promise((resolve, reject) => { const socket = net.createServer(); socket.on("error", reject); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });

class Client {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.cookie = ""; }
  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) }; if (this.cookie) headers.cookie = this.cookie;
    const response = await fetch(`${this.baseUrl}${url}`, { ...options, headers });
    const cookie = response.headers.get("set-cookie"); if (cookie) this.cookie = cookie.split(";")[0];
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("json") ? await response.json() : await response.text();
    return { response, body };
  }
  get(url) { return this.request(url); }
  post(url, body) { return this.request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
}

async function seedOwner(dataDir) {
  const db = openDb(dataDir); const now = new Date().toISOString();
  await run(db, "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT, password_hash TEXT, points INTEGER NOT NULL DEFAULT 0, accuracy_score INTEGER NOT NULL DEFAULT 0, is_email_verified INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_super_admin INTEGER NOT NULL DEFAULT 0, account_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)");
  await run(db, "INSERT INTO users (username,email,password_hash,is_email_verified,email_verified_at,created_at) VALUES ('elcastilo',?,?,1,?,?)", [OWNER_EMAIL, await bcrypt.hash(OWNER_PASSWORD, 12), now, now]);
  await close(db);
}

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-shopper-reports-data-"));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-shopper-reports-uploads-"));
  await seedOwner(dataDir); const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, UPLOADS_DIR: uploadsDir, SESSION_SECRET: "shopper-report-test-secret", EMAIL_TEST_MODE: "1", AI_API_KEY: "", OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = []; child.stdout.on("data", (chunk) => output.push(String(chunk))); child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let count = 0; count < 150; count += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) return { baseUrl, dataDir, child }; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(output.join(""));
}

async function stopServer(app) { if (app.child.exitCode !== null) return; app.child.kill("SIGTERM"); await new Promise((resolve) => { const timer = setTimeout(resolve, 2000); app.child.once("exit", () => { clearTimeout(timer); resolve(); }); }); }

async function main() {
  const app = await startServer();
  try {
    const owner = new Client(app.baseUrl);
    const login = await owner.post("/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const db = openDb(app.dataDir); const now = new Date().toISOString(); const farFuture = "2099-08-18T23:59:59.000Z";
    const ownerRow = await get(db, "SELECT id FROM users WHERE email = ?", [OWNER_EMAIL]);
    const stores = await all(db, "SELECT id,name FROM stores WHERE active = 1 ORDER BY id LIMIT 3");
    assert.equal(stores.length, 3, "The exact-store fixture requires three active stores.");
    const product = await run(db, "INSERT INTO products (canonical_name,display_name,preferred_brand,default_size_text,default_unit,category,status,created_at,updated_at) VALUES ('shopper report cola','Shopper Report Cola','Test Brand','12 pack','pack','drinks','active',?,?)", [now, now]);
    const insertPrice = async (store, price, type = "regular", validThrough = null) => run(db, "INSERT INTO price_reports (user_id,submitted_by_user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,size_text,proof_type,confidence,status,price_type,valid_from_date,valid_through_date,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,?,?,'drinks',?,1,'pack',?,'12 pack','shelf_tag_photo','high','approved',?,?,?,?,?,?,?,'not_required')", [ownerRow.id, ownerRow.id, store.id, product.lastID, "Shopper Report Cola", price, price, type, validThrough ? "2026-08-14" : null, validThrough, "2026-08-14", now, now, farFuture]);
    const aldi = await insertPrice(stores[0], 3.49);
    const walmart = await insertPrice(stores[1], 3.96);
    await insertPrice(stores[2], 3.79);
    const sale = await insertPrice(stores[0], 2.99, "sale", "2026-08-18");
    await close(db);

    const created = await fetch(`${app.baseUrl}/api/price-reports/${aldi.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "price changed", note: "Tag says $3.79 now." }) });
    const createdBody = await created.json(); assert.equal(created.status, 201, JSON.stringify(createdBody)); assert.ok(createdBody.issue_id); assert.equal(createdBody.consolidated, false);
    const persisted = openDb(app.dataDir);
    assert.deepEqual(await get(persisted, "SELECT price_report_id,product_id,reason,public_note,status,duplicate_count FROM price_issue_reports WHERE id=?", [createdBody.issue_id]), { price_report_id: aldi.lastID, product_id: product.lastID, reason: "price changed", public_note: "Tag says $3.79 now.", status: "open", duplicate_count: 1 });
    assert.equal((await get(persisted, "SELECT price FROM price_reports WHERE id=?", [aldi.lastID])).price, 3.49, "Shopper reports must not change a price.");
    const notification = await get(persisted, "SELECT related_type,related_id,target_url,is_read FROM notifications WHERE admin_only=1 AND related_type='price_issue_report' ORDER BY id DESC LIMIT 1");
    assert.deepEqual(notification, { related_type: "price_issue_report", related_id: createdBody.issue_id, target_url: `/admin/attention/reported-price/${createdBody.issue_id}`, is_read: 0 });
    await close(persisted);
    const notificationApi = await owner.get("/api/admin/notifications");
    assert.equal(notificationApi.response.status, 200);
    const priceAlert = notificationApi.body.notifications.recent_admin_notifications.find((item) => item.related_type === "price_issue_report" && Number(item.related_id) === Number(createdBody.issue_id));
    assert.ok(priceAlert, "The same API used by the Admin bell must return the new shopper report notification.");
    assert.equal(priceAlert.target_url, `/admin/attention/reported-price/${createdBody.issue_id}`);
    assert.match(priceAlert.title, /Price report: Price changed — Shopper Report Cola/);
    assert.match(priceAlert.message, new RegExp(stores[0].name));
    assert.equal(priceAlert.is_read, false);
    assert.ok(notificationApi.body.notifications.unread_admin_notifications >= 1);

    const duplicate = await fetch(`${app.baseUrl}/api/price-reports/${aldi.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "price changed", note: "A second shopper saw it." }) }).then(async (response) => ({ status: response.status, body: await response.json() }));
    assert.equal(duplicate.status, 200); assert.equal(duplicate.body.issue_id, createdBody.issue_id); assert.equal(duplicate.body.consolidated, true);
    const duplicateDb = openDb(app.dataDir);
    assert.deepEqual(await get(duplicateDb, "SELECT duplicate_count FROM price_issue_reports WHERE id = ?", [createdBody.issue_id]), { duplicate_count: 2 });
    assert.equal((await get(duplicateDb, "SELECT COUNT(*) AS count FROM notifications WHERE admin_only = 1 AND related_type = 'price_issue_report' AND related_id = ?", [createdBody.issue_id])).count, 1, "A consolidated duplicate remains visible on the issue without creating a second bell alert.");
    await close(duplicateDb);

    const walmartIssue = await fetch(`${app.baseUrl}/api/price-reports/${walmart.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "wrong store", note: "This is the Walmart card." }) }).then((response) => response.json());
    const walmartDetail = await owner.get(`/api/admin/price-issues/${walmartIssue.issue_id}`);
    assert.equal(walmartDetail.response.status, 200); assert.equal(walmartDetail.body.issue.price_report_id, walmart.lastID); assert.equal(walmartDetail.body.issue.store_id, stores[1].id); assert.equal(walmartDetail.body.issue.store_name, stores[1].name);

    const saleIssue = await fetch(`${app.baseUrl}/api/price-reports/${sale.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "sale ended", note: "Sign was gone today." }) }).then((response) => response.json());
    let saleDb = openDb(app.dataDir); assert.equal((await get(saleDb, "SELECT status FROM price_reports WHERE id=?", [sale.lastID])).status, "approved", "Sale remains active until staff confirms."); await close(saleDb);
    const expire = await owner.post(`/api/admin/prices/${sale.lastID}/correct`, { action: "expire", product_id: product.lastID, store_id: stores[0].id, reason: "Staff verified promotion ended" });
    assert.equal(expire.response.status, 200, JSON.stringify(expire.body)); assert.ok(expire.body.correction_id);
    const resolvedSale = await owner.post(`/api/admin/price-issues/${saleIssue.issue_id}/decision`, { status: "resolved", correction_id: expire.body.correction_id, resolution_note: "Promotion expiration verified" });
    assert.equal(resolvedSale.response.status, 200); assert.equal(resolvedSale.body.status, "resolved");
    saleDb = openDb(app.dataDir); assert.equal((await get(saleDb, "SELECT status FROM price_reports WHERE id=?", [sale.lastID])).status, "expired"); assert.equal((await get(saleDb, "SELECT COUNT(*) AS count FROM price_reports WHERE id=?", [sale.lastID])).count, 1, "Expired promotion history must remain."); await close(saleDb);

    const correction = await owner.post(`/api/admin/prices/${aldi.lastID}/correct`, { action: "correct", price: 3.79, product_id: product.lastID, store_id: stores[0].id, reason: "Staff verified changed shelf tag" });
    assert.equal(correction.response.status, 200); assert.ok(correction.body.correction_id);
    const resolved = await owner.post(`/api/admin/price-issues/${createdBody.issue_id}/decision`, { status: "resolved", correction_id: correction.body.correction_id, resolution_note: "Corrected after staff verification" });
    assert.equal(resolved.body.status, "resolved");
    const auditDb = openDb(app.dataDir);
    const audit = await get(auditDb, "SELECT metadata_json FROM admin_audit_log WHERE action='PRICE_ISSUE_RESOLVED' AND affected_id=? ORDER BY id DESC LIMIT 1", [createdBody.issue_id]);
    assert.equal(JSON.parse(audit.metadata_json).correction_id, correction.body.correction_id);
    await close(auditDb);

    const dismissed = await owner.post(`/api/admin/price-issues/${walmartIssue.issue_id}/decision`, { status: "dismissed", dismiss_reason: "price still correct", resolution_note: "Staff rechecked the Walmart shelf tag" });
    assert.equal(dismissed.body.status, "dismissed");
    const idempotent = await owner.post(`/api/admin/price-issues/${walmartIssue.issue_id}/decision`, { status: "dismissed", dismiss_reason: "price still correct", resolution_note: "Retry" });
    assert.equal(idempotent.body.idempotent, true);

    const openOne = await fetch(`${app.baseUrl}/api/price-reports/${walmart.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "price changed", note: "New open issue after dismissal" }) }).then((response) => response.json());
    const openTwo = await fetch(`${app.baseUrl}/api/price-reports/${aldi.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "wrong item", note: "Product label differs" }) }).then((response) => response.json());
    const openThree = await fetch(`${app.baseUrl}/api/price-reports/${walmart.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "promotion conditions missing", note: "Card requirement is not shown" }) }).then((response) => response.json());
    const command = await owner.get("/api/admin/operations/command-center");
    const reportedCard = command.body.attention.groups.prices.find((item) => item.key === "reported_price");
    const queue = await owner.get("/api/admin/operations/attention?category=reported_price");
    assert.equal(reportedCard.count, 3); assert.equal(queue.body.total, 3); assert.equal(queue.body.items.length, 3);
    assert.deepEqual(new Set(queue.body.items.map((item) => item.id)), new Set([openOne.issue_id, openTwo.issue_id, openThree.issue_id]));
    assert.equal(reportedCard.href, "/admin/attention/reported-price");
    const deepLink = await owner.get(`/admin/attention/reported-price/${openOne.issue_id}`); assert.equal(deepLink.response.status, 200); assert.match(deepLink.body, /Grocery Radar Admin/);

    const failureDb = openDb(app.dataDir); await run(failureDb, "CREATE TRIGGER fail_price_issue_insert BEFORE INSERT ON price_issue_reports BEGIN SELECT RAISE(FAIL, 'forced insert failure'); END"); await close(failureDb);
    const forcedFailure = await fetch(`${app.baseUrl}/api/price-reports/${aldi.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "other", note: "Force persistence failure" }) });
    assert.ok(forcedFailure.status >= 400, "A failed insert must not return public success.");
    const cleanupDb = openDb(app.dataDir); await run(cleanupDb, "DROP TRIGGER fail_price_issue_insert");
    const issueColumns = await all(cleanupDb, "PRAGMA table_info(price_issue_reports)");
    assert.equal(issueColumns.some((column) => /email|full_ip|device|fingerprint_id|user_id/i.test(column.name)), false, "Shopper reporting must not add identity fields.");
    await close(cleanupDb);

    const spamResponses = [];
    for (let index = 0; index < 11; index += 1) spamResponses.push(await fetch(`${app.baseUrl}/api/price-reports/${walmart.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "price changed", note: "Repeated click" }) }));
    assert.ok(spamResponses.some((response) => response.status === 429), "Equivalent repeated submissions must eventually rate-limit.");

    const clientSource = fs.readFileSync(path.join(ROOT, "client/src/App.jsx"), "utf8");
    assert.match(clientSource, /Couldn't send your report\. Please try again\./); assert.match(clientSource, /disabled=\{sending\}/); assert.match(clientSource, /await postJson\(`\/api\/price-reports\/\$\{reportId\}\/issues`/);
    const adminSource = fs.readFileSync(path.join(ROOT, "public/admin.js"), "utf8");
    assert.match(adminSource, /\/admin\/attention\/\$\{encodeURIComponent\(attentionRouteSlug\(options\.filter\)\)\}\/\$\{encodeURIComponent\(options\.attentionRecordId\)\}/);
    assert.match(adminSource, /openPriceIssueDetail\(id\)/); assert.match(adminSource, /Dismiss Report/); assert.match(adminSource, /Expire Promotion &amp; resolve/); assert.match(adminSource, /Move \/ Correct Store & resolve/);
    assert.match(adminSource, /adminNotificationBell\?\.addEventListener\("click", async \(\) =>/);
    assert.match(adminSource, /await refreshAdminAlerts\(\{ force: true \}\)/, "Opening the bell must fetch current server truth before showing notifications.");
    assert.match(adminSource, /adminBellCount\.textContent = String\(unread\); adminBellCount\.hidden = unread === 0/, "The visible bell badge must show the current unread count.");
    assert.match(adminSource, /window\.addEventListener\("focus", \(\) => \{\s*refreshAdminAlerts\(\{ refreshAttention: true \}\)/, "Returning to Admin must refresh bell and actionable Attention counts.");
    assert.match(adminSource, /<a class="notification-list-button[^`]+href="\$\{escapeHtml\(targetUrl\)\}"[^`]+Review report →/, "Notification UI must expose the dedicated report route as a semantic href.");
  } finally { await stopServer(app); }
  console.log("Shopper price-report persistence, exact linkage, moderation, correction, dismissal, notification, privacy, routing, and failure tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
