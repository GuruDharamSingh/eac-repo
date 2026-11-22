// Checks for the block-forward landing page on innergathering (2026-11-21): each new block loads in the catalogue, has
// a sample(), declares `reads`, declares parts that its markup really has, and renders on the server from its sample;
// both are registered in the server and client configs and their resolver keys are stripped on save; the saved page's
// two live parts are read as the blocks; the sign-in panel never draws for someone who is signed in and carries no
// member data; the forum band's two live pieces switch off. No database reads or writes.
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/innergathering admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-landing-blocks.mts
import React from "react";
(globalThis as any).React = React;
import { register, createRequire } from "node:module";
import { readFileSync } from "node:fs";

// The block files import their stylesheets; node cannot, so they load as empty modules here.
register("data:text/javascript," + encodeURIComponent("export async function load(url, ctx, next){ if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, ctx); }"));
(createRequire(import.meta.url).extensions as any)[".css"] = (m: any) => { m.exports = {}; };

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  -> ${detail}` : ""}`);
}

const { renderToStaticMarkup } = await import("react-dom/server");
const { createCatalogue } = await import("@elkdonis/blocks");
const { LANDING_BLOCKS, swapLandingParts, ABOUT_PATTERN } = await import("../src/lib/puck/landing-blocks");
const { LANDING_RESOLVED_KEYS } = await import("../src/lib/puck/landing-resolved");
const { SHARED_BLOCKS } = await import("@elkdonis/blocks");
const serverBlocks = (SHARED_BLOCKS as any[]).filter(Boolean);

const render = (b: any, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(b.Component, props));

// ---- 1. each block loads, has a sample and `reads`, renders from its sample, and its parts exist in what it draws
let threw = "";
try { createCatalogue(LANDING_BLOCKS as never); } catch (e) { threw = String(e); }
check("the landing blocks build a catalogue without throwing", threw === "", threw);
for (const id of ["offerings-band", "grand-forum"]) {
  const b: any = (LANDING_BLOCKS as any[]).find((x) => x.def.id === id);
  check(`${id}: in the catalogue`, !!b);
  if (!b) continue;
  check(`${id}: has sample()`, typeof b.sample === "function");
  check(`${id}: declares reads`, Array.isArray(b.def.reads) && b.def.reads.length > 0);
  check(`${id}: reads the site's org and the viewer`, b.def.reads.some((r: any) => r.from === "site") && b.def.reads.some((r: any) => r.from === "viewer"));
  let html = "";
  let err = "";
  try { html = render(b, b.sample()); } catch (e) { err = String(e); }
  check(`${id}: renders on the server from its sample`, err === "" && html.length > 200, err || `short (${html.length})`);
  for (const [name, part] of Object.entries<any>(b.def.parts ?? {})) {
    if (part.sel.startsWith(">")) continue;
    const cls = part.sel.match(/\.([\w-]+)/)?.[1];
    check(`${id}: part ${name} (${part.sel}) is in the markup`, !!cls && html.includes(cls), "not found");
  }
  check(`${id}: root part is its outer element`, (html.startsWith("<section ") && html.slice(0, html.indexOf(">")).includes(`class="${b.def.parts.root.sel.replace("> .", "")}"`)), html.slice(0, 60));
}

// ---- 2. registered in both configs, and the save action strips what the resolvers fill in
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const server = src("../src/lib/puck/config.server.ts"), client = src("../src/lib/puck/config.client.ts");
for (const id of ["offerings-band", "grand-forum"]) {
  check(`${id}: resolver in config.server and config.client`, server.includes(`"${id}"`) && client.includes(`"${id}"`));
  check(`${id}: resolver keys listed to strip on save`, (LANDING_RESOLVED_KEYS[id] ?? []).length > 0);
}
check("both configs add LANDING_BLOCKS", server.includes("...LANDING_BLOCKS") && client.includes("...LANDING_BLOCKS"));
check("the save action strips LANDING_RESOLVED_KEYS", src("../src/lib/puck/actions.ts").includes("...LANDING_RESOLVED_KEYS"));
check("the landing editor passes resolvedKeys", src("../src/components/landing/page-editor-mount.ts").includes("resolvedKeys: LANDING_RESOLVED_KEYS"));
check("the page reads the saved parts as blocks", src("../src/app/page.tsx").includes("swapLandingParts(tree.data)"));
const declared = new Map(((LANDING_BLOCKS as any[])).map((b) => [b.def.id, new Set(b.def.props.map((p: any) => p.name))]));
for (const [id, keys] of Object.entries(LANDING_RESOLVED_KEYS)) {
  check(`${id}: no resolver key is also a stored setting`, keys.every((k) => !declared.get(id)!.has(k)), keys.filter((k) => declared.get(id)!.has(k)).join(","));
}

// ---- 3. the saved page's live parts are read as the blocks; nothing else changes
const tree = {
  root: { props: {} },
  content: [
    { type: "box", props: { id: "a", content: [{ type: "part", props: { id: "p1", part: "offerings" } }, { type: "part", props: { id: "p2", part: "gallery" } }] } },
    { type: "part", props: { id: "p3", part: "forum" } },
    { type: "words", props: { id: "w", html: "<p>x</p>" } },
  ],
};
const swapped = swapLandingParts(JSON.parse(JSON.stringify(tree)));
const flat = JSON.stringify(swapped.data);
check("swap: two parts became blocks", swapped.swapped === 2);
check("swap: offerings becomes offerings-band with the same id", flat.includes('"type":"offerings-band","props":{"id":"p1"}'));
check("swap: forum becomes grand-forum with the same id", flat.includes('"type":"grand-forum","props":{"id":"p3"}'));
check("swap: the gallery part and the words are untouched", flat.includes('"part":"gallery"') && flat.includes('"html":"<p>x</p>"'));
check("swap: a page with no such parts is returned equal", JSON.stringify(swapLandingParts({ content: [{ type: "words", props: { id: "w" } }] }).data) === '{"content":[{"type":"words","props":{"id":"w"}}]}');

