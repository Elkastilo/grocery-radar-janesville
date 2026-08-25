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
database.all("PRAGMA table_info(product_url_imports)", (importColumnError, importColumns) => {
  if (importColumnError) throw importColumnError;
  const importColumnNames = new Set(importColumns.map((column) => column.name));
  for (const name of ["retailer_store_id", "retailer_store_slug", "price_source_type", "price_source_url", "price_source_store_id", "price_retrieved_at"]) assert.ok(importColumnNames.has(name), name);
});
database.all("SELECT name FROM sqlite_master WHERE type = 'table'", (error, rows) => {
  if (error) throw error;
  const names = new Set(rows.map((row) => row.name));
  for (const name of ["price_provenance_events", "quality_reviews", "quality_review_reports", "quality_review_helpful_votes", "ai_processing_settings", "ai_proof_jobs", "ai_proof_analyses", "ai_proof_attempts", "product_images", "catalog_import_batches", "catalog_import_rows", "catalog_import_images", "product_url_imports", "product_url_import_images", "product_normalization_rules", "user_release_reads", "submission_outcomes", "bulk_intake_batches", "bulk_intake_items", "product_image_upload_batches", "product_image_upload_items", "admin_dashboard_visits", "search_demand", "search_aliases", "category_nodes", "product_barcodes", "product_barcode_conflicts", "product_merge_events", "product_duplicate_decisions", "price_corrections", "price_issue_reports", "source_freshness_settings", "product_families", "product_family_members", "product_substitutions", "price_arena_settings"]) assert.ok(names.has(name), name);
  database.all("PRAGMA table_info(price_reports)", (columnError, columns) => {
    if (columnError) throw columnError;
    const columnNames = new Set(columns.map((column) => column.name));
    for (const name of ["submitted_by_user_id", "source_import_batch_id", "source_import_row_id", "source_date", "review_completed_at", "freshness_status", "comparison_price", "comparison_unit", "estimated_item_price", "approximate_item_weight", "package_price", "price_type", "valid_from_date", "valid_through_date", "valid_from_time", "valid_through_time", "promotion_conditions", "promotion_schedule_text", "display_offer_text", "location_verification_status", "applicable_city", "applicable_state", "applicable_store_id", "location_evidence_text", "verification_source", "verified_by", "verified_at"]) assert.ok(columnNames.has(name), name);
    database.all("PRAGMA table_info(price_import_rows)", (rowError, rowColumns) => {
      if (rowError) throw rowError;
      const rowColumnNames = new Set(rowColumns.map((column) => column.name));
      for (const name of ["ai_analysis_id", "ai_item_index", "ai_confidence", "ai_field_confidences_json", "ai_warnings_json", "research_notes", "research_sources_json", "suggested_new_product", "rejection_reason", "public_rejection_reason", "public_reviewer_explanation", "comparison_price", "comparison_unit", "estimated_item_price", "approximate_item_weight", "price_type", "valid_from_date", "valid_through_date", "promotion_conditions", "promotion_schedule_text", "display_offer_text"]) assert.ok(rowColumnNames.has(name), name);
      database.all("PRAGMA table_info(ai_processing_settings)", (settingsError, settingsColumns) => {
        if (settingsError) throw settingsError;
        const settingsColumnNames = new Set(settingsColumns.map((column) => column.name));
        for (const name of ["primary_model", "fallback_model", "max_concurrency", "max_queued_jobs"]) assert.ok(settingsColumnNames.has(name), name);
      database.all("PRAGMA table_info(ai_proof_jobs)", (jobError, jobColumns) => {
        if (jobError) throw jobError;
        assert.ok(new Set(jobColumns.map((column) => column.name)).has("manual_requested"));
      database.all("PRAGMA table_info(products)", (productError, productColumns) => {
        if (productError) throw productError;
        const productColumnNames = new Set(productColumns.map((column) => column.name));
        for (const name of ["variant", "upc", "description", "default_storage_condition", "category_node_id", "subcategory", "generic_product_type", "product_attributes_json"]) assert.ok(productColumnNames.has(name), name);
      database.all("PRAGMA table_info(price_import_batches)", (batchError, batchColumns) => {
        if (batchError) throw batchError;
        const batchColumnNames = new Set(batchColumns.map((column) => column.name));
        for (const name of ["location_verification_status", "applicable_store_id", "location_evidence_text"]) assert.ok(batchColumnNames.has(name), name);
        database.all("SELECT version_label, status, published_at, fixed_json FROM homepage_patch_notes WHERE version_label = 'v0.9.4'", (releaseError, releases) => {
          if (releaseError) throw releaseError;
          assert.equal(releases.length, 1);
          assert.equal(releases[0].status, "draft");
          assert.equal(releases[0].published_at, null);
          const fixedItems = JSON.parse(releases[0].fixed_json);
          assert.equal(fixedItems.filter((item) => item === "Review actions now keep your place on long proofs.").length, 1);
          assert.equal(fixedItems.filter((item) => item === "Manually choosing a store now saves and persists correctly.").length, 1);
          assert.equal(fixedItems.filter((item) => item === "Proof review navigation no longer reopens the proof you just left.").length, 1);
          assert.equal(fixedItems.filter((item) => item === "AI-not-started, zero-result, active-review, and completed proofs now display distinct states.").length, 1);
          assert.equal(fixedItems.filter((item) => item === "Completing or rejecting a proof reliably removes it from the active review queue.").length, 1);
          assert.equal(fixedItems.filter((item) => item === "Review actions no longer unexpectedly move the reviewer around the page.").length, 1);
          database.get("SELECT status,published_at FROM homepage_patch_notes WHERE version_label = 'v0.9.6'", (operationsReleaseError, operationsRelease) => {
            if (operationsReleaseError) throw operationsReleaseError;
            assert.deepEqual(operationsRelease, { status: "draft", published_at: null });
            database.get("SELECT status,published_at FROM homepage_patch_notes WHERE version_label = 'v0.9.7'", (arenaReleaseError, arenaRelease) => {
              if (arenaReleaseError) throw arenaReleaseError;
              assert.deepEqual(arenaRelease, { status: "draft", published_at: null });
            database.get("SELECT COUNT(*) AS count FROM source_freshness_settings", (freshnessError, freshness) => {
              if (freshnessError) throw freshnessError;
              assert.ok(freshness.count >= 4);
              database.close();
              console.log("Workflow schema migration tests passed.");
            });
            });
          });
        });
      });
      });
      });
      });
    });
  });
});
