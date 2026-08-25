#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();
const { calculateUnitPrice } = require("../src/unitPrice");

const SCRIPT_NAME = "scripts/repair-admin-import-prices.js";
const PRICE_EPSILON = 0.000001;
const MAX_BACKUP_AGE_MS = 60 * 60 * 1000;
const MAX_REPAIR_LIMIT = 10000;

const CANDIDATE_SQL = `
  SELECT
    reports.id AS price_report_id,
    reports.product_id,
    COALESCE(products.display_name, reports.item_name) AS product_name,
    reports.store_id,
    stores.name AS store_name,
    reports.source_import_row_id,
    reports.source_import_batch_id,
    reports.price AS current_price,
    reports.unit AS current_unit,
    reports.unit_price AS current_unit_price,
    reports.comparison_price,
    reports.comparison_unit,
    reports.verification_source,
    reports.verified_by,
    rows.price AS reviewed_price,
    rows.quantity AS reviewed_quantity,
    rows.unit AS reviewed_unit,
    rows.price_report_id AS row_price_report_id,
    imports.id AS product_url_import_id,
    imports.approved_by AS importing_admin_id,
    imports.source_domain
  FROM price_reports reports
  JOIN price_import_rows rows
    ON rows.id = reports.source_import_row_id
  JOIN price_import_batches batches
    ON batches.id = rows.batch_id
   AND batches.id = reports.source_import_batch_id
  JOIN product_url_imports imports
    ON imports.row_id = rows.id
   AND imports.batch_id = rows.batch_id
   AND imports.approved_price_report_id = reports.id
   AND imports.approved_product_id = reports.product_id
  LEFT JOIN products ON products.id = reports.product_id
  LEFT JOIN stores ON stores.id = reports.store_id
  WHERE reports.verification_source = 'admin_import'
    AND reports.status = 'approved'
    AND reports.source_import_row_id IS NOT NULL
    AND reports.source_import_batch_id IS NOT NULL
    AND rows.status = 'approved'
    AND rows.price_report_id = reports.id
    AND rows.product_id = reports.product_id
    AND rows.store_id = reports.store_id
    AND imports.approval_status = 'approved'
    AND imports.approved_by IS NOT NULL
    AND reports.verified_by = imports.approved_by
    AND (
      SELECT COUNT(*)
      FROM product_url_imports matching_imports
      WHERE matching_imports.row_id = rows.id
        AND matching_imports.batch_id = rows.batch_id
        AND matching_imports.approval_status = 'approved'
        AND matching_imports.approved_product_id = reports.product_id
        AND matching_imports.approved_price_report_id = reports.id
        AND matching_imports.approved_by = reports.verified_by
    ) = 1
    AND batches.source_type = 'website'
    AND batches.proof_type = 'no_photo'
    AND typeof(reports.price) IN ('integer', 'real')
    AND reports.price > -1e308
    AND reports.price < 1e308
    AND reports.price = reports.price
    AND typeof(rows.price) IN ('integer', 'real')
    AND rows.price > 0
    AND rows.price < 1e308
    AND rows.price = rows.price
    AND typeof(rows.quantity) IN ('integer', 'real')
    AND rows.quantity > 0
    AND rows.quantity = rows.quantity
    AND NULLIF(TRIM(rows.unit), '') IS NOT NULL
    AND ABS(reports.price - rows.price) > ?
  ORDER BY reports.id
  LIMIT ?
`;

