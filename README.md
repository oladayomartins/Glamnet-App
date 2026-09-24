# GLAMNET

A PWA marketplace for independent beauty professionals, built to two specs:

- *GLAMNET — Updated Booking, Calendar & Emergency Work Requirements* — the
  emergency broadcast, pricing and calendar engine described below; and
- *GLAMNET Open Marketplace Directory v1.0* — vendor storefronts, the
  directory, the dual-commission payout protocol and PIN-released escrow.
  See [Open Marketplace Directory](#open-marketplace-directory) for how each
  of its features maps to the code.

The defining rule: a booking requested **within 12 hours** of its appointment is
an **EMERGENCY** booking and carries a surcharge. That classification is
calculated server-side, shown to the customer before payment, carried through
the provider broadcast and the whole lifecycle, and reportable in the admin
dashboard.

---

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, with all brand values as CSS custom properties |
| Data | Prisma + PostgreSQL |
| Validation | zod on every request body |
| Payments | Stripe Connect Express over the REST API (simulated when unconfigured) |
| Tests | Vitest — 139 unit tests over the booking, commission and escrow rules |

## Getting started

You need a PostgreSQL database — any host will do (Supabase, Neon, Vercel
Postgres, or a local `postgres` container). Copy `.env.example` to `.env` and
fill in the two connection strings, then:

```bash
npm install
npm run db:migrate      # apply the schema
npm run db:seed         # hubs, services, providers, a sample booking
npm run dev
```

Then open http://localhost:3000. Useful scripts:

```bash
npm test                # run the unit tests
npm run db:reset        # drop, re-migrate and re-seed
npm run db:studio       # browse the data
npm run build           # production build
```

Two environment variables are required, both documented in `.env.example`:
`DATABASE_URL` (pooled, used by the app) and `DIRECT_URL` (unpooled, used only
by `prisma migrate`). Serverless hosts need the pooled URL for requests — a
lambda per request would otherwise exhaust Postgres connections — and a
transaction pooler cannot carry migrations, hence the second.

---

## Deploying

The build does **not** touch the database. `next build` only needs
`prisma generate` (wired into `postinstall`), and no page is prerendered from
live data — the root layout in particular is deliberately free of data access,
because it wraps the statically prerendered 404 and would otherwise drag that
page into needing a database at build time.

Migrations are therefore a deploy step, not a build step:

```bash
npm run db:migrate:deploy   # against DIRECT_URL
```

`20260920000000_catch_up_auth_media` adds the sign-in, vendor-approval and
media columns that earlier schema changes shipped without a migration. It is
idempotent, so a database that was brought up to date with `prisma db push`
passes through it unchanged. `vercel.json` schedules the daily dispute-window
sweep; set `CRON_SECRET` for it to run.

Set `DATABASE_URL` and `DIRECT_URL` in the host's environment for every
environment you deploy to (on Vercel: Production, Preview and Development).

---

## Brand guide status

**The colours, type and shape tokens in this build are placeholders.**

The GlamNet Brand Guide lives in a Claude Design project that the build session
could not read (design-system authorisation is not available non-interactively).
Rather than guess and scatter values through the components, every brand value
is defined once:

- **`src/app/globals.css`** — all colours, radii and shadows, as CSS custom
  properties fed into Tailwind's `@theme`.
- **`src/app/layout.tsx`** — the two font families (`--font-brand-sans`,
  `--font-brand-display`).

No component hard-codes a colour or a font, so adopting the real brand guide
means editing those two files and nothing else. The emergency alert colour is
deliberately outside the brand palette: the spec requires it to be impossible
to miss.

---

## How the booking engine works

The core is a set of pure functions in `src/lib/domain`, with no database or
framework dependencies, so the business rules are testable in isolation.

### Classification — `classification.ts`

```
notice_period_minutes = appointment_start_at - booking_created_at

IF notice_period_minutes <= threshold  ->  EMERGENCY
ELSE                                   ->  NORMAL
```

The threshold defaults to 720 minutes (12 hours) but is read from admin config,
so it can be changed without a release. The boundary is inclusive: exactly 720
minutes is EMERGENCY.

The customer supplies the hub, the services and the appointment time — never the
classification, and never a price. Both are recomputed server-side when the
booking is created, so a tampered client cannot buy a NORMAL rate for a
short-notice job.

### Pricing — `pricing.ts`

```
NORMAL     = base services + add-ons + travel fee + other surcharges + £0.50 trust fee
EMERGENCY  = the same, plus the emergency surcharge
```

The surcharge is a commercial parameter, configurable as a percentage or a fixed
amount (§14 leaves the exact value to the client). All money is integer pence,
so repeated pricing never drifts. The breakdown is returned itemised, which is
what lets the checkout show the surcharge *before* payment authorisation.

### Availability — `availability.ts`

Every booking occupies **service duration + a 15-minute transition period**. A
12:00–14:00 booking reserves 12:00–14:15, and that reserved window — not the
service window — is what conflicts are tested against.

Overlap is half-open (`[start, end)`), so back-to-back work at 14:15 is legal
while anything earlier is not. The same `isProviderAvailable` gate serves the
customer's slot picker and the emergency broadcast matcher, which is what makes
the spec's rule hold: **an emergency booking never overrides an existing
commitment.**

### Matching — `matching.ts`

Eligibility is sector + skill + calendar. Eligible providers are ranked by
rating (completed bookings as the tiebreak) and the top five are broadcast to.
The first to accept wins.

Acceptance runs in a transaction, and the claim is guarded by
`status: "BROADCAST"`. If two providers accept simultaneously, the second update
matches zero rows and that provider is told the job is gone — the slot cannot be
double-booked.

---

## Screens

| Route | Purpose |
|---|---|
| `/` | Beauty Hub selection |
| `/book/[hubId]` | Services → reference → add-ons → date & time → checkout |
| `/bookings/[id]` | Customer booking record and lifecycle progress |
| `/provider` | Provider directory |
| `/provider/[id]` | Broadcast inbox + day/week calendar, bio link, vacation toggle |
| `/provider/onboarding` | The storefront wizard |
| `/sheffield/salons` | Marketplace directory: hub tiles + postcode sort |
| `/pro/[slug]` | Vendor storefront: lookbook, menu, calendar, checkout, reviews |
| `/admin` | Emergency reporting, pricing config, filtered booking ledger |

The date picker tags each slot NORMAL or EMERGENCY as it is rendered, so the
customer sees the emergency window before choosing, not after.

The provider calendar draws each booking twice: a solid block for the billable
service and a lighter tail for the transition period, so a provider can see
exactly why a following slot is not offered to them.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/hubs`, `/api/services`, `/api/providers`, `/api/customers` | Catalogue |
| `POST` | `/api/availability` | Bookable slots, each tagged NORMAL/EMERGENCY |
| `POST` | `/api/bookings/quote` | Itemised price preview before payment |
| `POST` | `/api/bookings` | Create and broadcast |
| `GET` | `/api/bookings/:id` | Booking record (address withheld until unlocked) |
| `POST` | `/api/bookings/:id/accept` | Provider claims the job |
| `POST` | `/api/bookings/:id/status` | Advance the lifecycle |
| `POST` | `/api/bookings/:id/review` | Customer rating |
| `GET` | `/api/providers/:id/calendar` | Day or week view |
| `GET` | `/api/providers/:id/requests` | Broadcast inbox |
| `GET`/`POST` | `/api/admin/emergency-config` | Commercial parameters |
| `GET` | `/api/admin/bookings`, `/api/admin/reports` | Ledger and reporting |

Errors come back as `{ "error": { "code", "message" } }` with a meaningful
status code.

## Lifecycle

```
REQUESTED → BROADCAST → ACCEPTED → CONFIRMED → ADDRESS_UNLOCKED
→ PROVIDER_EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED → PAYMENT_RELEASED
→ REVIEWED
```

Transitions are strictly linear — no skipping, no going backwards — with two
escapes: a booking may be `CANCELLED` any time before the provider arrives, and
`DISPUTED` after the work is done (for 24 hours after payment release). A
booking at the vendor's own premises skips `ADDRESS_UNLOCKED` and
`PROVIDER_EN_ROUTE`. `COMPLETED` needs three completion photos and
`PAYMENT_RELEASED` needs the customer's PIN, so neither can be set through the
generic status endpoint. Payment is released by the PIN, not by the review;
the review follows it. The NORMAL/EMERGENCY classification is set at
creation and never changes, so every booking stays reportable by type through to
payout.

The customer's address is withheld from the provider until `ADDRESS_UNLOCKED`.

---

## Open Marketplace Directory

How each feature in *GLAMNET Open Marketplace Directory v1.0* is covered.

### 1. Platform identity

| Spec | Where |
|---|---|
| Obsidian Black `#121212` canvas | `--glam-canvas` / `--glam-obsidian` in `globals.css`; dark is now the default theme (light remains available) |
| Champagne Gold `#D9B061` for CTAs, headlines, accents | `--glam-gold`, the metal CTA gradient, `--glam-champagne-500/700` |
| PWA manifest, `display: "standalone"` | `src/app/manifest.ts` (colours updated to obsidian) |

### 2A. Client directory — `/sheffield/salons`

| Spec | Where |
|---|---|
| 5-category hub grid, querying on click | `src/app/[city]/salons/page.tsx`; hubs defined in `src/lib/domain/specialty-hubs.ts` and stored as `Service.category` |
| Postcode sector filter, typed or geolocated, proximity sort | `sector-filter.tsx` + `src/lib/domain/postcode.ts` (Sheffield S-district centroids; coordinates never leave the browser) |
| Home salons / private rooms / chairs | `Provider.workspaceType`, `workspaceSector` |
| In-basket cross-sell (MUA/Bridal → dry-treatment nail overlay) | `crossSellFor()`; shown in the storefront basket, falling back to nearby nail vendors |

### 2B. Storefront — `/pro/:slug`

| Spec | Where |
|---|---|
| 3-image lookbook carousel | `ProviderLookbookImage`, `src/app/pro/[slug]/page.tsx` |
| Service menu with the vendor's own prices/durations, multi-select cart | `ProviderService.priceMinor/durationMinutes`, `storefront-booking.tsx` |
| Calendar matrix against real availability, no double bookings | `POST /api/pro/:slug/slots`; checkout re-checks under a per-vendor Postgres advisory lock |
| Read-only review log | read from the bookings themselves; `REVIEWED` is terminal |

### 2C. Pro Portal

| Spec | Where |
|---|---|
| Multi-step sign-up wizard | `/provider/onboarding` — profile, link & bio & socials, workspace, menu, lookbook, documents, payouts, submit |
| Certification upload gate (`accept="image/*,application/pdf"`) | `DocumentUpload`, stored as private ImageKit files; admins open them through 10-minute signed links; approval is refused with none on file |
| Unique landing link generator | `BioLink` on the dashboard and in the wizard |
| Weekly availability planner + vacation blocks | existing availability editor, plus a one-tap vacation toggle on the dashboard |

### 2D. Money

| Spec | Where |
|---|---|
| Rule A — direct link, 0% commission, minus 2% card fee | `src/lib/domain/settlement.ts` |
| Rule B — first marketplace booking with a vendor, 30%, vendor keeps 70% + 100% of tips; later bookings default to A | same; applied to storefront checkout and, per vendor, to the broadcast |
| Card pre-authorisation hold | `src/lib/server/payments.ts` — manual-capture PaymentIntent, Stripe Elements in `CardHold` |
| 4-digit PIN releases escrow | `src/lib/server/escrow.ts`; `POST /api/bookings/:id/release` |
| 24-hour dispute lockout → `closed_uncontestable` | `canDispute()`; button not rendered after the window, API refuses, daily cron writes the status |

The origin of a storefront booking is the `via=directory` marker the directory
adds to its links: a visit without it is a direct link. The customer pays the
same either way, so the marker only moves money between vendor and platform.

### 3. Flows

All three flows run end to end on the simulated gateway. Onboarding sets
`is_verified` (`Provider.isVerified`) when an admin approves a vendor with
documents on file, which is what puts the storefront and its calendar live.

### Decisions worth knowing

- **Additive, not a replacement.** The emergency broadcast flow is unchanged
  for customers; storefront booking sits alongside it. Emergency surcharges
  apply to storefront bookings inside the 12-hour window too.
- **Separate charges and transfers**, not destination charges: a broadcast
  is authorised before any vendor accepts, so there is no destination at
  checkout. On PIN release the hold is captured and the vendor's payout is
  transferred with `source_transaction`.
- **Rule B processing fee.** The spec deducts the 2% card fee under Rule A
  only. Under Rule B the platform absorbs it from its 30%.
- **Payment now releases on the PIN, not the review**, so the lifecycle order
  changed to `COMPLETED → PAYMENT_RELEASED → REVIEWED`.

## Not built

Scoped out deliberately, and worth naming so the gaps are not mistaken for
oversights:

- **Card holds on the broadcast checkout under real Stripe.** Storefront
  checkout collects a card with Stripe Elements. The older `/book` and
  `/search` confirm screens do not yet; they get a simulated hold only when
  Stripe is unconfigured.
- **Holds longer than 7 days.** Stripe expires uncaptured authorisations after
  about 7 days. A booking further out needs a saved card (SetupIntent) and an
  off-session authorisation nearer the date, which needs a scheduler.
- **Stripe webhooks.** Holds and payout status are read back from Stripe on
  return rather than pushed by webhook.
- **Real push notifications.** Notification records are written to the database
  (including "your checkout PIN is ready"), and the customer's booking page
  refreshes itself while a PIN is live, but there is no Web Push service
  worker, so nothing is pushed to a locked phone.
- **Dispute resolution.** A dispute is recorded and flagged to admins; refunds
  and clawbacks are handled by hand.
- **Offline support.** No service worker; the app is installable but needs a
  connection.
- **External calendar sync.** Explicitly out of scope per §14.

The seeded emergency surcharge (25%) is a placeholder pending the client's
commercial decision. Change it in the admin dashboard — it is configuration, not
code.
