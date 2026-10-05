"use client";

import { Printer } from "@phosphor-icons/react";

/** Opens the browser's print dialog, where "Save as PDF" makes the file. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-metal px-5 text-sm font-bold text-metal-ink transition duration-[180ms] hover:brightness-105 active:scale-[0.98]"
    >
      <Printer size={16} weight="bold" aria-hidden />
      Print or save as PDF
    </button>
  );
}
