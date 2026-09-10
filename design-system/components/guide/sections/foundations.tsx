import { Eye, Prohibit } from "@phosphor-icons/react/dist/ssr";
import { GlamNetPin, Lockup } from "@/components/brand/logo";
import { Card, CardLabel, Section } from "@/components/guide/section";
import { RampSwatch, Swatch } from "@/components/guide/swatch";
import { TokenExport } from "@/components/guide/token-export";
import { IconGrid } from "@/components/guide/icon-grid";

export function BrandMarksSection() {
  return (
    <Section
      id="foundations"
      className="pt-[88px]"
      eyebrow="01 / Brand marks"
      title="The mark is a pin that became a beauty dot."
      lede={
        <>
          Location is the product. The mark is a map pin with a soft centre —
          the meeting point of a provider and a customer. The metallic fill runs
          135°, champagne into rose gold. Never rotate, outline, re-gradient or
          re-letter it.
        </>
      }
    >
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr))]">
        <Card className="flex flex-col items-start gap-[18px] p-6">
          <Lockup pinSize={36} wordSize={22} />
          <CardLabel>Primary lockup</CardLabel>
        </Card>

        <div className="flex flex-col items-start gap-[18px] rounded-card bg-metal p-6 text-metal-ink">
          <Lockup pinSize={36} wordSize={22} variant="obsidian" />
          <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-[oklch(0.34_0.03_45)]">
            Reverse · on metal
          </div>
        </div>

        <Card className="flex flex-col items-start gap-[18px] p-6">
          <div className="flex items-center gap-3">
            {/* The tile is fixed obsidian in both modes, so the counter dot is
                pinned to obsidian too rather than following --gn-pin-inner. */}
            <div className="flex size-[42px] items-center justify-center rounded-tile bg-[oklch(0.165_0.008_285)]">
              <GlamNetPin
                size={19}
                dotClassName="bg-[oklch(0.165_0.008_285)]"
              />
            </div>
            <div className="flex size-[42px] items-center justify-center rounded-full bg-rose-tint">
              <GlamNetPin size={17} variant="rose" />
            </div>
          </div>
          <CardLabel>App icon · avatar fallback</CardLabel>
        </Card>

        <Card tone="emergency" className="flex flex-col gap-2.5 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-emergency-ink">
            <Prohibit size={16} /> Never
          </div>
          <ul className="m-0 list-disc pl-[18px] text-[13px] leading-[1.7] text-emergency-ink">
            <li>Flatten the metal to a single pink</li>
            <li>Place the lockup on a busy photo</li>
            <li>Use &ldquo;Glamnet&rdquo; or &ldquo;Glam Net&rdquo; in UI</li>
            <li>Add a tagline inside the lockup</li>
          </ul>
        </Card>
      </div>

      <div className="mt-3.5 font-mono text-[11px] leading-[1.6] text-text-2">
        Clear space = height of the pin on all sides · minimum lockup width 96px
        · minimum icon 32px
      </div>
    </Section>
  );
}

/* The obsidian, rose and champagne chips are fixed brand values rather than
   themed tokens, so they render the same in both modes — that is the point of
   a brand swatch. */
const swatches = [
  {
    name: "Obsidian 950",
    variable: "--gn-obsidian",
    value: "oklch(.165 .008 285)",
    usage: "Dark ground, reverse logo plate",
    swatchClassName: "bg-[oklch(0.165_0.008_285)]",
  },
  {
    name: "Metal gradient",
    variable: "--gn-metal",
    value: "135° champagne → rose",
    usage: "Logo, primary action, selected",
    swatchClassName: "bg-metal",
  },
  {
    name: "Rose gold",
    variable: "--gn-rose",
    value: ".80 / .55 L per mode",
    usage: "Links, active nav, accents",
    swatchClassName: "bg-[oklch(0.74_0.085_30)]",
  },
  {
    name: "Champagne",
    variable: "--gn-champagne",
    value: "oklch(.86 .065 88)",
    usage: "Highlights, totals, gradient stop",
    swatchClassName: "bg-[oklch(0.86_0.065_88)]",
  },
  {
    name: "Signal red",
    variable: "--gn-emergency",
    value: "oklch(.62 .21 22)",
    usage: "EMERGENCY, surge, countdown",
    swatchClassName: "bg-emergency",
  },
  {
    name: "Jade",
    variable: "--gn-live",
    value: "oklch(.72 .12 165)",
    usage: "Confirmed, en route, payout",
    swatchClassName: "bg-live",
  },
];

