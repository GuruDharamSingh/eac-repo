// Harness: elktours' landing editor (canvas config, contract and "From what?" chooser as shipped) on a stored tree
// with two Featured person blocks: one with no one chosen, one with Dana, whose drawing comes from the page.
import "@elkdonis/blocks/blocks.css";
import "@elkdonis/direct-edit/direct-edit.css";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openPageAsTree } from "/app/packages/direct-edit/src/puck/open-page";
import { FeaturedPerson } from "/app/packages/blocks/src/blocks/featured-person";
import { canvasConfig, canvasContract as contract } from "/app/apps/elktours/src/lib/puck/config.client";
import { records } from "/app/apps/elktours/src/components/landing/person-records";

const g = globalThis as any;
const DANA = "user:4eebc495-1db6-4b1e-a5b3-399326c78fe6";
const tree = {
  root: { props: { title: "Landing page" } },
  content: [
    { type: "box", props: { id: "box-hero", tag: "section", look: { pad: 32, layout: "flex", dir: "column", gap: 16 }, items: [
      { type: "words", props: { id: "words-h1", tag: "h1", html: "Walk Paris with someone who lives here." } },
      { type: "featured-person", props: { id: "fp-a", person: "" } },
      { type: "featured-person", props: { id: "fp-b", person: DANA } },
    ] } },
  ],
};
g.__saved = null;
g.__render = (props: any) => renderToStaticMarkup(h(FeaturedPerson, props));
g.__editor = openPageAsTree({
  root: document.querySelector(".elk-landing") as HTMLElement,
  tree: tree as never,
  title: "Landing page",
  pageName: "Landing page",
  config: canvasConfig as never,
  contract: contract as never,
  records,
  resolved: { "fp-b": { who: { displayName: "Dana McCool", roleTitle: "Guide", bio: "Lives in the Marais.", photoUrl: "/p/dana.png", href: "/about/dana-mccool", via: null } } },
  onSave: async (d) => { g.__saved = JSON.parse(JSON.stringify(d)); return { ok: true }; },
});
