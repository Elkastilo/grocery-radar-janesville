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
const { PRICE_TYPES, PUBLIC_REJECTION_REASONS, localDateFor, promotionEligibility, promotionGate } = require("../src/promotion");

const ROOT = path.join(__dirname, "..");
const OWNER_EMAIL = "juricbu@gmail.com";
const OWNER_PASSWORD = "OwnerLaunchPass123!";

function temp(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }
function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
function openDb(dataDir) { return new sqlite3.Database(path.join(dataDir, "grocery_radar.sqlite")); }
function runDb(db, sql, params = []) { return new Promise((resolve, reject) => db.run(sql, params, function done(error) { if (error) reject(error); else resolve(this); })); }
function getDb(db, sql, params = []) { return new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row))); }
function allDb(db, sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))); }
function closeDb(db) { return new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve())); }

async function seedOwner(dataDir) {
  const db = openDb(dataDir);
  await runDb(db, "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT, password_hash TEXT, points INTEGER NOT NULL DEFAULT 0, accuracy_score INTEGER NOT NULL DEFAULT 0, is_email_verified INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_super_admin INTEGER NOT NULL DEFAULT 0, account_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)");
  await runDb(db, "INSERT INTO users (username,email,password_hash,is_email_verified,email_verified_at,created_at) VALUES ('elcastilo',?,?,1,?,?)", [OWNER_EMAIL, await bcrypt.hash(OWNER_PASSWORD, 12), new Date().toISOString(), new Date().toISOString()]);
  await closeDb(db);
}

class Client {
  constructor(baseUrl) { this.baseUrl = baseUrl; this.cookie = ""; }
  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.cookie) headers.cookie = this.cookie;
    const response = await fetch(`${this.baseUrl}${url}`, { ...options, headers });
    const cookie = response.headers.get("set-cookie"); if (cookie) this.cookie = cookie.split(";")[0];
    const body = (response.headers.get("content-type") || "").includes("json") ? await response.json() : await response.text();
    return { response, body };
  }
  get(url) { return this.request(url); }
  post(url, value) { return this.request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) }); }
}

async function startServer() {
  const dataDir = temp("grocery-major-data-"); const uploadsDir = temp("grocery-major-uploads-"); await seedOwner(dataDir); const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, UPLOADS_DIR: uploadsDir, SESSION_SECRET: "major-pass-test", EMAIL_TEST_MODE: "1", AI_API_KEY: "", OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = []; child.stdout.on("data", (chunk) => output.push(String(chunk))); child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let count = 0; count < 100; count += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) return { baseUrl, dataDir, uploadsDir, child, output }; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(`Server did not start: ${output.join("")}`);
}

async function stopServer(app) { if (app.child.exitCode !== null) return; app.child.kill("SIGTERM"); await new Promise((resolve) => { const timer = setTimeout(resolve, 2000); app.child.once("exit", () => { clearTimeout(timer); resolve(); }); }); }