function dbGet(database, sql, params = []) {
  return new Promise((resolve, reject) => database.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function dbAll(database, sql, params = []) {
  return new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function dbRun(database, sql, params = []) {
  return new Promise((resolve, reject) => database.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve(this);
  }));
}

function closeDb(database) {
  return new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
}

function pathIsInside(parentPath, childPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveDatabasePath(options = {}) {
  const explicitDatabasePath = options.dbPath || process.env.DB_PATH || "";
  const configuredDataDir = options.dataDir || process.env.DATA_DIR || "";
  const dataDir = path.resolve(configuredDataDir || (explicitDatabasePath ? path.dirname(path.resolve(explicitDatabasePath)) : path.join(__dirname, "..", "data")));
  const databasePath = path.resolve(explicitDatabasePath || path.join(dataDir, "grocery_radar.sqlite"));
  if (!pathIsInside(dataDir, databasePath)) throw new Error("The SQLite database path must be inside DATA_DIR.");
  if (!fs.existsSync(databasePath) || !fs.statSync(databasePath).isFile()) throw new Error(`SQLite database not found at ${databasePath}.`);
  return { dataDir, databasePath };
}

function openDatabase(databasePath, apply) {
  return new sqlite3.Database(databasePath, apply ? sqlite3.OPEN_READWRITE : sqlite3.OPEN_READONLY);
}

async function validateRecentBackup(backupPath, databasePath) {
  if (!backupPath) throw new Error("--apply requires --backup=/path/to/a/recent/verified-backup.sqlite.");
  const resolvedBackup = path.resolve(backupPath);
  if (resolvedBackup === path.resolve(databasePath)) throw new Error("The backup must be a separate file from the production database.");
  if (!fs.existsSync(resolvedBackup) || !fs.statSync(resolvedBackup).isFile()) throw new Error(`Backup file not found at ${resolvedBackup}.`);
  const ageMs = Date.now() - fs.statSync(resolvedBackup).mtimeMs;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MAX_BACKUP_AGE_MS) throw new Error("The backup must have been created within the last 60 minutes.");
  const backup = new sqlite3.Database(resolvedBackup, sqlite3.OPEN_READONLY);
  try {
    const integrity = await dbGet(backup, "PRAGMA integrity_check");
    if (Object.values(integrity || {})[0] !== "ok") throw new Error("The backup failed SQLite integrity_check.");
    for (const table of ["products", "stores", "price_reports", "price_import_rows", "product_url_imports"]) {
      if (!(await dbGet(backup, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]))) throw new Error(`The backup is missing required table ${table}.`);
    }
  } finally { await closeDb(backup); }
  return resolvedBackup;
}

async function validateSchema(database) {
  const required = {
    price_reports: ["id", "product_id", "store_id", "price", "unit", "unit_price", "comparison_price", "comparison_unit", "verification_source", "verified_by", "source_import_row_id", "source_import_batch_id", "status"],
    price_import_rows: ["id", "batch_id", "price_report_id", "product_id", "store_id", "price", "quantity", "unit", "status"],
    price_import_batches: ["id", "source_type", "proof_type"],
    product_url_imports: ["id", "batch_id", "row_id", "approval_status", "approved_product_id", "approved_price_report_id", "approved_by"],
    admin_audit_log: ["admin_user_id", "action", "method", "path", "status_code", "affected_type", "affected_id", "metadata_json", "created_at"]
  };
  for (const [table, columns] of Object.entries(required)) {
    const exists = await dbGet(database, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
    if (!exists) throw new Error(`Required table ${table} is missing.`);
    const present = new Set((await dbAll(database, `PRAGMA table_info(${table})`)).map((column) => column.name));
    const missing = columns.filter((column) => !present.has(column));
    if (missing.length) throw new Error(`Required columns are missing from ${table}: ${missing.join(", ")}.`);
  }
}

function safeCandidate(row) {
  const unitPrice = calculateUnitPrice(row.reviewed_price, row.reviewed_quantity, row.reviewed_unit);
  return {
    price_report_id: Number(row.price_report_id),
    product_id: Number(row.product_id),
    product_name: String(row.product_name || "Product").slice(0, 160),
    store_id: Number(row.store_id),
    store: String(row.store_name || "Store").slice(0, 160),
    source_import_row_id: Number(row.source_import_row_id),
    source_import_batch_id: Number(row.source_import_batch_id),
    product_url_import_id: Number(row.product_url_import_id),
    current_primary_price: Number(row.current_price),
    reviewed_primary_price: Number(row.reviewed_price),
    current_package_unit: String(row.current_unit || ""),
    reviewed_package_unit: unitPrice.unit,
    recalculated_unit_price: unitPrice.unitPrice,
    comparison_price: row.comparison_price == null ? null : Number(row.comparison_price),
    comparison_unit: String(row.comparison_unit || ""),
    verification_source: row.verification_source,
    source_domain: String(row.source_domain || "").slice(0, 160),
    action: `repair primary price to ${Number(row.reviewed_price).toFixed(2)}`
  };
}

function normalizeLimit(value) {
  if (value === null || value === undefined || value === "") return null;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_REPAIR_LIMIT) throw new Error(`--limit must be an integer from 1 to ${MAX_REPAIR_LIMIT}.`);
  return limit;
}

