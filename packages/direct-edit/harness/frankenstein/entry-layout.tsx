// Harness entry (2026-11-07): the three new layout blocks (Sticky side, Tabs, Sections that open) and a Featured
// person on Para Theater's real configs. `?view=1` draws the page as a visitor gets it (the published-shape config,
// Puck's <Render>); without it, page-builder's PuckEditor with sunjay's Studio config.
import { createElement as h, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { Render, useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { canvasConfig, puckConfig } from "/app/apps/sunjay/src/lib/puck/config.client";
import "/app/packages/blocks/src/blocks.css";
import "/app/packages/direct-edit/src/direct-edit.css";

const g = globalThis as any;
const prose = (id: string, body: string) => ({ type: "prose", props: { id, body } });
const long = (id: string) => prose(id, Array.from({ length: 14 }, (_, i) => `Paragraph ${i + 1} of the long column. Ritual theatre asks the body to listen before it speaks.`).join("\n\n"));
const seed = {
  root: { props: {} },
  content: [
    { type: "sticky-split", props: { id: "ss", sideAt: "start", ratio: "third", offset: 40, gap: "regular", side: [prose("side", "I stay in view.")], main: [long("main")] } },
    { type: "tab-set", props: { id: "tb", label1: "One", label2: "Two", label3: "Three", label4: "", label5: "", look: "line", align: "start",
      panel1: [prose("t1", "In tab one")], panel2: [prose("t2", "In tab two")], panel3: [], panel4: [], panel5: [] } },
    { type: "accordion-set", props: { id: "ac", title1: "First", title2: "Second", title3: "Third", title4: "", title5: "", title6: "", look: "divided", openFirst: true, oneAtATime: true,
      section1: [prose("a1", "Inside one")], section2: [prose("a2", "Inside two")], section3: [], section4: [], section5: [], section6: [] } },
    { type: "featured-person", props: { id: "fp", person: "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6", opens: "", layout: "side" } },
  ],
};
g.__seed = JSON.parse(JSON.stringify(seed));
function Probe() { g.__getPuck = useGetPuck(); return null; }
const probe: Plugin = { name: "probe", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Probe), children) } } as any;

const host = document.getElementById("host")!;
if (new URLSearchParams(location.search).get("view") === "1") {
  createRoot(host).render(h("main", { style: { padding: "24px 16px", maxWidth: 1100, margin: "0 auto" } }, h(Render as any, { config: canvasConfig, data: seed })));
} else {
  createRoot(host).render(h(PuckEditor as any, { slug: "try", orgId: "sunjay", initial: seed, config: puckConfig, onPublish: async () => ({ ok: true }), plugins: [probe], title: "/try" }));
}
