"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { AddPlaceBody, useAddPlace, type AsStop } from "@/components/office/add-place-popup";
import { getPlaceSheet, listPlaceSheet, nearbyPlaceSheet, type NearbyPlace } from "@/lib/office-actions";
import { fromPlace, num, type StopDraft } from "@/components/manage/tour-builder/draft";
import type { RoutePoint, Via } from "./route-edit-map";
import type { Narratives } from "./types";
import { StopEditor } from "./stop-editor";

const RouteEditMap = dynamic(() => import("./route-edit-map").then((m) => m.RouteEditMap), {
  ssr: false,
  loading: () => <div className="h-[26rem] w-full bg-muted" />,
});

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";
const NEAR_M = 1200;

type LngLat = [number, number];

export function metres(legs: LngLat[][] | null): number {
  if (!legs) return 0;
  let m = 0;
  for (const leg of legs)
    for (let i = 1; i < leg.length; i++) {
      const [x1, y1] = leg[i - 1]!;
      const [x2, y2] = leg[i]!;
      const dLat = ((y2 - y1) * Math.PI) / 180;
      const dLng = ((x2 - x1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((y1 * Math.PI) / 180) * Math.cos((y2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      m += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
  return m;
}

/**
 * Step 2, Route (layout: design take A, 2026-11-26, https://claude.ai/artifact/Cb3HPqZoGYKi4gTjm3YQNF). Stop 1 is the
 * meeting point. The map (centred on the last stop, our places within 1.2 km; clicking one shows its card with "Add to
 * route") sits beside the route: an "Add a stop" search over our places, the stops as compact rows, and the walking
 * route's confirm row. "+ New place" opens the Add a place sheet full width (design "Place 1": search, pin or photo,
 * then the place's details), where each place found or made is added as the next stop. The chosen stop's editor (line, text, guide notes, minutes, picture) runs the frame's full width below.
 */
export function RouteStep({
  stops,
  setStops,
  narratives,
  setNarratives,
  legs,
  routeSource,
  onWorkOutRoute,
  saving,
  meeting,
  via,
  onViaChange,
}: {
  stops: StopDraft[];
  setStops: React.Dispatch<React.SetStateAction<StopDraft[]>>;
  /** Each stop's line on the tour page, by StopDraft.key (tour_stops.excerpt; saved with the stops). */
  narratives: Narratives;
  setNarratives: React.Dispatch<React.SetStateAction<Narratives>>;
  legs: LngLat[][] | null;
  routeSource: "osrm" | "straight" | null;
  onWorkOutRoute: () => void;
  saving: boolean;
  /** The tour's meeting point: the route's first point, as the server routes it. */
  meeting: { lat: number; lng: number } | null;
  via: Via;
  onViaChange: (via: Via) => void;
}) {
  const [nearby, setNearby] = React.useState<NearbyPlace[]>([]);
  const [active, setActive] = React.useState<string | null>(null);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [seedQuery, setSeedQuery] = React.useState("");

  const last = [...stops].reverse().find((s) => num(s.lat) != null && num(s.lng) != null);
  const centre = last ? { lat: num(last.lat)!, lng: num(last.lng)! } : null;
  const centreKey = centre ? `${centre.lat.toFixed(4)},${centre.lng.toFixed(4)}` : "";

  React.useEffect(() => {
    if (!centre) return;
    let live = true;
    nearbyPlaceSheet(centre.lat, centre.lng, NEAR_M)
      .then((rows) => live && setNearby(rows))
      .catch(() => live && setNearby([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centreKey]);

  const onRoute = new Set(stops.map((s) => s.placeId).filter(Boolean) as string[]);
  const stopNumbers = new Map<string, number>();
  stops.forEach((s, i) => s.placeId && !stopNumbers.has(s.placeId) && stopNumbers.set(s.placeId, i + 1));
  const asStop: AsStop = {
    next: stops.length + 1,
    onRoute: stopNumbers,
    add: addPlace,
    focus: (id) => {
      const st = stops.find((s) => s.placeId === id);
      if (st) setOpenKey(st.key);
    },
  };
  // The route's points in the order the server routes them: meeting point, then each stop with a position.
  // The path can be dragged only when every stop is saved (the bends are keyed by stop id).
  const allSaved = stops.length > 0 && stops.every((s) => s.id && !s.dirty);
  const points: RoutePoint[] = [
    ...(meeting ? [{ key: "meet", title: "Meeting point", ...meeting }] : []),
    ...stops
      .filter((s) => num(s.lat) != null && num(s.lng) != null)
      .map((s) => ({ key: s.id ?? `new:${s.key}`, title: s.title || "Stop", lat: num(s.lat)!, lng: num(s.lng)! })),
  ];
  const mapPlaces = nearby.map((p) => ({ id: p.id, title: p.title, lat: p.lat, lng: p.lng }));
  const card = active && !active.startsWith("point:") ? nearby.find((p) => p.id === active) ?? null : null;

  function select(id: string) {
    if (id.startsWith("point:")) {
      const key = id.slice(6);
      const st = stops.find((s) => s.id === key || `new:${s.key}` === key) ?? (key === "meet" ? stops[0] : undefined);
      if (st) setOpenKey(st.key);
      setActive(null);
      return;
    }
    const st = stops.find((s) => s.placeId === id);
    if (st) setOpenKey(st.key);
    setActive(id);
  }

  async function addPlace(id: string) {
    const sheet = await getPlaceSheet(id).catch(() => null);
    if (!sheet) return void toast.error("That place could not be opened.");
    const d = fromPlace(sheet.place);
    setStops((list) => [...list, d]);
    setOpenKey(d.key);
    setActive(null);
  }

  const patch = (key: string, p: Partial<StopDraft>) => setStops((list) => list.map((s) => (s.key === key ? { ...s, ...p, dirty: true } : s)));
  const move = (i: number, by: number) =>
    setStops((list) => {
      const j = i + by;
      if (j < 1 || j >= list.length || i < 1) return list; // stop 1 is the meeting point and stays first
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const remove = (key: string) => setStops((list) => list.filter((s, i) => i === 0 || s.key !== key));

  const km = metres(legs) / 1000;

  // "Add a stop": our places by name, the ones already on the route left out.
  const [query, setQuery] = React.useState("");
  const [found, setFound] = React.useState<Array<{ id: string; title: string; address: string | null }> | null>(null);
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    let live = true;
    const t = window.setTimeout(() => {
      listPlaceSheet(q)
        .then((rows) => live && setFound(rows.slice(0, 6)))
        .catch(() => live && setFound([]));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [query]);

  // The editor below shows one stop: the one chosen, else the first.
  React.useEffect(() => {
    if (!openKey && stops[0]) setOpenKey(stops[0].key);
  }, [openKey, stops]);
  const openIdx = stops.findIndex((s) => s.key === openKey);
  const openStop = openIdx >= 0 ? stops[openIdx]! : null;

  return (
    <div className="space-y-6 text-sm">
      {adding ? (
        <RouteAddPlace centre={centre} asStop={asStop} initialQuery={seedQuery} onBack={() => setAdding(false)} />
      ) : (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* The map stays in view beside a long route list. */}
        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={label}>{`Places near ${last?.title || "the last stop"}`}</span>
            <button type="button" onClick={() => { setSeedQuery(""); setAdding(true); }} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
              + New place
            </button>
          </div>
              <RouteEditMap
                places={mapPlaces}
                activeId={active}
                onSelect={select}
                points={points}
                legs={legs}
                via={via}
                editable={allSaved && !saving && Boolean(legs)}
                onViaChange={onViaChange}
                className="h-[26rem] w-full"
              />
              {card ? (
                <article className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex gap-3">
                    {card.imageUrl && <img src={card.imageUrl} alt="" className="h-16 w-24 shrink-0 object-cover" />}
                    <div className="min-w-0">
                      <h4 className="font-medium">{card.title}</h4>
                      {card.address && <p className="truncate text-xs text-muted-foreground">{card.address}</p>}
                      {card.excerpt && <p className="mt-1 text-muted-foreground">{card.excerpt}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {onRoute.has(card.id) ? (
                      <span className="text-xs text-muted-foreground">Already on the route.</span>
                    ) : (
                      <button type="button" onClick={() => addPlace(card.id)} className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
                        Add to route
                      </button>
                    )}
                    <button type="button" onClick={() => setActive(null)} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
                      Close
                    </button>
                  </div>
                </article>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {nearby.length ? `${nearby.length} of our places within ${NEAR_M / 1000} km. Click one to see it.` : "No places of ours near here yet. Use New place."}
                </p>
              )}
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <label htmlFor="rt-find" className={label}>
              Add a stop
            </label>
            <input id="rt-find" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="One of our places, by name" className={field} />
            {found && (
              <ul className="mt-1 divide-y divide-border border border-border">
                {found.length === 0 && <li className="px-3 py-2 text-muted-foreground">No place of ours by that name.</li>}
                {found.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.title}</span>
                      {p.address && <span className="block truncate text-xs text-muted-foreground">{p.address}</span>}
                    </span>
                    {onRoute.has(p.id) ? (
                      <span className="shrink-0 text-xs text-muted-foreground">On the route</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void addPlace(p.id);
                          setQuery("");
                        }}
                        className="shrink-0 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
                      >
                        Add as stop {stops.length + 1}
                      </button>
                    )}
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSeedQuery(query.trim());
                      setAdding(true);
                      setQuery("");
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-accent/60"
                  >
                    Not there? <span className="underline underline-offset-4">A new place on the map</span>
                  </button>
                </li>
              </ul>
            )}
          </div>

          <span className={label}>The route</span>
          <ol className="divide-y divide-border rounded-md border border-border">
            {stops.map((s, i) => {
              const open = openKey === s.key;
              return (
                <li key={s.key} className={open ? "bg-accent/40" : undefined}>
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${open ? "bg-foreground text-background" : "bg-primary text-primary-foreground"}`}>{i + 1}</span>
                    <button type="button" onClick={() => setOpenKey(s.key)} className="min-w-0 flex-1 text-left" aria-current={open ? "true" : undefined}>
                      <span className={`block truncate ${open ? "font-semibold" : "font-medium"}`}>{s.title || "Untitled stop"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {i === 0 ? "Meeting point" : s.placeId ? "One of our places" : "Own position"}
                        {num(s.durationMinutes) ? ` · ${num(s.durationMinutes)} min` : ""}
                      </span>
                    </button>
                    {i > 0 && (
                      <span className="flex shrink-0 gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i <= 1} className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Earlier">↑</button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i >= stops.length - 1} className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Later">↓</button>
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
            <li className="space-y-2 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">Confirm the route</span>
                <button type="button" disabled={saving || stops.length < 2} onClick={onWorkOutRoute} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50">
                  {saving ? "Working it out…" : legs ? "Work it out again" : "Work out the walking route"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {legs
                  ? `${routeSource === "osrm" ? "Walking route" : "Straight lines (the walking router did not answer)"}: about ${km.toFixed(1)} km between ${stops.length} stops. It is drawn on the map.`
                  : "Saves the stops and draws the walking path between them on the map."}{" "}
                {allSaved && legs
                  ? "Drag a + on the path to send it down another street; drag a square to move that bend, click it to remove it."
                  : "Once the stops are saved, the path can be dragged."}
              </p>
            </li>
          </ol>
        </div>
      </div>
      )}

      {openStop ? (
        <section aria-labelledby="rt-open" className="rounded-md border border-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-accent/30 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">{openIdx + 1}</span>
              <h3 id="rt-open" className="truncate text-lg font-semibold">
                {openStop.title || "Untitled stop"}
              </h3>
              <span className="text-xs text-muted-foreground">{openIdx === 0 ? "Meeting point" : openStop.placeId ? "One of our places" : "Own position"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {openIdx > 0 && (
                <button type="button" onClick={() => setOpenKey(stops[openIdx - 1]!.key)} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
                  ‹ Stop {openIdx}
                </button>
              )}
              {openIdx < stops.length - 1 && (
                <button type="button" onClick={() => setOpenKey(stops[openIdx + 1]!.key)} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
                  Stop {openIdx + 2} ›
                </button>
              )}
              {openIdx > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = stops[openIdx + 1] ?? stops[openIdx - 1];
                    remove(openStop.key);
                    setOpenKey(next?.key ?? null);
                  }}
                  className="rounded-md border border-border px-3 py-1.5 hover:text-destructive"
                >
                  Remove from route
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <StopEditor stop={openStop} narrative={narratives[openStop.key] ?? ""} onNarrative={(v) => setNarratives((m) => ({ ...m, [openStop.key]: v }))} patch={(p) => patch(openStop.key, p)} />
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground">Add a stop to start the route.</p>
      )}
    </div>
  );
}

/**
 * The Add a place sheet inside the route step (2026-11-26): the same body as the hub popup, centred on the last stop;
 * every place found, picked or made is added as the next stop, and its details stay open below for pictures and text.
 */
function RouteAddPlace({ centre, asStop, initialQuery, onBack }: { centre: { lat: number; lng: number } | null; asStop: AsStop; initialQuery: string; onBack: () => void }) {
  const m = useAddPlace({ centre, asStop, initialQuery });
  return (
    <div className="rounded-md border border-border p-4">
      <AddPlaceBody
        m={m}
        mapClass="h-[26rem] w-full"
        head={
          <>
            {m.placeId && (
              <button type="button" onClick={m.another} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
                Add another
              </button>
            )}
            <button type="button" onClick={onBack} className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              Back to the route
            </button>
          </>
        }
      />
    </div>
  );
}
