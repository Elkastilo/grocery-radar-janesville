"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();
const { runRepair, parseArguments } = require("./repair-admin-import-prices");

const ROOT = path.join(__dirname, "..");

function dbRun(database, sql, params = []) {
  return new Promise((resolve, reject) => database.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve(this);
  }));
}

function dbGet(database, sql, params = []) {
  return new Promise((resolve, reject) => database.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function dbAll(database, sql, params = []) {
  return new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function closeDb(database) {
  return new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(baseUrl, child) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (child.exitCode !== null) throw new Error(`Test server exited with ${child.exitCode}.`);
    try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for test server.");
}

async function startServer(dataDir) {
  const port = await freePort();
  const child = childProcess.spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      UPLOADS_DIR: path.join(dataDir, "uploads"),
      SESSION_SECRET: "admin-import-price-repair-test-secret",
      EMAIL_HOST: "",
      EMAIL_USER: "",
      EMAIL_PASS: "",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: ""
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));
  const baseUrl = `http://127.0.0.1:${port}`;
  try { await waitForHealth(baseUrl, child); }
  catch (error) { throw new Error(`${error.message}\n${output.join("")}`); }
  return { baseUrl, async stop() { child.kill("SIGTERM"); await new Promise((resolve) => child.once("exit", resolve)); } };
}

async function insertProduct(database, name, unit, size, now) {
  return (await dbRun(database, `INSERT INTO products (canonical_name,display_name,category,default_size_text,default_quantity,default_unit,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?)`, [name.toLowerCase(), name, "produce", size, 1, unit, now, now])).lastID;
}

async function insertWorkflow(database, fixture) {
  const now = new Date().toISOString();
  const batch = await dbRun(database, `INSERT INTO price_import_batches (source_type,proof_type,photo_path,status,source_url,source_domain,default_store_id,batch_title,notes,created_by,created_at,updated_at) VALUES (?,?, '', 'ready_for_review',?,'walmart.com',?,?,?, ?,?,?)`, [fixture.sourceType || "website", "no_photo", `https://www.walmart.com/ip/${fixture.slug}`, fixture.storeId, fixture.name, "Admin Product URL Importer fixture", fixture.adminId, now, now]);
  const productId = await insertProduct(database, fixture.name, fixture.reviewedUnit, fixture.size, now);
  const row = await dbRun(database, `INSERT INTO price_import_rows (batch_id,product_id,store_id,item_name,category,price,size_text,quantity,unit,comparison_price,comparison_unit,proof_type,status,created_by,created_at,approved_by,approved_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'no_photo','approved',?,?,?,?,?)`, [batch.lastID, productId, fixture.storeId, fixture.name, "produce", fixture.reviewedPrice, fixture.size, fixture.quantity, fixture.reviewedUnit, fixture.comparisonPrice, fixture.comparisonUnit, fixture.adminId, now, fixture.adminId, now, now]);
  const report = await dbRun(database, `INSERT INTO price_reports (user_id,submitted_by_user_id,source_import_batch_id,source_import_row_id,store_id,product_id,item_name,category,price,size_text,quantity,unit,unit_price,comparison_price,comparison_unit,proof_type,confidence,verification_count,dispute_count,status,reviewed_at,reviewed_by,source_url,source_domain,source_checked_at,location_verification_status,applicable_store_id,verification_source,verified_by,verified_at,submitted_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'low',0,0,'approved',?,?,?,?,?,'verified_exact_store',?,?,?,?,?,?)`, [fixture.adminId, fixture.adminId, batch.lastID, row.lastID, fixture.storeId, productId, fixture.name, "produce", fixture.currentPrice, fixture.size, fixture.quantity, fixture.currentUnit, fixture.currentUnitPrice, fixture.comparisonPrice, fixture.comparisonUnit, "no_photo", now, fixture.adminId, `https://www.walmart.com/ip/${fixture.slug}`, "walmart.com", now, fixture.storeId, fixture.verificationSource || "admin_import", fixture.adminId, now, now, "2099-01-01T00:00:00.000Z"]);
  await dbRun(database, "UPDATE price_import_rows SET price_report_id=? WHERE id=?", [report.lastID, row.lastID]);
  const importRecord = await dbRun(database, `INSERT INTO product_url_imports (batch_id,row_id,source_url,source_domain,fetched_url,field_confidences_json,extraction_warnings_json,retailer_name,price_location_confidence,imported_by,imported_at,created_at,approval_status,approved_product_id,approved_price_report_id,approved_by,approved_at,duplicate_decision) VALUES (?,?,?,?,?,'{}','[]','Walmart','confirmed_janesville',?,?,?,'approved',?,?,?,?,'no_match')`, [batch.lastID, row.lastID, `https://www.walmart.com/ip/${fixture.slug}`, "walmart.com", `https://www.walmart.com/ip/${fixture.slug}`, fixture.adminId, now, now, productId, report.lastID, fixture.adminId, now]);
  return { batchId: batch.lastID, rowId: row.lastID, reportId: report.lastID, productId, importId: importRecord.lastID };
}

async function insertStandaloneReport(database, fixture) {
  const now = new Date().toISOString();
  const productId = await insertProduct(database, fixture.name, "each", "Each", now);
  return (await dbRun(database, `INSERT INTO price_reports (user_id,store_id,product_id,item_name,category,price,size_text,quantity,unit,unit_price,proof_type,confidence,verification_count,dispute_count,status,verification_source,source_import_row_id,submitted_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'no_photo','low',0,0,'approved',?,?,?,?)`, [fixture.adminId, fixture.storeId, productId, fixture.name, "produce", fixture.price, "Each", 1, "each", fixture.price, fixture.verificationSource, fixture.sourceImportRowId ?? null, now, "2099-01-01T00:00:00.000Z"])).lastID;
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-admin-import-price-repair-"));
  const initialize = childProcess.spawnSync(process.execPath, ["-e", "require('./src/db').initDb().catch((error)=>{console.error(error);process.exit(1)})"], { cwd: ROOT, env: { ...process.env, DATA_DIR: dataDir }, encoding: "utf8" });
  assert.equal(initialize.status, 0, initialize.stderr || initialize.stdout);
  const databasePath = path.join(dataDir, "grocery_radar.sqlite");
  const database = new sqlite3.Database(databasePath);
  const now = new Date().toISOString();
  const adminId = (await dbRun(database, `INSERT INTO users (username,email,password_hash,points,is_email_verified,is_admin,is_super_admin,staff_role,account_status,created_at) VALUES ('elcastilo','juricbu@gmail.com','fixture',0,1,1,1,'owner','active',?)`, [now])).lastID;
  const communityId = (await dbRun(database, `INSERT INTO users (username,email,password_hash,points,is_email_verified,account_status,created_at) VALUES ('repaircommunity','community@example.invalid','fixture',0,1,'active',?)`, [now])).lastID;
  const store = await dbGet(database, "SELECT id FROM stores WHERE name='Walmart Janesville'");
  assert.ok(store);

  const cases = [
    { slug: "repair-banana", name: "Fresh Banana Repair Fixture", reviewedPrice: 0.20, reviewedUnit: "each", currentPrice: 50.00, currentUnit: "each", currentUnitPrice: 50.00, comparisonPrice: 0.50, comparisonUnit: "each", quantity: 1, size: "Each" },
    { slug: "repair-strawberries", name: "Fresh Strawberries Repair Fixture", reviewedPrice: 2.46, reviewedUnit: "lb", currentPrice: 15.40, currentUnit: "oz", currentUnitPrice: 15.40, comparisonPrice: 0.154, comparisonUnit: "oz", quantity: 1, size: "1 lb Container" },
    { slug: "repair-grapefruit", name: "Del Monte Grapefruit Repair Fixture", reviewedPrice: 9.76, reviewedUnit: "oz", currentPrice: 18.80, currentUnit: "oz", currentUnitPrice: 0.3615, comparisonPrice: 0.188, comparisonUnit: "oz", quantity: 52, size: "52 oz Jar" },
    { slug: "repair-crunch-pak", name: "Crunch Pak Repair Fixture", reviewedPrice: 3.87, reviewedUnit: "oz", currentPrice: 32.30, currentUnit: "oz", currentUnitPrice: 2.6917, comparisonPrice: 0.323, comparisonUnit: "oz", quantity: 12, size: "12 oz" }
  ].map((fixture) => ({ ...fixture, adminId, storeId: store.id }));
  const inserted = [];
  for (const fixture of cases) inserted.push(await insertWorkflow(database, fixture));

  await insertWorkflow(database, { ...cases[0], slug: "correct-admin-import", name: "Correct Admin Import Fixture", currentPrice: 0.20 });
  await insertWorkflow(database, { ...cases[0], slug: "zero-source-price", name: "Zero Source Price Fixture", reviewedPrice: 0, currentPrice: 9.99 });
  const negativeSource = await insertWorkflow(database, { ...cases[0], slug: "negative-source-price", name: "Negative Source Price Fixture", currentPrice: 9.98 });
  await dbRun(database, "UPDATE price_import_rows SET price=-1 WHERE id=?", [negativeSource.rowId]);
  const nullSource = await insertWorkflow(database, { ...cases[0], slug: "null-source-price", name: "Null Source Price Fixture", currentPrice: 9.97 });
  await dbRun(database, "UPDATE price_import_rows SET price=NULL WHERE id=?", [nullSource.rowId]);
  const textSource = await insertWorkflow(database, { ...cases[0], slug: "text-source-price", name: "Text Source Price Fixture", currentPrice: 9.96 });
  await dbRun(database, "UPDATE price_import_rows SET price='not-a-number' WHERE id=?", [textSource.rowId]);
  const infiniteSource = await insertWorkflow(database, { ...cases[0], slug: "infinite-source-price", name: "Infinite Source Price Fixture", currentPrice: 9.95 });
  await dbRun(database, "UPDATE price_import_rows SET price=? WHERE id=?", [Infinity, infiniteSource.rowId]);
  await insertWorkflow(database, { ...cases[0], slug: "unrelated-workflow", name: "Unrelated Workflow Fixture", sourceType: "weekly_ad" });
  await insertWorkflow(database, { ...cases[0], slug: "community-workflow", name: "Community Workflow Fixture", verificationSource: "community" });
  await insertStandaloneReport(database, { adminId, storeId: store.id, name: "Admin Without Source Fixture", price: 7.77, verificationSource: "admin_import" });
  await insertStandaloneReport(database, { adminId: communityId, storeId: store.id, name: "Community Report Fixture", price: 1.23, verificationSource: "community" });
  await insertStandaloneReport(database, { adminId, storeId: store.id, name: "Missing Source Row Fixture", price: 8.88, verificationSource: "admin_import", sourceImportRowId: 999999 });
  const mismatch = await insertWorkflow(database, { ...cases[0], slug: "mismatched-provenance", name: "Mismatched Provenance Fixture" });
  await dbRun(database, "UPDATE product_url_imports SET approved_price_report_id=? WHERE id=?", [inserted[0].reportId, mismatch.importId]);
  await closeDb(database);

  assert.deepEqual(parseArguments(["--db", databasePath, "--limit=2", "--json"]), { apply: false, json: true, dbPath: databasePath, backupPath: null, limit: "2" });
  assert.throws(() => parseArguments(["--apply=yes"]), /Unsupported argument/);
  const humanCli = childProcess.spawnSync(process.execPath, ["scripts/repair-admin-import-prices.js", "--db", databasePath, "--limit", "2"], { cwd: ROOT, env: { ...process.env, DATA_DIR: "", DB_PATH: "" }, encoding: "utf8" });
  assert.equal(humanCli.status, 0, humanCli.stderr || humanCli.stdout);
  assert.match(humanCli.stdout, new RegExp(`Database: ${databasePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(humanCli.stdout, /Mode: DRY RUN/);
  assert.match(humanCli.stdout, /Candidates found: 2/);
  assert.match(humanCli.stdout, /Rows that would change: 2/);
  assert.match(humanCli.stdout, /NO DATABASE CHANGES WERE MADE/);
  assert.match(humanCli.stdout, /current primary price: \$50\.00/);
  assert.match(humanCli.stdout, /reviewed item price: \$0\.20/);
  assert.match(humanCli.stdout, /comparison: \$0\.50 each/);
  const beforeCli = childProcess.spawnSync(process.execPath, ["scripts/repair-admin-import-prices.js", "--db", databasePath, "--json"], { cwd: ROOT, env: { ...process.env, DATA_DIR: "", DB_PATH: "" }, encoding: "utf8" });
  assert.equal(beforeCli.status, 0, beforeCli.stderr || beforeCli.stdout);
  const dryRun = JSON.parse(beforeCli.stdout);
  assert.equal(dryRun.dry_run, true);
  assert.equal(dryRun.applied, false);
  assert.equal(dryRun.candidate_count, 4);
  assert.deepEqual(dryRun.candidates.map((candidate) => candidate.reviewed_primary_price), [0.20, 2.46, 9.76, 3.87]);
  assert.deepEqual(dryRun.candidates.map((candidate) => candidate.current_primary_price), [50.00, 15.40, 18.80, 32.30]);
  assert.equal(dryRun.database_path, databasePath);

  const beforeApplyDb = new sqlite3.Database(databasePath);
  assert.deepEqual((await dbAll(beforeApplyDb, `SELECT price FROM price_reports WHERE id IN (${inserted.map(() => "?").join(",")}) ORDER BY id`, inserted.map((item) => item.reportId))).map((row) => row.price), [50, 15.4, 18.8, 32.3]);
  assert.equal((await dbGet(beforeApplyDb, "SELECT COUNT(*) AS count FROM admin_audit_log WHERE action='ADMIN_IMPORT_PRICE_REPAIR'")).count, 0);
  await closeDb(beforeApplyDb);

  await assert.rejects(() => runRepair({ dataDir, dbPath: databasePath, apply: true }), /requires --backup/);
  const backupPath = path.join(dataDir, "grocery_radar-before-price-repair.sqlite");
  fs.copyFileSync(databasePath, backupPath);
  fs.utimesSync(backupPath, new Date(), new Date());
  const applied = await runRepair({ dataDir, dbPath: databasePath, backupPath, apply: true });
  assert.equal(applied.applied, true);
  assert.equal(applied.repaired_count, 4);
  const afterApplyDb = new sqlite3.Database(databasePath);
  const repaired = await dbAll(afterApplyDb, `SELECT id,price,unit,unit_price,comparison_price,comparison_unit,verification_source,verified_by,source_import_row_id FROM price_reports WHERE id IN (${inserted.map(() => "?").join(",")}) ORDER BY id`, inserted.map((item) => item.reportId));
  assert.deepEqual(repaired.map((row) => row.price), [0.20, 2.46, 9.76, 3.87]);
  assert.deepEqual(repaired.map((row) => row.unit), ["each", "lb", "oz", "oz"]);
  assert.deepEqual(repaired.map((row) => row.unit_price), [0.20, 2.46, 0.1877, 0.3225]);
  assert.deepEqual(repaired.map((row) => row.comparison_price), [0.50, 0.154, 0.188, 0.323]);
  assert.deepEqual(repaired.map((row) => row.comparison_unit), ["each", "oz", "oz", "oz"]);
  assert.ok(repaired.every((row) => row.verification_source === "admin_import" && row.verified_by === adminId && row.source_import_row_id));
  assert.equal((await dbGet(afterApplyDb, "SELECT COUNT(*) AS count FROM admin_audit_log WHERE action='ADMIN_IMPORT_PRICE_REPAIR'")).count, 4);
  const audit = await dbGet(afterApplyDb, "SELECT metadata_json FROM admin_audit_log WHERE action='ADMIN_IMPORT_PRICE_REPAIR' AND affected_id=?", [inserted[0].reportId]);
  assert.deepEqual(JSON.parse(audit.metadata_json), { old_price: 50, new_price: 0.2, old_unit: "each", new_unit: "each", recalculated_unit_price: 0.2, comparison_price_preserved: 0.5, comparison_unit_preserved: "each", source_import_row_id: inserted[0].rowId, product_url_import_id: inserted[0].importId, repair_timestamp: JSON.parse(audit.metadata_json).repair_timestamp });
  await closeDb(afterApplyDb);

  const secondDryRun = await runRepair({ dataDir, dbPath: databasePath });
  assert.equal(secondDryRun.candidate_count, 0);
  assert.equal(secondDryRun.message, "0 repairs needed. No changes were made.");

  const server = await startServer(dataDir);
  try {
    const browse = await fetch(`${server.baseUrl}/api/browse`).then((response) => response.json());
    for (const [index, item] of inserted.entries()) {
      const product = browse.products.find((candidate) => Number(candidate.id) === Number(item.productId));
      assert.ok(product);
      assert.equal(product.best_price, cases[index].reviewedPrice);
      assert.equal(product.best_price_label, `$${cases[index].reviewedPrice.toFixed(2)}`);
    }
    const basketResponse = await fetch(`${server.baseUrl}/api/savings/basket`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ product_id: inserted[0].productId, quantity: 3 }, { product_id: inserted[2].productId, quantity: 1 }], max_stores: 1 }) });
    assert.equal(basketResponse.status, 200);
    const basket = await basketResponse.json();
    const banana = basket.selected.matches.find((match) => Number(match.item.product_id) === Number(inserted[0].productId));
    const grapefruit = basket.selected.matches.find((match) => Number(match.item.product_id) === Number(inserted[2].productId));
    assert.equal(banana.item_price, 0.20);
    assert.equal(banana.comparison_price, 0.50);
    assert.equal(banana.line_total, 0.60, "My List must use the repaired shopper price times quantity.");
    assert.equal(grapefruit.item_price, 9.76);
    assert.equal(grapefruit.comparison_price, 0.188);
    assert.equal(grapefruit.line_total, 9.76);
    assert.equal(basket.selected.estimated_total, 10.36);
  } finally { await server.stop(); }

  const rollbackDb = new sqlite3.Database(databasePath);
  const rollbackA = await insertWorkflow(rollbackDb, { ...cases[0], slug: "rollback-a", name: "Rollback A Fixture", currentPrice: 10 });
  const rollbackB = await insertWorkflow(rollbackDb, { ...cases[0], slug: "rollback-b", name: "Rollback B Fixture", currentPrice: 11 });
  await closeDb(rollbackDb);
  const rollbackBackupPath = path.join(dataDir, "grocery_radar-before-rollback-test.sqlite");
  fs.copyFileSync(databasePath, rollbackBackupPath);
  fs.utimesSync(rollbackBackupPath, new Date(), new Date());
  let auditAttempts = 0;
  await assert.rejects(() => runRepair({ dataDir, dbPath: databasePath, backupPath: rollbackBackupPath, apply: true, beforeAudit: async () => { auditAttempts += 1; if (auditAttempts === 2) throw new Error("forced repair failure"); } }), /forced repair failure/);
  const afterRollbackDb = new sqlite3.Database(databasePath);
  assert.deepEqual((await dbAll(afterRollbackDb, "SELECT price FROM price_reports WHERE id IN (?,?) ORDER BY id", [rollbackA.reportId, rollbackB.reportId])).map((row) => row.price), [10, 11]);
  assert.equal((await dbGet(afterRollbackDb, "SELECT COUNT(*) AS count FROM admin_audit_log WHERE action='ADMIN_IMPORT_PRICE_REPAIR'")).count, 4, "Rolled-back audit rows must not survive.");
  await closeDb(afterRollbackDb);

  console.log("Admin import item-price repair dry-run, exclusion, transaction, idempotency, audit, and public browse tests passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
