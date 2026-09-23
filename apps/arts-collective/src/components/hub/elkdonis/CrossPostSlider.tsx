"use client";

import { useEffect, useState, type ReactNode } from "react";

export type PromoSlide = {
  id: string;
  title: string;
  orgName: string;
  kind: string;
  excerpt: string | null;
  href: string;
};

/**
 * The promotion column: slides through recent public work from member sites,
 * and slides aside to reveal a "suggest a cross-post" composer. Suggestions
 * land in the Elkdonis "Cross-post suggestions" category, where stewards pick
 * what this column carries next.
 */
export function CrossPostSlider({ slides, suggest }: { slides: PromoSlide[]; suggest: ReactNode }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (paused || composing || slides.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, composing, slides.length]);

  return (
    <div
      className="ekh-promo"
      data-composing={composing || undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="ekh-promo__track">
        <section className="ekh-promo__pane" aria-hidden={composing} inert={composing}>
          {slides.length === 0 ? (
            <p className="ekh-empty">Nothing to carry yet. Suggest something below.</p>
          ) : (
            <div className="ekh-promo__slides" aria-live="polite">
              {slides.map((s, n) => (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener"
                  className="ekh-promo__slide"
                  data-active={n === i || undefined}
                  aria-hidden={n !== i}
                  tabIndex={n === i ? 0 : -1}
                >
                  <span className="ekh-kicker">{s.orgName} · {s.kind}</span>
                  <strong className="ekh-promo__headline">{s.title}</strong>
                  {s.excerpt && <span className="ekh-promo__excerpt">{s.excerpt}</span>}
                  <span className="ekh-promo__more">Read on the forum →</span>
                </a>
              ))}
            </div>
          )}
          {slides.length > 1 && (
            <div className="ekh-dots" role="tablist" aria-label="Choose a slide">
              {slides.map((s, n) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={n === i}
                  aria-label={`Slide ${n + 1}: ${s.title}`}
                  className="ekh-dot"
                  onClick={() => setI(n)}
                />
              ))}
            </div>
          )}
          <button type="button" className="ekh-btn ekh-btn--gold ekh-promo__cta" onClick={() => setComposing(true)}>
            Suggest a cross-post
          </button>
        </section>
        <section className="ekh-promo__pane" aria-hidden={!composing} inert={!composing}>
          <div className="ekh-promo__compose-head">
            <span className="ekh-kicker">Suggest a cross-post</span>
            <button type="button" className="ekh-link-btn" onClick={() => setComposing(false)}>← Back</button>
          </div>
          <p className="ekh-small">A post, event or piece of work from any member site that the whole network should see.</p>
          {suggest}
        </section>
      </div>
    </div>
  );
}
