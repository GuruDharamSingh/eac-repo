"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

// ============================================================================
// The group's pictures as a hero carousel — the part that makes the hub read
// like a website. One large image at a time, arrows and dots, a caption on
// its own band (never text over the photo). No autoplay: a moving page is
// hard to read and harder to stop. Clicking opens the gallery surface there.
// ============================================================================

export interface GalleryHeroImage {
  url: string;
  name?: string | null;
}

export function GalleryHero({ images, title = "Gallery" }: { images: GalleryHeroImage[]; title?: string }) {
  const surfaces = useSurfaceOptional();
  const [i, setI] = React.useState(0);
  if (images.length === 0) return null;
  const n = images.length;
  const cur = images[i % n];
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section className="eac-hs-hero" aria-roledescription="carousel" aria-label={title}>
      <div className="eac-hs-row-head">
        <h2 className="eac-hs-h">{title}</h2>
        <span className="eac-hs-muted">
          {i + 1} of {n}
        </span>
      </div>
      <div
        className="eac-hs-hero-stage"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
      >
        <button
          type="button"
          className="eac-hs-hero-img"
          aria-label={`Open ${cur.name ?? "this image"} in the gallery`}
          onClick={(e) =>
            surfaces?.open(
              { type: "gallery", title, images: images.map((m) => ({ url: m.url, name: m.name ?? "" })), startAt: i % n },
              e.currentTarget
            )
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.url} alt={cur.name ?? ""} />
        </button>
        {n > 1 && (
          <>
            <button type="button" className="eac-hs-hero-arrow is-prev" aria-label="Previous image" onClick={() => go(-1)}>
              ‹
            </button>
            <button type="button" className="eac-hs-hero-arrow is-next" aria-label="Next image" onClick={() => go(1)}>
              ›
            </button>
          </>
        )}
      </div>
      {/* A caption only when it is words — a bare filename says nothing. */}
      {cur.name && !/^[\w\s().-]+\.[a-z0-9]{2,5}$/i.test(cur.name) && <p className="eac-hs-hero-cap">{cur.name}</p>}
      {n > 1 && (
        <div className="eac-hs-hero-dots" role="group" aria-label="Choose an image">
          {images.slice(0, 20).map((m, k) => (
            <button
              key={m.url}
              type="button"
              aria-label={`Image ${k + 1}`}
              aria-current={k === i % n ? "true" : undefined}
              onClick={() => setI(k)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
