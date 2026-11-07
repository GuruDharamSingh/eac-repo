import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Render, Puck } from "@puckeditor/core";
import { mountTreePage, BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/index";
import { slotsOf } from "/app/packages/direct-edit/src/puck/mount";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import { SHARED_BLOCKS } from "/app/packages/blocks/src/index";
import { sanitizeRichValues } from "/app/packages/blocks/src/text";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { validatePage } from "/app/packages/page-builder/src/validate";
import { classifieds } from "./sample";

const config: any = buildPuckConfig({ blocks: [...SHARED_BLOCKS, ...(BOX_BLOCKS as any)] as any, root: BOX_ROOT as any });
const look = (o: object) => o;
const start = {
  root: { props: { title: "Tree test" } },
  content: [
    { type: "section-heading", props: { id: "head", title: "A sealed heading block", eyebrow: "Live block" } },
    { type: "box", props: { id: "A", tag: "section", look: look({ layout: "stack", dir: "column", gap: 10, padding: 16, fill: "#ddeeff" }), items: [
      { type: "words", props: { id: "w1", tag: "h2", html: "First words" } },
      { type: "words", props: { id: "w2", tag: "p", html: "Second <b>words</b> here" } },
    ] } },
    { type: "box", props: { id: "B", tag: "div", look: look({ layout: "stack", dir: "row", gap: 10, padding: 16, fill: "#ffeedd" }), items: [
      { type: "words", props: { id: "w3", tag: "p", html: "Third words" } },
      { type: "picture", props: { id: "p1", src: "/pic.png", alt: "A sample" } },
    ] } },
    { type: "grid", props: { id: "G", columns: "2", minWidth: 220, gap: "regular", align: "stretch", items: [
      { type: "prose", props: { id: "pr", body: "A sealed prose block inside a grid." } },
    ] } },
    { type: "box", props: { id: "E", tag: "div", look: look({ layout: "stack", dir: "column", padding: 8 }), items: [] } },
  ],
};
(window as any).kit = { config, slotsOf, cleanBoxDoc, sanitizeRichValues, validatePage };
(window as any).saved = [];
(window as any).published = (doc: any) => { const h = document.createElement("div"); h.id = "pub"; document.body.appendChild(h); flushSync(() => createRoot(h).render(createElement(Render as any, { config, data: doc }))); return h; };
(window as any).oldEditor = (doc: any) => { const h = document.createElement("div"); h.id = "old"; document.body.appendChild(h); createRoot(h).render(createElement(Puck as any, { config, data: doc, iframe: { enabled: false }, onPublish: () => {} })); };
(window as any).ed = mountTreePage({ host: document.getElementById("host")!, config, doc: (location.hash === "#classifieds" ? classifieds : start) as any, onSave: async (d) => { (window as any).saved.push(d); return { ok: true }; } });
