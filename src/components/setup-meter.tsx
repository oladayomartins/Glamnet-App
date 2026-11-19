import { LockKey, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { SetupProgress } from "@/lib/domain/vendor-setup";
import { formatMoney } from "@/lib/format";

/**
 * A vendor's setup percentage, with what it unlocks: going live with the
 * basics, then the verified badge and payouts at 100%.
 */
export function SetupMeter({
  setup,
  heldMinor,
  live,
}: {
  setup: SetupProgress;
  /** Earnings kept back until verified. */
  heldMinor: number;
  live: boolean;
}) {
  const left = setup.items.filter((item) => !item.done).length;
  return (
    <div className="rounded-glam border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
          {setup.verified ? <SealCheck size={18} weight="fill" className="text-accent-500" aria-hidden /> : null}
          {setup.verified ? "Verified" : live ? "Live · Not verified" : "Not live yet"}
        </p>
        <p data-numeric className="font-display text-2xl font-bold text-ink">
          {setup.percent}%
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuenow={setup.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Setup complete"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-[480ms] ease-glam ${setup.verified ? "bg-normal" : "bg-metal"}`}
          style={{ width: `${setup.percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {setup.verified
          ? "Every step done and checked by GLAMNET. Clients see your verified badge, and you're paid on every PIN."
          : setup.readyForApproval
            ? "Everything's done. We're checking your details — your badge and payouts follow our approval."
            : `${left} ${left === 1 ? "item" : "items"} to go. At 100% and once we've approved you, you get your verified badge and your payouts.`}
      </p>
      {heldMinor > 0 && !setup.verified ? (
        <p className="mt-3 flex items-start gap-2 rounded-glam bg-sunken p-3 text-sm text-ink">
          <LockKey size={16} weight="fill" className="mt-0.5 shrink-0 text-accent-700" aria-hidden />
          <span>
            <strong data-numeric>{formatMoney(heldMinor)}</strong> earned and kept safe for you. It&rsquo;s paid to your bank
            automatically once you&rsquo;re verified.
          </span>
        </p>
      ) : null}
    </div>
  );
}
