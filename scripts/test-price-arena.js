"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const { productComparison, storeLeaderboard, categoryLeaderboards, optimizeBasket, dietaryConflicts, sizeCompatible } = require("../src/priceArena");

const ROOT = path.join(__dirname, "..");
const openDb = (dir) => new sqlite3.Database(path.join(dir, "grocery_radar.sqlite"));
const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function done(error) { error ? reject(error) : resolve(this); }));
const get = (db, sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
const all = (db, sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const close = (db) => new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
const freePort = () => new Promise((resolve, reject) => { const socket = net.createServer(); socket.on("error", reject); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });

async function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-price-arena-data-"));
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-price-arena-uploads-"));
  const seedDb = openDb(dataDir); const seededAt = new Date().toISOString();
  await run(seedDb, "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, email TEXT, password_hash TEXT, points INTEGER NOT NULL DEFAULT 0, accuracy_score INTEGER NOT NULL DEFAULT 0, is_email_verified INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT, is_admin INTEGER NOT NULL DEFAULT 0, is_super_admin INTEGER NOT NULL DEFAULT 0, account_status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)");
  await run(seedDb, "INSERT INTO users (username,email,password_hash,is_email_verified,email_verified_at,created_at) VALUES ('elcastilo','juricbu@gmail.com',?,1,?,?)", [await bcrypt.hash("ArenaOwner123!", 12), seededAt, seededAt]); await close(seedDb);
  const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], { cwd: ROOT, env: { ...process.env, NODE_ENV: "test", HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, UPLOADS_DIR: uploadsDir, SESSION_SECRET: "price-arena-test-secret", EMAIL_TEST_MODE: "1", AI_API_KEY: "", OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const output = []; child.stdout.on("data", (chunk) => output.push(String(chunk))); child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  for (let count = 0; count < 150; count += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) return { baseUrl, dataDir, child, output }; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(output.join(""));
}

async function stopServer(app) { if (app.child.exitCode !== null) return; app.child.kill("SIGTERM"); await new Promise((resolve) => { const timer = setTimeout(resolve, 2000); app.child.once("exit", () => { clearTimeout(timer); resolve(); }); }); }

function unitTests() {
  const stores = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `Store ${index + 1}` }));
  const rows = stores.map((store, index) => ({ id: index + 1, product_id: 1, store_id: store.id, store_name: store.name, price: 2.85 + index * 0.1, category: "dairy", unit: "gallon" }));
  const comparison = productComparison(rows, stores);
  assert.equal(comparison.stores.length, 6); assert.equal(comparison.cheapest_store_name, "Store 1"); assert.equal(comparison.stores[1].difference_from_cheapest, 0.1);
  const leaderboardRows = []; for (let product = 1; product <= 40; product += 1) for (const store of stores) leaderboardRows.push({ product_id: product, store_id: store.id, store_name: store.name, price: store.id + product / 100, category: ["produce","dairy","pantry"][product % 3], unit: "each" });
  const leaderboard = storeLeaderboard(leaderboardRows, { minimum_broad_products: 20, minimum_broad_categories: 3, no_clear_leader_margin: 1 });
  assert.equal(leaderboard.comparable_product_count, 40); assert.equal(leaderboard.threshold_met, true); assert.equal(leaderboard.rankings[0].lowest_count, 40);
  assert.ok(categoryLeaderboards(leaderboardRows, {}, "all").length >= 3);
  const basketRows = [{ product_id: 1, store_id: 1, store_name: "Store 1", price: 1 }, { product_id: 1, store_id: 2, store_name: "Store 2", price: 5 }, { product_id: 2, store_id: 1, store_name: "Store 1", price: 5 }, { product_id: 2, store_id: 2, store_name: "Store 2", price: 1 }];
  const basket = optimizeBasket([{ product_id: 1, quantity: 1 }, { product_id: 2, quantity: 2 }], basketRows, stores, 2);
  assert.equal(basket.selected.store_ids.length, 2); assert.equal(basket.selected.matched_count, 2); assert.equal(basket.selected.estimated_total, 3);
  assert.deepEqual(dietaryConflicts({ lactose_free: true }, { lactose_free: false }), ["lactose free compatibility is not verified"]);
  assert.equal(sizeCompatible({ default_unit: "pack", default_size_text: "12 pack" }, { default_unit: "pack", default_size_text: "24 pack" }), false);
  assert.equal(sizeCompatible({ default_unit: "oz", default_size_text: "12 oz" }, { default_unit: "oz", default_size_text: "24 oz" }), false);
  const conditionalRows = [{ id: 1, product_id: 9, store_id: 1, store_name: "Store 1", price: 2.49, price_type: "digital_coupon", promotion_conditions: "Digital coupon required" }, { id: 2, product_id: 9, store_id: 2, store_name: "Store 2", price: 2.69, price_type: "regular" }];
  assert.equal(productComparison(conditionalRows, stores, "all").cheapest_store_name, "Store 1"); assert.equal(productComparison(conditionalRows, stores, "unconditional").cheapest_store_name, "Store 2");
  const multi = [{ product_id: 10, store_id: 1, store_name: "Store 1", price: 5, price_type: "multi_buy", multibuy_quantity: 2, multibuy_total_price: 5 }];
  assert.equal(optimizeBasket([{ product_id: 10, quantity: 1 }], multi, stores, 1).selected.matched_count, 0); assert.equal(optimizeBasket([{ product_id: 10, quantity: 2 }], multi, stores, 1).selected.estimated_total, 5);
}