// ---- 4. the sign-in panel: never for someone signed in, nothing of anyone's in it
const band: any = (LANDING_BLOCKS as any[]).find((x) => x.def.id === "offerings-band");
const sample = band.sample();
const member = { ...sample.items[0], attending: true, attendanceCount: 41 };
const isSignin = (html: string) => html.includes("ig-offer-signin") || html.includes("eac-bq");
check("sign-in: drawn for a visitor", isSignin(render(band, { ...sample, panel: "signin", signedIn: false })));
check("sign-in: never drawn for someone signed in", !isSignin(render(band, { ...sample, panel: "signin", signedIn: true, items: [member] })));
const asVisitor = render(band, { ...sample, panel: "signin", signedIn: false, items: [{ ...member, attending: true }] });
check("sign-in: carries no answer or count (no 'coming', no number of people)", !/coming|already attending|>41</i.test(asVisitor), "found a member's data");
check("sign-in: no password field is built here (the site's component draws it)", !/OfferingSignIn[\s\S]*type="password"/.test(src("../src/components/landing/OfferingSignIn.tsx")) && src("../src/components/landing/OfferingSignIn.tsx").includes("BaroqueSignup"));
check("panel none: draws no right-hand column", !render(band, { ...sample, panel: "none" }).includes("ig-offer-rsvp"));
const noRows = render(band, { ...sample, rows: [], more: "none" });
check("row beneath: none draws no list", !noRows.includes("ig-offer-more"));
check("closing link: empty words hide it", !render(band, { ...sample, allLabel: "" }).includes("ig-offer-all"));
check("cover frame: the default adds no style, a framed cover does", !/ig-offer-media[^>]*style|<img[^>]*style/.test(render(band, { ...sample, coverX: 50, coverY: 50, coverZoom: 1 })) && /object-position:30% 70%/.test(render(band, { ...sample, coverX: 30, coverY: 70, coverZoom: 1 })));
check("cover frame: zoom clips inside its box", /transform:scale\(2\)/.test(render(band, { ...sample, coverZoom: 2 })) && /overflow:hidden/.test(render(band, { ...sample, coverZoom: 2 })));
check("offerings: no items draws nothing", render(band, { ...sample, items: [] }) === "");

// ---- 5. the forum band: its two live pieces switch off, and the visitor's box is never drawn to a member
const forum: any = (LANDING_BLOCKS as any[]).find((x) => x.def.id === "grand-forum");
const f = forum.sample();
const live = { ...f, preview: false, embed: React.createElement("div", { id: "forum-live" }, "conversation"), signedIn: false };
check("forum: the conversation and the answer box draw by default", render(forum, live).includes("forum-live") && render(forum, live).includes("ig-forum-guest"));
check("forum: no answer box for someone signed in", !render(forum, { ...live, signedIn: true }).includes("ig-forum-guest"));
check("forum: showForum off drops the conversation", !render(forum, { ...live, showForum: false }).includes("forum-live"));
check("forum: showAnswer off drops the answer box", !render(forum, { ...live, showAnswer: false }).includes("ig-forum-guest"));
check("forum: nothing to show (no conversation, no question) draws nothing", render(forum, { ...f, embed: null, question: null, preview: false }) === "");
check("forum: the words are settings", render(forum, { ...live, heading: "Our Forum", lede: "Come in.", buttonLabel: "Go", buttonHref: "/x" }).includes("Our Forum") && render(forum, { ...live, buttonLabel: "Go", buttonHref: "/x" }).includes('href="/x"'));

// ---- 5b. a block that a saved page turns into (only an id and no settings) draws every default word
const bare = render(forum, { id: "x", embed: React.createElement("div", null, "c"), question: { id: "q", question: "Q?" }, signedIn: false });
check("forum: a node with no settings draws all the default words", ["Across the arts collectives", "The Grand Forum", "The independent forum used across the arts collectives", "Enter the forum"].every((w) => bare.includes(w)));
const bareBand = render(band, { id: "x", items: sample.items, signedIn: false, nextcloudUrl: null });
check("offerings: a node with no settings draws all the default words, panel and link", ["Open to everyone", "Current Offerings", "All offerings →", "ig-offer-rsvp"].every((w) => bareBand.includes(w)) || (!sample.items[0].thread.isRsvpEnabled && ["Open to everyone", "Current Offerings", "All offerings →"].every((w) => bareBand.includes(w))));
check("the landing editor opens Settings on blocks (puckConfig and contract passed)", src("../src/components/landing/page-editor-mount.ts").includes("puckConfig, contract: canvasContract"));

// ---- 6. the About pattern is ordinary blocks that exist in the server catalogue
const known = new Set((serverBlocks ?? []).map((b: any) => b?.def?.id));
const used = new Set<string>();
const walk = (n: any) => { if (!n) return; used.add(n.type); for (const v of Object.values(n.props ?? {})) if (Array.isArray(v)) v.forEach(walk); };
ABOUT_PATTERN.content.forEach(walk);
check("about pattern: only shared blocks (no special block)", [...used].every((t) => !["offerings-band", "grand-forum"].includes(t)), [...used].join(","));
if (serverBlocks) check("about pattern: every block in it is in the shared catalogue (which the server config includes)", [...used].every((t) => known.has(t)), [...used].filter((t) => !known.has(t)).join(","));
else console.log("SKIP  about pattern vs server catalogue ");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
