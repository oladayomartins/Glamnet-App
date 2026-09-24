import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { requireRole } from "@/lib/auth/session";
import { getActiveEmergencyConfig } from "@/lib/server/emergency-config";
import { isImageKitConfigured } from "@/lib/imagekit";
import { describeSurcharge, formatDuration } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";
import { AdminHeader } from "../_components/bits";
import { EmergencyConfigForm } from "./config-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

/** Platform settings and the health of each outside service. */
export default async function AdminSettingsPage() {
  await requireRole("ADMIN", "/admin/settings");
  const config = await getActiveEmergencyConfig();

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
              : "Not configured"
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
        <SectionTitle>Commission rules</SectionTitle>
        <Card className="space-y-2 p-4 text-sm text-ink">
          <p>
            <strong>Bio-link and repeat clients:</strong> 0% commission. Only the 2% card processing fee applies.
          </p>
          <p>
            <strong>First booking found through the marketplace:</strong> 30% commission, once per client and vendor.
          </p>
          <p className="text-xs text-ink-muted">These rates are set in code (settlement rules) so every booking is priced the same way.</p>
        </Card>
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
