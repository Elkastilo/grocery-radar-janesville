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
const OWNER_PASSWORD = "OperationsScalePass123!";
const openDb = (dataDir) => new sqlite3.Database(path.join(dataDir, "grocery_radar.sqlite"));
const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function done(error) { if (error) reject(error); else resolve(this); }));
const get = (db, sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
const close = (db) => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
const freePort = () => new Promise((resolve, reject) => { const socket = net.createServer(); socket.on("error", reject); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });

class Client {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.cookie = ""; }
  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) }; if (this.cookie) headers.cookie = this.cookie;
    const response = await fetch(`${this.baseUrl}${url}`, { ...options, headers });
    const cookie = response.headers.get("set-cookie"); if (cookie) this.cookie = cookie.split(";")[0];
    const type = response.headers.get("content-type") || "";
    const body = type.includes("json") ? await response.json() : await response.text();
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-operations-scale-data-"));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-operations-scale-uploads-"));
  await seedOwner(dataDir); const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, UPLOADS_DIR: uploadsDir, SESSION_SECRET: "operations-scale-test-secret", EMAIL_TEST_MODE: "1", AI_API_KEY: "", OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = []; child.stdout.on("data", (chunk) => output.push(String(chunk))); child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let count = 0; count < 150; count += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) return { baseUrl, dataDir, child, output }; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(output.join(""));
}

async function stopServer(app) { if (app.child.exitCode !== null) return; app.child.kill("SIGTERM"); await new Promise((resolve) => { const timer = setTimeout(resolve, 2000); app.child.once("exit", () => { clearTimeout(timer); resolve(); }); }); }

