"use strict";

const { classifyMeat } = require("./meatClassification");

function facetLabel(value) {
  if (typeof value !== "string") return "";
  const label = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (label.length > 56 || !/^[\p{L}\p{N}][\p{L}\p{N} &'’%.-]*$/u.test(label)
      || /^(?:all|other|unknown|uncategorized|products)$/i.test(label)) return "";
  if (/^rib[ -]?eye$/i.test(label)) return "Ribeye";
  return label.toLowerCase().replace(/(^|[ -])\p{L}/gu, (part) => part.toUpperCase());
}

function cleanCatalogFacets(input, department) {
  if (!department || department === "other") return null;
  const animal = department === "meat" ? facetLabel(input?.animal) : "";
  const type = facetLabel(input?.type);
  const cut = facetLabel(input?.cut);
  return animal || type || cut ? { animal, type, cut } : null;
}

function suggestCatalogFacets(fields, department) {
  if (department === "meat") return classifyMeat(fields.name);
  const path = String(fields.subcategory || fields.product_type || fields.category || "").split(/\s*[>›|]\s*/);
  const labels = path.map(facetLabel).filter((label) => label && label.toLowerCase() !== department && label.toLowerCase() !== String(fields.department || "").toLowerCase());
  return cleanCatalogFacets({ type: labels[0], cut: labels[1] }, department);
}

module.exports = { cleanCatalogFacets, suggestCatalogFacets };
