"use client";

import * as React from "react";
import { useSurface } from "../surface";

// ============================================================================
// The whiteboard (right of the files), and under the row the three small
// doors: suggest an idea, the forum, a document to write together.
// Each opens the surface the host already registers; a door whose surface
// the host lacks is not drawn.
// ============================================================================

export function WhiteboardPanel({ blurb = "Sketch a plan, a diagram, an idea — together." }: { blurb?: string }) {
  const { connectors, open } = useSurface();
  if (!connectors.custom?.whiteboard) return null;
  return (
    <section className="eac-hs-board" aria-label="Whiteboard">
      <h2 className="eac-hs-h">Whiteboard</h2>
      <button
        type="button"
        className="eac-hs-board-canvas"
        aria-haspopup="dialog"
        onClick={(e) =>
          open({ type: "custom", key: "whiteboard", title: "Whiteboard", kind: "neutral", size: "full" }, e.currentTarget)
        }
      >
        <span className="eac-hs-board-doodle" aria-hidden>
          <svg viewBox="0 0 200 110" width="100%" height="100%">
            <path d="M20 80 C 50 20, 90 20, 110 60 S 170 100, 185 40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="30" y="18" width="46" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="150" cy="30" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </span>
        <span className="eac-hs-board-cta">Open the whiteboard</span>
        <span className="eac-hs-muted">{blurb}</span>
      </button>
    </section>
  );
}

export function HubDoors({ forumHref }: { forumHref?: string | null }) {
  const { connectors, open } = useSurface();
  const doors: Array<{ label: string; note: string; onClick?: (el: HTMLElement) => void; href?: string }> = [];
  if (connectors.postTo) {
    doors.push({
      label: "Suggest an idea",
      note: "Put it to the group",
      onClick: (el) => open({ type: "postTo" }, el),
    });
  }
  if (connectors.forum) {
    doors.push({ label: "Forum", note: "What is being discussed", onClick: (el) => open({ type: "forum" }, el) });
  } else if (forumHref) {
    doors.push({ label: "Forum", note: "What is being discussed", href: forumHref });
  }
  if (connectors.documents) {
    doors.push({
      label: "Write together",
      note: "A shared document",
      onClick: (el) => open({ type: "documents" }, el),
    });
  }
  if (doors.length === 0) return null;
  return (
    <nav className="eac-hs-doors" aria-label="More">
      {doors.map((d) =>
        d.href ? (
          <a key={d.label} className="eac-hs-door" href={d.href}>
            <span className="eac-hs-door-label">{d.label}</span>
            <span className="eac-hs-muted">{d.note}</span>
          </a>
        ) : (
          <button key={d.label} type="button" className="eac-hs-door" aria-haspopup="dialog" onClick={(e) => d.onClick?.(e.currentTarget)}>
            <span className="eac-hs-door-label">{d.label}</span>
            <span className="eac-hs-muted">{d.note}</span>
          </button>
        )
      )}
    </nav>
  );
}
