import { ukDateString } from "./uk-time";

/**
 * Storefront stats: how many people looked at a vendor's storefront, where
 * they came from, and how many booked. Pure, so it can be tested.
 *
 * "Own link" is the vendor's shared /pro link (bio, WhatsApp, anywhere);
 * "Directory" is a click from GLAMNET's own listings (marked ?via=directory).
 */

export type StatSource = "DIRECT_LINK" | "MARKETPLACE";

export const STAT_PERIODS = { "7": 7, "30": 30, "90": 90 } as const;
export type StatPeriod = keyof typeof STAT_PERIODS;

export function parseStatPeriod(value: string | undefined | null): StatPeriod {
  return value && value in STAT_PERIODS ? (value as StatPeriod) : "30";
}

/**
 * Crawlers and link previews fetch pages too; they are not people. Matched on
 * the user agent, which is all a counter that stores nothing can go on.
 */
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|embedly|headless|lighthouse|pingdom|curl|wget|python-requests|axios/i;

export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || BOT.test(userAgent);
}

/** The UK calendar day a view belongs to, as stored (midnight UTC of that date). */
export function statDay(at: Date): Date {
  return new Date(`${ukDateString(at)}T00:00:00.000Z`);
}

export interface ViewRow {
  day: Date;
  source: string;
  views: number;
}

export interface BookingRow {
  createdAt: Date;
  source: string;
  status: string;
  /** What the vendor is paid (or will be) for it, tip included. */
  payoutMinor: number;
}

/** A booking that counts: placed, not abandoned or expired. */
const NOT_A_BOOKING = ["EXPIRED"];

/** Finished work, for the earnings figure. */
const EARNED = ["COMPLETED", "REVIEWED", "PAYMENT_RELEASED"];

export interface SourceTotals {
  views: number;
  bookings: number;
  /** Bookings per 100 views, one decimal; null with no views. */
  conversionPct: number | null;
  earnedMinor: number;
}

export interface StatsSummary {
  days: { date: string; link: number; directory: number; bookings: number }[];
  link: SourceTotals;
  directory: SourceTotals;
  total: SourceTotals;
}

function conversion(bookings: number, views: number): number | null {
  if (views === 0) return null;
  return Math.round((bookings / views) * 1_000) / 10;
}

/**
 * Totals for [from, to) and one entry per UK day, oldest first. Storefront
 * bookings only (own link and directory) — broadcast requests never pass
 * through the storefront, so they are no part of its conversion.
 */
export function summariseStats(input: {
  views: readonly ViewRow[];
  bookings: readonly BookingRow[];
  from: Date;
  dayCount: number;
}): StatsSummary {
  const days = Array.from({ length: input.dayCount }, (_, at) => {
    const date = ukDateString(new Date(input.from.getTime() + at * 86_400_000 + 12 * 3_600_000));
    return { date, link: 0, directory: 0, bookings: 0 };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));

  for (const row of input.views) {
    const entry = byDate.get(row.day.toISOString().slice(0, 10));
    if (!entry) continue;
    if (row.source === "MARKETPLACE") entry.directory += row.views;
    else entry.link += row.views;
  }

  const bookings = input.bookings.filter(
    (booking) => (booking.source === "DIRECT_LINK" || booking.source === "MARKETPLACE") && !NOT_A_BOOKING.includes(booking.status),
  );
  for (const booking of bookings) {
    const entry = byDate.get(ukDateString(booking.createdAt));
    if (entry) entry.bookings += 1;
  }

  const totals = (source: StatSource | null): SourceTotals => {
    const views = days.reduce(
      (sum, day) => sum + (source === "DIRECT_LINK" ? day.link : source === "MARKETPLACE" ? day.directory : day.link + day.directory),
      0,
    );
    const mine = bookings.filter((booking) => source === null || booking.source === source);
    return {
      views,
      bookings: mine.length,
      conversionPct: conversion(mine.length, views),
      earnedMinor: mine.filter((booking) => EARNED.includes(booking.status)).reduce((sum, booking) => sum + booking.payoutMinor, 0),
    };
  };

  return { days, link: totals("DIRECT_LINK"), directory: totals("MARKETPLACE"), total: totals(null) };
}