async function main() {
  assert.ok(PRICE_TYPES.includes("one_day_sale"));
  assert.ok(PRICE_TYPES.includes("loyalty_price"));
  assert.ok(PUBLIC_REJECTION_REASONS.includes("promotion dates unclear"));
  assert.equal(PUBLIC_REJECTION_REASONS.includes("one-day sale"), false);
  const aug11NoonChicago = new Date("2026-08-11T17:00:00.000Z");
  const aug12Chicago = new Date("2026-08-12T05:01:00.000Z");
  assert.equal(promotionEligibility({ price_type: "one_day_sale", valid_from_date: "2026-08-11", valid_through_date: "2026-08-11" }, aug11NoonChicago).eligible, true);
  assert.equal(promotionEligibility({ price_type: "one_day_sale", valid_from_date: "2026-08-11", valid_through_date: "2026-08-11" }, aug12Chicago).reason, "expired");
  assert.deepEqual(promotionGate({ price_type: "one_day_sale", display_offer_text: "TODAY ONLY" }).flags, ["DATE NEEDS REVIEW"]);
  assert.equal(promotionGate({ price_type: "multi_buy", display_offer_text: "2 for $5", promotion_conditions: "Must buy 2." }).ready, true);
  assert.equal(promotionGate({ price_type: "loyalty_price", promotion_conditions: "Rewards Card required." }).ready, true);

  const app = await startServer();
  try {
    const owner = new Client(app.baseUrl);
    assert.equal((await owner.post("/api/auth/login", { email: OWNER_EMAIL, password: OWNER_PASSWORD })).response.status, 200);
    const stores = (await owner.get("/api/stores")).body.stores;
    const store = stores.find((item) => /ALDI/i.test(item.name)) || stores[0];
    const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#24a148" } }).png().toBuffer();
    const anonymousForm = new FormData(); anonymousForm.append("store_id", String(store.id)); anonymousForm.append("proof_type", "weekly_ad"); anonymousForm.append("proof_photo", new Blob([image], { type: "image/png" }), "weekly.png");
    const anonymous = await fetch(`${app.baseUrl}/api/proof-submissions`, { method: "POST", body: anonymousForm }); const anonymousBody = await anonymous.json();
    assert.equal(anonymous.status, 201, JSON.stringify(anonymousBody)); assert.match(anonymousBody.tracking_token, /^[A-Za-z0-9_-]{40,}$/);
    const db = openDb(app.dataDir); const now = new Date().toISOString();
    await runDb(db, "UPDATE price_import_batches SET review_status='ready_to_finish', review_decision='ready_to_finish' WHERE id=?", [anonymousBody.batch_id]);
    await runDb(db, "INSERT INTO price_import_rows (batch_id,store_id,item_name,category,price,quantity,unit,proof_type,status,public_rejection_reason,public_reviewer_explanation,admin_rejection_note,created_at,updated_at) VALUES (?,?, 'Bananas','produce',0.49,1,'lb','weekly_ad','approved','', '', 'private approved note',?,?)", [anonymousBody.batch_id, store.id, now, now]);
    await runDb(db, "INSERT INTO price_import_rows (batch_id,store_id,item_name,category,price,quantity,unit,proof_type,status,rejection_reason,public_rejection_reason,public_reviewer_explanation,admin_rejection_note,created_at,updated_at) VALUES (?,?, 'Cherry Tomatoes','produce',1.99,1,'each','weekly_ad','rejected','promotion dates unclear','promotion dates unclear','Date banner was not visible.','AI guessed a date; do not expose.',?,?)", [anonymousBody.batch_id, store.id, now, now]);
    await closeDb(db);
    const completed = await owner.post(`/api/admin/v2/reviews/${anonymousBody.batch_id}/complete`, {}); assert.equal(completed.response.status, 200, JSON.stringify(completed.body));
    const repeated = await owner.post(`/api/admin/v2/reviews/${anonymousBody.batch_id}/complete`, {}); assert.equal(repeated.response.status, 200);
    const status = await fetch(`${app.baseUrl}/api/submissions/status/${anonymousBody.tracking_token}`); const statusBody = await status.json();
    assert.equal(statusBody.submission.status, "reviewed"); assert.equal(statusBody.submission.approved_count, 1); assert.equal(statusBody.submission.not_approved_count, 1);
    const publicJson = JSON.stringify(statusBody); assert.doesNotMatch(publicJson, /private approved note|AI guessed|email|filesystem|photo_path|staff_id|user_id/i);
    const checkDb = openDb(app.dataDir); assert.equal((await getDb(checkDb, "SELECT COUNT(*) AS count FROM submission_outcomes WHERE proof_id=?", [anonymousBody.batch_id])).count, 1); const privateProof = await getDb(checkDb, "SELECT photo_path FROM price_import_batches WHERE id=?", [anonymousBody.batch_id]); await closeDb(checkDb);
    assert.equal((await fetch(`${app.baseUrl}${privateProof.photo_path}`)).status, 404, "Original proof uploads must never be public.");

    const bulk = new FormData(); bulk.append("title", "20 screenshot acceptance batch"); bulk.append("store_id", String(store.id)); bulk.append("proof_type", "store_page");
    const buffers = [];
    for (let index = 0; index < 17; index += 1) buffers.push(await sharp({ create: { width: 5, height: 5, channels: 3, background: { r: index * 11, g: 100, b: 170 } } }).png().toBuffer());
    buffers.forEach((buffer, index) => bulk.append("screenshots", new Blob([buffer], { type: "image/png" }), `normal-${index}.png`));
    bulk.append("screenshots", new Blob([buffers[0]], { type: "image/png" }), "duplicate-one.png"); bulk.append("screenshots", new Blob([buffers[0]], { type: "image/png" }), "duplicate-two.png"); bulk.append("screenshots", new Blob([Buffer.from("not an image")], { type: "image/png" }), "corrupt.png");
    const bulkResponse = await owner.request("/api/admin/bulk-price-intake", { method: "POST", body: bulk });
    assert.equal(bulkResponse.response.status, 201, JSON.stringify(bulkResponse.body)); assert.equal(bulkResponse.body.batch.file_count, 20); assert.equal(bulkResponse.body.batch.counts.duplicate, 2); assert.equal(bulkResponse.body.batch.counts.failed, 1);
    const bulkDb = openDb(app.dataDir); const proofJobs = await getDb(bulkDb, "SELECT COUNT(DISTINCT jobs.proof_id) AS count, COUNT(*) AS rows FROM ai_proof_jobs jobs JOIN price_import_batches proofs ON proofs.id=jobs.proof_id WHERE proofs.bulk_intake_batch_id=?", [bulkResponse.body.batch.id]); assert.equal(proofJobs.count, proofJobs.rows); const draftsPublished = await getDb(bulkDb, "SELECT COUNT(*) AS count FROM price_reports reports JOIN price_import_batches proofs ON proofs.id=reports.source_import_batch_id WHERE proofs.bulk_intake_batch_id=?", [bulkResponse.body.batch.id]); assert.equal(draftsPublished.count, 0);
    const productNow = new Date().toISOString();
    const bananaProduct = await runDb(bulkDb, "INSERT INTO products (canonical_name,display_name,category,common_aliases,status,created_at,updated_at) VALUES ('bananas','Bananas','produce','banana','active',?,?)", [productNow, productNow]);
    await runDb(bulkDb, "INSERT INTO products (canonical_name,display_name,category,default_size_text,common_aliases,status,created_at,updated_at) VALUES ('whole milk','Whole Milk 1 gal','dairy','1 gal','whole-milk-1gal','active',?,?),('2 milk','2% Milk 1 gal','dairy','1 gal','2-milk-1gal','active',?,?)", [productNow, productNow, productNow, productNow]);
    const grilled = await runDb(bulkDb, "INSERT INTO products (canonical_name,display_name,category,status,created_at,updated_at) VALUES ('grilled cheese sandwich','Grilled Cheese Sandwich','prepared food','active',?,?)", [productNow, productNow]);
    const ownerRow = await getDb(bulkDb, "SELECT id FROM users WHERE email=?", [OWNER_EMAIL]); const kwikTrip = await getDb(bulkDb, "SELECT id FROM stores WHERE name LIKE '%Kwik Trip%' ORDER BY id LIMIT 1"); const today = localDateFor(); const yesterday = new Date(`${today}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1); const yesterdayDate = yesterday.toISOString().slice(0, 10);
    await runDb(bulkDb, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,sale_price,quantity,unit,unit_price,proof_type,confidence,status,price_type,valid_from_date,valid_through_date,promotion_conditions,promotion_schedule_text,display_offer_text,submitted_at,expires_at) VALUES (?,?,?,'Grilled Cheese Sandwich','prepared food',1.59,1,1,'each',1.59,'weekly_ad','high','approved','one_day_sale',?,?,'Tuesday only','TODAY ONLY','$1.59',?,?),(?,?,?,'Grilled Cheese Sandwich','prepared food',2.99,0,1,'each',2.99,'shelf_tag_photo','high','approved','regular','','','','','',?,?)", [ownerRow.id, store.id, grilled.lastID, yesterdayDate, yesterdayDate, productNow, `${yesterdayDate}T23:59:59.000Z`, ownerRow.id, store.id, grilled.lastID, productNow, new Date(Date.now() + 7 * 86400000).toISOString()]);
    await runDb(bulkDb, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,sale_price,quantity,unit,unit_price,proof_type,confidence,status,price_type,valid_from_date,valid_through_date,promotion_conditions,promotion_schedule_text,display_offer_text,submitted_at,expires_at) VALUES (?,?,?,'Grilled Cheese Sandwich','prepared food',1.59,1,1,'each',1.59,'weekly_ad','high','approved','one_day_sale','2026-08-11','2026-08-11','Tuesday only','TODAY ONLY','$1.59',?,'2026-08-11T23:59:59.000Z')", [ownerRow.id, kwikTrip.id, grilled.lastID, productNow]);
    const release = await getDb(bulkDb, "SELECT status,published_at FROM homepage_patch_notes WHERE version_label='v0.9.5'"); assert.equal(release.status, "draft"); assert.equal(release.published_at, null); await closeDb(bulkDb);
    const currentGrilled = await fetch(`${app.baseUrl}/api/products?q=grilled`).then((result) => result.json()); const grilledPublic = currentGrilled.products.find((product) => Number(product.id) === grilled.lastID); assert.equal(Number(grilledPublic.best_price), 2.99); assert.doesNotMatch(JSON.stringify(grilledPublic), /elcastilo/i, "A legacy report owner must not be exposed as an anonymous submitter.");
    const historyDb = openDb(app.dataDir); const historicalPromotion = await getDb(historyDb, "SELECT status FROM price_reports WHERE product_id=? AND price_type='one_day_sale' ORDER BY valid_through_date DESC LIMIT 1", [grilled.lastID]); assert.equal(historicalPromotion.status, "approved"); const kwikFixture = await getDb(historyDb, "SELECT price_type,valid_from_date,valid_through_date,promotion_conditions,status FROM price_reports WHERE product_id=? AND store_id=?", [grilled.lastID, kwikTrip.id]); assert.deepEqual(kwikFixture, { price_type: "one_day_sale", valid_from_date: "2026-08-11", valid_through_date: "2026-08-11", promotion_conditions: "Tuesday only", status: "approved" }); assert.equal((await allDb(historyDb, "SELECT id FROM price_reports WHERE product_id=?", [grilled.lastID])).length, 3); await closeDb(historyDb);
    const bananaImage = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#ffe135" } }).jpeg().toBuffer();
    const milkImage = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#f5f5f5" } }).jpeg().toBuffer();
    const unknownImage = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#663399" } }).jpeg().toBuffer();
    const imageForm = new FormData(); imageForm.append("title", "Product image acceptance batch"); imageForm.append("source_type", "owner_photo"); imageForm.append("source_note", "Owner-created disposable test photos"); imageForm.append("images", new Blob([bananaImage], { type: "image/jpeg" }), "banana.jpg"); imageForm.append("images", new Blob([milkImage], { type: "image/jpeg" }), "milk.jpg"); imageForm.append("images", new Blob([unknownImage], { type: "image/jpeg" }), "unknown-photo.jpg"); imageForm.append("images", new Blob([bananaImage], { type: "image/jpeg" }), "duplicate-banana.jpg");
    const imageBatch = await owner.request("/api/admin/product-images/bulk", { method: "POST", body: imageForm }); assert.equal(imageBatch.response.status, 201, JSON.stringify(imageBatch.body));
    const bananaItem = imageBatch.body.batch.items.find((item) => item.original_name === "banana.jpg"); const milkItem = imageBatch.body.batch.items.find((item) => item.original_name === "milk.jpg"); const unknownItem = imageBatch.body.batch.items.find((item) => item.original_name === "unknown-photo.jpg"); const duplicateItem = imageBatch.body.batch.items.find((item) => item.original_name === "duplicate-banana.jpg");
    assert.equal(bananaItem.match_confidence, "high"); assert.equal(Number(bananaItem.suggested_product_id), bananaProduct.lastID); assert.ok(["check", "unknown"].includes(milkItem.match_confidence)); assert.equal(unknownItem.match_confidence, "unknown"); assert.equal(duplicateItem.status, "duplicate");
    const acceptedImage = await owner.post(`/api/admin/product-images/bulk/items/${bananaItem.id}/accept`, { product_id: bananaProduct.lastID, approve_public: true }); assert.equal(acceptedImage.response.status, 200, JSON.stringify(acceptedImage.body));
    const publicProducts = await fetch(`${app.baseUrl}/api/products?q=bananas`).then((result) => result.json()); const publicBanana = publicProducts.products.find((product) => Number(product.id) === bananaProduct.lastID); assert.match(publicBanana.image_url, /^\/api\/product-images\/\d+\/file$/); assert.equal((await fetch(`${app.baseUrl}${publicBanana.image_url}`)).status, 200);
    assert.equal((await fetch(`${app.baseUrl}/api/admin/product-images/${acceptedImage.body.image_id}/file`)).status, 403);
    assert.equal((await new Client(app.baseUrl).get("/api/admin/operations/overview?pin=1234")).response.status, 403);
  } finally { await stopServer(app); }
  console.log("Major intake, promotion, anonymous outcome, privacy, and batch acceptance tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
