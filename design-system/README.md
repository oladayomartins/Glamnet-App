# GlamNet design system

The implementation of **GlamNet Brand & UI Guide v1.2**, handed off from Claude Design.

This is not a picture of a design system — it's the real one. Every specimen on
the brand guide page is rendered by the same component the PWA imports, so the
guide cannot drift from what ships.

```bash
npm install
npm run dev        # brand guide at http://localhost:3000
npm run build
npm run typecheck
```

## What's here

| Path | What it is |
| --- | --- |
| `app/tokens.css` | **The source of truth for colour.** Framework-agnostic CSS variables, light + dark. |
| `app/globals.css` | Tailwind v4 theme bridge, type scale, motion keyframes, base layer. |
| `lib/tokens.ts` | Token tables behind the guide's CSS / Tailwind / JSON export panel. |
| `lib/booking.ts` | The domain constants the UI must state truthfully (720 min, 15 min, £0.50) plus money and countdown formatting. |
| `components/ui/` | Primitives — `Button`, `TextField`, `ChipGroup`, `Segmented`. |
| `components/brand/` | `GlamNetPin`, `Wordmark`, `Lockup`. |
| `components/booking/` | `DateStrip`, `SlotGrid`, `DurationSummary`, `PriceBreakdown`, `EmergencyNotice`, `BroadcastTicket`. |
| `components/calendar/` | `ProviderCalendar` — day view with the transition hatch. |
| `components/map/` | `ProximityMap`, `SectorMap`. |
| `components/status/` | `BookingTypeBadge`, `LifecycleChip`. |
| `components/guide/` | Page furniture for the guide itself. Not part of the app surface. |

## Consuming the tokens elsewhere

`app/tokens.css` has no build-step dependencies. Import it into any surface —
the PWA, the marketing site, an email preview harness — and you get both modes
from one variable set. The guide's export panel emits the same values as
`tokens.css`, a `tailwind.config.js` colour map, or `tokens.json`.

Theme switching is `data-theme` on the root element, driven by `next-themes`.
Never swap two stylesheets: one variable set, two values.

## Rules the code enforces

These come from the guide and are worth knowing before you extend anything:

- **Metal is never body text**, and never a border. It is a fill, reserved for
  the logo, the single primary action on a screen, selected states and totals.
- **`--gn-emergency` is emergency only.** Signal red never appears for generic
  errors. And emergency is never signalled by colour alone — the word
  EMERGENCY and the bolt icon travel with it, everywhere.
- **The booking *type* tag and the operational status are two fields.** They are
  never merged into one chip. An EMERGENCY booking keeps its red tag through
  every lifecycle state while the operational chip colour changes independently.
- **Booked time is service duration + a 15-minute transition block.** The hatch
  is drawn from the booking's own start/end times, never hand-placed, and is
  never hidden.
- **Only genuinely-live states pulse**, one pulsing element per screen.

## Implementation notes worth flagging

Three places where I did something other than copy the prototype exactly, and
why:

1. **Calendar geometry is computed, not hand-placed.** The prototype positioned
   each block by eye inside a 34px-per-hour grid, which left the 15:30 emergency
   request drawn against the 15:00 gridline. `ProviderCalendar` derives every
   block's offset and height from its `start`/`end`, so a calendar rendered from
   real bookings always agrees with the times printed inside it. Block sizes land
   within ~2px of the prototype; the 15:30 block correctly sits at half past.

   The one deliberate exception is `MIN_TRANSITION_HEIGHT`: 15 minutes is ~8px at
   this scale, too thin for the hatch to read as a hatch, so the transition block
   has a 14px legibility floor — which is what the prototype drew anyway.

2. **Tap targets meet the 44px floor the guide asserts.** Several controls are
   deliberately shorter than 44px because the visual rhythm depends on it —
   segmented pills (28px), service chips (40px), the theme toggle (33px), the
   surcharge slider. Padding them out would break the design; leaving them would
   break the promise in §03. The `.tap-44` utility in `globals.css` extends the
   hit area with an invisible overlay instead, so the visual box is unchanged.
   It grows vertically only, so it can't swallow taps meant for a neighbour.

3. **The design-tool tweak panel became real controls.** Token export format and
   the emergency surcharge were side-panel tweaks in Claude Design. On a shipped
   page they have to be visible, so the format switch lives in the export panel
   header and the surcharge is a labelled slider in §08. Every price on the page
   recalculates from it — the surcharge is admin-configurable by design and is
   never hard-coded.

## Verified

Checked against the built output, not just the source:

- Both themes render correctly across all 13 sections.
- No horizontal overflow at 390px, 1280px, or in between; layout reflows to a
  single column.
- Body text clears 4.5:1 in both modes (measured: 7.0:1–17.7:1 across hero
  copy, card body, captions, the emergency notice and totals).
- Every interactive control is ≥44px of tap target.
- Token export, surcharge slider, slot selection, theme toggle and the calendar
  Day/Week switch all work.

## Not in this package

Per the agreed scope, this is the guide and its components only. The booking
engine is not here: emergency classification, pricing and availability are
computed **server-side** (see §08 and the work scope) and arrive on the booking
record. The components render what they are given — a customer must never be
able to influence the classification.

`components.json` is configured for shadcn/ui, so `npx shadcn@latest add dialog`
(etc.) will drop new primitives into `components/ui/` already themed by these
tokens. Motion, Vaul, Sonner and MapLibre are recommended in §12 but not
installed — nothing in the guide needs them yet, and the CSS keyframes in
`globals.css` cover the specified pulse/float/shimmer.
