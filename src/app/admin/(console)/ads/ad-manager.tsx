"use client";

import { useMemo, useState } from "react";
import { Copy, Plus, Television } from "@phosphor-icons/react";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { AdView } from "@/components/ad-view";
import { Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import {
  AD_ALIGNS,
  AD_DEVICES,
  AD_FITS,
  AD_HEIGHT,
  AD_LIST_POSITION,
  AD_SIZES,
  AD_TEXT_POSITIONS,
  AD_WIDTH,
  sizeDimensions,
  type AdAlign,
  type AdDevice,
  type AdFit,
  type AdSize,
  type AdTextPosition,
} from "@/lib/domain/ad-layout";
import { ErrorNote, fieldClass } from "../_components/bits";
import { fromLocalInput, shortDate, toLocalInput } from "../_components/date-input";
import { SchedulePill } from "../_components/schedule-pill";
import { useAdminAction } from "../_components/use-admin-action";

interface Slot {
  key: string;
  label: string;
  hint: string;
  page: string;
}

type Schedule = "LIVE" | "SCHEDULED" | "PAUSED" | "ENDED";

export interface Ad {
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
  size: AdSize;
  width: number;
  height: number;
  align: AdAlign;
  textPosition: AdTextPosition;
  imageFit: AdFit;
  device: AdDevice;
  listPosition: number;
  targetCity: string;
  schedule: Schedule;
}

const STATUS_FILTERS: Array<{ key: Schedule | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "LIVE", label: "Live" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PAUSED", label: "Paused" },
  { key: "ENDED", label: "Ended" },
];

/** Slots that sit on a page with a city: the directory and storefronts. */
const CITY_PAGES = new Set(["Directory", "Storefront"]);

export function AdManager({ slots, ads, cities }: { slots: Slot[]; ads: Ad[]; cities: string[] }) {
  const { run, busy, error } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<Schedule | "ALL">("ALL");
  const [page, setPage] = useState<string>("ALL");

  const pages = useMemo(() => [...new Set(slots.map((slot) => slot.page))], [slots]);
  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { ALL: ads.length };
    for (const ad of ads) byStatus[ad.schedule] = (byStatus[ad.schedule] ?? 0) + 1;
    return byStatus;
  }, [ads]);
  const totals = useMemo(() => {
    const live = ads.filter((ad) => ad.schedule === "LIVE");
    const views = ads.reduce((sum, ad) => sum + ad.impressions, 0);
    const clicks = ads.reduce((sum, ad) => sum + ad.clicks, 0);
    return { live: live.length, views, clicks };
  }, [ads]);

  const shownSlots = slots.filter((slot) => page === "ALL" || slot.page === page);

  return (
    <div className="space-y-8">
      <ErrorNote>{error}</ErrorNote>

      <section className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Live now</p>
          <p data-numeric className="mt-1 font-display text-2xl font-bold text-ink">{totals.live}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Views, all time</p>
          <p data-numeric className="mt-1 font-display text-2xl font-bold text-ink">{totals.views.toLocaleString("en-GB")}</p>
        </Card>
        <Card className="p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">Clicks · CTR</p>
          <p data-numeric className="mt-1 font-display text-2xl font-bold text-ink">
            {totals.clicks.toLocaleString("en-GB")}
            {totals.views > 0 ? <span className="ml-2 text-base text-ink-muted">{((totals.clicks / totals.views) * 100).toFixed(1)}%</span> : null}
          </p>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterChips
          label="Status"
          options={STATUS_FILTERS.map((option) => ({ ...option, count: counts[option.key] ?? 0 }))}
          value={status}
          onChange={(value) => setStatus(value as Schedule | "ALL")}
        />
        <FilterChips
          label="Page"
          options={[{ key: "ALL", label: "Every page" }, ...pages.map((name) => ({ key: name, label: name }))]}
          value={page}
          onChange={setPage}
        />
      </div>

      {shownSlots.map((slot) => {
        const inSlot = ads.filter((ad) => ad.slot === slot.key);
        const visible = inSlot.filter((ad) => status === "ALL" || ad.schedule === status);
        const showingNow = inSlot.find((ad) => ad.schedule === "LIVE");
        const newKey = `new:${slot.key}`;
        return (
          <section key={slot.key}>
            <SectionTitle
              hint={
                <button
                  type="button"
                  onClick={() => setEditing(newKey)}
                  className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
                >
                  <Plus size={14} weight="bold" aria-hidden /> Add ad
                </button>
              }
            >
              {slot.label}
            </SectionTitle>
            <p className="-mt-2 mb-3 text-xs text-ink-muted">
              {slot.hint}
              {inSlot.length > 0
                ? ` · ${showingNow ? `top of the queue: “${showingNow.title}”` : "nothing live right now, so the slot is hidden"}`
                : ""}
            </p>

            {editing === newKey ? (
              <AdForm
                slots={slots}
                cities={cities}
                slot={slot.key}
                busy={busy === newKey}
                onCancel={() => setEditing(null)}
                onSave={async (values) => {
                  if (await run(newKey, "/api/admin/ads", "POST", values)) setEditing(null);
                }}
              />
            ) : null}

            {visible.length === 0 && editing !== newKey ? (
              <EmptyState icon={<Television size={22} weight="light" />}>
                {inSlot.length === 0
                  ? "Nothing booked in this slot. It stays hidden on the site."
                  : `No ${status.toLowerCase()} ads in this slot.`}
              </EmptyState>
            ) : null}

            <div className="space-y-3">
              {visible.map((ad) =>
                editing === ad.id ? (
                  <AdForm
                    key={ad.id}
                    slots={slots}
                    cities={cities}
                    slot={ad.slot}
                    initial={ad}
                    busy={busy === ad.id}
                    onCancel={() => setEditing(null)}
                    onSave={async (values) => {
                      if (await run(ad.id, `/api/admin/ads/${ad.id}`, "PATCH", values)) setEditing(null);
                    }}
                  />
                ) : (
                  <AdRow
                    key={ad.id}
                    ad={ad}
                    busy={busy === ad.id}
                    onEdit={() => setEditing(ad.id)}
                    onToggle={() => run(ad.id, `/api/admin/ads/${ad.id}`, "PATCH", { isActive: !ad.isActive })}
                    onDuplicate={() => run(ad.id, `/api/admin/ads/${ad.id}/duplicate`, "POST")}
                    onDelete={() => {
                      if (window.confirm(`Delete the ad “${ad.title}”? Its view and click counts go with it.`)) {
                        void run(ad.id, `/api/admin/ads/${ad.id}`, "DELETE");
                      }
                    }}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ key: string; label: string; count?: number }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</span>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition ${
            value === option.key
              ? "border-accent-500 bg-accent-500 text-metal-ink"
              : "border-line bg-surface text-ink-muted hover:border-accent-500 hover:text-ink"
          }`}
        >
          {option.label}
          {option.count !== undefined ? <span className="ml-1 opacity-70">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function AdRow({
  ad,
  busy,
  onEdit,
  onToggle,
  onDuplicate,
  onDelete,
}: {
  ad: Ad;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const facts = [
    `${AD_SIZES[ad.size]?.label ?? "Custom size"} ${ad.width}×${ad.height}`,
    AD_ALIGNS[ad.align] ? `${AD_ALIGNS[ad.align].toLowerCase()} aligned` : null,
    ad.device !== "ALL" ? AD_DEVICES[ad.device]?.toLowerCase() : null,
    ad.slot === "DIRECTORY_INLINE" ? `after vendor ${ad.listPosition}` : null,
    ad.targetCity ? `${ad.targetCity} only` : null,
    `priority ${ad.priority}`,
  ].filter(Boolean);

  return (
    <Card className="flex flex-wrap gap-4 p-4">
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
        <p className="mt-1 text-xs text-ink-muted">{facts.join(" · ")}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {ad.advertiser ? `${ad.advertiser} · ` : ""}
          {shortDate(ad.startsAt)} → {ad.endsAt ? shortDate(ad.endsAt) : "no end date"}
          {ad.linkUrl ? ` · links to ${ad.linkUrl}` : " · no link"}
        </p>
        <p data-numeric className="mt-1 font-mono text-xs text-ink">
          {ad.impressions.toLocaleString("en-GB")} views · {ad.clicks.toLocaleString("en-GB")} clicks
          {ad.impressions > 0 ? ` · ${((ad.clicks / ad.impressions) * 100).toFixed(1)}% CTR` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        {ad.schedule !== "ENDED" ? (
          <Button variant="secondary" disabled={busy} onClick={onToggle}>
            {busy ? "Saving…" : ad.isActive ? "Pause" : "Resume"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onDuplicate} aria-label={`Duplicate ${ad.title}`}>
          <Copy size={14} aria-hidden /> Duplicate
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function Options<T extends string>({ options }: { options: Record<T, string> }) {
  return (
    <>
      {(Object.entries(options) as Array<[T, string]>).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </>
  );
}

function AdForm({
  slots,
  cities,
  slot: initialSlot,
  initial,
  busy,
  onSave,
  onCancel,
}: {
  slots: Slot[];
  cities: string[];
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
  const [size, setSize] = useState<AdSize>(initial?.size ?? "BANNER");
  const [customWidth, setCustomWidth] = useState(String(initial?.width ?? 1400));
  const [customHeight, setCustomHeight] = useState(String(initial?.height ?? 400));
  const [align, setAlign] = useState<AdAlign>(initial?.align ?? "CENTER");
  const [textPosition, setTextPosition] = useState<AdTextPosition>(initial?.textPosition ?? "BOTTOM_LEFT");
  const [imageFit, setImageFit] = useState<AdFit>(initial?.imageFit ?? "COVER");
  const [device, setDevice] = useState<AdDevice>(initial?.device ?? "ALL");
  const [listPosition, setListPosition] = useState(String(initial?.listPosition ?? 4));
  const [targetCity, setTargetCity] = useState(initial?.targetCity ?? "");

  const slotInfo = slots.find((option) => option.key === slot);
  const { width, height } = sizeDimensions(size, { width: Number(customWidth), height: Number(customHeight) });
  const widthOk = Number.isInteger(width) && width >= AD_WIDTH.min && width <= AD_WIDTH.max;
  const heightOk = Number.isInteger(height) && height >= AD_HEIGHT.min && height <= AD_HEIGHT.max;
  const listOk = slot !== "DIRECTORY_INLINE" || (Number(listPosition) >= AD_LIST_POSITION.min && Number(listPosition) <= AD_LIST_POSITION.max);
  const hiddenWithoutImage = textPosition === "HIDDEN" && !image;
  const problem =
    title.trim().length < 2
      ? "Give the ad a headline (at least 2 characters) — it is also the image's description for screen readers."
      : !widthOk
        ? `Width must be a whole number from ${AD_WIDTH.min} to ${AD_WIDTH.max} pixels.`
        : !heightOk
          ? `Height must be a whole number from ${AD_HEIGHT.min} to ${AD_HEIGHT.max} pixels.`
          : !listOk
            ? `Position in the list must be from ${AD_LIST_POSITION.min} to ${AD_LIST_POSITION.max}.`
            : hiddenWithoutImage
              ? "Add a banner image, or show the headline: with neither the ad would be an empty box."
              : endsAt && startsAt && new Date(endsAt) <= new Date(startsAt)
                ? "The end date must be after the start date."
                : null;

  return (
    <Card className="rise-in mb-3 space-y-5 border-accent-500/50 p-4">
      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-700">Content</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Headline">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} maxLength={80} />
          </Field>
          <Field label="Sub-line (optional)">
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={fieldClass} maxLength={160} />
          </Field>
          <Field label="Link (a page on GLAMNET like /pro/name, or https://…)">
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={fieldClass} placeholder="/pro/vendor-name" />
          </Field>
          <Field label="Advertiser (only admins see this)">
            <input value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} className={fieldClass} />
          </Field>
        </div>
        <ImageUpload
          folder="ad"
          value={image}
          onChange={setImage}
          label="Banner image"
          hint={`Upload at least ${width} × ${height} pixels for a sharp result at this size.`}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-700">Position</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Slot" hint={slotInfo?.hint}>
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={fieldClass}>
              {slots.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          {slot === "DIRECTORY_INLINE" ? (
            <Field label="Show after vendor number" hint="On a shorter list it goes after the last vendor.">
              <input
                type="number"
                min={AD_LIST_POSITION.min}
                max={AD_LIST_POSITION.max}
                step={1}
                value={listPosition}
                onChange={(e) => setListPosition(e.target.value)}
                className={fieldClass}
              />
            </Field>
          ) : null}
          <Field label="Alignment" hint="Used when the ad is narrower than the page column.">
            <select value={align} onChange={(e) => setAlign(e.target.value as AdAlign)} className={fieldClass}>
              <Options options={AD_ALIGNS} />
            </select>
          </Field>
          <Field label="Show on">
            <select value={device} onChange={(e) => setDevice(e.target.value as AdDevice)} className={fieldClass}>
              <Options options={AD_DEVICES} />
            </select>
          </Field>
          <Field
            label="City"
            hint={slotInfo && CITY_PAGES.has(slotInfo.page) ? "A city's own ad wins over a UK-wide one of equal priority." : "Home page slots have no city, so only UK-wide ads show there."}
          >
            <select value={targetCity} onChange={(e) => setTargetCity(e.target.value)} className={fieldClass}>
              <option value="">Everywhere in the UK</option>
              {[...new Set([...cities, ...(targetCity ? [targetCity] : [])])].map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-700">Size and layout</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Size">
            <select
              value={size}
              onChange={(e) => {
                const next = e.target.value as AdSize;
                // Switching to custom starts from the size it was showing.
                if (next === "CUSTOM") {
                  setCustomWidth(String(width));
                  setCustomHeight(String(height));
                }
                setSize(next);
              }}
              className={fieldClass}
            >
              {(Object.entries(AD_SIZES) as Array<[AdSize, (typeof AD_SIZES)[AdSize]]>).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.width ? `${preset.label} · ${preset.width}×${preset.height}` : preset.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Width (px)" hint={`${AD_WIDTH.min}–${AD_WIDTH.max}. Narrower screens scale it down.`}>
            <input
              type="number"
              min={AD_WIDTH.min}
              max={AD_WIDTH.max}
              step={10}
              value={size === "CUSTOM" ? customWidth : String(width)}
              disabled={size !== "CUSTOM"}
              onChange={(e) => setCustomWidth(e.target.value)}
              className={`${fieldClass} disabled:opacity-60`}
            />
          </Field>
          <Field label="Height (px)" hint={`${AD_HEIGHT.min}–${AD_HEIGHT.max}. Proportions are kept.`}>
            <input
              type="number"
              min={AD_HEIGHT.min}
              max={AD_HEIGHT.max}
              step={10}
              value={size === "CUSTOM" ? customHeight : String(height)}
              disabled={size !== "CUSTOM"}
              onChange={(e) => setCustomHeight(e.target.value)}
              className={`${fieldClass} disabled:opacity-60`}
            />
          </Field>
          <Field label="Headline position">
            <select value={textPosition} onChange={(e) => setTextPosition(e.target.value as AdTextPosition)} className={fieldClass}>
              <Options options={AD_TEXT_POSITIONS} />
            </select>
          </Field>
          <Field label="Image fit">
            <select value={imageFit} onChange={(e) => setImageFit(e.target.value as AdFit)} className={fieldClass}>
              <Options options={AD_FITS} />
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-xs text-ink-muted">
            Preview{widthOk && heightOk ? ` · ${width}×${height}, shown here at up to the width of this panel` : ""}
          </p>
          <div className="rounded-glam border border-dashed border-line bg-sunken p-3">
            {widthOk && heightOk ? (
              <AdView
                preview
                id="preview"
                title={title || "Your headline"}
                subtitle={subtitle}
                imageUrl={image?.url ?? ""}
                hasLink={false}
                width={width}
                height={height}
                align={align}
                textPosition={textPosition}
                imageFit={imageFit}
                device={device}
              />
            ) : (
              <p className="p-4 text-center text-xs text-ink-muted">Enter a valid width and height to see the preview.</p>
            )}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-700">Schedule</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Starts">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Ends (optional)">
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Priority (0–100)" hint="Higher shows first; equal priorities take turns.">
            <input type="number" min={0} max={100} step={1} value={priority} onChange={(e) => setPriority(e.target.value)} className={fieldClass} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          Live (within the dates above)
        </label>
      </fieldset>

      {problem && title ? <p className="text-xs text-warning">{problem}</p> : null}
      <div className="flex gap-2">
        <Button
          disabled={busy || problem !== null}
          onClick={() =>
            onSave({
              slot,
              title,
              subtitle,
              linkUrl,
              advertiser,
              priority: Math.max(0, Math.min(100, Math.round(Number(priority)) || 0)),
              startsAt: fromLocalInput(startsAt),
              endsAt: fromLocalInput(endsAt),
              isActive,
              imageUrl: image?.url ?? "",
              imageFileId: image?.fileId ?? "",
              size,
              width,
              height,
              align,
              textPosition,
              imageFit,
              device,
              listPosition: Math.round(Number(listPosition)) || 4,
              targetCity,
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
