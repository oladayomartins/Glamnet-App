"use client";

import { Warning } from "@phosphor-icons/react";
import { Button, EmptyState } from "@/components/ui";

/**
 * The error state (§S-02).
 *
 * Amber, never signal red: red belongs to the EMERGENCY booking type alone,
 * and a failed page render dressed in the emergency colour would read as one.
 * The action is a retry rather than a link home, because most of these are
 * transient and the customer was in the middle of something.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="py-14">
      <EmptyState
        icon={<Warning size={24} weight="light" />}
        title="That did not load"
        action={<Button onClick={reset}>Try again</Button>}
      >
        Something went wrong at our end. Nothing you had booked is affected.
      </EmptyState>
      {/* The digest is the only handle support has on a specific failure, so
          it is shown rather than swallowed — the message itself is not, since
          it can carry internals. */}
      {error.digest ? (
        <p className="mt-4 text-center font-mono text-xs text-ink-muted">
          Reference {error.digest}
        </p>
      ) : null}
    </div>
  );
}
