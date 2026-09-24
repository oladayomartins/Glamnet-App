"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle, Trash } from "@phosphor-icons/react";
import { Button, Card, Pill } from "@/components/ui";
import { BioLink } from "@/components/bio-link";
import { DocumentUpload } from "@/components/document-upload";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { slugify } from "@/lib/domain/storefront";
import { formatDuration, formatMoney } from "@/lib/format";

interface Profile {
  name: string;
  phone: string;
  bio: string;
  slug: string;
  instagramHandle: string;
  tiktokHandle: string;
  workspaceType: string;
  workspacePostcode: string;
  travelsToClients: boolean;
  payoutsEnabled: boolean;
}

interface CatalogueItem {
  id: string;
  name: string;
  category: string;
  kind: string;
  priceMinor: number;
  durationMinutes: number;
}

interface MenuEntry {
  serviceId: string;
  priceMinor: number | null;
  durationMinutes: number | null;
}

const STEPS = [
  { key: "profile", label: "You" },
  { key: "storefront", label: "Link & bio" },
  { key: "workspace", label: "Workspace" },
  { key: "menu", label: "Menu" },
  { key: "lookbook", label: "Lookbook" },
  { key: "compliance", label: "Documents" },
  { key: "payouts", label: "Payouts" },
  { key: "review", label: "Go live" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const WORKSPACES = [
  ["HOME_SALON", "Home salon", "Clients come to your home studio"],
  ["PRIVATE_ROOM", "Private room", "A rented treatment room"],
  ["CHAIR", "Independent chair", "A chair in someone else's salon"],
  ["MOBILE", "Mobile only", "You always travel to clients"],
] as const;

const DOCUMENT_KINDS = [
  ["INSURANCE", "Public liability insurance"],
  ["LICENCE", "Practitioner / massage licence"],
  ["CERTIFICATE", "Beauty qualification certificate"],
] as const;

const inputClass =
  "mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-accent-500";

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message ?? "Could not save.");
  return payload;
}

