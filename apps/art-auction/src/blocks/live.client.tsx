"use client";

import * as React from "react";
import { SAMPLE_NOW, type LiveParts } from "./auction-types";

// ============================================================================
// How a block stays live: polling, with the server's clock.
//
// There is no push on this site (Supabase Realtime runs but is not used here),
// so a block starts from what the page rendered with and asks
// /api/auction/live every few seconds while the tab is visible. The API keeps
// each answer for three seconds, so a crowd of open pages is one database read.
//
// Countdowns run against the SERVER's `now`, corrected for this device's
// clock: a bidder whose clock is two minutes slow would otherwise be told a
// lot has two minutes more than it has.
//
// Example data (the editor's, marked by SAMPLE_NOW) is never polled over, or
// the editor's canvas would lose its examples the moment the first poll landed.
// ============================================================================

export function useLive(
  initial: Partial<LiveParts> | undefined,
  query: string,
  seconds: number
): { data: Partial<LiveParts>; skew: number } {
  const [data, setData] = React.useState<Partial<LiveParts>>(initial ?? {});
  const [skew, setSkew] = React.useState(() => (initial?.now ? Date.parse(initial.now) - Date.now() : 0));
  const sample = initial?.now === SAMPLE_NOW;

  // The editor's resolver lands after the first render; take what it brings.
  // Keyed on the parts themselves, NOT on `initial`: a caller builds that
  // object fresh each render, and depending on it re-ran this effect every
  // time (setData, render, effect...) until React gave up.
  const { lots, bids, stats, now: initialNow } = initial ?? {};
  React.useEffect(() => {
    if (!lots && !bids && !stats) return;
    setData({ lots, bids, stats, now: initialNow } as Partial<LiveParts>);
    if (initialNow) setSkew(Date.parse(initialNow) - Date.now());
  }, [lots, bids, stats, initialNow]);

  React.useEffect(() => {
    if (sample || !query) return;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/auction/live?${query}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const body = (await res.json()) as LiveParts;
        setData(body);
        setSkew(Date.parse(body.now) - Date.now());
      } catch {
        // Offline for a moment: keep showing what we have.
      }
    };
    const id = window.setInterval(tick, Math.max(4, seconds) * 1000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [query, seconds, sample]);

  return { data, skew };
}

/** The server's idea of "now", ticking each second. */
export function useNow(skew: number): number {
  const [now, setNow] = React.useState(() => Date.now() + skew);
  React.useEffect(() => {
    setNow(Date.now() + skew);
    const id = window.setInterval(() => setNow(Date.now() + skew), 1000);
    return () => window.clearInterval(id);
  }, [skew]);
  return now;
}

/** True for a couple of seconds after `value` changes (not on first render): the "just happened" flash. */
export function useFlash(value: unknown): boolean {
  const first = React.useRef(true);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setOn(true);
    const id = window.setTimeout(() => setOn(false), 2200);
    return () => window.clearTimeout(id);
  }, [value]);
  return on;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2d 03:04:05", "03:04:05", or "4:05" under an hour. */
export function formatLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** The auction's wall-clock zone. Event times are typed in it. */
export const TIME_ZONE = "America/Toronto";

function zoneOffset(ts: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}

/** "2026-10-24T20:00" typed in Toronto time → the instant, or null when it is not a date. */
export function torontoToMs(local: string | undefined): number | null {
  const m = local ? /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(local.trim()) : null;
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return guess - zoneOffset(guess - zoneOffset(guess, TIME_ZONE), TIME_ZONE);
}
