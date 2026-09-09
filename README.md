# MarginSnap

Profit-per-order and per-listing tracker for Etsy sellers. See the [Blueprint](../MarginSnap_Blueprint) for the full spec — this README is just the "how do I run this" part.

## What's real here, and what isn't yet

This is a **Phase 2 scaffold** (see the Blueprint's Roadmap), not a finished product:

- ✅ Project structure, Prisma schema, auth (magic link), PWA shell, legal pages, Stripe env vars wired for later.
- ⚠️ **The Etsy API integration (`src/lib/etsy.ts`, `src/app/api/cron/sync/route.ts`) is unverified against a live key.** Endpoint paths, scope names, and response field names follow Etsy's published docs but haven't been tested against a real response yet. That verification is the very first thing to do once `ETSY_KEYSTRING` exists — see the `⚠️` comments in those two files.
- ❌ Not built yet: the cost-of-goods entry screen, CSV export, Stripe checkout wiring, PWA install prompt polish. That's Phase 3.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — a Postgres connection string (Neon or Supabase both work; free tier is enough for now)
   - `TOKEN_ENCRYPTION_KEY` and `NEXTAUTH_SECRET` — generate per the comments in `.env.example`
   - `ETSY_KEYSTRING` / `ETSY_SHARED_SECRET` — from the Seller App registered at etsy.com/developers
   - Email server vars — any SMTP provider (Resend, Postmark, etc.) works for magic-link sign-in
3. `npx prisma migrate dev --name init` — creates the tables in your database
4. `npm run dev` — runs at localhost:3000

## Deploying

1. Push this repo to GitHub.
2. Import it into Vercel; add every var from `.env.example` as a Vercel environment variable (never commit `.env.local`).
3. `vercel.json` already configures the sync cron to run every 15 minutes — Vercel picks it up automatically on deploy.
4. Set `NEXTAUTH_URL` to your real deployed URL once you have one.

## A note on the Etsy scopes and endpoints

Everything in `src/lib/etsy.ts` is written against Etsy's *published* Open API v3 docs, not a live test — I don't have a Seller App key to verify against yet. The very first task once one exists: connect a real test shop, log the raw responses from `getShopForUser`, `listActiveListings`, and `listReceiptsSince`, and fix whatever field names don't match what's assumed in `src/app/api/cron/sync/route.ts` (particularly the fee/shipping breakdown — that math is currently a placeholder).
