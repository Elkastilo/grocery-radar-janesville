const SUPPORTED_UNITS = [
  "each",
  "count",
  "ct",
  "oz",
  "lb",
  "fl oz",
  "gallon",
  "pack",
  "roll",
  "bottle",
  "can",
  "bag"
];

const UNIT_LABELS = {
  each: "each",
  count: "each",
  ct: "each",
  oz: "oz",
  lb: "lb",
  "fl oz": "fl oz",
  gallon: "gallon",
  pack: "pack item",
  roll: "roll",
  bottle: "bottle",
  can: "can",
  bag: "bag"
};

function normalizeUnit(value) {
  const unit = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (unit === "fluid ounce" || unit === "fluid ounces" || unit === "floz") {
    return "fl oz";
  }

  if (unit === "pound" || unit === "pounds" || unit === "lbs") {
    return "lb";
  }

  if (unit === "ounces") {
    return "oz";
  }

  return unit;
}

function roundToFourCents(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function calculateUnitPrice(price, quantity, unit) {
  const numericPrice = Number(price);
  const numericQuantity = Number(quantity);
  const normalizedUnit = normalizeUnit(unit);

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    throw new Error("Price must be greater than $0.00.");
  }

  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  if (!SUPPORTED_UNITS.includes(normalizedUnit)) {
    throw new Error("Unsupported unit.");
  }

  const unitPrice = roundToFourCents(numericPrice / numericQuantity);
  const label = UNIT_LABELS[normalizedUnit];

  return {
    unitPrice,
    unit: normalizedUnit,
    label,
    formatted: `$${unitPrice.toFixed(2)}/${label}`
  };
}

function formatUnitPrice(unitPrice, unit) {
  const normalizedUnit = normalizeUnit(unit);
  const label = UNIT_LABELS[normalizedUnit] || normalizedUnit || "unit";
  const numericUnitPrice = Number(unitPrice);

  if (!Number.isFinite(numericUnitPrice)) {
    return "";
  }

  return `$${numericUnitPrice.toFixed(2)}/${label}`;
}

module.exports = {
  SUPPORTED_UNITS,
  UNIT_LABELS,
  normalizeUnit,
  calculateUnitPrice,
  formatUnitPrice
};
