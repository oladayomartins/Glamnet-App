import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

const PAGES = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/cancellations", label: "Cancellations & refunds" },
];

/** The shared frame for the legal pages: plain, readable, numbered. */
export function LegalPage({
  title,
  intro,
  sections,
  current,
}: {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
  current: string;
}) {
  return (
    <article className="mx-auto max-w-3xl pb-10">
      <nav aria-label="Legal" className="-mx-1 mb-6 flex flex-wrap gap-1.5">
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            aria-current={page.href === current ? "page" : undefined}
            className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              page.href === current ? "bg-metal text-metal-ink" : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
            }`}
          >
            {page.label}
          </Link>
        ))}
      </nav>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent-700">Last updated {LEGAL.lastUpdated}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-muted">{intro}</div>
      <ol className="mt-8 space-y-7">
        {sections.map((section, index) => (
          <li key={section.heading} id={`s${index + 1}`} className="scroll-mt-24">
            <h2 className="font-display text-lg font-semibold text-ink">
              <span className="mr-2 font-mono text-sm text-accent-700">{index + 1}.</span>
              {section.heading}
            </h2>
            <div className="legal-prose mt-2 space-y-2.5 text-[15px] leading-relaxed text-ink">{section.body}</div>
          </li>
        ))}
      </ol>
      <p className="mt-10 border-t border-line pt-5 text-sm text-ink-muted">
        Questions? Email{" "}
        <a href={`mailto:${LEGAL.contactEmail}`} className="font-semibold text-accent-700 hover:underline">
          {LEGAL.contactEmail}
        </a>
        .
      </p>
    </article>
  );
}

/** A tidy bulleted list for the legal pages. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-accent-700">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
