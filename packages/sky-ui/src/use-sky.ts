"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChartResult, StepUnit } from "@elkdonis/astro";
import { stepInstant } from "@elkdonis/astro";
import { SkyConfig } from "./utils";

/**
 * The sky's state: a moment, a place, and the chart of the two — plus the
 * playback that moves the moment.
 *
 * One hook so the page, the hub face and the popup are the same thing at
 * three sizes: each calls useSky() and renders whichever parts it has room
 * for. Nothing here touches the DOM, so a caller decides the layout entirely.
 *
 * Playback is CONTINUOUS: an animation frame advances a running clock at the
 * chosen rate and commits to state every COMMIT_MS, while the chart is
 * refetched as fast as the round trip allows (one request in flight, always
 * for the newest moment). That reads as motion rather than as a tick.
 */

export const STEP_UNITS: { unit: StepUnit; label: string }[] = [
  { unit: "hour", label: "Hour" },
  { unit: "day", label: "Day" },
  { unit: "month", label: "Month" },
  { unit: "year", label: "Year" },
];

/** Playback rates: simulated seconds per real second, slowest to fastest. */
export const RATES: { label: string; short: string; perSecond: number }[] = [
  { label: "10 minutes / s", short: "10 min", perSecond: 600 },
  { label: "1 hour / s", short: "1 hr", perSecond: 3_600 },
  { label: "6 hours / s", short: "6 hr", perSecond: 21_600 },
  { label: "1 day / s", short: "1 day", perSecond: 86_400 },
  { label: "3 days / s", short: "3 days", perSecond: 259_200 },
  { label: "1 week / s", short: "1 wk", perSecond: 604_800 },
  { label: "1 month / s", short: "1 mo", perSecond: 2_629_800 },
  { label: "1 year / s", short: "1 yr", perSecond: 31_557_600 },
];
const DEFAULT_RATE = 1;
const COMMIT_MS = 80;

export interface Place {
  key: string;
  name: string;
  lat: number;
  lon: number;
}

/** Somewhere to cast the houses. "here" is filled from the browser's location. */
export const PLACES: Place[] = [
  { key: "greenwich", name: "Greenwich", lat: 51.4769, lon: -0.0005 },
  { key: "toronto", name: "Toronto", lat: 43.6532, lon: -79.3832 },
  { key: "new-york", name: "New York", lat: 40.7128, lon: -74.006 },
  { key: "los-angeles", name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { key: "london", name: "London", lat: 51.5074, lon: -0.1278 },
  { key: "paris", name: "Paris", lat: 48.8566, lon: 2.3522 },
  { key: "berlin", name: "Berlin", lat: 52.52, lon: 13.405 },
  { key: "delhi", name: "Delhi", lat: 28.6139, lon: 77.209 },
  { key: "tokyo", name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { key: "sydney", name: "Sydney", lat: -33.8688, lon: 151.2093 },
];
const PLACE_KEY = "elastrocal:sky-place";

export type Direction = 1 | -1;

export interface SkyApi {
  at: Date;
  chart: ChartResult;
  isNow: boolean;
  /** The moment in the viewer's own zone; null until mounted. */
  local: string | null;
  place: Place;
  /** The select's value: a known key, or "here". */
  placeValue: string;
  unit: StepUnit;
  setUnit: (u: StepUnit) => void;
  rate: number;
  setRate: (r: number) => void;
  playing: Direction | null;
  setPlaying: (d: Direction | null) => void;
  step: (direction: Direction) => void;
  goNow: () => void;
  choosePlace: (key: string) => void;
  error: string | null;
}

export function useSky(initialIso: string, initialChart: ChartResult, initialIsNow: boolean): SkyApi {
  const [at, setAt] = useState(() => new Date(initialIso));
  const [chart, setChart] = useState(initialChart);
  const [isNow, setIsNow] = useState(initialIsNow);
  const [unit, setUnit] = useState<StepUnit>("day");
  const [playing, setPlaying] = useState<Direction | null>(null);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [place, setPlace] = useState<Place>(() => PLACES[0]);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);

  const loadedKey = useRef(`${initialIso}|${PLACES[0].lat},${PLACES[0].lon}`);
  const wanted = useRef<{ at: Date; place: Place } | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async (target: Date, where: Place) => {
    wanted.current = { at: target, place: where };
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      while (wanted.current) {
        const { at: t, place: p } = wanted.current;
        wanted.current = null;
        const iso = t.toISOString();
        const key = `${iso}|${p.lat},${p.lon}`;
        if (key === loadedKey.current) continue;
        const res = await fetch(`${SkyConfig.endpoint}?t=${encodeURIComponent(iso)}&lat=${p.lat}&lon=${p.lon}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "The sky could not be calculated");
        loadedKey.current = key;
        setChart(body.chart);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The sky could not be calculated");
      setPlaying(null);
    } finally {
      inFlight.current = false;
    }
  }, []);

  // The remembered place, restored after mount (localStorage is client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLACE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Place;
        if (Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.name) setPlace(p);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Moment or place changed → fetch its chart, and show the moment locally.
  useEffect(() => {
    void refresh(at, place);
    setLocal(
      at.toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    );
  }, [at, place, refresh]);

  const atRef = useRef(at);
  atRef.current = at;
  useEffect(() => {
    if (!playing) return;
    const perSecond = RATES[rate].perSecond * playing;
    let sim = atRef.current.getTime();
    let last = performance.now();
    let lastCommit = last;
    let frame = 0;
    const tick = (now: number) => {
      // real ms elapsed × simulated seconds per real second = simulated ms
      sim += (now - last) * perSecond;
      last = now;
      if (now - lastCommit >= COMMIT_MS) {
        lastCommit = now;
        setIsNow(false);
        setAt(new Date(sim));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate]);

  const remember = useCallback((p: Place) => {
    setPlace(p);
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  return {
    at,
    chart,
    isNow,
    local,
    place,
    placeValue: PLACES.some((p) => p.key === place.key) ? place.key : "here",
    unit,
    setUnit,
    rate,
    setRate,
    playing,
    setPlaying,
    step: (direction) => {
      setPlaying(null);
      setIsNow(false);
      setAt((prev) => stepInstant(prev, unit, direction));
    },
    goNow: () => {
      setPlaying(null);
      setIsNow(true);
      setAt(new Date(Math.floor(Date.now() / 1000) * 1000));
    },
    choosePlace: (key) => {
      if (key === "here") {
        if (!("geolocation" in navigator)) return setError("This browser has no location service");
        navigator.geolocation.getCurrentPosition(
          (pos) => remember({ key: "here", name: "My location", lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => setError("Location unavailable — it needs a secure (https) connection and your permission"),
          { timeout: 8000 },
        );
        return;
      }
      remember(PLACES.find((x) => x.key === key) ?? PLACES[0]);
    },
    error,
  };
}
