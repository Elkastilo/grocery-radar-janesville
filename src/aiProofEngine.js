"use strict";

const crypto = require("node:crypto");

const CONFIDENCE_VALUES = ["high", "check", "unknown"];

function clean(value, max = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function confidence(value) {
  const normalized = clean(value, 20).toLowerCase();
  if (["high", "confident", "ready"].includes(normalized)) return "high";
  if (["medium", "low", "check", "uncertain"].includes(normalized)) return "check";
  return "unknown";
}

function numberOrNull(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function stringArray(value, maxItems = 20) {
  return (Array.isArray(value) ? value : []).map((item) => clean(item, 300)).filter(Boolean).slice(0, maxItems);
}

function normalizeAiResult(raw = {}, proof = {}) {
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 250).map((item, index) => {
    const normalizedName = clean(item.normalized_name || item.item_name, 160);
    const price = numberOrNull(item.price);
    const comparisonPrice = numberOrNull(item.comparison_price ?? item.primary_comparison_price ?? item.unit_price ?? item.price);
    const itemConfidence = confidence(item.confidence || item.overall_confidence);
    const warnings = stringArray(item.warnings, 12);
    if (!normalizedName) warnings.push("Could not confidently identify this item.");
    if (price === null) warnings.push("Could not determine a price.");
    return {
      item_index: index,
      raw_text: clean(item.raw_text, 500),
      normalized_name: normalizedName,
      brand: clean(item.brand, 100),
      variant: clean(item.variant, 100),
      quantity: numberOrNull(item.quantity) || 1,
      package_size: clean(item.package_size || item.size_text, 100),
      price,
      unit_price: numberOrNull(item.unit_price),
      price_basis: clean(item.price_basis, 40),
      comparison_price: comparisonPrice,
      comparison_unit: clean(item.comparison_unit || item.unit_basis || "each", 30).toLowerCase(),
      estimated_item_price: numberOrNull(item.estimated_item_price),
      approximate_item_weight: numberOrNull(item.approximate_item_weight),
      approximate_item_weight_unit: clean(item.approximate_item_weight_unit, 20).toLowerCase(),
      package_price: numberOrNull(item.package_price),
      multi_buy_quantity: numberOrNull(item.multi_buy_quantity),
      multi_buy_total: numberOrNull(item.multi_buy_total),
      category: clean(item.category || "Other", 60),
      storage_type: clean(item.storage_type || item.storage_condition || "Unknown", 60),
      price_type: clean(item.price_type || "Unknown", 60),
      valid_from_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(item.valid_from_date, 20)) ? clean(item.valid_from_date, 20) : "",
      valid_through_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(item.valid_through_date, 20)) ? clean(item.valid_through_date, 20) : "",
      promotion_conditions: clean(item.promotion_conditions, 500),
      promotion_schedule_text: clean(item.promotion_schedule_text, 240),
      display_offer_text: clean(item.display_offer_text || item.raw_text, 240),
      date_evidence: clean(item.date_evidence, 300),
      existing_product_match_id: Number.isInteger(Number(item.existing_product_match_id)) ? Number(item.existing_product_match_id) : null,
      existing_product_match_confidence: confidence(item.existing_product_match_confidence),
      suggested_new_product: Boolean(item.suggested_new_product || !item.existing_product_match_id),
      confidence: normalizedName && price !== null ? itemConfidence : "unknown",
      field_confidences: Object.fromEntries(Object.entries(item.field_confidences || {}).slice(0, 30).map(([key, value]) => [clean(key, 50), confidence(value)])),
      warnings: [...new Set(warnings)],
      research_notes: clean(item.research_notes, 600),
      research_sources: (Array.isArray(item.research_sources) ? item.research_sources : []).slice(0, 8).map((source) => ({
        title: clean(source?.title, 160),
        url: /^https:\/\//i.test(clean(source?.url, 500)) ? clean(source.url, 500) : ""
      })).filter((source) => source.title || source.url)
    };
  });
  const counts = items.reduce((output, item) => {
    output[item.confidence] += 1;
    return output;
  }, { high: 0, check: 0, unknown: 0 });
  return {
    proof_id: Number(proof.id),
    proof_type: clean(proof.proof_type || raw.proof_type, 40),
    detected_store: clean(raw.detected_store, 160),
    detected_store_confidence: confidence(raw.detected_store_confidence),
    source_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(raw.source_date, 20)) ? clean(raw.source_date, 20) : "",
    source_date_confidence: confidence(raw.source_date_confidence),
    overall_confidence: confidence(raw.overall_confidence),
    warnings: stringArray(raw.warnings),
    items,
    counts
  };
}

