"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as React from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Same free tiles as the tour maps (OpenFreeMap, no key). */
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const PARIS: LatLng = { lat: 48.8566, lng: 2.3522 };

/**
 * A map for placing one location: click anywhere to drop the pin, drag the
 * pin to correct it. Controlled: `value` is the pin (or null), `onChange`
 * fires on click and at the end of a drag. When `value` changes from
 * outside (a photo's geotag), the map flies there.
 */
export function PinMap({
  value,
  onChange,
  center,
  className = "h-72 w-full",
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  /** Where to open without a pin (the last stop, the tours' centre). */
  center?: LatLng | null;
  className?: string;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MLMap | null>(null);
  const marker = React.useRef<Marker | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  // The last position this component reported, so an echo of our own change does not re-fly the camera.
  const reported = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!box.current || map.current) return;
    const start = value ?? center ?? PARIS;
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [start.lng, start.lat],
      zoom: value ? 17 : 14,
      attributionControl: { compact: false },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    m.getCanvas().style.cursor = "crosshair";
    m.on("click", (e) => {
      const p = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      reported.current = key(p);
      onChangeRef.current(p);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // Created once; value/center updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      const mk = new maplibregl.Marker({ draggable: true, color: "#b45309" }).setLngLat([value.lng, value.lat]).addTo(m);
      mk.on("dragend", () => {
        const ll = mk.getLngLat();
        const p = { lat: ll.lat, lng: ll.lng };
        reported.current = key(p);
        onChangeRef.current(p);
      });
      marker.current = mk;
    } else {
      marker.current.setLngLat([value.lng, value.lat]);
    }
    // A position from outside (a geotag, a typed value): bring it into view.
    if (reported.current !== key(value)) {
      m.flyTo({ center: [value.lng, value.lat], zoom: Math.max(m.getZoom(), 16.5), duration: 900 });
      reported.current = key(value);
    }
  }, [value]);

  return (
    <div className="space-y-1">
      <div ref={box} className={`overflow-hidden border border-border ${className}`} />
      <p className="text-xs text-muted-foreground">
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag it to correct, or click elsewhere to move it.`
          : "Click the map to drop a pin."}{" "}
        Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">OpenStreetMap contributors</a>.
      </p>
    </div>
  );
}

function key(p: LatLng): string {
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}