async function loadCandidates(database, options = {}) {
  const limit = normalizeLimit(options.limit);
  const rows = await dbAll(database, CANDIDATE_SQL, [PRICE_EPSILON, limit ?? -1]);
  const candidates = [];
  const blocked = [];
  for (const row of rows) {
    try {
      const candidate = safeCandidate(row);
      if (![candidate.current_primary_price, candidate.reviewed_primary_price, candidate.recalculated_unit_price].every(Number.isFinite)) throw new Error("A required numeric value is not finite.");
      candidates.push(candidate);
    } catch (error) {
      blocked.push({ price_report_id: Number(row.price_report_id), source_import_row_id: Number(row.source_import_row_id), reason: error.message });
    }
  }
  return { candidates, blocked };
}

function candidateFingerprint(candidate) {
  return JSON.stringify({
    price_report_id: candidate.price_report_id,
    product_id: candidate.product_id,
    store_id: candidate.store_id,
    source_import_row_id: candidate.source_import_row_id,
    source_import_batch_id: candidate.source_import_batch_id,
    product_url_import_id: candidate.product_url_import_id,
    current_primary_price: candidate.current_primary_price,
    reviewed_primary_price: candidate.reviewed_primary_price,
    current_package_unit: candidate.current_package_unit,
    reviewed_package_unit: candidate.reviewed_package_unit,
    recalculated_unit_price: candidate.recalculated_unit_price,
    comparison_price: candidate.comparison_price,
    comparison_unit: candidate.comparison_unit,
    verification_source: candidate.verification_source
  });
}

async function applyCandidates(database, expectedCandidates, options = {}) {
  await dbRun(database, "BEGIN IMMEDIATE");
  try {
    const refreshed = await loadCandidates(database, { limit: options.limit });
    const expectedFingerprints = expectedCandidates.map(candidateFingerprint);
    const refreshedFingerprints = refreshed.candidates.map(candidateFingerprint);
    if (refreshed.blocked.length || JSON.stringify(refreshedFingerprints) !== JSON.stringify(expectedFingerprints)) {
      throw new Error("Repair candidates changed after the write lock was acquired. No changes were applied.");
    }
    const repairedAt = new Date().toISOString();
    for (const candidate of refreshed.candidates) {
      const updated = await dbRun(database, `
        UPDATE price_reports
        SET price = ?, unit = ?, unit_price = ?
        WHERE id = ?
          AND source_import_row_id = ?
          AND verification_source = 'admin_import'
          AND ABS(price - ?) <= ?
      `, [candidate.reviewed_primary_price, candidate.reviewed_package_unit, candidate.recalculated_unit_price, candidate.price_report_id, candidate.source_import_row_id, candidate.current_primary_price, PRICE_EPSILON]);
      if (updated.changes !== 1) throw new Error(`Price report ${candidate.price_report_id} changed during repair. No changes were applied.`);
      if (typeof options.beforeAudit === "function") await options.beforeAudit(candidate, database);
      await dbRun(database, `
        INSERT INTO admin_audit_log (
          admin_user_id, action, method, path, status_code, ip_address, user_agent,
          affected_type, affected_id, metadata_json, created_at
        ) VALUES (NULL, 'ADMIN_IMPORT_PRICE_REPAIR', 'MAINTENANCE', ?, 200, '', ?, 'price_report', ?, ?, ?)
      `, [SCRIPT_NAME, SCRIPT_NAME, candidate.price_report_id, JSON.stringify({
        old_price: candidate.current_primary_price,
        new_price: candidate.reviewed_primary_price,
        old_unit: candidate.current_package_unit,
        new_unit: candidate.reviewed_package_unit,
        recalculated_unit_price: candidate.recalculated_unit_price,
        comparison_price_preserved: candidate.comparison_price,
        comparison_unit_preserved: candidate.comparison_unit,
        source_import_row_id: candidate.source_import_row_id,
        product_url_import_id: candidate.product_url_import_id,
        repair_timestamp: repairedAt
      }), repairedAt]);
    }
    await dbRun(database, "COMMIT");
    return { repaired_at: repairedAt, repaired_count: refreshed.candidates.length };
  } catch (error) {
    await dbRun(database, "ROLLBACK").catch(() => {});
    throw error;
  }
}

