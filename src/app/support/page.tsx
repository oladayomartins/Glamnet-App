import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CreditCard, CalendarCheck, Storefront, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { HELP_ARTICLES, HELP_TOPICS, type HelpTopic } from "@/lib/domain/help-articles";
import { HelpSearch } from "./help-search";
import { ContactCta } from "./contact-cta";

export const metadata: Metadata = {
  title: "Help & support",
  description: "Answers about booking, payments, PINs, cancellations and selling on GLAMNET — or contact our team.",
  alternates: { canonical: "/support" },
};

const ICONS: Record<HelpTopic, React.ReactNode> = {
  booking: <CalendarCheck size={22} weight="light" aria-hidden />,
  payments: <CreditCard size={22} weight="light" aria-hidden />,
  vendors: <Storefront size={22} weight="light" aria-hidden />,
  account: <UserCircle size={22} weight="light" aria-hidden />,
};

/** The help centre: search, topics, then a way to reach a person. */
export default function SupportPage() {
  return (
    <div data-page-width="wide" className="space-y-12 pb-12">
      <header className="pt-4 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700">Help centre</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink sm:text-4xl">How can we help?</h1>
        <p className="mx-auto mt-2 max-w-xl text-[15px] text-ink-muted">
          Search our answers, or browse by topic. If you can&rsquo;t find what you need, send us a message.
        </p>
        <div className="mx-auto mt-6 max-w-xl text-left">
          <HelpSearch />
        </div>
      </header>

      <section aria-label="Topics" className="grid gap-6 md:grid-cols-2">
        {HELP_TOPICS.map((topic) => {
          const articles = HELP_ARTICLES.filter((article) => article.topic === topic.key);
          return (
            <div key={topic.key} id={topic.key} className="scroll-mt-24 rounded-glam border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  {ICONS[topic.key]}
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">{topic.title}</h2>
                  <p className="text-xs text-ink-muted">{topic.blurb}</p>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-line">
                {articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/support/${article.slug}`}
                      className="group flex min-h-11 items-center justify-between gap-3 py-2.5 text-[15px] text-ink hover:text-accent-700"
                    >
                      <span>{article.title}</span>
                      <ArrowRight size={14} className="shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-accent-700" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <ContactCta />
    </div>
  );
}
