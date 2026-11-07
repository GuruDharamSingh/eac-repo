// What the published path draws, as bytes: every block in the catalogue through buildPuckConfig, Puck's
// <Render> and renderToStaticMarkup, with fixture props. Stone 2 edits shared code every host renders, so a
// block with no morph must stay byte-identical. Bundled and run by render-published.sh; compared by
// compare-render.cjs. The clock and Math.random are frozen by that runner. A case that throws records the error.
// Three ways to run it, each compared with the same baseline: as it is (a host with no morph option); WITH_MARK=1 (a
// wired host, nothing set); STRAY_MORPH=1 (no morph option, every node holding a morph, which must be stripped).
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render } from "@puckeditor/core/rsc";
import { SHARED_BLOCKS, toDefaultProps } from "/app/packages/blocks/src/index";
import { buildPuckConfig } from "/app/packages/page-builder/src/config";
import { STYLE_PROP } from "/app/packages/page-builder/src/style/schema";
import { BOX_BLOCKS, BOX_ROOT } from "/app/packages/direct-edit/src/puck/blocks";
import { MorphMark } from "/app/packages/direct-edit/src/puck/morph-mark";
import { banner, band, heading, link } from "/app/apps/sunjay/src/blocks/layout-blocks";

const pic = (name: string) => `/api/media/EAC_Network/oad/${name}.jpg`;
const SUNJAY: any[] = [banner, band, heading, link];
const blocks: any[] = [...SHARED_BLOCKS, ...SUNJAY, ...(BOX_BLOCKS as any)];
const mark: any = process.env.WITH_MARK ? { morph: MorphMark } : {};
const stray: Record<string, unknown> = process.env.STRAY_MORPH ? { morph: { v: 1, parts: { root: { fill: "#112233" } }, tokens: { "--blk-accent": "#112233" } } } : {};
const plain: any = buildPuckConfig({ blocks: blocks as any, root: BOX_ROOT as any, ...mark });
// danamccool's per-block wrapper is the adapter's `styled` path.
const TextStyle = ({ settings, children }: { settings: unknown; children?: ReactNode }) => createElement("div", { "data-text-style": JSON.stringify(settings) }, children);
const styled: any = buildPuckConfig({ blocks: blocks as any, root: BOX_ROOT as any, blockStyle: { name: "textStyle", wrap: TextStyle }, ...mark });
const unstyled: any = buildPuckConfig({ blocks: blocks as any, style: false, ...mark });

const draw = (config: any, content: any[], root: any = { props: {} }) => renderToStaticMarkup(createElement(Render as any, { config, data: { root, content } }));
const out: Record<string, string> = {};
const run = (name: string, config: any, content: any[], root?: any) => {
  try { out[name] = draw(config, content, root); } catch (e) { out[name] = `THROWS ${e instanceof Error ? e.message : String(e)}`; }
};
const node = (type: string, props: Record<string, unknown>, id = `n-${type}`) => ({ type, props: { id, ...props, ...stray } });
const defaultsOf = (b: any) => { try { return toDefaultProps(b.def); } catch { return {}; } };

for (const b of blocks) {
  const id = b.def.id;
  run(`${id}/defaults`, plain, [node(id, defaultsOf(b))]);
  if (b.sample) {
    let sample: Record<string, unknown> = {};
    try { sample = b.sample(); } catch { continue; }
    run(`${id}/sample`, plain, [node(id, { ...defaultsOf(b), ...sample })]);
  }
}

