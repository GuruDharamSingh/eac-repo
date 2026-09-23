"use client";

import { useRef } from "react";

export type WizardCard = {
  id: string;
  title: string;
  blurb: string;
  href: string;
  status?: string;
  external?: boolean;
};

/** A sliding row of the guided flows that already work, with arrow buttons. */
export function WizardRail({ cards }: { cards: WizardCard[] }) {
  const rail = useRef<HTMLDivElement>(null);
  const nudge = (d: number) => rail.current?.scrollBy({ left: d * rail.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="ekh-rail-wrap">
      <button type="button" className="ekh-rail-arrow ekh-rail-arrow--l" onClick={() => nudge(-1)} aria-label="Scroll wizards left">‹</button>
      <div ref={rail} className="ekh-rail" role="list">
        {cards.map((c) => (
          <a
            key={c.id}
            role="listitem"
            href={c.href}
            className="ekh-wizard"
            {...(c.external ? { target: "_blank", rel: "noopener" } : {})}
          >
            <span className="ekh-kicker">{c.status ?? "Wizard"}</span>
            <strong className="ekh-wizard__title">{c.title}</strong>
            <span className="ekh-wizard__blurb">{c.blurb}</span>
            <span className="ekh-wizard__go">Open →</span>
          </a>
        ))}
      </div>
      <button type="button" className="ekh-rail-arrow ekh-rail-arrow--r" onClick={() => nudge(1)} aria-label="Scroll wizards right">›</button>
    </div>
  );
}
