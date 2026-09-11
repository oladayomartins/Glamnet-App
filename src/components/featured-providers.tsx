"use client";

import { useState } from "react";
import {
  ProviderCard,
  ProviderGrid,
  type ProviderCardData,
} from "@/components/provider-card";
import { EmptyState } from "@/components/ui";
import { UsersThree } from "@phosphor-icons/react";

/**
 * The featured-provider block (§C-01, block 3).
 *
 * The chip row filters an already-loaded set rather than re-querying: the home
 * page ships a handful of providers, so filtering on the client keeps the grid
 * from flashing a skeleton for work that takes no time at all. Search — which
 * really does query — lives on /search.
 */
export function FeaturedProviders({
  providers,
  categories,
}: {
  providers: ProviderCardData[];
  categories: string[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const shown = active
    ? providers.filter((provider) => provider.specialities.includes(active))
    : providers;

  return (
    <div>
      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filter providers by service"
      >
        <Chip label="All" active={active === null} onSelect={() => setActive(null)} />
        {categories.map((category) => (
          <Chip
            key={category}
            label={category}
            active={active === category}
            onSelect={() => setActive(active === category ? null : category)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<UsersThree size={24} />}
          title="Nobody covers that yet"
          action={
            <button
              type="button"
              onClick={() => setActive(null)}
              className="tap-44 text-sm font-semibold text-brand-700 hover:underline"
            >
              Show every provider
            </button>
          }
        >
          None of our featured providers offer {active} right now.
        </EmptyState>
      ) : (
        <ProviderGrid>
          {shown.slice(0, 8).map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </ProviderGrid>
      )}
    </div>
  );
}

/** The active chip is the block's one metal moment. */
function Chip({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold transition duration-[180ms] ease-glam active:scale-[0.98] ${
        active
          ? "bg-metal text-metal-ink"
          : "bg-surface text-ink-muted ring-1 ring-line hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
