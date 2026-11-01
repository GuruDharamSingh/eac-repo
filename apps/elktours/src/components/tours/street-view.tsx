"use client";

import { ExternalLink } from "lucide-react";
import { StreetViewPano } from "@/components/tours/street-view-pano";

export interface StreetViewPose {
  lat: number;
  lng: number;
  heading?: number | null;
  pitch?: number | null;
  fov?: number | null;
}

/** The Street View link that needs no key (Google Maps URLs API). */
export function streetViewUrl(p: StreetViewPose): string {
  const q = new URLSearchParams({
    api: "1",
    map_action: "pano",
    viewpoint: `${p.lat},${p.lng}`,
  });
  if (p.heading != null) q.set("heading", String(p.heading));
  if (p.pitch != null) q.set("pitch", String(p.pitch));
  if (p.fov != null) q.set("fov", String(p.fov));
  return `https://www.google.com/maps/@?${q.toString()}`;
}

/** A still of the panorama (Street View Static API) for cards and the route preview. */
export function streetViewStaticUrl(key: string, p: StreetViewPose, w = 640, h = 360): string {
  const q = new URLSearchParams({ key, size: `${w}x${h}`, location: `${p.lat},${p.lng}`, source: "outdoor", return_error_code: "true" });
  if (p.heading != null) q.set("heading", String(p.heading));
  if (p.pitch != null) q.set("pitch", String(p.pitch));
  if (p.fov != null) q.set("fov", String(Math.min(120, p.fov)));
  return `https://maps.googleapis.com/maps/api/streetview?${q.toString()}`;
}

/** The embedded panorama (Maps Embed API). Not used while the key lacks that API; kept for a host that has it. */
export function streetViewEmbedUrl(key: string, p: StreetViewPose): string {
  const q = new URLSearchParams({ key, location: `${p.lat},${p.lng}` });
  if (p.heading != null) q.set("heading", String(p.heading));
  if (p.pitch != null) q.set("pitch", String(p.pitch));
  if (p.fov != null) q.set("fov", String(p.fov));
  return `https://www.google.com/maps/embed/v1/streetview?${q.toString()}`;
}

interface StreetViewProps {
  pose: StreetViewPose | null;
  /** The stop's own photo, shown in the slot when there is no key. */
  imageUrl?: string | null;
  title: string;
  apiKey?: string | null;
  className?: string;
}

/**
 * One slot, two modes. With a Google Maps key the stop shows the live
 * panorama at its pose (StreetViewPano, Maps JavaScript API); without one it shows the stop's photo (or a quiet
 * placeholder) with a link that opens the same view in Google Maps. The
 * markup is the same either way, so turning the key on later changes
 * nothing else.
 */
export function StreetView({ pose, imageUrl, title, apiKey, className }: StreetViewProps) {
  if (pose && apiKey) {
    return <StreetViewPano pose={pose} apiKey={apiKey} className={className} />;
  }
  return (
    <div className={`relative ${className ?? ""}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-sm text-muted-foreground">
          {pose ? "Street View" : "No position yet"}
        </div>
      )}
      {pose && (
        <a
          href={streetViewUrl(pose)}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium shadow backdrop-blur hover:bg-background"
        >
          Look around in Street View
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}
