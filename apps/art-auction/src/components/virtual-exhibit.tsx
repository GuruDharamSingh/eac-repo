"use client";

import * as React from "react";
import Link from "next/link";
import { HallwayExperience, type HallwayPiece, type Placement } from "@elkdonis/three/hallway";
import { Button } from "@/components/ui/button";
import { ART_FRAME_STYLES } from "@/lib/frame-styles";
import { venueFor } from "@/lib/venues";

/**
 * The spaces a single work can be shown in, main one first. Ids are venue
 * ids, so a new space added to `lib/venues.ts` only needs listing here.
 */
const SPACES = [
  { id: "loft", name: "The loft" },
  { id: "morning-room", name: "The morning room" },
  { id: "northwest", name: "The hallway" },
] as const;

function sized(url: string, w: number): string {
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}

export interface VirtualExhibitProps {
  artworkId: string;
  title: string;
  imageUrl: string;
  artistName?: string | null;
  heightCm?: number | null;
  widthCm?: number | null;
}

/**
 * "View in a virtual space": the piece hung on its own, at true size where it
 * was measured, in one of the 3D spaces — the loft by default. Opens over the
 * page rather than navigating, so closing it lands the visitor back on the
 * listing where they were.
 */
export function VirtualExhibit(props: VirtualExhibitProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full">
        View in a virtual space
      </Button>
      {open && <ExhibitOverlay {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExhibitOverlay({
  artworkId,
  title,
  imageUrl,
  artistName,
  heightCm,
  widthCm,
  onClose,
}: VirtualExhibitProps & { onClose: () => void }) {
  const [spaceId, setSpaceId] = React.useState<string>(SPACES[0].id);
  const venue = React.useMemo(() => venueFor(spaceId), [spaceId]);

  const pieces = React.useMemo<HallwayPiece[]>(
    () => [{ id: artworkId, title, imageUrl: sized(imageUrl, 1600), artistName, heightCm, widthCm }],
    [artworkId, title, imageUrl, artistName, heightCm, widthCm]
  );
  const placements = React.useMemo<Placement[]>(
    () => [{ pieceId: artworkId, ...venue.feature, frameId: null }],
    [artworkId, venue]
  );

  // Escape closes the view; the page underneath should not scroll behind it.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} in a virtual space`}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b0d12]"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg">{title}</p>
          {artistName && <p className="truncate text-xs text-white/60">{artistName}</p>}
        </div>
        <div className="flex gap-1 rounded-full bg-white/10 p-1" role="group" aria-label="Space">
          {SPACES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === spaceId}
              onClick={() => setSpaceId(s.id)}
              className={`h-8 rounded-full px-3 text-sm font-medium ${
                s.id === spaceId ? "bg-white text-black" : "text-white/80 hover:text-white"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
        <Link
          href={`/gallery?piece=${artworkId}`}
          className="h-9 rounded-full border border-white/25 px-4 text-sm leading-9 text-white hover:bg-white/10"
        >
          In the gallery
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-full border border-white/25 px-4 text-sm text-white hover:bg-white/10"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <HallwayExperience
          key={venue.id}
          venue={venue}
          pieces={pieces}
          placements={placements}
          frames={ART_FRAME_STYLES}
          initialView="wall"
          focusPieceId={artworkId}
          height="100%"
          className="h-full"
          fallback={
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-white/80">
              The virtual space needs 3D graphics, which your browser has turned off.
            </div>
          }
        />
      </div>
    </div>
  );
}
