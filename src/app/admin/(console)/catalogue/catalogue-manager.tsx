"use client";

import { useState } from "react";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { Button, Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { ErrorNote, LiveSwitch, fieldClass } from "../_components/bits";
import { useAdminAction } from "../_components/use-admin-action";

interface Category {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  blurb: string;
  imageUrl: string;
  imageFileId: string;
  sortOrder: number;
  isActive: boolean;
  serviceCount: number;
}

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: "SERVICE" | "ADDON";
  priceMinor: number;
  durationMinutes: number;
  isActive: boolean;
  vendorCount: number;
  bookingCount: number;
}

const pounds = (minor: number) => `£${(minor / 100).toFixed(2)}`;

export function CatalogueManager({ categories, services }: { categories: Category[]; services: Service[] }) {
  const { run, busy, error } = useAdminAction();
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  // A category being deleted that still has services: where they go.
  const [deleting, setDeleting] = useState<{ id: string; moveTo: string } | null>(null);

  const shown = filter === "ALL" ? services : services.filter((service) => service.category === filter);

  return (
    <div className="space-y-10">
      <ErrorNote>{error}</ErrorNote>

      {/* --- Categories -------------------------------------------------- */}
      <section>
        <SectionTitle
          hint={
            <button
              type="button"
              onClick={() => setEditingCategory("new")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
            >
              <Plus size={14} weight="bold" aria-hidden /> Add category
            </button>
          }
        >
          Categories
        </SectionTitle>

        {editingCategory === "new" ? (
          <CategoryForm
            busy={busy === "category:new"}
            onCancel={() => setEditingCategory(null)}
            onSave={async (values) => {
              if (await run("category:new", "/api/admin/categories", "POST", values)) setEditingCategory(null);
            }}
          />
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {categories.map((category) =>
            editingCategory === category.id ? (
              <CategoryForm
                key={category.id}
                initial={category}
                busy={busy === `category:${category.id}`}
                onCancel={() => setEditingCategory(null)}
                onSave={async (values) => {
                  if (await run(`category:${category.id}`, `/api/admin/categories/${category.id}`, "PATCH", values)) {
                    setEditingCategory(null);
                  }
                }}
              />
            ) : (
              <Card key={category.id} className={`flex min-w-0 flex-wrap gap-3 p-4 ${category.isActive ? "" : "opacity-70"}`}>
                {category.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- ImageKit thumbnail
                  <img src={`${category.imageUrl}?tr=w-128,h-128,fo-auto`} alt="" className="h-14 w-14 shrink-0 rounded-glam-sm object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-glam-sm bg-sunken text-2xl">
                    {category.emoji || "✨"}
                  </span>
                )}
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{category.name}</span>
                  </div>
                  <p className="text-xs text-ink-muted">{category.blurb || "No description"}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                    /{category.slug} · {category.serviceCount} services · order {category.sortOrder}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <LiveSwitch
                    on={category.isActive}
                    busy={busy === `category:${category.id}`}
                    label={`${category.name} on the site`}
                    onToggle={() =>
                      run(`category:${category.id}`, `/api/admin/categories/${category.id}`, "PATCH", {
                        isActive: !category.isActive,
                      })
                    }
                  />
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditingCategory(category.id)}
                      aria-label={`Edit ${category.name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-ink"
                    >
                      <PencilSimple size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => {
                        if (category.serviceCount > 0) {
                          const other = categories.find((option) => option.id !== category.id);
                          setDeleting({ id: category.id, moveTo: other?.name ?? "" });
                        } else if (window.confirm(`Delete the ${category.name} category?`)) {
                          void run(`category:${category.id}`, `/api/admin/categories/${category.id}`, "DELETE");
                        }
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-warning"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
                {deleting?.id === category.id ? (
                  <div className="basis-full rounded-glam-sm border border-warning/50 bg-sunken p-3 text-sm">
                    <p className="text-ink">
                      {category.name} has {category.serviceCount} service{category.serviceCount === 1 ? "" : "s"}. Move{" "}
                      {category.serviceCount === 1 ? "it" : "them"} to:
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={deleting.moveTo}
                        onChange={(e) => setDeleting({ id: category.id, moveTo: e.target.value })}
                        className={`${fieldClass} mt-0 w-auto`}
                        aria-label="Move services to"
                      >
                        {categories
                          .filter((option) => option.id !== category.id)
                          .map((option) => (
                            <option key={option.id} value={option.name}>
                              {option.name}
                            </option>
                          ))}
                      </select>
                      <Button
                        variant="secondary"
                        disabled={!deleting.moveTo || busy === `category:${category.id}`}
                        onClick={async () => {
                          const moved = await run(
                            `category:${category.id}`,
                            `/api/admin/categories/${category.id}?moveTo=${encodeURIComponent(deleting.moveTo)}`,
                            "DELETE",
                          );
                          if (moved) setDeleting(null);
                        }}
                      >
                        Move and delete
                      </Button>
                      <button type="button" onClick={() => setDeleting(null)} className="text-sm font-semibold text-ink-muted hover:text-ink">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </Card>
            ),
          )}
        </div>
        {categories.length === 0 ? <EmptyState>No categories yet. Add the first one above.</EmptyState> : null}
      </section>

      {/* --- Services ------------------------------------------------------ */}
      <section>
        <SectionTitle
          hint={
            <button
              type="button"
              onClick={() => setEditingService("new")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline"
            >
              <Plus size={14} weight="bold" aria-hidden /> Add service
            </button>
          }
        >
          Services
        </SectionTitle>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {["ALL", ...categories.map((category) => category.name)].map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(name)}
              aria-pressed={filter === name}
              className={`min-h-9 rounded-full px-3 text-xs font-medium transition ${
                filter === name ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
              }`}
            >
              {name === "ALL" ? "All categories" : name}
            </button>
          ))}
        </div>

        {editingService === "new" ? (
          <ServiceForm
            categories={categories}
            initialCategory={filter === "ALL" ? categories[0]?.name : filter}
            busy={busy === "service:new"}
            onCancel={() => setEditingService(null)}
            onSave={async (values) => {
              if (await run("service:new", "/api/admin/services", "POST", values)) setEditingService(null);
            }}
          />
        ) : null}

        <Card className="mt-3 divide-y divide-line">
          {shown.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">No services in this category yet.</p>
          ) : (
            shown.map((service) =>
              editingService === service.id ? (
                <div key={service.id} className="p-3">
                  <ServiceForm
                    categories={categories}
                    initial={service}
                    busy={busy === `service:${service.id}`}
                    onCancel={() => setEditingService(null)}
                    onSave={async (values) => {
                      if (await run(`service:${service.id}`, `/api/admin/services/${service.id}`, "PATCH", values)) {
                        setEditingService(null);
                      }
                    }}
                  />
                </div>
              ) : (
                <div key={service.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${service.isActive ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{service.name}</span>
                      {service.kind === "ADDON" ? <Pill>add-on</Pill> : null}
                      {!service.isActive ? <Pill tone="muted">hidden</Pill> : null}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {service.category} · {service.durationMinutes} min · offered by {service.vendorCount} vendor
                      {service.vendorCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span data-numeric className="font-mono text-sm font-semibold text-ink">{pounds(service.priceMinor)}</span>
                  <button
                    type="button"
                    onClick={() => setEditingService(service.id)}
                    className="text-sm font-semibold text-accent-700 hover:underline"
                  >
                    Edit
                  </button>
                  <LiveSwitch
                    on={service.isActive}
                    busy={busy === `service:${service.id}`}
                    label={`${service.name} bookable`}
                    onToggle={() =>
                      run(`service:${service.id}`, `/api/admin/services/${service.id}`, "PATCH", { isActive: !service.isActive })
                    }
                  />
                  {service.bookingCount === 0 ? (
                    <button
                      type="button"
                      aria-label={`Delete ${service.name}`}
                      disabled={busy === `service:${service.id}`}
                      onClick={() => {
                        const menus = service.vendorCount
                          ? ` It will also come off ${service.vendorCount} vendor menu${service.vendorCount === 1 ? "" : "s"}.`
                          : "";
                        if (window.confirm(`Delete ${service.name}?${menus}`)) {
                          void run(`service:${service.id}`, `/api/admin/services/${service.id}`, "DELETE");
                        }
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-sunken hover:text-warning"
                    >
                      <Trash size={16} />
                    </button>
                  ) : (
                    <span className="h-9 w-9" aria-hidden />
                  )}
                </div>
              ),
            )
          )}
        </Card>
        <p className="mt-2 text-xs text-ink-muted">
          Switch a service off to take it off every menu and search. Services that have never been booked can be
          deleted; booked ones can only be switched off, because past invoices refer to them. The price here is the
          default; each vendor can set their own.
        </p>
      </section>
    </div>
  );
}

function CategoryForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial?: Category;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [blurb, setBlurb] = useState(initial?.blurb ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 100));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [image, setImage] = useState<UploadedImage | null>(
    initial?.imageUrl ? { url: initial.imageUrl, fileId: initial.imageFileId } : null,
  );

  return (
    <Card className="rise-in space-y-3 border-accent-500/50 p-4">
      <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
        <label className="block">
          <span className="text-xs text-ink-muted">Emoji</span>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={`${fieldClass} text-center text-lg`} maxLength={8} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} placeholder="e.g. Lashes & Brows" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-ink-muted">Short description</span>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} className={fieldClass} maxLength={160} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Order (lower shows first)</span>
          <input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[var(--glam-gold)]" />
          Visible on the site
        </label>
      </div>
      <ImageUpload folder="category" value={image} onChange={setImage} label="Tile photo" hint="Optional. Shown on category tiles." />
      {initial && name !== initial.name ? (
        <p className="text-xs text-warning">Renaming moves all {initial.serviceCount} services to the new name.</p>
      ) : null}
      <div className="flex gap-2">
        <Button
          disabled={busy || name.trim().length < 2}
          onClick={() =>
            onSave({
              name,
              emoji,
              blurb,
              sortOrder: Number(sortOrder) || 0,
              isActive,
              imageUrl: image?.url ?? "",
              imageFileId: image?.fileId ?? "",
            })
          }
        >
          {busy ? "Saving…" : initial ? "Save category" : "Add category"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function ServiceForm({
  categories,
  initial,
  initialCategory,
  busy,
  onSave,
  onCancel,
}: {
  categories: Category[];
  initial?: Service;
  initialCategory?: string;
  busy: boolean;
  onSave: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? initialCategory ?? "");
  const [kind, setKind] = useState<"SERVICE" | "ADDON">(initial?.kind ?? "SERVICE");
  const [price, setPrice] = useState(initial ? (initial.priceMinor / 100).toFixed(2) : "");
  const [duration, setDuration] = useState(String(initial?.durationMinutes ?? 60));

  const priceMinor = Math.round(Number(price) * 100);
  const valid = name.trim().length >= 2 && category && Number.isFinite(priceMinor) && priceMinor >= 0 && Number(duration) >= 5;

  return (
    <Card className="rise-in space-y-3 border-accent-500/50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-ink-muted">Service name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
            {categories.map((option) => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-ink-muted">Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} maxLength={500} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-ink-muted">Default price (£)</span>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={fieldClass} placeholder="45.00" />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Duration (minutes)</span>
          <input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-xs text-ink-muted">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as "SERVICE" | "ADDON")} className={fieldClass}>
            <option value="SERVICE">Service</option>
            <option value="ADDON">Add-on</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          disabled={busy || !valid}
          onClick={() =>
            onSave({ name, description, category, kind, priceMinor, durationMinutes: Number(duration) })
          }
        >
          {busy ? "Saving…" : initial ? "Save service" : "Add service"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
