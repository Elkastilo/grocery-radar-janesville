"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const { productCardViewModel, productSize, reportSize } = await import("../client/src/productDisplay.js");
  const fixtures = [
    {
      name: "normal product",
      product: { id: 1, display_name: "Whole Milk", category: "dairy", default_size_text: "1 gal", approved_price_count: 1, has_current_price: true, best_price: 2.99, image_url: "/api/product-images/1/file" },
      report: { status: "approved", size_text: "1 gal", price: 2.99 }
    },
    { name: "null size", product: { id: 2, display_name: "Bananas", category: "produce", default_size_text: null, approved_price_count: 1, has_current_price: true, best_price: 0.49 }, report: { status: "approved", size_text: null, price: 0.49 } },
    { name: "null best report", product: { id: 3, display_name: "Avocados", category: "produce", default_size_text: null, approved_price_count: 1, has_current_price: false, best_price: null }, report: null },
    { name: "no approved price", product: { id: 4, display_name: "Cucumbers", category: "produce", approved_price_count: 0, has_current_price: false, best_price: null }, report: null },
    { name: "expired-only promotion", product: { id: 5, display_name: "Grilled Cheese", category: "prepared food", approved_price_count: 0, has_current_price: false, best_price: null, best_report_id: null }, report: null },
    { name: "missing image", product: { id: 6, display_name: "Bread", category: "bakery", image_url: null, approved_price_count: 0, has_current_price: false, best_price: null }, report: null },
    { name: "null optional metadata", product: { id: 7, display_name: "Rice", category: null, default_size_text: null, image_url: null, preferred_brand: null, approved_price_count: 0, has_current_price: false, best_price: null }, report: null }
  ];

  assert.equal(reportSize(null), "", "The exact production crash path must accept a null report.");
  assert.equal(productSize({ default_size_text: null }, null), "Size varies");
  for (const fixture of fixtures) {
    assert.doesNotThrow(() => productCardViewModel(fixture.product, fixture.report), fixture.name);
    const card = productCardViewModel(fixture.product, fixture.report);
    assert.equal(card.renderable, true, fixture.name);
    assert.notEqual(card.size, null, fixture.name);
  }

  assert.equal(productCardViewModel(fixtures[0].product, fixtures[0].report).size, "1 gal");
  assert.equal(productCardViewModel(fixtures[2].product, null).hasCurrentPrice, false);
  assert.equal(productCardViewModel(fixtures[4].product, null).hasCurrentPrice, false);
  assert.equal(productCardViewModel(fixtures[5].product, null).imageUrl, "");
  assert.equal(productCardViewModel(null, null).renderable, false, "A malformed product gets a per-card fallback instead of crashing the application.");

  const appSource = fs.readFileSync(path.join(__dirname, "..", "client", "src", "App.jsx"), "utf8");
  assert.match(appSource, /productCardViewModel\(product, bestReport\)/);
  assert.doesNotMatch(appSource, /const reportSize\s*=\s*\(report\)\s*=>\s*report\.size_text/);
  assert.match(appSource, /Submit proof to help fill this gap\./, "A no-price product must invite anonymous proof submission.");
  assert.doesNotMatch(appSource, /Submit proof after signing in|submit proof once you are signed in|sign up to submit|account required to submit/i, "Anonymous proof entry must not retain stale account-required copy.");
  assert.match(appSource, /openScreen\('submissions'\)[^>]+aria-label="Open My Submissions"/, "The old public Account icon must lead to privacy-first submission tracking.");
  assert.doesNotMatch(appSource, /aria-label="Open account"/, "The account-free public header must not advertise an Account control.");
  assert.match(appSource, /ActionButton label="Submit Proof"[^\n]+openScreen\('submit'\)/, "A no-price product must open anonymous Submit Proof directly.");
  assert.match(appSource, /function SubmitScreen\(\{ stores, selectedProduct, openScreen, setSelectedProofId \}\)/, "Submit Proof must not depend on shopper authentication state.");
  console.log("Public product null-safety tests passed.");
}

main().catch((error) => { console.error(error); process.exit(1); });
