"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Bank,
  Car,
  Check,
  CheckCircle,
  Circle,
  Door,
  House,
  IdentificationCard,
  Images,
  InstagramLogo,
  MapPin,
  Minus,
  Plus,
  SealCheck,
  Sparkle,
  Storefront,
  TiktokLogo,
  Trash,
} from "@phosphor-icons/react";
import { Pill } from "@/components/ui";
import { BioLink } from "@/components/bio-link";
import { BrandImage } from "@/components/brand-image";
import { DocumentUpload } from "@/components/document-upload";
import { ImageUpload, type UploadedImage } from "@/components/image-upload";
import { SPECIALTY_HUBS } from "@/lib/domain/specialty-hubs";
import { slugify } from "@/lib/domain/storefront";
import { categoryImagePath } from "@/lib/imagekit";
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

type Look = (UploadedImage & { caption: string }) | null;

const STEPS = [
  { key: "profile", label: "You", title: "Let's build your storefront", lede: "Two minutes, eight short steps. Everything can be changed later." },
  { key: "specialties", label: "Specialties", title: "What do you specialise in?", lede: "Pick every hub you work in. Clients browse the directory by these." },
  { key: "menu", label: "Menu", title: "Build your menu", lede: "Tap the services you offer, then set your own price and time." },
  { key: "storefront", label: "Link & bio", title: "Claim your link", lede: "This is the page you share in your bio — clients from it cost you 0% commission." },
  { key: "workspace", label: "Workspace", title: "Where do clients find you?", lede: "Only your postcode sector is ever shown publicly." },
  { key: "lookbook", label: "Lookbook", title: "Show your best work", lede: "Three transformations sell better than any description. Optional for now." },
  { key: "compliance", label: "Documents", title: "Get verified", lede: "Upload your insurance or licence. We check it before your storefront goes live." },
  { key: "payouts", label: "Payouts", title: "Link your bank", lede: "Payments are released to you by your client's PIN, straight through Stripe." },
  { key: "review", label: "Go live", title: "Ready when you are", lede: "Here's everything in one place." },
] as const;

const WORKSPACES = [
  { value: "HOME_SALON", label: "Home salon", hint: "Clients come to your home studio", icon: House },
  { value: "PRIVATE_ROOM", label: "Private room", hint: "A treatment room you rent", icon: Door },
  { value: "CHAIR", label: "Independent chair", hint: "A chair in someone's salon", icon: Armchair },
  { value: "MOBILE", label: "Mobile only", hint: "You always travel to clients", icon: Car },
] as const;

const DOCUMENT_KINDS = [
  ["INSURANCE", "Public liability insurance"],
  ["LICENCE", "Practitioner / massage licence"],
  ["CERTIFICATE", "Beauty qualification certificate"],
] as const;

const inputClass =
  "mt-1.5 min-h-12 w-full rounded-glam-input border border-line bg-surface px-3.5 text-[15px] text-ink outline-none transition duration-[180ms] ease-glam placeholder:text-ink-muted/70 focus:border-accent-500 focus:ring-4 focus:ring-accent-500/15";

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

