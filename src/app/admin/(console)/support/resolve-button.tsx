"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/** Mark an enquiry resolved, or reopen it. */
export function ResolveButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "OPEN" ? "RESOLVED" : "OPEN";
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch(`/api/admin/support/${id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next }),
        }).catch(() => null);
        setBusy(false);
        if (response?.ok) router.refresh();
        else window.alert("Couldn't update that. Please try again.");
      }}
    >
      {busy ? "Saving…" : status === "OPEN" ? "Mark resolved" : "Reopen"}
    </Button>
  );
}
