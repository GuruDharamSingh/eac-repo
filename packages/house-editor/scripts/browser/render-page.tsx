// Node side: draws a page the way sunjay draws it for an editor (marks on), writes the HTML and the field map.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
(globalThis as any).React = React;
import { Render } from "@puckeditor/core/rsc";
import { SHARED_BLOCKS } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { buildPuckConfig } from "@elkdonis/page-builder/config";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { fieldMapOf, recordMarks } from "@elkdonis/house-editor/fields/server";

const blocks = SHARED_BLOCKS as any[];
const config = buildPuckConfig({
  blocks: blocks as never,
  morph: MorphMark,
  marks: { from: recordMarks({ "feature-card": { ref: "record", kinds: ["thread"], resolved: "bound", fills: { title: "title", body: "excerpt", meta: "meta" } } }) },
});
const bound = { kind: "Writing", title: "A post title", excerpt: "A post summary", meta: null, href: null, image: null };
const data = {
  root: { props: {} },
  content: [
    { type: "hero-banner", props: { id: "h-1", title: "Hero words", subtitle: "Sub words", morph: { v: 1, parts: { title: { color: "#e0b23c" } } } } },
    { type: "feature-card", props: { id: "c-typed", title: "Typed card", body: "Typed body words", kicker: "", meta: "", record: "", opens: "", tone: "feed" } },
    { type: "feature-card", props: { id: "c-rec", title: "", body: "", kicker: "", meta: "", record: "thread:abc123", opens: "", tone: "feed", bound } },
  ],
};
const html = renderToStaticMarkup(
  <div id="page"><template data-blk-page="home" /><Render config={config as never} data={data as never} /></div>,
);
writeFileSync("/out/site/page.html", html);
writeFileSync("/out/site/map.json", JSON.stringify(fieldMapOf(contractOf(blocks as never) as never)));
console.log("rendered", html.length, "bytes");
