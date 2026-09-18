# MarginSnap — project brief

Read this before re-deriving anything about scope or architecture — it exists
so a fresh session (or a fresh person) doesn't need Bogdan to re-explain the
decisions below. Keep it updated as decisions get made; it should stay ahead
of README.md, which describes the scaffold's file layout, not the product
decisions.

## What v1 is

Solo Etsy sellers. Mobile-first. One question, answered fast: **is this
order — or this listing — actually profitable after fees, shipping and
COGS?**

Not an accounting suite. The competitors this beats (Craftybase, Paper+Spark,
Inventora) lose because they're spreadsheet-shaped and built for bigger
operations — more setup, more fields, more screens than a solo seller wants.
MarginSnap's edge is answering the one question those tools bury.

## Roadmap / end goal (2026-09-13)

Bogdan's own framing: something in the shape of **Sellerboard**, but scoped
down to profitability only (not full accounting) — connect your shop, see
real profit per order and per product, filter by period. The current
dashboard (a plain list of recent orders) is intentionally minimal so far,
not the finished picture — it looked "empty" compared to that, correctly.

Three phases, in order, and deliberately in this order — no point building
a nicer UI on numbers that aren't verified yet:

1. **Fee correctness** — real Etsy data instead of assumptions, real
   per-shop fees instead of a stub. **Verified working end-to-end as of
   2026-09-13**: a real order shows its real currency, real fees, and a real
   net profit, and Settings shows the shop's real country. See "Current
   status" below for the full list of what was found and fixed. Remaining
   known simplifications are documented below too (not bugs, just not v1
   scope yet).
2. **The actual dashboard** (current phase) — a date-range/period picker,
   and a per-listing profitability table (not just a list of individual
   orders) — this is the Sellerboard-shaped layer. Not started yet.
3. **Etsy Commercial Access** — required before any seller besides Bogdan
   can connect a shop (see "Etsy API access" below). Can run in parallel
   with 1 and 2 since it's a slow manual review with no published SLA, but
   should go in soon since it's the long pole, not a last step.

## Architecture: API-first, adapter-shaped

The shipped product is API-based — a seller connects their Etsy account and
it just works. **No CSV upload in the shipped version.**

The calculation core (`src/lib/feeEngine.ts`) is a pure function: a
normalized order in, a full fee breakdown out. It never sees Etsy's raw wire
format. That's deliberate — it's the seam an adapter layer sits behind:

- `EtsyApiAdapter` (not built yet) — maps a real Etsy `/receipts` response
  into the engine's `FeeEngineInput` shape. This is the only adapter that
  ships in the product.
- A CSV adapter is a **testing path only**, useful for feeding known-good
  rows into the engine without live API access — never a product feature,
  never shipped to users.

Practically: nothing about `feeEngine.ts` should ever need to change to
support a new data source — only a new adapter gets written, and only the
Etsy one is real work for v1.

## No billing yet

Stripe fields exist in the Prisma schema and `src/lib/stripe.ts` /
`src/app/api/stripe/*` routes exist in the scaffold, wired but inert. Leave
them alone until someone actually wants to pay. Don't extend, don't wire up
checkout flows, don't add pricing logic — that's explicitly out of scope
until it's needed.

## Current status (as of 2026-09-13)

**Scaffold** (`C:\ClaudeCode\Apps\marginsnap`): Next.js 14 + TypeScript +
Prisma (Postgres, hosted on Supabase) + NextAuth (email magic link) + PWA
shell + legal pages (`/privacy`, `/terms`) + Stripe env wired. This part is
solid and not in question.

**Deployed and live**: the app runs at **marginsnap.app**, hosted on
**Vercel**, deployed via GitHub (`soleczniki/marginsnap`, push to `main`
auto-deploys). A real Etsy shop (Personal App, keystring registered) has
been connected end-to-end through the live `/api/etsy/connect` →
`/api/etsy/callback` OAuth flow — this isn't scaffold-only anymore.

Note: README.md says the cost-of-goods entry screen and CSV export are
"Phase 3, not built yet" — that's stale. Both exist
(`src/components/CogsEditor.tsx`, `src/app/dashboard/listings/page.tsx`,
`src/app/api/export/csv/route.ts`) and look reasonably complete. Don't trust
README's roadmap section without checking the actual files; this doc is
meant to replace it as the source of truth on status.

**Etsy API integration** (`src/lib/etsy.ts`, `src/lib/sync.ts`,
`src/app/api/cron/sync/route.ts`): **verified against a real, live
`/receipts` response on 2026-09-13** (via a temporary diagnostic route,
since removed — see `scripts/etsy-verify.ts` for the OAuth-based
alternative verification path if this needs redoing). Two real bugs found
and fixed in `sync.ts`:
- Every Etsy money field is `{ amount, divisor, currency_code }` — the real
  value is `amount / divisor`. The old code used `.amount` raw, overstating
  every figure 100x (a real €3.00 order showed as $300). Fixed via a
  `money()` helper.