const ramp = [
  { label: "bg", swatchClassName: "bg-bg" },
  { label: "surface-1", swatchClassName: "bg-surface-1" },
  { label: "surface-3", swatchClassName: "bg-surface-3" },
  { label: "line", swatchClassName: "bg-line" },
  { label: "text-2", swatchClassName: "bg-text-2" },
  { label: "text-1", swatchClassName: "bg-text-1" },
];

export function ColourSection() {
  return (
    <Section
      eyebrow="02 / Colour & tokens"
      title="Obsidian holds the app. Metal is the brand. Red is the alarm."
      lede={
        <>
          Every colour is a CSS variable with a light and a dark value — the app
          ships both modes from one token set. Metal appears only on brand
          moments and the single primary action. Signal red is{" "}
          <strong>emergency only</strong>. Jade means live/confirmed.
        </>
      }
    >
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))]">
        {swatches.map((swatch) => (
          <Swatch key={swatch.name} {...swatch} />
        ))}
      </div>

      <div className="mt-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,86px),1fr))]">
        {ramp.map((step) => (
          <RampSwatch key={step.label} {...step} />
        ))}
      </div>

      <div className="mt-[22px]">
        <TokenExport />
      </div>
    </Section>
  );
}

const specimens = [
  {
    sample: "Prom Updo",
    spec: "display / 40 / 700 / -4% — screen titles",
    className:
      "text-[clamp(30px,4vw,40px)] leading-[1.05] tracking-[-0.04em] font-bold",
  },
  {
    sample: "Select date & time",
    spec: "h1 / 26 / 700 / -3%",
    className: "text-[25px] leading-[1.2] tracking-[-0.03em] font-bold",
  },
  {
    sample: "Your provider is 8 minutes away",
    spec: "h2 / 19 / 600",
    className: "text-[19px] leading-[1.3] font-semibold",
  },
  {
    sample:
      "Bookings placed within 12 hours of the appointment are treated as emergency requests and priced at the emergency rate.",
    spec: "body / 15 / 400 / 1.6 — never below 15px in the PWA",
    className: "text-[15px] leading-[1.6] text-text-1",
  },
  {
    sample: "Includes 15-minute provider transition period",
    spec: "caption / 13 / 400",
    className: "text-[13px] leading-[1.5] text-text-2",
  },
];

export function TypographySection() {
  return (
    <Section
      eyebrow="03 / Typography"
      title="Instrument Sans for everything human. JetBrains Mono for everything exact."
    >
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]">
        <Card>
          <div className="grid gap-[18px]">
            {specimens.map((specimen) => (
              <div key={specimen.spec}>
                <div className={specimen.className}>{specimen.sample}</div>
                <div className="mt-1.5 font-mono text-[11px] text-text-3">
                  {specimen.spec}
                </div>
              </div>
            ))}
            <div>
              <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase text-gold-text">
                Sector S11 · Notice 4h 35m
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-text-3">
                meta / mono 11 / +10% caps — ids, timers, sectors
              </div>
            </div>
          </div>
        </Card>

        <div className="grid content-start gap-[18px]">
          <Card>
            <div className="mb-3 text-[15px] font-bold">Rules</div>
            <ul className="m-0 list-disc pl-[18px] text-sm leading-[1.8] text-text-1">
              <li>Two families only. No third font, ever.</li>
              <li>
                Never set body copy in rose gold or champagne — metal is for one
                word, a number, or an icon.
              </li>
              <li>
                Sentence case everywhere except status tags, which are
                UPPERCASE.
              </li>
              <li>Max 60 characters per line on body copy.</li>
              <li>
                Tabular numbers for anything that ticks:{" "}
                <span data-numeric className="font-mono">
                  04:35
                </span>
                .
              </li>
            </ul>
          </Card>

          <Card tone="rose">
            <div className="mb-2 flex items-center gap-2 text-[15px] font-bold text-rose-ink">
              <Eye size={17} /> Accessibility floor
            </div>
            <div className="text-sm leading-[1.7] text-rose-ink">
              Body text ≥ 4.5:1 in both modes — that&rsquo;s why text is never
              rose gold. Tap targets ≥ 44×44px. Emergency state must never be
              signalled by colour alone: always the word EMERGENCY plus the bolt
              icon.
            </div>
          </Card>
        </div>
      </div>
    </Section>
  );
}

