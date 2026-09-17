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

The end goal: a Sellerboard-style profitability dashboard for solo Etsy
sellers — pick a period, see real fee-aware profit per order and per
listing, at a glance, with zero spreadsheet setup. Three phases, in order:

1. **Fee correctness (current work).** Nothing else matters if the numbers
   are wrong. This phase is: real Etsy data confirmed field-by-field (not
   assumed from docs), `feeEngine.ts` built and tested, wired into `sync.ts`
   with real per-shop inputs (`sellerCountry` auto-synced, VAT status
   user-set), and the dashboard actually displaying the right currency and
   the right numbers instead of placeholder/hardcoded values. Nearly done —
   see "Current status" below for what's left.
2. **Sellerboard-style dashboard.** Once fees are trustworthy: a date-range
   / period picker (this week, this month, custom range) and a per-listing
   profitability table (not just per-order), so a seller can see which
   products are actually worth making. This is the "current version looks
   empty" gap — v1 today shows a flat recent-orders list, not the
   at-a-glance profitability view that's the actual product.
3. **Etsy Commercial Access.** Required before any seller other than
   Bogdan's own connected shop can use this — see "Etsy API access — path
   forward" below. Separate track, not yet actioned, should be started in
   parallel rather than left until phases 1–2 are done, since manual review
   time is the long pole.

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

## Billing & free trial (2026-09-17, Bogdan's decisions)