- `receipt.fees` does not exist on the real response at all (not an empty
  object — the field is simply absent). The old `receipt.fees ?? {}` always
  silently landed on `{}`. Real fees are now computed via `feeEngine.ts`'s
  `computeOrderFees()` — see below.

`grossAmount`/`shippingCost`/`feesBreakdown` are now recomputed on **every**
sync, not just first insert (nothing on `Order` is seller-edited, so
there's no user input to protect by leaving old values alone) — this means
re-syncing after this fix auto-corrects any order that synced before it.

**Fee engine wiring** (2026-09-13 decision — this matters for the "sold to
other sellers" positioning, not just Bogdan's own shop): `computeOrderFees()`
needs `sellerCountry` and `sellerHasValidVatId`, and neither was stored
anywhere. Resolved as:
- `sellerCountry`: pulled automatically on **every sync**, stored per-shop on
  `Shop.sellerCountry`. Never entered by hand, never hardcoded — each
  connected shop gets its own. First attempt used `shop_location_country_iso`
  alone; a real shop had that field present but genuinely `null` (never
  filled in that setting), so it stayed unsynced through several manual
  "Sync now" clicks with no error — confirmed via a temporary diagnostic
  route (`scripts/diag-shop-route.ts`) that dumped the real Shop object.
  Fixed by falling back to `shipping_from_country_iso` (also a real,
  per-shop Etsy field, populated on the same shop) when the location field
  is null.
- `sellerHasValidVatId`: Etsy's API has **no field for this anywhere** —
  checked the full Shop resource schema, nothing tax/VAT-related exists.
  This is the one fee-engine input each seller sets themselves, per shop, on
  the new `/dashboard/settings` page (`Shop.sellerHasValidVatId`, defaults to
  `false` — the conservative default, since it overstates fees slightly
  rather than understates them for a seller who has a VAT ID but hasn't told
  us yet).
- Offsite Ads attribution isn't present on the receipt/transaction objects
  either — `offsiteAdsAttributed` is always `false` for now, so that fee
  line is always 0 until a data source for it turns up.
- **Migration run and deployed** (`Shop.sellerCountry`, `Shop.sellerHasValidVatId`
  both live). Settings page shows the country as a full name via
  `Intl.DisplayNames` (not a hand-maintained country list) instead of the
  raw ISO code.
- `Order.currency` added (ISO 4217, from the real receipt — never assumed):
  the dashboard previously showed every amount with a hardcoded `$`, wrong
  for this EUR shop. Order rows now format via `Intl.NumberFormat` with the
  order's real currency, and show total fees + a real fee-aware profit
  (gross − fees − COGS) instead of only a COGS-based number.
- **Incident, 2026-09-13**: right after the `sellerCountry` fix was pushed,
  `src/lib/sync.ts` reverted to an older, pre-fee-engine version on disk
  before the next `git commit` — so that commit shipped the old file
  despite the push succeeding. Likely cause: an editor (Notepad++ — see
  the `nppBackup` folder in this project) had a stale buffer open and
  saved over it. Caught via `git diff` before the second push went out;
  no bad state reached `main`. Worth keeping files this session is
  actively editing closed elsewhere until a push is confirmed.
- **Sync-window bug, fixed 2026-09-13**: `syncShop()` only fetched receipts
  created *since the last sync* (`minCreated = shop.lastSyncedAt`). Once an
  order synced once, no later "Sync now" ever fetched it again — so it
  stayed frozen at whatever values it got on its first sync, forever, even
  after `money()`/currency/fee-engine fixes shipped. Found when a real order
  kept showing `$300.00`/no currency no matter how many times "Sync now"
  was clicked, after the currency fix had already deployed. Fixed by always
  re-fetching a rolling 90-day window instead of using `lastSyncedAt` as a
  cursor — cheap at solo-seller order volumes, and it means any future
  change to the computation logic reaches already-synced orders the next
  time they sync, automatically, rather than requiring a one-off backfill
  script. Verified end to end after this fix: the real order now shows
  `€3.00`, `fees: €0.75`, `+€0.25` net profit, and Settings shows
  "Lithuania."

**Fee engine** (`src/lib/feeEngine.ts` + `src/lib/feeEngine.test.ts`): built
and tested as a pure function, independent of live API access. 9/9 tests
passing — run with `npx tsx --test src/lib/feeEngine.test.ts`. Covers:
transaction fee, payment processing (by country), the multi-quantity fee,
Offsite Ads (both rates + the $10k/365-day threshold + the $100 cap),
currency conversion, the Regulatory Operating Fee (by country), and VAT on
fees (EU/UK, registered-vs-unregistered). Every rate is cited to an Etsy
source in the file header; `FEES_AS_OF` marks when they were last checked —
re-verify before trusting them long-term, Etsy revises these periodically.

Known simplifications, documented in the code, not yet product decisions:
- Multi-quantity billing state (which unit is "the first sold" on a
  listing) is now derived in `sync.ts` from order-line-item history per
  listing (a listing with zero prior line items = first sale) — not
  Etsy-provided, our own derivation.
- The payment-processing fixed fee assumes the order currency matches the
  fixed fee's currency (true when a seller lists in their own home
  currency — true for every real case seen so far). No FX conversion is
  built in.
- The VAT-on-fees rate table covers EU + UK only, not every jurisdiction
  Etsy might apply VAT/GST in (e.g. Norway, Switzerland, Singapore).
- Line-item-level `lineProfit` (`OrderLineItem`) still doesn't allocate a
  share of order-level fees/shipping — it's `unitPrice - cogsAtSale` only.
  Order-level `netToSeller` (in `feesBreakdown`) is the real fee-aware
  number; per-line profit allocation is separate, later work.

**Etsy API access**: a Personal App is registered and working (real OAuth
connect + real data confirmed above). Commercial Access (needed before this
can be the actual multi-seller product) is a separate, not-yet-actioned
thread — see below.

## Etsy API access — path forward

Etsy's Open API v3 has three access tiers (source:
[developers.etsy.com](https://developers.etsy.com/documentation/),
[Seller App registration guide](https://help.etsy.com/hc/en-us/articles/41918478450967-How-to-Register-a-Seller-App-with-Etsy-s-API)):

1. **Seller App** — single shop only, read/write your own shop's data.
   Requires an active Etsy shop in good standing, no existing app already
   registered. Approval is near-instant ("usually within a few minutes").
   Cannot serve other sellers or be a commercial platform.
2. **Personal App** — beyond one shop, limited scale. No shop requirement.
   Goes through a deeper (manual) review than Seller App; no published SLA.
3. **Commercial Access** — required for MarginSnap's actual product (any
   seller connects their own shop via OAuth). Two-step: first get a Personal
   App approved, then request Commercial Access from "Apps You've Made" on
   that approved app. Reviewed manually; Etsy doesn't publish a timeline
   ("review time may vary"), and developer community reports (GitHub
   discussions on `etsy/open-api`, Etsy's own community forum) describe
   waits from a few days to several weeks under similar manual reviews —
   treat that as a rough, unofficial range, not a guarantee.

**What to do today:**
- Register a **Seller App** now, against the friend's real (already-active)
  shop with the two test purchases. This should approve in minutes and is
  enough to unblock the very first task from README.md: log a real
  `/receipts` response and fix whatever field names in `etsy.ts`/`sync.ts`
  don't match Etsy's actual response shape. This path is for verification
  only — it can never become the product's access, since it's single-shop.
- In parallel, register a **Personal App** under MarginSnap's own developer
  identity (not the friend's shop) with a clear description of the intended
  use (a profitability calculator for Etsy sellers). Avoid "Etsy" in the app
  name; review criteria mention trademark distinction, no screen-scraping,
  OAuth for private data, and proper naming/artwork.
- Once the Personal App is approved, request **Commercial Access** on it.
  Having the scaffold's existing `/privacy` and `/terms` pages live at a
  real, reachable URL before requesting this will help — commercial review
  looks for exactly that kind of thing.
- This Commercial Access request is the one to submit early and expect to
  wait on — it's the long pole, not the Seller App verification step.

### Personal App registration — exact form, and can it be submitted today

Yes — no live deployment is needed. Register at
[etsy.com/developers/register](https://www.etsy.com/developers/register)
(requires signing in with an Etsy account). Reported form fields (source:
third-party walkthroughs plus Etsy's own Quick Start Tutorial, since the live
form itself sits behind login and isn't fetchable directly):

- **App name** — avoid using "Etsy" in it (a common rejection reason).
- **App description** — short explanation of what it does.
- **Application website** — marked "if available," i.e. optional. Nothing
  here requires a deployed, publicly reachable site yet.
- **User type** — who will use it (e.g. "Just myself or colleagues"). For
  today's registration, answer this honestly as solo/development use — the
  separate Commercial Access request later is where the multi-seller product
  gets described.
- **App category** — e.g. "Seller Tools."
- **Commercial vs non-commercial** — mark non-commercial for this Personal
  App; commercial framing belongs in the later Commercial Access request,
  not here.
- A captcha.
- **Callback/redirect URI** — can be a `localhost` address (Etsy's own Quick
  Start Tutorial uses `http://localhost:3003/oauth/redirect`), and can be
  added or changed after initial registration. Whatever's registered must
  match the `redirect_uri` sent in the OAuth request character-for-character
  (protocol, trailing slash, everything) — the most common integration
  error is a mismatch here, not a registration problem.

What happens after submitting: a keystring and shared secret are typically
issued immediately, even while the app shows "Pending Personal Approval."
Based on developer reports (GitHub `etsy/open-api` discussions), full
OAuth-authenticated calls tend to start working somewhere between about a
week and two weeks after that — not an official SLA, just what people
report.