export function OnboardingWizard(props: {
  initialStep: string | null;
  payoutsNotice: string | null;
  siteOrigin: string;
  testPayments: boolean;
  uploadsEnabled: boolean;
  approved: boolean;
  submitted: boolean;
  gaps: string[];
  profile: Profile;
  catalogue: CatalogueItem[];
  menu: MenuEntry[];
  documents: { id: string; kind: string; fileName: string; status: string }[];
  lookbook: { url: string; fileId: string; caption: string }[];
}) {
  const router = useRouter();
  const initialIndex = Math.max(0, STEPS.findIndex((step) => step.key === props.initialStep));
  const [index, setIndex] = useState(initialIndex);
  const [profile, setProfile] = useState(props.profile);
  const [menu, setMenu] = useState<MenuEntry[]>(props.menu);
  const [looks, setLooks] = useState<(UploadedImage & { caption: string } | null)[]>(() =>
    [0, 1, 2].map((at) => props.lookbook[at] ?? null),
  );
  const [docKind, setDocKind] = useState<string>("INSURANCE");
  const [slugState, setSlugState] = useState<"idle" | "free" | "taken">("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step: StepKey = STEPS[index].key;
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const run = async (work: () => Promise<unknown>, advance = true) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
      if (advance) setIndex((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const checkSlug = async (slug: string) => {
    if (!slug) return setSlugState("idle");
    const payload = await fetch(`/api/provider/slug?slug=${encodeURIComponent(slug)}`)
      .then((response) => response.json())
      .catch(() => null);
    setSlugState(payload?.available ? "free" : "taken");
  };

  const save = () => {
    switch (step) {
      case "profile":
        return run(() => send("/api/provider/profile", "PATCH", { name: profile.name, phone: profile.phone }));
      case "storefront":
        return run(() =>
          send("/api/provider/profile", "PATCH", {
            slug: profile.slug,
            bio: profile.bio,
            instagramHandle: profile.instagramHandle,
            tiktokHandle: profile.tiktokHandle,
          }),
        );
      case "workspace":
        return run(() =>
          send("/api/provider/profile", "PATCH", {
            workspaceType: profile.workspaceType,
            workspacePostcode: profile.workspacePostcode,
            travelsToClients: profile.workspaceType === "MOBILE" ? true : profile.travelsToClients,
          }),
        );
      case "menu":
        return run(() => send("/api/provider/menu", "PUT", { items: menu }));
      case "lookbook":
        return run(() =>
          send("/api/provider/lookbook", "PUT", {
            images: looks.filter(Boolean).map((look) => ({
              url: look!.url,
              fileId: look!.fileId,
              caption: look!.caption,
            })),
          }),
        );
      case "review":
        return run(() => send("/api/provider/onboarding", "POST"), false);
      default:
        setIndex((current) => Math.min(current + 1, STEPS.length - 1));
    }
  };

  const inMenu = (id: string) => menu.find((entry) => entry.serviceId === id);
  const toggleService = (id: string) =>
    setMenu((current) =>
      current.some((entry) => entry.serviceId === id)
        ? current.filter((entry) => entry.serviceId !== id)
        : [...current, { serviceId: id, priceMinor: null, durationMinutes: null }],
    );
  const editEntry = (id: string, patch: Partial<MenuEntry>) =>
    setMenu((current) =>
      current.map((entry) => (entry.serviceId === id ? { ...entry, ...patch } : entry)),
    );

  const categories = [...new Set(props.catalogue.map((item) => item.category))];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">
          {props.approved ? "Your storefront" : "Claim your free storefront page"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          {STEPS[index].label}
        </h1>
      </div>

      {/* Step rail */}
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Steps">
        {STEPS.map((entry, at) => (
          <li key={entry.key}>
            <button
              type="button"
              onClick={() => setIndex(at)}
              aria-current={at === index ? "step" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                at === index ? "bg-accent-500 text-metal-ink" : "bg-sunken text-ink-muted"
              }`}
            >
              {at + 1}. {entry.label}
            </button>
          </li>
        ))}
      </ol>

      <Card className="space-y-4 p-5">
        {step === "profile" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink">Your legal name</span>
              <input value={profile.name} onChange={(e) => set("name", e.target.value)} className={inputClass} autoComplete="name" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Mobile number</span>
              <input value={profile.phone} onChange={(e) => set("phone", e.target.value)} className={inputClass} autoComplete="tel" inputMode="tel" />
            </label>
          </>
        ) : null}

        {step === "storefront" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium text-ink">Your storefront link</span>
              <span className="mt-1 flex items-center rounded-glam-input border border-line bg-surface focus-within:border-accent-500">
                <span className="pl-3 text-sm text-ink-muted">{props.siteOrigin}/pro/</span>
                <input
                  value={profile.slug}
                  onChange={(e) => {
                    set("slug", slugify(e.target.value));
                    setSlugState("idle");
                  }}
                  onBlur={() => checkSlug(profile.slug)}
                  placeholder={slugify(profile.name) || "your-name"}
                  className="min-h-11 flex-1 bg-transparent px-1 text-[15px] text-ink outline-none"
                />
              </span>
              <span className={`mt-1 block text-xs ${slugState === "taken" ? "text-warning" : "text-ink-muted"}`}>
                {slugState === "taken"
                  ? "That link is taken or reserved."
                  : slugState === "free"
                    ? "That link is yours."
                    : "Letters, numbers and hyphens. This is what goes in your bio."}
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Bio</span>
              <textarea value={profile.bio} onChange={(e) => set("bio", e.target.value)} rows={4} maxLength={1000} className={inputClass} placeholder="What you specialise in, and what clients love about your work." />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Instagram</span>
                <input value={profile.instagramHandle} onChange={(e) => set("instagramHandle", e.target.value)} placeholder="@handle" className={inputClass} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">TikTok</span>
                <input value={profile.tiktokHandle} onChange={(e) => set("tiktokHandle", e.target.value)} placeholder="@handle" className={inputClass} />
              </label>
            </div>
          </>
        ) : null}

        {step === "workspace" ? (
          <>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium text-ink">Where do you work?</legend>
              {WORKSPACES.map(([value, label, hint]) => (
                <label key={value} className={`cursor-pointer rounded-glam-sm border p-3 ${profile.workspaceType === value ? "border-accent-500 bg-sunken" : "border-line"}`}>
                  <input type="radio" className="sr-only" checked={profile.workspaceType === value} onChange={() => set("workspaceType", value)} />
                  <span className="block text-sm font-semibold text-ink">{label}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </label>
              ))}
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium text-ink">
                {profile.workspaceType === "MOBILE" ? "Your base postcode" : "Workspace postcode"}
              </span>
              <input value={profile.workspacePostcode} onChange={(e) => set("workspacePostcode", e.target.value.toUpperCase())} placeholder="S10" className={inputClass} autoComplete="postal-code" />
              <span className="mt-1 block text-xs text-ink-muted">
                Only the sector (e.g. S10) is shown publicly — it sorts you by distance in the directory.
              </span>
            </label>
            {profile.workspaceType !== "MOBILE" ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={profile.travelsToClients} onChange={(e) => set("travelsToClients", e.target.checked)} className="h-5 w-5" />
                I also travel to clients&rsquo; homes
              </label>
            ) : null}
          </>
        ) : null}

        {step === "menu" ? (
          <div className="space-y-5">
            <p className="text-sm text-ink-muted">
              Tick what you offer. Leave price or time blank to use the suggested figure.
            </p>
            {categories.map((category) => (
              <div key={category}>
                <p className="mb-2 font-display text-sm font-bold text-ink">{category}</p>
                <ul className="divide-y divide-line rounded-glam border border-line">
                  {props.catalogue
                    .filter((item) => item.category === category)
                    .map((item) => {
                      const entry = inMenu(item.id);
                      return (
                        <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                          <label className="flex min-w-40 flex-1 items-center gap-2 text-sm text-ink">
                            <input type="checkbox" checked={Boolean(entry)} onChange={() => toggleService(item.id)} className="h-5 w-5" />
                            {item.name}
                            {item.kind === "ADDON" ? <Pill>Add-on</Pill> : null}
                          </label>
                          {entry ? (
                            <span className="flex gap-2">
                              <input
                                aria-label={`${item.name} price in pounds`}
                                inputMode="decimal"
                                placeholder={formatMoney(item.priceMinor)}
                                defaultValue={entry.priceMinor === null ? "" : (entry.priceMinor / 100).toFixed(2)}
                                onBlur={(e) => {
                                  const pounds = Number.parseFloat(e.target.value.replace(/[£,]/g, ""));
                                  editEntry(item.id, { priceMinor: Number.isFinite(pounds) ? Math.round(pounds * 100) : null });
                                }}
                                className="min-h-11 w-24 rounded-glam-input border border-line bg-surface px-2 text-sm text-ink"
                              />
                              <input
                                aria-label={`${item.name} minutes`}
                                inputMode="numeric"
                                placeholder={formatDuration(item.durationMinutes)}
                                defaultValue={entry.durationMinutes ?? ""}
                                onBlur={(e) => {
                                  const minutes = Number.parseInt(e.target.value, 10);
                                  editEntry(item.id, { durationMinutes: Number.isFinite(minutes) ? minutes : null });
                                }}
                                className="min-h-11 w-24 rounded-glam-input border border-line bg-surface px-2 text-sm text-ink"
                              />
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {step === "lookbook" ? (
          props.uploadsEnabled ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {looks.map((look, at) => (
                <div key={at} className="space-y-2">
                  <ImageUpload
                    folder="lookbook"
                    label={`Look ${at + 1}`}
                    value={look}
                    onChange={(image) =>
                      setLooks((current) =>
                        current.map((entry, position) =>
                          position === at ? (image ? { ...image, caption: entry?.caption ?? "" } : null) : entry,
                        ),
                      )
                    }
                  />
                  {look ? (
                    <input
                      value={look.caption}
                      maxLength={120}
                      placeholder="Caption (optional)"
                      onChange={(e) =>
                        setLooks((current) =>
                          current.map((entry, position) => (position === at && entry ? { ...entry, caption: e.target.value } : entry)),
                        )
                      }
                      className="min-h-11 w-full rounded-glam-input border border-line bg-surface px-2 text-sm text-ink"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Photo uploads are not configured on this deployment yet. You can skip this step.</p>
          )
        ) : null}

        {step === "compliance" ? (
          <>
            <p className="text-sm text-ink-muted">
              Upload your professional insurance, and any practitioner or massage licence. An admin
              checks these before your storefront goes live. Documents are stored privately.
            </p>
            {props.documents.length > 0 ? (
              <ul className="divide-y divide-line rounded-glam border border-line">
                {props.documents.map((document) => (
                  <li key={document.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{document.fileName || document.kind}</span>
                      <span className="text-xs text-ink-muted">{DOCUMENT_KINDS.find(([kind]) => kind === document.kind)?.[1]}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={document.status === "APPROVED" ? "positive" : "neutral"}>{document.status.toLowerCase()}</Pill>
                      {document.status !== "APPROVED" ? (
                        <button type="button" aria-label="Remove document" onClick={() => run(() => send(`/api/provider/documents/${document.id}`, "DELETE"), false)} className="tap-44 text-ink-muted hover:text-ink">
                          <Trash size={16} />
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="block">
              <span className="text-sm font-medium text-ink">Document type</span>
              <select value={docKind} onChange={(e) => setDocKind(e.target.value)} className={inputClass}>
                {DOCUMENT_KINDS.map(([kind, label]) => (
                  <option key={kind} value={kind}>{label}</option>
                ))}
              </select>
            </label>
            {props.uploadsEnabled ? (
              <DocumentUpload
                disabled={busy}
                onUploaded={(document) => run(() => send("/api/provider/documents", "POST", { kind: docKind, ...document }), false)}
              />
            ) : (
              <p className="text-sm text-warning">Uploads are not configured on this deployment.</p>
            )}
          </>
        ) : null}

        {step === "payouts" ? (
          <>
            <p className="text-sm text-ink-muted">
              Payments are held on the client&rsquo;s card and released to your bank when they give you
              their PIN at the end of the appointment. Link your bank through Stripe to receive them.
            </p>
            {props.payoutsNotice === "incomplete" ? (
              <p className="text-sm text-warning">Stripe still needs a few details. Pick up where you left off.</p>
            ) : null}
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              {profile.payoutsEnabled ? <CheckCircle size={18} weight="fill" className="text-normal" /> : <Circle size={18} />}
              {profile.payoutsEnabled ? "Bank account linked" : "No bank account linked yet"}
            </p>
            <a href="/api/provider/payouts" className="inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink">
              {profile.payoutsEnabled ? "Update payout details" : "Link my bank with Stripe"}
            </a>
            {props.testPayments ? (
              <p className="text-xs text-ink-muted">Test mode: no Stripe account is configured, so this links instantly.</p>
            ) : null}
          </>
        ) : null}

        {step === "review" ? (
          <>
            {props.gaps.length > 0 ? (
              <ul className="space-y-2">
                {props.gaps.map((gap) => (
                  <li key={gap} className="flex items-start gap-2 text-sm text-ink">
                    <Circle size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
                    {gap}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-ink">
                <CheckCircle size={18} weight="fill" className="text-normal" /> Everything is in place.
              </p>
            )}
            {profile.slug ? <BioLink origin={props.siteOrigin} slug={profile.slug} /> : null}
            <p className="text-sm text-ink-muted">
              {props.approved
                ? "Your storefront is live. Changes you save here show immediately."
                : props.submitted
                  ? "Submitted. An admin is reviewing your documents — your link goes live the moment you are verified."
                  : "Submit for review. Once your documents are checked you are verified, your calendar opens and your link goes live."}
            </p>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
            {error}
          </p>
        ) : null}

        <div className="flex justify-between gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0 || busy}>
            Back
          </Button>
          {step === "review" ? (
            props.approved || props.submitted ? (
              <Link href="/provider" className="inline-flex min-h-11 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink">
                Go to my dashboard
              </Link>
            ) : (
              <Button onClick={save} disabled={busy || props.gaps.length > 0}>
                {busy ? "Submitting…" : "Submit for review"}
              </Button>
            )
          ) : (
            <Button onClick={save} disabled={busy || (step === "storefront" && slugState === "taken")}>
              {busy ? "Saving…" : "Save and continue"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
