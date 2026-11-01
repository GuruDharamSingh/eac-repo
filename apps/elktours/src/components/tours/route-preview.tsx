"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import type { TourStop } from "@elkdonis/commerce/server";
import { loadMaps, type GMaps } from "@/components/tours/street-view-pano";
import type { TourRoute } from "@/lib/tours";

/**
 * "Preview the route": a scripted drive along the walk.
 *
 * Camera: for each leg the camera travels the cached street geometry
 * (threads.metadata.tour.route, from OSRM) at constant ground speed, 10 s per
 * leg, low and tilted like a drone a few storeys up, heading in the direction
 * of travel; it slows into the stop, lifts and turns to face the building.
 * Then the card opens and the Street View panorama tilts up from the
 * pavement to the façade. Click-through uses the same moves.
 *
 * Renderers: Google's photorealistic 3D map (Maps JavaScript API `maps3d`,
 * textured buildings) when the key is present and the library loads; MapLibre
 * GL with extruded footprints otherwise. Both implement `Renderer` below; the
 * script never knows which one is drawing.
 *
 * Spend: the 3D map is created on Play, never on page load (one Immersive
 * Maps event per play). One StreetViewPanorama instance is created on the
 * first arrival and reused for every stop (one Dynamic Street View event per
 * play). Stills and route geometry come from the site's own cache.
 */

const LEG_MS = 10_000;
const ARRIVE_MS = 2_400;
const HOLD_MS = 4_500;
const INTRO_MS = 2_600;
const TRAVEL_TILT = 70;
const TRAVEL_RANGE = 110; // metres from camera to the ground point; closer than ~90 m the 3D tiles look melted
const ARRIVE_TILT = 60;
const ARRIVE_RANGE = 130;
const ORBIT_DEG = 55;

type LngLat = [number, number];
interface Cam { lng: number; lat: number; heading: number; tilt: number; range: number }

interface Renderer {
  setCamera(c: Cam): void;
  setDrawn(coords: LngLat[]): void;
  setActive(i: number): void;
  fitAll(ms: number): void;
  destroy(): void;
}

// ── geometry ───────────────────────────────────────────────────────────────

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
function dist(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
function lerpAngle(a: number, b: number, k: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * k + 360) % 360;
}
/** A polyline with cumulative distances, for constant-speed travel. */
class Path {
  readonly cum: number[] = [0];
  readonly total: number;
  constructor(readonly pts: LngLat[]) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1]! + dist(pts[i - 1]!, pts[i]!));
    this.total = this.cum[this.cum.length - 1] ?? 0;
  }
  at(d: number): LngLat {
    const p = this.pts;
    if (p.length === 1 || d <= 0) return p[0]!;
    if (d >= this.total) return p[p.length - 1]!;
    let i = 1;
    while (this.cum[i]! < d) i++;
    const a = p[i - 1]!, b = p[i]!, seg = this.cum[i]! - this.cum[i - 1]!;
    const k = seg === 0 ? 0 : (d - this.cum[i - 1]!) / seg;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  /** Points up to distance d, plus the exact point at d. */
  upTo(d: number): LngLat[] {
    const out: LngLat[] = [];
    for (let i = 0; i < this.pts.length && this.cum[i]! <= d; i++) out.push(this.pts[i]!);
    out.push(this.at(d));
    return out;
  }
}
/** Slow in and out at the ends only; constant speed in the middle. */
function easeTravel(t: number): number {
  // Trapezoid speed profile: ramps of length e at both ends, constant in the middle, normalised so f(1) = 1.
  const e = 0.18;
  let g: number;
  if (t < e) g = (t * t) / (2 * e);
  else if (t > 1 - e) { const u = 1 - t; g = 1 - e - (u * u) / (2 * e); }
  else g = t - e / 2;
  return Math.min(1, Math.max(0, g / (1 - e)));
}
const smooth = (t: number) => t * t * (3 - 2 * t);
/** The player's clock. A recorder may drive it (window.__previewNow) so a slow renderer still yields real timing. */
const now = (): number => (typeof window !== "undefined" && (window as unknown as { __previewNow?: () => number }).__previewNow?.()) ?? performance.now();

