# Grocery Radar MVP Rules

Grocery Radar MVP rule:

> Users upload proof. Admin reviews and extracts useful prices. Only approved, privacy-safe prices appear publicly.

## Public Submission Rules

- Users submit proof, not perfect product data.
- The public submission flow is called **Submit Proof**.
- Item name, price, and source link are optional hints for users.
- Required user fields are store, proof type, and either a proof image or source link.
- OCR is an admin-helper only, not a public promise.
- If OCR fails, proof is still saved for manual review.
- Nothing appears publicly until admin approval.

## Privacy Rules

- Raw receipts are admin-only/private.
- Public users never see raw receipt images.
- Public price cards show item name, price, store, checked date, proof type, source link if available, and a trust label such as “verified by admin.”
- Public price cards must not show transaction IDs, payment method, card details, exact checkout time unless intentionally safe, cashier info, customer or loyalty identifiers, barcodes, receipt footers, or raw OCR text.
- Admin can still see full proof image, OCR helper text, uploaded source, and transaction details when needed for verification.
- Historical proof is kept for audit/admin review.

## Admin Review Rules

- Admin verifies, edits, approves, rejects, marks needs edit, or requests clearer proof/source links.
- Imported/draft/proof-only rows stay private until approved.
- Approved rows flow into normal approved price reports.
- Source links and proof type are trust signals.

## Rewards And Trust Rules

- Rewards are beta points only, not guaranteed money, cash, gift cards, raffle entries, or payouts.
- Proof accepted for review earns 1 point when eligible.
- Proof used to add at least one approved price earns 2 points when eligible.
- Source link included can earn 1 point.
- Clear accepted proof photo can earn 1 point.
- Duplicate confirmation from a different user can earn 1 point.
- Rejected proof, blurry/unclear proof, old proof outside the allowed window, and same-user duplicate proof earn 0 points.
- Maximum proof points from one proof upload: 5.
- Daily caps:
  - New Contributor: 10 points/day
  - Reliable Proof: 20 points/day
  - Trusted Contributor: 40 points/day
  - Priority Contributor: 75 points/day
  - Field Verified / Admin Verified: manual/admin controlled, up to 75 points/day
- Per-item automatic receipt and weekly-ad rewards are not part of the MVP.
- Reward useful proof, not every item admin extracts.

## Trust Levels

- Level 0: New Contributor. Default for new users, full review required, lowest caps.
- Level 1: Reliable Proof. Several accepted proofs with few rejected or duplicate proofs.
- Level 2: Trusted Contributor. Consistent useful proof and higher daily cap.
- Level 3: Priority Contributor. Strong history and higher admin queue priority.
- Level 4: Field Verified / Admin Verified. Admin personally verified user/source or checked store prices; manually controlled.

Trust is based on accepted proof count, approved-price-from-proof count, rejection count, duplicate count, unclear photo count, recent activity, and admin adjustments. Trust is internal/admin-side for the MVP.

## Freshness Rules

- Receipts are accepted for points only when the purchase date is within the last 7 days.
- Receipts with unknown purchase date need admin review and do not earn normal proof points until freshness is confirmed.
- Shelf tags are accepted for points for 7 days from submitted/checked date.
- Weekly ads are accepted until their valid-through or expiration date.
- Weekly ads with no known expiration need admin review.
- Source links are accepted while the linked deal appears active; admin decides when uncertain.
- Old proof may be stored as historical proof for audit, but raw proof remains private.

## Duplicate Rules

- Same user uploading the same receipt/source again earns 0 points.
- Same file hash or same source link is flagged for admin.
- Same receipt/store/date/total can be treated as a duplicate when detected.
- Similar uploads from different users may confirm accuracy but earn only the duplicate confirmation point.
- Duplicate proof can help validate prices but does not earn full proof points.
- Repeated duplicate behavior should lower review priority or trust.
- Legitimate same-day receipts from different stores should not be blocked.

## Store Scope

- Supported stores are Janesville grocery, household, pharmacy, discount, and convenience stores relevant to food, pantry, frozen, household, baby, and bathroom items.
- Target Janesville is supported for grocery and household-relevant items only.
- No fake store prices are seeded.
