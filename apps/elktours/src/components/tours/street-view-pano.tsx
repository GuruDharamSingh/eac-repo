"use client";

import { useEffect, useRef, useState } from "react";
import type { StreetViewPose } from "@/components/tours/street-view";

/**
 * The live panorama, through the Maps JavaScript API (the one API the site's
 * key is enabled for; the Embed API returned 403 on 2026-10-18). One script
 * load per page; one panorama per slot; moving to another stop sets the new
 * position and eases the heading round to the stop's pose, so the reader sees
 * the view turn rather than a reload.
 */

export type GMaps = {
  maps: {
    importLibrary: (name: string) => Promise<Record<string, unknown>>;
    StreetViewPanorama: new (el: HTMLElement, opts: Record<string, unknown>) => Pano;
    StreetViewService: new () => { getPanorama: (req: Record<string, unknown>) => Promise<{ data: { location?: { pano?: string } } }> };
  };
};
type Pano = {
  setPosition: (p: { lat: number; lng: number }) => void;
  setPano: (id: string) => void;
  setPov: (pov: { heading: number; pitch: number }) => void;
  getPov: () => { heading: number; pitch: number };
  setZoom: (z: number) => void;
  getZoom: () => number;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  setVisible: (v: boolean) => void;
  addListener: (event: string, fn: () => void) => { remove: () => void };
};

declare global {
  interface Window { google?: GMaps; __eacMapsLoading?: Promise<GMaps> }
}

export function loadMaps(key: string): Promise<GMaps> {
  if (window.google?.maps?.StreetViewPanorama) return Promise.resolve(window.google);
  if (!window.__eacMapsLoading) {
    window.__eacMapsLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=beta&loading=async&callback=__eacMapsReady`;
      s.async = true;
      (window as unknown as Record<string, unknown>).__eacMapsReady = () => resolve(window.google!);
      s.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(s);
    });
  }
  return window.__eacMapsLoading;
}

/** Field of view (degrees) → Street View zoom, per Google's mapping (90° = zoom 1). */
const fovToZoom = (fov: number) => Math.log2(180 / Math.max(10, Math.min(180, fov)));
/** Street View zoom → field of view (degrees), the inverse of fovToZoom. */
const zoomToFov = (zoom: number) => Math.max(10, Math.min(120, 180 / Math.pow(2, zoom)));

export interface PanoView {
  heading: number;
  pitch: number;
  fov: number;
  /** The panorama's own position (it moves when the person walks it). */
  lat: number | null;
  lng: number | null;
}

interface Props {
  pose: StreetViewPose;
  apiKey: string;
  className?: string;
  /**
   * Called (debounced) when the person turns or zooms the panorama, with the view rounded to the
   * columns' precision (heading 0.1°, pitch 0.1°, fov 0.1°). The place form saves it as the place's
   * starting view (2026-11-19). A pose fed back from this callback does not re-aim the panorama.
   */
  onViewChange?: (view: PanoView) => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const sameView = (a: PanoView | null, b: { heading?: number | null; pitch?: number | null; fov?: number | null }) =>
  !!a && Math.abs(a.heading - (b.heading ?? 0)) < 0.2 && Math.abs(a.pitch - (b.pitch ?? 0)) < 0.2 && Math.abs(a.fov - (b.fov ?? 90)) < 0.2;

export function StreetViewPano({ pose, apiKey, className, onViewChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const pano = useRef<Pano | null>(null);
  const raf = useRef<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");
  const reported = useRef<PanoView | null>(null);
  const at = useRef<{ lat: number; lng: number } | null>(null);
  const animating = useRef(false);
  const onView = useRef(onViewChange);
  onView.current = onViewChange;

  useEffect(() => {
    let cancelled = false;
    // The pose is the one this panorama just reported: it is already showing it.
    const r = reported.current;
    const samePlace = (r?.lat == null && pose.viewLat == null) || (r?.lat === pose.viewLat && r?.lng === pose.viewLng) || (pose.viewLat == null && r?.lat != null);
    if (pano.current && at.current && at.current.lat === pose.lat && at.current.lng === pose.lng && sameView(r, pose) && samePlace) return;
    (async () => {
      try {
        const g = await loadMaps(apiKey);
        if (cancelled || !box.current) return;
        const target = { heading: pose.heading ?? 0, pitch: pose.pitch ?? 0 };
        // Nearest panorama within 60 m of the stop (or of the spot the editor walked to); outdoor imagery preferred.
        const svc = new g.maps.StreetViewService();
        const look = pose.viewLat != null && pose.viewLng != null ? { lat: pose.viewLat, lng: pose.viewLng } : { lat: pose.lat, lng: pose.lng };
        const found = await svc
          .getPanorama({ location: look, radius: 60, source: "outdoor", preference: "nearest" })
          .catch(() => null);
        if (cancelled) return;
        const panoId = found?.data?.location?.pano;
        if (!panoId) { setState("none"); return; }
        if (!pano.current) {
          pano.current = new g.maps.StreetViewPanorama(box.current, {
            pano: panoId,
            pov: target,
            zoom: fovToZoom(pose.fov ?? 90),
            addressControl: false,
            fullscreenControl: true,
            linksControl: true,
            panControl: false,
            zoomControl: false,
            motionTracking: false,
            motionTrackingControl: false,
            showRoadLabels: false,
          });
          at.current = { lat: pose.lat, lng: pose.lng };
          // Report turns and zooms made by the person (not the easing below), debounced.
          let timer: ReturnType<typeof setTimeout> | null = null;
          // The panorama fires pov/zoom events while it settles on creation: those are not the person's.
          const born = performance.now();
          const report = () => {
            if (animating.current || !onView.current || !pano.current || performance.now() - born < 1200) return;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              const p = pano.current;
              if (!p) return;
              const pov = p.getPov();
              const at = p.getPosition();
              const view = {
                heading: round1(((pov.heading % 360) + 360) % 360),
                pitch: round1(Math.max(-90, Math.min(90, pov.pitch))),
                fov: round1(zoomToFov(p.getZoom())),
                lat: at ? Math.round(at.lat() * 1e6) / 1e6 : null,
                lng: at ? Math.round(at.lng() * 1e6) / 1e6 : null,
              };
              reported.current = view;
              onView.current?.(view);
            }, 400);
          };
          pano.current.addListener("pov_changed", report);
          pano.current.addListener("zoom_changed", report);
          pano.current.addListener("position_changed", report);
          setState("ready");
          return;
        }
        at.current = { lat: pose.lat, lng: pose.lng };
        // Move: new position, then ease the heading round to the pose.
        pano.current.setPano(panoId);
        pano.current.setZoom(fovToZoom(pose.fov ?? 90));
        const from = pano.current.getPov();
        const start = performance.now();
        const dur = 1200;
        const delta = ((target.heading - from.heading + 540) % 360) - 180;
        if (raf.current) cancelAnimationFrame(raf.current);
        animating.current = true;
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          pano.current?.setPov({ heading: from.heading + delta * e, pitch: from.pitch + (target.pitch - from.pitch) * e });
          if (k < 1) raf.current = requestAnimationFrame(step);
          else animating.current = false;
        };
        raf.current = requestAnimationFrame(step);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey, pose.lat, pose.lng, pose.heading, pose.pitch, pose.fov, pose.viewLat, pose.viewLng]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={box} className="h-full w-full" />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
          {state === "loading" ? "Loading Street View…" : state === "none" ? "No Street View imagery at this stop" : "Street View could not load"}
        </div>
      )}
    </div>
  );
}
