"use client";

import * as React from "react";

// ============================================================================
// Across the collective — threads and pictures other orgs have shared, one
// at a time, beside the chat.
//
// It cycles slowly (every 8 s), pauses while hovered or focused, and does not
// move at all under prefers-reduced-motion; arrows step it by hand. A card
// links out only when the host could give it a working address.
// ============================================================================

export interface CrossPostItem {
  id: string;
  title: string;
  orgName: string;
  kind: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  href?: string | null;
}

export function CrossPostCycler({ items, title = "Across the collective" }: { items: CrossPostItem[]; title?: string }) {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const n = items.length;

  React.useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), 8000);
    return () => window.clearInterval(t);
  }, [n, paused]);

  if (n === 0) return null;
  const cur = items[i % n];
  const body = (
    <>
      {cur.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="eac-hs-cross-img" src={cur.coverImageUrl} alt="" loading="lazy" />
      ) : (
        <span className="eac-hs-cross-img is-empty" aria-hidden>
          {cur.orgName.slice(0, 1)}
        </span>
      )}
      <span className="eac-hs-cross-text">
        <span className="eac-hs-kicker">{cur.orgName}</span>
        <span className="eac-hs-cross-title">{cur.title}</span>
        {cur.excerpt && <span className="eac-hs-feed-excerpt">{cur.excerpt}</span>}
      </span>
    </>
  );

  return (
    <section
      className="eac-hs-cross"
      aria-label={title}
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="eac-hs-row-head">
        <h2 className="eac-hs-h">{title}</h2>
        {n > 1 && (
          <span className="eac-hs-cross-nav">
            <button type="button" aria-label="Previous" onClick={() => setI((x) => (x - 1 + n) % n)}>
              ‹
            </button>
            <span className="eac-hs-muted" aria-live="polite">
              {(i % n) + 1} / {n}
            </span>
            <button type="button" aria-label="Next" onClick={() => setI((x) => (x + 1) % n)}>
              ›
            </button>
          </span>
        )}
      </div>
      {cur.href ? (
        <a className="eac-hs-cross-card" href={cur.href} target="_blank" rel="noopener">
          {body}
        </a>
      ) : (
        <div className="eac-hs-cross-card">{body}</div>
      )}
    </section>
  );
}
