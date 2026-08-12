"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "admin.js"), "utf8");

function functionBody(name, nextName) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf(`async function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} must be present before ${nextName}`);
  return source.slice(start, end);
}

for (const [name, next] of [
  ["approveReviewRow", "rejectReviewRow"],
  ["rejectReviewRow", "approveReadyRows"],
  ["approveReadyRows", "addManualReviewRow"]
]) {
  const body = functionBody(name, next);
  assert.doesNotMatch(body, /renderReceiptReview\s*\(/, `${name} must not rebuild the whole review workspace`);
  assert.match(body, /refreshResolvedReviewRows\s*\(/, `${name} must update resolved cards in place`);
}

assert.match(source, /document\.scrollingElement \|\| document\.documentElement/);
assert.match(source, /viewport\.scrollElement\.scrollTop = viewport\.scrollTop;/);
assert.match(source, /focus\(\{ preventScroll: true \}\)/);
assert.match(source, /event\.preventDefault\(\)/);
assert.doesNotMatch(source, /querySelector\("\[data-review-row\] button:not\(\[disabled\]\)/, "Resolved actions must not focus the first row at the top of the proof.");
assert.match(source, /completed_rows/);
assert.match(source, /data-proof-reject-form/);
assert.match(source, /data-add-review-photo/);

const captureStart = source.indexOf("function captureReviewViewport(");
const captureEnd = source.indexOf("async function refreshResolvedReviewRows(", captureStart);
assert.ok(captureStart >= 0 && captureEnd > captureStart);
const cards = Array.from({ length: 12 }, (_, index) => ({ dataset: { reviewRow: String(index + 1) } }));
const scrollingElement = { scrollTop: 840 };
const captureReviewViewport = Function("receiptReviewWorkspace", "document", `${source.slice(captureStart, captureEnd)}; return captureReviewViewport;`)({ querySelectorAll: () => cards }, { scrollingElement, documentElement: scrollingElement });
const lowerRowSnapshot = captureReviewViewport(["8"]);
assert.equal(lowerRowSnapshot.scrollTop, 840);
assert.equal(lowerRowSnapshot.focusRowId, "9", "Focus should move to the next nearby row, not the first row.");
const bulkSnapshot = captureReviewViewport(["8", "9", "10"]);
assert.equal(bulkSnapshot.scrollTop, 840);
assert.equal(bulkSnapshot.focusRowId, "11", "Bulk approval should retain a nearby focus target.");

const storeResolutionBody = functionBody("resolveReviewStore", "refreshResolvedReviewRows");
assert.match(storeResolutionBody, /storeSelect\?\.value/);
assert.match(storeResolutionBody, /store_id: storeId/);
assert.doesNotMatch(storeResolutionBody, /openReceiptReview\s*\(/, "Store resolution must not reopen and rebuild the workspace.");
assert.match(storeResolutionBody, /Could not save store\. Please try again\./);

console.log("Review workspace UX regression tests passed.");
