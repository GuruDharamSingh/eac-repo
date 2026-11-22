"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StreetView, type StreetViewPose } from "@/components/tours/street-view";

export interface StopMediaImage {
  url: string;
  caption: string | null;
  altText: string | null;
  attribution: string | null;
}

interface StopMediaProps {
  /** Changes when the slot follows another stop; the slot goes back to the stop's own media then. */
  stopId: string;
  title: string;
  /** The stop's pose; null when it has no position. */
  pose: StreetViewPose | null;
  /** The stop's own media (stop photo, then its visible images). Never the Street View still. */
  images: StopMediaImage[];
  /** False when Street View is switched off for the stop (tour_assets). */
  streetViewOn: boolean;
  /** The Street View still, shown in Street View mode when there is no key. */
  stillUrl?: string | null;
  apiKey: string | null;
  className?: string;
}

/**
 * One stop's picture slot on the desktop route (2026-11-19, Justin):
 *   - the stop has its own media → show it (prev/next when several), with a
 *     "Street View" button that swaps in the live panorama and "Photos" back;
 *   - no media → Street View directly, as before;
 *   - Street View off or no position → the media only, or a quiet placeholder.
 * The slot returns to the media view whenever it follows another stop.
 */
export function StopMedia({ stopId, title, pose, images, streetViewOn, stillUrl, apiKey, className }: StopMediaProps) {
  const [shownFor, setShownFor] = useState(stopId);
  const [street, setStreet] = useState(false);
  const [index, setIndex] = useState(0);
  if (shownFor !== stopId) {
    // Another stop: back to its media, first picture.
    setShownFor(stopId);
    setStreet(false);
    setIndex(0);
  }

  const canStreet = streetViewOn && pose != null;
  const hasMedia = images.length > 0;
  const showStreet = canStreet && (!hasMedia || street);
  const i = Math.min(index, Math.max(0, images.length - 1));
  const img = images[i];
  const step = (d: number) => setIndex((i + d + images.length) % images.length);

  return (
    <div className={`stop-media relative ${className ?? ""}`}>
      {showStreet ? (
        <StreetView pose={pose} imageUrl={stillUrl ?? null} title={title} apiKey={apiKey} className="h-full w-full" />
      ) : img ? (
        <figure className="stop-media__figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.altText ?? img.caption ?? title} className="stop-media__img" />
          {(img.caption || img.attribution || images.length > 1) && (
            <figcaption className="stop-media__caption">
              {images.length > 1 && <span className="stop-media__count">{i + 1} / {images.length}</span>}
              {img.caption && <span>{img.caption}</span>}
              {img.attribution && <span className="stop-media__credit">{img.attribution}</span>}
            </figcaption>
          )}
          {images.length > 1 && (
            <>
              <button type="button" className="stop-media__nav stop-media__nav--prev" onClick={() => step(-1)} aria-label="Previous picture">
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button type="button" className="stop-media__nav stop-media__nav--next" onClick={() => step(1)} aria-label="Next picture">
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </>
          )}
        </figure>
      ) : (
        <div className="stop-media__empty">{pose ? "" : "No position yet"}</div>
      )}
      {hasMedia && canStreet && (
        <button type="button" className="stop-media__toggle" onClick={() => setStreet((v) => !v)} aria-pressed={street}>
          {street ? (images.length > 1 ? "Photos" : "Photo") : "Street View"}
        </button>
      )}
    </div>
  );
}