const spacingSteps = [
  { size: 4, label: "4 · hairline gaps" },
  { size: 8, label: "8 · icon → label" },
  { size: 12, label: "12 · inside chips" },
  { size: 16, label: "16 · card padding, gutter" },
  { size: 24, label: "24 · card → card" },
  { size: 32, label: "32 · section rhythm" },
  { size: 48, label: "48 · screen top / bottom" },
];

const radii = [
  { radius: 6, label: "6" },
  { radius: 12, label: "12" },
  { radius: 18, label: "18" },
  { radius: 999, label: "pill" },
];

export function SpaceSection() {
  return (
    <Section eyebrow="04 / Space, grid & radii" title="4-point scale. 16px gutters. Soft corners.">
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]">
        <Card>
          <CardLabel className="mb-4">Spacing</CardLabel>
          <div className="grid gap-2.5">
            {spacingSteps.map((step) => (
              <div key={step.size} className="flex items-center gap-3">
                <div
                  className="h-[18px] shrink-0 bg-rose"
                  style={{ width: step.size }}
                />
                <span className="font-mono text-xs">{step.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardLabel className="mb-4">Radii &amp; elevation</CardLabel>
          <div className="flex flex-wrap gap-2.5">
            {radii.map((r) => (
              <div
                key={r.label}
                className="flex size-[68px] items-end justify-center bg-rose-tint pb-1.5 font-mono text-[10px] text-rose-ink"
                style={{ borderRadius: r.radius }}
              >
                {r.label}
              </div>
            ))}
          </div>
          <div className="mt-4 text-[13px] leading-[1.7] text-text-2">
            6 inputs · 12 tiles &amp; slots · 18 cards &amp; sheets · pill for
            every button and tag.
          </div>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="flex h-[60px] flex-1 basis-[100px] items-center justify-center rounded-tile border border-line bg-surface-1 font-mono text-[10px]">
              e1 · card
            </div>
            <div className="flex h-[60px] flex-1 basis-[100px] items-center justify-center rounded-tile bg-surface-3 font-mono text-[10px] shadow-e2">
              e2 · sheet
            </div>
            <div className="flex h-[60px] flex-1 basis-[100px] items-center justify-center rounded-tile bg-surface-3 font-mono text-[10px] shadow-e3">
              e3 · modal
            </div>
          </div>
          <div className="mt-3 text-xs leading-[1.6] text-text-3">
            In dark mode elevation is carried by surface lightness first, shadow
            second. In light mode it&rsquo;s the reverse.
          </div>
        </Card>
      </div>
    </Section>
  );
}

export function IconsSection() {
  return (
    <Section
      eyebrow="05 / Icons — Phosphor"
      title="Phosphor Light at 20px. Regular only when it must carry weight."
      lede={
        <>
          Phosphor&rsquo;s Light weight is the house look — thinner and more
          editorial than the default outline sets, which is what makes it read
          premium rather than generic. One weight per screen. Icons never appear
          without a label except in the tab bar and icon-only 44px controls.
        </>
      }
    >
      <IconGrid />
    </Section>
  );
}
