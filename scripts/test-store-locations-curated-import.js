"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-store-locations-"));
process.env.DATA_DIR = dataDir;
const database = require("../src/db");
const locations = require("../src/storeProductLocations");
const importer = require("../src/curatedRetailerImport");
const batch = require("../data/curated/2026-08-14-aldi-woodmans-dairy.json");
const freePort = () => new Promise((resolve, reject) => { const socket = net.createServer(); socket.on("error", reject); socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(() => resolve(port)); }); });

async function main() {
  await database.initDb();
  await database.initDb();
  const now = new Date().toISOString();
  const owner = await database.run("INSERT INTO users (username,email,password_hash,is_admin,is_super_admin,staff_role,account_status,created_at) VALUES ('elcastilo','juricbu@gmail.com','test',1,1,'owner','active',?)", [now]);
  const aldi = await database.get("SELECT * FROM stores WHERE name = 'ALDI Janesville'");
  const woodmans = await database.get("SELECT * FROM stores WHERE name LIKE 'Woodman%Janesville'");
  assert.ok(aldi && woodmans);

  const product = await database.run("INSERT INTO products (canonical_name,display_name,preferred_brand,category,default_size_text,default_unit,status,created_at,updated_at) VALUES ('friendly farms whole milk','Friendly Farms Whole Milk','Friendly Farms','dairy','1 gal','each','active',?,?)", [now, now]);
  const created = await locations.saveStoreProductLocation({ storeId: woodmans.id, productId: product.lastID, location: { department: "Dairy", shelf: "71", verified_at: "2026-08-14T12:00:00-05:00", source_type: "retailer_website_manual", source_reference: "shopwoodmans.com" }, staffId: owner.lastID });
  assert.equal(created.location.shelf, "71");
  assert.equal(locations.locationLabel(created.location), "Dairy • Shelf 71");
  const secondStore = await locations.saveStoreProductLocation({ storeId: aldi.id, productId: product.lastID, location: { department: "Dairy & Eggs", verified_at: "2026-08-14T12:00:00-05:00" }, staffId: owner.lastID });
  assert.equal(locations.locationLabel(secondStore.location), "Dairy & Eggs");
  const updated = await locations.saveStoreProductLocation({ storeId: woodmans.id, productId: product.lastID, location: { department: "Dairy", shelf: "72", verified_at: "2026-08-20T12:00:00-05:00" }, staffId: owner.lastID });
  assert.equal(updated.previous.shelf, "71");
  assert.equal((await database.get("SELECT COUNT(*) AS count FROM store_product_locations WHERE store_id=? AND product_id=?", [woodmans.id, product.lastID])).count, 2);
  assert.equal((await database.get("SELECT COUNT(*) AS count FROM store_product_locations WHERE store_id=? AND product_id=? AND is_current=1", [woodmans.id, product.lastID])).count, 1);

  const before = { products: (await database.get("SELECT COUNT(*) AS count FROM products")).count, reports: (await database.get("SELECT COUNT(*) AS count FROM price_reports")).count, locations: (await database.get("SELECT COUNT(*) AS count FROM store_product_locations")).count };
  const preview = await importer.previewCuratedBatch(batch);
  const after = { products: (await database.get("SELECT COUNT(*) AS count FROM products")).count, reports: (await database.get("SELECT COUNT(*) AS count FROM price_reports")).count, locations: (await database.get("SELECT COUNT(*) AS count FROM store_product_locations")).count };
  assert.deepEqual(after, before, "Dry run must not write.");
  assert.equal(batch.stores[0].rows.length, 32);
  assert.equal(batch.stores[1].rows.length, 82);
  assert.equal(preview.totals.unique_rows, 114);
  assert.equal(preview.totals.existing_products_matched, 1);
  assert.equal(preview.totals.products_would_create, 113);
  assert.equal(preview.stores[0].resolution.store.id, aldi.id);
  assert.equal(preview.stores[1].resolution.store.id, woodmans.id);
  assert.equal(preview.stores[1].resolution.rule, "exact_normalized_address");
  assert.equal(preview.totals.retailer_declared_previous_prices, 12);
  assert.equal(preview.writes_performed, 0);
  assert.ok(preview.family_suggestions.every((suggestion) => suggestion.human_confirmed === false));

  await database.run("UPDATE stores SET address='Unknown address' WHERE id=?", [woodmans.id]);
  const blocked = await importer.previewCuratedBatch({ ...batch, stores: [batch.stores[1]] });
  assert.equal(blocked.apply_blocked, true);
  assert.equal(blocked.stores[0].resolution.code, "STORE_LOCATION_NEEDS_REVIEW");
  await database.run("UPDATE stores SET address='2819 N. Lexington Drive' WHERE id=?", [woodmans.id]);

  const mini = { ...batch, batch_id: "test-curated-mini", stores: [{ ...batch.stores[1], rows: [batch.stores[1].rows.find((row) => row.product_name.startsWith("Kemps Protein+"))] }] };
  const applied = await importer.applyCuratedBatch(mini, importer.APPLY_CONFIRMATION);
  assert.equal(applied.applied_reports.length, 1);
  const report = await database.get("SELECT * FROM price_reports WHERE id=?", [applied.applied_reports[0]]);
  assert.equal(report.price, 3.99);
  assert.equal(report.regular_price, 4.29);
  assert.equal(report.retailer_displayed_discount_percent, 7);
  assert.equal(report.valid_through_date, null);
  assert.equal(report.status, "approved");
  const importedLocation = await locations.currentStoreProductLocation(woodmans.id, report.product_id);
  assert.equal(locations.locationLabel(importedLocation), "Dairy • Shelf 37");
  assert.equal((await database.get("SELECT COUNT(*) AS count FROM product_substitutions")).count, 0);
  assert.equal((await database.get("SELECT COUNT(*) AS count FROM product_images")).count, 0);
  assert.equal((await database.get("SELECT COUNT(*) AS count FROM admin_audit_log WHERE action='CURATED_RETAILER_PRICE_IMPORTED'")).count, 1);
  const repeated = await importer.previewCuratedBatch(mini);
  assert.equal(repeated.totals.duplicate_observations_skipped, 1);
  const correctedLocationCount = (await database.get("SELECT COUNT(*) AS count FROM store_product_locations WHERE product_id=?", [report.product_id])).count;
  await database.run("UPDATE price_reports SET price=4.19, unit_price=4.19, comparison_price=4.19 WHERE id=?", [report.id]);
  assert.equal((await database.get("SELECT COUNT(*) AS count FROM store_product_locations WHERE product_id=?", [report.product_id])).count, correctedLocationCount, "Price correction must not erase or rewrite shelf location.");

  const port = await freePort();
  const child = childProcess.spawn(process.execPath, [path.join(__dirname, "../server.js")], { env: { ...process.env, DATA_DIR: dataDir, UPLOADS_DIR: path.join(dataDir, "uploads"), HOST: "127.0.0.1", PORT: String(port), SESSION_SECRET: "store-location-test", NODE_ENV: "test", EMAIL_HOST: "", EMAIL_USER: "", EMAIL_PASS: "", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "" }, stdio: ["ignore", "pipe", "pipe"] });
  const serverOutput = []; child.stdout.on("data", (chunk) => serverOutput.push(String(chunk))); child.stderr.on("data", (chunk) => serverOutput.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) { try { if ((await fetch(`${baseUrl}/health`)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); }
    const detailResponse = await fetch(`${baseUrl}/api/products/${report.product_id}`);
    assert.equal(detailResponse.status, 200, serverOutput.join(""));
    const detail = await detailResponse.json();
    assert.equal(detail.reports[0].store_product_location.label, "Dairy • Shelf 37");
    assert.equal(detail.store_comparison.stores[0].store_product_location.label, "Dairy • Shelf 37");
    assert.doesNotMatch(JSON.stringify(detail), /source_reference|updated_by_staff_id|private proof/i);
  } finally { child.kill("SIGTERM"); }
  const newer = await database.run("INSERT INTO products (canonical_name,display_name,category,default_size_text,default_unit,status,created_at,updated_at) VALUES ('newer milk','Newer Milk','dairy','1 gal','each','active',?,?)", [now, now]);
  await database.run("INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,quantity,unit,unit_price,proof_type,confidence,status,source_date,submitted_at,expires_at) VALUES (?,?,?,'Newer Milk','dairy',5,1,'each',5,'no_photo','medium','approved','2026-08-15',?,'2099-01-01T00:00:00Z')", [owner.lastID, aldi.id, newer.lastID, now]);
  const conflictBatch = { ...batch, batch_id: "newer-conflict", stores: [{ ...batch.stores[0], rows: [{ product_name: "Newer Milk", brand: "", size: "1 gal", current_price: 4, department: "Dairy" }] }] };
  const conflict = await importer.previewCuratedBatch(conflictBatch);
  assert.equal(conflict.totals.newer_price_conflicts, 1);
  assert.equal(conflict.apply_blocked, true);

  const aiSource = fs.readFileSync(path.join(__dirname, "../src/aiProofEngine.js"), "utf8");
  assert.match(aiSource, /Never infer a likely aisle or shelf/);
  const clientSource = fs.readFileSync(path.join(__dirname, "../client/src/App.jsx"), "utf8");
  assert.match(clientSource, /StoreProductLocation/);
  assert.doesNotMatch(JSON.stringify(batch), /image_url|photo_path|upc/i);
  console.log("Store location and curated retailer import tests passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => database.db.close());
