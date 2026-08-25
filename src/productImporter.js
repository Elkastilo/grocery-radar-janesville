const CONFIDENCE = Object.freeze({ unknown: 0, low: 1, medium: 2, high: 3 });
const { RETAILERS, retailerDefinition } = require("./importers/registry");
const DOMAIN_RETAILERS = Object.freeze(RETAILERS.filter((entry) => entry.domains.length).map((entry) => ({ domains: entry.domains, names: [entry.label.toLowerCase(), entry.id] })));

function text(value, limit = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeRetailerText(value, limit = 500) {
  const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  const withoutMarkup = String(value ?? "")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/?(?:li|p|div|ul|ol|span)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  return text(withoutMarkup.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const number = lower[1] === "x" ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
    }
    return entities[lower] || "";
  }), limit);
}

function decodeHtml(value) {
  return normalizeRetailerText(value);
}

function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const cleaned = text(value, 80).replace(/,/g, "");
  if (!cleaned || /^\s*-\s*(?:\$|USD)?/i.test(cleaned)) return null;
  const match = cleaned.match(/(?:\$|USD\s*)?(-?\d+(?:\.\d{1,2})?)/i);
  const number = match ? Number(match[1]) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeUnit(value) {
  const key = text(value, 30).toLowerCase().replace(/[.\s_-]+/g, "");
  return ({ floz: "fl oz", fluidounce: "fl oz", fluidounces: "fl oz", oz: "oz", ounce: "oz", ounces: "oz", lb: "lb", lbs: "lb", pound: "lb", pounds: "lb", g: "g", gram: "g", grams: "g", kg: "kg", kilogram: "kg", kilograms: "kg", ml: "ml", milliliter: "ml", milliliters: "ml", l: "l", liter: "l", liters: "l", gal: "gallon", gallon: "gallon", gallons: "gallon", qt: "qt", quart: "qt", quarts: "qt", pt: "pt", pint: "pt", pints: "pt", ct: "count", count: "count", counts: "count", pk: "pack", pack: "pack", packs: "pack", bag: "bag", bags: "bag", tub: "tub", tubs: "tub", bottle: "bottle", bottles: "bottle", can: "can", cans: "can", box: "box", boxes: "box", each: "each", ea: "each" })[key] || "";
}

function packageTypeName(value) {
  const key = text(value, 30).toLowerCase().replace(/[^a-z]/g, "");
  return ({ containers: "container", container: "container", jars: "jar", jar: "jar", bags: "bag", bag: "bag", tubs: "tub", tub: "tub", bottles: "bottle", bottle: "bottle", cans: "can", can: "can", boxes: "box", box: "box", packs: "pack", pack: "pack" })[key] || "";
}

