"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "@elkdonis/cms-ui/surface";
import type { ConsoleState } from "@/lib/org-console";
import { CONSOLE_SURFACES } from "./console-keys";

/**
 * "Your pieces": what the removed "what needs you" row held, in one card.
 *
 * Five plain lines, each with its count, each opening the surface the row's band opened:
 * drafts (Unfinished), published (with the "lead the site" pin), answers (questionnaire
 * responses), people (roles) and what is coming up (dates and RSVPs). Editors only: every
 * one of those surfaces changes something. The whole card is not a target; the lines are.
 */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function PiecesFace({ state }: { state: ConsoleState }) {
  const surface = useSurface();
  const quiet = state.published.lastAt
    ? Math.floor((Date.now() - new Date(state.published.lastAt).getTime()) / 86_400_000)
    : null;

  const lines: Array<{ id: string; count: number; label: string; key: string; title: string; hot: boolean }> = [
    { id: "drafts", count: state.drafts.count, label: plural(state.drafts.count, "draft, not published", "drafts, not published"), key: CONSOLE_SURFACES.drafts, title: "Unfinished", hot: state.drafts.count > 0 },
    { id: "published", count: state.published.count, label: "published, and what leads the site", key: CONSOLE_SURFACES.published, title: "Published", hot: false },
    { id: "responses", count: state.responses.count, label: plural(state.responses.count, "unread answer", "unread answers"), key: CONSOLE_SURFACES.responses, title: "Waiting on you", hot: state.responses.count > 0 },
    { id: "people", count: state.people.total, label: state.people.waiting.length ? `${plural(state.people.total, "person", "people")}, ${state.people.waiting.length} with no role yet` : plural(state.people.total, "person", "people"), key: CONSOLE_SURFACES.people, title: "People", hot: state.people.waiting.length > 0 },
    { id: "schedule", count: state.upcoming.count, label: `${plural(state.upcoming.count, "date", "dates")} coming up, ${state.upcoming.rsvpTotal} ${plural(state.upcoming.rsvpTotal, "RSVP", "RSVPs")}`, key: CONSOLE_SURFACES.schedule, title: "Coming up", hot: false },
  ];

  return (
    <SurfaceCard
      kind="post"
      glyph="✎"
      kicker="Writing and people"
      layout="header"
      title="Your pieces"
      ariaLabel="Your pieces: drafts, published work, answers, people and dates"
      preview={
        <div className="orgp-pieces">
          {lines.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`orgp-piece eac-face-live${l.hot ? " is-hot" : ""}`}
              onClick={(e) =>
                surface.open({ type: "custom", key: l.key, title: l.title, size: "wide" }, e.currentTarget.closest<HTMLElement>(".eac-face"))
              }
            >
              <span className="orgp-piece-n">{l.count}</span>
              <span className="orgp-piece-l">{l.label}</span>
            </button>
          ))}
          {quiet !== null && quiet > 42 && (
            <p className="orgp-piece-note">Nothing new in {Math.floor(quiet / 7)} weeks.</p>
          )}
        </div>
      }
    />
  );
}
