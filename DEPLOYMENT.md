# Grocery Radar Janesville Deployment

This app is prepared for a Render-first launch at:

```text
https://thegroceryradar.com
```

## Architecture

Grocery Radar launches as one Express web service:

- Tailwind public app is served by Express at `/`.
- Backend admin stays at `/admin.html`.
- Backend APIs stay under `/api/*`.
- Health check is at `/health`.
- SQLite data lives on persistent storage.
- Login sessions are stored in SQLite on persistent storage.
- Uploaded proof and receipt files live on persistent storage.
- Raw receipts remain private and are not served publicly.

The Tailwind source lives inside this backend folder:

```text
client/
```

For production, the built Tailwind files are copied into:

```text
public-tailwind-dist
```

Express serves that folder as the public shopper app when `public-tailwind-dist/index.html` exists. In production, the server returns a deployment error instead of falling back to the old public HTML app if the Tailwind build is missing.

## Production Routes

| Route | Purpose |
| --- | --- |
| `/` | Tailwind public shopper app |
| `/admin.html` | Private backend admin |
| `/api/*` | Backend API routes |
| `/health` | Safe health check JSON |
| `/uploads/*` | Public upload route that still blocks receipt/private proof files |
| `/api/admin/uploads/*` | Admin-only upload access |

## Required Environment Variables

Set these in Render. Do not commit real secret values.

```text
NODE_ENV=production
PUBLIC_APP_URL=https://thegroceryradar.com
SESSION_SECRET=<long random secret>
DATA_DIR=/opt/render/project/src/storage
UPLOADS_DIR=/opt/render/project/src/storage/uploads
ADMIN_PIN=<limited read-only fallback or leave disabled later>
ADMIN_NOTIFY_EMAIL=<admin email>
SUPER_ADMIN_EMAIL=<authorized Super Admin email>
SMTP_HOST=<smtp host>
SMTP_PORT=587
SMTP_USER=<smtp username>
SMTP_PASS=<smtp password/key>
SMTP_FROM="Grocery Radar Janesville <no-reply@thegroceryradar.com>"
```

Existing `EMAIL_*` variables are still supported for local compatibility. Production can use the `SMTP_*` names above.

`SUPER_ADMIN_EMAIL` is the only bootstrap Super Admin identity. Legacy `OWNER_EMAIL` is still accepted by the server only when it matches the authorized Super Admin email exactly; `ADMIN_NOTIFY_EMAIL` never grants admin access.

`ADMIN_PIN` is now read-only for admin mutation routes. It should be treated as a temporary development fallback, not as the real production admin workflow. Sensitive admin POST/DELETE actions require a logged-in admin account.

In production the Express app trusts the Render proxy so secure session cookies work correctly behind HTTPS. Keep SESSION_SECRET stable in Render or all users will be logged out after deploys.

## Local Development

Run the backend/admin:

```bash
cd /Users/rick/Documents/Codex/2026-06-02/i-am-building-a-new-app/grocery-radar-janesville
npm install
HOST=127.0.0.1 PORT=3000 npm start
```

Run the Tailwind dev server:

```bash
cd /Users/rick/Documents/Codex/2026-06-27/create-a-separate-tailwind-prototype-for/grocery-radar-tailwind-prototype
npm install
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173
```

Backend/admin:

```text
http://127.0.0.1:3000/admin.html
```

## Production Build

From the backend folder:

```bash
npm run build:client
npm run build:all
```

The build script looks for the frontend in this order:

1. `CLIENT_DIR`
2. `TAILWIND_APP_DIR`
3. `./client`
4. `../client`
5. `../grocery-radar-tailwind-prototype`
6. existing `public-tailwind-dist`

Render uses `./client`, builds it, and copies the compiled files into `public-tailwind-dist`.

## Render Setup

Recommended Render Web Service settings:

```text
Service type: Web Service
Environment: Node
Build command: npm install && npm run build:all
Start command: npm start
Health check path: /health
Disk mount path: /opt/render/project/src/storage
Domain: thegroceryradar.com and www.thegroceryradar.com
```

This folder includes `render.yaml` with safe placeholders only. It defines:

- one Node web service
- `npm install && npm run build:all`
- `npm start`
- `/health`
- a persistent disk mounted at `/opt/render/project/src/storage`
- secret env vars as `sync: false`

Set real secret values in the Render dashboard.

## Persistent Storage

Render disk:

```text
mount path: /opt/render/project/src/storage
```

