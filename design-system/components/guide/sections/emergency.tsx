"use client";

import { useState } from "react";
import {
  CheckCircle,
  LockSimple,
  Star,
  Wallet,
} from "@phosphor-icons/react/dist/ssr";
import { Card, CardLabel, Section } from "@/components/guide/section";
import { RangeControl } from "@/components/guide/range-control";
import { Button } from "@/components/ui/button";
import { BroadcastTicket } from "@/components/booking/broadcast-ticket";
import { EmergencyNotice } from "@/components/booking/emergency-notice";
import { PriceBreakdown } from "@/components/booking/price-breakdown";
import { BookingTypeBadge } from "@/components/status/booking-type-badge";
import {
  LifecycleChip,
  type LifecycleTone,
} from "@/components/status/lifecycle-chip";
import { ProviderCalendar } from "@/components/calendar/provider-calendar";
import { SectorMap } from "@/components/map/proximity-map";
import { formatCountdown, TRUST_FEE } from "@/lib/booking";
import { useTicker } from "@/lib/use-ticker";

const SERVICES_TOTAL = 165;
const TRAVEL_FEE = 8;

export function EmergencySection() {
  const [surchargePct, setSurchargePct] = useState(20);
  const { secondsLeft, acceptProgress } = useTicker();

  const surcharge = (SERVICES_TOTAL * surchargePct) / 100;
  const normalTotal = SERVICES_TOTAL + TRAVEL_FEE + TRUST_FEE;
  const emergencyTotal = normalTotal + surcharge;

  return (
    <Section
      id="emergency"
      eyebrow="08 / Emergency vs normal"
      eyebrowTone="emergency"
      title="One rule, one colour, one word."
      lede={
        <>
          Notice ≤ 720 minutes → <strong>EMERGENCY</strong>. Computed
          server-side at creation, stored on the booking, immutable. Signal red
          + bolt + the literal word EMERGENCY travel together everywhere:
          checkout, broadcast, calendar, push, ledger, admin. Red never appears
          for any other purpose — that is why it works.
        </>
      }
    >
      <RangeControl
        label="Emergency surcharge"
        value={surchargePct}
        min={5}
        max={50}
        step={5}
        unit="%"
        onChange={setSurchargePct}
        className="mb-[18px] w-fit"
      />

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        {/* Normal checkout */}
        <div className="overflow-hidden rounded-card border border-line bg-surface-2">
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-[18px] py-4">
            <BookingTypeBadge tag="NORMAL" size="sm" />
            <span className="text-[13px] text-text-2">
              Notice 13h 00m · standard rate
            </span>
          </div>
          <div className="p-[18px]">
            <PriceBreakdown
              totalSize={20}
              total={normalTotal}
              lines={[
                { label: "Services + add-ons", amount: SERVICES_TOTAL },
                { label: "Travel fee", amount: TRAVEL_FEE },
                { label: "Trust fee", amount: TRUST_FEE },
              ]}
            />
            <Button variant="metal" className="mt-4">
              Confirm booking
            </Button>
          </div>
        </div>

        {/* Emergency checkout */}
        <div className="overflow-hidden rounded-card border-[1.5px] border-emergency bg-surface-2 shadow-e2">
          <EmergencyNotice />
          <div className="p-[18px]">
            <PriceBreakdown
              emergency
              totalSize={20}
              total={emergencyTotal}
              lines={[
                { label: "Services + add-ons", amount: SERVICES_TOTAL },
                { label: "Travel fee", amount: TRAVEL_FEE },
                {
                  label: `Emergency · ${surchargePct}%`,
                  amount: surcharge,
                  emergency: true,
                },
                { label: "Trust fee", amount: TRUST_FEE },
              ]}
            />
            <Button variant="emergency" className="mt-4">
              Confirm emergency booking
            </Button>
            <div className="mt-2.5 text-center text-[11px] leading-[1.5] text-text-3">
              Surcharge is admin-configurable — never hard-code the rate.
            </div>
          </div>
        </div>

        <BroadcastTicket
          appointment="Today, 6:00 PM · notice 4h 35m"
          services="Prom Updo + Glam Makeup"
          duration="2h 00m + 15m transition"
          sector="Sector S11"
          earnings={118}
          surge={22}
          countdown={formatCountdown(secondsLeft)}
          progress={acceptProgress}
        />
      </div>

      <div className="mt-[18px] overflow-x-auto rounded-card border border-line bg-surface-1 p-5">
        <CardLabel className="mb-3">Classification contract</CardLabel>
        <pre className="m-0 font-mono text-xs leading-[1.8] text-text-1">
          {`notice_period_minutes = appointment_start_at − booking_created_at
booking_type = notice_period_minutes <= 720 ? "EMERGENCY" : "NORMAL"   // server-side only
eligibility  = provider_free(appointment_start_at, duration + 15min)     // same rule for both types`}
        </pre>
      </div>
    </Section>
  );
}

