"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { Button, Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { ErrorNote, LiveSwitch, fieldClass } from "../_components/bits";
import { useAdminAction } from "../_components/use-admin-action";

interface City {
  id: string;
  slug: string;
  name: string;
  label: string;
  outcode: string;
  imageUrl: string;
  imageFileId: string;
  sortOrder: number;
  isActive: boolean;
  liveCount: number;
}

/** Thumbnail with an ImageKit resize when the URL is ours. */
function thumb(url: string) {
  return url.includes("imagekit.io") ? `${url}?tr=w-192,h-144,fo-auto` : url;
}

export function CityManager({ cities }: { cities: City[] }) {
  const { run, busy, error } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ErrorNote>{error}</ErrorNote>

      <SectionTitle
        hint={
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
          >
            <Plus size={14} weight="bold" aria-hidden /> Add city
          </button>
        }
      >
        {cities.length} {cities.length === 1 ? "city" : "cities"}
      </SectionTitle>

      {editing === "new" ? (
        <CityForm
          busy={busy === "city:new"}
          onCancel={() => setEditing(null)}
          onSave={async (values) => {
            if (await run("city:new", "/api/admin/cities", "POST", values)) setEditing(null);
          }}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cities.map((city) =>
          editing === city.id ? (
            <CityForm
              key={city.id}
              initial={city}
              busy={busy === `city:${city.id}`}
              onCancel={() => setEditing(null)}
              onSave={async (values) => {
                if (await run(`city:${city.id}`, `/api/admin/cities/${city.id}`, "PATCH", values)) setEditing(null);
              }}
            />
          ) : (
            <Card key={city.id} className={`flex min-w-0 gap-3 p-3 ${city.isActive ? "" : "opacity-70"}`}>
              {city.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail
                <img src={thumb(city.imageUrl)} alt="" className="h-14 w-16 shrink-0 rounded-glam-sm sm:h-16 sm:w-20 object-cover" />
              ) : (
                <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-glam-sm bg-metal font-display text-2xl font-extrabold text-metal-ink/40">
                  {(city.label || city.name).slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{city.label || city.name}</span>
                  {!city.imageUrl ? <Pill tone="muted">no photo</Pill> : null}
                </div>
                <p className="text-xs text-ink-muted">
                  {city.liveCount} live {city.liveCount === 1 ? "pro" : "pros"}
                  {city.label && city.label !== city.name ? ` · counts pros in ${city.name}` : ""}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                  /{city.slug} · {city.outcode} · order {city.sortOrder}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <LiveSwitch
                  on={city.isActive}
                  busy={busy === `city:${city.id}`}
                  label={`${city.label || city.name} on the home page`}
                  onToggle={() => run(`city:${city.id}`, `/api/admin/cities/${city.id}`, "PATCH", { isActive: !city.isActive })}
                />
                <div className="flex items-start gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditing(city.id)}
                    aria-label={`Edit ${city.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
                  >
                    <PencilSimple size={16} />
                  </button>
                  <a
                    href={`/${city.slug}/salons`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open the ${city.name} page`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
                  >
                    <ArrowSquareOut size={16} />
                  </a>
                  <button
                    type="button"
                    aria-label={`Remove ${city.name}`}
                    onClick={() => {
                      if (window.confirm(`Remove ${city.label || city.name} from Browse by city? Its vendors are not affected.`)) {
                        void run(`city:${city.id}`, `/api/admin/cities/${city.id}`, "DELETE");
                      }
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-warning"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ),
        )}
      </div>
      {cities.length === 0 ? (
        <EmptyState>No cities yet — the home page is showing the built-in list. Add one above to take over.</EmptyState>
      ) : null}
    </div>
  );
}

function CityForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: City;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [postcode, setPostcode] = useState(initial?.outcode ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 100));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [image, setImage] = useState<UploadedImage | null>(
    initial?.imageUrl ? { url: initial.imageUrl, fileId: initial.imageFileId } : null,
  );
  // Which city the postcode belongs to, looked up as the admin types.
  const [preview, setPreview] = useState<{ key: string; city: string | null } | null>(null);
  const term = postcode.trim().toUpperCase();

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/geo/lookup?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json().catch(() => ({}));
          setPreview({ key: term, city: response.ok ? (payload.place?.city ?? null) : null });
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  const resolved = preview?.key === term ? preview.city : undefined;

  return (
    <Card className="rise-in space-y-3 border-accent-500/50 p-4 md:col-span-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">City-centre postcode or area (e.g. M2, LS1 4DY)</span>
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            className={`${fieldClass} uppercase`}
            maxLength={10}
            autoFocus={!initial}
          />
          <span className="mt-1 block text-xs">
            {term.length < 2 ? (
              <span className="text-ink-muted">Pros are counted by the city their postcode is in.</span>
            ) : resolved === undefined ? (
              <span className="text-ink-muted">Looking up…</span>
            ) : resolved ? (
              <span className="text-normal-ink">
                Counts pros in <strong>{resolved}</strong>
              </span>
            ) : (
              <span className="text-warning">We couldn&rsquo;t find that postcode.</span>
            )}
          </span>
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Name on the tile (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={fieldClass}
            maxLength={60}
            placeholder={resolved ?? initial?.name ?? "e.g. Newcastle"}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Order (lower shows first)</span>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--glam-gold)]"
          />
          Show on the home page
        </label>
      </div>
      <ImageUpload
        folder="city"
        value={image}
        onChange={setImage}
        label="City photo"
        hint="Landscape works best (4:3). Without one, the tile is gold with the city's initial."
      />
      <div className="flex gap-2">
        <Button
          disabled={busy || term.length < 2 || resolved === null}
          onClick={() =>
            onSave({
              postcode: term,
              label: label.trim(),
              sortOrder: Number(sortOrder) || 0,
              isActive,
              imageUrl: image?.url ?? "",
              imageFileId: image?.fileId ?? "",
            })
          }
        >
          {busy ? "Saving…" : initial ? "Save city" : "Add city"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