/**
 * The Pro onboarding wizard (Directory §C, Flow 3).
 *
 * One question per screen, a progress bar, and a live preview of the
 * storefront beside the form on wide screens, so a pro watches their page
 * assemble as they answer. Steps slide in from the direction of travel;
 * every animation is switched off under prefers-reduced-motion.
 *
 * Specialties come first because they shape the menu: choosing hubs filters
 * the catalogue to those crafts, and dropping a hub drops its services.
 */
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
  const start = Math.max(0, STEPS.findIndex((step) => step.key === props.initialStep));
  const [index, setIndex] = useState(start);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [profile, setProfile] = useState(props.profile);
  const [menu, setMenu] = useState<MenuEntry[]>(props.menu);
  const [hubs, setHubs] = useState<string[]>(() => {
    const fromMenu = new Set(
      props.menu
        .map((entry) => props.catalogue.find((item) => item.id === entry.serviceId)?.category)
        .filter((category): category is string => Boolean(category)),
    );
    return SPECIALTY_HUBS.map((hub) => hub.name).filter((name) => fromMenu.has(name));
  });
  const [looks, setLooks] = useState<Look[]>(() => [0, 1, 2].map((at) => props.lookbook[at] ?? null));
  const [docKind, setDocKind] = useState<string>("INSURANCE");
  const [slugState, setSlugState] = useState<"idle" | "checking" | "free" | "taken">(
    props.profile.slug ? "free" : "idle",
  );
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[index];
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const go = (to: number) => {
    setDirection(to >= index ? "forward" : "back");
    setError(null);
    setIndex(Math.max(0, Math.min(to, STEPS.length - 1)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const run = async (work: () => Promise<unknown>, advance = true) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
      if (advance) go(index + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  // --- Link availability, checked as they type ------------------------------
  const onSlugChange = (raw: string) => {
    const slug = slugify(raw);
    set("slug", slug);
    if (slugTimer.current) clearTimeout(slugTimer.current);
    if (!slug) return setSlugState("idle");
    setSlugState("checking");
    slugTimer.current = setTimeout(async () => {
      const payload = await fetch(`/api/provider/slug?slug=${encodeURIComponent(slug)}`)
        .then((response) => response.json())
        .catch(() => null);
      setSlugState(payload?.available ? "free" : "taken");
    }, 350);
  };

  // --- Menu helpers ------------------------------------------------------------
  const catalogueFor = (hub: string) => props.catalogue.filter((item) => item.category === hub);
  const entryFor = (id: string) => menu.find((entry) => entry.serviceId === id);
  const toggleService = (id: string) =>
    setMenu((current) =>
      current.some((entry) => entry.serviceId === id)
        ? current.filter((entry) => entry.serviceId !== id)
        : [...current, { serviceId: id, priceMinor: null, durationMinutes: null }],
    );
  const editEntry = (id: string, patch: Partial<MenuEntry>) =>
    setMenu((current) => current.map((entry) => (entry.serviceId === id ? { ...entry, ...patch } : entry)));

  const toggleHub = (name: string) =>
    setHubs((current) => (current.includes(name) ? current.filter((hub) => hub !== name) : [...current, name]));

  const chosenItems = menu
    .map((entry) => {
      const item = props.catalogue.find((candidate) => candidate.id === entry.serviceId);
      return item
        ? {
            ...item,
            priceMinor: entry.priceMinor ?? item.priceMinor,
            durationMinutes: entry.durationMinutes ?? item.durationMinutes,
          }
        : null;
    })
    .filter((item): item is CatalogueItem => item !== null);
  const fromMinor = chosenItems.filter((item) => item.kind !== "ADDON").reduce<number | null>(
    (min, item) => (min === null || item.priceMinor < min ? item.priceMinor : min),
    null,
  );

  // --- Continue -----------------------------------------------------------------
  const canContinue = (() => {
    switch (step.key) {
      case "profile":
        return profile.name.trim().length >= 2;
      case "specialties":
        return hubs.length > 0;
      case "menu":
        return chosenItems.some((item) => item.kind !== "ADDON");
      case "storefront":
        return slugState === "free" && profile.bio.trim().length >= 20;
      default:
        return true;
    }
  })();

  const save = () => {
    switch (step.key) {
      case "profile":
        return run(() => send("/api/provider/profile", "PATCH", { name: profile.name, phone: profile.phone }));
      case "specialties": {
        // Dropping a hub drops its services, so the menu never lists a craft
        // the pro has just said they do not do.
        const allowed = new Set(props.catalogue.filter((item) => hubs.includes(item.category)).map((item) => item.id));
        setMenu((current) => current.filter((entry) => allowed.has(entry.serviceId)));
        return go(index + 1);
      }
      case "menu":
        return run(() => send("/api/provider/menu", "PUT", { items: menu }));
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
      case "lookbook":
        return run(() =>
          send("/api/provider/lookbook", "PUT", {
            images: looks.filter((look): look is NonNullable<Look> => look !== null),
          }),
        );
      case "review":
        return run(() => send("/api/provider/onboarding", "POST"), false);
      default:
        return go(index + 1);
    }
  };

  const progress = ((index + 1) / STEPS.length) * 100;

  // A tick means the step is actually done, not merely passed — skipping
  // ahead to Documents must not show Documents as finished.
  const done: Record<(typeof STEPS)[number]["key"], boolean> = {
    profile: profile.name.trim().length >= 2,
    specialties: hubs.length > 0,
    menu: chosenItems.some((item) => item.kind !== "ADDON"),
    storefront: Boolean(profile.slug) && profile.bio.trim().length >= 20,
    workspace: profile.workspaceType === "MOBILE" || Boolean(profile.workspacePostcode.trim()),
    lookbook: looks.some((look) => look !== null),
    compliance: props.documents.length > 0,
    payouts: profile.payoutsEnabled,
    review: props.submitted || props.approved,
  };

  return (
    <div data-page-width="wide" className="mx-auto grid gap-10 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div>
        {/* --- Progress --------------------------------------------------- */}
        <div className="flex items-center justify-between gap-4 text-xs text-ink-muted">
          <span className="font-mono uppercase tracking-[0.18em] text-accent-700">
            {props.approved ? "Your storefront" : "Claim your free storefront"}
          </span>
          <span data-numeric>
            Step {index + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div
            className="h-full rounded-full bg-metal transition-[width] duration-[480ms] ease-glam"
            style={{ width: `${progress}%` }}
          />
        </div>
        <nav aria-label="Steps" className="mt-3 hidden gap-1 overflow-x-auto pb-1 sm:flex">
          {STEPS.map((entry, at) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => go(at)}
              aria-current={at === index ? "step" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition duration-[180ms] ease-glam ${
                at === index
                  ? "bg-accent-100 text-accent-700"
                  : done[entry.key]
                    ? "text-ink hover:bg-sunken"
                    : "text-ink-muted hover:bg-sunken"
              }`}
            >
              {done[entry.key] ? <Check size={11} weight="bold" className="mr-1 inline text-normal" aria-hidden /> : null}
              {entry.label}
            </button>
          ))}
        </nav>

        {/* --- The step ----------------------------------------------------- */}
        <form
          key={step.key}
          onSubmit={(event) => {
            event.preventDefault();
            if (canContinue && !busy) void save();
          }}
          className={`mt-8 ${direction === "forward" ? "step-forward" : "step-back"}`}
        >
          <h1 className="font-display text-3xl font-bold tracking-[-0.025em] text-ink sm:text-[2.25rem]">
            {step.title}
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-ink-muted">{step.lede}</p>

          <div className="mt-8">
            {step.key === "profile" ? (
              <div className="max-w-md space-y-4">
                <Field label="Your name or business name">
                  <input
                    autoFocus
                    value={profile.name}
                    onChange={(e) => set("name", e.target.value)}
                    autoComplete="name"
                    placeholder="e.g. Grace Braids"
                    className={inputClass}
                  />
                </Field>
                <Field label="Mobile number" hint="Only used by GLAMNET about bookings — never shown to clients.">
                  <input
                    value={profile.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="07…"
                    className={inputClass}
                  />
                </Field>
              </div>
            ) : null}

            {step.key === "specialties" ? (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {SPECIALTY_HUBS.map((hub, at) => {
                  const selected = hubs.includes(hub.name);
                  const image = categoryImagePath(hub.name);
                  return (
                    <button
                      key={hub.slug}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleHub(hub.name)}
                      style={{ animationDelay: `${at * 50}ms` }}
                      className={`rise-in group relative overflow-hidden rounded-glam-lg border text-left transition duration-[240ms] ease-glam hover:-translate-y-0.5 ${
                        selected
                          ? "border-accent-500 shadow-raised ring-2 ring-accent-500/40"
                          : "border-line hover:border-accent-500/60"
                      }`}
                    >
                      <span className="relative block aspect-[4/3] overflow-hidden bg-metal sm:aspect-[16/9]">
                        {image ? (
                          <BrandImage
                            path={image}
                            alt=""
                            width={480}
                            height={270}
                            className={`h-full w-full object-cover transition duration-[480ms] ease-glam group-hover:scale-105 ${
                              selected ? "" : "opacity-80 saturate-[.85]"
                            }`}
                          />
                        ) : null}
                        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-obsidian/70 via-obsidian/10 to-transparent" />
                        <span aria-hidden className="absolute bottom-2 left-3 text-2xl drop-shadow">{hub.emoji}</span>
                        <span
                          aria-hidden
                          className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition duration-[240ms] ease-glam ${
                            selected ? "bg-metal text-metal-ink" : "bg-obsidian/60 text-on-obsidian ring-1 ring-white/40"
                          }`}
                        >
                          {selected ? <Check size={15} weight="bold" className="pop-in" /> : <Plus size={14} weight="bold" />}
                        </span>
                      </span>
                      <span className="block bg-surface p-3 sm:p-4">
                        <span className="block font-display text-sm font-bold leading-tight text-ink sm:text-[15px]">{hub.name}</span>
                        <span className="mt-0.5 hidden text-xs text-ink-muted sm:block">{hub.blurb}</span>
                        <span className="mt-1.5 block text-[11px] font-medium text-accent-700 sm:mt-2">
                          {catalogueFor(hub.name).length} services to choose from
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {step.key === "menu" ? (
              <div className="space-y-8">
                {hubs.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Choose at least one specialty first.{" "}
                    <button type="button" onClick={() => go(1)} className="font-semibold text-accent-700 hover:underline">
                      Pick specialties
                    </button>
                  </p>
                ) : null}
                {hubs.map((hub) => (
                  <section key={hub}>
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                      <span aria-hidden>{SPECIALTY_HUBS.find((entry) => entry.name === hub)?.emoji}</span>
                      {hub}
                    </h2>
                    <ul className="mt-3 grid items-start gap-2.5 sm:grid-cols-2">
                      {catalogueFor(hub).map((item) => {
                        const entry = entryFor(item.id);
                        const price = entry?.priceMinor ?? item.priceMinor;
                        const minutes = entry?.durationMinutes ?? item.durationMinutes;
                        return (
                          <li
                            key={item.id}
                            className={`rounded-glam border bg-surface transition duration-[240ms] ease-glam ${
                              entry ? "border-accent-500 shadow-card" : "border-line hover:border-accent-500/60"
                            }`}
                          >
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={Boolean(entry)}
                              onClick={() => toggleService(item.id)}
                              className="flex w-full items-center gap-3 p-3.5 text-left"
                            >
                              <span
                                aria-hidden
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition duration-[240ms] ease-glam ${
                                  entry ? "bg-metal text-metal-ink" : "ring-1 ring-line"
                                }`}
                              >
                                {entry ? <Check size={13} weight="bold" className="pop-in" /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                                  {item.name}
                                  {item.kind === "ADDON" ? <Pill>Add-on</Pill> : null}
                                </span>
                                <span className="text-xs text-ink-muted">
                                  Suggested {formatMoney(item.priceMinor)} · {formatDuration(item.durationMinutes)}
                                </span>
                              </span>
                            </button>
                            {entry ? (
                              <div className="rise-in grid grid-cols-2 gap-3 border-t border-line px-3.5 pb-3.5 pt-3">
                                <Stepper
                                  label="Your price"
                                  value={formatMoney(price)}
                                  onDecrease={() => editEntry(item.id, { priceMinor: Math.max(0, price - 500) })}
                                  onIncrease={() => editEntry(item.id, { priceMinor: price + 500 })}
                                />
                                <Stepper
                                  label="Your time"
                                  value={formatDuration(minutes)}
                                  onDecrease={() => editEntry(item.id, { durationMinutes: Math.max(15, minutes - 15) })}
                                  onIncrease={() => editEntry(item.id, { durationMinutes: Math.min(720, minutes + 15) })}
                                />
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}

            {step.key === "storefront" ? (
              <div className="max-w-lg space-y-5">
                <Field label="Your storefront link">
                  <span
                    className={`mt-1.5 flex items-center rounded-glam-input border bg-surface transition duration-[180ms] ease-glam focus-within:ring-4 focus-within:ring-accent-500/15 ${
                      slugState === "taken" ? "border-warning" : "border-line focus-within:border-accent-500"
                    }`}
                  >
                    <span className="pl-3.5 text-sm text-ink-muted">{props.siteOrigin}/pro/</span>
                    <input
                      autoFocus
                      value={profile.slug}
                      onChange={(e) => onSlugChange(e.target.value)}
                      placeholder={slugify(profile.name) || "your-name"}
                      className="min-h-12 flex-1 bg-transparent px-1 text-[15px] text-ink outline-none"
                    />
                    <span className="pr-3.5" aria-live="polite">
                      {slugState === "checking" ? (
                        <span className="block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent-500" />
                      ) : slugState === "free" ? (
                        <CheckCircle size={20} weight="fill" className="pop-in text-normal" aria-label="Available" />
                      ) : null}
                    </span>
                  </span>
                  <span className={`mt-1.5 block text-xs ${slugState === "taken" ? "text-warning" : "text-ink-muted"}`}>
                    {slugState === "taken"
                      ? "That link is taken or reserved — try another."
                      : slugState === "free"
                        ? "Nice — that link is yours."
                        : "Letters, numbers and hyphens."}
                  </span>
                  {!profile.slug && profile.name ? (
                    <button
                      type="button"
                      onClick={() => onSlugChange(profile.name)}
                      className="mt-1 text-xs font-semibold text-accent-700 hover:underline"
                    >
                      Use {slugify(profile.name)}
                    </button>
                  ) : null}
                </Field>
                <Field label="Bio" hint={`${profile.bio.trim().length}/1000 · at least 20 characters`}>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => set("bio", e.target.value.slice(0, 1000))}
                    rows={4}
                    placeholder="What you specialise in, and what clients love about your work."
                    className={`${inputClass} py-3`}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Instagram">
                    <span className="relative block">
                      <InstagramLogo size={16} className="absolute left-3.5 top-[calc(50%+3px)] -translate-y-1/2 text-ink-muted" aria-hidden />
                      <input value={profile.instagramHandle} onChange={(e) => set("instagramHandle", e.target.value)} placeholder="@handle" className={`${inputClass} pl-9`} />
                    </span>
                  </Field>
                  <Field label="TikTok">
                    <span className="relative block">
                      <TiktokLogo size={16} className="absolute left-3.5 top-[calc(50%+3px)] -translate-y-1/2 text-ink-muted" aria-hidden />
                      <input value={profile.tiktokHandle} onChange={(e) => set("tiktokHandle", e.target.value)} placeholder="@handle" className={`${inputClass} pl-9`} />
                    </span>
                  </Field>
                </div>
              </div>
            ) : null}

            {step.key === "workspace" ? (
              <div className="max-w-2xl space-y-6">
                <div role="radiogroup" aria-label="Where you work" className="grid gap-3 sm:grid-cols-2">
                  {WORKSPACES.map(({ value, label, hint, icon: Icon }) => {
                    const selected = profile.workspaceType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => set("workspaceType", value)}
                        className={`flex items-center gap-4 rounded-glam border p-4 text-left transition duration-[240ms] ease-glam hover:-translate-y-0.5 ${
                          selected ? "border-accent-500 bg-accent-100/40 shadow-card" : "border-line bg-surface hover:border-accent-500/60"
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition duration-[240ms] ease-glam ${
                            selected ? "bg-metal text-metal-ink" : "bg-sunken text-ink-muted"
                          }`}
                        >
                          <Icon size={20} weight={selected ? "fill" : "regular"} aria-hidden />
                        </span>
                        <span>
                          <span className="block text-[15px] font-semibold text-ink">{label}</span>
                          <span className="block text-xs text-ink-muted">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={profile.workspaceType === "MOBILE" ? "Your base postcode" : "Workspace postcode"} hint="Only the sector (e.g. S10) is shown.">
                    <span className="relative block">
                      <MapPin size={16} className="absolute left-3.5 top-[calc(50%+3px)] -translate-y-1/2 text-ink-muted" aria-hidden />
                      <input
                        value={profile.workspacePostcode}
                        onChange={(e) => set("workspacePostcode", e.target.value.toUpperCase())}
                        placeholder="S10"
                        autoComplete="postal-code"
                        className={`${inputClass} pl-9`}
                      />
                    </span>
                  </Field>
                  {profile.workspaceType !== "MOBILE" ? (
                    <div className="flex items-end">
                      <Toggle
                        checked={profile.travelsToClients}
                        onChange={(checked) => set("travelsToClients", checked)}
                        label="I also travel to clients"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step.key === "lookbook" ? (
              props.uploadsEnabled ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  {looks.map((look, at) => (
                    <div key={at} className="rise-in space-y-2" style={{ animationDelay: `${at * 60}ms` }}>
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
                          className={inputClass}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <Notice icon={<Images size={20} />}>Photo uploads are not switched on yet. Skip this step and add your looks later.</Notice>
              )
            ) : null}

            {step.key === "compliance" ? (
              <div className="max-w-lg space-y-4">
                {props.documents.length > 0 ? (
                  <ul className="space-y-2">
                    {props.documents.map((document) => (
                      <li key={document.id} className="rise-in flex items-center justify-between gap-3 rounded-glam border border-line bg-surface p-3.5 text-sm">
                        <span className="flex min-w-0 items-center gap-3">
                          <IdentificationCard size={20} className="shrink-0 text-accent-700" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{document.fileName || document.kind}</span>
                            <span className="text-xs text-ink-muted">{DOCUMENT_KINDS.find(([kind]) => kind === document.kind)?.[1]}</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Pill tone={document.status === "APPROVED" ? "positive" : "neutral"}>{document.status.toLowerCase()}</Pill>
                          {document.status !== "APPROVED" ? (
                            <button
                              type="button"
                              aria-label="Remove document"
                              onClick={() => run(() => send(`/api/provider/documents/${document.id}`, "DELETE"), false)}
                              className="tap-44 text-ink-muted hover:text-ink"
                            >
                              <Trash size={16} />
                            </button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_KINDS.map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setDocKind(kind)}
                      aria-pressed={docKind === kind}
                      className={`min-h-10 rounded-full px-3.5 text-xs font-semibold transition duration-[180ms] ease-glam ${
                        docKind === kind ? "bg-accent-100 text-accent-700 ring-1 ring-accent-500" : "text-ink-muted ring-1 ring-line hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {props.uploadsEnabled ? (
                  <DocumentUpload
                    disabled={busy}
                    onUploaded={(document) => run(() => send("/api/provider/documents", "POST", { kind: docKind, ...document }), false)}
                  />
                ) : (
                  <Notice icon={<IdentificationCard size={20} />}>Uploads are not switched on yet on this site.</Notice>
                )}
                <p className="text-xs text-ink-muted">Photos or PDFs, stored privately. Only GLAMNET&rsquo;s admin team can open them.</p>
              </div>
            ) : null}

            {step.key === "payouts" ? (
              <div className="max-w-lg space-y-4">
                <div className={`flex items-center gap-4 rounded-glam border p-4 ${profile.payoutsEnabled ? "border-normal/50 bg-normal-soft" : "border-line bg-surface"}`}>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${profile.payoutsEnabled ? "bg-normal text-on-emergency" : "bg-sunken text-ink-muted"}`}>
                    {profile.payoutsEnabled ? <Check size={20} weight="bold" className="pop-in" /> : <Bank size={20} />}
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-ink">
                      {profile.payoutsEnabled ? "Bank account linked" : "No bank account linked yet"}
                    </span>
                    <span className="block text-xs text-ink-muted">Secured by Stripe — GLAMNET never sees your bank details.</span>
                  </span>
                </div>
                {props.payoutsNotice === "incomplete" ? (
                  <p className="text-sm text-warning">Stripe still needs a few details. Pick up where you left off.</p>
                ) : null}
                <a
                  href="/api/provider/payouts"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-6 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam hover:brightness-105 active:scale-[0.98]"
                >
                  <Bank size={16} weight="bold" aria-hidden />
                  {profile.payoutsEnabled ? "Update payout details" : "Link my bank with Stripe"}
                </a>
                {props.testPayments ? (
                  <p className="text-xs text-ink-muted">Test mode: no Stripe account is configured, so this links instantly.</p>
                ) : null}
              </div>
            ) : null}

            {step.key === "review" ? (
              <div className="max-w-lg space-y-5">
                <ul className="space-y-2">
                  {[
                    ["Specialties chosen", hubs.length > 0],
                    ["Menu with at least one service", chosenItems.some((item) => item.kind !== "ADDON")],
                    ["Storefront link and bio", Boolean(profile.slug) && profile.bio.trim().length >= 20],
                    ["Insurance or licence uploaded", props.documents.length > 0],
                    ["Bank linked for payouts", profile.payoutsEnabled],
                  ].map(([label, done], at) => (
                    <li
                      key={String(label)}
                      style={{ animationDelay: `${at * 70}ms` }}
                      className="rise-in flex items-center gap-3 rounded-glam border border-line bg-surface p-3.5 text-sm"
                    >
                      {done ? (
                        <CheckCircle size={20} weight="fill" className="pop-in shrink-0 text-normal" aria-hidden />
                      ) : (
                        <Circle size={20} className="shrink-0 text-ink-muted" aria-hidden />
                      )}
                      <span className={done ? "text-ink" : "text-ink-muted"}>{label}</span>
                    </li>
                  ))}
                </ul>
                {props.gaps.length > 0 && !props.approved ? (
                  <ul className="space-y-1 text-sm text-warning">
                    {props.gaps.map((gap) => (
                      <li key={gap}>• {gap}</li>
                    ))}
                  </ul>
                ) : null}
                {profile.slug ? <BioLink origin={props.siteOrigin} slug={profile.slug} /> : null}
                <p className="text-sm text-ink-muted">
                  {props.approved
                    ? "You're live. Changes you save here show on your storefront straight away."
                    : props.submitted
                      ? "Submitted — we're checking your documents. Your link goes live the moment you're verified."
                      : "Submit for review. Once your documents are checked you're verified and your storefront goes live."}
                </p>
              </div>
            ) : null}
          </div>

          {error ? (
            <p role="alert" className="rise-in mt-6 rounded-glam border-l-4 border-warning bg-sunken p-3 text-sm text-ink">
              {error}
            </p>
          ) : null}

          {/* --- Navigation --------------------------------------------------- */}
          {/* Pinned to the bottom of the screen on phones, so Continue is
              always in reach however long the step is. */}
          <div className="safe-bottom sticky bottom-0 z-10 -mx-4 mt-10 flex items-center justify-between gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0 || busy}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-muted transition duration-[180ms] ease-glam hover:text-ink disabled:invisible"
            >
              <ArrowLeft size={16} weight="bold" aria-hidden />
              Back
            </button>
            {step.key === "review" && (props.approved || props.submitted) ? (
              <Link
                href="/provider"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-7 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam hover:brightness-105"
              >
                Go to my dashboard <ArrowRight size={16} weight="bold" aria-hidden />
              </Link>
            ) : (
              <button
                type="submit"
                disabled={busy || !canContinue || (step.key === "review" && props.gaps.length > 0)}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-metal px-7 text-sm font-bold text-metal-ink shadow-card transition duration-[180ms] ease-glam hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-metal-ink/30 border-t-metal-ink" aria-hidden />
                ) : null}
                {step.key === "review"
                  ? busy
                    ? "Submitting…"
                    : "Submit for review"
                  : step.key === "lookbook" && looks.every((look) => look === null)
                    ? "Skip for now"
                    : busy
                      ? "Saving…"
                      : "Continue"}
                {!busy && step.key !== "review" ? <ArrowRight size={16} weight="bold" aria-hidden /> : null}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* --- Live storefront preview ------------------------------------------ */}
      <aside aria-label="Storefront preview" className="hidden lg:sticky lg:top-24 lg:block">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Live preview</p>
        <div className="overflow-hidden rounded-glam-lg border border-line bg-surface shadow-raised">
          <div className="relative grid aspect-[16/9] grid-cols-3 gap-0.5 bg-metal">
            {looks.map((look, at) =>
              look ? (
                // eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview
                <img key={at} src={`${look.url}?tr=w-240,h-270,fo-auto`} alt="" className="pop-in h-full w-full object-cover" />
              ) : (
                <span key={at} className="flex items-center justify-center text-metal-ink/35">
                  <Images size={22} aria-hidden />
                </span>
              ),
            )}
          </div>
          <div className="p-5">
            <p className="flex items-center gap-1.5 font-display text-xl font-bold text-ink">
              <span className="truncate">{profile.name || "Your name"}</span>
              <SealCheck size={18} weight="fill" className={props.approved ? "text-accent-500" : "text-ink-muted/40"} aria-label={props.approved ? "Verified" : "Verification pending"} />
            </p>
            <p className="mt-1 truncate font-mono text-xs text-accent-700">
              {props.siteOrigin}/pro/{profile.slug || "your-link"}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin size={12} aria-hidden />
              {WORKSPACES.find((entry) => entry.value === profile.workspaceType)?.label}
              {profile.workspacePostcode ? ` · ${profile.workspacePostcode.split(" ")[0]}` : ""}
            </p>
            {profile.bio ? <p className="mt-3 line-clamp-3 text-sm text-ink-muted">{profile.bio}</p> : null}
            {hubs.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hubs.map((hub) => (
                  <span key={hub} className="pop-in rounded-full bg-sunken px-2.5 py-1 text-[11px] font-medium text-ink ring-1 ring-line">
                    {SPECIALTY_HUBS.find((entry) => entry.name === hub)?.emoji} {hub}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 border-t border-line pt-3">
              {chosenItems.length === 0 ? (
                <p className="text-xs text-ink-muted">Your menu appears here.</p>
              ) : (
                <ul className="space-y-1.5">
                  {chosenItems.slice(0, 5).map((item) => (
                    <li key={item.id} className="rise-in flex justify-between gap-3 text-sm">
                      <span className="truncate text-ink">{item.name}</span>
                      <span data-numeric className="shrink-0 font-semibold text-ink">{formatMoney(item.priceMinor)}</span>
                    </li>
                  ))}
                  {chosenItems.length > 5 ? (
                    <li className="text-xs text-ink-muted">+{chosenItems.length - 5} more</li>
                  ) : null}
                </ul>
              )}
              {fromMinor !== null ? (
                <p className="mt-3 flex items-center justify-between text-xs text-ink-muted">
                  <span className="flex items-center gap-1"><Storefront size={13} aria-hidden /> Bookable online</span>
                  <span>from <span className="font-bold text-accent-700">{formatMoney(fromMinor)}</span></span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <Sparkle size={12} weight="fill" className="text-accent-500" aria-hidden />
          This is how clients will see your storefront.
        </p>
      </aside>
    </div>
  );
}

/* ---- Small building blocks -------------------------------------------------- */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span> : null}
    </label>
  );
}

function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">{label}</span>
      <div className="mt-1 flex items-center justify-between rounded-full bg-sunken p-1 ring-1 ring-line">
        <button type="button" onClick={onDecrease} aria-label={`Lower ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition duration-[120ms] ease-glam hover:bg-surface active:scale-90">
          <Minus size={13} weight="bold" />
        </button>
        <span data-numeric className="text-sm font-bold text-ink" aria-live="polite">{value}</span>
        <button type="button" onClick={onIncrease} aria-label={`Raise ${label.toLowerCase()}`} className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition duration-[120ms] ease-glam hover:bg-surface active:scale-90">
          <Plus size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 items-center gap-3 text-sm font-medium text-ink"
    >
      <span className={`relative h-7 w-12 rounded-full transition duration-[240ms] ease-glam ${checked ? "bg-metal" : "bg-sunken ring-1 ring-line"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full shadow-card transition-all duration-[240ms] ease-glam ${checked ? "left-6 bg-obsidian" : "left-1 bg-ink-muted"}`} />
      </span>
      {label}
    </button>
  );
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex max-w-lg items-center gap-3 rounded-glam border border-dashed border-line bg-surface p-4 text-sm text-ink-muted">
      <span className="text-accent-700">{icon}</span>
      {children}
    </p>
  );
}