export function CalendarSection() {
  return (
    <Section
      eyebrow="09 / Calendar & map"
      title="The 15 minutes after a job are part of the job."
      lede={
        <>
          Booked time is always drawn as service block + hatched transition
          block. The hatch is the visual signature of GlamNet&rsquo;s
          availability engine — never hide it.
        </>
      }
    >
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr))]">
        <ProviderCalendar
          date="Tue 15 Sep"
          events={[
            {
              id: "booking-1",
              start: "12:00",
              end: "14:00",
              title: "Prom Updo + Makeup",
              subtitle: "12:00–14:00 · Sector S11",
              kind: "service",
              transition: true,
            },
            {
              id: "emergency-request",
              start: "15:30",
              end: "17:00",
              title: "EMERGENCY · 15:30",
              subtitle: "Needs 15:30–17:15 — conflicts, not eligible",
              kind: "emergency",
            },
            {
              id: "blocked-1",
              start: "17:00",
              end: "17:45",
              title: "Unavailable — provider blocked",
              kind: "blocked",
            },
          ]}
        />

        <Card className="grid content-start gap-4 p-[18px]">
          <CardLabel>Map component rules</CardLabel>
          <SectorMap />
          <ul className="m-0 list-disc pl-[18px] text-sm leading-[1.8] text-text-1">
            <li>
              Custom basemap in both modes — obsidian/graphite dark, warm paper
              light. No satellite imagery.
            </li>
            <li>
              Customer pin = metal teardrop. Providers = rose gold dots.
              Live/en-route = jade with a slow pulse.
            </li>
            <li>
              Exact addresses only render after <strong>Address Unlocked</strong>
              ; before that show the sector shape, never a house.
            </li>
            <li>One pulsing element per map. More than one reads as an alarm.</li>
          </ul>
        </Card>
      </div>
    </Section>
  );
}

const lifecycle: Array<{
  label: string;
  tone?: LifecycleTone;
  pulse?: boolean;
  icon?: React.ReactNode;
}> = [
  { label: "Requested" },
  { label: "Broadcast" },
  { label: "Accepted", tone: "committed" },
  { label: "Confirmed", tone: "committed" },
  { label: "Address unlocked", icon: <LockSimple size={14} /> },
  { label: "Provider en route", tone: "live", pulse: true },
  { label: "Arrived", tone: "live" },
  { label: "In progress", tone: "live", pulse: true },
  { label: "Completed", icon: <CheckCircle size={14} /> },
  { label: "Reviewed", icon: <Star size={14} /> },
  { label: "Payment released", tone: "money", icon: <Wallet size={14} /> },
];

export function StatusSection() {
  return (
    <Section
      eyebrow="10 / Status & lifecycle"
      title="Type tag + operational status. Two fields, never merged."
    >
      <div className="mt-5 mb-[22px] flex flex-wrap gap-2">
        <BookingTypeBadge tag="NORMAL" />
        <BookingTypeBadge tag="EMERGENCY" />
        <BookingTypeBadge tag="DISPUTED" />
        <BookingTypeBadge tag="CANCELLED" />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {lifecycle.map((step) => (
            <LifecycleChip key={step.label} {...step} />
          ))}
        </div>
        <div className="mt-[18px] max-w-[70ch] text-[13px] leading-[1.7] text-text-2">
          Neutral = pending, rose gold = committed, jade = live/in-person, metal
          = money moved. Only the two live states pulse. An EMERGENCY booking
          keeps its red type tag through every one of these — the operational
          chip colour does not change.
        </div>
      </Card>
    </Section>
  );
}
