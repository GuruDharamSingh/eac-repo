"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";

export interface MapStop {
  id: string;
  title: string;
  lat: number;
  lng: number;
}

interface TourMapProps {
  stops: MapStop[];
  meetingPoint?: { lat: number; lng: number; label?: string | null } | null;
  /** Which stop the reader is on; the map flies there. -1 = overview. */
  activeIndex: number;
  onSelect?: (index: number) => void;
  className?: string;
  interactive?: boolean;
}

/** Free vector tiles, no key (OpenFreeMap, OpenMapTiles schema). */
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const PARIS: [number, number] = [2.3522, 48.8566];
const STOP_ZOOM = 16.5;
const STOP_PITCH = 58;

function pin(label: string | number, active: boolean): HTMLElement {
  const el = document.createElement("span");
  el.className = `tour-pin${active ? " is-active" : ""}`;
  el.textContent = String(label);
  return el;
}

/**
 * The route map on MapLibre GL: vector tiles with 3D building extrusions, a
 * dashed line joining the stops, numbered pins and a star for the meeting
 * point. Moving between stops is a pitched, banked fly-to; the overview is a
 * flat fit of every point. The style is loaded once; everything else is
 * updated in place so the camera never resets.
 */
export function TourMap({ stops, meetingPoint, activeIndex, onSelect, className, interactive = true }: TourMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!box.current || map.current) return;
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: stops[0] ? [stops[0].lng, stops[0].lat] : meetingPoint ? [meetingPoint.lng, meetingPoint.lat] : PARIS,
      zoom: 14,
      pitch: 0,
      attributionControl: { compact: true },
      interactive,
      scrollZoom: false,
      cooperativeGestures: false,
    });
    if (interactive) m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    m.on("load", () => {
      // 3D buildings from the OpenMapTiles `building` layer, under the labels.
      const labelLayer = m.getStyle().layers?.find((l) => l.type === "symbol" && (l.layout as Record<string, unknown> | undefined)?.["text-field"])?.id;
      if (!m.getLayer("eac-3d-buildings")) {
        m.addLayer(
          {
            id: "eac-3d-buildings",
            type: "fill-extrusion",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#d9d4c7",
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.75,
            },
          },
          labelLayer
        );
      }
      m.addSource("eac-route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "eac-route-line",
        type: "line",
        source: "eac-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1f2a44", "line-width": 3, "line-dasharray": [1.5, 2], "line-opacity": 0.85 },
      });
      ready.current = true;
      m.fire("eac:ready");
    });
    map.current = m;
    return () => {
      markers.current.forEach((k) => k.remove());
      markers.current = [];
      m.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins and route follow the data.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      markers.current.forEach((k) => k.remove());
      markers.current = [];
      if (meetingPoint) {
        const mk = new maplibregl.Marker({ element: pin("★", activeIndex === -1) })
          .setLngLat([meetingPoint.lng, meetingPoint.lat])
          .addTo(m);
        if (meetingPoint.label) mk.getElement().title = meetingPoint.label;
        markers.current.push(mk);
      }
      stops.forEach((s, i) => {
        const el = pin(i + 1, i === activeIndex);
        el.title = s.title;
        el.style.cursor = onSelectRef.current ? "pointer" : "default";
        el.addEventListener("click", () => onSelectRef.current?.(i));
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(m));
      });
      const src = m.getSource("eac-route") as maplibregl.GeoJSONSource | undefined;
      src?.setData({
        type: "FeatureCollection",
        features: stops.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: stops.map((s) => [s.lng, s.lat]) } }] : [],
      });
    };
    if (ready.current) apply();
    else m.once("eac:ready", apply);
  }, [stops, meetingPoint, activeIndex]);

  // Camera follows the active stop.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const first = { current: true };
    const move = () => {
      const points: [number, number][] = [
        ...(meetingPoint ? [[meetingPoint.lng, meetingPoint.lat] as [number, number]] : []),
        ...stops.map((s) => [s.lng, s.lat] as [number, number]),
      ];
      if (points.length === 0) return;
      const s = activeIndex >= 0 ? stops[activeIndex] : null;
      if (s) {
        // Bank towards the next stop so the route reads as a direction of travel.
        const next = stops[activeIndex + 1] ?? stops[activeIndex - 1];
        const bearing = next ? (Math.atan2(next.lng - s.lng, next.lat - s.lat) * 180) / Math.PI : 0;
        m.flyTo({ center: [s.lng, s.lat], zoom: STOP_ZOOM, pitch: STOP_PITCH, bearing, duration: 1800, essential: true, curve: 1.4 });
      } else {
        const b = points.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
        if (first.current && !m.isMoving() && m.getZoom() === 14) m.fitBounds(b, { padding: 48, pitch: 0, bearing: 0, duration: 0 });
        else m.fitBounds(b, { padding: 48, pitch: 0, bearing: 0, duration: 1600 });
      }
      first.current = false;
    };
    if (ready.current) move();
    else m.once("eac:ready", move);
  }, [stops, meetingPoint, activeIndex]);

  return <div ref={box} className={className} style={{ width: "100%", height: "100%" }} />;
}
