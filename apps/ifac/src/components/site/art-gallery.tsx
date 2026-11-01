"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryArt {
  /** Image URL, already sized (`?w=` on /api/media paths; see page.tsx). */
  src: string;
  title: string;
  artist: string;
  /** `/artists/<slug>` or `/dealers/<slug>`. */
  href: string;
}

/**
 * The landing's art strip (2026-10-11): pictures from the artist and dealer
 * pages, shuffled per request on the server, sliding one card at a time.
 *
 * The strip is a native horizontal scroller with scroll-snap, so touch swipe,
 * trackpads and keyboard focus (a focused link scrolls into view) work
 * without handlers. The clock only scrolls it: one card every `intervalMs`,
 * back to the start after the last. It stops while the pointer is over the
 * section or focus is inside it, after the pause button, when the tab is
 * hidden, and entirely under prefers-reduced-motion (buttons and swipe only).
 * Renders nothing without artworks.
 */
export function ArtGallery({ items, intervalMs = 4500 }: { items: GalleryArt[]; intervalMs?: number }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [reduced, setReduced] = useState(false);
  // Bumped on every manual move so the clock restarts from that moment.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const track = trackRef.current;
      if (!track) return;
      const cards = Array.from(track.children) as HTMLElement[];
      if (cards.length === 0) return;
      const left = track.scrollLeft;
      const max = track.scrollWidth - track.clientWidth;
      const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
      // Card positions in scroll coordinates: the track's inline padding (room
      // for the focus ring, site.css) is the first card's offset.
      const pad = cards[0]!.offsetLeft;
      const stops = cards.map((c) => c.offsetLeft - pad);
      let target: number;
      if (dir === 1) {
        // At the end: back to the first card.
        if (left >= max - 4) target = 0;
        else target = stops.find((x) => x > left + 4) ?? max;
      } else {
        // At the start: to the end.
        if (left <= 4) target = max;
        else target = [...stops].reverse().find((x) => x < left - 4) ?? 0;
      }
      track.scrollTo({ left: Math.min(target, max), behavior });
    },
    [reduced],
  );

  const paused = hovered || focused || stopped || reduced;

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      step(1);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [paused, items.length, intervalMs, step, tick]);

  if (items.length === 0) return null;

  const manual = (dir: 1 | -1) => {
    step(dir);
    setTick((n) => n + 1);
  };

  return (
    <section
      className="ifs-art"
      aria-label="Art from IFAC artists"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className="ifs-art__head">
        <p className="ifs-eyebrow">From IFAC artists and dealers</p>
        {items.length > 1 && (
          <div className="ifs-art__controls">
            {!reduced && (
              <button
                type="button"
                className="ifs-art__btn"
                aria-label={stopped ? "Play the slideshow" : "Pause the slideshow"}
                aria-pressed={stopped}
                onClick={() => setStopped((v) => !v)}
              >
                {stopped ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14" /></svg>
                )}
              </button>
            )}
            <button type="button" className="ifs-art__btn" aria-label="Previous artwork" onClick={() => manual(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" className="ifs-art__btn" aria-label="Next artwork" onClick={() => manual(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </div>
      <ul className="ifs-art__track" ref={trackRef} onTouchStart={() => setTick((n) => n + 1)}>
        {items.map((a, i) => (
          <li key={a.src + i} className="ifs-art__card">
            <a href={a.href} className="ifs-art__link">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ifs-art__img" src={a.src} alt="" loading="lazy" decoding="async" draggable={false} />
              <span className="ifs-art__cap">
                {a.title && <span className="ifs-art__title">{a.title}</span>}
                <span className="ifs-art__by">{a.artist}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
