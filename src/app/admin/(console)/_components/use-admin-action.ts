"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Calls an /api/admin endpoint, refreshes the page's server data on success,
 * and keeps the error message for the caller to show.
 *
 * `busy` names the action until the refreshed page has landed, not just until
 * the request returns. Clearing it as soon as the API answered left a gap in
 * which a switch or button showed its old state again, so a toggle looked as
 * if it had not taken and invited a second click.
 */
export function useAdminAction() {
  const router = useRouter();
  const [request, setRequest] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = async (
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<unknown | null> => {
    setRequest(key);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const issue = payload.error?.issues?.[0];
        const field = Array.isArray(issue?.path) ? issue.path.join(".") : issue?.path;
        throw new Error(
          issue ? `${field || "Field"}: ${issue.message}` : (payload.error?.message ?? "That did not save."),
        );
      }
      setRefreshing(key);
      startTransition(() => router.refresh());
      return payload;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save.");
      return null;
    } finally {
      setRequest(null);
    }
  };

  const busy = request ?? (isPending ? refreshing : null);
  return { run, busy, error, setError };
}
