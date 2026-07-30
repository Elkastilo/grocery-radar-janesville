# Grocery Radar Janesville Tailwind Frontend

This folder contains the React/Vite/Tailwind public frontend for Grocery Radar Janesville.

It is not a new backend, not a database migration, and not a rewrite of the existing Express app. It calls the existing Grocery Radar APIs and only displays approved public price data.

## Backend Safety

- Existing Express backend stays in `grocery-radar-janesville`.
- Existing SQLite schema is unchanged.
- Existing auth, admin APIs, uploads, moderation, cart, reports, and email verification routes are reused.
- Backend admin tools stay in the original app, especially `/admin.html`.
- Old backend files are not deleted by this frontend.
- Vite dev mode proxies `/api`, `/uploads`, and `/admin.html` to `http://127.0.0.1:3000`.

## Run Locally

Start the existing backend:

```bash
cd /Users/rick/Documents/Codex/2026-06-02/i-am-building-a-new-app/grocery-radar-janesville
HOST=127.0.0.1 PORT=3000 npm start
```

Start this Tailwind frontend:

```bash
cd /Users/rick/Documents/Codex/2026-06-27/create-a-separate-tailwind-prototype-for/grocery-radar-tailwind-prototype
npm install
npm run dev -- --host 127.0.0.1
```

Open the Vite URL, usually:

```text
http://127.0.0.1:5173/
```

## API-Backed Public Screens

- Home uses `/api/stores` and `/api/browse`.
- Search / Browse uses `/api/search`.
- Product Detail uses `/api/products/:id`.
- Deals uses approved report data from `/api/search`.
- My List uses `/api/cart` and `/api/cart/compare`.
- Submit Proof posts `FormData` to `/api/proof-submissions`.
- Profile / Rewards uses `/api/auth/me`, `/api/account/reports`, `/api/account/verifications`, `/api/users/:username`, and `/api/rewards`.

## Production Build

Build the frontend:

```bash
npm run build
```

The Express backend can serve the built app from its `public-tailwind-dist` folder. From the backend repo:

```bash
CLIENT_DIR=/Users/rick/Documents/Codex/2026-06-27/create-a-separate-tailwind-prototype-for/grocery-radar-tailwind-prototype npm run build:client
```

## Current Integration Stage

Tailwind is the intended public shopper app. The existing Express backend remains the API, database, auth, upload, email, moderation, rewards, and admin system.