async function main() {
  const app = await startServer();
  try {
    const owner = new Client(app.baseUrl);
    const login = await owner.post("/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD });
    assert.equal(login.response.status, 200, JSON.stringify(login.body));
    const db = openDb(app.dataDir); const now = new Date().toISOString();
    const store = await get(db, "SELECT id FROM stores WHERE active = 1 ORDER BY id LIMIT 1");
    const ownerRow = await get(db, "SELECT id FROM users WHERE email = ?", [OWNER_EMAIL]);
    const productA = await run(db, "INSERT INTO products (canonical_name,display_name,preferred_brand,default_size_text,default_unit,category,upc,common_aliases,status,created_at,updated_at) VALUES ('coca cola 12 pack','Coca-Cola 12 Pack','Coca-Cola','12 pack','pack','drinks','036000291452','coke zero','active',?,?)", [now, now]);
    const productB = await run(db, "INSERT INTO products (canonical_name,display_name,preferred_brand,default_size_text,default_unit,category,common_aliases,status,created_at,updated_at) VALUES ('coca cola 12 pack','Coca Cola 12pk','Coca-Cola','12 pack','pack','drinks','coke','active',?,?)", [now, now]);
    await run(db, "INSERT INTO product_barcodes (product_id,barcode_type,normalized_value,status,source,created_at,updated_at) VALUES (?, 'upc_a', '036000291452', 'verified', 'test', ?, ?)", [productA.lastID, now, now]);
    const report = await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,size_text,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at) VALUES (?,?,?,'Coca Cola 12pk','drinks',4.99,1,'pack',4.99,'12 pack','shelf_tag_photo','high','approved','regular',?,?,?,?)", [ownerRow.id, store.id, productB.lastID, now.slice(0, 10), now, now, new Date(Date.now() + 7 * 86400000).toISOString()]);
    for (let index = 1; index <= 4; index += 1) {
      const date = new Date(Date.now() - index * 7 * 86400000).toISOString();
      await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,size_text,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at) VALUES (?,?,?,'Coca-Cola 12 Pack','drinks',?,1,'pack',?,'12 pack','receipt','high','expired','regular',?,?,?,?)", [ownerRow.id, store.id, productA.lastID, 5 + index / 10, 5 + index / 10, date.slice(0, 10), date, date, date]);
    }
    await close(db);

    const aliasSearch = await fetch(`${app.baseUrl}/api/search?q=coka%20cola`).then((response) => response.json());
    assert.equal(aliasSearch.search.matched_alias, "coca cola");
    assert.ok(aliasSearch.products.some((product) => product.display_name === "Coca-Cola 12 Pack"));
    await fetch(`${app.baseUrl}/api/search?q=dragon%20fruit`); await fetch(`${app.baseUrl}/api/search?q=dragon%20fruit`);

    const barcode = await owner.get("/api/admin/products/barcode/036000291452");
    assert.equal(barcode.response.status, 200); assert.equal(Number(barcode.body.match.id), productA.lastID);
    const conflict = await owner.post(`/api/admin/products/${productB.lastID}`, { display_name: "Coca Cola 12pk", upc: "036000291452" });
    assert.equal(conflict.response.status, 409, `A verified UPC must never move silently: ${JSON.stringify(conflict.body)}`);

    const duplicates = await owner.get("/api/admin/products/duplicates");
    assert.ok(duplicates.body.candidates.some((item) => Number(item.product_a_id) === productA.lastID || Number(item.product_b_id) === productB.lastID));
    const merge = await owner.post(`/api/admin/products/${productB.lastID}/merge`, { target_product_id: productA.lastID, reason: "Confirmed duplicate fixture" });
    assert.equal(merge.response.status, 200, JSON.stringify(merge.body));
    const moved = await fetch(`${app.baseUrl}/api/products/${productB.lastID}`).then((response) => response.json());
    assert.equal(Number(moved.product.id), productA.lastID); assert.equal(Number(moved.redirected_from_product_id), productB.lastID);

    const correction = await owner.post(`/api/admin/prices/${report.lastID}/correct`, { action: "correct", price: 3.99, product_id: productA.lastID, store_id: store.id, reason: "Incorrect digit fixture" });
    assert.equal(correction.response.status, 200, JSON.stringify(correction.body));
    const publicProduct = await fetch(`${app.baseUrl}/api/products/${productA.lastID}`).then((response) => response.json());
    assert.equal(Number(publicProduct.reports.find((item) => Number(item.id) === report.lastID).price), 3.99);
    assert.equal(publicProduct.price_history.sufficient_history, true);
    const correctionDb = openDb(app.dataDir);
    assert.equal((await get(correctionDb, "SELECT COUNT(*) AS count FROM price_corrections WHERE price_report_id = ?", [report.lastID])).count, 1);
    assert.equal((await get(correctionDb, "SELECT COUNT(*) AS count FROM price_reports WHERE id = ?", [report.lastID])).count, 1);
    await close(correctionDb);

    const anonymousIssue = await fetch(`${app.baseUrl}/api/price-reports/${report.lastID}/issues`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "price changed", note: "Shelf tag now differs" }) });
    assert.equal(anonymousIssue.status, 201);
    const publicAfterReport = await fetch(`${app.baseUrl}/api/products/${productA.lastID}`).then((response) => response.json());
    assert.equal(Number(publicAfterReport.reports.find((item) => Number(item.id) === report.lastID).price), 3.99, "An anonymous report must not change price.");

    const catalog = await owner.post("/api/admin/catalog-imports", { title: "Scale fixture", csv_text: "product_name,brand,size,unit,category,upc,aliases\nGreek Yogurt,Test Brand,32 oz,each,dairy,,yoghurt" });
    assert.equal(catalog.response.status, 201, JSON.stringify(catalog.body)); assert.equal(catalog.body.batch.summary.ready, 1);
    const published = await owner.post(`/api/admin/catalog-imports/${catalog.body.batch.id}/publish`, {});
    assert.equal(published.response.status, 200); assert.equal(published.body.batch.summary.published, 1);

    const command = await owner.get("/api/admin/operations/command-center");
    assert.equal(command.response.status, 200, JSON.stringify(command.body));
    assert.ok(command.body.search_demand.could_not_find.some((item) => item.normalized_query === "dragon fruit" && Number(item.zero_result_searches) === 2));
    assert.ok(Number(command.body.coverage.catalog.products) >= 2);
    assert.equal(command.body.attention.groups.products.find((item) => item.key === "upc_conflict").count, 1);
    const upcAttention = await owner.get("/api/admin/operations/attention?category=upc_conflict");
    assert.equal(upcAttention.body.items.length, 1);
    assert.equal((await owner.post(`/api/admin/barcode-conflicts/${upcAttention.body.items[0].id}/resolve`, { resolution_note: "Existing verified product retained" })).response.status, 200);
    const attention = await owner.get("/api/admin/operations/attention?category=reported_price");
    assert.equal(attention.body.items.length, 1);
    const health = await owner.get("/api/admin/operations/health");
    assert.equal(health.response.status, 200); assert.equal(health.body.database.status, "healthy"); assert.ok(health.body.disk.status);
    const freshness = await owner.get("/api/admin/operations/freshness");
    assert.ok(freshness.body.settings.some((item) => item.proof_type === "receipt_photo"));
    const freshnessUpdate = await owner.post("/api/admin/operations/freshness", { proof_type: "receipt_photo", current_days: 10, aging_days: 25 });
    assert.equal(freshnessUpdate.response.status, 200); assert.equal(freshnessUpdate.body.aging_days, 25);

    for (const kind of ["products", "current-prices", "historical-prices", "stores", "catalog-json"]) {
      const exported = await owner.get(`/api/admin/exports/${kind}`);
      assert.equal(exported.response.status, 200, kind);
      assert.doesNotMatch(String(exported.body), /password_hash|session_token|tracking_token|rate_limit_bucket_hash/i);
    }
    const schemaDb = openDb(app.dataDir);
    const demandColumns = await new Promise((resolve, reject) => schemaDb.all("PRAGMA table_info(search_demand)", (error, rows) => error ? reject(error) : resolve(rows.map((row) => row.name))));
    assert.equal(demandColumns.some((name) => /email|user|ip|device|fingerprint/i.test(name)), false);
    const release = await get(schemaDb, "SELECT status,published_at FROM homepage_patch_notes WHERE version_label='v0.9.6'");
    assert.deepEqual(release, { status: "draft", published_at: null });
    await close(schemaDb);

    const source = fs.readFileSync(path.join(ROOT, "client/src/App.jsx"), "utf8");
    assert.match(source, /Price wrong\? Report price/); assert.match(source, /capture="environment"/); assert.match(source, /Not enough price history yet/);
    assert.match(source, /href="\/privacy\.html"/); assert.match(source, /href="\/terms\.html"/);
    const adminSource = fs.readFileSync(path.join(ROOT, "public/admin.js"), "utf8");
    assert.doesNotMatch(adminSource, /params\.set\(["']pin["']/i, "Admin secrets must not enter URL query strings.");
  } finally { await stopServer(app); }
  console.log("Operations command center, UPC, merge, import, correction, privacy, reporting, health, export, and history tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
