"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

/** Same free tiles as the tour maps (OpenFreeMap, no key). */
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const PARIS: [number, number] = [2.3522, 48.8566];

type LngLat = [number, number];
export type Via = Record<string, LngLat[]>;

export interface EditPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
}

/** A point of the route: the meeting point ("meet") or a saved stop (its id). */
export interface RoutePoint {
  key: string;
  title: string;
  lat: number;
  lng: number;
}

/** Position of p along a→b (0..1), for keeping a leg's bends in walking order. */
function along(a: LngLat, b: LngLat, p: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = dx * dx + dy * dy;
  return d === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d;
}

function el(cls: string, text?: string): HTMLElement {
  const e = document.createElement("div");
  e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * The Route step's map: our nearby places as small pins, the route's points numbered, the walking path drawn
 * from `legs`. When `editable`, each leg shows a handle at its middle: drag it to bend the path through that
 * spot (a "via" point); drag a bend to move it; click a bend to remove it. Changes go to `onViaChange`, which
 * saves them and returns new legs.
 */
export function RouteEditMap({
  places,
  activeId,
  onSelect,
  points,
  legs,
  via,
  editable,
  onViaChange,
  className = "h-[26rem] w-full",
}: {
  places: EditPin[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  points: RoutePoint[];
  legs: LngLat[][] | null;
  via: Via;
  editable: boolean;
  onViaChange: (via: Via) => void;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MLMap | null>(null);
  const pinMarkers = React.useRef<Marker[]>([]);
  const editMarkers = React.useRef<Marker[]>([]);
  const [ready, setReady] = React.useState(false);
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViaRef = React.useRef(onViaChange);
  onViaRef.current = onViaChange;
  const viaRef = React.useRef(via);
  viaRef.current = via;

  React.useEffect(() => {
    if (!box.current || map.current) return;
    const m = new maplibregl.Map({ container: box.current, style: STYLE, center: PARIS, zoom: 13.5, attributionControl: { compact: false } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    m.on("load", () => setReady(true));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Place pins and numbered route points.
  React.useEffect(() => {
    const m = map.current;
    if (!m) return;
    pinMarkers.current.forEach((mk) => mk.remove());
    const onRoute = new Set(points.map((p) => p.key));
    const list: Marker[] = [];
    for (const p of places) {
      if (onRoute.has(p.id)) continue;
      const e = el(`rem-pin${p.id === activeId ? " is-active" : ""}`);
      e.title = p.title;
      e.setAttribute("role", "button");
      e.setAttribute("aria-label", p.title);
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current?.(p.id);
      });
      list.push(new maplibregl.Marker({ element: e }).setLngLat([p.lng, p.lat]).addTo(m));
    }
    points.forEach((p, i) => {
      // The meeting point and stop 1 usually share a spot: number stop 1, skip the duplicate.
      if (p.key === "meet" && points[1] && points[1].lat === p.lat && points[1].lng === p.lng) return;
      const e = el("rem-stop", p.key === "meet" ? "M" : String(points[0]?.key === "meet" ? i : i + 1));
      e.title = p.title;
      e.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current?.(`point:${p.key}`);
      });
      list.push(new maplibregl.Marker({ element: e }).setLngLat([p.lng, p.lat]).addTo(m));
    });
    pinMarkers.current = list;
  }, [places, points, activeId]);

  // Fit once there is something to show.
  const fitted = React.useRef(false);
  React.useEffect(() => {
    const m = map.current;
    if (!m || !ready || fitted.current) return;
    const all = [...points.map((p) => [p.lng, p.lat] as LngLat), ...places.map((p) => [p.lng, p.lat] as LngLat)];
    if (all.length === 0) return;
    const b = new maplibregl.LngLatBounds();
    all.forEach((p) => b.extend(p));
    m.fitBounds(b, { padding: 48, duration: 0, maxZoom: 16 });
    fitted.current = true;
  }, [ready, points, places]);

  // The path.
  React.useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const coords = legs && legs.length ? legs.flat() : points.map((p) => [p.lng, p.lat]);
    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } };
    const src = m.getSource("rem-walk") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else {
      m.addSource("rem-walk", { type: "geojson", data });
      m.addLayer({ id: "rem-walk", type: "line", source: "rem-walk", paint: { "line-color": "#e8805c", "line-width": 4 } });
    }
  }, [legs, points, ready]);

  // Handles: a middle handle per leg, and the leg's bends.
  React.useEffect(() => {
    const m = map.current;
    editMarkers.current.forEach((mk) => mk.remove());
    editMarkers.current = [];
    if (!m || !editable) return;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      if (a.lat === b.lat && a.lng === b.lng) continue;
      const key = `${a.key}>${b.key}`;
      const A: LngLat = [a.lng, a.lat];
      const B: LngLat = [b.lng, b.lat];
      const leg = legs?.[i];
      const mid: LngLat = leg && leg.length > 2 ? leg[Math.floor(leg.length / 2)]! : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const add = new maplibregl.Marker({ element: el("rem-mid", "+"), draggable: true }).setLngLat(mid).addTo(m);
      add.getElement().title = "Drag to bend the path through another street";
      add.on("dragend", () => {
        const p = add.getLngLat();
        const next = [...(viaRef.current[key] ?? []), [p.lng, p.lat] as LngLat].sort((x, y) => along(A, B, x) - along(A, B, y));
        onViaRef.current({ ...viaRef.current, [key]: next });
      });
      editMarkers.current.push(add);
      (via[key] ?? []).forEach((v, j) => {
        const mk = new maplibregl.Marker({ element: el("rem-via"), draggable: true }).setLngLat(v).addTo(m);
        mk.getElement().title = "Drag to move this bend; click to remove it";
        let moved = false;
        mk.on("dragstart", () => {
          moved = true;
        });
        mk.on("dragend", () => {
          const p = mk.getLngLat();
          const list = [...(viaRef.current[key] ?? [])];
          list[j] = [p.lng, p.lat];
          onViaRef.current({ ...viaRef.current, [key]: list.sort((x, y) => along(A, B, x) - along(A, B, y)) });
        });
        mk.getElement().addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (moved) {
            moved = false;
            return;
          }
          const list = (viaRef.current[key] ?? []).filter((_, k) => k !== j);
          const nextVia = { ...viaRef.current };
          if (list.length) nextVia[key] = list;
          else delete nextVia[key];
          onViaRef.current(nextVia);
        });
        editMarkers.current.push(mk);
      });
    }
  }, [editable, points, legs, via, ready]);

  return (
    <div>
      <div ref={box} className={`overflow-hidden border border-border ${className}`} />
      <style>{`
        .rem-pin { width: 14px; height: 14px; border-radius: 999px; border: 2px solid #fff; background: #2a2e35; box-shadow: 0 1px 4px rgba(0,0,0,.45); cursor: pointer; }
        .rem-pin.is-active { width: 20px; height: 20px; background: #c9a25c; }
        .rem-stop { width: 24px; height: 24px; border-radius: 999px; border: 2px solid #fff; background: #c9a25c; color: #1b1e23; font: 700 11px/20px system-ui, sans-serif; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,.45); cursor: pointer; }
        .rem-mid { width: 18px; height: 18px; border-radius: 999px; border: 2px solid #e8805c; background: #fff; color: #e8805c; font: 700 13px/14px system-ui, sans-serif; text-align: center; cursor: grab; opacity: .9; }
        .rem-via { width: 12px; height: 12px; border-radius: 2px; border: 2px solid #fff; background: #e8805c; box-shadow: 0 1px 3px rgba(0,0,0,.5); cursor: grab; }
      `}</style>
    </div>
  );
}
