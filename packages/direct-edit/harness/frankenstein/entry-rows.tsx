// Harness entry for the shared row rich text (round 2, 2026-11-14): page-builder's buildEditorConfig with NO host
// `fields.richtext` (so the shared `rowFields` default is what draws a row's rich-text column), over Para Theater's
// catalogue and the /try seed with a Numbered steps block. Publish is captured in globalThis.__published.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { buildEditorConfig } from "/app/packages/page-builder/src/config.client";
import { CATALOGUE } from "/app/apps/sunjay/src/lib/puck/catalogue";
import seed0 from "/app/packages/direct-edit/harness/sunjay-try-page.json";

const g = globalThis as any;
const seed = JSON.parse(JSON.stringify(seed0));
seed.content.splice(1, 0, {
  type: "pt-steps",
  props: {
    id: "try-steps",
    heading: "How to join",
    numbered: true,
    steps: [
      { title: "Open the room", text: "<p>Use the button below. Allow your camera when asked.</p>" },
      { title: "Read before we meet", text: "<p>The reading is <strong>listed</strong> under Materials.</p><p>Second paragraph.</p>" },
      { title: "", text: "" },
    ],
  },
});
g.__seed = JSON.parse(JSON.stringify(seed));
g.__published = null;
const config = buildEditorConfig({ blocks: CATALOGUE as never, media: { uploadEndpoint: "/api/upload", libraries: [] } as never });
g.__arrayFields = (config.components as any)["pt-steps"]?.fields?.steps?.arrayFields;

function Probe() { g.__getPuck = useGetPuck(); return null; }
const probe: Plugin = { name: "probe", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Probe), children) } } as any;

createRoot(document.getElementById("host")!).render(
  h(PuckEditor, {
    slug: "try",
    orgId: "sunjay",
    initial: seed as any,
    config: config as any,
    onPublish: async (_slug: string, data: any) => { g.__published = JSON.parse(JSON.stringify(data)); return { ok: true }; },
    plugins: [probe],
  })
);
