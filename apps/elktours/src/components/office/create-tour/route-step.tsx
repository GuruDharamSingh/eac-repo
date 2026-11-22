"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { MediaField } from "@/components/manage/media-field";
import { createPlaceFromPin } from "@/lib/custom-place-actions";
import { getPlaceSheet, nearbyPlaceSheet, type NearbyPlace } from "@/lib/office-actions";
import { useNaming } from "@/components/places/location-creator";
import { fromPlace, num, type StopDraft } from "@/components/manage/tour-builder/draft";
import type { LatLng } from "@/components/places/pin-map";
import type { RoutePoint, Via } from "./route-edit-map";
import { bodyFallback, NARRATIVE_HARD, NARRATIVE_SOFT, type Narratives } from "./types";

const RouteEditMap = dynamic(() => import("./route-edit-map").then((m) => m.RouteEditMap), {
  ssr: false,
  loading: () => <div className="h-[26rem] w-full bg-muted" />,
});
const PinMap = dynamic(() => import("@/components/places/pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-muted" />,
});

const label = "text-xs font-medium uppercase tracking-wider text-muted-foreground";
const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";
const NEAR_M = 1200;

type LngLat = [number, number];

function metres(legs: LngLat[][] | null): number {
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
 * Step 2, Route. Stop 1 is the meeting point. The map is centred on the last stop and shows our places within
 * 1.2 km; clicking one shows its card with "Add to route". "New place" drops a pin (name and address suggested)
 * and makes a place that becomes the next stop. Each stop is a row that opens to its place card, notes, picture
 * and minutes. The last row works out the walking route between the stops (saved with the stops).
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
  const [pin, setPin] = React.useState<LatLng | null>(null);
  const [creating, setCreating] = React.useState(false);
  const naming = useNaming();

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

  async function createHere() {
    if (!pin) return;
    setCreating(true);
    const r = await createPlaceFromPin({ lat: pin.lat, lng: pin.lng, title: naming.title.trim() || null, address: naming.address.trim() || null }).catch(
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Could not create the place." })
    );
    setCreating(false);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.place.title} added to the places`);
    const d = fromPlace(r.place);
    setStops((list) => [...list, d]);
    setOpenKey(d.key);
    setPin(null);
    naming.reset();
    setAdding(false);
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

  return (
    <div className="grid gap-6 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={label}>Places near {last?.title || "the last stop"}</span>
          <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-md border border-border px-3 py-1.5 hover:bg-accent">
            {adding ? "Back to the map" : "+ New place"}
          </button>
        </div>
        {adding ? (
          <div className="space-y-3">
            <PinMap value={pin} onChange={(p) => { setPin(p); void naming.lookup(p); }} center={centre} className="h-[22rem] w-full" />
            {pin ? (
              <>
                {naming.fields("rt-pin")}
                <button type="button" disabled={creating} onClick={createHere} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
                  {creating ? "Creating…" : "Create place and add it as the next stop"}
                </button>
              </>
            ) : (
              <p className="text-muted-foreground">Click the map to drop a pin. The name and address are suggested; change or ignore them.</p>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className="space-y-2">
        <span className={label}>The route</span>
        <ol className="divide-y divide-border rounded-md border border-border">
          {stops.map((s, i) => {
            const open = openKey === s.key;
            return (
              <li key={s.key}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{i + 1}</span>
                  <button type="button" onClick={() => setOpenKey(open ? null : s.key)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                    <span className="block truncate font-medium">{s.title || "Untitled stop"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {i === 0 ? "Meeting point" : s.placeId ? "One of our places" : "Own position"}
                      {num(s.durationMinutes) ? ` · ${num(s.durationMinutes)} min` : ""}
                    </span>
                  </button>
                  {i > 0 && (
                    <span className="flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => move(i, -1)} disabled={i <= 1} className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Earlier">↑</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i >= stops.length - 1} className="px-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Later">↓</button>
                      <button type="button" onClick={() => remove(s.key)} className="px-1.5 text-muted-foreground hover:text-destructive" aria-label="Remove this stop">✕</button>
                    </span>
                  )}
                </div>
                {open && (
                  <div className="space-y-3 border-t border-border bg-accent/20 px-3 py-3">
                    <NarrativeField
                      value={narratives[s.key] ?? ""}
                      onChange={(v) => setNarratives((m) => ({ ...m, [s.key]: v }))}
                      fallback={bodyFallback(s.body)}
                    />
                    <label className="block">
                      <span className={label}>Stop name</span>
                      <input value={s.title} onChange={(e) => patch(s.key, { title: e.target.value })} className={field} />
                    </label>
                    <div>
                      <span className={label}>What the visitor reads here</span>
                      <div className="mt-1">
                        <RichTextEditor value={s.body} onChange={(v) => patch(s.key, { body: v })} toolbar="compact" />
                      </div>
                    </div>
                    <div>
                      <span className={label}>Notes for the guide (private)</span>
                      <div className="mt-1">
                        <RichTextEditor value={s.guideNotes} onChange={(v) => patch(s.key, { guideNotes: v })} toolbar="compact" />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                      <label className="block">
                        <span className={label}>Minutes here</span>
                        <input type="number" min={0} step={5} value={s.durationMinutes} onChange={(e) => patch(s.key, { durationMinutes: e.target.value })} className={field} />
                      </label>
                      <MediaField value={s.imageUrl} onChange={(url) => patch(s.key, { imageUrl: url })} label="Picture" />
                    </div>
                  </div>
                )}
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
  );
}

/** The stop's line on the tour page: first field of an open stop. Warns past NARRATIVE_SOFT (240); the field stops at NARRATIVE_HARD (280: what the stage column holds; the server accepts 300). */
function NarrativeField({ value, onChange, fallback }: { value: string; onChange: (v: string) => void; fallback: string }) {
  const n = value.length;
  const over = n > NARRATIVE_SOFT;
  return (
    <label className="block">
      <span className={label}>The stop's line on the tour page</span>
      <textarea
        rows={3}
        value={value}
        maxLength={NARRATIVE_HARD}
        onChange={(e) => onChange(e.target.value)}
        placeholder={fallback ? `Not written yet. The page shows: ${fallback}` : "Not written yet."}
        aria-describedby="rt-narr-help"
        className={field}
      />
      <span id="rt-narr-help" className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>2–3 short lines; it is what the tour page shows for this stop.</span>
        <span className={over ? "font-medium text-destructive" : ""} aria-live="polite">
          {n} / {NARRATIVE_SOFT}
          {over ? ` (limit ${NARRATIVE_HARD})` : ""}
        </span>
      </span>
    </label>
  );
}
