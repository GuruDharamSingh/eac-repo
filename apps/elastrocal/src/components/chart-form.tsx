"use client";

import { useMemo, useState } from "react";
import { HOUSE_SYSTEMS, type HouseSystemCode } from "@elkdonis/astro";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ChartFormValues {
  date: string;
  time: string;
  timeKnown: boolean;
  locationName: string;
  latitude: string;
  longitude: string;
  timezone: string;
  houseSystem: HouseSystemCode;
}

export const EMPTY_FORM: ChartFormValues = {
  date: "",
  time: "",
  timeKnown: true,
  locationName: "",
  latitude: "",
  longitude: "",
  timezone: "",
  houseSystem: "P",
};

interface Place {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ChartForm({
  initial,
  busy,
  onSubmit,
}: {
  initial: ChartFormValues;
  busy: boolean;
  onSubmit: (values: ChartFormValues) => void;
}) {
  const [v, setV] = useState<ChartFormValues>(initial);
  const [query, setQuery] = useState(initial.locationName);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);

  const set = <K extends keyof ChartFormValues>(key: K, value: ChartFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  async function searchPlaces() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(withBase(`/api/geocode?q=${encodeURIComponent(query.trim())}`));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Search failed");
      setPlaces(body.results);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setPlaces(null);
    } finally {
      setSearching(false);
    }
  }

  function pick(place: Place) {
    setV((prev) => ({
      ...prev,
      locationName: place.name,
      latitude: place.latitude.toFixed(4),
      longitude: place.longitude.toFixed(4),
      timezone: place.timezone,
    }));
    setQuery(place.name);
    setPlaces(null);
  }

  /** Hand-typed coordinates: fill the zone from them, unless one is already set. */
  async function lookUpZone() {
    const lat = Number(v.latitude);
    const lon = Number(v.longitude);
    if (v.timezone || v.latitude === "" || v.longitude === "" || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const res = await fetch(withBase(`/api/timezone?lat=${lat}&lon=${lon}`)).catch(() => null);
    if (res?.ok) set("timezone", (await res.json()).timezone);
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Birth date</Label>
          <Input id="date" type="date" required value={v.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time">Birth time</Label>
          <Input
            id="time"
            type="time"
            required={v.timeKnown}
            disabled={!v.timeKnown}
            value={v.timeKnown ? v.time : "12:00"}
            onChange={(e) => set("time", e.target.value)}
          />
        </div>
      </div>
      <div className="-mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Local time at the birthplace, 24-hour.</span>
        <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
          <input
            type="checkbox"
            className="accent-primary"
            checked={!v.timeKnown}
            onChange={(e) => set("timeKnown", !e.target.checked)}
          />
          Time unknown
        </label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="place">Birthplace</Label>
        <div className="flex gap-2">
          <Input
            id="place"
            placeholder="City, region, country"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchPlaces();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={searchPlaces} disabled={searching}>
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Search
          </Button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        {places && (
          <ul className="max-h-56 overflow-auto rounded-md border border-border bg-popover text-sm">
            {places.length === 0 && <li className="px-3 py-2 text-muted-foreground">No places found.</li>}
            {places.map((p) => (
              <li key={`${p.latitude},${p.longitude}`}>
                <button
                  type="button"
                  onClick={() => pick(p)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    {p.name}
                    <span className="block text-xs text-muted-foreground">{p.timezone}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lat">Latitude</Label>
          <Input
            id="lat"
            inputMode="decimal"
            required
            placeholder="43.6532"
            value={v.latitude}
            onChange={(e) => set("latitude", e.target.value)}
            onBlur={lookUpZone}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lon">Longitude</Label>
          <Input
            id="lon"
            inputMode="decimal"
            required
            placeholder="-79.3832"
            value={v.longitude}
            onChange={(e) => set("longitude", e.target.value)}
            onBlur={lookUpZone}
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">North and east positive; south and west negative.</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="tz">Time zone</Label>
          <Input
            id="tz"
            required
            list="tz-list"
            placeholder="America/Toronto"
            value={v.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          />
          <datalist id="tz-list">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hsys">House system</Label>
          <select
            id="hsys"
            className={selectClass}
            value={v.houseSystem}
            onChange={(e) => set("houseSystem", e.target.value as HouseSystemCode)}
          >
            {HOUSE_SYSTEMS.map((h) => (
              <option key={h.code} value={h.code} className="bg-popover">
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        The zone&rsquo;s historical rules are applied, including daylight saving in force on the birth date.
      </p>

      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />}
        {busy ? "Calculating…" : "Calculate chart"}
      </Button>
    </form>
  );
}
