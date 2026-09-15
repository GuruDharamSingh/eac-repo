"use client";

import * as React from "react";
import { SurfaceCard, useSurface, type SurfaceImage } from "../surface";
import { faceOf } from "./face-origin";

// ============================================================================
// The gallery tile, as a face.
//
// The gallery surface already existed; what the tile showed was the word
// "Gallery" and a sentence about it. A library of images whose face is prose
// is the one case where the system's premise — face and surface are the same
// object at two sizes — was not being kept.
//
// So the face draws the library: one image at a time, with ‹ › to skip
// through them without opening anything. The arrows live inside
// `.eac-face-live`, which is the only region of a face that takes the
// pointer, so skipping does not trigger the face's own hit target; clicking
// the IMAGE opens the gallery at that image, and clicking anywhere else opens
// it at the top.
//
// The images the face was drawing travel into the surface through the
// descriptor, so opening mid-skim continues from the same picture instead of
// resetting to a spinner.
// ============================================================================

export function GalleryFace({
  images,
  title = "Gallery",
  /** Advance on its own every N ms. Off by default; 0 or omitted disables. */
  autoAdvanceMs,
}: {
  images: SurfaceImage[];
  title?: string;
  autoAdvanceMs?: number;
}) {
  const surfaces = useSurface();
  const [index, setIndex] = React.useState(0);
  const count = images.length;

  // A tile that moves under the pointer while someone is reaching for it is
  // hostile, so any interaction stops the carousel for good.
  const [drifting, setDrifting] = React.useState(Boolean(autoAdvanceMs));

  React.useEffect(() => {
    if (!drifting || !autoAdvanceMs || count < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      autoAdvanceMs
    );
    return () => window.clearInterval(id);
  }, [drifting, autoAdvanceMs, count]);

  const step = (delta: number) => {
    setDrifting(false);
    setIndex((i) => (i + delta + count) % count);
  };

  const open = (startAt?: number, origin: HTMLElement | null = null) =>
    surfaces.open({ type: "gallery", title, images, startAt }, origin);

  const current = images[Math.min(index, Math.max(count - 1, 0))];

  return (
    <SurfaceCard
      kind="gallery"
      title={title}
      blurb={
        count
          ? `${count} ${count === 1 ? "image" : "images"} in the group's storage.`
          : "Nothing in the group's storage yet."
      }
      ariaLabel="Open the gallery"
      onClick={(origin) => open(undefined, origin)}
      preview={
        count === 0 ? (
          <span className="eac-preview-empty">No images yet</span>
        ) : (
          <div
            className="eac-face-live eac-gal-face"
            onMouseEnter={() => setDrifting(false)}
          >
            <button
              type="button"
              className="eac-gal-face-shot"
              onClick={(e) => open(index, faceOf(e.currentTarget))}
              aria-label={`Open ${current.name} in the gallery`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt={current.name} loading="lazy" />
            </button>

            {count > 1 && (
              <div className="eac-gal-face-skip">
                <button
                  type="button"
                  className="eac-preview-action"
                  onClick={() => step(-1)}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <span className="eac-gal-face-count" aria-live="polite">
                  {index + 1} / {count}
                </span>
                <button
                  type="button"
                  className="eac-preview-action"
                  onClick={() => step(1)}
                  aria-label="Next image"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )
      }
    />
  );
}
