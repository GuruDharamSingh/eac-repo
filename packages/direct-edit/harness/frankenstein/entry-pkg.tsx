// Harness entry for the packaged parts plugin (2026-11-06): page-builder's real
// PuckEditor and partsPlugin, with Para Theater's editor config, its contract and
// the /try seed, wired as apps/sunjay/src/components/studio/page-editor.tsx wires
// them. No network, no database.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { partsPlugin } from "/app/packages/page-builder/src/parts/plugin";
import { partSelection, selectPart } from "/app/packages/page-builder/src/parts/store";
import { puckConfig, canvasContract } from "/app/apps/sunjay/src/lib/puck/config.client";
import { partLookOf, partSafeDecls, setPartLook } from "/app/packages/direct-edit/src/puck/morph-mark";
import { cleanMorph, morphCss } from "/app/packages/direct-edit/src/block/morph";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import { mountLookPanel } from "/app/packages/direct-edit/src/puck/look-panel";
import "/app/packages/direct-edit/src/direct-edit.css";
import seed from "/app/packages/direct-edit/harness/sunjay-try-page.json";

const g = globalThis as any;
g.__seed = JSON.parse(JSON.stringify(seed));
g.__published = null;
g.__parts = partSelection;
g.__setPart = selectPart;
g.__lib = { cleanMorph, morphCss, setPartLook, partSafeDecls, cleanBoxDoc };
g.__contract = canvasContract;

// Test hook only: hands the driver Puck's API.
function Probe() { g.__getPuck = useGetPuck(); return null; }
const probe: Plugin = { name: "probe", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Probe), children) } } as any;

// Harness only: a band (which has a slot and no parts on Para Theater) gets an inner part
// whose selector also matches the heading of the feed cards placed in it, to check
// that a nested block's elements are never picked or outlined as the band's.
const contract = { ...canvasContract, "pt-band": { label: "Band", parts: { heading: { label: "Any heading (test)", sel: "h2" } } } };
g.__contract = contract;
// ?panel=look mounts direct-edit's look panel (as sunjay does); ?dev=1 turns on the developer tools.
const q = new URLSearchParams(location.search);
const PARTS = partsPlugin({
  contract: contract as any,
  look: { partLookOf, setPartLook, partSafeDecls },
  panel: q.get("panel") === "look" ? (mountLookPanel as any) : undefined,
  developer: q.get("dev") === "1",
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
