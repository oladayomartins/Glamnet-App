import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HELP_ARTICLES, HELP_TOPICS, articleBySlug } from "@/lib/domain/help-articles";
import { ContactCta } from "../contact-cta";

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps<"/support/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) return {};
  return {
    title: `${article.title} — Help`,
    description: article.summary,
    alternates: { canonical: `/support/${article.slug}` },
  };
}

/** One help article, with the rest of its topic beside it. */
export default async function HelpArticlePage({ params }: PageProps<"/support/[slug]">) {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) notFound();

  const topic = HELP_TOPICS.find((entry) => entry.key === article.topic);
  const related = HELP_ARTICLES.filter((entry) => entry.topic === article.topic && entry.slug !== article.slug);

  return (
    <div data-page-width="wide" className="space-y-10 pb-12">
      <Link href="/support" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft size={14} aria-hidden /> Help centre
      </Link>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <article className="max-w-2xl">
          {topic ? (
            <Link
              href={`/support#${topic.key}`}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-700 hover:underline"
            >
              {topic.title}
            </Link>
          ) : null}
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-ink">{article.title}</h1>
          <p className="mt-2 text-[17px] text-ink-muted">{article.summary}</p>

          <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink">
            {article.body.map((block, index) =>
              block.kind === "p" ? (
                <p key={index}>{block.text}</p>
              ) : block.kind === "list" ? (
                <ul key={index} className="list-disc space-y-1.5 pl-5 marker:text-accent-500">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={index}>
                  <Link href={block.href} className="inline-flex items-center gap-1 font-semibold text-accent-700 hover:underline">
                    {block.label} <ArrowRight size={13} weight="bold" aria-hidden />
                  </Link>
                </p>
              ),
            )}
          </div>
        </article>

        {related.length > 0 ? (
          <aside aria-label="Related articles" className="lg:pt-10">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">More in {topic?.title}</h2>
            <ul className="mt-3 divide-y divide-line rounded-glam border border-line bg-surface">
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link href={`/support/${entry.slug}`} className="block px-4 py-3 text-sm text-ink hover:bg-sunken hover:text-accent-700">
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      <ContactCta />
    </div>
  );
}
