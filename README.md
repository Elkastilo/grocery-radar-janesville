# Grocery Radar Janesville

Grocery Radar Janesville is a local crowdsourced grocery price app for Janesville, Wisconsin. It starts empty and only shows grocery price reports after admin approval.

The production public app is the React/Vite/Tailwind build served by Express from `public-tailwind-dist`. The existing Express app remains the backend API, SQLite database, auth/session layer, uploads system, email system, rewards system, and private admin portal.

The app uses the phrase "cheapest reported price" because a report is not a guarantee that a store still has that item at that price.

## No Fake Product Data

This project intentionally has no fake grocery prices, no fake products, no fake users, no mock fallback results, no scraping, and no store APIs. The only seeded data is the real Janesville store list in `src/db.js`.

Users create all item, brand, price, proof, verification, and points data by submitting or verifying reports.

## Tech Stack

- Node.js
- Express
- SQLite
- React
- Vite
- Tailwind CSS
- HTML/CSS/plain JavaScript for the private admin portal and static legal pages
- bcrypt password hashing
- express-session login sessions
- nodemailer SMTP email
- multer local image uploads

No Next.js, Google login, Stripe, live scraper, or store price API is used.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

Then open the public Tailwind app:

```text
http://localhost:3000
```

Admin review is at:

```text
http://localhost:3000/admin.html
```

## Environment

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Example local values:

```text
PORT=3000
HOST=0.0.0.0
ADMIN_PIN=
SESSION_SECRET=change_this_to_a_long_random_secret
APP_BASE_URL=http://localhost:3000
```

Change `SESSION_SECRET` before any real deployment.

Optional proof analysis runs only on the server. Configure `AI_API_KEY` (or `OPENAI_API_KEY`), `AI_API_URL`, `AI_PROVIDER`, and `AI_MODEL`, then let the Owner enable processing and usage limits in Admin → Advanced. Without credentials—or while manual-only mode is enabled—workers can still paste structured results or enter drafts manually.

Do not use a default `ADMIN_PIN` in production. The PIN fallback is read-only for dangerous admin actions; logged-in admin accounts are required for approvals, role changes, and other mutations.

`HOST=0.0.0.0` makes local phone testing easier on the same Wi-Fi. The server still logs the normal localhost URL.

## Brevo Email Setup

Run the local setup helper to configure Brevo SMTP:

```bash
npm run setup:email
```

The script prompts for your Brevo SMTP password/key in Terminal. When the terminal supports it, the password input is hidden. The script updates only your local `.env` file and preserves existing values like `PORT`, `ADMIN_PIN`, and `SESSION_SECRET`.

The script can set local SMTP values such as:

```text
EMAIL_HOST=<smtp host>
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=<smtp username>
EMAIL_FROM="Grocery Radar Janesville <no-reply@example.com>"
ADMIN_NOTIFY_EMAIL=<admin email>
APP_BASE_URL=http://localhost:3000
```

It also saves the SMTP password/key from what you type locally, but it does not print the password after saving. Do not commit or share `.env`.

After setup, restart the app:

```bash
npm run dev
```

Then open Admin > Email Setup and send a test email.

## Registration

Users register with:

- username
- email
- password
- password confirmation

The server validates required fields, checks that username and email are unique, hashes the password with bcrypt, creates an email verification token, saves the user, sends the welcome verification email, sends an admin notification email if configured, and logs the user in automatically.

Plain text passwords are never stored.

## Login And Logout

Users log in with email and password. The server compares the password with the saved bcrypt hash and creates an `express-session` session.

Users log out with the Logout button, which destroys the session.

## Email Verification

Registration creates a verification link like:

```text
http://localhost:3000/api/auth/verify-email?token=TOKEN_HERE
```

When a valid unexpired token is opened, the app marks `is_email_verified = 1` and clears the token fields.

Users can earn normal points before email verification, but they are not eligible for future grocery gift card rewards until their email is verified.

## SMTP Email

Run the setup helper to configure Brevo SMTP in `.env`:

```bash
npm run setup:email
```

If email settings are missing, registration still works in development. The server logs:

```text
Email not configured. Verification email not sent.
```

If email sending fails, registration still succeeds and the server logs the email error.

Admins can also check email setup from the app:

