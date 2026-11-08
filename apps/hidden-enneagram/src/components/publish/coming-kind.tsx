"use client";

import type { StudioExtension } from "@elkdonis/studio";
import { StudioColumns } from "@elkdonis/studio/frame";

// ============================================================================
// Kinds this site does not offer yet, held in the Studio as "coming".
//
// Why register them at all: packages/studio gives these kinds an `href`
// (`/studio?kind=video`, …) for hosts that do not register them, and "New ▾"
// follows it. On this site /studio is the PAGE editor, so the fallback would
// drop Ario into Puck. A stub extension keeps him in the Studio and says
// plainly what is and is not here. (Package ask in docs/editor.md: a host
// prop to hide kinds, or an href base.)
// ============================================================================

const WHY: Record<string, { label: string; text: string }> = {
  meeting: {
    label: "Events",
    text: "Events and meetings are coming to this site. Its pages do not show dates yet, so an event made now would have nowhere to appear.",
  },
  post: {
    label: "Social posts",
    text: "Posts for Facebook, Instagram and Threads are coming. They go out through accounts connected on the network, which this site does not hold yet.",
  },
  video: { label: "Video", text: "Reels are coming to this site." },
  recording: { label: "Recordings", text: "Recording from a camera, a screen or a phone is coming to this site." },
  wordart: { label: "Word art", text: "Word art is coming to this site." },
};

export const COMING_KINDS = Object.keys(WHY);

export function comingExtension(id: string): StudioExtension {
  const w = WHY[id] ?? { label: id, text: "Coming to this site." };
  return {
    id,
    label: `${w.label} · soon`,
    listLabel: w.label,
    render: () => (
      <StudioColumns
        drawer={<p className="studio-hint">Nothing here yet.</p>}
        main={
          <div className="he-sk-main he-sk-coming">
            <p className="he-sk-kicker">Coming</p>
            <h2>{w.label}</h2>
            <p>{w.text}</p>
            <p className="studio-hint">Writing and Services work now: choose them above.</p>
          </div>
        }
      />
    ),
  };
}
