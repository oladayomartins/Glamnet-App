import { SealCheck } from "@phosphor-icons/react/dist/ssr";

/**
 * A vendor's verification, wherever their name is shown to clients.
 *
 * Verified: GLAMNET has approved them after every setup step, ID or
 * insurance included. Not verified: listed and bookable, but not yet checked
 * — said plainly rather than hidden, so clients choose knowingly.
 */
export function VerifiedBadge({
  verified,
  size = 16,
  label = false,
}: {
  verified: boolean;
  /** Icon size in px. */
  size?: number;
  /** Show the word "Verified" beside the seal, not only the seal. */
  label?: boolean;
}) {
  if (verified) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-accent-700" title="Verified by GLAMNET">
        <SealCheck size={size} weight="fill" className="text-accent-500" aria-label={label ? undefined : "Verified"} aria-hidden={label || undefined} />
        {label ? <span className="font-sans text-xs font-semibold">Verified</span> : null}
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border border-line bg-sunken px-2 py-0.5 font-sans text-[11px] font-semibold leading-tight text-ink-muted"
      title="Listed, but not yet checked by GLAMNET"
    >
      Not verified
    </span>
  );
}