Set:

```text
DATA_DIR=/opt/render/project/src/storage
UPLOADS_DIR=/opt/render/project/src/storage/uploads
```

SQLite database path becomes:

```text
/opt/render/project/src/storage/grocery_radar.sqlite
```

Uploads path becomes:

```text
/opt/render/project/src/storage/uploads
```

Both folders are created automatically if missing.

## Database And Upload Backups

Before launch, copy the current SQLite database to the persistent disk or import it during setup.

Backup reminders:

- Back up `grocery_radar.sqlite` before every deployment that changes data behavior.
- Back up the uploads folder with receipts/proofs.
- Do not move production storage without copying both database and uploads together.
- Keep receipt uploads private.

Rollback reminder:

- Keep the previous SQLite file before deploying.
- Keep the previous `public-tailwind-dist` build.
- If a deployment fails, roll back the Render deploy and restore the previous database/upload backup if data changed.

## Cloudflare Domain Steps

The domain is already owned:

```text
thegroceryradar.com
```

Use this order:

1. Add `thegroceryradar.com` as a custom domain in Render.
2. Add `www.thegroceryradar.com` in Render too.
3. Let Render show the required DNS records.
4. In Cloudflare, add the root and `www` records exactly as Render instructs.
5. Records will likely be CNAME-style records or Render-provided targets.
6. Set `PUBLIC_APP_URL=https://thegroceryradar.com`.
7. Test both domains:

```text
https://thegroceryradar.com
https://www.thegroceryradar.com
```

Choose one canonical domain. Prefer:

```text
https://thegroceryradar.com
```

Redirect `www` to the root domain if Render/Cloudflare configuration allows it.

Do not manage Cloudflare secrets or DNS from app code.

## Security Checks

Before inviting testers, verify:

- `/api/browse` returns approved prices only.
- `/api/search` returns approved prices only for public UI.
- `/api/leaderboard` shows public usernames and points only.
- Proof-only submissions stay private.
- Raw receipt public URLs return `404`.
- Unauthenticated `/api/admin/uploads/*` returns `403`.
- PIN-only admin POST/DELETE routes return `403`.
- Logged-in admin approval/rejection workflows still work.
- Public payloads do not include emails, password hashes, raw receipt paths, OCR text, transaction IDs, payment info, loyalty data, private admin notes, `user_id`, `last_edited_by`, or internal housekeeping fields.
- `/admin.html` is not prominently linked from the public Tailwind app.

## Health Check

Expected:

```bash
curl https://thegroceryradar.com/health
```

Safe response shape:

```json
{
  "ok": true,
  "app": "Grocery Radar Janesville",
  "domain": "thegroceryradar.com",
  "environment": "production",
  "database_reachable": true,
  "timestamp": "..."
}
```

The health endpoint must not expose secrets, database paths, SMTP credentials, user data, admin data, or private file paths.

## Beta Readiness Note

Do not add fake prices.

Current active approved prices are below the real public usefulness target.

Targets:

- Minimum private beta: 10 active approved prices.
- Better 100-person beta: 25 to 50 active approved prices, refreshed daily.
- Strong public beta: 100 active approved prices.

Missing starter items:

- milk
- eggs
- bread
- bananas
- chicken
- current meat deal
- butter or cheese
- cereal
- coffee
- toilet paper or paper towels

Need store coverage beyond Woodman's:

- Aldi
- Walmart
- Kwik Trip
- Festival Foods
- Hy-Vee
- Target

## Soft Beta Checklist

Before sending the public link to a larger group:

1. Confirm `/health` is green on Render.
2. Confirm `/` opens the Tailwind app.
3. Confirm `/admin.html` opens admin only for authorized admin access.
4. Confirm `/api/browse` returns approved prices only.
5. Submit one real proof as a normal user.
6. Confirm the proof does not appear publicly.
7. Approve one real price as logged-in admin.
8. Confirm Tailwind home/search/product detail show the approved price.
9. Confirm notification and points behavior.
10. Confirm raw receipt URLs stay blocked.
11. Back up SQLite and uploads.

## Remaining Launch Work

- Put the frontend source in a clean deployable repo layout, ideally `client/`, or keep `public-tailwind-dist` committed.
- Configure Render custom domains.
- Configure Cloudflare DNS after Render provides targets.
- Add more active approved prices before a 100-person beta.
- Decide whether to remove `ADMIN_PIN` entirely after owner admin login is confirmed in production.
