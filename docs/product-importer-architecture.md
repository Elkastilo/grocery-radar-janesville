# Product URL importer architecture

The importer resolves every HTTPS URL through `src/importers/registry.js`. The registry identifies the retailer, adapter, explicit page type, and tested capability level. Walmart uses its authoritative serialized-listing adapter; Festival Foods uses its scoped server-rendered `search_result` collection; other retailers use the conservative standards adapter only when a page exposes Schema.org Product/Offer/AggregateOffer/ItemList or supported OpenGraph product metadata.

Normalized rows keep shopper item price (`price`) separate from supplemental comparison price (`unit_price` / `comparison_price`). Missing, zero, negative, or non-finite prices remain null. Fields carry confidence and origin metadata; weaker enrichment cannot erase stronger listing data. Listings may discover a product without price, but approval readiness still requires a positive item price.

All remote HTML and image requests use the centralized SSRF-safe fetchers: HTTPS only, DNS validation and pinning, redirect revalidation, bounded bodies, timeouts, no credentials/cookies, and conservative rate limits. Adapters never execute retailer JavaScript. Images remain candidates until the existing sanitizer validates, decodes, bounds, and re-encodes them.

To add a retailer:

1. Capture a minimal sanitized fixture from a bounded public response.
2. Register its domains, URL classifier, and honest capability statuses.
3. Add a scoped adapter only for an authoritative collection; never recursively harvest arbitrary state.
4. Normalize into the common importer row fields with field origins/confidence.
5. Test product/listing classification, pagination preservation, missing price, malformed/blocked responses, and exclusion of recommendations.
6. Leave unsupported capabilities `PARTIAL`, `UNAVAILABLE`, or `UNTESTED` and preserve manual admin entry.

The admin analyze and approval endpoints remain authenticated and permission-gated. Extraction never publishes; the existing human review, duplicate resolution, store/location confirmation, idempotent approval, provenance, and image controls remain authoritative.
