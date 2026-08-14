"use strict";

const { normalizeUnit } = require("./unitPrice");

const CONDITIONAL_TYPES = new Set(["loyalty_price", "digital_coupon", "paper_coupon", "multi_buy", "bogo", "bundle", "manager_special"]);
const DIETARY_KEYS = ["gluten_free", "lactose_free", "sugar_free", "zero_sugar", "organic", "vegetarian", "vegan", "nut_free"];

function parseObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}

function priceValue(row) {
  const value = Number(row.comparison_price ?? row.unit_price ?? row.price);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function comparisonUnit(row) {
  return normalizeUnit(row.comparison_unit || row.unit || "");
}

function isConditionalOffer(row) {
  const conditions = String(row.promotion_conditions || "").toLowerCase();
  return CONDITIONAL_TYPES.has(String(row.price_type || "regular").toLowerCase()) || /coupon|loyalty|reward|member|card required|must buy|buy \d|limit \d|with app/.test(conditions) || Number(row.multibuy_quantity || 0) > 1;
}

function comparableRows(rows, mode = "all") {
  return rows.filter((row) => priceValue(row) != null && (mode !== "unconditional" || !isConditionalOffer(row)));
}

function bestRowsByProductStore(rows, mode = "all") {
  const best = new Map();
  for (const row of comparableRows(rows, mode)) {
    const key = `${row.product_id}:${row.store_id}`;
    const existing = best.get(key);
    const value = priceValue(row);
    if (!existing || value < priceValue(existing) || (value === priceValue(existing) && String(row.observed_at || "") > String(existing.observed_at || ""))) best.set(key, row);
  }
  return [...best.values()];
}

function productComparison(rows, stores = [], mode = "all") {
  const best = bestRowsByProductStore(rows, mode).sort((a, b) => priceValue(a) - priceValue(b) || String(a.store_name).localeCompare(String(b.store_name)));
  const cheapest = best[0] || null;
  const cheapestValue = cheapest ? priceValue(cheapest) : null;
  const observedStoreIds = new Set(best.map((row) => Number(row.store_id)));
  return {
    mode,
    comparable_store_count: best.length,
    cheapest_report_id: cheapest?.id || null,
    cheapest_store_id: cheapest?.store_id || null,
    cheapest_store_name: cheapest?.store_name || "",
    cheapest_price: cheapestValue,
    stores: best.map((row, index) => ({ ...row, comparable_price: priceValue(row), comparison_unit: comparisonUnit(row), difference_from_cheapest: Number((priceValue(row) - cheapestValue).toFixed(2)), rank: index + 1, is_cheapest: Math.abs(priceValue(row) - cheapestValue) < 0.005 })),
    unavailable_stores: stores.filter((store) => !observedStoreIds.has(Number(store.id))).map((store) => ({ id: store.id, name: store.name, status: "No current verified price" }))
  };
}

function storeLeaderboard(rows, settings = {}, mode = "all") {
  const best = bestRowsByProductStore(rows, mode);
  const byProduct = new Map();
  for (const row of best) { if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []); byProduct.get(row.product_id).push(row); }
  const stores = new Map();
  for (const row of best) {
    const entry = stores.get(row.store_id) || { store_id: row.store_id, store_name: row.store_name, current_price_count: 0, lowest_count: 0, tied_lowest_count: 0, categories: new Set() };
    entry.current_price_count += 1; if (row.category) entry.categories.add(row.category); stores.set(row.store_id, entry);
  }
  const categories = new Set();
  let comparableProducts = 0;
  let tiedProducts = 0;
  for (const productRows of byProduct.values()) {
    if (productRows.length < 2) continue;
    comparableProducts += 1;
    if (productRows[0]?.category) categories.add(productRows[0].category);
    const minimum = Math.min(...productRows.map(priceValue));
    const winners = productRows.filter((row) => Math.abs(priceValue(row) - minimum) < 0.005);
    if (winners.length > 1) tiedProducts += 1;
    for (const row of productRows) {
      const entry = stores.get(row.store_id);
      if (winners.some((winner) => winner.store_id === row.store_id)) {
        if (winners.length === 1) entry.lowest_count += 1;
        else entry.tied_lowest_count += 1;
      }
      stores.set(row.store_id, entry);
    }
  }
  const rankings = [...stores.values()].map((entry) => ({ ...entry, category_count: entry.categories.size, categories: [...entry.categories] })).sort((a, b) => b.lowest_count - a.lowest_count || b.tied_lowest_count - a.tied_lowest_count || a.store_name.localeCompare(b.store_name));
  const minimumProducts = Number(settings.minimum_broad_products || 20);
  const minimumCategories = Number(settings.minimum_broad_categories || 3);
  const thresholdMet = comparableProducts >= minimumProducts && categories.size >= minimumCategories;
  const leaderMargin = rankings.length > 1 ? rankings[0].lowest_count - rankings[1].lowest_count : 0;
  const clearLeader = thresholdMet && rankings.length > 1 && leaderMargin > Number(settings.no_clear_leader_margin ?? 1);
  return { mode, comparable_product_count: comparableProducts, represented_category_count: categories.size, tied_product_count: tiedProducts, minimum_products: minimumProducts, minimum_categories: minimumCategories, threshold_met: thresholdMet, clear_leader: clearLeader, leader_margin: leaderMargin, status_message: !thresholdMet ? "Limited comparison data." : clearLeader ? "A factual leader is available for this dataset." : "No clear leader this week.", rankings };
}