async function runRepair(options = {}) {
  const apply = options.apply === true;
  const limit = normalizeLimit(options.limit);
  const { dataDir, databasePath } = resolveDatabasePath(options);
  const backupPath = apply ? await validateRecentBackup(options.backupPath, databasePath) : null;
  const database = openDatabase(databasePath, apply);
  try {
    await dbRun(database, "PRAGMA busy_timeout = 5000");
    await dbRun(database, "PRAGMA foreign_keys = ON");
    await validateSchema(database);
    const preview = await loadCandidates(database, { limit });
    if (preview.blocked.length) {
      return { ok: false, applied: false, dry_run: !apply, database_path: databasePath, limit, candidate_count: preview.candidates.length, blocked_count: preview.blocked.length, candidates: preview.candidates, blocked: preview.blocked, message: "Blocked candidate records require manual investigation; no repair was applied." };
    }
    const application = apply && preview.candidates.length ? await applyCandidates(database, preview.candidates, options) : null;
    return {
      ok: true,
      applied: Boolean(application),
      dry_run: !apply,
      database_path: databasePath,
      data_dir: dataDir,
      limit,
      verified_backup_path: backupPath,
      candidate_count: preview.candidates.length,
      repaired_count: application?.repaired_count || 0,
      repaired_at: application?.repaired_at || null,
      candidates: preview.candidates,
      blocked: [],
      message: apply
        ? (preview.candidates.length ? `${preview.candidates.length} admin-import price report(s) repaired atomically.` : "0 repairs needed.")
        : (preview.candidates.length ? "Dry run only. Review every candidate, back up the database, then run again with --apply." : "0 repairs needed. No changes were made.")
    };
  } finally {
    await closeDb(database);
  }
}

function argumentValue(args, name) {
  const equals = args.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${name} requires a value.`);
  return args[index + 1];
}

function parseArguments(args) {
  const valueFlags = ["--db", "--backup", "--limit"];
  const consumed = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (valueFlags.includes(argument)) { consumed.add(index); consumed.add(index + 1); index += 1; continue; }
    if (valueFlags.some((flag) => argument.startsWith(`${flag}=`)) || ["--apply", "--json"].includes(argument)) { consumed.add(index); continue; }
  }
  const unknown = args.filter((_, index) => !consumed.has(index));
  if (unknown.length) throw new Error(`Unsupported argument: ${unknown[0]}`);
  return {
    apply: args.includes("--apply"),
    json: args.includes("--json"),
    dbPath: argumentValue(args, "--db"),
    backupPath: argumentValue(args, "--backup"),
    limit: argumentValue(args, "--limit")
  };
}

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "not available";
}

function formatHumanReport(result) {
  const lines = [
    "Admin import primary-price repair",
    `Database: ${result.database_path}`,
    `Mode: ${result.dry_run ? "DRY RUN" : "APPLY"}`,
    `Candidate limit: ${result.limit ?? "all eligible records"}`,
    ""
  ];
  for (const candidate of result.candidates) {
    const comparison = candidate.comparison_price == null
      ? "not available"
      : `${money(candidate.comparison_price)}${candidate.comparison_unit ? ` ${candidate.comparison_unit}` : ""}`;
    lines.push(
      candidate.product_name,
      `  price report ID: ${candidate.price_report_id}`,
      `  product ID: ${candidate.product_id}`,
      `  store: ${candidate.store} (ID ${candidate.store_id})`,
      `  source import row ID: ${candidate.source_import_row_id}`,
      `  current primary price: ${money(candidate.current_primary_price)}`,
      `  reviewed item price: ${money(candidate.reviewed_primary_price)}`,
      `  package unit: ${candidate.current_package_unit || "not provided"} -> ${candidate.reviewed_package_unit}`,
      `  comparison: ${comparison}`,
      `  verification source: ${candidate.verification_source}`,
      `  action: ${money(candidate.current_primary_price)} -> ${money(candidate.reviewed_primary_price)}`,
      ""
    );
  }
  lines.push(`Candidates found: ${result.candidate_count}`);
  lines.push(`${result.dry_run ? "Rows that would change" : "Rows repaired"}: ${result.dry_run ? result.candidate_count : result.repaired_count}`);
  if (result.dry_run) lines.push("NO DATABASE CHANGES WERE MADE");
  else lines.push(result.message);
  return lines.join("\n");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runRepair(options);
  console.log(options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result));
  if (!result.ok) process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, applied: false, error: error.message }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = { CANDIDATE_SQL, PRICE_EPSILON, MAX_BACKUP_AGE_MS, MAX_REPAIR_LIMIT, loadCandidates, applyCandidates, runRepair, validateRecentBackup, resolveDatabasePath, parseArguments, formatHumanReport };