- `GET /api/admin/email/status?pin=ADMIN_PIN` returns safe configuration status without the SMTP password/key.
- `POST /api/admin/email/test` sends a test email when SMTP is configured.
- Logged-in users can request another verification email from the Account section.

## Admin Registration Notifications

To receive a new-user registration email, set:

```text
ADMIN_NOTIFY_EMAIL=you@example.com
```

The admin notification includes username, email, user id, registration date/time, email verification status, and reward eligibility. It does not include the user's password, password hash, session cookies, or private server details.

If `ADMIN_NOTIFY_EMAIL` is missing, registration still works and the server logs:

```text
Admin notification email not configured.
```

## Public Submission Flow

The Tailwind public app uses a proof-first flow:

1. Register or log in.
2. Open Submit Proof.
3. Choose receipt, shelf tag, weekly ad, screenshot, or source link.
4. Upload proof or paste a source link.
5. Optionally add store, item, price, and notes as hints.
6. Submit for review.

Proof-only submissions stay private until admin review. Admins can turn proof into draft price rows, approve reviewed prices, and only then do prices appear publicly.

## Legacy Direct Price Reports

1. Register or log in.
2. Submit to the compatibility `/api/reports` endpoint.
3. Provide the real item name, store, category, price, package size, quantity, unit, proof type, and optional notes.
4. Add proof photo upload when using shelf tag, receipt, or weekly ad proof.
5. Save the report.

The backend still supports the direct `/api/reports` price-report endpoint for compatibility. The server uses the logged-in user id, calculates unit price, sets an initial confidence level, saves the report to SQLite with `pending` status, and awards points. New reports do not appear publicly until admin approval.

After submission, users see:

```text
Submitted for admin review. It will appear publicly after approval.
```

## Photo Proof Uploads

Users can upload proof photos when submitting a price report.

Supported proof types:

- Shelf tag photo
- Receipt photo
- Weekly ad photo or screenshot
- No photo

Shelf tag, receipt, and weekly ad proof types require an uploaded image. If the user does not have a photo, they should choose `No photo`.

Allowed upload types:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Maximum upload size:

```text
5 MB
```

Uploaded images are stored locally in:

```text
uploads/
```

After a report is approved, proof images are served publicly from URLs like:

```text
/uploads/generated-file-name.jpg
```

Pending, rejected, disputed, deleted, and expired report images are not available through the public upload route. Admins review pending images through:

```text
/api/admin/uploads/generated-file-name.jpg?pin=ADMIN_PIN
```

The app generates unique filenames and stores the original filename, MIME type, and file size in SQLite. It does not trust the user-provided filename, and it rejects non-image uploads such as PDF, EXE, ZIP, HTML, or JavaScript files.

Local uploads are fine for development and testing. For real hosting, move uploaded proof images to durable cloud object storage and add backup, retention, and privacy rules.

## Cart Power Upgrade

Logged-in users can build and edit a grocery cart. Cart items support:

- item name
- optional linked product
- preferred brand
- brand choice: any brand, preferred brand, or exact brand
- category
- quantity needed
- size preference
- must-have or optional labels
- avoid ingredients
- notes

Users can add items manually, add a product from a product page, add an approved report to the cart, edit items, duplicate items, remove items, clear the cart, and save cart changes.

Cart comparison uses approved reports only and includes:

- Cheapest split cart
- Best one-store trip
- Best balance
- High-confidence only
- Avoid-list careful mode

Every comparison includes plain-English “Why this result?” wording and this reminder:

```text
Based on recent approved user reports. Prices may change. Always check the store.
```

Missing cart prices show:

```text
No approved price yet. Submit one if you see it.
```

Ingredient and allergy reminders remain helpers only. The app does not claim that any food is safe for an allergy.

## Privacy-Safe Analytics

The app records aggregate analytics events such as searches, product views, cart adds, cart compares, missing price demand, and sponsor interactions.

Analytics are for admin insight only. Admin analytics are aggregate counts and top lists. The app does not expose raw user-level analytics to sponsors, and analytics views do not show user emails by default.

Tracked events include:

- search performed
- product viewed
- report viewed
- added to cart
- cart item added manually
- cart item removed
- cart compared
- cart mode selected
- missing price seen
- store request created
- suggestion created
- sponsor viewed/clicked/interested/not interested

Missing price demand helps admin see what people need prices for, without adding fake prices.

## Local Sponsors