function categoryLeaderboards(rows, settings = {}, mode = "all") {
  const categories = new Map();
  for (const row of rows) { const category = row.category || "other"; if (!categories.has(category)) categories.set(category, []); categories.get(category).push(row); }
  return [...categories.entries()].map(([category, categoryRows]) => ({ category, ...storeLeaderboard(categoryRows, { ...settings, minimum_broad_products: 1, minimum_broad_categories: 1 }, mode) })).filter((item) => item.comparable_product_count > 0).sort((a, b) => b.comparable_product_count - a.comparable_product_count || a.category.localeCompare(b.category));
}

function combinations(values, size) {
  if (size <= 0) return [[]];
  const output = [];
  const visit = (start, chosen) => { if (chosen.length === size) { output.push(chosen); return; } for (let index = start; index < values.length; index += 1) visit(index + 1, [...chosen, values[index]]); };
  visit(0, []); return output;
}

function basketPlanForStores(items, rows, storeIds) {
  const allowed = new Set(storeIds.map(Number));
  const byProduct = new Map();
  for (const row of rows.filter((entry) => allowed.has(Number(entry.store_id)))) { if (!byProduct.has(Number(row.product_id))) byProduct.set(Number(row.product_id), []); byProduct.get(Number(row.product_id)).push(row); }
  const matches = []; const missing = []; let total = 0;
  for (const item of items) {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const candidates = (byProduct.get(Number(item.product_id)) || []).map((row) => {
      const required = Math.max(1, Number(row.multibuy_quantity || 1));
      if (required > 1) {
        const totalOffer = Number(row.multibuy_total_price);
        if (quantity % required !== 0 || !Number.isFinite(totalOffer) || totalOffer <= 0) return null;
        return { row, lineTotal: totalOffer * (quantity / required) };
      }
      return { row, lineTotal: priceValue(row) * quantity };
    }).filter(Boolean).sort((left, right) => left.lineTotal - right.lineTotal || String(left.row.store_name).localeCompare(String(right.row.store_name)));
    const selected = candidates[0];
    if (!selected) { missing.push(item); continue; }
    const row = selected.row; const lineTotal = selected.lineTotal; total += lineTotal;
    matches.push({ item, report: row, quantity, line_total: Number(lineTotal.toFixed(2)) });
  }
  return { store_ids: [...new Set(matches.map((match) => Number(match.report.store_id)))], eligible_store_ids: [...allowed], matched_count: matches.length, requested_count: items.length, coverage_percent: items.length ? Math.round(matches.length / items.length * 1000) / 10 : 0, estimated_total: Number(total.toFixed(2)), matches, missing_items: missing };
}

