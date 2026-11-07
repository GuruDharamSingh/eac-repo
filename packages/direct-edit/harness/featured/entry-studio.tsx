// Harness: elktours' Puck Studio for site pages (components/studio/page-editor.tsx as shipped: parts plugin, popup,
// the person chooser in the right panel) on a page with a heading, text and a Featured person (2026-11-06).
import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { PageEditor } from "/app/apps/elktours/src/components/studio/page-editor";
import "@elkdonis/blocks/blocks.css";

const g = globalThis as any;
const DANA = "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6";
const seed = {
  root: { props: { title: "Walking notes" } },
  content: [
    { type: "section-heading", props: { id: "hd", title: "Walking notes", level: "h1" } },
    { type: "prose", props: { id: "pr", body: "<p>What we look for on the way.</p>" } },
    { type: "featured-person", props: { id: "fp-s", person: DANA } },
  ],
};
createRoot(document.getElementById("host")!).render(h(PageEditor, { slug: "walking-notes", orgId: "elktours", initial: seed as never }));
