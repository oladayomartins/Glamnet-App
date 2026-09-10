"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import {
  renderTokens,
  TOKEN_FORMATS,
  tokenFileName,
  type TokenFormat,
} from "@/lib/tokens";

/**
 * Handoff panel — the tokens in the shape the consuming repo needs.
 *
 * In the Claude Design prototype this was a tweak in the tool's side panel;
 * on a shipped page it has to be a real control, so the format switch lives in
 * the panel header.
 */
export function TokenExport() {
  const [format, setFormat] = useState<TokenFormat>("css");

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-1">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-text-2">
          Token export — {tokenFileName[format]}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.08em] uppercase text-live">
            both modes · drop into the tokens package
          </span>
          <Segmented
            ariaLabel="Token export format"
            value={format}
            onValueChange={setFormat}
            options={TOKEN_FORMATS.map((f) => ({ value: f, label: f }))}
          />
        </div>
      </div>
      <pre className="m-0 overflow-x-auto p-4 font-mono text-xs leading-[1.7] text-text-1">
        {renderTokens(format)}
      </pre>
    </div>
  );
}
