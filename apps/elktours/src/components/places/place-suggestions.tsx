"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookMarked, Loader2, MapPin } from "lucide-react";
import { Badge, Button, Input } from "@elkdonis/primitives";
import { geocodeAction } from "@/lib/tour-actions";
import { suggestPlacesAction } from "@/lib/place-actions";
import type { Place, PlaceSuggestion } from "@/lib/catalogue-types";
import { catalogueSuggestions, distanceM, formatDistance } from "@/components/places/types";

const OSM_CREDIT = "© OpenStreetMap contributors";

interface PlaceSuggestionsProps {
  /** The loaded catalogue, matched locally when the server suggester is not answering. */
  catalogue: Place[];
  /** Last stop or map centre. */
  near: { lat: number; lng: number } | null;
  nearLabel?: string;
  onPick: (item: PlaceSuggestion) => void | Promise<void>;
  pickLabel?: string;
}

/**
 * Suggestions in the spec's order: own catalogue, then Photon (text), then
 * Overpass (named POIs nearby), from `suggestPlacesAction`. If that is not
 * answering yet, falls back to the loaded catalogue plus Photon text search.
 * The OSM credit sits under the list.
 */
export function PlaceSuggestions({ catalogue, near, nearLabel, onPick, pickLabel = "Add" }: PlaceSuggestionsProps) {
  const [q, setQ] = useState("");
  const [useNear, setUseNear] = useState(Boolean(near));
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const seq = useRef(0);
  const catalogueRef = useRef(catalogue);
  catalogueRef.current = catalogue;

  // Keyed on the numbers so a parent re-render with a fresh object does not refetch.
  const nearLat = near?.lat ?? null;
  const nearLng = near?.lng ?? null;
  const anchor = useMemo(
    () => (useNear && nearLat != null && nearLng != null ? { lat: nearLat, lng: nearLng } : null),
    [useNear, nearLat, nearLng]
  );

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3 && !anchor) {
      setItems([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      let rows: PlaceSuggestion[] = [];
      let usedFallback = false;
      try {
        const r = await suggestPlacesAction({ q: text.length >= 3 ? text : undefined, near: anchor ?? undefined });
        rows = r.items;
      } catch {
        usedFallback = true;
        const own = catalogueSuggestions(catalogueRef.current, { q: text.length >= 3 ? text : undefined, near: anchor });
        const hits = text.length >= 3 ? await geocodeAction(text).catch(() => []) : [];
        rows = [
          ...own,
          ...hits.map((h): PlaceSuggestion => {
            const [title, ...rest] = h.label.split(",");
            return {
              key: `photon:${h.lat},${h.lng}`,
              source: "photon",
              title: (title ?? h.label).trim(),
              lat: h.lat,
              lng: h.lng,
              address: rest.join(",").trim() || null,
              category: null,
              placeId: null,
              sourceRef: null,
              distanceM: anchor ? distanceM(anchor, h) : null,
            };
          }),
        ];
      }
      if (mine === seq.current) {
        setItems(rows);
        setFallback(usedFallback);
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q, anchor]);

  const pick = async (item: PlaceSuggestion) => {
    setBusyKey(item.key);
    try {
      await onPick(item);
    } finally {
      setBusyKey(null);
    }
  };

  const groups = [
    { title: "Your catalogue", rows: items.filter((r) => r.source === "catalogue") },
    { title: "OpenStreetMap search", rows: items.filter((r) => r.source === "photon") },
    { title: "Nearby on OpenStreetMap", rows: items.filter((r) => r.source === "overpass") },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a landmark, street or address" autoComplete="off" />
      {near && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={useNear} onChange={(e) => setUseNear(e.target.checked)} />
          Near {nearLabel ?? "the last stop"}
        </label>
      )}
      {loading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden /> Looking…
        </p>
      )}
      {groups.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          {q.trim().length >= 3 ? "Nothing found." : anchor ? "Nothing nearby. Type to search." : "Type at least three letters."}
        </p>
      )}
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</p>
          <ul className="divide-y divide-border border border-border">
            {g.rows.map((r) => {
              const detail = [r.category?.replace(/_/g, " "), r.address, formatDistance(r.distanceM)].filter(Boolean).join(" · ");
              return (
                <li key={r.key} className="flex items-start gap-2 px-3 py-2 text-sm">
                  {r.source === "catalogue" ? (
                    <BookMarked className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.title}</span>
                    {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
                  </span>
                  {r.source !== "catalogue" && <Badge variant="outline" className="shrink-0">{r.source}</Badge>}
                  <Button type="button" size="xs" variant="outline" disabled={busyKey !== null} onClick={() => void pick(r)}>
                    {busyKey === r.key ? "…" : pickLabel}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{OSM_CREDIT}</p>
      {fallback && <p className="text-xs text-muted-foreground">Nearby OpenStreetMap points of interest appear once the suggestion service is live.</p>}
    </div>
  );
}