function optimizeBasket(items, rows, stores, maxStores = "any", mode = "all") {
  const bestRows = bestRowsByProductStore(rows, mode);
  const eligibleStoreIds = stores.filter((store) => bestRows.some((row) => Number(row.store_id) === Number(store.id))).map((store) => Number(store.id));
  const planSort = (a, b) => b.matched_count - a.matched_count || a.estimated_total - b.estimated_total || a.store_ids.join(",").localeCompare(b.store_ids.join(","));
  const oneStorePlans = eligibleStoreIds.map((id) => basketPlanForStores(items, bestRows, [id])).sort(planSort);
  const twoStorePlans = combinations(eligibleStoreIds, 2).map((ids) => basketPlanForStores(items, bestRows, ids)).sort(planSort);
  const allStorePlan = basketPlanForStores(items, bestRows, eligibleStoreIds);
  const requestedMax = maxStores === "any" ? "any" : Math.max(1, Math.min(3, Number(maxStores) || 1));
  const candidates = requestedMax === "any" ? [allStorePlan] : requestedMax === 1 ? oneStorePlans : requestedMax === 2 ? twoStorePlans : combinations(eligibleStoreIds, requestedMax).map((ids) => basketPlanForStores(items, bestRows, ids)).sort(planSort);
  const selected = candidates[0] || basketPlanForStores(items, [], []);
  const commonProductIds = items.map((item) => Number(item.product_id)).filter((productId) => eligibleStoreIds.length && eligibleStoreIds.every((storeId) => bestRows.some((row) => Number(row.product_id) === productId && Number(row.store_id) === storeId)));
  const comparableSubset = oneStorePlans.map((plan) => basketPlanForStores(items.filter((item) => commonProductIds.includes(Number(item.product_id))), bestRows, plan.store_ids));
  return { mode, max_stores: requestedMax, requested_count: items.length, participating_store_count: eligibleStoreIds.length, selected, best_one_store: oneStorePlans[0] || null, best_two_stores: twoStorePlans[0] || null, cheapest_any_store: allStorePlan, store_coverage: oneStorePlans, comparable_subset: { product_count: commonProductIds.length, product_ids: commonProductIds, stores: comparableSubset }, coverage_warning: selected.matched_count < items.length ? "Totals are partial. Missing products are not treated as free or as expensive." : "All requested products have a current verified match in this plan." };
}

function dietaryConflicts(sourceAttributes, targetAttributes) {
  const source = parseObject(sourceAttributes); const target = parseObject(targetAttributes); const conflicts = [];
  for (const key of DIETARY_KEYS) if (source[key] === true && target[key] !== true) conflicts.push(`${key.replaceAll("_", " ")} compatibility is not verified`);
  if (source.allergens_known === true && target.allergens_known !== true) conflicts.push("allergen compatibility is unknown");
  return conflicts;
}

function sizeCompatible(source, target) {
  const sourceUnit = normalizeUnit(source.default_unit || source.comparison_unit || ""); const targetUnit = normalizeUnit(target.default_unit || target.comparison_unit || "");
  if (sourceUnit && targetUnit && sourceUnit !== targetUnit) return false;
  const sourceSize = String(source.default_size_text || source.size_text || "").trim().toLowerCase(); const targetSize = String(target.default_size_text || target.size_text || "").trim().toLowerCase();
  if (Boolean(sourceSize) !== Boolean(targetSize)) return false;
  if (sourceSize && targetSize && sourceSize !== targetSize) return false;
  return true;
}

module.exports = { CONDITIONAL_TYPES, DIETARY_KEYS, parseObject, priceValue, comparisonUnit, isConditionalOffer, comparableRows, bestRowsByProductStore, productComparison, storeLeaderboard, categoryLeaderboards, optimizeBasket, dietaryConflicts, sizeCompatible };