// ── Google photorealistic 3D ───────────────────────────────────────────────

async function makeGoogle3D(g: GMaps, container: HTMLElement, stops: LngLat[], meeting: LngLat | null): Promise<Renderer> {
  const lib = (await g.maps.importLibrary("maps3d")) as Record<string, any>;
  const { Map3DElement, Marker3DElement, Polyline3DElement, MapMode, AltitudeMode } = lib;
  const first = meeting ?? stops[0] ?? [2.3522, 48.8566];
  const map = new Map3DElement({
    center: { lat: first[1], lng: first[0], altitude: 0 },
    range: 2500, tilt: 45, heading: 0,
    mode: MapMode?.HYBRID ?? "HYBRID",
    defaultUIDisabled: true,
  });
  map.style.width = "100%"; map.style.height = "100%";
  container.appendChild(map);
  const line = new Polyline3DElement({ altitudeMode: AltitudeMode?.CLAMP_TO_GROUND ?? "CLAMP_TO_GROUND", strokeColor: "#ff5a1f", strokeWidth: 10, drawsOccludedSegments: true });
  map.append(line);
  const markers: any[] = [];
  const mk = (p: LngLat, label: string) => {
    const m = new Marker3DElement({ position: { lat: p[1], lng: p[0] }, altitudeMode: AltitudeMode?.CLAMP_TO_GROUND ?? "CLAMP_TO_GROUND", label, extruded: true, collisionBehavior: "REQUIRED" });
    map.append(m); markers.push(m);
  };
  if (meeting) mk(meeting, "★");
  stops.forEach((p, i) => mk(p, String(i + 1)));
  const all = [...(meeting ? [meeting] : []), ...stops];
  return {
    setCamera: (c) => { map.center = { lat: c.lat, lng: c.lng, altitude: 0 }; map.heading = c.heading; map.tilt = c.tilt; map.range = c.range; },
    setDrawn: (coords) => { if (coords.length >= 2) line.coordinates = coords.map((p) => ({ lat: p[1], lng: p[0] })); else line.coordinates = [{ lat: first[1], lng: first[0] }, { lat: first[1], lng: first[0] }]; },
    setActive: () => {},
    fitAll: (ms) => {
      if (all.length === 0) return;
      const lngs = all.map((p) => p[0]), lats = all.map((p) => p[1]);
      const c: LngLat = [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
      const span = Math.max(dist([Math.min(...lngs), c[1]], [Math.max(...lngs), c[1]]), dist([c[0], Math.min(...lats)], [c[0], Math.max(...lats)]), 300);
      map.flyCameraTo({ endCamera: { center: { lat: c[1], lng: c[0], altitude: 0 }, range: span * 1.6, tilt: 40, heading: 0 }, durationMillis: ms });
    },
    destroy: () => { map.remove(); },
  };
}

// ── MapLibre fallback ──────────────────────────────────────────────────────

async function makeMapLibre(container: HTMLElement, stops: LngLat[], meeting: LngLat | null): Promise<Renderer> {
  const maplibregl = (await import("maplibre-gl")).default;
  const all = [...(meeting ? [meeting] : []), ...stops];
  const m = new maplibregl.Map({ container, style: "https://tiles.openfreemap.org/styles/liberty", center: all[0] ?? [2.3522, 48.8566], zoom: 13, attributionControl: { compact: true }, interactive: false });
  await new Promise<void>((r) => m.on("load", () => r()));
  const labelLayer = m.getStyle().layers?.find((l) => l.type === "symbol" && (l.layout as Record<string, unknown> | undefined)?.["text-field"])?.id;
  m.addLayer({ id: "p3d", type: "fill-extrusion", source: "openmaptiles", "source-layer": "building", minzoom: 14, paint: { "fill-extrusion-color": "#d9d4c7", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 12], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.85 } }, labelLayer);
  m.addSource("pr", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  m.addLayer({ id: "pr-line", type: "line", source: "pr", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff5a1f", "line-width": 6 } });
  const pins: maplibregl.Marker[] = [];
  const pin = (p: LngLat, label: string) => {
    const el = document.createElement("span"); el.className = "tour-pin"; el.textContent = label;
    pins.push(new maplibregl.Marker({ element: el }).setLngLat(p).addTo(m));
  };
  if (meeting) pin(meeting, "★");
  stops.forEach((p, i) => pin(p, String(i + 1)));
  // range (m) → zoom: at zoom z one pixel is 40075016·cos(lat)/(256·2^z) m; a 75 m range over ~half the view height.
  const zoomFor = (range: number, lat: number, h: number) => Math.log2((40075016 * Math.cos(rad(lat)) * h * 0.55) / (256 * range));
  return {
    setCamera: (c) => m.jumpTo({ center: [c.lng, c.lat], bearing: c.heading, pitch: Math.min(85, c.tilt), zoom: Math.min(19.5, zoomFor(c.range, c.lat, container.clientHeight || 600)) }),
    setDrawn: (coords) => (m.getSource("pr") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] }),
    setActive: (i) => pins.forEach((p, k) => p.getElement().classList.toggle("is-active", k - (meeting ? 1 : 0) === i)),
    fitAll: (ms) => { if (all.length) m.fitBounds(all.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(all[0], all[0])), { padding: 60, pitch: 35, bearing: 0, duration: ms }); },
    destroy: () => { pins.forEach((p) => p.remove()); m.remove(); },
  };
}

