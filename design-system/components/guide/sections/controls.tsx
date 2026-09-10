"use client";

import { useState } from "react";
import { ImageSquare, Lightning, MapPin } from "@phosphor-icons/react/dist/ssr";
import { Card, CardLabel, Section } from "@/components/guide/section";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { TextField } from "@/components/ui/text-field";
import { DateStrip } from "@/components/booking/date-strip";
import { SlotGrid, SlotLegend } from "@/components/booking/slot-grid";
import { DurationSummary } from "@/components/booking/duration-summary";
import { PriceBreakdown } from "@/components/booking/price-breakdown";

const serviceChips = [
  { value: "hair", label: "Hair" },
  { value: "makeup", label: "Makeup" },
  { value: "nails", label: "Nails · full", disabled: true },
];

export function ControlsSection() {
  const [services, setServices] = useState<string[]>(["makeup"]);

  return (
    <Section
      id="components"
      eyebrow="06 / Buttons, inputs & states"
      title="Every control, every state, 44px tall."
    >
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <Card className="grid content-start gap-3">
          <CardLabel>Buttons</CardLabel>
          <Button variant="metal">Confirm &amp; pre-authorise</Button>
          <Button variant="emergency">
            <Lightning size={17} /> Accept emergency booking
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button disabled>Disabled · no providers free</Button>
          <Button variant="pending">Broadcasting…</Button>
          <div className="text-xs leading-[1.6] text-text-3">
            Focus ring 2px champagne, offset 2px. Press: scale .98 / 120ms.
            Metal is reserved for the single primary action on a screen.
          </div>
        </Card>

        <Card className="grid content-start gap-4">
          <CardLabel>Inputs</CardLabel>
          <TextField
            label="Postcode"
            value="S11 8YZ"
            muted
            icon={<MapPin size={17} />}
          />
          <TextField label="Focused" value="Prom updo" state="focused" />
          <TextField
            label="Error"
            value="—"
            state="error"
            error="We don't cover this sector yet"
          />
          <ChipGroup
            ariaLabel="Services"
            options={serviceChips}
            value={services}
            onValueChange={setServices}
          />
          <div className="flex items-center justify-between gap-3 border-t border-line pt-3.5">
            <div className="text-sm font-semibold">Add reference photo</div>
            <button
              type="button"
              aria-label="Add reference photo"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-rose transition-colors duration-[180ms] ease-gn hover:border-rose"
            >
              <ImageSquare size={20} weight="light" />
            </button>
          </div>
        </Card>
      </div>
    </Section>
  );
}

const dates = [
  { value: "2026-09-14", weekday: "Mon", day: "14" },
  { value: "2026-09-15", weekday: "Tue", day: "15" },
  { value: "2026-09-16", weekday: "Wed", day: "16" },
  { value: "2026-09-17", weekday: "Thu", day: "17", unavailable: true },
];

const slots = [
  { value: "09:00", label: "09:00" },
  { value: "11:30", label: "11:30" },
  { value: "12:00", label: "12:00" },
  { value: "18:00", label: "18:00", emergency: true },
  { value: "14:00", label: "14:00", unavailable: true },
  { value: "15:30", label: "15:30", unavailable: true },
];

const priceLines = [
  { label: "Prom Updo", amount: 85 },
  { label: "Glam Makeup", amount: 65 },
  { label: "Premium add-on · lashes", amount: 15 },
  { label: "Travel fee · S11", amount: 8 },
  { label: "Trust fee", amount: 0.5 },
];

export function BookingFlowSection() {
  const [date, setDate] = useState("2026-09-15");
  const [slot, setSlot] = useState("12:00");

  const total = priceLines.reduce((sum, line) => sum + line.amount, 0);

  return (
    <Section
      eyebrow="07 / Booking flow components"
      title="Date, time, duration, price — in that order, always."
      lede={
        <>
          The customer must see service duration and the full price — including
          any emergency surcharge — <strong>before</strong> the Stripe
          pre-authorisation. No surprises after submit.
        </>
      }
    >
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <Card className="p-[18px]">
          <CardLabel className="mb-3.5">Date strip · time slots</CardLabel>
          <DateStrip dates={dates} value={date} onValueChange={setDate} />
          <SlotGrid
            slots={slots}
            value={slot}
            onValueChange={setSlot}
            className="mt-3.5"
          />
          <SlotLegend className="mt-3.5" />
        </Card>

        <Card className="p-[18px]">
          <CardLabel className="mb-3.5">Duration &amp; price breakdown</CardLabel>
          <DurationSummary
            serviceDuration="2h 00m"
            blockedWindow="12:00–14:15"
          />
          <PriceBreakdown
            lines={priceLines}
            total={total}
            className="mt-4"
          />
          <div className="mt-3.5 text-xs leading-[1.6] text-text-3">
            Line items are never collapsed. Surcharges are always named. Totals
            sit in champagne — the only place money takes brand colour.
          </div>
        </Card>
      </div>
    </Section>
  );
}
