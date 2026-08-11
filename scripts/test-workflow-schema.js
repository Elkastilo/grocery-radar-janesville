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
  for (const name of ["price_provenance_events", "quality_reviews", "quality_review_reports", "quality_review_helpful_votes", "ai_processing_settings", "ai_proof_jobs", "ai_proof_analyses", "ai_proof_attempts", "product_images", "catalog_import_batches", "catalog_import_rows", "catalog_import_images"]) assert.ok(names.has(name), name);
  database.all("PRAGMA table_info(price_reports)", (columnError, columns) => {
    if (columnError) throw columnError;
    const columnNames = new Set(columns.map((column) => column.name));
    for (const name of ["submitted_by_user_id", "source_import_batch_id", "source_import_row_id", "source_date", "review_completed_at", "freshness_status"]) assert.ok(columnNames.has(name), name);
    database.all("PRAGMA table_info(price_import_rows)", (rowError, rowColumns) => {
      if (rowError) throw rowError;
      const rowColumnNames = new Set(rowColumns.map((column) => column.name));
      for (const name of ["ai_analysis_id", "ai_item_index", "ai_confidence", "ai_field_confidences_json", "ai_warnings_json", "research_notes", "research_sources_json", "suggested_new_product", "rejection_reason"]) assert.ok(rowColumnNames.has(name), name);
      database.all("PRAGMA table_info(ai_processing_settings)", (settingsError, settingsColumns) => {
        if (settingsError) throw settingsError;
        const settingsColumnNames = new Set(settingsColumns.map((column) => column.name));
        for (const name of ["primary_model", "fallback_model"]) assert.ok(settingsColumnNames.has(name), name);
      database.all("PRAGMA table_info(ai_proof_jobs)", (jobError, jobColumns) => {
        if (jobError) throw jobError;
        assert.ok(new Set(jobColumns.map((column) => column.name)).has("manual_requested"));
      database.all("PRAGMA table_info(products)", (productError, productColumns) => {
        if (productError) throw productError;
        const productColumnNames = new Set(productColumns.map((column) => column.name));
        for (const name of ["variant", "upc", "description"]) assert.ok(productColumnNames.has(name), name);
        database.close();
        console.log("Workflow schema migration tests passed.");
      });
      });
      });
    });
  });
});
