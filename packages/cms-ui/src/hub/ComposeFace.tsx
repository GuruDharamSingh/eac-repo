"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "../surface";
import { faceOf } from "./face-origin";
import {
  buildComposeCatalogue,
  type ComposeContext,
  type ComposeOption,
} from "../compose";

// ============================================================================
// The compose tile, as a face.
//
// Before: one tile reading "Compose — writing, gatherings, questionnaires and
// polls", which opened a picker of those four. Two clicks and a decision
// screen to reach the two things anyone actually makes.
//
// So the common kinds are ON the face. A post and a meeting are one click from
// the hub; everything else is still behind "Everything else…", which opens the
// catalogue exactly as the tile used to. The shortcuts are derived from the
// same `buildComposeCatalogue` the picker uses, so a site without meetings
// gets no meeting shortcut rather than a button that opens a form it cannot
// save.
//
// Which kinds get a shortcut is deliberately a short list and not a setting:
// a face that shows every option IS the picker, and then there are two pickers.
// ============================================================================

/** The kinds worth a direct button, best first. */
const SHORTCUTS = ["article", "meeting", "event"] as const;

export function ComposeFace({
  context,
  /** How many shortcuts to draw. Two fits a tile comfortably. */
  limit = 2,
}: {
  /**
   * Defaults to the provider's `connectors.compose` — the same object the
   * picker reads — so a host describes what it can make ONCE, in its
   * connectors, rather than again on every page that shows this tile.
   */
  context?: ComposeContext;
  limit?: number;
}) {
  const surfaces = useSurface();
  const ctx = context ?? surfaces.connectors.compose;

  const options = React.useMemo(
    () => (ctx ? buildComposeCatalogue(ctx) : []),
    [ctx]
  );
  const quick = React.useMemo(
    () =>
      SHORTCUTS.map((id) => options.find((o) => o.id === id))
        .filter((o): o is ComposeOption => Boolean(o))
        .slice(0, limit),
    [options, limit]
  );

  const start = (option: ComposeOption, origin: HTMLElement | null = null) => {
    // A route-mode kind (the workshop wizard) is a page, not a popup; the
    // catalogue already says so, so honour it rather than opening an empty
    // dialog over it.
    if (option.mode === "route" && option.href) {
      window.location.assign(option.href.replace(":orgSlug", ctx?.orgSlug ?? ""));
      return;
    }
    if (option.surface === "writing") {
      surfaces.open({ type: "write", kind: "post" }, origin);
      return;
    }
    surfaces.open({ type: "compose", kind: option.writes.kind }, origin);
  };

  return (
    <SurfaceCard
      kind="compose"
      title="Compose"
      blurb={
        quick.length
          ? "Start something — or pick from everything this site can make."
          : "Writing, gatherings, questionnaires and polls."
      }
      ariaLabel="Open the compose picker"
      onClick={(origin) => surfaces.open({ type: "compose" }, origin)}
      preview={
        quick.length ? (
          <div className="eac-face-live eac-compose-quick">
            {quick.map((option) => (
              <button
                key={option.id}
                type="button"
                className="eac-preview-action"
                onClick={(e) => start(option, faceOf(e.currentTarget))}
              >
                <span aria-hidden>{option.icon}</span> {option.title}
              </button>
            ))}
            <button
              type="button"
              className="eac-preview-action eac-preview-action--quiet"
              onClick={(e) => surfaces.open({ type: "compose" }, faceOf(e.currentTarget))}
            >
              Everything else…
            </button>
          </div>
        ) : undefined
      }
    />
  );
}
