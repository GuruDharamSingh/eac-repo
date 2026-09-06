"use client";

import { useEffect } from "react";

export interface LightboxImage {
  url: string;
  alt?: string;
}

export interface SimpleLightboxProps {
  images: LightboxImage[];
  /** Index into `images`, or null when closed. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/**
 * Framework-free fullscreen image viewer — no Mantine, no other UI kit.
 * Sibling to `ImageLightbox` (which pulls in @mantine/core): use this one in
 * apps that don't otherwise depend on Mantine (e.g. IFAC, ArtDirect), so
 * adding "click an image to expand it" doesn't drag in a whole component
 * library for one modal.
 *
 * Supports prev/next between the images it was given (arrow keys, on-screen
 * buttons, swipe is left to the browser's own touch scrolling since this
 * doesn't intercept touch events) — ImageLightbox is single-image only.
 */
export function SimpleLightbox({ images, index, onClose, onIndexChange }: SimpleLightboxProps) {
  const open = index !== null && index >= 0 && index < images.length;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index !== null) onIndexChange((index + 1) % images.length);
      if (e.key === "ArrowLeft" && index !== null) onIndexChange((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open || index === null) return null;
  const image = images[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{ ...navBtnStyle, position: "absolute", top: 16, right: 16 }}
      >
        ✕
      </button>

      {images.length > 1 && (
        <button
          type="button"
          aria-label="Previous image"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + images.length) % images.length);
          }}
          style={{ ...navBtnStyle, position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}
        >
          ‹
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "92%", maxHeight: "92%", objectFit: "contain" }}
      />

      {images.length > 1 && (
        <button
          type="button"
          aria-label="Next image"
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % images.length);
          }}
          style={{ ...navBtnStyle, position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }}
        >
          ›
        </button>
      )}

      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 16, color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "none",
  color: "#fff",
  width: 40,
  height: 40,
  borderRadius: "50%",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
