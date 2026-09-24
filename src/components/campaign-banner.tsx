import { Megaphone } from "@phosphor-icons/react/dist/ssr";
import { liveBanners } from "@/lib/server/admin/marketing";

/**
 * The live campaign banner for this viewer's audience, or nothing.
 *
 * Rendered by pages rather than the root layout: the root layout must not
 * read the database (it also wraps the prerendered 404 page).
 */
export async function CampaignBanner({
  viewer,
  className = "",
}: {
  viewer: "CUSTOMER" | "PROVIDER" | "ADMIN" | null;
  className?: string;
}) {
  const [campaign] = await liveBanners(viewer);
  if (!campaign) return null;

  return (
    <aside
      aria-label="Announcement"
      className={`rise-in flex flex-wrap items-center gap-x-4 gap-y-2 rounded-glam border border-accent-500/50 bg-accent-100/40 px-4 py-3 ${className}`}
    >
      <Megaphone size={20} weight="fill" className="shrink-0 text-accent-700" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{campaign.title}</p>
        <p className="text-sm text-ink-muted">{campaign.message.split(/\n/)[0]}</p>
      </div>
      {campaign.ctaLabel && campaign.ctaUrl ? (
        <a
          href={campaign.ctaUrl}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-metal px-5 text-sm font-bold text-metal-ink transition duration-[180ms] ease-glam hover:brightness-105"
        >
          {campaign.ctaLabel}
        </a>
      ) : null}
    </aside>
  );
}
