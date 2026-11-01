"use client";

import * as React from "react";
import { useSurfaceOptional, type SurfaceJourneyId } from "../surface";
import type { CenterJourney } from "./types";

// ============================================================================
// The journeys row: the top-right section of /center (take three, 2026-10-18).
//
// A heading, then one card per journey: what it is, where you stand, a door.
// Clicking a card opens that journey's dialog (`journey:<id>`): the developer
// preferred the centered popup to the inline tabs, for larger type and one
// errand at a time. The row scrolls sideways when there are more cards than
// fit. Without a surface provider the cards link to `?surface=`.
// ============================================================================

export type JourneyTabId = SurfaceJourneyId;

/** Kept for hosts that import the type; the row no longer takes an org (its management is the org section). */
export interface JourneyOrgFacts {
  orgId: string;
  orgName: string;
  hasHeadline: boolean;
  hasImage: boolean;
  hasPlace: boolean;
}

export interface JourneyRowProps {
  journey: CenterJourney | null;
  /** Opens this journey's dialog on load (`?journey=`). */
  initialTab?: JourneyTabId | null;
}

// One card per central site (developer, 2026-10-18): the market, the artist
// directory, the collective itself. Managing an organisation is not a journey;
// it is the org section of this page.
interface Card {
  id: "auction" | "profile" | "site";
  title: string;
  /** The site this journey belongs to. */
  site: string;
  /** What is in it, in a line. */
  hint: string;
  /** Steps done, only where this page knows (the auction's state is loaded; the others are not). */
  steps: boolean[] | null;
  tone: "orange" | "teal" | "blue";
}

export function JourneyRow({ journey, initialTab }: JourneyRowProps) {
  const surfaces = useSurfaceOptional();
  const opened = React.useRef(false);
  const row = React.useRef<HTMLDivElement>(null);
  const step = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[role=listitem]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 280) + 18), behavior: "smooth" });
  };

  const cards: Card[] = [
    {
      id: "auction",
      tone: "orange",
      title: "Sell your art on the market",
      site: "market.arts-collective.com",
      hint: "Publish work · open your store · get paid",
      steps: [Boolean(journey && journey.artworks.published > 0), journey?.store.state === "active", journey?.payouts.state === "ready"],
    },
    {
      id: "profile",
      tone: "teal",
      title: "Your listing in the artist directory",
      site: "directory.arts-collective.com",
      hint: "Your profile · services · art on your page · get paid",
      steps: null,
    },
    {
      id: "site",
      tone: "blue",
      title: "Create a collective",
      site: "arts-collective.com",
      hint: "Name it · choose its address · invite people",
      steps: null,
    },
  ];

  const open = React.useCallback(
    (c: Card, el?: HTMLElement) => {
      surfaces?.open({ type: "journey", id: c.id }, el);
    },
    [surfaces]
  );

  React.useEffect(() => {
    if (opened.current || !initialTab || !surfaces) return;
    const c = cards.find((x) => x.id === initialTab);
    if (c) {
      opened.current = true;
      open(c);
    }
  }, [initialTab, surfaces, open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="eac-jr" aria-label="Journeys">
      <header className="eac-jr-head">
        <h2 className="eac-jr-title">
          <span className="eac-jr-word">Journeys</span>
          <span className="eac-jr-line">Create with the Arts Collective</span>
        </h2>
        <div className="eac-jr-arrows">
          <button type="button" aria-label="Previous journey" onClick={() => step(-1)}>
            ←
          </button>
          <button type="button" aria-label="Next journey" onClick={() => step(1)}>
            →
          </button>
        </div>
      </header>
      <div className="eac-jr-row" role="list" ref={row}>
        {cards.map((c) => {
          const done = c.steps?.filter(Boolean).length ?? 0;
          const inner = (
            <>
              <span className="eac-jr-card-title">{c.title}</span>
              <span className="eac-jr-site">{c.site}</span>
              <span className="eac-jr-hint">{c.hint}</span>
              <span className="eac-jr-foot">
                {c.steps && (
                  <span className="eac-jr-bar" aria-label={`${done} of ${c.steps.length} steps done`}>
                    {c.steps.map((d, i) => (
                      <span key={i} data-done={d || undefined} />
                    ))}
                  </span>
                )}
                <span className="eac-jr-go" aria-hidden>
                  →
                </span>
              </span>
            </>
          );
          return (
            <div role="listitem" key={c.id}>
              {surfaces ? (
                <button type="button" className="eac-jr-card" data-tone={c.tone} aria-haspopup="dialog" onClick={(e) => open(c, e.currentTarget)}>
                  {inner}
                </button>
              ) : (
                <a className="eac-jr-card" data-tone={c.tone} href={`?surface=journey:${c.id}`}>
                  {inner}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The bar above the journeys (2026-10-31): the person's own doors. "View
 * profile" opens the `me` surface (the listing journey's tabs plus
 * Connections, no rail); "Studio" goes to the network Studio.
 */
export function MeBar({ studioHref }: { studioHref?: string | null }) {
  const surfaces = useSurfaceOptional();
  return (
    <nav className="eac-center-me" aria-label="You">
      {surfaces ? (
        <button type="button" className="eac-center-btn eac-center-btn--primary" aria-haspopup="dialog" onClick={(e) => surfaces.open({ type: "me" }, e.currentTarget)}>
          View profile
        </button>
      ) : (
        <a className="eac-center-btn eac-center-btn--primary" href="?surface=me">
          View profile
        </a>
      )}
      {studioHref && (
        <a className="eac-center-btn" href={studioHref}>
          Studio
        </a>
      )}
    </nav>
  );
}