function responseSchema() {
  return {
    name: "grocery_proof_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["proof_id", "proof_type", "detected_store", "detected_store_confidence", "source_date", "source_date_confidence", "overall_confidence", "warnings", "items"],
      properties: {
        proof_id: { type: "integer" }, proof_type: { type: "string" }, detected_store: { type: "string" },
        detected_store_confidence: { type: "string", enum: CONFIDENCE_VALUES }, source_date: { type: "string" },
        source_date_confidence: { type: "string", enum: CONFIDENCE_VALUES }, overall_confidence: { type: "string", enum: CONFIDENCE_VALUES },
        warnings: { type: "array", items: { type: "string" } },
        items: { type: "array", items: {
          type: "object", additionalProperties: false,
          required: ["raw_text", "normalized_name", "brand", "variant", "quantity", "package_size", "price", "unit_price", "price_basis", "comparison_price", "comparison_unit", "estimated_item_price", "approximate_item_weight", "approximate_item_weight_unit", "package_price", "multi_buy_quantity", "multi_buy_total", "category", "storage_type", "price_type", "valid_from_date", "valid_through_date", "promotion_conditions", "promotion_schedule_text", "display_offer_text", "date_evidence", "existing_product_match_id", "existing_product_match_confidence", "suggested_new_product", "confidence", "field_confidences", "warnings", "research_notes", "research_sources"],
          properties: {
            raw_text: { type: "string" }, normalized_name: { type: "string" }, brand: { type: "string" }, variant: { type: "string" },
            quantity: { type: ["number", "null"] }, package_size: { type: "string" }, price: { type: ["number", "null"] }, unit_price: { type: ["number", "null"] },
            price_basis: { type: "string" }, comparison_price: { type: ["number", "null"] }, comparison_unit: { type: "string" },
            estimated_item_price: { type: ["number", "null"] }, approximate_item_weight: { type: ["number", "null"] }, approximate_item_weight_unit: { type: "string" }, package_price: { type: ["number", "null"] },
            multi_buy_quantity: { type: ["number", "null"] }, multi_buy_total: { type: ["number", "null"] }, category: { type: "string" }, storage_type: { type: "string" }, price_type: { type: "string" },
            valid_from_date: { type: "string" }, valid_through_date: { type: "string" }, promotion_conditions: { type: "string" }, promotion_schedule_text: { type: "string" }, display_offer_text: { type: "string" }, date_evidence: { type: "string" },
            existing_product_match_id: { type: ["integer", "null"] }, existing_product_match_confidence: { type: "string", enum: CONFIDENCE_VALUES }, suggested_new_product: { type: "boolean" }, confidence: { type: "string", enum: CONFIDENCE_VALUES },
            field_confidences: {
              type: "object",
              additionalProperties: false,
              required: ["normalized_name", "brand", "variant", "quantity", "package_size", "price", "category", "storage_type", "price_type", "product_match"],
              properties: Object.fromEntries(["normalized_name", "brand", "variant", "quantity", "package_size", "price", "category", "storage_type", "price_type", "product_match"].map((key) => [key, { type: "string", enum: CONFIDENCE_VALUES }]))
            }, warnings: { type: "array", items: { type: "string" } }, research_notes: { type: "string" },
            research_sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "url"], properties: { title: { type: "string" }, url: { type: "string" } } } }
          }
        } }
      }
    }
  };
}

