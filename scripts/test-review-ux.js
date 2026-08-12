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

assert.match(source, /const scrollTop = window\.scrollY;/);
assert.match(source, /window\.scrollTo\(\{ top: scrollTop, behavior: "auto" \}\);/);
assert.match(source, /completed_rows/);
assert.match(source, /data-proof-reject-form/);
assert.match(source, /data-add-review-photo/);

console.log("Review workspace UX regression tests passed.");
