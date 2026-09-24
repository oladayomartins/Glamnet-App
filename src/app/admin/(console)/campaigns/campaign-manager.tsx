"use client";

import { useState } from "react";
import { EnvelopeSimple, Megaphone, Plus } from "@phosphor-icons/react";
import { Button, Card, EmptyState } from "@/components/ui";
import { ErrorNote, fieldClass } from "../_components/bits";
import { fromLocalInput, shortDate, toLocalInput } from "../_components/date-input";
import { SchedulePill } from "../_components/schedule-pill";
import { useAdminAction } from "../_components/use-admin-action";

type Audience = "ALL" | "CUSTOMERS" | "VENDORS";

interface Campaign {
  id: string;
  name: string;
  audience: Audience;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  showBanner: boolean;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  schedule: "LIVE" | "SCHEDULED" | "PAUSED" | "ENDED";
  emailSentAt: string | null;
  emailSentTo: number;
}

const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: "Everyone",
  CUSTOMERS: "Customers",
  VENDORS: "Vendors",
};

export function CampaignManager({
  campaigns,
  audienceSizes,
  emailReady,
}: {
  campaigns: Campaign[];
  audienceSizes: Record<Audience, number>;
  emailReady: boolean;
}) {
  const { run, busy, error } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const send = async (campaign: Campaign) => {
    const count = audienceSizes[campaign.audience];
    if (!window.confirm(`Email “${campaign.title}” to ${count} ${AUDIENCE_LABEL[campaign.audience].toLowerCase()}? This can only be done once.`)) return;
    const result = (await run(campaign.id, `/api/admin/campaigns/${campaign.id}/send`, "POST")) as { sent?: number } | null;
    if (result?.sent !== undefined) setNotice(`Sent to ${result.sent} people.`);
  };

  return (
    <div className="space-y-4">
      <ErrorNote>{error}</ErrorNote>
      {notice ? <p className="rise-in rounded-glam border-l-4 border-normal bg-sunken p-3 text-sm text-ink">{notice}</p> : null}
      {!emailReady ? (
        <p className="rounded-glam bg-sunken p-3 text-xs text-ink-muted">
          Email sending is not set up yet (RESEND_API_KEY). Banners work; email sends will be refused until it is.
        </p>
      ) : null}

      {editing === "new" ? (
        <CampaignForm
          audienceSizes={audienceSizes}
          busy={busy === "new"}
          onCancel={() => setEditing(null)}
          onSave={async (values) => {
            if (await run("new", "/api/admin/campaigns", "POST", values)) setEditing(null);
          }}
        />
      ) : (
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} weight="bold" aria-hidden /> New campaign
        </Button>
      )}

      {campaigns.length === 0 && editing !== "new" ? (
        <EmptyState icon={<Megaphone size={24} weight="light" />}>
          No campaigns yet. Announce a promotion, a new category or an event.
        </EmptyState>
      ) : null}

      {campaigns.map((campaign) =>
        editing === campaign.id ? (
          <CampaignForm
            key={campaign.id}
            initial={campaign}
            audienceSizes={audienceSizes}
            busy={busy === campaign.id}
            onCancel={() => setEditing(null)}
            onSave={async (values) => {
              if (await run(campaign.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", values)) setEditing(null);
            }}
          />
        ) : (
          <Card key={campaign.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{campaign.name}</span>
                  <SchedulePill schedule={campaign.schedule} />
                </div>
                <p className="mt-1 text-sm text-ink">{campaign.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{campaign.message}</p>
                <p className="mt-1.5 text-xs text-ink-muted">
                  {AUDIENCE_LABEL[campaign.audience]} · {campaign.showBanner ? "site banner" : "no banner"} ·{" "}
                  {shortDate(campaign.startsAt)} → {campaign.endsAt ? shortDate(campaign.endsAt) : "no end date"}
                  {campaign.emailSentAt ? ` · emailed ${shortDate(campaign.emailSentAt)} to ${campaign.emailSentTo}` : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              {campaign.schedule !== "ENDED" ? (
                <Button
                  variant="secondary"
                  disabled={busy === campaign.id}
                  onClick={() => run(campaign.id, `/api/admin/campaigns/${campaign.id}`, "PATCH", { isActive: !campaign.isActive })}
                >
                  {campaign.isActive ? "Pause" : "Go live"}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setEditing(campaign.id)}>
                Edit
              </Button>
              {!campaign.emailSentAt ? (
                <Button variant="secondary" disabled={busy === campaign.id} onClick={() => send(campaign)}>
                  <EnvelopeSimple size={15} aria-hidden /> Email {audienceSizes[campaign.audience]}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                disabled={busy === campaign.id}
                onClick={() => {
                  if (window.confirm(`Delete the campaign “${campaign.name}”?`)) {
                    void run(campaign.id, `/api/admin/campaigns/${campaign.id}`, "DELETE");
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </Card>
        ),
      )}
    </div>
  );
}

function CampaignForm({
  initial,
  audienceSizes,
  busy,
  onSave,
  onCancel,
}: {
  initial?: Campaign;
  audienceSizes: Record<Audience, number>;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [audience, setAudience] = useState<Audience>(initial?.audience ?? "ALL");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? "");
  const [showBanner, setShowBanner] = useState(initial?.showBanner ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt ?? null));
  const [isActive, setIsActive] = useState(initial?.isActive ?? false);

  const valid = name.trim().length >= 2 && title.trim().length >= 2 && message.trim().length >= 2;

  return (
    <Card className="rise-in space-y-3 border-accent-500/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Internal name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} placeholder="e.g. Bridal season launch" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Audience</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} className={fieldClass}>
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((key) => (
              <option key={key} value={key}>
                {AUDIENCE_LABEL[key]} ({audienceSizes[key]} accounts)
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-ink-muted">Headline</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} maxLength={120} />
      </label>
      <label className="block">
        <span className="text-xs text-ink-muted">Message (the banner shows the first line; the email shows it all)</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={fieldClass} maxLength={4000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Button text (optional)</span>
          <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className={fieldClass} placeholder="Book now" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Button link</span>
          <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} className={fieldClass} placeholder="/sheffield/salons?hub=nails" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Starts</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Ends (optional)</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showBanner} onChange={(e) => setShowBanner(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          Show as a site banner
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          Live (within the dates above)
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={busy || !valid}
          onClick={() =>
            onSave({
              name,
              audience,
              title,
              message,
              ctaLabel,
              ctaUrl,
              showBanner,
              isActive,
              startsAt: fromLocalInput(startsAt),
              endsAt: fromLocalInput(endsAt),
            })
          }
        >
          {busy ? "Saving…" : initial ? "Save campaign" : "Create campaign"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
