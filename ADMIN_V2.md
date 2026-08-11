# Grocery Radar Admin V2 Foundation

Admin V2 makes everyday work the default and keeps existing power tools available without placing them in the primary navigation.

## Everyday navigation

- Home: attention, today, live usage, team, and plain-language system status.
- Inbox: receipts, price reports, disputes, and worker escalations.
- Prices, Products, Stores: existing management functionality.
- Workers, Users, Feedback: manager and Owner people workflows.
- Reports and Announcements: management workflows.
- Operations, Email / Diagnostics, Settings: Owner-only advanced areas.

## Intentionally hidden legacy entry points

The following backend and UI panels remain in the repository but are no longer everyday sidebar destinations:

- Beta Readiness
- detailed analytics and search analytics
- sponsors
- feature voting and audit logs
- manual entry and the advanced Price Intake Center
- OCR extraction and raw importer controls
- background-job and low-level system diagnostics

They remain available through Operations or legacy deep links for the Owner where their existing authorization permits. OCR is not part of the normal receipt-review workflow.

## Roles

- Owner: existing unique, protected Owner identity; all access.
- Manager: everyday operations, workers, reviews, prices, products, stores, reports, users, and feedback.
- Reviewer: receipt review, draft correction, approval/rejection, and escalation.
- Data Entry: draft entry and correction; cannot approve public prices.
- User: public account only.

Legacy non-Owner admin accounts are interpreted as Managers so existing access is not silently removed. Assigning a new role is Owner-only and server-authorized.

## Review safety

Opening a receipt creates a time-limited claim. A second worker receives a conflict instead of silently processing the same receipt. Claims can be released, expire if abandoned, or be reassigned by a Manager. Review and escalation events are recorded.

Pasted pipe-delimited, CSV, or JSON results create editable draft rows only. Human approval remains required before a price becomes public.

## Privacy and engagement

Live usage uses an opaque visitor key, recent heartbeat time, broad role category, and aggregate daily counts. It does not store mouse movement, keystrokes, screenshots, or browsing histories. The active window is configured by `ACTIVE_USAGE_WINDOW_MINUTES` and defaults to 10 minutes.

User streaks count at most one qualifying visit per Janesville local calendar day. They reset without guilt or punishment messaging.

## Backups

Owner-created backups use SQLite's backup API and are written beneath `${DATA_DIR}/backups` with timestamped filenames. The live database is never overwritten. The UI labels these as same-disk safety copies, not disaster recovery.