async function integrationTests() {
  const app = await startServer();
  try {
    const db = openDb(app.dataDir); const now = new Date().toISOString(); const today = now.slice(0, 10); const farFuture = "2099-12-31T23:59:59.000Z"; const owner = await get(db, "SELECT id FROM users WHERE username='elcastilo'");
    const storeIds = [];
    for (let index = 1; index <= 6; index += 1) { const result = await run(db, "INSERT INTO stores (name,address,city,state,active,created_at) VALUES (?,?,'Janesville','WI',1,?)", [`Arena Store ${index}`, `${index} Arena Rd`, now]); storeIds.push(result.lastID); }
    const productIds = [];
    for (let product = 1; product <= 30; product += 1) {
      const category = ["produce","dairy","pantry"][product % 3];
      const result = await run(db, "INSERT INTO products (canonical_name,display_name,default_unit,category,status,created_at,updated_at) VALUES (?,?,'each',?,'active',?,?)", [`arena product ${product}`, `Arena Product ${product}`, category, now, now]);
      productIds.push(result.lastID);
      for (let store = 0; store < storeIds.length; store += 1) await run(db, `INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,?,?,?,1,'each',?,'shelf_tag_photo','high','approved','regular',?,?,?,?, 'not_required')`, [owner.id, storeIds[store], result.lastID, `Arena Product ${product}`, category, Number((1 + store * .25 + product / 100).toFixed(2)), Number((1 + store * .25 + product / 100).toFixed(2)), today, now, now, farFuture]);
    }
    const source = await run(db, "INSERT INTO products (canonical_name,display_name,default_size_text,default_unit,category,product_attributes_json,status,created_at,updated_at) VALUES ('arena zero cola','Arena Zero Cola','12 pack','pack','drinks','{\"zero_sugar\":true}','active',?,?)", [now, now]);
    const sourceProduct = source.lastID;
    const substitute = await run(db, "INSERT INTO products (canonical_name,display_name,default_size_text,default_unit,category,product_attributes_json,status,created_at,updated_at) VALUES ('arena substitute','Arena Store Brand Substitute','12 pack','pack','drinks','{\"zero_sugar\":true}','active',?,?)", [now, now]);
    await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,size_text,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,'Arena Zero Cola','drinks',0.99,1,'pack',0.99,'12 pack','shelf_tag_photo','high','approved','regular',?,?,?,?, 'not_required')", [owner.id, storeIds[0], sourceProduct, today, now, now, farFuture]);
    await run(db, "INSERT INTO product_substitutions (source_product_id,target_product_id,substitution_type,confidence,reasons_json,safety_warnings_json,source,status,created_at,updated_at) VALUES (?,?,'very_similar','high','[\"Same product family\",\"Comparable package size\"]','[]','staff_review','confirmed',?,?)", [sourceProduct, substitute.lastID, now, now]);
    await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,size_text,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,'Arena Store Brand Substitute','drinks',0.49,1,'pack',0.49,'12 pack','shelf_tag_photo','high','approved','regular',?,?,?,?, 'not_required')", [owner.id, storeIds[0], substitute.lastID, today, now, now, farFuture]);
    const chicagoProduct = await run(db, "INSERT INTO products (canonical_name,display_name,default_unit,category,status,created_at,updated_at) VALUES ('chicago page product','Chicago Page Product','each','pantry','active',?,?)", [now, now]);
    await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,proof_type,source_url,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,'Chicago Page Product','pantry',0.01,1,'each',0.01,'store_page','https://example.test/pickup/chicago','high','approved','regular',?,?,?,?, 'legacy_unknown')", [owner.id, storeIds[0], chicagoProduct.lastID, today, now, now, farFuture]);
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,'Arena Product 2','pantry',2.50,1,'each',2.50,'receipt_photo','high','expired','regular',?,?,?,?, 'not_required')", [owner.id, storeIds[0], productIds[1], yesterday.slice(0,10), yesterday, yesterday, yesterday]);
    const expiredProduct = await run(db, "INSERT INTO products (canonical_name,display_name,default_unit,category,status,created_at,updated_at) VALUES ('expired arena promo','Expired Arena Promo','each','pantry','active',?,?)", [now, now]);
    await run(db, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,proof_type,confidence,status,price_type,valid_from_date,valid_through_date,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,'Expired Arena Promo','pantry',1.59,1,'each',1.59,'weekly_ad','high','approved','one_day_sale','2026-08-11','2026-08-11','2026-08-11',?,?,?, 'not_required')", [owner.id, storeIds[0], expiredProduct.lastID, now, now, farFuture]);
    await close(db);

    const showdown = await fetch(`${app.baseUrl}/api/savings/store-showdown?window=week`).then((response) => response.json());
    const fixtureStores = showdown.leaderboard.rankings.filter((row) => row.store_name.startsWith("Arena Store"));
    assert.equal(fixtureStores.length, 6); assert.equal(showdown.leaderboard.threshold_met, true); assert.equal(showdown.leaderboard.comparable_product_count, 30);
    const comparison = await fetch(`${app.baseUrl}/api/savings/products/${productIds[1]}/comparison`).then((response) => response.json());
    assert.equal(comparison.comparison.stores.length, 6); assert.equal(comparison.comparison.stores[0].store_name, "Arena Store 1");
    assert.doesNotMatch(JSON.stringify(comparison), /photo_path|reviewed_by|location_evidence_text|tracking_token|password_hash/i, "Public arena responses must not expose private proof, staff, or token fields.");
    const basketResponse = await fetch(`${app.baseUrl}/api/savings/basket`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: productIds.slice(1, 11).map((product_id) => ({ product_id, quantity: 1 })), max_stores: 2 }) });
    assert.equal(basketResponse.status, 200); const basket = await basketResponse.json(); assert.equal(basket.selected.matched_count, 10); assert.ok(basket.selected.store_ids.length > 0 && basket.selected.store_ids.length <= 2);
    const categoryBasket = await fetch(`${app.baseUrl}/api/savings/categories/pantry/basket`).then((response) => response.json()); assert.ok(categoryBasket.product_count > 0); assert.ok(categoryBasket.store_coverage.every((plan) => Number.isInteger(plan.matched_count)));
    const substitutes = await fetch(`${app.baseUrl}/api/savings/products/${sourceProduct}/substitutes`).then((response) => response.json());
    assert.equal(substitutes.substitutes.length, 1); assert.equal(substitutes.substitutes[0].same_product, false); assert.ok(substitutes.substitutes[0].potential_savings > 0);
    const chicago = await fetch(`${app.baseUrl}/api/savings/products/${chicagoProduct.lastID}/comparison`).then((response) => response.json());
    assert.equal(chicago.comparison.comparable_store_count, 0, "A Chicago-configured online price must not enter Janesville competition.");
    const expired = await fetch(`${app.baseUrl}/api/savings/products/${expiredProduct.lastID}/comparison`).then((response) => response.json()); assert.equal(expired.comparison.comparable_store_count, 0, "Expired promotions must remain historical but not compete as current.");
    const dbHistory = openDb(app.dataDir); assert.equal((await get(dbHistory, "SELECT COUNT(*) AS count FROM price_reports WHERE product_id=?", [expiredProduct.lastID])).count, 1); await close(dbHistory);
    const drops = await fetch(`${app.baseUrl}/api/savings/price-drops?window=week`).then((response) => response.json()); assert.ok(drops.drops.some((drop) => Number(drop.report.product_id) === productIds[1] && drop.type === "observed"));

    const login = await fetch(`${app.baseUrl}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "juricbu@gmail.com", password: "ArenaOwner123!" }) }); assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0]; const adminPost = (url, body) => fetch(`${app.baseUrl}${url}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
    const settings = await adminPost("/api/admin/price-arena/settings", { minimum_broad_products: 20, minimum_broad_categories: 3, no_clear_leader_margin: 1, history_window_days: 30 }); assert.equal(settings.status, 200);
    const familyResponse = await adminPost("/api/admin/product-families", { display_name: "Zero-Sugar Cola", category: "drinks", key_attributes: { zero_sugar: true } }); assert.ok([200,201].includes(familyResponse.status)); const family = (await familyResponse.json()).family;
    assert.equal((await adminPost(`/api/admin/product-families/${family.id}/members`, { product_id: sourceProduct, attributes: { zero_sugar: true } })).status, 200);
    const locationAttention = await fetch(`${app.baseUrl}/api/admin/operations/attention?category=location_unresolved`, { headers: { cookie } }).then((response) => response.json()); assert.ok(locationAttention.items.some((item) => Number(item.id) === chicagoProduct.lastID || item.title === "Chicago Page Product"));
    const chicagoReport = locationAttention.items.find((item) => item.title === "Chicago Page Product");
    assert.equal((await adminPost(`/api/admin/prices/${chicagoReport.id}/location`, { status: "verified_exact_store", store_id: storeIds[0], evidence_note: "Human verified visible Janesville pickup location in fixture." })).status, 200);
    const verifiedChicago = await fetch(`${app.baseUrl}/api/savings/products/${chicagoProduct.lastID}/comparison`).then((response) => response.json()); assert.equal(verifiedChicago.comparison.comparable_store_count, 1);

    const db2 = openDb(app.dataDir); const seventh = await run(db2, "INSERT INTO stores (name,address,city,state,active,created_at) VALUES ('Arena Store 7','7 Arena Rd','Janesville','WI',1,?)", [now]);
    await run(db2, "INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,proof_type,confidence,status,price_type,source_date,reviewed_at,submitted_at,expires_at,location_verification_status) VALUES (?,?,?,'Arena Product 2','pantry',0.50,1,'each',0.50,'receipt_photo','high','approved','regular',?,?,?,?, 'not_required')", [owner.id, seventh.lastID, productIds[1], today, now, now, farFuture]);
    const release = await get(db2, "SELECT status,published_at FROM homepage_patch_notes WHERE version_label='v0.9.7'"); assert.deepEqual(release, { status: "draft", published_at: null }); await close(db2);
    const withSeventh = await fetch(`${app.baseUrl}/api/savings/products/${productIds[1]}/comparison`).then((response) => response.json());
    assert.ok(withSeventh.comparison.stores.some((row) => row.store_name === "Arena Store 7"), "A newly added active Janesville store must participate without a code change.");
    const productPage = await fetch(`${app.baseUrl}/api/products/${productIds[1]}`).then((response) => response.json()); assert.equal(productPage.store_comparison.stores.length, 7);
    const clientSource = fs.readFileSync(path.join(ROOT, "client/src/App.jsx"), "utf8"); assert.match(clientSource, /Savings across every store/); assert.match(clientSource, /no shopper account required/); assert.match(clientSource, /Substitutes are different products/);
  } finally { await stopServer(app); }
}

unitTests();
integrationTests().then(() => console.log("All-store arena, basket, substitute, dynamic-store, and Janesville-location tests passed.")).catch((error) => { console.error(error); process.exit(1); });
