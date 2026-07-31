"use strict";

const assert = require("node:assert/strict");
const { parsePriceText } = require("../src/priceIntake");

function rowFor(text) {
  const parsed = parsePriceText(text, {
    store_id: 1,
    proof_type: "weekly_ad",
    valid_end_at: "2026-08-01"
  });

  assert.equal(parsed.ok, true, text);
  assert.equal(parsed.rows.length, 1, text);
  return parsed.rows[0];
}

{
  const row = rowFor("$2.99 Milk 1 gal");
  assert.equal(row.item_name, "Milk");
  assert.equal(row.price, "2.99");
  assert.equal(row.size_text, "1 gallon");
  assert.equal(row.quantity, 1);
  assert.equal(row.unit, "each");
}

{
  const row = rowFor("Strawberries 16 oz 2/$5 with card limit 2");
  assert.equal(row.item_name, "Strawberries");
  assert.equal(row.price, "2.50");
  assert.equal(row.size_text, "16 oz");
  assert.equal(row.multibuy_details, "2 for $5.00");
  assert.equal(row.member_card_price, "2.50");
  assert.equal(row.deal_limit, "2");
}

{
  const row = rowFor("3 for $10 Cereal 12 oz digital coupon");
  assert.equal(row.item_name, "Cereal");
  assert.equal(row.price, "3.33");
  assert.equal(row.size_text, "12 oz");
  assert.equal(row.coupon_required, true);
  assert.equal(row.multibuy_details, "3 for $10.00");
}

{
  const row = rowFor("Buy 1 Get 1 Free Buns $3.49");
  assert.equal(row.item_name, "Buns");
  assert.equal(row.price, "3.49");
  assert.equal(row.multibuy_details, "Buy 1 Get 1 Free");
  assert.match(row.notes, /BOGO offer detected/);
}

{
  const row = rowFor("Chicken Breast $1.99/lb");
  assert.equal(row.item_name, "Chicken Breast");
  assert.equal(row.price, "1.99");
  assert.equal(row.quantity, 1);
  assert.equal(row.unit, "lb");
}

{
  const row = rowFor("4 @ $0.99 IB COCONUT WTR 16Z 3.96");
  assert.equal(row.item_name, "IB COCONUT WTR");
  assert.equal(row.price, "0.99");
  assert.equal(row.size_text, "16 oz");
  assert.equal(row.multibuy_details, "4 @ $0.99");
  assert.match(row.notes, /Line total \$3.96 for 4 items/);
}

{
  const parsed = parsePriceText("TAX 0.12\nTOTAL 14.00\nCASH 20.00");
  assert.equal(parsed.ok, false);
  assert.equal(parsed.rows.length, 0);
}

console.log("Price intake parser tests passed.");
