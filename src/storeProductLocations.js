const { run, get, all } = require("./db");

function cleanLocationText(value, maxLength = 160) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanStoreProductLocation(input = {}) {
  const rawVerifiedAt = cleanLocationText(input.verified_at || new Date().toISOString(), 40);
  return {
    department: cleanLocationText(input.department, 80),
    aisle: cleanLocationText(input.aisle, 40),
    shelf: cleanLocationText(input.shelf, 40),
    bay: cleanLocationText(input.bay, 40),
    section: cleanLocationText(input.section, 80),
    location_note: cleanLocationText(input.location_note, 240),
    source_type: cleanLocationText(input.source_type || "staff", 60).toLowerCase(),
    source_reference: cleanLocationText(input.source_reference, 500),
    // Date-only values are anchored well inside the Janesville calendar day so
    // browser/UTC conversion cannot display the previous date.
    verified_at: /^\d{4}-\d{2}-\d{2}$/.test(rawVerifiedAt) ? `${rawVerifiedAt}T18:00:00.000Z` : rawVerifiedAt
  };
}

function hasStoreProductLocation(input = {}) {
  const location = cleanStoreProductLocation(input);
  return Boolean(location.department || location.aisle || location.shelf || location.bay || location.section || location.location_note);
}

function locationLabel(input = {}) {
  const location = cleanStoreProductLocation(input);
  const parts = [];
  if (location.department) parts.push(location.department);
  if (location.aisle) parts.push(/^aisle\b/i.test(location.aisle) ? location.aisle : `Aisle ${location.aisle}`);
  if (location.shelf) parts.push(/^shelf\b/i.test(location.shelf) ? location.shelf : `Shelf ${location.shelf}`);
  if (location.bay) parts.push(/^bay\b/i.test(location.bay) ? location.bay : `Bay ${location.bay}`);
  if (location.section) parts.push(location.section);
  if (location.location_note) parts.push(location.location_note);
  return [...new Set(parts)].join(" • ");
}

function publicStoreProductLocation(row) {
  if (!row || !hasStoreProductLocation(row)) return null;
  const cleaned = cleanStoreProductLocation(row);
  return {
    department: cleaned.department,
    aisle: cleaned.aisle,
    shelf: cleaned.shelf,
    bay: cleaned.bay,
    section: cleaned.section,
    location_note: cleaned.location_note,
    label: locationLabel(cleaned),
    verified_at: cleaned.verified_at
  };
}

async function currentStoreProductLocation(storeId, productId) {
  return get("SELECT * FROM store_product_locations WHERE store_id = ? AND product_id = ? AND is_current = 1 ORDER BY datetime(verified_at) DESC, id DESC LIMIT 1", [storeId, productId]);
}

async function currentLocationsForProducts(productIds = []) {
  const ids = [...new Set(productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!ids.length) return [];
  return all(`SELECT locations.*, stores.name AS store_name FROM store_product_locations locations JOIN stores ON stores.id = locations.store_id WHERE locations.is_current = 1 AND locations.product_id IN (${ids.map(() => "?").join(",")}) ORDER BY stores.name`, ids);
}

async function enrichRowsWithStoreProductLocations(rows = []) {
  const locations = await currentLocationsForProducts(rows.map((row) => row.product_id));
  const byPair = new Map(locations.map((row) => [`${row.store_id}:${row.product_id}`, row]));
  return rows.map((row) => ({ ...row, store_product_location: publicStoreProductLocation(byPair.get(`${row.store_id}:${row.product_id}`)) }));
}

function sameLocation(left, right) {
  const fields = ["department", "aisle", "shelf", "bay", "section", "location_note", "source_type", "source_reference", "verified_at"];
  return fields.every((field) => cleanStoreProductLocation(left)[field] === cleanStoreProductLocation(right)[field]);
}

async function saveStoreProductLocation({ storeId, productId, location, staffId = null, reason = "Store-product location verified", transaction = true }) {
  const store = await get("SELECT id FROM stores WHERE id = ?", [storeId]);
  const product = await get("SELECT id FROM products WHERE id = ?", [productId]);
  if (!store || !product) throw new Error("A valid store and product are required for a store location.");
  const cleaned = cleanStoreProductLocation(location);
  if (!hasStoreProductLocation(cleaned)) throw new Error("Enter at least one physical store-location field.");
  const current = await currentStoreProductLocation(storeId, productId);
  if (current && sameLocation(current, cleaned)) return { location: current, changed: false };
  const now = new Date().toISOString();
  if (transaction) await run("BEGIN IMMEDIATE");
  try {
    if (current) await run("UPDATE store_product_locations SET is_current = 0, superseded_at = ?, updated_at = ? WHERE id = ?", [now, now, current.id]);
    const result = await run(`INSERT INTO store_product_locations (store_id, product_id, department, aisle, shelf, bay, section, location_note, source_type, source_reference, verified_at, created_at, updated_at, updated_by_staff_id, is_current) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, [storeId, productId, cleaned.department, cleaned.aisle, cleaned.shelf, cleaned.bay, cleaned.section, cleaned.location_note, cleaned.source_type, cleaned.source_reference, cleaned.verified_at, now, now, staffId]);
    await run(`INSERT INTO store_product_location_events (location_id, store_id, product_id, event_type, previous_location_id, actor_staff_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [result.lastID, storeId, productId, current ? "LOCATION_UPDATED" : "LOCATION_CREATED", current?.id || null, staffId, cleanLocationText(reason, 500), JSON.stringify({ before: current ? publicStoreProductLocation(current) : null, after: publicStoreProductLocation(cleaned) }), now]);
    if (transaction) await run("COMMIT");
    return { location: await get("SELECT * FROM store_product_locations WHERE id = ?", [result.lastID]), changed: true, previous: current || null };
  } catch (error) {
    if (transaction) await run("ROLLBACK").catch(() => {});
    throw error;
  }
}

module.exports = {
  cleanStoreProductLocation,
  hasStoreProductLocation,
  locationLabel,
  publicStoreProductLocation,
  currentStoreProductLocation,
  currentLocationsForProducts,
  enrichRowsWithStoreProductLocations,
  saveStoreProductLocation
};
