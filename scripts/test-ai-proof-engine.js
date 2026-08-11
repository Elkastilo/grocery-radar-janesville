"use strict";

const assert = require("node:assert/strict");
const { normalizeAiResult, responseSchema, runtimeConfig } = require("../src/aiProofEngine");
const { closestStoreForAi, localProductNormalization, normalizedRetailerName, usefulDetectedStoreName } = require("../src/catalogIntelligence");

const difficult = normalizeAiResult({
  proof_id: 777,
  proof_type: "receipt_photo",
  detected_store: "ALDI",
  detected_store_confidence: "high",
  source_date: "2026-07-04",
  source_date_confidence: "check",
  overall_confidence: "check",
  warnings: ["One line is unreadable."],
  items: [{ raw_text: "?? 4.29", normalized_name: "", price: 4.29, confidence: "high", warnings: [] }]
}, { id: 42, proof_type: "receipt_photo" });

assert.equal(difficult.proof_id, 42, "Provider proof ids must never control storage scope.");
assert.equal(difficult.items.length, 1);
assert.equal(difficult.items[0].normalized_name, "");
assert.equal(difficult.items[0].confidence, "unknown");
assert.match(difficult.items[0].warnings.join(" "), /Could not confidently identify/);
assert.equal(difficult.counts.unknown, 1);

const prepared = normalizeAiResult({
  items: [
    { raw_text: "BANANAS 1.23 LB @ 0.59 0.73", normalized_name: "Bananas", quantity: 1.23, package_size: "1.23 lb", price: 0.73, category: "Produce", storage_type: "Fresh produce", confidence: "high" },
    { raw_text: "MILK 1 GAL 3.49", normalized_name: "Milk", quantity: 1, package_size: "1 gal", price: 3.49, category: "Dairy & Eggs", storage_type: "Refrigerated", confidence: "high" }
  ]
}, { id: 9, proof_type: "receipt_photo" });
assert.equal(prepared.items.length, 2);
assert.equal(prepared.items[0].price, 0.73);
assert.equal(prepared.items[0].storage_type, "Fresh produce");
assert.equal(prepared.items[1].category, "Dairy & Eggs");
assert.equal(prepared.counts.high, 2);

const aldiBananas = normalizeAiResult({
  detected_store: "ALDI",
  detected_store_confidence: "high",
  items: [{ raw_text: "$0.49/lb · $0.16 each estimated · about 0.33 lb each", normalized_name: "Bananas", price: 0.49, comparison_price: 0.49, comparison_unit: "lb", estimated_item_price: 0.16, approximate_item_weight: 0.33, approximate_item_weight_unit: "lb", category: "Produce", storage_type: "Fresh produce", confidence: "high" }]
}, { id: 10, proof_type: "weekly_ad" });
assert.equal(aldiBananas.detected_store, "ALDI");
assert.equal(aldiBananas.items[0].comparison_price, 0.49);
assert.equal(aldiBananas.items[0].comparison_unit, "lb");
assert.equal(aldiBananas.items[0].estimated_item_price, 0.16);
assert.equal(aldiBananas.items[0].approximate_item_weight, 0.33);

const schema = responseSchema();
assert.equal(schema.strict, true);
assert.equal(schema.schema.additionalProperties, false);
assert.equal(schema.schema.properties.items.items.additionalProperties, false);
assert.equal(schema.schema.properties.items.items.properties.field_confidences.additionalProperties, false);
assert.ok(schema.schema.properties.items.items.properties.field_confidences.required.includes("price"));
assert.ok(schema.schema.properties.items.items.required.includes("comparison_price"));

const routing = runtimeConfig({ AI_MODEL: "legacy-model", AI_PRIMARY_MODEL: "primary-model", AI_FALLBACK_MODEL: "fallback-model" });
assert.equal(routing.model, "primary-model");
assert.equal(routing.fallbackModel, "fallback-model");

const janesvilleStores = [{ id: 1, name: "Woodman's Janesville" }, { id: 2, name: "ALDI Janesville East" }, { id: 3, name: "ALDI Janesville West" }];
assert.equal(normalizedRetailerName("ALDI fresh-produce webpage"), "ALDI");
assert.equal(closestStoreForAi("ALDI", janesvilleStores), null, "A chain-only signal must not invent an exact location.");
assert.equal(closestStoreForAi("unknown", janesvilleStores), null, "Unknown must never become a selectable store.");
assert.equal(usefulDetectedStoreName("unknown"), "");
assert.equal(localProductNormalization("Bananas").category, "produce");
assert.equal(localProductNormalization("Bananas").storage_condition, "fresh produce");
assert.equal(localProductNormalization("Whole Milk").storage_condition, "refrigerated");

console.log("AI proof engine tests passed.");
