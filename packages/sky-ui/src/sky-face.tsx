"use client";

import { SurfaceCard, useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import type { ChartResult } from "@elkdonis/astro";
import { SIGN_BY_KEY } from "@elkdonis/astro";
import { SkyPanel } from "./sky-panel";
import { useSky } from "./use-sky";

const SKY_SURFACE = {
  type: "custom",
  key: "sky",
  title: "The sky",
  kind: "calendar",
  // No window: the wheel is its own shape. See sky.css / SurfaceSize.
  size: "bare",
} as const;

/**
 * The sky as a face: a tile listing where the planets are right now, which
 * opens the wheel in the shared surface (@elkdonis/cms-ui/surface).
 *
 * The face keeps its own sky state, so the list on the tile is live — it
 * follows the place the viewer chose and stays current — and the surface it
 * opens starts from its own fresh chart.
 *
 * `labelled` adds the card's title and blurb under the list. Off by default:
 * the list already says what the tile is, and in a grid of tiles the extra
 * two lines make the whole row taller for nothing.
 */
export function SkyFace({
  initialIso,
  initialChart,
  initialIsNow,
  title = "Planets now",
  labelled = false,
}: {
  initialIso: string;
  initialChart: ChartResult;
  initialIsNow: boolean;
  title?: string;
  labelled?: boolean;
}) {
  const sky = useSky(initialIso, initialChart, initialIsNow);
  const surfaces = useSurfaceOptional();
  const sun = sky.chart.bodies[0];
  const moon = sky.chart.bodies[1];

  if (labelled) {
    return (
      <SurfaceCard
        title={title}
        kicker="Sky"
        kind="calendar"
        glyph="☉"
        blurb={`Sun in ${SIGN_BY_KEY[sun.sign].name}, Moon in ${SIGN_BY_KEY[moon.sign].name}`}
        surface={SKY_SURFACE}
        preview={<SkyPanel size="face" sky={sky} />}
        ariaLabel="Open the sky"
      />
    );
  }

  // The unlabelled face: the same frame, but the list is the whole content.
  // SurfaceCard always draws a title, so this carries the face's own markup —
  // the classes are surface.css's, so it stays in step with every other tile.
  return (
    <article className="eac-face" data-kind="calendar">
      <button
        type="button"
        className="eac-face-hit"
        aria-label="Open the sky"
        aria-haspopup="dialog"
        onClick={() => surfaces?.open(SKY_SURFACE)}
      />
      <span className="eac-face-glyph" aria-hidden>
        ☉
      </span>
      <span className="eac-face-cue" aria-hidden>
        +
      </span>
      <div className="eac-face-preview">
        <SkyPanel size="face" sky={sky} />
      </div>
    </article>
  );
}