// The first blocks of stone 2, with real-looking props and each conditional part drawn.
const hero = { title: "The Ambrosial Hours", subtitle: "Rise with the sun", imageUrl: pic("dawn"), imageAlt: "Dawn over the fen", align: "left", height: 480 };
run("hero-banner/real", plain, [node("hero-banner", hero)]);
run("hero-banner/title-only", plain, [node("hero-banner", { title: "Ambrosial", align: "center", height: 0 })]);
run("section-heading/real", plain, [node("section-heading", { title: "Recent work", eyebrow: "This season", subtitle: "From the winter residency", level: "h3", align: "start", rule: true })]);
run("section-heading/no-rule", plain, [node("section-heading", { title: "Recent work", level: "h2", align: "center", rule: false })]);
run("prose/real", plain, [node("prose", { body: "<p>Words on a <b>page</b>, with a <a href=\"/about\">link</a>.</p><h2>A subheading</h2><ul><li>One</li><li>Two</li></ul><blockquote>A quote.</blockquote>", size: "large", align: "center", measure: true })]);
run("prose/plain-text", plain, [node("prose", { body: "First paragraph.\n\nSecond paragraph.", size: "regular", align: "start", measure: false })]);
const wallPictures = [
  { src: pic("nightjar"), alt: "Nightjar", caption: "Nightjar", href: "/work/nightjar", at: "", color: "" },
  { src: pic("vessels"), alt: "Three Vessels", caption: "Three Vessels", href: "", at: "top-right", color: "#ffeecc" },
  { src: pic("sun"), alt: "", caption: "", href: "", at: "", color: "" },
  { src: "", alt: "", caption: "Unfilled row", href: "", at: "", color: "" },
];
const wall = { min: 220, shape: "auto", gap: "regular", captionAt: "bottom-left", captionShow: "always", captionWeight: "regular", captionFont: "caption", captionSize: "theme", captionColor: "", captionScrim: "soft", pictures: wallPictures };
run("picture-wall/below", plain, [node("picture-wall", { ...wall, captionPlace: "below" })]);
run("picture-wall/on", plain, [node("picture-wall", { ...wall, captionPlace: "on", captionShow: "hover", captionColor: "#ffffff" })]);
run("picture-wall/empty", plain, [node("picture-wall", { ...wall, pictures: [] })]);
run("feature-card/real", plain, [node("feature-card", { title: "Three Vessels", body: "Fired in the old kiln.", image: pic("vessels"), kicker: "Work", meta: "2026", marker: "01", href: "/work/vessels", tone: "feed" })]);
run("feature-card/plain", plain, [node("feature-card", { title: "Three Vessels", body: "", tone: "plain" })]);
run("feature-card/bound", plain, [node("feature-card", { record: "artwork:x", tone: "panel", bound: { title: "Bound title", excerpt: "Bound words", image: pic("bound"), kicker: "Art", meta: "2025", href: "/art/x" } })]);
const ptBanner = { title: "Para Theater", subtitle: "Rock balancing, qi gong, and conscious creativity", body: "We meet on the first Sunday.", ctaLabel: "Come along", ctaHref: "/community", imageUrl: pic("rocks"), imageAlt: "Balanced rocks", scrim: 70, scrimColor: "#223344", inkColor: "#f4f1ea", accentColor: "#d9c08a", align: "left", size: "tall", height: 640 };
run("pt-banner/real", plain, [node("pt-banner", ptBanner)]);
run("pt-banner/no-picture", plain, [node("pt-banner", { title: "Para Theater", align: "center", size: "regular", height: 0 })]);

// Nesting: slots, own boxes and the page root.
run("grid/nested", plain, [node("grid", { columns: "2", minWidth: 220, gap: "regular", align: "stretch", items: [node("prose", { body: "In a grid." }, "p1"), node("quote", { text: "A quote in a grid." }, "q1"), node("hero-banner", hero, "h1")] })]);
run("box/tree", plain, [node("box", { tag: "section", label: "A section", anchor: "here", look: { layout: "stack", dir: "column", gap: 10, padding: 16, fill: "#ddeeff" }, items: [node("words", { tag: "h2", html: "An own <b>box</b>" }, "w1"), node("picture", { src: pic("own"), alt: "Own" }, "pic1"), node("hero-banner", hero, "h2")] })], { props: { title: "A page", look: { fill: "#fbf7ef" } } });

// The adapter's other paths.
run("path/generic-style", plain, [node("hero-banner", { ...hero, [STYLE_PROP]: { padX: 24, marginTop: 12, bg: "#112233", radius: 8 } })]);
run("path/block-style-unset", styled, [node("hero-banner", hero)]);
run("path/block-style-set", styled, [node("hero-banner", { ...hero, textStyle: { font: "serif" } })]);
run("path/style-off", unstyled, [node("section-heading", { title: "No generic style", level: "h2", align: "center", rule: true })]);
const contactForm = SHARED_BLOCKS.find((b: any) => b.def.interactive);
if (contactForm) run("path/interactive", plain, [node(contactForm.def.id, { ...defaultsOf(contactForm) })]);

process.stdout.write(JSON.stringify(out, null, 1));
