"use client";

import { useEffect, useState } from "react";
import { coverFrameStyle, type CoverFrame } from "@elkdonis/cms-ui/files";

export interface StageFact {
  icon: "calendar" | "clock" | "video" | "globe";
  text: string;
}

export interface StageSlide {
  /** "Weekly series", "Auction", … */
  kind: string;
  /** Small gold line above the title, e.g. "Current series". */
  eyebrow?: string | null;
  /** "Elkdonis Arts Collective presents" */
  presents?: string | null;
  title: string;
  /** Italic tail of the title, e.g. "Non‑Professionals". */
  titleEm?: string | null;
  byline?: string | null;
  lede?: string | null;
  facts: StageFact[];
  actions: Array<{ label: string; href: string; primary?: boolean; external?: boolean }>;
  imageUrl: string | null;
  /** How the picture sits in its box (a series week's cover framing, 2026-10-13). */
  imageFrame?: CoverFrame | null;
  tag?: string | null;
  caption?: { title: string; sub?: string | null } | null;
}

const ICONS = {
  calendar: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  clock: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  video: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>,
  globe: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /></svg>,
};

/**
 * The hero: one whole event at a time, with its own title, facts and
 * calls to action, rotating every 50 s (the brief asked for 45 to 60).
 * Arrows and dots jump; hovering pauses the clock.
 */
export function EventStage({ slides, intervalMs = 50_000, blankMark }: { slides: StageSlide[]; intervalMs?: number; /** Drawn when a slide has no picture. */ blankMark?: { src: string; alt: string } | null }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);

  const go = (next: number) => {
    setFading(true);
    window.setTimeout(() => {
      setIndex(((next % slides.length) + slides.length) % slides.length);
      setFading(false);
    }, 450);
  };

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const t = window.setInterval(() => go(index + 1), intervalMs);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length, intervalMs, paused, index]);

  const s = slides[index];
  if (!s) return null;

  // Every slide's text is rendered into one grid cell (.ifs-stage__slides,
  // site.css) and only the current one is visible, so the stage keeps the
  // height of its tallest text on every slide; the picture is cropped to the
  // box and never sets the height (2026-10-10: a portrait week cover had
  // made the stage about 760px tall at 1280px).
  return (
    <section
      className={`ifs-stage${fading ? " is-fading" : ""}`}
      aria-roledescription="carousel"
      aria-label="Events"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="ifs-stage__body">
        <div className="ifs-stage__slides">
          {slides.map((x, i) => {
            const Title = i === 0 ? "h1" : "h2";
            const on = i === index;
            return (
              <div key={x.title + i} className="ifs-stage__slide" data-active={on ? "" : undefined} aria-hidden={on ? undefined : true} inert={!on}>
                {x.eyebrow && <p className="ifs-eyebrow ifs-stage__eyebrow">{x.eyebrow}</p>}
                <Title className="ifs-stage__title">
                  {x.titleEm ? (
                    <>
                      {x.title} <em className="nb">{x.titleEm}</em>
                    </>
                  ) : (
                    x.title
                  )}
                </Title>
                {x.caption && (
                  <p className="ifs-stage__week">
                    {x.caption.title}
                    {x.caption.sub && <small>{x.caption.sub}</small>}
                  </p>
                )}
                {x.lede && <p className="ifs-stage__lede">{x.lede}</p>}
                {x.facts.length > 0 && (
                  <div className="ifs-facts">
                    {x.facts.map((f, k) => (
                      <span key={k}>{ICONS[f.icon]}{f.text}</span>
                    ))}
                  </div>
                )}
                <div className="ifs-stage__actions">
                  {x.actions.map((a) => (
                    <a key={a.href + a.label} className={`ifs-btn${a.primary ? " ifs-btn--primary" : ""}`} href={a.href} target={a.external ? "_blank" : undefined} rel={a.external ? "noopener" : undefined}>
                      {a.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {slides.length > 1 && (
          <div className="ifs-stage__nav">
            <button type="button" aria-label="Previous event" onClick={() => go(index - 1)}>
              <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" aria-label="Next event" onClick={() => go(index + 1)}>
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <span className="ifs-stage__dots">
              {slides.map((x, i) => (
                <button key={x.title + i} type="button" aria-label={`Show ${x.title}`} aria-current={i === index ? "true" : undefined} onClick={() => go(i)} />
              ))}
            </span>
            <span className="ifs-stage__count">{index + 1} / {slides.length}</span>
          </div>
        )}
      </div>
      <div className={`ifs-stage__media${s.imageUrl ? "" : " is-blank"}`}>
        {s.tag && <span className="ifs-stage__tag">{s.tag}</span>}
        {s.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ifs-stage__img" src={s.imageUrl} alt="" style={s.imageFrame ? coverFrameStyle(s.imageFrame) : undefined} />
        ) : (
          <div className="ifs-stage__blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {blankMark ? <img src={blankMark.src} alt={blankMark.alt} /> : null}
          </div>
        )}
        {s.caption && (
          <div className="ifs-stage__caption">
            <span className="t">{s.caption.title}</span>
            {s.caption.sub && <span className="s">{s.caption.sub}</span>}
          </div>
        )}
      </div>
    </section>
  );
}
