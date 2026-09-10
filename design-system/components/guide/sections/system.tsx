import {
  CalendarBlank,
  CalendarCheck,
  Check,
  Diamond,
  Lightning,
  NavigationArrow,
  Prohibit,
  Stack,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Section } from "@/components/guide/section";

export function MotionSection() {
  return (
    <Section
      id="motion"
      eyebrow="11 / Motion"
      title={'Soothing, not busy. Motion answers "is it working?"'}
    >
      <div className="mt-[22px] grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))]">
        <Card className="p-5">
          <div className="flex h-[68px] items-center justify-center">
            <div className="relative flex size-[52px] items-center justify-center rounded-full bg-rose-tint">
              <div className="absolute inset-0 animate-[gn-ring_3.2s_ease-out_infinite] rounded-full bg-rose opacity-[0.22]" />
              <div className="size-[13px] rounded-full bg-rose" />
            </div>
          </div>
          <div className="mt-2 text-[15px] font-bold">Pulse · searching</div>
          <div className="mt-1.5 font-mono text-[11px] text-text-2">
            3200ms · ease-out · infinite
          </div>
          <div className="mt-2 text-[13px] leading-[1.6] text-text-2">
            Broadcasting to providers, live map presence. One per screen.
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex h-[68px] items-center justify-center">
            <div className="flex animate-[gn-float_4.5s_ease-in-out_infinite] items-center gap-2 rounded-pill border border-line bg-surface-3 px-3 py-1.5 shadow-e2">
              <span className="size-[18px] rounded-full bg-rose" />
              <span className="text-xs font-semibold">Amara · 8 min</span>
            </div>
          </div>
          <div className="mt-2 text-[15px] font-bold">Float · map pins</div>
          <div className="mt-1.5 font-mono text-[11px] text-text-2">
            4500–6400ms · ease-in-out
          </div>
          <div className="mt-2 text-[13px] leading-[1.6] text-text-2">
            6px travel maximum. Stagger siblings by 600ms.
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex h-[68px] items-center justify-center">
            <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-3">
              <div className="shimmer-overlay-bright h-full w-[45%] animate-shimmer rounded-pill bg-rose" />
            </div>
          </div>
          <div className="mt-2 text-[15px] font-bold">Shimmer · pending</div>
          <div className="mt-1.5 font-mono text-[11px] text-text-2">
            1400ms · linear · infinite
          </div>
          <div className="mt-2 text-[13px] leading-[1.6] text-text-2">
            Skeletons and in-flight actions. The highlight is champagne — it
            doubles as the brand&rsquo;s metal cue.
          </div>
        </Card>

        <Card tone="surface-1" className="p-5">
          <div className="text-[15px] font-bold text-gold-text">Durations</div>
          <div className="mt-3 grid gap-2 font-mono text-xs text-text-1">
            <div>120ms — press / toggle</div>
            <div>180ms — hover, chip select</div>
            <div>240ms — sheet, accordion</div>
            <div>320ms — screen &amp; theme transition</div>
            <div>ease: cubic-bezier(.22,.61,.36,1)</div>
          </div>
          <div className="mt-3.5 text-[13px] leading-[1.6] text-text-2">
            No bounce, no spin, no confetti. Emergency states pulse slower than
            normal ones — urgency is in the colour and copy, not the frame rate.
            Honour <span className="font-mono">prefers-reduced-motion</span>{" "}
            everywhere.
          </div>
        </Card>
      </div>
    </Section>
  );
}

const stackGroups = [
  {
    Icon: Stack,
    title: "Core",
    items: [
      {
        name: "shadcn/ui",
        body: "components as source you own. Themed by CSS variables, which is exactly how the token table above is written.",
      },
      {
        name: "Radix Primitives",
        body: "accessible dialog, popover, tabs, sheet. Keyboard and focus behaviour handled.",
      },
      {
        name: "Tailwind CSS v4",
        body: "token-first utilities; light/dark from one variable set.",
      },
      {
        name: "next-themes",
        body: "data-theme switching with no flash on load.",
        mono: "data-theme",
      },
    ],
  },
  {
    Icon: Diamond,
    title: "Premium layer",
    items: [
      {
        name: "Phosphor Icons",
        body: "6 weights; Light is the house weight. Replaces the default outline set that ships with shadcn.",
      },
      {
        name: "Motion (ex-Framer Motion)",
        body: "the pulse/float/shimmer specs in §11, plus shared-layout screen transitions.",
      },
      {
        name: "Vaul",
        body: "the drag-to-dismiss bottom sheet the booking flow needs on mobile.",
      },
      {
        name: "Sonner",
        body: "toasts for accept/decline and payment states.",
      },
    ],
  },
  {
    Icon: CalendarCheck,
    title: "Domain pieces",
    items: [
      {
        name: "Temporal / date-fns-tz",
        body: "notice-period maths must be timezone-correct and server-side.",
      },
      {
        name: "MapLibre GL",
        body: "+ custom style JSON — the two basemaps in §09 without vendor branding.",
      },
      {
        name: "Custom calendar",
        body: "build day/week on a CSS grid. Off-the-shelf calendars won't render the 15-minute transition block cleanly.",
      },
      {
        name: "TanStack Query",
        body: "broadcast countdowns and provider availability polling.",
      },
    ],
  },
];

