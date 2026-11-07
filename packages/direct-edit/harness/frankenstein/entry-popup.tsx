// Harness entry for the block popup opened from Puck Studio (2026-11-06,
// docs/open/EDIT_LOOK_POPUP_BRIEF_2026-11-06.md): page-builder's PuckEditor with the
// packaged partsPlugin wired exactly as apps/sunjay/src/components/studio/page-editor.tsx
// wires it (look panel, `developer` off, `popup` = direct-edit's openStudioPopup with
// sunjay's canvasConfig and contract), on the /try seed with two Numbered steps blocks
// added: one at the top level and one inside a band. ?dev=1 turns the developer tools on.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { partsPlugin } from "/app/packages/page-builder/src/parts/plugin";
import { blockPopupOpen } from "/app/packages/page-builder/src/parts/popup";
import { partSelection } from "/app/packages/page-builder/src/parts/store";
import { canvasConfig, canvasContract, puckConfig } from "/app/apps/sunjay/src/lib/puck/config.client";
import { partLookOf, partSafeDecls, setPartLook } from "/app/packages/direct-edit/src/puck/morph-mark";
import { mountLookPanel } from "/app/packages/direct-edit/src/puck/look-panel";
import { openStudioPopup } from "/app/packages/direct-edit/src/puck/studio-popup";
import "/app/packages/direct-edit/src/direct-edit.css";
import seed0 from "/app/packages/direct-edit/harness/sunjay-try-page.json";

const g = globalThis as any;
const steps = (id: string, heading: string) => ({
  type: "pt-steps",
  props: {
    id,
    heading,
    numbered: true,
    steps: [
      { title: "Open the room", text: "<p>Use the button below. Allow your camera when asked.</p>" },
      { title: "", text: "" },
      { title: "Read before we meet", text: "<p>The reading for the week is listed under Materials.</p>" },
    ],
  },
});
const seed = JSON.parse(JSON.stringify(seed0));
seed.content.splice(1, 0, steps("try-steps", "How to join"));
seed.content.find((c: any) => c.props.id === "try-about").props.content.push(steps("try-steps-nested", "Before the lab"));
g.__seed = JSON.parse(JSON.stringify(seed));
g.__published = null;
g.__parts = partSelection;
g.__popupOpen = blockPopupOpen;

function Probe() { g.__getPuck = useGetPuck(); return null; }
const probe: Plugin = { name: "probe", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Probe), children) } } as any;

const q = new URLSearchParams(location.search);
const PARTS = partsPlugin({
  contract: canvasContract as any,
  look: { partLookOf, setPartLook, partSafeDecls },
  panel: mountLookPanel as any,
  developer: q.get("dev") === "1",
  popup: (ctx) => openStudioPopup({ config: canvasConfig as any, contract: canvasContract as any }, ctx),
});

createRoot(document.getElementById("host")!).render(
  h(PuckEditor, {
    slug: "try",
    orgId: "sunjay",
    initial: seed as any,
    config: puckConfig as any,
    onPublish: async (_slug: string, data: any) => { g.__published = JSON.parse(JSON.stringify(data)); return { ok: true }; },
    plugins: [PARTS, probe],
  })
);
