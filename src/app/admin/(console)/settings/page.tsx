import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/auth/session";
import { getActiveEmergencyConfig } from "@/lib/server/emergency-config";
import { isImageKitConfigured } from "@/lib/imagekit";
import { describeSurcharge, formatDuration } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";
import { AdminHeader } from "../_components/bits";
import { EmergencyConfigForm } from "./config-form";
import { FeeRatesForm } from "./fee-rates-form";
import { feeConfigHistory, getFeeConfig } from "@/lib/server/fee-config";
import { DEFAULT_FEE_RATES, FEE_RATE_KEYS, FEE_RATE_LABELS, feeRatesFrom, formatRate, percent } from "@/lib/domain/fee-rates";
import { formatDayTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

/** Platform settings and the health of each outside service. */
export default async function AdminSettingsPage() {
  await requireRole("ADMIN", "/admin/settings");
  const [config, fees, feeHistory] = await Promise.all([getActiveEmergencyConfig(), getFeeConfig(), feeConfigHistory(8)]);

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const integrations = [
    {
      name: "Payments (Stripe)",
      ok: Boolean(stripeKey),
      detail: stripeKey
        ? stripeKey.startsWith("sk_live_")
          ? "Live mode: real cards are charged."
          : "Test mode: no real money moves."
        : "Not set: checkouts use the simulated gateway.",
    },
    {
      name: "Media (ImageKit)",
      ok: isImageKitConfigured() && Boolean(process.env.IMAGEKIT_PRIVATE_KEY),
      detail: "Photos, lookbooks, ad images and documents.",
    },
    {
      name: "Email (Resend)",
      ok: Boolean(process.env.RESEND_API_KEY),
      detail: "Booking emails, approvals and campaign sends.",
    },
    {
      name: "Scheduled jobs",
      ok: Boolean(process.env.CRON_SECRET),
      detail: "Closes 24-hour dispute windows so vendors get paid.",
    },
  ];

  return (
    <div className="space-y-8">
      <AdminHeader title="Settings" lede="Commercial rules for the platform, and whether each outside service is connected." />

      <section>
        <SectionTitle
          hint={
            config
              ? `Currently ${describeSurcharge(config.surchargeType, config.surchargeValue)} under ${formatDuration(config.thresholdMinutes)} notice`
              : "Off — no emergency surcharge"
          }
        >
          Emergency pricing
        </SectionTitle>
        <EmergencyConfigForm
          thresholdMinutes={config?.thresholdMinutes ?? 720}
          surchargeType={config?.surchargeType ?? "PERCENTAGE"}
          surchargeValue={config?.surchargeValue ?? 2_500}
        />
      </section>

      <section>
        <SectionTitle
          hint={
            fees.id
              ? `${percent(fees.rates.discoveryCommissionBps)} new client · ${percent(fees.rates.repeatCommissionBps)} own link · last changed ${formatDayTime(fees.createdAt!)}`
              : "The launch defaults — not changed yet"
          }
        >
          Commission and fees
        </SectionTitle>
        <FeeRatesForm current={fees.rates} />
        <p className="mt-2 text-xs text-ink-muted">
          New rates apply to bookings made after you publish. A booking already made keeps the rates it was made under,
          including its cancellation fees, so no one is charged differently from what they were shown.
        </p>
        {feeHistory.length > 0 ? (
          <Card className="mt-3 divide-y divide-line">
            {feeHistory.map((row, at) => {
              const after = feeRatesFrom(row);
              const before = feeRatesFrom(feeHistory[at + 1] ?? DEFAULT_FEE_RATES);
              const changes = FEE_RATE_KEYS.filter((key) => before[key] !== after[key]);
              return (
                <div key={row.id} className="px-4 py-2.5 text-sm">
                  <p className="text-ink">
                    {changes.length
                      ? changes.map((key) => `${FEE_RATE_LABELS[key]} ${formatRate(key, before[key])} → ${formatRate(key, after[key])}`).join(" · ")
                      : "Republished with no changes"}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDayTime(row.createdAt)}
                    {row.createdBy ? ` · ${row.createdBy}` : ""}
                    {row.note ? ` · “${row.note}”` : ""}
                  </p>
                </div>
              );
            })}
          </Card>
        ) : null}
      </section>

      <section>
        <SectionTitle>Connected services</SectionTitle>
        <Card className="divide-y divide-line">
          {integrations.map(({ name, ok, detail }) => (
            <div key={name} className="flex items-start gap-3 px-4 py-3">
              {ok ? (
                <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-normal" aria-label="Connected" />
              ) : (
                <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-warning" aria-label="Not connected" />
              )}
              <div>
                <p className="text-sm font-semibold text-ink">{name}</p>
                <p className="text-xs text-ink-muted">{detail}</p>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle hint="Set by ADMIN_EMAILS in Vercel">Admins</SectionTitle>
        <Card className="p-4 text-sm">
          {admins.length === 0 ? (
            <p className="text-warning">No admin emails are configured.</p>
          ) : (
            <ul className="space-y-1 font-mono text-[13px] text-ink">
              {admins.map((email) => (
                <li key={email}>{email}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-muted">
            To add or remove an admin, edit ADMIN_EMAILS in Vercel and redeploy. It changes on their next sign-in.
          </p>
        </Card>
      </section>
    </div>
  );
}