export function StackSection() {
  return (
    <Section
      id="stack"
      eyebrow="12 / Recommended stack"
      title="shadcn/ui on Radix — own the code, not a theme."
      lede={
        <>
          This is the stack most YC-backed consumer products ship on, and the
          reason is not fashion: shadcn/ui is copy-in source, so these tokens
          live in your repo instead of fighting a vendor theme. Everything below
          is chosen to survive the emergency-state and calendar work in the
          scope.
        </>
      }
    >
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
        {stackGroups.map((group) => (
          <Card key={group.title} className="p-5">
            <div className="flex items-center gap-[9px] text-[15px] font-bold">
              <group.Icon size={22} weight="light" className="text-rose" />{" "}
              {group.title}
            </div>
            <div className="mt-3.5 grid gap-3 text-[13px] leading-[1.6] text-text-2">
              {group.items.map((item) => (
                <div key={item.name}>
                  <span className="font-semibold text-text-1">{item.name}</span>{" "}
                  —{" "}
                  {item.mono ? (
                    <>
                      <span className="font-mono text-xs">{item.mono}</span>
                      {item.body.replace(item.mono, "")}
                    </>
                  ) : (
                    item.body
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 rounded-card border border-line bg-rose-tint px-5 py-[18px] text-[13px] leading-[1.7] text-rose-ink">
        <strong>Avoid:</strong> Material UI or Chakra — their opinions fight a
        bespoke luxury palette, and their calendar components can&rsquo;t
        express the transition buffer. Avoid any icon set with mixed stroke
        weights, and avoid theme-switching by swapping two stylesheets: one
        variable set, two values.
      </div>
    </Section>
  );
}

const notifications = [
  {
    Icon: Lightning,
    iconClass: "bg-emergency text-emergency-on",
    title: "EMERGENCY BOOKING REQUEST",
    body: "Prom Updo + Makeup · 6:00 PM · S11 · £118. Accept within 5 min.",
  },
  {
    Icon: CalendarBlank,
    iconClass: "bg-metal text-metal-ink",
    title: "Amara accepted your booking",
    body: "Tuesday 15 Sep, 12:00–2:00 PM. We'll share your address closer to the time.",
  },
  {
    Icon: NavigationArrow,
    iconClass: "bg-live text-[oklch(0.16_0.02_165)]",
    title: "Amara is on the way",
    body: "Arriving in about 8 minutes. Tap to follow on the map.",
  },
];

export function VoiceSection() {
  return (
    <Section
      id="voice"
      eyebrow="13 / Voice, tone & notifications"
      title="Warm to customers. Blunt to providers."
    >
      <div className="mt-[22px] grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr))]">
        <Card>
          <div className="grid gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-live-ink">
                <Check size={14} /> SAY
              </div>
              <div className="mt-1.5 text-[15px] leading-[1.6]">
                &ldquo;Your appointment is within 12 hours, so the emergency rate
                applies. Here&rsquo;s the full price before you pay.&rdquo;
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emergency-ink">
                <Prohibit size={14} /> DON&rsquo;T SAY
              </div>
              <div className="mt-1.5 text-[15px] leading-[1.6] text-text-2">
                &ldquo;Surge pricing in effect!&rdquo; · &ldquo;Oops! Something
                went wrong&rdquo; · &ldquo;Book now before it&rsquo;s too
                late!!&rdquo;
              </div>
            </div>
            <div className="border-t border-line pt-4 text-[13px] leading-[1.8] text-text-1">
              Plain British English. Second person. No exclamation marks, no
              emoji, no pressure tactics. Money always as £ with two decimals.
              Times as 24-hour in the provider app, 12-hour for customers. Never
              say &ldquo;surge&rdquo; to a customer — say &ldquo;emergency
              rate&rdquo;.
            </div>
          </div>
        </Card>

        <div className="grid content-start gap-3">
          {notifications.map((notification) => (
            <div
              key={notification.title}
              className="flex gap-3 rounded-2xl border border-line bg-surface-3 p-4 shadow-e2"
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${notification.iconClass}`}
              >
                <notification.Icon size={18} />
              </div>
              <div>
                <div className="text-[13px] font-bold">
                  {notification.title}
                </div>
                <div className="mt-[3px] text-[13px] leading-[1.5] text-text-2">
                  {notification.body}
                </div>
              </div>
            </div>
          ))}
          <div className="font-mono text-[11px] leading-[1.7] text-text-3">
            Push titles ≤ 40 chars · bodies ≤ 110 chars · emergency pushes
            always lead with the word EMERGENCY.
          </div>
        </div>
      </div>
    </Section>
  );
}

export function GuideFooter() {
  return (
    <footer className="mt-[88px] flex flex-wrap justify-between gap-3.5 border-t border-line pt-[26px] font-mono text-[11px] text-text-3">
      <div>
        GLAMNET · brand &amp; UI guide v1.2 · obsidian + rose gold / champagne ·
        light &amp; dark
      </div>
      <div>Threshold 720 min · buffer 15 min · surcharge configurable</div>
    </footer>
  );
}
