"use client";

import { useEffect, useRef, useState } from "react";

export interface LightboxImage {
  url: string;
  /** Doubles as the caption when present — ProfileGallery passes the title here. */
  alt?: string;
}

export interface SimpleLightboxProps {
  images: LightboxImage[];
  /** null closes it. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}

/**
 * Full-screen image viewer for the gallery.
 *
 * Mantine-free — the sibling `ImageLightbox` in @elkdonis/ui pulls in
 * @mantine/core, which is precisely what the sites are moving away from.
 *
 * Styling lives in gallery.css rather than inline so the presentation is
 * themeable and can respond to prefers-reduced-motion, which inline styles
 * cannot express.
 *
 * Behaviour worth knowing:
 *   - Arrow keys and the on-screen buttons wrap around; Escape closes.
 *   - Clicking the backdrop closes, clicking the image does not.
 *   - Focus moves to the close button on open and is restored to whatever was
 *     focused before, so keyboard users are not dumped back at the top of the
 *     page.
 *   - Each image gets its own loading state, so switching between large photos
 *     shows a spinner rather than the previous image lingering.
 */
export function SimpleLightbox({ images, index, onClose, onIndexChange }: SimpleLightboxProps) {
  const open = index !== null && index >= 0 && index < images.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);
  const [loaded, setLoaded] = useState(false);

  // New image => new loading state, otherwise the spinner never returns when
  // paging between photos.
  useEffect(() => {
    setLoaded(false);
  }, [index]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement;
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (index === null) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange((index + 1) % images.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange((index - 1 + images.length) % images.length);
      }
    }

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      const restore = restoreFocusRef.current;
      if (restore instanceof HTMLElement) restore.focus();
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open || index === null) return null;
  const image = images[index];
  const many = images.length > 1;

  return (
    <div
      className="eac-lb"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Image viewer"}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className="eac-lb-btn eac-lb-close"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>

      {many && (
        <button
          type="button"
          className="eac-lb-btn eac-lb-prev"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + images.length) % images.length);
          }}
        >
          ‹
        </button>
      )}

      <figure className="eac-lb-figure" onClick={(e) => e.stopPropagation()}>
        {!loaded && <span className="eac-lb-spinner" aria-hidden />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          // Keyed so React swaps the element rather than reusing it, which
          // would otherwise keep the old image visible until the new one
          // decodes and make `loaded` lie.
          key={image.url}
          className={`eac-lb-img${loaded ? " is-loaded" : ""}`}
          src={image.url}
          alt={image.alt ?? ""}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          draggable={false}
        />
        {image.alt && <figcaption className="eac-lb-caption">{image.alt}</figcaption>}
      </figure>

      {many && (
        <button
          type="button"
          className="eac-lb-btn eac-lb-next"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % images.length);
          }}
        >
          ›
        </button>
      )}

      {many && (
        <div className="eac-lb-count" aria-live="polite">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