function normalizePackage(value) {
  const original = String(value ?? "");
  const raw = normalizeRetailerText(original, 120);
  const empty = { raw_text: null, quantity: null, item_size: null, unit: "", package_type: "", normalized_text: "" };
  if (!raw || raw.length > 80) return empty;
  if (/<\/?(?:li|ul|ol)\b/i.test(original) || /[•▪◦]/.test(original)) return empty;
  if ((raw.match(/[.!?](?:\s|$)/g) || []).length > 1) return empty;
  if (/\b(?:best when|enjoyed|refreshing|flavorful|healthy|sweet treat|perfect for|great for|addition to|recipes?|ingredients?|instructions?|made with)\b/i.test(raw)) return empty;
  if (/^(?:1\s+)?(?:each|ea)$/i.test(raw)) return { raw_text: "Each", quantity: 1, item_size: null, unit: "each", package_type: "", normalized_text: "Each" };
  const unitPattern = "fluid\\s+ounces?|fl\\s*\\.?\\s*oz|ounces?|oz|pounds?|lbs?|kilograms?|kg|milliliters?|ml|liters?|l|gallons?|gal|grams?|g|quarts?|qt|pints?|pt|count|ct|packs?|pk|bags?|tubs?|bottles?|cans?|box(?:es)?|each|ea";
  const typePattern = "containers?|jars?|bags?|tubs?|bottles?|cans?|box(?:es)?|packs?";
  let match = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:x|×)\\s*(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  if (match) {
    const unit = normalizeUnit(match[3]);
    const normalized = `${Number(match[1])} × ${Number(match[2])} ${unit}`;
    return { raw_text: normalized, quantity: Number(match[1]), item_size: Number(match[2]), unit, package_type: "", normalized_text: normalized };
  }
  match = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(pounds?|lbs?|fluid\\s+ounces?|fl\\s*\\.?\\s*oz|ounces?|oz|kilograms?|kg|milliliters?|ml|liters?|l|gallons?|gal|grams?|g|quarts?|qt|pints?|pt)\\s*(?:\\/\\s*)?(${typePattern})?`, "i"));
  if (match) {
    const amount = Number(match[1]);
    const unit = normalizeUnit(match[2]);
    const packageType = packageTypeName(match[3]);
    const normalized = `${amount} ${unit}${packageType ? ` ${titlePackageType(packageType)}` : ""}`;
    return { raw_text: normalized, quantity: 1, item_size: amount, unit, package_type: packageType, normalized_text: normalized };
  }
  match = raw.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})\\b`, "i"));
  if (!match) return empty;
  const amount = Number(match[1]);
  const unit = normalizeUnit(match[2]);
  if (["count", "pack", "bag", "tub", "bottle", "can", "box"].includes(unit)) {
    const packageType = unit === "count" ? "" : packageTypeName(unit);
    const normalized = unit === "count" ? `${amount} ct` : `${amount} ${amount === 1 ? unit : `${unit}s`}`;
    return { raw_text: normalized, quantity: amount, item_size: null, unit: unit === "count" ? "count" : "count", package_type: packageType, normalized_text: normalized };
  }
  if (unit === "each") return { raw_text: amount === 1 ? "Each" : `${amount} each`, quantity: amount, item_size: null, unit, package_type: "", normalized_text: amount === 1 ? "Each" : `${amount} each` };
  return { raw_text: `${amount} ${unit}`, quantity: 1, item_size: amount, unit, package_type: "", normalized_text: `${amount} ${unit}` };
}

function titlePackageType(value) { return value ? value[0].toUpperCase() + value.slice(1) : ""; }

function packageFromProductTitle(value) {
  const title = normalizeRetailerText(value, 240);
  if (!title) return normalizePackage(null);
  const each = title.match(/(?:^|[,;(]\s*)(?:1\s+)?each\s*\)?$/i);
  if (each) return normalizePackage("Each");
  const candidates = [...title.matchAll(/(\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:fl\s*\.?\s*oz|oz|lb|g|kg|ml|l)\b|\d+(?:\.\d+)?\s*(?:lbs?|pounds?|fl\s*\.?\s*oz|oz|ounces?|kg|g|ml|l|liters?|gal|gallons?|qt|pt|ct|count)\s*(?:\/\s*)?(?:containers?|jars?|bags?|tubs?|bottles?|cans?|box(?:es)?|packs?)?)/gi)];
  for (const candidate of candidates.reverse()) {
    const parsed = normalizePackage(candidate[1]);
    if (parsed.raw_text) return parsed;
  }
  return normalizePackage(null);
}

function typeNames(value) {
  const type = value?.["@type"];
  return (Array.isArray(type) ? type : [type]).filter(Boolean).map((entry) => String(entry).toLowerCase());
}

function walkJson(value, visit, depth = 0) {
  if (depth > 30 || value === null || typeof value !== "object") return;
  visit(value);
  if (Array.isArray(value)) value.forEach((item) => walkJson(item, visit, depth + 1));
  else Object.values(value).forEach((item) => walkJson(item, visit, depth + 1));
}

