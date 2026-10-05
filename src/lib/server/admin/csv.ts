import { NextResponse } from "next/server";

/**
 * CSV downloads from the admin console.
 *
 * Every cell is defused for spreadsheets: a value starting with = + - @ or a
 * control character is prefixed with ' so Excel shows it rather than running
 * it. Names and notes come from users, so a vendor called "=HYPERLINK(...)"
 * must not become a live formula on an admin's machine.
 */

export const MAX_EXPORT_ROWS = 50_000;

export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export const pounds = (minor: number | null | undefined) => ((minor ?? 0) / 100).toFixed(2);
export const isoDate = (value: Date | null | undefined) => value?.toISOString() ?? "";

/** A CSV file response, named glamnet-<name>-<today>.csv. */
export function csvResponse(name: string, csv: string): NextResponse {
  // A byte-order mark so Excel reads names with accents as UTF-8.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="glamnet-${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
