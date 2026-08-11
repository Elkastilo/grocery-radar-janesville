"use strict";

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

const SIZE_UNIT_MAP = {
  z: "oz",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  c: "ct",
  ct: "ct",
  count: "ct",
  counts: "ct",
  pk: "pack",
  pack: "pack",
  packs: "pack",
  roll: "roll",
  rolls: "roll",
  can: "can",
  cans: "can",
  bottle: "bottle",
  bottles: "bottle",
  bag: "bag",
  bags: "bag",
  gallon: "gallon",
  gallons: "gallon",
  gal: "gallon"
};

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function compactSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function moneyValue(value) {
  const number = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function priceString(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "";
}

function normalizeSizeUnit(unit) {
  const text = cleanText(unit, 20).toLowerCase().replace(/\./g, "");

  if (text === "fl oz" || text === "floz" || text === "fl. oz") {
    return "fl oz";
  }

  return SIZE_UNIT_MAP[text] || text;
}

function normalizeItemName(value) {
  return cleanText(value, 160)
    .replace(/\b(with\s+(?:card|rewards?|loyalty)|digital\s+coupon|coupon|required|limit\s+\d+)\b.*$/i, "")
    .replace(/\b(reg\.?|regular|sale|only|each|ea)\b$/i, "")
    .replace(/^[-*:;|/\\.[\] ]+/, "")
    .replace(/[-*:;|/\\.[\] ]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 120);
}

function splitIntakeLines(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n|(?<=\.)\s+(?=\$?\d|\b[A-Z0-9])/)
    .map((line) => cleanText(line, 500))
    .filter(Boolean);
}

