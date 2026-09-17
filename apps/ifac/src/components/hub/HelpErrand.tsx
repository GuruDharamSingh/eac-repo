"use client";

import { useSurface } from "@elkdonis/cms-ui/surface";

/**
 * "How things work" — as a line in the errands strip, not a tile.
 *
 * It used to be a full-width face in the hub grid, the same size as the
 * gathering and carrying one sentence. Help is something you go looking for
 * once; it should not hold a quarter of the page while you are not looking
 * for it.
 *
 * A client component only because opening the surface needs the provider,
 * which a link cannot reach. Everything else in the strip is a plain <a>, and
 * this deliberately renders as the same thing — a <button> styled as the
 * siblings — so the row reads as one list rather than a list with a control
 * in it.
 */
export function HelpErrand() {
  const surfaces = useSurface();

  return (
    <button
      type="button"
      className="hub-errand"
      onClick={(e) =>
        surfaces.open(
          {
            type: "custom",
            key: "help",
            title: "Help & notes from the developer",
            kind: "neutral",
          },
          e.currentTarget
        )
      }
    >
      <span className="hub-errand-glyph" aria-hidden>
        ?
      </span>
      <span>
        <strong>How things work</strong>
        <em>And how to tell us they don&rsquo;t</em>
      </span>
    </button>
  );
}
