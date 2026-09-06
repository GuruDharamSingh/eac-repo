"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { siteConfig } from "@/config/site";

/**
 * Leaflet, driven imperatively from one effect.
 *
 * No react-leaflet: its React-19-compatible line and the clustering wrapper
 * are on different release cadences, and clustering is the part we actually
 * need. Talking to Leaflet directly is about a hundred lines, has no
 * version-compat surface, and makes "add 800 markers to a cluster group" plain
 * instead of a fight with reconciliation.
 *
 * This module touches `window` at import time, so it is only ever reached
 * through the dynamic(ssr:false) in map-panel.tsx.
 */

export interface MapPin {
  slug: string;
  title: string;
  lat: number;
  lng: number;
  tier: string | null;
  thumb: string | null;
}

export interface LeafletMapProps {
  center: [number, number];
  zoom: number;
  pins?: MapPin[];
  /** Show a draggable pin the user places. Turns the map into a picker. */
  picker?: boolean;
  pickerPosition?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number) => void;
  className?: string;
}

/** Tier accents, mirroring the seeded pigeon_tiers rows for map pins. */
const TIER_COLOURS: Record<string, string> = {
  street: "#8A8A8A",
  common: "#7FA88C",
  uncommon: "#5B87C4",
  rare: "#A768C9",
  legendary: "#E0A521",
};

function pinIcon(tier: string | null): L.DivIcon {
  const colour = (tier && TIER_COLOURS[tier]) || "#8A8A8A";
  // A divIcon, never L.Icon: the default marker resolves marker-icon.png by
  // relative URL and 404s under every bundler.
  return L.divIcon({
    className: "",
    html:
      `<span style="display:block;width:18px;height:18px;border-radius:50% 50% 50% 0;` +
      `transform:rotate(-45deg);background:${colour};border:2px solid #fff;` +
      `box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -18],
  });
}

export default function LeafletMap({
  center,
  zoom,
  pins = [],
  picker = false,
  pickerPosition = null,
  onPick,
  className,
}: LeafletMapProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const pickerRef = useRef<L.Marker | null>(null);
  // Held in a ref so changing the handler never tears down the map.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  // Create once.
  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;

    const map = L.map(nodeRef.current, {
      center,
      zoom,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer(siteConfig.tileUrl, {
      attribution: siteConfig.tileAttribution,
      maxZoom: siteConfig.tileMaxZoom,
      crossOrigin: true,
    }).addTo(map);

    if (picker) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        onPickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
    } else {
      clusterRef.current = L.markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
      });
      map.addLayer(clusterRef.current);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      pickerRef.current = null;
    };
    // Deliberately mount-only: `center`/`zoom` are the INITIAL view. Re-running
    // this on every prop change would rebuild the map and fight the user's pan.
  }, [picker]);

  // Browse mode: rebuild the cluster layer whenever the pins change.
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;

    cluster.clearLayers();
    for (const p of pins) {
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(p.tier) });
      marker.bindPopup(
        `<a href="/cards/${encodeURIComponent(p.slug)}" style="display:block;width:140px;text-decoration:none;color:inherit">` +
          (p.thumb
            ? `<img src="${p.thumb}" alt="" style="width:140px;height:105px;object-fit:cover;border-radius:6px;display:block" />`
            : "") +
          `<strong style="display:block;margin-top:6px;font-size:12px;line-height:1.3">${escapeHtml(p.title)}</strong>` +
          `</a>`
      );
      cluster.addLayer(marker);
    }
  }, [pins]);

  // Picker mode: keep one draggable marker in sync with the parent's state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picker) return;

    if (!pickerPosition) {
      pickerRef.current?.remove();
      pickerRef.current = null;
      return;
    }

    if (pickerRef.current) {
      pickerRef.current.setLatLng(pickerPosition);
    } else {
      const marker = L.marker(pickerPosition, { draggable: true, icon: pinIcon(null) }).addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onPickRef.current?.(lat, lng);
      });
      pickerRef.current = marker;
      map.setView(pickerPosition, Math.max(map.getZoom(), 15));
    }
  }, [picker, pickerPosition]);

  return <div ref={nodeRef} className={className} />;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}
