"use client";

import { useState } from "react";
import { Plus, Television } from "@phosphor-icons/react";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { ErrorNote, fieldClass } from "../_components/bits";
import { fromLocalInput, shortDate, toLocalInput } from "../_components/date-input";
import { SchedulePill } from "../_components/schedule-pill";
import { useAdminAction } from "../_components/use-admin-action";

interface Slot {
  key: string;
  label: string;
  hint: string;
}

interface Ad {
  id: string;
  slot: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageFileId: string;
  linkUrl: string;
  advertiser: string;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  priority: number;
  impressions: number;
  clicks: number;
  schedule: "LIVE" | "SCHEDULED" | "PAUSED" | "ENDED";
}

export function AdManager({ slots, ads }: { slots: Slot[]; ads: Ad[] }) {
  const { run, busy, error } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <ErrorNote>{error}</ErrorNote>

      {slots.map((slot) => {
        const inSlot = ads.filter((ad) => ad.slot === slot.key);
        const newKey = `new:${slot.key}`;
        return (
          <section key={slot.key}>
            <SectionTitle
              hint={
                <button
                  type="button"
                  onClick={() => setEditing(newKey)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
                >
                  <Plus size={14} weight="bold" aria-hidden /> Add ad
                </button>
              }
            >
              {slot.label}
            </SectionTitle>
            <p className="-mt-2 mb-3 text-xs text-ink-muted">{slot.hint}</p>

            {editing === newKey ? (
              <AdForm
                slots={slots}
                slot={slot.key}
                busy={busy === newKey}
                onCancel={() => setEditing(null)}
                onSave={async (values) => {
                  if (await run(newKey, "/api/admin/ads", "POST", values)) setEditing(null);
                }}
              />
            ) : null}

            {inSlot.length === 0 && editing !== newKey ? (
              <EmptyState icon={<Television size={22} weight="light" />}>Nothing booked in this slot. It stays hidden on the site.</EmptyState>
            ) : null}

            <div className="space-y-3">
              {inSlot.map((ad) =>
                editing === ad.id ? (
                  <AdForm
                    key={ad.id}
                    slots={slots}
                    slot={ad.slot}
                    initial={ad}
                    busy={busy === ad.id}
                    onCancel={() => setEditing(null)}
                    onSave={async (values) => {
                      if (await run(ad.id, `/api/admin/ads/${ad.id}`, "PATCH", values)) setEditing(null);
                    }}
                  />
                ) : (
                  <Card key={ad.id} className="flex flex-wrap gap-4 p-4">
                    {ad.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail
                      <img src={`${ad.imageUrl}?tr=w-320,h-120,fo-auto`} alt="" className="h-16 w-40 shrink-0 rounded-glam-sm object-cover" />
                    ) : (
                      <span className="flex h-16 w-40 shrink-0 items-center justify-center rounded-glam-sm bg-metal text-xs font-bold text-metal-ink">
                        Text only
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{ad.title}</span>
                        <SchedulePill schedule={ad.schedule} />
                      </div>
                      {ad.subtitle ? <p className="text-sm text-ink-muted">{ad.subtitle}</p> : null}
                      <p className="mt-1 text-xs text-ink-muted">
                        {ad.advertiser ? `${ad.advertiser} · ` : ""}priority {ad.priority} · {shortDate(ad.startsAt)} →{" "}
                        {ad.endsAt ? shortDate(ad.endsAt) : "no end date"}
                      </p>
                      <p data-numeric className="mt-1 font-mono text-xs text-ink">
                        {ad.impressions.toLocaleString("en-GB")} views · {ad.clicks.toLocaleString("en-GB")} clicks
                        {ad.impressions > 0 ? ` · ${((ad.clicks / ad.impressions) * 100).toFixed(1)}% CTR` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      {ad.schedule !== "ENDED" ? (
                        <Button
                          variant="secondary"
                          disabled={busy === ad.id}
                          onClick={() => run(ad.id, `/api/admin/ads/${ad.id}`, "PATCH", { isActive: !ad.isActive })}
                        >
                          {ad.isActive ? "Pause" : "Resume"}
                        </Button>
                      ) : null}
                      <Button variant="secondary" onClick={() => setEditing(ad.id)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy === ad.id}
                        onClick={() => {
                          if (window.confirm(`Delete the ad “${ad.title}”?`)) void run(ad.id, `/api/admin/ads/${ad.id}`, "DELETE");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AdForm({
  slots,
  slot: initialSlot,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  slots: Slot[];
  slot: string;
  initial?: Ad;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [slot, setSlot] = useState(initialSlot);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl ?? "");
  const [advertiser, setAdvertiser] = useState(initial?.advertiser ?? "");
  const [priority, setPriority] = useState(String(initial?.priority ?? 0));
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(toLocalInput(initial?.endsAt ?? null));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [image, setImage] = useState<UploadedImage | null>(
    initial?.imageUrl ? { url: initial.imageUrl, fileId: initial.imageFileId } : null,
  );

  return (
    <Card className="rise-in mb-3 space-y-3 border-accent-500/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Headline</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} maxLength={80} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Slot</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className={fieldClass}>
            {slots.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-ink-muted">Sub-line (optional)</span>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={fieldClass} maxLength={160} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Link (a page on GLAMNET like /pro/name, or https://…)</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Advertiser (only admins see this)</span>
          <input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-ink-muted">Starts</span>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Ends (optional)</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Priority (0–100)</span>
          <input type="number" min={0} max={100} value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <ImageUpload folder="ad" value={image} onChange={setImage} label="Banner image" hint="Wide images work best (about 1400 × 400)." />
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
        Live (within the dates above)
      </label>
      <div className="flex gap-2">
        <Button
          disabled={busy || title.trim().length < 2}
          onClick={() =>
            onSave({
              slot,
              title,
              subtitle,
              linkUrl,
              advertiser,
              priority: Math.max(0, Math.min(100, Number(priority) || 0)),
              startsAt: fromLocalInput(startsAt),
              endsAt: fromLocalInput(endsAt),
              isActive,
              imageUrl: image?.url ?? "",
              imageFileId: image?.fileId ?? "",
            })
          }
        >
          {busy ? "Saving…" : initial ? "Save ad" : "Create ad"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