function imageUrl(value) {
  const image = Array.isArray(value) ? value[0] : value;
  return text(typeof image === "string" ? image : image?.url || image?.contentUrl, 1000);
}

function brandName(value) {
  return text(typeof value === "string" ? value : value?.name, 100);
}

function offerFrom(value) {
  const offers = Array.isArray(value) ? value : value ? [value] : [];
  const offer = offers.find((item) => item && typeof item === "object") || {};
  const price = parsePrice(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
  const regular = parsePrice(offer.regularPrice ?? offer.originalPrice ?? offer.priceSpecification?.referencePrice ?? offer.priceSpecification?.listPrice);
  return {
    price,
    regular_price: regular && price !== null && regular > price ? regular : null,
    currency: normalizeRetailerText(offer.priceCurrency || offer.priceSpecification?.priceCurrency, 10),
    availability: normalizeRetailerText(offer.availability, 200).split("/").pop(),
    url: text(offer.url, 1000)
  };
}

function productCandidate(product, method) {
  const offer = offerFrom(product.offers);
  const sizeRaw = normalizeRetailerText(product.size || product.weight, 120);
  const packageInfo = normalizePackage(sizeRaw);
  return {
    method,
    name: normalizeRetailerText(product.name, 200), brand: normalizeRetailerText(brandName(product.brand), 100), variant: normalizeRetailerText(product.variant || product.model, 100), description: normalizeRetailerText(product.description, 500),
    image_url: imageUrl(product.image), sku: normalizeRetailerText(product.sku || product.mpn, 100),
    gtin: normalizeRetailerText(product.gtin14 || product.gtin13 || product.gtin12 || product.gtin8 || product.gtin, 40),
    price: offer.price, regular_price: offer.regular_price, unit_price: parsePrice(product.unitPrice || product.offers?.unitPrice), currency: offer.currency,
    availability: offer.availability, product_url: offer.url || text(product.url, 1000),
    raw_price_text: offer.price === null ? "" : normalizeRetailerText(product.offers?.price ?? product.offers?.lowPrice ?? offer.price, 120),
    raw_size_text: packageInfo.raw_text, package: packageInfo,
    seller: normalizeRetailerText(product.offers?.seller?.name || product.manufacturer?.name, 120)
  };
}

function candidateScore(candidate) {
  return [candidate.name, candidate.price !== null, candidate.image_url, candidate.gtin, candidate.sku, candidate.raw_size_text].filter(Boolean).length;
}

function scriptBodies(html, predicate) {
  const output = [];
  const regex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = regex.exec(html))) if (predicate(match[1])) output.push(match[2].trim());
  return output;
}

function parseJsonScripts(html, predicate, warnings) {
  const values = [];
  for (const body of scriptBodies(html, predicate)) {
    if (!body) continue;
    try { values.push(JSON.parse(body)); } catch { warnings.push("One structured-data script was malformed and ignored."); }
  }
  return values;
}

function metaMap(html) {
  const map = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attrs = {};
    tag.replace(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, name, a, b, c) => { attrs[name.toLowerCase()] = decodeHtml(a ?? b ?? c); return ""; });
    const key = String(attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content && !map.has(key)) map.set(key, attrs.content);
  }
  return map;
}

function applyField(result, name, value, confidence, method) {
  const meaningful = value !== null && value !== undefined && value !== "";
  if (!meaningful || CONFIDENCE[confidence] <= CONFIDENCE[result.confidence[name] || "unknown"]) return;
  result.fields[name] = value;
  result.confidence[name] = confidence;
  result.field_methods[name] = method;
}

