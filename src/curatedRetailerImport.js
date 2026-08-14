const { run, get, all } = require("./db");
const { normalizeProductName } = require("./validation");
const { saveStoreProductLocation, currentStoreProductLocation, hasStoreProductLocation } = require("./storeProductLocations");

const APPLY_CONFIRMATION = "APPLY-CURATED-RETAILER-PRICES";

function compact(value) {
  return String(value || "").normalize("NFKD").replace(/[’']/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

function normalizeAddress(value) {
  return compact(value).replace(/\bn\b/g, "north").replace(/\bdr\b/g, "drive").replace(/\bst\b/g, "street").replace(/\brd\b/g, "road");
}

function validateBatch(batch) {
  if (!batch || batch.human_curated !== true || batch.source_type !== "retailer_website_manual") throw new Error("Batch must be marked as a human-curated retailer website transcription.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(batch.observed_date || "")) throw new Error("Batch observed_date must use YYYY-MM-DD.");
  if (batch.timezone !== "America/Chicago") throw new Error("Curated Janesville observations must use America/Chicago.");
  if (!Array.isArray(batch.stores) || !batch.stores.length) throw new Error("Batch has no store collections.");
  return batch;
}

function validateRow(row, storeKey, index) {
  const price = Number(row.current_price);
  if (!compact(row.product_name)) throw new Error(`${storeKey} row ${index + 1} has no product name.`);
  if (!compact(row.size)) throw new Error(`${storeKey} row ${index + 1} has no recognizable size.`);
  if (!Number.isFinite(price) || price <= 0) throw new Error(`${storeKey} row ${index + 1} has an invalid price.`);
  if (row.previous_price != null && (!Number.isFinite(Number(row.previous_price)) || Number(row.previous_price) <= 0)) throw new Error(`${storeKey} row ${index + 1} has an invalid previous price.`);
  if (row.displayed_discount_percent != null && (!Number.isFinite(Number(row.displayed_discount_percent)) || Number(row.displayed_discount_percent) < 0 || Number(row.displayed_discount_percent) > 100)) throw new Error(`${storeKey} row ${index + 1} has an invalid displayed discount.`);
}

async function resolveStore(storeBatch) {
  const stores = await all("SELECT id, name, address, city, state, active FROM stores WHERE active = 1 AND lower(trim(city)) = 'janesville' AND lower(trim(state)) IN ('wi','wisconsin')");
  const retailer = compact(storeBatch.retailer);
  const candidates = stores.filter((store) => compact(store.name).includes(retailer));
  if (storeBatch.required_address) {
    const required = normalizeAddress(storeBatch.required_address);
    const exact = candidates.filter((store) => normalizeAddress(store.address) === required);
    if (exact.length !== 1) return { status: "needs_review", code: "STORE_LOCATION_NEEDS_REVIEW", source_location_text: storeBatch.source_location_text, candidates };
    return { status: "resolved", store: exact[0], source_location_text: storeBatch.source_location_text, rule: "exact_normalized_address" };
  }
  if (retailer === "aldi" && /janesville/i.test(storeBatch.source_location_text || "") && candidates.length === 1) return { status: "resolved", store: candidates[0], source_location_text: storeBatch.source_location_text, rule: "explicit_janesville_source_and_unique_active_store" };
  return { status: "needs_review", code: "STORE_LOCATION_NEEDS_REVIEW", source_location_text: storeBatch.source_location_text, candidates };
}

async function matchProduct(row) {
  const name = compact(row.product_name);
  const brand = compact(row.brand);
  const size = compact(row.size);
  const alias = await get("SELECT products.* FROM product_normalization_rules rules JOIN products ON products.id = rules.product_id WHERE rules.normalized_alias = ? AND products.status IN ('active','needs_review') LIMIT 1", [normalizeProductName(row.product_name)]);
  if (alias && (!size || compact(alias.default_size_text) === size) && (!brand || !alias.preferred_brand || compact(alias.preferred_brand) === brand)) return { status: "matched", product: alias, rule: "verified_alias" };
  const candidates = await all("SELECT * FROM products WHERE status IN ('active','needs_review') AND lower(trim(default_size_text)) = lower(trim(?))", [row.size]);
  const exact = candidates.filter((product) => compact(product.display_name) === name && (!brand || compact(product.preferred_brand) === brand));
  if (exact.length === 1) return { status: "matched", product: exact[0], rule: "brand_normalized_name_exact_size" };
  if (exact.length > 1) return { status: "ambiguous", candidates: exact };
  const conservative = candidates.filter((product) => compact(product.canonical_name) === compact(normalizeProductName(row.product_name)) && (!brand || compact(product.preferred_brand) === brand));
  if (conservative.length === 1) return { status: "matched", product: conservative[0], rule: "conservative_normalized_exact_size" };
  if (conservative.length > 1) return { status: "ambiguous", candidates: conservative };
  return { status: "create" };
}

function rowKey(storeId, row, observedDate) {
  return [storeId, compact(row.product_name), compact(row.brand), compact(row.size), observedDate, Number(row.current_price).toFixed(2), "retailer_website_manual"].join("|");
}

async function inspectPrice(storeId, productId, row, observedDate) {
  const duplicate = await get("SELECT id FROM price_reports WHERE store_id = ? AND product_id = ? AND lower(trim(COALESCE(size_text,''))) = lower(trim(?)) AND date(COALESCE(NULLIF(source_date,''),submitted_at)) = date(?) AND ABS(price - ?) < 0.005 AND status IN ('approved','expired') ORDER BY id DESC LIMIT 1", [storeId, productId, row.size, observedDate, Number(row.current_price)]);
  if (duplicate) return { status: "duplicate", report_id: duplicate.id };
  const newer = await get("SELECT id, price, source_date, submitted_at FROM price_reports WHERE store_id = ? AND product_id = ? AND status = 'approved' AND date(COALESCE(NULLIF(source_date,''),submitted_at)) > date(?) ORDER BY date(COALESCE(NULLIF(source_date,''),submitted_at)) DESC, id DESC LIMIT 1", [storeId, productId, observedDate]);
  if (newer) return { status: "newer_conflict", report: newer };
  const current = await get("SELECT id, price, source_date, submitted_at FROM price_reports WHERE store_id = ? AND product_id = ? AND status = 'approved' ORDER BY date(COALESCE(NULLIF(source_date,''),submitted_at)) DESC, id DESC LIMIT 1", [storeId, productId]);
  return current ? { status: Math.abs(Number(current.price) - Number(row.current_price)) < 0.005 ? "duplicate" : "change", report: current } : { status: "add" };
}

function familySuggestion(row) {
  const name = compact(row.product_name);
  if (name.includes("almond")) return "Almond Milk 64 fl oz";
  if (name.includes("egg") && /12 ct|dozen/.test(compact(row.size))) return "Large Eggs 12 ct";
  if (!name.includes("milk")) return null;
  const fat = name.includes("skim") || name.includes("fat free") || name.includes("0 fat") ? "Skim/Fat-Free Milk" : name.includes("1") ? "1% Milk" : name.includes("2") ? "2% Milk" : name.includes("whole") ? "Whole Milk" : "Milk";
  return `${fat} ${row.size}`;
}

async function previewCuratedBatch(batchInput) {
  const batch = validateBatch(batchInput);
  const preview = { batch_id: batch.batch_id, observed_date: batch.observed_date, timezone: batch.timezone, writes_performed: 0, stores: [], totals: { input_rows: 0, unique_rows: 0, existing_products_matched: 0, products_would_create: 0, ambiguous_matches: 0, prices_would_add: 0, prices_would_change: 0, duplicate_observations_skipped: 0, newer_price_conflicts: 0, locations_would_add: 0, locations_would_update: 0, location_conflicts: 0, retailer_declared_previous_prices: 0, records_needing_manual_review: 0 }, family_suggestions: [] };
  for (const storeBatch of batch.stores) {
    const resolution = await resolveStore(storeBatch);
    const storePreview = { store_key: storeBatch.store_key, source_location_text: storeBatch.source_location_text, resolution, rows: [], apply_blocked: resolution.status !== "resolved" };
    const seen = new Set();
    for (const [index, row] of storeBatch.rows.entries()) {
      preview.totals.input_rows += 1;
      validateRow(row, storeBatch.store_key, index);
      const key = rowKey(resolution.store?.id || storeBatch.store_key, row, batch.observed_date);
      if (seen.has(key)) { preview.totals.duplicate_observations_skipped += 1; storePreview.rows.push({ index, product_name: row.product_name, size: row.size, status: "duplicate_input" }); continue; }
      seen.add(key); preview.totals.unique_rows += 1;
      if (row.previous_price != null) preview.totals.retailer_declared_previous_prices += 1;
      if (resolution.status !== "resolved") { preview.totals.records_needing_manual_review += 1; storePreview.rows.push({ index, product_name: row.product_name, size: row.size, status: "store_location_needs_review" }); continue; }
      const match = await matchProduct(row);
      if (match.status === "ambiguous") { preview.totals.ambiguous_matches += 1; preview.totals.records_needing_manual_review += 1; storePreview.rows.push({ index, product_name: row.product_name, size: row.size, status: "ambiguous_product", candidates: match.candidates.map((item) => ({ id: item.id, display_name: item.display_name })) }); continue; }
      if (match.status === "matched") preview.totals.existing_products_matched += 1;
      else preview.totals.products_would_create += 1;
      let price = { status: "add" };
      if (match.product) price = await inspectPrice(resolution.store.id, match.product.id, row, batch.observed_date);
      if (price.status === "duplicate") preview.totals.duplicate_observations_skipped += 1;
      else if (price.status === "change") preview.totals.prices_would_change += 1;
      else if (price.status === "newer_conflict") { preview.totals.newer_price_conflicts += 1; preview.totals.records_needing_manual_review += 1; }
      else preview.totals.prices_would_add += 1;
      if (hasStoreProductLocation(row)) {
        const currentLocation = match.product ? await currentStoreProductLocation(resolution.store.id, match.product.id) : null;
        if (!currentLocation) preview.totals.locations_would_add += 1;
        else if (["department","aisle","shelf","bay","section","location_note"].some((field) => compact(currentLocation[field]) !== compact(row[field]))) { preview.totals.locations_would_update += 1; preview.totals.location_conflicts += 1; }
      }
      const suggestion = familySuggestion(row); if (suggestion) preview.family_suggestions.push({ product_name: row.product_name, size: row.size, suggested_family: suggestion, human_confirmed: false });
      storePreview.rows.push({ index, product_name: row.product_name, brand: row.brand, size: row.size, current_price: row.current_price, previous_price: row.previous_price ?? null, displayed_discount_percent: row.displayed_discount_percent ?? null, product_match: match.status === "matched" ? { id: match.product.id, display_name: match.product.display_name, rule: match.rule } : null, product_action: match.status, price_action: price.status, location_action: hasStoreProductLocation(row) ? "add_or_version" : "none" });
    }
    storePreview.unique_rows = seen.size;
    preview.stores.push(storePreview);
  }
  preview.family_suggestions = preview.family_suggestions.filter((item, index, items) => items.findIndex((other) => other.suggested_family === item.suggested_family) === index);
  preview.apply_blocked = preview.stores.some((store) => store.apply_blocked) || preview.totals.ambiguous_matches > 0 || preview.totals.newer_price_conflicts > 0;
  return preview;
}

async function applyCuratedBatch(batchInput, confirmation) {
  if (confirmation !== APPLY_CONFIRMATION) throw new Error(`Apply requires --confirm ${APPLY_CONFIRMATION}.`);
  const batch = validateBatch(batchInput);
  const preview = await previewCuratedBatch(batch);
  if (preview.apply_blocked) throw new Error("Curated import is blocked because store/product/newer-price review is still required.");
  const owner = await get("SELECT id FROM users WHERE is_admin = 1 AND COALESCE(account_status,'active') = 'active' ORDER BY CASE WHEN lower(username) = 'owner' THEN 0 ELSE 1 END, id LIMIT 1");
  if (!owner) throw new Error("An active Owner/Admin account is required to own curated approved-price provenance.");
  const now = new Date().toISOString();
  const expiresAt = new Date(`${batch.observed_date}T23:59:59-05:00`); expiresAt.setUTCDate(expiresAt.getUTCDate() + 14);
  const result = { ...preview, writes_performed: 0, applied_reports: [], applied_locations: [] };
  await run("BEGIN IMMEDIATE");
  try {
    for (const storeBatch of batch.stores) {
      const resolution = await resolveStore(storeBatch);
      const seen = new Set();
      const batchInsert = await run(`INSERT INTO price_import_batches (source_type, proof_type, photo_path, status, source_title, source_domain, source_checked_at, default_store_id, batch_title, observed_at, source_text, notes, created_by, created_at, updated_at, location_verification_status, applicable_store_id, location_evidence_text) VALUES ('website','no_photo',?,'used_for_prices',?,?,?,?,?,?,?,?,?,?,?,'verified_exact_store',?,?)`, [`curated:${batch.batch_id}:${storeBatch.store_key}`, storeBatch.source_family, compact(storeBatch.source_family).includes("aldi") ? "aldi.us" : "shopwoodmans.com", `${batch.observed_date}T12:00:00-05:00`, resolution.store.id, `${batch.batch_id} — ${storeBatch.retailer}`, `${batch.observed_date}T12:00:00-05:00`, JSON.stringify({ batch_id: batch.batch_id, human_curated: true }), `Human-curated retailer website transcription. Source location: ${storeBatch.source_location_text}`, owner.id, now, now, resolution.store.id, storeBatch.source_location_text]);
      result.writes_performed += 1;
      for (const row of storeBatch.rows) {
        const key = rowKey(resolution.store.id, row, batch.observed_date); if (seen.has(key)) continue; seen.add(key);
        let match = await matchProduct(row); let productId = match.product?.id;
        if (!productId) {
          const created = await run(`INSERT INTO products (canonical_name, display_name, category, default_size_text, default_quantity, default_unit, default_storage_condition, brand_optional, preferred_brand, common_aliases, status, created_by_admin_id, admin_note, updated_by, created_at, updated_at) VALUES (?, ?, 'dairy', ?, 1, 'each', 'refrigerated', 0, ?, ?, 'active', ?, ?, ?, ?, ?)`, [normalizeProductName(row.product_name), row.product_name, row.size, row.brand || "", normalizeProductName(row.product_name), owner.id, `Created by curated batch ${batch.batch_id}`, owner.id, now, now]);
          productId = created.lastID; result.writes_performed += 1;
        }
        const priceState = await inspectPrice(resolution.store.id, productId, row, batch.observed_date); if (priceState.status === "duplicate") continue;
        if (priceState.report?.id && priceState.status === "change") await run("UPDATE price_reports SET status = 'expired', freshness_status = 'historical' WHERE id = ?", [priceState.report.id]);
        const importRow = await run(`INSERT INTO price_import_rows (batch_id, product_id, store_id, item_name, brand, category, price, regular_price, retailer_displayed_discount_percent, sale_price, size_text, quantity, unit, price_basis, comparison_price, comparison_unit, proof_type, observed_at, source_date, source_title, source_domain, source_checked_at, storage_condition, price_type, department, shelf, status, created_by, created_at, updated_by, updated_at, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, 'dairy', ?, ?, ?, ?, ?, 1, 'each', 'package', ?, 'each', 'no_photo', ?, ?, ?, ?, ?, 'refrigerated', ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)`, [batchInsert.lastID, productId, resolution.store.id, row.product_name, row.brand || "", Number(row.current_price), row.previous_price ?? null, row.displayed_discount_percent ?? null, row.previous_price != null ? 1 : 0, row.size, Number(row.current_price), `${batch.observed_date}T12:00:00-05:00`, batch.observed_date, storeBatch.source_family, compact(storeBatch.source_family).includes("aldi") ? "aldi.us" : "shopwoodmans.com", `${batch.observed_date}T12:00:00-05:00`, row.previous_price != null ? "sale" : "regular", row.department || "", row.shelf || "", owner.id, now, owner.id, now, owner.id, now]);
        const report = await run(`INSERT INTO price_reports (user_id, submitted_by_user_id, source_import_batch_id, source_import_row_id, store_id, product_id, item_name, brand, category, price, regular_price, retailer_displayed_discount_percent, sale_price, size_text, quantity, unit, unit_price, price_basis, comparison_price, comparison_unit, proof_type, source_date, storage_condition, price_type, notes, confidence, source_title, source_domain, source_checked_at, location_verification_status, applicable_city, applicable_state, applicable_store_id, location_evidence_text, verification_count, dispute_count, status, reviewed_at, reviewed_by, review_started_at, review_completed_at, freshness_status, submitted_at, expires_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'dairy', ?, ?, ?, ?, ?, 1, 'each', ?, 'package', ?, 'each', 'no_photo', ?, 'refrigerated', ?, ?, 'medium', ?, ?, ?, 'verified_exact_store', 'Janesville', 'WI', ?, ?, 0, 0, 'approved', ?, ?, ?, ?, 'current', ?, ?)`, [owner.id, batchInsert.lastID, importRow.lastID, resolution.store.id, productId, row.product_name, row.brand || "", Number(row.current_price), row.previous_price ?? null, row.displayed_discount_percent ?? null, row.previous_price != null ? 1 : 0, row.size, Number(row.current_price), Number(row.current_price), batch.observed_date, row.previous_price != null ? "sale" : "regular", `Human-curated retailer website transcription; batch ${batch.batch_id}.`, storeBatch.source_family, compact(storeBatch.source_family).includes("aldi") ? "aldi.us" : "shopwoodmans.com", `${batch.observed_date}T12:00:00-05:00`, resolution.store.id, storeBatch.source_location_text, now, owner.id, now, now, now, expiresAt.toISOString()]);
        await run("UPDATE price_import_rows SET price_report_id = ? WHERE id = ?", [report.lastID, importRow.lastID]);
        await run("INSERT INTO admin_audit_log (admin_user_id, action, affected_type, affected_id, metadata_json, created_at) VALUES (?, 'CURATED_RETAILER_PRICE_IMPORTED', 'price_report', ?, ?, ?)", [owner.id, report.lastID, JSON.stringify({ batch_id: batch.batch_id, source_type: batch.source_type, source_location_text: storeBatch.source_location_text, observed_date: batch.observed_date, previous_price: row.previous_price ?? null, displayed_discount_percent: row.displayed_discount_percent ?? null }), now]);
        result.applied_reports.push(report.lastID); result.writes_performed += 3;
        if (hasStoreProductLocation(row)) {
          const saved = await saveStoreProductLocation({ storeId: resolution.store.id, productId, location: { ...row, source_type: batch.source_type, source_reference: `${storeBatch.source_family} — ${storeBatch.source_location_text}`, verified_at: `${batch.observed_date}T12:00:00-05:00` }, staffId: owner.id, reason: `Human-curated batch ${batch.batch_id}`, transaction: false });
          result.applied_locations.push(saved.location.id); if (saved.changed) result.writes_performed += 2;
        }
      }
    }
    await run("COMMIT");
  } catch (error) { await run("ROLLBACK").catch(() => {}); throw error; }
  return result;
}

module.exports = { APPLY_CONFIRMATION, normalizeAddress, validateBatch, resolveStore, previewCuratedBatch, applyCuratedBatch };
