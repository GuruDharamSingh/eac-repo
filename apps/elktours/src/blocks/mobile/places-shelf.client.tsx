"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArchFrame } from "@/components/mobile";
import { romanN } from "@/components/mobile/place-body";
import { placePhotosAction } from "@/lib/puck/mobile-overlay-actions";
import { placeDetailDescriptor } from "@/components/surfaces/place-detail-popup";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import type { MobilePlace } from "./types";

type Photo = { url: string; caption: string | null };

/** Discover's places shelf: a card opens a full-screen photo lightbox; "Open place detail" opens the public cms-ui surface. */
export function PlacesShelfView({ places, seeAll }: { places: MobilePlace[]; seeAll: ReactNode }) {
  const [open, setOpen] = useState<{ place: MobilePlace; photos: Photo[] } | null>(null);
  const surface = useSurfaceOptional();
  const pick = async (pl: MobilePlace) => {
    const photos = await placePhotosAction(pl.id, pl.img).catch(() => (pl.img ? [{ url: pl.img, caption: null }] : []));
    // No photos at all: straight to the place detail popup.
    if (photos.length === 0) {
      if (surface) surface.open(placeDetailDescriptor({ id: pl.id, name: pl.name }));
      else window.location.href = `/places?place=${pl.slug}`;
      return;
    }
    setOpen({ place: pl, photos });
  };
  return (
    <>
      <div className="blk-mps-shelf">
        {places.map((pl) => (
          <button key={pl.id} type="button" className="blk-mps-card" onClick={() => void pick(pl)}>
            <ArchFrame w={168} h={196} bottom={18} src={pl.img} />
            <span className="m-kicker blk-mps-kind">{pl.kind}</span>
            <span className="blk-mps-name">{pl.name}</span>
            {pl.area && <span className="blk-mps-area">{pl.area}</span>}
          </button>
        ))}
        {seeAll}
      </div>
      {open ? <PlaceLightbox place={open.place} photos={open.photos} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function PlaceLightbox({ place, photos, onClose }: { place: MobilePlace; photos: Photo[]; onClose: () => void }) {
  const surface = useSurfaceOptional();
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);
  if (!mounted) return null;
  const detail = () => {
    if (surface) surface.open(placeDetailDescriptor({ id: place.id, name: place.name }));
    else window.location.href = `/places?place=${place.slug}`;
    onClose();
  };
  return createPortal(
    <div className="m-lb" role="dialog" aria-modal="true" aria-label={place.name}>
      <button type="button" className="m-lb-scrim" aria-label="Close" onClick={onClose} />
      <button type="button" className="m-lb-close" aria-label="Close" onClick={onClose}>✕</button>
      <div
        className="m-lb-track"
        ref={track}
        style={photos.length < 2 ? { overflowX: "hidden" } : undefined}
        onScroll={(e) => {
          const t = e.currentTarget;
          setI(Math.round(t.scrollLeft / Math.max(1, t.clientWidth)));
        }}
      >
        {photos.length === 0 ? (
          <div className="m-lb-slide"><span className="m-lb-none">{place.name.slice(0, 1)}</span></div>
        ) : (
          photos.map((ph) => (
            <div key={ph.url} className="m-lb-slide">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.url} alt={ph.caption ?? ""} />
            </div>
          ))
        )}
      </div>
      <div className="m-lb-foot">
        {photos.length > 1 ? <span className="m-kicker m-lb-count">{romanN(Math.min(i + 1, photos.length))} / {romanN(photos.length)}</span> : null}
        {photos[Math.min(i, photos.length - 1)]?.caption ? <span className="m-kicker m-lb-caption">{photos[Math.min(i, photos.length - 1)]!.caption}</span> : null}
        <span className="m-kicker m-lb-kind">{place.kind}</span>
        <span className="m-lb-name">{place.name}</span>
        <button type="button" className="m-btn m-lb-open" onClick={detail}>Open place detail →</button>
      </div>
    </div>,
    document.body
  );
}
