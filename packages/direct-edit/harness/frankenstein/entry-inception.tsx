// Harness entry for "inception" (2026-11-14, docs/open/EDITING_LANDSCAPE_2026-11-12/strokes.md moves 1-2):
// Para Theater's real canvas page editor (apps/sunjay/src/components/studio/CanvasEditor.tsx), unchanged, on the
// /try seed with a Numbered steps block added at the top level. Its "Settings…" opens one block in Puck over the
// canvas (page-builder openBlockSettings) with the parts plugin inside; "Edit look" there opens direct-edit's popup
// over the sheet; the canvas's own popup offers "Settings…" too. Server actions are recording stubs (build.cjs here).
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { CanvasEditor } from "/app/apps/sunjay/src/components/studio/CanvasEditor";
import seed0 from "/app/packages/direct-edit/harness/sunjay-try-page.json";
import { quietFocus } from "/app/packages/direct-edit/src/canvas/quiet-focus";

const g = globalThis as any;
// Item 5a's module, for the fixture check in drive-inception section J.
g.__quietFocus = quietFocus;
const seed = JSON.parse(JSON.stringify(seed0));
seed.content.splice(1, 0, {
  type: "pt-steps",
  props: {
    id: "try-steps",
    heading: "How to join",
    numbered: true,
    steps: [
      { title: "Open the room", text: "<p>Use the button below. Allow your camera when asked.</p>" },
      { title: "Read before we meet", text: "<p>The reading for the week is listed under Materials.</p>" },
    ],
  },
});
g.__seed = JSON.parse(JSON.stringify(seed));

createRoot(document.getElementById("host")!).render(h(CanvasEditor, { slug: "try", orgId: "sunjay", initial: seed }));