Admins can create local sponsor cards for businesses, events, community notices, or deals. Sponsor cards are clearly labeled `Sponsored` and `Local sponsor`.

The app does not add payment processing yet. Sponsor cards are managed by admin only and can be draft, active, paused, or expired.

Sponsor stats are anonymous aggregate counts:

- views
- clicks
- interested taps
- not interested taps

Do not provide personal user data to sponsors. Do not use allergy avoid lists or individual health preferences for sponsor targeting.

## Points

- Submit typed price: 1 point
- Submit price with shelf tag photo proof: 5 points
- Submit receipt proof: 8 points
- Submit weekly ad deal: 3 points
- Verify another price: 2 points
- Your submitted price gets verified: +5 bonus points
- Your submitted price becomes high confidence: +10 bonus points
- Wrong/fake report after admin rejection: -10 points

Rewards are informational only:

- 100 points = weekly $5 gift card raffle entry
- 500 points = future guaranteed reward tier
- 1500 points = future higher reward tier

No gift cards, raffle entries, payments, or reward fulfillment are processed by this app yet.

## Verification

Logged-in users can verify another user's approved report with:

- Yes, I saw this price too
- Price is different
- Item unavailable
- Wrong item/store
- Expired sale

Duplicate verification by the same user on the same report is blocked. Users cannot verify their own reports.

## Confidence And Expiration

Initial confidence:

- No photo: low
- Shelf tag photo: medium
- Receipt photo: medium-high
- Weekly ad: medium

Report updates:

- 2 or more user confirmations: high
- 2 or more disputes: disputed
- Expired report: expired

Expiration defaults:

- Produce: 2 days
- Meat: 2 days
- Dairy: 5 days
- Sale price: 3 days unless the user enters a date
- Pantry and household items: 14 days
- Other categories: 14 days

## Admin Review

Open `/admin.html`, enter `ADMIN_PIN`, and load review data.

Admins can:

- View all submissions, including pending reports
- View uploaded proof thumbnails and full-size proof images through the protected admin upload route
- Approve reports
- Reject reports
- Mark reports disputed
- Delete bad submissions
- See disputed or suspicious reports
- View the notification center with pending reviews, new users today, reports submitted today, reports rejected today, reports needing proof, flagged/disputed reports, and banned/suspended user counts
- View users with email verification status, account status, report counts, verification counts, rejected report counts, points, and accuracy
- View recent registered users
- Open the Beta Readiness tab for launch checks, legal/safety page checks, phone testing help, and no-fake-data count warnings
- Open the Analytics tab for aggregate searches, product views, cart adds, cart compares, missing-price demand, top categories, and avoid ingredient counts
- Manage local sponsor cards and view anonymous aggregate sponsor stats
- Mark a user email verified or unverified
- Mark a user as admin or remove admin access
- Reset user points for abuse
- Reset a user's password with an entered temporary password or a generated one-time temporary password

Rejected reports apply the wrong/fake report penalty once.

Admins cannot view existing passwords. Passwords are stored only as bcrypt hashes, and `password_hash` is not returned by the admin user API.

The Beta Readiness tab shows safe checklist status only. It does not display `EMAIL_PASS`, password hashes, session cookies, or the actual admin PIN. For phone testing, use:

```text
ipconfig getifaddr en0
http://YOUR-MAC-IP:3000
http://YOUR-MAC-IP:3000/admin.html?pin=YOUR_ADMIN_PIN
```

When a new report is submitted, the app tries to email `ADMIN_NOTIFY_EMAIL` with the report details and admin review link. If admin review email is not configured, submission still succeeds and the server logs:

```text
Admin review notification email not configured.
```

## Change Password

Logged-in users can change their password from the Account section by entering their current password, a new password, and a confirmation. The server verifies the current password and stores only a new bcrypt hash.

## Future Ideas

- Google login
- Better duplicate detection
- Moderation notes and audit history
- Store-location-specific variants for chains with multiple Janesville locations
- Photo review workflows
- Optional barcode support
- Reward fulfillment only after legal, fraud, and funding review
- Privacy policy and terms
- Rate limits and stronger anti-spam protections
- Offline-friendly mobile improvements

## Local Data

SQLite data is stored at:

```text
data/grocery_radar.sqlite
```

The database starts with stores only. It does not include fake reports, products, prices, users, verifications, or point events.