function runtimeConfig(env = process.env) {
  return {
    apiKey: clean(env.AI_API_KEY || env.OPENAI_API_KEY, 500),
    endpoint: clean(env.AI_API_URL || "https://api.openai.com/v1/chat/completions", 500),
    model: clean(env.AI_PRIMARY_MODEL || env.AI_MODEL || "gpt-5-mini", 100),
    fallbackModel: clean(env.AI_FALLBACK_MODEL, 100),
    provider: clean(env.AI_PROVIDER || "openai_compatible", 60),
    testResponse: env.NODE_ENV === "test" ? String(env.AI_TEST_RESPONSE_JSON || "") : ""
  };
}

async function analyzeProof({ proof, imageBuffer, mimeType, submittedStore, stores = [], products = [], env = process.env }) {
  const config = runtimeConfig(env);
  if (config.testResponse) return normalizeAiResult(JSON.parse(config.testResponse), proof);
  if (!config.apiKey) throw new Error("AI API credentials are not configured.");
  if (!imageBuffer?.length) throw new Error("The original proof image is unavailable.");
  const prompt = `Analyze only Grocery Radar proof #${proof.id}. Never use information from another proof. AI prepares drafts; it never publishes. The submitted store claim is ${submittedStore || "unknown"}; treat it only as context, never image evidence. Determine the retailer from visible logo, branding, webpage/domain, receipt header, store number, address, and city. If only the chain is visible, return the chain without inventing an exact location. Never invent a start date, expiration date, exact store, loyalty/card requirement, coupon requirement, or purchase quantity. Extract dates only when visibly stated or when exact calendar context is reliably established by the proof metadata; otherwise leave date fields empty and add DATE NEEDS REVIEW. Preserve the exact offer wording in display_offer_text. Use price types regular, sale, one_day_sale, clearance, loyalty_price, digital_coupon, paper_coupon, multi_buy, bogo, bundle, manager_special, or other_promotion. A TODAY ONLY offer with no reliable date must have blank validity dates. For 2 for $5, preserve 2 for $5 and do not claim $2.50 each unless the evidence explicitly allows a single-item purchase at that price. Read every grocery line and preserve uncertainty. Match Grocery Radar's existing catalog before suggesting enrichment or a new product. External enrichment is secondary and must not block extraction. Proof price evidence must never be replaced by researched prices. Keep comparison price separate from secondary estimates: for bananas shown as $0.49/lb, $0.16 each estimated, about 0.33 lb each, return comparison_price 0.49, comparison_unit lb, estimated_item_price 0.16, and approximate_item_weight 0.33 with unit lb. Known Janesville stores: ${stores.map((store) => `${store.id}:${store.name}`).join(", ")}. Candidate catalog products: ${products.map((product) => `${product.id}:${product.display_name}${product.preferred_brand ? ` | brand ${product.preferred_brand}` : ""}${product.variant ? ` | variant ${product.variant}` : ""}${product.upc ? ` | UPC ${product.upc}` : ""}${product.common_aliases ? ` | aliases ${product.common_aliases}` : ""}`).join(", ")}.`;
  const body = {
    model: config.model,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBuffer.toString("base64")}` } }] }],
    response_format: { type: "json_schema", json_schema: responseSchema() }
  };
  const response = await fetch(config.endpoint, { method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || payload?.output_text;
  if (!content) throw new Error("AI provider returned no structured analysis.");
  const result = normalizeAiResult(typeof content === "string" ? JSON.parse(content) : content, proof);
  const usage = payload?.usage || {};
  result.provider_usage = {
    prompt_tokens: numberOrNull(usage.prompt_tokens ?? usage.input_tokens),
    completion_tokens: numberOrNull(usage.completion_tokens ?? usage.output_tokens),
    total_tokens: numberOrNull(usage.total_tokens)
  };
  return result;
}

function proofFingerprint(proof = {}) {
  return crypto.createHash("sha256").update([proof.id, proof.proof_file_hash, proof.photo_path, proof.updated_at].join("|")).digest("hex");
}

module.exports = { analyzeProof, normalizeAiResult, proofFingerprint, runtimeConfig, responseSchema };