// ── the player ─────────────────────────────────────────────────────────────

interface RoutePreviewProps {
  title: string;
  stops: TourStop[];
  meetingPoint: { lat: number; lng: number; label?: string | null } | null;
  route: TourRoute | null;
  googleMapsKey: string | null;
  onClose?: () => void;
}

export function RoutePreview({ title, stops, meetingPoint, route, googleMapsKey, onClose }: RoutePreviewProps) {
  const placed = useMemo(() => stops.filter((s) => s.lat != null && s.lng != null), [stops]);
  const meeting = useMemo<LngLat | null>(() => (meetingPoint ? [meetingPoint.lng, meetingPoint.lat] : null), [meetingPoint]);
  const stopPts = useMemo<LngLat[]>(() => placed.map((s) => [s.lng!, s.lat!]), [placed]);
  // One path per leg: meeting → stop 1, stop 1 → stop 2, …  (or stop 1 → stop 2 … without a meeting point).
  const legs = useMemo<Path[]>(() => {
    const pts = [...(meeting ? [meeting] : []), ...stopPts];
    const cached = route?.legs?.length === pts.length - 1 ? route.legs : null;
    return pts.slice(1).map((p, i) => new Path(cached ? cached[i]! : [pts[i]!, p]));
  }, [meeting, stopPts, route]);
  const legForStop = (i: number) => (meeting ? i : i - 1); // index into legs; -1 = no travel (first stop, no meeting point)

  const box = useRef<HTMLDivElement>(null);
  const panoBox = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const pano = useRef<any>(null);
  const gmaps = useRef<GMaps | null>(null);
  const raf = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(0);
  const cam = useRef<Cam>({ lng: stopPts[0]?.[0] ?? 2.35, lat: stopPts[0]?.[1] ?? 48.85, heading: 0, tilt: 45, range: 2000 });

  const [started, setStarted] = useState(false);
  const [engine, setEngine] = useState<"google" | "maplibre" | null>(null);
  const [at, setAt] = useState(-1);
  const [heading, setHeadingTo] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<"idle" | "travel" | "hold">("idle");
  const [expanded, setExpanded] = useState(false);
  const [panoState, setPanoState] = useState<"off" | "loading" | "on" | "none">("off");
  const [progress, setProgress] = useState(0);

  const clear = () => { if (raf.current) cancelAnimationFrame(raf.current); if (timer.current) clearTimeout(timer.current); raf.current = null; timer.current = null; };
  const wait = (ms: number) => new Promise<void>((r) => {
    const t0 = now();
    const poll = () => { if (now() - t0 >= ms) r(); else raf.current = requestAnimationFrame(poll); };
    raf.current = requestAnimationFrame(poll);
  });
  const apply = (c: Cam) => { cam.current = c; renderer.current?.setCamera(c); };

  /** Create the renderer (first Play). Google 3D when possible, else MapLibre. */
  const ensureRenderer = useCallback(async () => {
    if (renderer.current || !box.current) return;
    if (googleMapsKey) {
      try {
        const g = await loadMaps(googleMapsKey);
        gmaps.current = g;
        renderer.current = await makeGoogle3D(g, box.current, stopPts, meeting);
        setEngine("google");
        return;
      } catch (err) {
        console.warn("[preview] 3D map unavailable, using MapLibre:", err);
      }
    }
    renderer.current = await makeMapLibre(box.current, stopPts, meeting);
    setEngine("maplibre");
  }, [googleMapsKey, stopPts, meeting]);

  useEffect(() => () => { clear(); renderer.current?.destroy(); renderer.current = null; }, []);

  /** Travel leg `li` over LEG_MS, drawing the line; the camera follows the street. */
  function travel(li: number, myRun: number): Promise<void> {
    const path = legs[li];
    if (!path) return Promise.resolve();
    const drawnBefore = legs.slice(0, li).flatMap((p) => p.pts);
    const ms = Math.max(4000, Math.min(LEG_MS, path.total * 40)); // very short hops take less than 10 s
    const t0 = now();
    let h = cam.current.heading;
    return new Promise((resolve) => {
      const step = (now: number) => {
        if (myRun !== run.current) return resolve();
        const t = Math.min(1, (now - t0) / ms);
        const d = easeTravel(t) * path.total;
        const p = path.at(d);
        const ahead = path.at(Math.min(path.total, d + 18));
        const target = dist(p, ahead) > 1 ? bearing(p, ahead) : h;
        h = lerpAngle(h, target, 0.08);
        apply({ lng: p[0], lat: p[1], heading: h, tilt: TRAVEL_TILT, range: TRAVEL_RANGE });
        renderer.current?.setDrawn([...drawnBefore, ...path.upTo(d)]);
        setProgress((li + t) / Math.max(1, legs.length));
        if (t < 1) raf.current = requestAnimationFrame(step); else resolve();
      };
      raf.current = requestAnimationFrame(step);
    });
  }

  /** Arrive: lift, turn toward the stop's own heading (its Street View pose), look down at the building. */
  function arrive(i: number, myRun: number): Promise<void> {
    const s = placed[i]!;
    const from = { ...cam.current };
    const faceTo = s.heading != null ? Number(s.heading) : from.heading + ORBIT_DEG;
    const t0 = now();
    return new Promise((resolve) => {
      const step = (now: number) => {
        if (myRun !== run.current) return resolve();
        const t = smooth(Math.min(1, (now - t0) / ARRIVE_MS));
        apply({
          lng: s.lng!, lat: s.lat!,
          heading: lerpAngle(from.heading, faceTo, t),
          tilt: from.tilt + (ARRIVE_TILT - from.tilt) * t,
          range: from.range + (ARRIVE_RANGE - from.range) * t,
        });
        if (t < 1) raf.current = requestAnimationFrame(step); else resolve();
      };
      raf.current = requestAnimationFrame(step);
    });
  }

  /** The Street View tilt-up at a stop, in the card. One panorama instance for the whole page. */
  async function tiltUp(i: number, myRun: number) {
    const s = placed[i]!;
    const g = gmaps.current;
    if (!g || !panoBox.current) return;
    setPanoState("loading");
    try {
      const svc = new g.maps.StreetViewService();
      const found = await svc.getPanorama({ location: { lat: s.lat!, lng: s.lng! }, radius: 60, source: "outdoor", preference: "nearest" }).catch(() => null);
      if (myRun !== run.current) return;
      const id = found?.data?.location?.pano;
      if (!id) { setPanoState("none"); return; }
      const targetPov = { heading: Number(s.heading ?? 0), pitch: Number(s.pitch ?? 0) };
      const startPov = { heading: targetPov.heading, pitch: -22 };
      if (!pano.current) {
        pano.current = new g.maps.StreetViewPanorama(panoBox.current, { pano: id, pov: startPov, zoom: 0.6, addressControl: false, fullscreenControl: false, linksControl: false, panControl: false, zoomControl: false, motionTracking: false, motionTrackingControl: false, showRoadLabels: false, clickToGo: false, disableDefaultUI: true });
      } else {
        pano.current.setPano(id); pano.current.setPov(startPov); pano.current.setZoom(0.6);
      }
      setPanoState("on");
      await wait(500);
      const t0 = now();
      const dur = 1800;
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          if (myRun !== run.current) return resolve();
          const t = smooth(Math.min(1, (now - t0) / dur));
          pano.current.setPov({ heading: targetPov.heading, pitch: startPov.pitch + (targetPov.pitch - startPov.pitch) * t });
          if (t < 1) raf.current = requestAnimationFrame(step); else resolve();
        };
        raf.current = requestAnimationFrame(step);
      });
    } catch {
      setPanoState("none");
    }
  }

  async function goTo(i: number, myRun: number, withTravel: boolean) {
    setPhase("travel"); setExpanded(false); setPanoState("off"); setHeadingTo(i); renderer.current?.setActive(i);
    const li = legForStop(i);
    if (withTravel && li >= 0 && legs[li]) await travel(li, myRun);
    else {
      // Click-through from far away: a quick fly to the stop, then the same arrival.
      const s = placed[i]!;
      const from = { ...cam.current }; const t0 = now();
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          if (myRun !== run.current) return resolve();
          const t = smooth(Math.min(1, (now - t0) / 1600));
          apply({ lng: from.lng + (s.lng! - from.lng) * t, lat: from.lat + (s.lat! - from.lat) * t, heading: from.heading, tilt: from.tilt + (TRAVEL_TILT - from.tilt) * t, range: from.range + (TRAVEL_RANGE - from.range) * t });
          if (t < 1) raf.current = requestAnimationFrame(step); else resolve();
        };
        raf.current = requestAnimationFrame(step);
      });
      renderer.current?.setDrawn(legs.slice(0, Math.max(0, li + 1)).flatMap((p) => p.pts));
    }
    if (myRun !== run.current) return;
    await arrive(i, myRun);
    if (myRun !== run.current) return;
    setAt(i); setHeadingTo(null); setPhase("hold");
    await tiltUp(i, myRun);
  }

  async function play(from = -1) {
    const myRun = ++run.current;
    clear(); setStarted(true); setPlaying(true);
    await ensureRenderer();
    if (myRun !== run.current) return;
    if (from < 0) {
      setPhase("travel"); setAt(-1); renderer.current?.setDrawn([]);
      renderer.current?.fitAll(INTRO_MS);
      await wait(INTRO_MS + 600);
      if (myRun !== run.current) return;
      // Drop to the meeting point (or the first stop) to begin the drive.
      const start = meeting ?? stopPts[0]!;
      cam.current = { lng: start[0], lat: start[1], heading: legs[0] ? bearing(legs[0].at(0), legs[0].at(Math.min(legs[0].total, 25))) : 0, tilt: TRAVEL_TILT, range: TRAVEL_RANGE };
      const t0 = now(); const fromCam = { lng: start[0], lat: start[1], heading: 0, tilt: 40, range: 900 };
      await new Promise<void>((resolve) => {
        const step = (now: number) => {
          if (myRun !== run.current) return resolve();
          const t = smooth(Math.min(1, (now - t0) / 2200));
          apply({ lng: start[0], lat: start[1], heading: lerpAngle(fromCam.heading, cam.current.heading, t), tilt: fromCam.tilt + (TRAVEL_TILT - fromCam.tilt) * t, range: fromCam.range + (TRAVEL_RANGE - fromCam.range) * t });
          if (t < 1) raf.current = requestAnimationFrame(step); else resolve();
        };
        raf.current = requestAnimationFrame(step);
      });
    }
    for (let i = Math.max(0, from); i < placed.length; i++) {
      if (myRun !== run.current) return;
      await goTo(i, myRun, true);
      if (myRun !== run.current) return;
      await wait(HOLD_MS);
    }
    if (myRun === run.current) setPlaying(false);
  }

  function pause() { run.current++; clear(); setPlaying(false); if (phase === "travel") setPhase("hold"); }
  function jump(i: number) {
    const myRun = ++run.current; clear(); setPlaying(false); setStarted(true);
    void (async () => {
      await ensureRenderer();
      if (myRun !== run.current) return;
      if (i < 0) { setAt(-1); setPhase("hold"); setPanoState("off"); renderer.current?.setDrawn([]); renderer.current?.fitAll(1800); return; }
      const adjacent = i === at + 1;
      await goTo(i, myRun, adjacent);
    })();
  }

  const current = at >= 0 ? placed[at] : null;
  const firstLine = (html: string | null) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(/(?<=\.)\s/)[0] ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); playing ? pause() : void play(at < 0 ? -1 : at + 1 < placed.length ? at + 1 : -1); }
      if (e.key === "ArrowRight") jump(Math.min(placed.length - 1, at + 1));
      if (e.key === "ArrowLeft") jump(Math.max(-1, at - 1));
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, at, placed.length]);

  const dotState = (i: number) => (at === i ? " is-active" : heading === i ? " is-heading" : i < at ? " is-done" : "");

  return (
    <div className="route-preview" data-phase={phase} data-engine={engine ?? undefined}>
      <div ref={box} className="route-preview__map" />

      {!started && (
        <button type="button" className="route-preview__start" onClick={() => void play(-1)}>
          <Play className="size-6" /> Preview the route
        </button>
      )}

      <div className="route-preview__bar">
        <button type="button" className="route-preview__btn" onClick={() => jump(Math.max(-1, at - 1))} aria-label="Previous stop"><SkipBack className="size-4" /></button>
        <button type="button" className="route-preview__btn route-preview__btn--main" onClick={() => (playing ? pause() : void play(at < 0 ? -1 : at + 1 < placed.length ? at + 1 : -1))} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </button>
        <button type="button" className="route-preview__btn" onClick={() => jump(Math.min(placed.length - 1, at + 1))} aria-label="Next stop"><SkipForward className="size-4" /></button>
        <div className="route-preview__dots" role="tablist" aria-label="Stops">
          <button type="button" role="tab" aria-selected={at === -1} className={`route-preview__dot${at === -1 && started ? " is-active" : ""}`} onClick={() => jump(-1)} title="Overview">★</button>
          {placed.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={at === i} className={`route-preview__dot${dotState(i)}`} onClick={() => jump(i)} title={s.title}>{i + 1}</button>
          ))}
        </div>
        <div className="route-preview__progress" aria-hidden><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <span className="route-preview__title">{title}{engine === "maplibre" ? " · map view" : ""}</span>
        {onClose && <button type="button" className="route-preview__btn" onClick={onClose} aria-label="Close preview"><X className="size-4" /></button>}
      </div>

      {/* The card stays mounted so the panorama instance survives between stops; it is hidden while travelling. */}
      <aside className={`route-preview__card${expanded ? " is-expanded" : ""}${current && phase === "hold" ? "" : " is-hidden"}`} aria-hidden={!(current && phase === "hold")}>
        <div className="route-preview__media">
          {current?.stillUrl || current?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current?.stillUrl ?? current?.imageUrl ?? ""} alt="" className={`route-preview__still${panoState === "on" ? " is-under" : ""}`} />
          ) : null}
          <div ref={panoBox} className={`route-preview__pano${panoState === "on" ? " is-on" : ""}`} />
          {panoState === "none" && !current?.stillUrl && !current?.imageUrl && (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No street view here</div>
          )}
        </div>
        {current && (
          <div className="route-preview__text">
            <p className="tour-stop__kicker">Stop {at + 1} of {placed.length}{current.durationMinutes ? ` · ${current.durationMinutes} min` : ""}</p>
            <h3 className="route-preview__h">{current.title}</h3>
            {expanded ? (
              <div className="route-preview__body" dangerouslySetInnerHTML={{ __html: current.body ?? "" }} />
            ) : (
              <p className="route-preview__lede">{firstLine(current.body)}</p>
            )}
            {current.body && (
              <button type="button" className="route-preview__more" onClick={() => { pause(); setExpanded((v) => !v); }}>{expanded ? "Less" : "Read more"}</button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
