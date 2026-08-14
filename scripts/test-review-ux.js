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
assert.doesNotMatch(refreshBody, /fetchJson\s*\(/, "A row mutation must use the mutation response instead of triggering a later workspace refresh.");
assert.doesNotMatch(refreshBody, /scrollIntoView|scrollTop\s*=|window\.scrollTo|requestAnimationFrame/, "A row mutation must not run a second scroll-restoration lifecycle.");
assert.doesNotMatch(source, /captureReviewViewport/, "The failed whole-viewport restoration layer must stay removed.");
assert.doesNotMatch(source, /querySelector\("\[data-review-row\] button:not\(\[disabled\]\)/, "Resolved actions must not focus the first row at the top of the proof.");

const removeBody = functionBody("removeReviewRow", "parseAiResults");
assert.match(removeBody, /refreshResolvedReviewRows\s*\(/, "Removing a row must apply the authoritative post-action lifecycle locally.");
assert.doesNotMatch(removeBody, /renderReceiptReview\s*\(/, "Removing a row must not rebuild the proof workspace.");

assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /type="button" data-approve-row=/);
assert.match(source, /type="button" data-open-reject=/);
assert.match(source, /type="button" data-approve-ready/);
for (const attribute of ["data-approve-row", "data-confirm-reject", "data-approve-ready", "data-store-resolution", "data-review-later", "data-finish-review", "data-finish-review-next", "data-reject-receipt"]) {
  assert.match(source, new RegExp(`type="button"[^>]*${attribute}|${attribute}[^>]*type="button"`), `${attribute} must never submit a surrounding form.`);
}
assert.match(source, /completed_rows/);
assert.match(source, /data-proof-reject-form/);
assert.match(source, /data-add-review-photo/);
assert.match(source, /data-review-completion/);
assert.match(source, /Finish &amp; Review Next/);
assert.match(source, /data-open-proof-review/, "Legacy importer proofs must route terminal work through the canonical Review Workspace.");
assert.doesNotMatch(source, /data-proof-action="(?:reviewed_no_prices|duplicate|reject)"/, "Legacy proof cards must not expose competing terminal transitions.");

const nextBody = functionBody("startReviewNext", "openReceiptReview");
assert.match(nextBody, /\/api\/admin\/v2\/reviews\/next/, "Review Next must use the canonical server selector.");
assert.match(nextBody, /exclude_proof_id/, "Review Next must send the excluded proof ID to the server.");
assert.doesNotMatch(nextBody, /adminV2InboxData\.items/, "Review Next must not scan stale client Inbox state.");

const reviewLaterBody = functionBody("reviewLater", "finishAndReviewNext");
assert.match(reviewLaterBody, /\/review-later/);
assert.match(reviewLaterBody, /startReviewNext\(\{ excludeProofId: batchId \}\)/);
assert.doesNotMatch(source, /Save &(?:amp;)? Review Next/, "The ambiguous generic action must be removed.");

const finishNextBody = functionBody("finishAndReviewNext", "finishReview");
assert.match(finishNextBody, /\/complete/);
assert.match(finishNextBody, /startReviewNext\(\{ excludeProofId: batchId \}\)/);

const finishStopBody = functionBody("finishReview", "renderWorkers");
assert.match(finishStopBody, /\/complete/);
assert.match(finishStopBody, /openAdminTab\("inboxTab"\)/);
assert.match(finishStopBody, /loadAdminData\(\)/);
assert.doesNotMatch(finishStopBody, /startReviewNext/, "Finish Review must stop at the Inbox instead of opening another proof.");

const rejectBody = functionBody("rejectReceipt", "approveReviewRows");
assert.match(rejectBody, /\/reject/);
assert.match(rejectBody, /startReviewNext\(\{ excludeProofId: batchId \}\)/);
assert.doesNotMatch(rejectBody, /loadAdminData\s*\(/, "Proof rejection must not refresh stale global state before choosing the next proof.");

const storeResolutionBody = functionBody("resolveReviewStore", "refreshResolvedReviewRows");
assert.match(storeResolutionBody, /storeSelect\?\.value/);
assert.match(storeResolutionBody, /store_id: storeId/);
assert.doesNotMatch(storeResolutionBody, /openReceiptReview\s*\(/, "Store resolution must not reopen and rebuild the workspace.");
assert.match(storeResolutionBody, /Resolved store: \$\{savedStore\.name\} ✓/);
assert.match(storeResolutionBody, /Could not save store\. Please try again\./);

console.log("Review workspace UX regression tests passed.");