$9/mo, single tier, no free-during-beta option. 30-day free trial, no card
collected up front, starting **at signup** (not at Etsy-connect) so a slow
setup can't quietly extend it. See "Billing/trial system shipped" under
Current status for the full build. Still needed from Bogdan before this
actually charges anyone: the real (non-test) Stripe Price ID as
`STRIPE_PRICE_ID`, and a webhook endpoint set up in the Stripe dashboard
(see `src/app/api/stripe/webhook/route.ts`'s header comment) with its
signing secret as `STRIPE_WEBHOOK_SECRET`. Both need redoing when switching
from Stripe test mode to live mode — see "Before beta launch" below.

## Backlog

Small known issues, not part of the phased roadmap above — pick up when
convenient, not blocking anything:

- **Magic-link sign-in occasionally fails** ("The sign in link is no longer
  valid") on a first click (2026-09-15). Most likely cause: an email
  security scanner (Gmail's own link-scanning, or a corporate mail gateway)
  auto-visiting the link to check it before the real click, which burns the
  one-time NextAuth token. Possible fix if it keeps happening: an
  intermediate "click to confirm sign-in" page that isn't itself the
  token-consuming URL, so a scanner's pre-fetch doesn't burn it.
- **Chrome "Dangerous site" warning on marginsnap.app for some visitors**
  (2026-09-15) — confirmed a false positive (Incognito, extensions
  disabled, showed no warning), so a browser extension was flagging it, not
  Google Safe Browsing itself. No action needed unless it starts showing up
  in Incognito too — if it does, Google's Safe Browsing has actually
  flagged the domain (a known false-positive pattern for NextAuth's default
  `/api/auth/*` route on fresh domains) and the fix is a reconsideration
  request in Google Search Console's Security Issues section.
- ~~**Root URL doesn't redirect a logged-in visitor to `/dashboard`**~~ —
  **fixed 2026-09-16.** `/` is now a server component that checks the
  session and redirects to `/dashboard` when signed in (sign-in form moved
  to `src/components/SignInForm.tsx`).
- **Batch/lot cost-of-goods costing** (e.g. Sellerboard's "the next 1000
  units cost €5, the next 1500 cost €6") — deliberately deferred, not an
  oversight. Bogdan asked for this alongside the dated-cost model
  (2026-09-16); the recommendation was to ship the dated/effective-cost
  model only for now, since it covers the common real case ("materials got
  pricier, reflect that going forward or backdate it") without requiring
  FIFO-style unit-consumption-order tracking, which is meaningfully more
  complex and cuts against this app's "not an accounting suite" positioning
  (see "What v1 is" above). Revisit only if sellers actually need precise
  per-batch numbers rather than "what did this cost around this time."
  Bogdan agreed to this sequencing.

## Before beta launch — do not forget

- **Switch Stripe from sandbox/test mode to production/live mode.** As of
  2026-09-17 the Stripe integration (`src/lib/stripe.ts`,
  `src/app/api/stripe/*`) is still wired to test keys/sandbox. Before any
  real beta user's card gets charged, swap in live API keys, the live
  webhook signing secret, and a real (non-test) Price ID for the $9/mo beta
  plan — and re-test the checkout → webhook → `subscriptionStatus` flow
  end-to-end against live mode once switched, since test-mode webhooks
  don't always behave identically.
- **Etsy Commercial Access** — required before anyone other than Bogdan's
  own connected shop can use this (see "Etsy API access — path forward"
  below). **Update 2026-09-17: a previous application was rejected** —
  reason not yet known. Next step: find the actual rejection notice (email
  from Etsy, or a status/reason shown under "Apps You've Made" on Etsy's
  developer dashboard) before resubmitting anything, rather than guessing
  at what to fix. This is the single hard blocker on inviting any beta
  tester other than Bogdan himself — nothing else on this list stops that.
- **Mobile**: not yet checked on a real phone/small viewport as of
  2026-09-17 (Bogdan's note) — do this before launch even if nothing else
  prompts it.
- **Set `ANTHROPIC_API_KEY` in Vercel's env vars.** Needed for the ad-spend
  screenshot import (2026-09-17) — see "Current status" below. Without it,
  the paste-text ad-spend import still works fine; only the
  upload-a-screenshot option returns a "not set up yet" error. Get a key
  from console.anthropic.com and add it to Vercel's Project Settings →
  Environment Variables (and to a local `.env` for `npm run dev`), then
  redeploy. `ANTHROPIC_VISION_MODEL` is optional — only set it if the
  default model in `src/lib/adSpendVision.ts` ever needs swapping out.
- **Multi-shop**: explicitly single-shop-per-login for the beta (decided
  2026-09-17) — every page loads `prisma.shop.findFirst(...)`, so a second
  connected shop would currently be silently invisible. Etsy itself ties
  one member account to one shop (confirmed 2026-09-17: a seller with two
  shops has two separate Etsy logins), so this only matters if a MarginSnap
  login tries to connect a second Etsy account's shop — not expected to
  come up during the beta, revisit if it does.

## Current status (as of 2026-09-13)

**Security incident, resolved (2026-09-15)**: Supabase's own security
advisor flagged every table in the `public` schema as publicly readable/
writable/deletable through Supabase's auto-generated PostgREST API (Row-
Level Security had never been enabled on any table). This app only ever
talks to Postgres through Prisma's direct connection (`DATABASE_URL`/
`DIRECT_URL`) — Supabase's REST API was never intentionally used — but
Supabase exposes every `public`-schema table through it by default
regardless, so this had been open since the `init` migration
(2026-09-10), roughly 5 days. One real mitigating factor: `Shop.accessTokenEnc`/
`refreshTokenEnc` are encrypted at rest, so even a raw read wouldn't have
handed over usable Etsy tokens — but shop/user/order data would have been
readable in plaintext by anyone with the project URL. Fixed by running
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on every table (including
Prisma's own `_prisma_migrations`) via Supabase's SQL Editor — with no
policies defined, this fully blocks the anon/PostgREST path while Prisma's
connection (which connects as the table owner) is unaffected. Confirmed via
Supabase's Security Advisor: 0 errors after the fix. **Checklist for any
future table/migration**: enable RLS the moment a table exists, before
relying on "the app doesn't use the Supabase API anyway" as the reason it's
safe — it isn't, by default.

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
  is null. Confirmed working end-to-end — the settings page now shows the
  shop's real country.
- `sellerHasValidVatId`: Etsy's API has **no field for this anywhere** —
  checked the full Shop resource schema, nothing tax/VAT-related exists.
  This is the one fee-engine input each seller sets themselves, per shop, on
  the `/dashboard/settings` page (`Shop.sellerHasValidVatId`, defaults to
  `false` — the conservative default, since it overstates fees slightly
  rather than understates them for a seller who has a VAT ID but hasn't told
  us yet).
- Offsite Ads attribution isn't present on the receipt/transaction objects
  either — `offsiteAdsAttributed` is always `false` for now, so that fee
  line is always 0 until a data source for it turns up.
- Country display: the settings page shows the full country name (e.g.
  "Lithuania"), not the raw ISO code, via `Intl.DisplayNames` — no
  hand-maintained country-name table, so every ISO code Etsy could ever send
  back displays correctly, not just the ones seen so far.
- Migration (`add_fee_engine_fields`, adding `Shop.sellerCountry` and
  `Shop.sellerHasValidVatId`) has been run and deployed.

**Currency correctness** (2026-09-13): the dashboard was displaying every
amount with a hardcoded `$`, regardless of the shop's real currency (this
shop's is EUR) — found while trying to visually verify the fee-engine work
above. Fixed by adding `Order.currency` (real ISO 4217 code, from the
receipt's own `currency_code`, never assumed) and a `formatMoney()` helper
using `Intl.NumberFormat`, so every currency Etsy could report displays with
its correct symbol/formatting — no hand-picked symbol table. Migration
(`add_order_currency`) and this batch of changes were ready to deploy as of
this writing — confirm in git history whether `git push` for this batch
completed.

**File-revert incident (2026-09-13)** — noting this so it doesn't repeat
silently: twice this session, a file (`src/lib/sync.ts`, then this file
itself, `PROJECT.md`) got silently overwritten back to an older version on
disk — after being written and confirmed saved — before `git add`/commit
ran, so the wrong (older) content nearly got committed despite the working
tree otherwise looking clean. Suspected cause: a stale editor buffer (e.g.
Notepad++, which has a local backup folder in this project) re-saving over
the file. No bad state reached `main` in either case — caught by re-checking
the file's actual content immediately after every write, and by running
`git status` / `git diff` (not just `git add` blindly) before every commit.
**Close the file in any local editor before running git commands** — this
is the fix on Bogdan's end; re-verifying immediately after every write is
the fix on the assistant's end.

**Sync-window bug (2026-09-13)** — a real order stayed stuck at "$300, no
currency" no matter how many times "Sync now" was clicked, even after the
money-field and currency fixes above had shipped. Cause: `sync.ts` used
`shop.lastSyncedAt` as the lower bound for which receipts to re-fetch, so an
already-synced receipt was never fetched again — freezing its Order-level
fields at whatever they were on first sync, forever. Fixed by always
re-fetching a rolling 90-day window on every sync, documented in `sync.ts`.
Same class of bug found again at the line-item level: `orderLineItem.upsert`'s
`update` clause only refreshed `cogsAtSale`/`lineProfit`, never `unitPrice`/
`quantity` — so a line item created before the money()/divisor fix stayed
frozen at its old (100x) value forever (surfaced as the Products table
showing €200 revenue on a real €2 item). Fixed the same way: `unitPrice` and
`quantity` are now refreshed on every sync too. **Lesson for future fixes to
this file**: any Order or OrderLineItem field that isn't seller-edited must
be in the `update` clause of its upsert, or a fix to how it's computed will
never reach rows that already exist.

**Revenue/profit definition unified (2026-09-13)**: the order card and the
Products table used to disagree — an order card showed the full amount
charged (item + shipping), the Products table showed item revenue only —
which looked like a bug even though both numbers were individually correct.
Unified across every view (`src/lib/profitability.ts`): "revenue" always
means the full `orderTotal` (item + shipping + gift wrap), and
shipping/gift-wrap is allocated into each product's revenue proportionally,
the same way fees are. This is a real behavior change, not a rounding fix —
profit numbers are visibly higher than before wherever shipping wasn't
separately costed (see the next item, which addresses exactly that gap).

**Shipping cost tracking (2026-09-13)**: until now, shipping revenue had no
offsetting cost anywhere — Etsy's API doesn't expose what a seller actually
paid for postage, so it silently flowed straight to profit. Built out:
- `Shop.assumeShippingNetZero` (default `false`) — the shop-level setting,
  on `/dashboard/settings`, for sellers who deliberately charge buyers
  exactly what shipping costs them (making it a real net-zero line).
- `Order.shippingCostAtSale` (nullable) — the seller's real postage cost per
  order, entered by hand (`ShippingCostEditor.tsx`,
  `/api/orders/[id]/shipping-cost`) since Etsy has no field for it. Never
  assumed to be 0 or equal to what the buyer was charged — an order that
  charged for shipping and isn't in net-zero mode shows "add shipping cost
  to see profit" until entered, the same missing-cost pattern already used
  for COGS.
- A dashboard-only quick toggle (`ShippingModeToggle.tsx`, `?shipping=count|
  exclude` on `/dashboard`) previews both modes without touching the
  shop's stored setting — view-only, never persisted.
- `src/lib/profitability.ts`'s `orderCogsFees`/`groupOrdersByDay`/
  `aggregateByListing` all now take an explicit `assumeNetZero` flag rather
  than reading it off the shop, so the same functions serve both the
  stored default and the dashboard's override.
- Migration: `add_shipping_cost_tracking` (adds the two fields above) — run
  this migration if it hasn't been applied yet.

**Cost-of-goods rewritten as a dated history (2026-09-16/17)**: replaced
`Listing.cogsAmount` (a single value) with a `CogsEntry` table
(`listingId`, `cogsAmount`, `effectiveFrom`, `createdAt`) — mirrors
Sellerboard's model, at Bogdan's request. Setting a new cost on the Manage
Costs page (`CogsEditor.tsx`) is always just inserting a row; three modes
all reduce to picking `effectiveFrom`:
- **From today** — `effectiveFrom` = today. Can never affect an
  already-synced order (its date is necessarily in the past), so this
  saves immediately with no confirmation.
- **Retroactively, all orders** — `effectiveFrom` = a sentinel date
  (1970-01-01, `EARLIEST_SENTINEL` in `src/lib/cogs.ts`) old enough to
  predate every real order, so "apply to everything" needs no special-case
  logic anywhere else.
- **From a specific date** — `effectiveFrom` = that date.

Resolving a listing's cost as of a given date (`resolveCogsForDate`): the
entry with the latest `effectiveFrom` at or before that date, ties broken
by `createdAt` (most recently added wins). `sync.ts` now resolves each
line item's cost using **the order's own date**, not "whatever the
listing's cost is right now."

That last point fixed a real, pre-existing bug found while building this:
because `sync.ts` always re-fetches/re-upserts a rolling 90-day window on
every sync (see "Sync-window bug" above), the old code recomputed
`cogsAtSale`/`lineProfit` from the listing's *current* `cogsAmount` on
every sync — so editing a listing's cost and then syncing silently
rewrote profit for any order in that 90-day window, contradicting the
documented "editing COGS never rewrites history" promise. Fixed as a side
effect of the per-order-date resolution above.

Retroactive/from-date changes **can** genuinely overwrite an
already-computed `cogsAtSale`/`lineProfit` for existing orders (unlike the
shipping-cost backfill, which only ever fills in a value that was never
set) — before either mode saves, `CogsEditor.tsx` calls
`GET /api/listings/[id]/cogs/affected-count` to get the exact count of
order line items that would change, then requires an explicit
`window.confirm()` naming that count: *"This will overwrite the cost of
goods for N orders that are already synced. Do you really want to
proceed? This change can't be undone."* The `confirmed: true` flag is
also enforced server-side (`POST /api/listings/[id]/cogs` — 400 without
it for any mode other than "today"), not just left to the frontend.

Migration `replace_cogs_amount_with_entries` is data-preserving: the
generated SQL was hand-edited (via `--create-only`, before applying) to
seed one retroactive `cogs_entries` row (`effectiveFrom` = 1970-01-01) per
listing that already had a `cogsAmount`, positioned before the
`DROP COLUMN cogsAmount` — so no seller's existing cost was lost in the
migration.

**Onboarding wizard + notifications + nav reorg (2026-09-17)**: shipped.
First-time wizard (`/dashboard/onboarding`) asks VAT status, the shipping
net-zero assumption, and — for small shops — lets sellers enter costs
inline instead of just being told to go do it later; gated on
`Shop.onboardedAt` (null = hasn't seen it, only shown once the first sync
has produced ≥1 listing; existing shops backfilled so they never see it
retroactively). "Manage Costs" moved out of the dashboard card into
settings/nav. A generic notification system (`src/lib/notifications.ts` +
`NotificationsPanel.tsx`) replaced the old hardcoded "listings missing
cost" card — computed fresh per page load from live data, nothing stored.

**Sellerboard-style table redesign (2026-09-17)**: shipped. Both Orders and
Products moved from card layouts to real `<table>` markup with proper
columns (`OrdersTable.tsx`, `ProductsTable.tsx`) — Orders flattened from
day-grouped cards to one row per order (day-subtotal grouping dropped for
simplicity, revisitable); Products keeps Product/Units/Revenue/Fees/
Shipping/Cost/Profit columns. Mobile fallback is horizontal scroll, not a
second stacked layout — a deliberate simplicity tradeoff for now. The old
`OrderRow.tsx`/`DayGroup.tsx` are unused but left in place pending an OK to
delete. Investigated whether line-item profit allocates fees/shipping
correctly (it was assumed buggy) — it already did, via
`aggregateByListing`'s proportional revenue-share allocation; no fix
needed, just a stale comment cleaned up.

**Magic-link sign-in bug**: fixed for real (2026-09-17) — see the Backlog
entry above for the original hypothesis; the intermediate
`/auth/confirm?u=<real url>` page (`src/app/auth/confirm/page.tsx`,
wired via `sendVerificationRequest` in `src/lib/auth.ts`) is now live, so a
scanner's pre-fetch of the emailed link no longer burns the real token —
only a real client-side click does.

**Billing/trial system shipped (2026-09-17)**: the full free-trial +
paywall + reminder-email system described under "Billing & free trial"
above.
- `User.trialEndsAt` set once, in `auth.ts`'s `events.createUser` (fires
  only on first sign-in ever, i.e. brand-new account) — 30 days from then,
  independent of Etsy-connect. Null = grandfathered (pre-dates this
  feature), never gated — same pattern as `Shop.onboardedAt`.
- `src/lib/billing.ts`'s `getBillingStatus()` is the single source of truth
  every dashboard-area page calls — currently wired into `/dashboard` and
  `/dashboard/listings` (the latter needs its own check since it's
  reachable directly by URL, not just via the dashboard). Any *new*
  dashboard-area page needs the same check.
- Trial-expired gate: `TrialEndedScreen.tsx` replaces the whole page (data
  stays intact, nothing's deleted) once `trialExpired` is true.
- Trial countdown surfaced at the top of the dashboard via the existing
  notification panel (`getNotifications`'s new `trialDaysLeft` param) —
  shows days left + a "Subscribe — $9/mo" CTA whenever the trial is active.
- **Stripe webhook gap discovered and fixed**: `/api/stripe/webhook` didn't
  exist anywhere before this — meaning a completed Stripe Checkout never
  actually updated `subscriptionStatus`. Built from scratch
  (`src/app/api/stripe/webhook/route.ts`): handles
  `checkout.session.completed` (sets `stripeCustomerId` +
  `subscriptionStatus: "active"`), `customer.subscription.created`/
  `updated` (keeps `subscriptionStatus`/`subscriptionPriceId` synced), and
  `customer.subscription.deleted` (sets `"canceled"`). **Needs setting up
  in the Stripe dashboard before it does anything** — see its header
  comment and "Billing & free trial" above.
- Reminder emails via a new daily cron, `/api/cron/trial-reminders`
  (added to `vercel.json` alongside the existing `sync` cron; same
  `Bearer $CRON_SECRET` auth pattern): countdown emails at 14/10/7/5/3/1
  days left (`User.trialReminderStagesSent` tracks which stages already
  fired, so a cron that runs twice in a day can't double-send), then a
  "still want MarginSnap?" renewal nag repeated every ~21 days once the
  trial's over and they haven't subscribed (`User.lastRenewalReminderAt`).
  Emails sent via a new shared helper, `src/lib/email.ts`, reusing the same
  `EMAIL_SERVER_*` SMTP env vars `auth.ts` already uses.
- Migration needed: adds `User.trialEndsAt`, `trialReminderStagesSent`
  (defaults to `[]`), `lastRenewalReminderAt` — all either nullable or
  Postgres-default-backfilled for existing rows, so a plain
  `npx prisma migrate dev` (no `--create-only` hand-edit) should be safe.
  **Verify the generated SQL matches this expectation before applying.**

**Landing page shipped (2026-09-17)**: marginsnap.app's root URL now shows
a real marketing page (`src/components/LandingPage.tsx`) instead of just
the bare sign-in form — hero, problem/feature blurbs, a "how it works"
section, a generic (no-brand-name) comparison table, pricing shown
plainly, and the sign-in/signup form itself at the bottom. Warm orange
accent color (`--warm`/`--warm-ink`/`--warm-soft` in `globals.css`) added
alongside the existing sage-green palette, landing-page-only for now, plus
an original price-tag logo mark (`Logo` in `LandingPage.tsx`) replacing
the old "🧵 MarginSnap" text. Two follow-up fixes same day: dropped
"Sellerboard" from the visible copy (Bogdan's call — naming a real
competitor as a generic category noun in a headline is a riskier trademark
use than a factual side-by-side comparison, which the table still does
without naming brands) and removed a duplicated Privacy/Terms footer
(`SignInForm`'s own footer was showing under the login field AND the
page's own footer right below it — `SignInForm` now takes a
`showLegalLinks` prop, `false` when the landing page embeds it).

**ToS/Privacy agreement checkbox added (2026-09-17)**: `SignInForm` didn't
have one before — a required checkbox ("I agree to the Terms and Privacy
Policy") now gates the same submit button used for both signup and
sign-in (the form can't tell which before the email's submitted, so this
shows every time, not just on a first-ever signup). No new DB field — it's
a plain HTML `required` checkbox, so the browser blocks submission until
checked; there's no stored record of *when* someone agreed beyond that.

**"Reconnect a different shop" added to Settings (2026-09-17)**: the swap
logic already existed (`/api/etsy/callback` deletes whatever shop is
currently connected — cascading to its listings/orders/cost history — and
creates a fresh one from whatever Etsy account completes OAuth next), but
nothing in the UI pointed at it once a shop was already connected. Added
`ReconnectShopLink` (a small client component with a `window.confirm()`
warning, same "make sure they meant it" pattern as `CogsEditor`'s
retroactive-cost confirm) to the settings page.

**Ad spend tracking added (2026-09-17)**: Etsy has no ad-spend API endpoint
(confirmed via github.com/etsy/open-api/discussions/1082, an unresolved
feature request since 2023) and no documented CSV export for it either, so
this is a manual import, per listing per period, via a new page
(`/dashboard/ad-spend`, `AdSpendImporter.tsx`) with two entry paths:

- **Paste from Etsy**: the seller copies the listings table straight off
  Etsy's own Ads stats page and pastes it as text. Parsed by
  `src/lib/adSpendImport.ts` (tab/comma-separated, tries to find a header
  row to identify the Spend column by name; falls back to "the one
  money-shaped cell in the row" when there's no header, flagged as
  low-confidence for the review screen).
- **Upload/paste a screenshot**: same idea, but reading the numbers off an
  image via one Anthropic API vision call (`src/lib/adSpendVision.ts`, plain
  `fetch`, no SDK dependency added). Needs `ANTHROPIC_API_KEY` set — see
  "Before beta launch" above. Without it, this option returns a clear
  "not set up yet" error rather than a 500; the paste-text option is
  unaffected either way.

Both paths land in the exact same place: an editable review table
(`AdSpendImporter.tsx`) showing the detected period, a listing picker per
row (pre-matched by `matchListingLabel`'s fuzzy title match, always
overridable), and an editable amount — nothing is saved until the seller
confirms it there (`/api/ad-spend/save`), since a misread number would
otherwise silently distort profit. New `AdSpendEntry` model
(`listingId`, `periodStart`, `periodEnd`, `amountSpent`, `currency`,
`source`) — see its comment in `schema.prisma`.

This subtracts from a listing's profit on the **Products** tab
(`aggregateByListing`'s new `adSpendByListing` param — sums any entries
whose period overlaps the dashboard's selected period, no proration) but
deliberately NEVER touches the **Orders** tab's per-order profit, since ad
spend can't be tied to one order. Both tabs now show a disclosure line
saying exactly that, linking to `/dashboard/ad-spend` — see
`dashboard/page.tsx`'s "Ad spend disclosure" comment.

**Not yet built** — explicitly deferred, not forgotten: nothing under this
heading currently.

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

**Fee engine** (`src/lib/feeEngine.ts` + `src/lib/feeEngine.test.ts`): built
and tested as a pure function, independent of live API access. 9/9 tests
passing — run with `npx tsx --test src/lib/feeEngine.test.ts`. Covers:
transaction fee, payment processing (by country), the multi-quantity fee,
Offsite Ads (both rates + the $10k/365-day threshold + the $100 cap),
currency conversion, the Regulatory Operating Fee (by country), and VAT on
fees (EU/UK, registered-vs-unregistered). Every rate is cited to an Etsy
source in the file header; `FEES_AS_OF` marks when they were last checked —
re-verify before trusting them long-term, Etsy revises these periodically.

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
