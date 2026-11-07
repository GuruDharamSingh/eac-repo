"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

export interface MapPlace {
  id: string;
  title: string;
  lat: number;
  lng: number;
}

/** Same free tiles as the tour maps (OpenFreeMap, no key). */
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const PARIS: [number, number] = [2.3522, 48.8566];

function pin(active: boolean, label?: string): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `places-pin${active ? " is-active" : ""}`;
  if (label) el.textContent = label;
  return el;
}

/**
 * Every place as a pin (the public catalogue's map view). Clicking a pin
 * calls `onSelect`; the active place is highlighted and flown to. With
 * `route`, the given places are numbered in order and joined by a line
 * (the visitor's suggested walk).
 */
export function PlacesMap({
  places,
  activeId,
  onSelect,
  route,
  legs,
  className = "h-[28rem] w-full",
}: {
  places: MapPlace[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  /** Ordered places to number and join (straight lines between them unless `legs` is given). */
  route?: MapPlace[];
  /** The walking line ([lng, lat] per leg, from previewRouteAction); drawn instead of straight lines. */
  legs?: [number, number][][] | null;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MLMap | null>(null);
  const markers = React.useRef<Marker[]>([]);
  const [ready, setReady] = React.useState(false);
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  React.useEffect(() => {
    if (!box.current || map.current) return;
    const m = new maplibregl.Map({ container: box.current, style: STYLE, center: PARIS, zoom: 12.5, attributionControl: { compact: false } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    m.on("load", () => setReady(true));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Pins (and the route's numbers).
  React.useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    const order = new Map((route ?? []).map((p, i) => [p.id, i + 1]));
    markers.current = places.map((p) => {
      const n = order.get(p.id);
      const el = pin(p.id === activeId || n != null, n != null ? String(n) : undefined);
      el.setAttribute("aria-label", p.title);
      el.title = p.title;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current?.(p.id);
      });
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m);
    });
  }, [places, activeId, route]);

  // Fit everything once, then follow the active place.
  const fitted = React.useRef(false);
  React.useEffect(() => {
    const m = map.current;
    if (!m || !ready || places.length === 0) return;
    if (!fitted.current) {
      const b = new maplibregl.LngLatBounds();
      places.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 48, duration: 0, maxZoom: 15 });
      fitted.current = true;
    }
  }, [ready, places]);
  React.useEffect(() => {
    const m = map.current;
    const p = places.find((x) => x.id === activeId);
    if (!m || !ready || !p) return;
    m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 15.5), duration: 900 });
  }, [activeId, ready, places]);

  // The suggested walk as a line.
  React.useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const coords = legs && legs.length ? legs.flat() : (route ?? []).map((p) => [p.lng, p.lat]);
    const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } };
    const src = m.getSource("walk") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data);
    else if (coords.length > 0) {
      m.addSource("walk", { type: "geojson", data });
      m.addLayer({ id: "walk", type: "line", source: "walk", paint: { "line-color": "#e8805c", "line-width": 4, "line-dasharray": [2, 1.5] } });
    }
  }, [route, legs, ready]);

  return (
    <div className="space-y-1">
      <div ref={box} className={`overflow-hidden border border-border ${className}`} />
      <style>{`
        .places-pin { width: 16px; height: 16px; border-radius: 999px; border: 2px solid #fff; background: #2a2e35; box-shadow: 0 1px 4px rgba(0,0,0,.45); cursor: pointer; font: 600 10px/12px system-ui, sans-serif; color: #fff; }
        .places-pin.is-active { width: 22px; height: 22px; background: #c9a25c; color: #1b1e23; }
      `}</style>
    </div>
  );
}
