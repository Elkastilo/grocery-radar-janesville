"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "admin.js"), "utf8");

function functionBody(name, nextName) {
  const start = source.indexOf(`async function ${name}(`);
  const asyncEnd = source.indexOf(`async function ${nextName}(`, start + 1);
  const syncEnd = source.indexOf(`function ${nextName}(`, start + 1);
  const end = asyncEnd >= 0 && syncEnd >= 0 ? Math.min(asyncEnd, syncEnd) : Math.max(asyncEnd, syncEnd);
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

const refreshBody = functionBody("refreshResolvedReviewRows", "bindReviewImageActions");
assert.match(refreshBody, /cards\[0\]\.before\(status\)[\s\S]*status\.focus\([\s\S]*cards\[0\]\.remove\(\)/, "Focus must transfer before the acted-on card is removed.");
assert.match(refreshBody, /review-action-status/);
assert.match(refreshBody, /status\.focus\(\{ preventScroll: true \}\)/, "Focus must move without scrolling.");
assert.doesNotMatch(refreshBody, /renderReceiptReview\s*\(/, "A row mutation must not rebuild the proof workspace.");
assert.doesNotMatch(refreshBody, /scrollIntoView|scrollTop\s*=|window\.scrollTo|requestAnimationFrame/, "A row mutation must not run a second scroll-restoration lifecycle.");
assert.doesNotMatch(source, /captureReviewViewport/, "The failed whole-viewport restoration layer must stay removed.");
assert.doesNotMatch(source, /querySelector\("\[data-review-row\] button:not\(\[disabled\]\)/, "Resolved actions must not focus the first row at the top of the proof.");

assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /type="button" data-approve-row=/);
assert.match(source, /type="button" data-open-reject=/);
assert.match(source, /type="button" data-approve-ready/);
assert.match(source, /completed_rows/);
assert.match(source, /data-proof-reject-form/);
assert.match(source, /data-add-review-photo/);
assert.match(source, /data-review-completion/);
assert.match(source, /Finish &amp; Review Next/);

const nextBody = functionBody("startReviewNext", "openReceiptReview");
assert.match(nextBody, /await refreshReviewInbox\(\)/, "Review Next must select from a fresh Inbox.");
assert.match(nextBody, /excludeBatchId/, "Review Next must exclude the proof that just closed.");

const saveNextBody = functionBody("saveAndReviewNext", "finishAndReviewNext");
assert.match(saveNextBody, /activeReviewState\?\.can_finish/);
assert.match(saveNextBody, /finishAndReviewNext\(batchId\)/);
assert.match(saveNextBody, /startReviewNext\(\{ excludeBatchId: batchId \}\)/);

const finishBody = functionBody("finishAndReviewNext", "renderWorkers");
assert.match(finishBody, /\/complete/);
assert.match(finishBody, /startReviewNext\(\{ excludeBatchId: batchId \}\)/);

const rejectBody = functionBody("rejectReceipt", "approveReviewRows");
assert.match(rejectBody, /\/reject/);
assert.match(rejectBody, /startReviewNext\(\{ excludeBatchId: batchId \}\)/);
assert.doesNotMatch(rejectBody, /loadAdminData\s*\(/, "Proof rejection must not refresh stale global state before choosing the next proof.");

const storeResolutionBody = functionBody("resolveReviewStore", "refreshResolvedReviewRows");
assert.match(storeResolutionBody, /storeSelect\?\.value/);
assert.match(storeResolutionBody, /store_id: storeId/);
assert.doesNotMatch(storeResolutionBody, /openReceiptReview\s*\(/, "Store resolution must not reopen and rebuild the workspace.");
assert.match(storeResolutionBody, /Resolved store: \$\{savedStore\.name\} ✓/);
assert.match(storeResolutionBody, /Could not save store\. Please try again\./);

console.log("Review workspace UX regression tests passed.");
