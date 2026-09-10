# GLAMNET

A PWA marketplace for at-home beauty services, built around the booking,
calendar and emergency requirements in
*GLAMNET — Updated Booking, Calendar & Emergency Work Requirements*.

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
| Tests | Vitest — 65 unit tests over the booking engine |

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
| `/provider/[id]` | Broadcast inbox + day/week calendar |
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
→ PROVIDER_EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED → REVIEWED
→ PAYMENT_RELEASED
```

Transitions are strictly linear — no skipping, no going backwards — with two
escapes: a booking may be `CANCELLED` any time before the provider arrives, and
`DISPUTED` after the work is done. The NORMAL/EMERGENCY classification is set at
creation and never changes, so every booking stays reportable by type through to
payout.

The customer's address is withheld from the provider until `ADDRESS_UNLOCKED`.

---

## Not built

Scoped out deliberately, and worth naming so the gaps are not mistaken for
oversights:

- **Authentication.** There are no accounts or sessions; the provider and
  customer pickers stand in for a signed-in user. Every route is currently
  unauthenticated, including the admin ones.
- **Stripe.** The journey has a pre-authorisation step in the right place, but
  no payment provider is wired in. `POST /api/bookings` is where the
  authorisation call belongs.
- **Real push notifications.** Notification records are written to the database
  with the emergency tag so the copy is consistent across channels, but nothing
  delivers them.
- **Reference image upload.** The flow takes a URL rather than hosting a file.
- **Offline support.** No service worker; the app is installable but needs a
  connection.
- **External calendar sync.** Explicitly out of scope per §14.

The seeded emergency surcharge (25%) is a placeholder pending the client's
commercial decision. Change it in the admin dashboard — it is configuration, not
code.
