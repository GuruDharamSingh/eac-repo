// Harness entry: page-builder's real PuckEditor with Para Theater's editor config,
// its contract, the /try seed, and the parts plugin. No network, no database.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { puckConfig, canvasContract } from "/app/apps/sunjay/src/lib/puck/config.client";
import { cleanMorph, morphCss, setPartLook } from "/app/packages/direct-edit/src/block/morph";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import seed from "/app/packages/direct-edit/harness/sunjay-try-page.json";
import { partsPlugin, partSel, setPart } from "./parts-plugin";

const g = globalThis as any;
g.__seed = JSON.parse(JSON.stringify(seed));
g.__published = null;
g.__parts = partSel;
g.__setPart = setPart;
g.__lib = { cleanMorph, morphCss, setPartLook, cleanBoxDoc };
g.__contract = canvasContract;

// Test hook only: hands the driver Puck's API.
function Probe() { g.__getPuck = useGetPuck(); return null; }
const probe: Plugin = { name: "probe", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Probe), children) } } as any;

// 2026-11-06: the hidden `morph` field now comes from buildPuckConfig (page-builder/src/config.tsx).
// Before that, Puck's editor walked into `morph` and dropped looks on parts named like a text field.
const config = puckConfig;

createRoot(document.getElementById("host")!).render(
  h(PuckEditor, {
    slug: "try",
    orgId: "sunjay",
    initial: seed as any,
    config: config as any,
    onPublish: async (_slug: string, data: any) => { g.__published = JSON.parse(JSON.stringify(data)); return { ok: true }; },
    plugins: [partsPlugin(canvasContract as any), probe],
  })
);