function isoDateFromMonthDay(monthText, dayText, year) {
  const month = MONTHS[String(monthText || "").toLowerCase()];
  const day = Number.parseInt(dayText, 10);

  if (!month || !Number.isInteger(day) || day < 1 || day > 31) {
    return "";
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function detectDateRange(text, year = new Date().getFullYear()) {
  const match = String(text || "").match(
    /(?:mon|tue|wed|thu|fri|sat|sun)?\.?\s*([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(?:mon|tue|wed|thu|fri|sat|sun)?\.?\s*([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?/i
  );

  if (!match) {
    return { valid_start_at: "", valid_end_at: "" };
  }

  const start = isoDateFromMonthDay(match[1], match[2], year);
  let end = isoDateFromMonthDay(match[3], match[4], year);

  if (start && end && end < start) {
    end = isoDateFromMonthDay(match[3], match[4], year + 1);
  }

  return {
    valid_start_at: start,
    valid_end_at: end
  };
}

function extractSize(itemText) {
  const text = cleanText(itemText, 200);
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(fl\s*oz|floz|oz|z|lb|lbs|ct|c|count|pk|pack|rolls?|cans?|bottles?|bags?|gal|gallon)\b/i);

  if (!match) {
    return {
      item_name: normalizeItemName(text),
      size_text: "",
      package_quantity: null,
      package_unit: ""
    };
  }

  const quantity = Number.parseFloat(match[1]);
  const unit = normalizeSizeUnit(match[2].replace(/\s+/g, " "));
  const itemName = normalizeItemName(`${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`);

  return {
    item_name: itemName,
    size_text: Number.isFinite(quantity) && unit ? `${quantity} ${unit}` : "",
    package_quantity: Number.isFinite(quantity) ? quantity : null,
    package_unit: unit
  };
}

function detectFlags(text) {
  const couponRequired = /\b(digital\s+coupon|coupon\s+required|clip(?:ped)?\s+coupon)\b/i.test(text);
  const withCard = /\b(with\s+(?:card|rewards?|loyalty)|member\s+(?:price|card))\b/i.test(text);
  const limitMatch = String(text || "").match(/\blimit\s+([0-9]+)\b/i);

  return {
    coupon_required: couponRequired,
    with_card: withCard,
    deal_limit: limitMatch ? limitMatch[1] : ""
  };
}

function stripPromotionText(line) {
  return cleanText(line, 500)
    .replace(/\bwith\s+(?:card|rewards?|loyalty)\b/ig, "")
    .replace(/\bdigital\s+coupon\b/ig, "")
    .replace(/\bcoupon\s+required\b/ig, "")
    .replace(/\blimit\s+[0-9]+\b/ig, "")
    .replace(/\bvalid\b.*$/ig, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function removeMatchedSegment(text, match) {
  if (!match) return text;
  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
}

function createDraftFromLine(line, defaults = {}) {
  const raw = cleanText(line, 500);

  if (!raw) {
    return null;
  }

  if (/^\s*(?:tax|subtotal|sub\s*total|total|balance|cash|change|payment|visa|mastercard|amex|discover|debit|credit|barcode|receipt)\b/i.test(raw)) {
    return null;
  }

  const flags = detectFlags(raw);
  const dates = detectDateRange(raw, defaults.year || new Date().getFullYear());
  const promotionText = cleanText(raw, 240);
  let working = stripPromotionText(raw);
  let price = null;
  let regularPrice = null;
  let itemText = "";
  let quantity = 1;
  let unit = "each";
  let salePrice = false;
  let memberCardPrice = null;
  let multibuyDetails = "";
  let confidence = "low";
  const notes = [];

  const regularMatch = working.match(/\b(?:reg(?:ular)?\.?|was)\s*\$?(\d+(?:\.\d{1,2})?)\b/i);
  if (regularMatch) {
    regularPrice = moneyValue(regularMatch[1]);
    working = removeMatchedSegment(working, regularMatch);
  }

  const quantityAtMatch = working.match(/^(\d+(?:\.\d+)?)\s*@\s*\$?(\d+(?:\.\d{1,2})?)\s+(.+?)(?:\s+\$?(\d+(?:\.\d{1,2})?))?$/i);
  const multiBuyMatch = working.match(/\b(\d+)\s*(?:\/|for)\s*\$?(\d+(?:\.\d{1,2})?)\b/i);
  const bogoMatch = working.match(/\b(?:buy\s*1\s*get\s*1\s*(?:free|50%\s*off)?|bogo)\b/i);
  const perUnitMatch = working.match(/\$?(\d+(?:\.\d{1,2})?)\s*\/\s*(lb|lbs|oz|ct|each|ea)\b/i);
  const rangeMatch = working.match(/\$?(\d+(?:\.\d{1,2})?)\s*[-–]\s*\$?(\d+(?:\.\d{1,2})?)\b/);
  const firstPriceMatch = working.match(/\$(\d+(?:\.\d{1,2})?)|\b(\d+\.\d{2})\b/);

  if (quantityAtMatch) {
    const purchasedQuantity = Number.parseFloat(quantityAtMatch[1]);
    price = moneyValue(quantityAtMatch[2]);
    const lineTotal = moneyValue(quantityAtMatch[4]);
    itemText = quantityAtMatch[3];
    multibuyDetails = `${purchasedQuantity} @ $${priceString(price)}`;
    salePrice = true;
    confidence = price !== null && itemText ? "high" : "low";

    if (lineTotal !== null) {
      notes.push(`Line total $${priceString(lineTotal)} for ${purchasedQuantity} items at $${priceString(price)} each.`);
    }
  } else if (multiBuyMatch) {
    const buyQuantity = Number.parseInt(multiBuyMatch[1], 10);
    const total = moneyValue(multiBuyMatch[2]);
    price = buyQuantity > 0 && total !== null ? total / buyQuantity : null;
    itemText = removeMatchedSegment(working, multiBuyMatch);
    multibuyDetails = `${buyQuantity} for $${priceString(total)}`;
    salePrice = true;
    confidence = price !== null && itemText ? "medium" : "low";
    notes.push(`Multi-buy offer ${multibuyDetails}; comparable per-item price calculated as $${priceString(price)}.`);
  } else if (bogoMatch) {
    const priceMatch = firstPriceMatch;
    price = priceMatch ? moneyValue(priceMatch[1] || priceMatch[2]) : null;
    const withoutPrice = priceMatch ? removeMatchedSegment(working, priceMatch) : working;
    itemText = removeMatchedSegment(withoutPrice, bogoMatch);
    multibuyDetails = "Buy 1 Get 1 Free";
    salePrice = true;
    confidence = price !== null && itemText ? "medium" : "low";
    notes.push("BOGO offer detected. Admin must confirm the comparable price before approval.");
  } else if (perUnitMatch) {
    price = moneyValue(perUnitMatch[1]);
    unit = normalizeSizeUnit(perUnitMatch[2]) || "each";
    quantity = 1;
    itemText = removeMatchedSegment(working, perUnitMatch);
    salePrice = true;
    confidence = price !== null && itemText ? "medium" : "low";
  } else if (rangeMatch) {
    const low = moneyValue(rangeMatch[1]);
    const high = moneyValue(rangeMatch[2]);
    price = low !== null && high !== null ? Math.min(low, high) : null;
    itemText = removeMatchedSegment(working, rangeMatch);
    salePrice = true;
    confidence = "low";
    notes.push(`Price range detected: $${priceString(low)} to $${priceString(high)}. Admin must confirm exact item price.`);
  } else if (firstPriceMatch) {
    price = moneyValue(firstPriceMatch[1] || firstPriceMatch[2]);
    itemText = removeMatchedSegment(working, firstPriceMatch);
    salePrice = flags.with_card || flags.coupon_required || /sale|deal|only/i.test(raw);
    confidence = price !== null && itemText ? "medium" : "low";
  }

  if (flags.with_card && price !== null) {
    memberCardPrice = price;
    salePrice = true;
  }

  const sized = extractSize(itemText);
  const itemName = sized.item_name;

  if (!price || !itemName || compactSearchText(itemName).length < 2) {
    return null;
  }

  const draftNotes = [
    ...notes,
    flags.with_card ? "Member or loyalty card condition detected." : "",
    flags.coupon_required ? "Digital coupon condition detected." : "",
    flags.deal_limit ? `Limit ${flags.deal_limit}.` : "",
    "Parsed from intake source text. Admin review required."
  ].filter(Boolean).join(" ");

  return {
    product_id: "",
    store_id: defaults.store_id || "",
    item_name: itemName,
    brand: "",
    variant: "",
    category: defaults.category || "other",
    price: priceString(price),
    regular_price: regularPrice !== null ? priceString(regularPrice) : "",
    sale_price: salePrice,
    coupon_required: flags.coupon_required,
    deal_limit: flags.deal_limit,
    size_text: sized.size_text,
    quantity,
    unit,
    member_card_price: memberCardPrice !== null ? priceString(memberCardPrice) : "",
    multibuy_details: multibuyDetails,
    promotion_text: promotionText,
    proof_type: defaults.proof_type || "weekly_ad",
    observed_at: defaults.observed_at || "",
    valid_start_at: defaults.valid_start_at || dates.valid_start_at || "",
    valid_end_at: defaults.valid_end_at || dates.valid_end_at || "",
    source_url: defaults.source_url || "",
    source_title: defaults.source_title || "",
    source_checked_at: defaults.source_checked_at || defaults.observed_at || "",
    raw_receipt_line: defaults.source_type === "receipt" ? raw : "",
    extracted_item_name: itemName,
    extracted_price: priceString(price),
    extracted_quantity: "",
    extracted_weight: unit === "lb" ? 1 : "",
    extracted_unit: unit,
    extraction_confidence: confidence,
    extraction_notes: `${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}: parsed price text; review promotion conditions before approval.`,
    notes: draftNotes,
    status: confidence === "low" ? "needs_edit" : "ready_for_review"
  };
}

function structuredDraft(input = {}, defaults = {}) {
  const itemName = cleanText(input.item_name || input.item || input.name, 120);
  const sizeText = cleanText(input.size_text || input.size || "", 80);
  const price = moneyValue(String(input.price ?? "").replace(/^\$/, ""));
  if (!itemName || price === null || price <= 0) return null;
  const size = extractSize(`${itemName} ${sizeText}`);
  return {
    product_id: "",
    store_id: input.store_id || defaults.store_id || "",
    item_name: itemName,
    brand: cleanText(input.brand || "", 80),
    variant: cleanText(input.variant || "", 80),
    category: cleanText(input.category || defaults.category || "other", 40).toLowerCase(),
    price: priceString(price),
    regular_price: "",
    sale_price: /^(sale|clearance|member|loyalty|coupon|multi)/i.test(cleanText(input.price_type || "", 40)),
    coupon_required: false,
    deal_limit: "",
    size_text: sizeText || size.size_text,
    quantity: Number(input.quantity) > 0 ? Number(input.quantity) : 1,
    unit: cleanText(input.unit || size.package_unit || "each", 30).toLowerCase(),
    member_card_price: "",
    multibuy_details: cleanText(input.multibuy_details || "", 120),
    multibuy_quantity: Number(input.multibuy_quantity) > 0 ? Number(input.multibuy_quantity) : null,
    multibuy_total_price: moneyValue(input.multibuy_total_price),
    storage_condition: cleanText(input.storage_condition || input.storage || "Unknown", 40),
    price_type: cleanText(input.price_type || "Regular", 40),
    promotion_text: "",
    proof_type: defaults.proof_type || "receipt_photo",
    observed_at: cleanText(input.source_date || input.purchased_date || defaults.observed_at || "", 40),
    source_date: cleanText(input.source_date || input.purchased_date || defaults.observed_at || "", 40),
    valid_start_at: defaults.valid_start_at || "",
    valid_end_at: defaults.valid_end_at || "",
    source_url: defaults.source_url || "",
    source_title: defaults.source_title || "",
    source_checked_at: defaults.source_checked_at || defaults.observed_at || "",
    raw_receipt_line: cleanText(input.raw || `${itemName} | ${sizeText} | ${priceString(price)}`, 500),
    extracted_item_name: itemName,
    extracted_price: priceString(price),
    extracted_quantity: "",
    extracted_weight: "",
    extracted_unit: cleanText(input.unit || size.package_unit || "each", 30).toLowerCase(),
    extraction_confidence: "medium",
    extraction_notes: "Pasted AI result. Human review required before approval.",
    notes: "Created as a draft from pasted AI results. Human review required.",
    status: "ready_for_review"
  };
}

const NAVIGATION_GARBAGE = /^(?:back|forward|reload|home|menu|search|address bar|new tab|bookmarks?|history|downloads?|extensions?|settings|sign in|log in|privacy|terms|cookie|javascript|http\b|www\.|file\b|view source)/i;

function csvParts(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function headerKey(value) {
  return cleanText(value, 40).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function structuredObject(parts, headers, defaults, line) {
  const object = { raw: line };
  headers.forEach((header, index) => { object[header] = parts[index] || ""; });
  object.item_name = object.item_name || object.item || object.product || object.name;
  object.size_text = object.size_text || object.size || object.package_size;
  object.quantity = object.quantity || object.qty;
  object.storage_condition = object.storage_condition || object.storage;
  object.source_date = object.source_date || object.date || defaults.observed_at;
  return object;
}

function parseStructuredInput(sourceText, defaults = {}) {
  const text = String(sourceText || "").trim();
  if (!text) return null;
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const values = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [parsed];
      return values.map((value, index) => ({ row: structuredDraft(value, defaults), line: JSON.stringify(value), index: index + 1 }));
    } catch (error) {
      return [{ row: null, line: "JSON", index: 1, reason: "JSON is not valid" }];
    }
  }
  const lines = String(sourceText || "").replace(/\r\n?/g, "\n").split("\n").map((line) => cleanText(line, 1000)).filter(Boolean);
  if (!lines.some((line) => line.includes("|") || line.split(",").length >= 3)) return null;
  let headers = null;
  const enrichedDefaults = { ...defaults };
  return lines.map((line, index) => {
    const storeMatch = line.match(/^STORE\s*:\s*(.+)$/i);
    const dateMatch = line.match(/^DATE\s*:\s*(\d{4}-\d{2}-\d{2})/i);
    if (storeMatch) {
      enrichedDefaults.store_name = cleanText(storeMatch[1], 120);
      return { row: null, line, index: index + 1, reason: "store heading", informational: true };
    }
    if (dateMatch) {
      enrichedDefaults.observed_at = dateMatch[1];
      return { row: null, line, index: index + 1, reason: "purchase date heading", informational: true };
    }
    const delimiter = line.includes("|") ? "|" : ",";
    const parts = delimiter === "|" ? line.split("|").map((part) => part.trim()) : csvParts(line);
    const isHeader = /^(item|item name|product|name)$/i.test(parts[0] || "") && parts.some((part) => /price/i.test(part));
    if (isHeader) headers = parts.map(headerKey);
    let input;
    if (headers) {
      input = structuredObject(parts, headers, enrichedDefaults, line);
    } else if (parts.length >= 8) {
      input = structuredObject(parts, ["item_name", "store_name", "size_text", "quantity", "price", "category", "storage_condition", "price_type"], enrichedDefaults, line);
    } else {
      input = structuredObject(parts, ["item_name", "size_text", "price", "brand"], enrichedDefaults, line);
    }
    const looksLikeGarbage = NAVIGATION_GARBAGE.test(input.item_name || "") || /(?:browser|navigation|toolbar|omnibox)/i.test(line);
    return {
      row: isHeader || looksLikeGarbage ? null : structuredDraft(input, enrichedDefaults),
      line,
      index: index + 1,
      reason: isHeader ? "header row" : looksLikeGarbage ? "browser or navigation text is not a grocery item" : "expected a grocery item and a positive price",
      informational: isHeader
    };
  });
}

function parsePriceText(sourceText, defaults = {}) {
  const structured = parseStructuredInput(sourceText, defaults);
  const lines = structured || splitIntakeLines(sourceText).map((line, index) => ({ line, index: index + 1 }));
  const rows = [];
  const skipped_lines = [];
  const seen = new Set();

  for (const entry of lines) {
    const line = typeof entry === "string" ? entry : entry.line;
    const row = structured ? entry.row : createDraftFromLine(line, defaults);

    if (!row) {
      if (entry.informational) continue;
      skipped_lines.push({
        line,
        row: entry.index || null,
        reason: entry.reason || (/\b(?:tax|subtotal|total|balance|cash|change|payment|visa|mastercard|barcode|receipt)\b/i.test(line)
          ? "receipt total, payment, or footer line"
          : "no supported price pattern detected")
      });
      continue;
    }

    const key = [
      compactSearchText(row.item_name),
      row.price,
      compactSearchText(row.size_text),
      compactSearchText(row.multibuy_details),
      compactSearchText(row.promotion_text)
    ].join("|");

    if (seen.has(key)) {
      skipped_lines.push({ line, reason: "duplicate line in pasted source text" });
      continue;
    }

    seen.add(key);
    rows.push(row);
  }

  return {
    ok: rows.length > 0,
    rows,
    skipped_lines,
    ignored_line_count: skipped_lines.length,
    error: rows.length ? "" : "No supported price rows were detected. Paste visible price text or add rows manually."
  };
}

module.exports = {
  compactSearchText,
  parsePriceText,
  createDraftFromLine
};
