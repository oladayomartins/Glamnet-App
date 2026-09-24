"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const field =
  "mt-1 min-h-11 w-full rounded-glam-input border border-line bg-surface px-3 text-[15px] text-ink outline-none focus:border-accent-500";

/** The customer's name and phone number, editable in place. */
export function DetailsForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name, phone });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const changed = values.name !== name || values.phone !== phone;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("saving");
    const response = await fetch("/api/customer/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    setState(response?.ok ? "saved" : "error");
    if (response?.ok) router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium text-ink">Name</span>
        <input
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          autoComplete="name"
          className={field}
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Mobile number</span>
        <input
          value={values.phone}
          onChange={(e) => setValues({ ...values, phone: e.target.value })}
          autoComplete="tel"
          inputMode="tel"
          placeholder="So your pro can reach you on the day"
          className={field}
        />
      </label>
      <p className="text-xs text-ink-muted">Signed in as {email}</p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={!changed || state === "saving" || values.name.trim().length < 2}>
          {state === "saving" ? "Saving…" : "Save details"}
        </Button>
        {state === "saved" && !changed ? <span className="text-xs text-normal-ink">Saved</span> : null}
        {state === "error" ? <span className="text-xs text-warning">That didn&rsquo;t save. Try again.</span> : null}
      </div>
    </form>
  );
}
