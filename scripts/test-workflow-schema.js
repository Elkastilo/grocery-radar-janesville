"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sqlite3 = require("sqlite3").verbose();

const root = path.join(__dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "grocery-workflow-schema-"));
const code = "require('./src/db').initDb().then(() => require('./src/db').initDb()).catch((error) => { console.error(error); process.exit(1); })";
const run = childProcess.spawnSync(process.execPath, ["-e", code], { cwd: root, env: { ...process.env, DATA_DIR: dataDir }, encoding: "utf8" });
assert.equal(run.status, 0, run.stderr || run.stdout);

const database = new sqlite3.Database(path.join(dataDir, "grocery_radar.sqlite"));
database.all("SELECT name FROM sqlite_master WHERE type = 'table'", (error, rows) => {
  if (error) throw error;
  const names = new Set(rows.map((row) => row.name));
  for (const name of ["price_provenance_events", "quality_reviews", "quality_review_reports", "quality_review_helpful_votes"]) assert.ok(names.has(name), name);
  database.all("PRAGMA table_info(price_reports)", (columnError, columns) => {
    if (columnError) throw columnError;
    const columnNames = new Set(columns.map((column) => column.name));
    for (const name of ["submitted_by_user_id", "source_import_batch_id", "source_import_row_id", "source_date", "review_completed_at", "freshness_status"]) assert.ok(columnNames.has(name), name);
    database.close();
    console.log("Workflow schema migration tests passed.");
  });
});
