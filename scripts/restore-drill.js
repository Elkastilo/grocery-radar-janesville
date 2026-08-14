"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const CORE_TABLES = ["products", "stores", "price_reports", "proof_submissions"];

function get(database, sql, params = []) {
  return new Promise((resolve, reject) => database.get(sql, params, (error, row) => error ? reject(error) : resolve(row)));
}

function all(database, sql, params = []) {
  return new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

function close(database) {
  return new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
}

async function runRestoreDrill(sourcePath) {
  const resolvedSource = path.resolve(String(sourcePath || ""));
  if (!sourcePath || !fs.existsSync(resolvedSource) || !fs.statSync(resolvedSource).isFile()) throw new Error("Provide an existing SQLite backup file.");
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-radar-restore-drill-"));
  const restoredPath = path.join(tempDirectory, "restored-grocery-radar.sqlite");
  fs.copyFileSync(resolvedSource, restoredPath, fs.constants.COPYFILE_EXCL);

  const database = new sqlite3.Database(restoredPath, sqlite3.OPEN_READONLY);
  try {
    const integrity = await get(database, "PRAGMA integrity_check");
    const integrityResult = Object.values(integrity || {})[0];
    if (integrityResult !== "ok") throw new Error(`SQLite integrity check failed: ${integrityResult || "unknown"}`);
    const tableRows = await all(database, "SELECT name FROM sqlite_master WHERE type = 'table'");
    const tableNames = new Set(tableRows.map((row) => row.name));
    const missingTables = CORE_TABLES.filter((name) => !tableNames.has(name));
    if (missingTables.length) throw new Error(`Restore is missing core tables: ${missingTables.join(", ")}`);
    const counts = {};
    for (const table of CORE_TABLES) {
      const row = await get(database, `SELECT COUNT(*) AS count FROM ${table}`);
      counts[table] = Number(row?.count || 0);
    }
    return { ok: true, integrity: integrityResult, restored_path: restoredPath, source_unchanged: true, tables: CORE_TABLES, counts };
  } finally {
    await close(database);
  }
}

if (require.main === module) {
  runRestoreDrill(process.argv[2]).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(`Restore drill failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { CORE_TABLES, runRestoreDrill };
