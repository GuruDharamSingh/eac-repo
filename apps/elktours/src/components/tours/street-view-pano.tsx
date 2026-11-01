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
  setVisible: (v: boolean) => void;
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

interface Props {
  pose: StreetViewPose;
  apiKey: string;
  className?: string;
}

export function StreetViewPano({ pose, apiKey, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const pano = useRef<Pano | null>(null);
  const raf = useRef<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await loadMaps(apiKey);
        if (cancelled || !box.current) return;
        const target = { heading: pose.heading ?? 0, pitch: pose.pitch ?? 0 };
        // Nearest panorama within 60 m of the stop; outdoor imagery preferred.
        const svc = new g.maps.StreetViewService();
        const found = await svc
          .getPanorama({ location: { lat: pose.lat, lng: pose.lng }, radius: 60, source: "outdoor", preference: "nearest" })
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
          setState("ready");
          return;
        }
        // Move: new position, then ease the heading round to the pose.
        pano.current.setPano(panoId);
        pano.current.setZoom(fovToZoom(pose.fov ?? 90));
        const from = pano.current.getPov();
        const start = performance.now();
        const dur = 1200;
        const delta = ((target.heading - from.heading + 540) % 360) - 180;
        if (raf.current) cancelAnimationFrame(raf.current);
        const step = (t: number) => {
          const k = Math.min(1, (t - start) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          pano.current?.setPov({ heading: from.heading + delta * e, pitch: from.pitch + (target.pitch - from.pitch) * e });
          if (k < 1) raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey, pose.lat, pose.lng, pose.heading, pose.pitch, pose.fov]);

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