function detectRetailer(urlInput, structuredName, stores = []) {
  const hostname = new URL(urlInput).hostname.toLowerCase().replace(/^www\./, "");
  const definition = retailerDefinition(urlInput);
  const mapping = DOMAIN_RETAILERS.find((entry) => entry.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)));
  const names = [...(mapping?.names || []), text(structuredName, 120).toLowerCase()].filter(Boolean);
  const store = stores.find((candidate) => names.some((name) => {
    const storeName = text(candidate.name, 120).toLowerCase().replace(/[’]/g, "'");
    return storeName.includes(name) || name.includes(storeName);
  })) || null;
  return { hostname, recognized: Boolean(definition || store), retailer: definition?.id || "", retailer_name: store?.name || definition?.label || text(structuredName, 120), store_id: store?.id || null, adapter: definition?.adapter || "generic", capabilities: definition?.capabilities || null };
}

function locationAssessment(html, store) {
  const visible = text(html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ").replace(/<style[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]+>/g, " "), 20000).toLowerCase();
  const janesville = /\bjanesville\b/.test(visible);
  const wisconsin = /\bwisconsin\b|\bwi\b/.test(visible);
  if (janesville && wisconsin) return { confidence: "likely_janesville", evidence: "The product page mentions Janesville, Wisconsin, but an admin must confirm that the displayed price applies to that exact store." };
  if (janesville) return { confidence: "likely_janesville", evidence: "The product page mentions Janesville but does not establish that the displayed price applies to a specific store." };
  return { confidence: "unknown", evidence: store?.city?.toLowerCase() === "janesville" ? "A Janesville store was matched, but the fetched page did not establish that its price applies to that location." : "The fetched page did not establish that its price applies to a Janesville store." };
}

function extractProduct(htmlInput, sourceUrl, stores = []) {
  const html = String(htmlInput || "");
  const result = { source_url: sourceUrl, extracted_at: new Date().toISOString(), fields: {}, confidence: {}, field_methods: {}, methods_used: [], warnings: [] };
  const products = [];
  const jsonLd = parseJsonScripts(html, (attrs) => /type\s*=\s*["']application\/ld\+json["']/i.test(attrs), result.warnings);
  jsonLd.forEach((value) => walkJson(value, (node) => { if (typeNames(node).includes("product")) products.push(productCandidate(node, "json_ld")); }));
  if (products.length) result.methods_used.push("json_ld");

  if (!products.length) {
    const embedded = parseJsonScripts(html, (attrs) => /type\s*=\s*["']application\/json["']/i.test(attrs) || /id\s*=\s*["'](?:__NEXT_DATA__|__APOLLO_STATE__)["']/i.test(attrs), result.warnings);
    embedded.forEach((value) => walkJson(value, (node) => {
      if (node && !Array.isArray(node) && (node.name || node.productName || node.title) && (node.price !== undefined || node.offers || node.sku || node.gtin)) {
        products.push(productCandidate({ ...node, name: node.name || node.productName || node.title, offers: node.offers || { price: node.price, priceCurrency: node.currency }, image: node.image || node.imageUrl }, "embedded_json"));
      }
    }));
    if (products.length) result.methods_used.push("embedded_json");
  }

  const best = products.sort((a, b) => candidateScore(b) - candidateScore(a))[0];
  if (best) {
    const confidence = best.method === "json_ld" ? "high" : "medium";
    for (const name of ["name", "brand", "variant", "image_url", "sku", "gtin", "price", "regular_price", "unit_price", "currency", "availability", "raw_price_text", "raw_size_text"]) applyField(result, name, best[name], confidence, best.method);
    for (const name of ["quantity", "item_size", "unit", "package_type"]) applyField(result, name, best.package[name], best.package.raw_text ? "medium" : "unknown", "size_normalization");
  }

  const meta = metaMap(html);
  const metaFields = { name: meta.get("og:title"), image_url: meta.get("og:image"), price: parsePrice(meta.get("product:price:amount")), currency: meta.get("product:price:currency"), retailer: meta.get("og:site_name") };
  for (const [name, value] of Object.entries(metaFields)) applyField(result, name, value, "medium", "open_graph");
  if (Object.values(metaFields).some((value) => value !== null && value !== undefined && value !== "")) result.methods_used.push("open_graph");

  const visible = decodeHtml(html.replace(/<script[\s\S]*?<\/script\s*>/gi, " ").replace(/<style[\s\S]*?<\/style\s*>/gi, " ").replace(/<[^>]+>/g, " "));
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, " ");
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  applyField(result, "name", decodeHtml(h1 || title), "low", "html_heuristic");
  const priceText = visible.match(/\$\s*\d+(?:\.\d{1,2})?/)?.[0];
  applyField(result, "price", parsePrice(priceText), "low", "html_heuristic");
  applyField(result, "raw_price_text", priceText, "low", "html_heuristic");
  const packageMatch = visible.match(/\b\d+(?:\.\d+)?\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|kg|g|ml|l|gal|gallon|ct|count)\b|\b\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lb|kg|g|ml|l|gal|gallon|ct|count)\b/i)?.[0];
  if (packageMatch) {
    const normalized = normalizePackage(packageMatch);
    applyField(result, "raw_size_text", normalized.raw_text, "low", "html_heuristic");
    for (const name of ["quantity", "item_size", "unit", "package_type"]) applyField(result, name, normalized[name], "low", "html_heuristic");
  }
  if ((!best || !best.name) && (h1 || title || priceText || packageMatch)) result.methods_used.push("html_heuristic");

  const retailer = detectRetailer(sourceUrl, result.fields.retailer || best?.seller, stores);
  result.retailer = retailer;
  result.location = locationAssessment(html, stores.find((store) => String(store.id) === String(retailer.store_id)));
  if (!retailer.store_id) result.warnings.push(retailer.recognized ? "Retailer recognized, but no existing Grocery Radar store location was matched." : "Retailer not recognized. Select an existing store manually.");
  if (result.location.confidence !== "confirmed_janesville") result.warnings.push("This price may be location-dependent and is not confirmed for the Janesville store.");
  if (!result.fields.name) result.warnings.push("No reliable product name was found.");
  if (result.fields.price == null) result.warnings.push("No reliable current price was found.");
  result.methods_used = [...new Set(result.methods_used)];
  result.overall_confidence = result.confidence.name === "high" && result.confidence.price === "high" ? "high" : result.fields.name && result.fields.price != null ? "medium" : "low";
  return result;
}

function normalizeMatch(value) { return text(value, 300).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

function findDuplicateCandidates(imported, products = [], priorImports = [], storeId = null) {
  const gtin = text(imported.gtin, 40).replace(/\D/g, "");
  const sku = normalizeMatch(imported.sku);
  const name = normalizeMatch(imported.name);
  const brand = normalizeMatch(imported.brand);
  const size = normalizeMatch(imported.raw_size_text || imported.size_text);
  const matches = [];
  for (const product of products) {
    const productGtin = text(product.upc || product.gtin, 40).replace(/\D/g, "");
    if (gtin && productGtin === gtin) matches.push({ type: "gtin", confidence: "high", product_id: product.id, name: product.display_name || product.name });
    else if (name && normalizeMatch(product.display_name || product.name) === name && (!brand || normalizeMatch(product.brand_optional || product.brand) === brand) && (!size || normalizeMatch(product.default_size_text || product.size_text) === size)) matches.push({ type: "name_brand_size", confidence: "medium", product_id: product.id, name: product.display_name || product.name });
  }
  for (const prior of priorImports) if (sku && normalizeMatch(prior.sku) === sku && String(prior.store_id || "") === String(storeId || "")) matches.push({ type: "sku_retailer", confidence: "high", import_id: prior.id, product_id: prior.product_id || prior.approved_product_id || null, name: prior.item_name });
  return matches.slice(0, 10);
}

module.exports = { DOMAIN_RETAILERS, parsePrice, normalizeRetailerText, normalizePackage, packageFromProductTitle, detectRetailer, extractProduct, findDuplicateCandidates };
