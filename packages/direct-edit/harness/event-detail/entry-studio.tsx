// Harness entry (2026-11-14): Para Theater's Puck Studio (page-builder's PuckEditor with sunjay's real puckConfig) on a
// page holding "Piece (article)", for the "From what?" piece picker in Puck's right column. Server actions are stubbed
// (build.cjs), writing-actions is aliased to writing-actions-stub.ts.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { puckConfig } from "/app/apps/sunjay/src/lib/puck/config.client";
import "/app/packages/direct-edit/src/direct-edit.css";

const g = globalThis as any;
const seed = {
  root: { props: { title: "Writing" } },
  content: [
    { type: "pt-heading", props: { id: "st-head", text: "A piece", level: "2", rule: true, align: "left" } },
    { type: "pt-article", props: { id: "st-article", piece: "", reading: "journal", showBack: true, showCover: true } },
  ],
};
g.__published = null;
function Probe() { g.__getPuck = useGetPuck(); return null; }
const probe: Plugin = { name: "probe", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Probe), children) } } as any;

createRoot(document.getElementById("host")!).render(
  h(PuckEditor, {
    slug: "writing",
    orgId: "sunjay",
    initial: seed as any,
    config: puckConfig as any,
    onPublish: async (_slug: string, data: any) => { g.__published = JSON.parse(JSON.stringify(data)); return { ok: true }; },
    plugins: [probe],
  } as any)
);
