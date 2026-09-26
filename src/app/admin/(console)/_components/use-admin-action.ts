"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Calls an /api/admin endpoint, refreshes the page's server data on success,
 * and keeps the error message for the caller to show.
 */
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (
    key: string,
    url: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<unknown | null> => {
    setBusy(key);
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
        throw new Error(
          issue ? `${issue.path || "Field"}: ${issue.message}` : (payload.error?.message ?? "That did not save."),
        );
      }
      router.refresh();
      return payload;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  return { run, busy, error, setError };
}
