// Checks for the block-forward pieces on elktours (2026-11-21): every new or changed block loads in the catalogue
// without throwing, has a sample(), declares `reads`, and renders on the server from its sample; the role-aware buttons
// and menu show each of a visitor, a signed-in non-member, a member, a guide and an owner exactly what they may see and
// nothing else in the HTML; links are filtered; the new settings leave today's data untouched at their defaults.
// No database writes; the reads are the public lists the site already uses.
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/elktours admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-blocks.mts
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
const { MOBILE_BLOCKS, PAGE_BLOCKS } = await import("../src/lib/puck/catalogue");
const logic = await import("../src/blocks/mobile/page-buttons-logic");
const menu = await import("../src/blocks/mobile/phone-menu-logic");
const { allows, rankOf } = await import("../src/lib/puck/viewer-rank");

// ---- 1. every block loads, has a sample and `reads`, renders from its sample
const NEW = ["m-page-buttons", "m-phone-menu", "tour-cards"];
const CHANGED = ["m-places-shelf", "m-guides", "m-experiences-panel", "m-masthead", "m-link-rows"];
// featuredPerson reads as undefined under tsx (not mine): left out of the catalogue check
let threw = "";
try { createCatalogue([...MOBILE_BLOCKS].filter(Boolean) as never); createCatalogue([...PAGE_BLOCKS].filter(Boolean) as never); } catch (e) { threw = String(e); }
check("both catalogues build without throwing", threw === "", threw);
const all = ([...MOBILE_BLOCKS, ...PAGE_BLOCKS] as any[]).filter(Boolean);
for (const id of [...NEW, ...CHANGED]) {
  const b = all.find((x) => x.def.id === id);
  check(`${id}: in the catalogue`, !!b);
  if (!b) continue;
  check(`${id}: has sample()`, typeof b.sample === "function");
  check(`${id}: declares reads`, Array.isArray(b.def.reads) && b.def.reads.length > 0);
  let html = "";
  let err = "";
  try { html = renderToStaticMarkup(React.createElement(b.Component, b.sample())); } catch (e) { err = String(e); }
  check(`${id}: renders on the server from its sample`, err === "" && (html.length > 0 || id === "m-phone-menu"), err || "empty"); // the menu draws only where the router gives it a path, so it is empty outside a request
}
check("m-page-buttons has an id that was never used before and the old m-link-rows id is unchanged", all.some((b) => b.def.id === "m-link-rows") && NEW.every((id) => all.filter((b) => b.def.id === id).length === 1));

// ---- 2. registered in the server configs and the client configs (the client ones are "use client" modules: read as text)
const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const mobServer = src("../src/lib/puck/config.mobile.server.ts"), mobClient = src("../src/lib/puck/config.mobile.client.ts");
const deskServer = src("../src/lib/puck/config.server.ts"), deskClient = src("../src/lib/puck/config.client.ts");
for (const id of ["m-page-buttons", "m-phone-menu", "m-places-shelf", "m-guides", "m-experiences-panel"]) {
  check(`${id}: resolver in config.mobile.server and config.mobile.client`, mobServer.includes(`"${id}"`) && mobClient.includes(`"${id}"`));
}
check("tour-cards: resolver in config.server and config.client", deskServer.includes('"tour-cards"') && deskClient.includes('"tour-cards"'));
const resolvedSrc = src("../src/lib/puck/resolved.ts");
for (const id of ["m-page-buttons", "m-phone-menu", "tour-cards"]) check(`${id}: resolved keys listed (stripped on save)`, resolvedSrc.includes(`"${id}"`));

// ---- 3. role-aware page buttons: each audience gets exactly its buttons
const VISITOR = null;
const FOLLOWER = { role: "viewer", name: "Fay" };
const MEMBER = { role: "member", name: "Mo" };
const GUIDE = { role: "guide", name: "Gus" };
const OWNER = { role: "owner", name: "Olive" };
check("rank table: 0/1/2/3/4", [VISITOR, FOLLOWER, MEMBER, GUIDE, OWNER].map(rankOf).join() === "0,1,2,3,4");
check("an unknown audience shows to nobody", !allows("wizards", OWNER) && !allows("wizards", VISITOR));

const pageButtonsBlock = all.find((x) => x.def.id === "m-page-buttons");
const phoneMenuBlock = all.find((x) => x.def.id === "m-phone-menu");
const draw = (rows: unknown, v: any, all_ = false) => renderToStaticMarkup(React.createElement(pageButtonsBlock.Component, { buttons: rows, accountLabel: "Account", shown: logic.buttonsFor(rows, { viewer: v, count: 75, accountLabel: "Account", all: all_ }) } as never));

// the standard three (stored rows empty)
const std = (v: any) => draw([], v);
let h = std(VISITOR);
check("visitor: Log in, /login, forum, places; no office, no account", h.includes("Log in") && h.includes('href="/login"') && h.includes("Elkdonis Forum") && h.includes("/places") && !h.includes("The Office") && !h.includes("/manage") && !h.includes("/account"), h);
h = std(FOLLOWER);
check("signed-in non-member: their name to /account; no Log in, no office", h.includes("Fay") && h.includes('href="/account"') && !h.includes("Log in") && !h.includes("/manage") && !h.includes("The Office"));
h = std(MEMBER);
check("member: their name to /account; no office", h.includes("Mo") && h.includes('href="/account"') && !h.includes("/manage") && !h.includes("The Office"));
h = std(GUIDE);
check("guide: The Office to /manage; no Log in, no /account, no name", h.includes("The Office") && h.includes('href="/manage"') && !h.includes("Log in") && !h.includes("/account") && !h.includes("Gus"));
h = std(OWNER);
check("owner: The Office to /manage; no Log in, no /account", h.includes("The Office") && h.includes('href="/manage"') && !h.includes("Log in") && !h.includes("/account"));
check("places meta counts: '75 places the guides know well'", std(VISITOR).includes("75 places the guides know well"));

// custom list with one button per audience
const rows = [
  { label: "For everyone", to: "/a", who: "everyone", look: "row", width: "half" },
  { label: "Signed out only", to: "/so", who: "signed-out", look: "row", width: "half" },
  { label: "Any signed in", to: "/si", who: "signed-in", look: "row", width: "half" },
  { label: "Members up", to: "/mem", who: "member", look: "row", width: "half" },
  { label: "Guides up", to: "/gd", who: "guide", look: "row", width: "half" },
  { label: "Owner only", to: "/ow", who: "owner", look: "row", width: "half" },
];
const expect: Record<string, [any, string[]]> = {
  visitor: [VISITOR, ["For everyone", "Signed out only"]],
  follower: [FOLLOWER, ["For everyone", "Any signed in"]],
  member: [MEMBER, ["For everyone", "Any signed in", "Members up"]],
  guide: [GUIDE, ["For everyone", "Any signed in", "Members up", "Guides up"]],
  owner: [OWNER, ["For everyone", "Any signed in", "Members up", "Guides up", "Owner only"]],
};
const ALL_LABELS = rows.map((r) => r.label), ALL_HREFS = rows.map((r) => r.to);
for (const [who, [v, labels]] of Object.entries(expect)) {
  const html = draw(rows, v);
  const should = rows.filter((r) => labels.includes(r.label));
  const shouldNot = rows.filter((r) => !labels.includes(r.label));
  check(`${who}: exactly ${labels.length} buttons, no label or link of the others`,
    should.every((r) => html.includes(r.label) && html.includes(`href="${r.to}"`)) && shouldNot.every((r) => !html.includes(r.label) && !html.includes(`href="${r.to}"`)), html);
}
// the stored props (all buttons) never reach the HTML: draw with a visitor's `shown` but the full stored rows
const leaked = renderToStaticMarkup(React.createElement(pageButtonsBlock.Component, { buttons: rows, shown: logic.buttonsFor(rows, { viewer: VISITOR, count: 1, accountLabel: "Account" }) } as never));
check("a visitor's HTML holds none of the other buttons even with every row stored in the props", ALL_LABELS.slice(2).every((l) => !leaked.includes(l)) && ALL_HREFS.slice(2).every((l) => !leaked.includes(l)));
// the second form: an owner-only swap
const swapRows = [{ label: "Join", to: "/join", who: "everyone", look: "pill", width: "full", swapWho: "member", swapLabel: "Your hub", swapTo: "/hub" }];
check("second form: a visitor sees the first, a member the second, never both", (() => { const a = draw(swapRows, VISITOR), b = draw(swapRows, MEMBER); return a.includes("Join") && !a.includes("Your hub") && !a.includes("/hub") && b.includes("Your hub") && !b.includes("Join"); })());
// an editor sees everything, tagged
const edit = draw(rows, GUIDE, true);
check("editor copy: every button, each tagged with who it is for", ALL_LABELS.every((l) => edit.includes(l)) && edit.includes("For owners"));
// unsafe links are dropped
const evil = draw([{ label: "Bad", to: "javascript:alert(1)", who: "everyone" }, { label: "Bad2", to: "//evil.example", who: "everyone" }, { label: "Good", to: "https://example.org/x", who: "everyone" }], VISITOR);
check("javascript: and protocol-relative links are not drawn; https is", !evil.includes("Bad") && evil.includes("Good") && !evil.includes("javascript"));

// ---- 4. phone menu items by audience
const items = [
  { label: "Home", to: "/", who: "everyone" },
  { label: "Hub", to: "/hub", who: "member" },
  { label: "Office", to: "/manage", who: "guide" },
  { label: "Gone", to: "javascript:x", who: "everyone" },
];
const names = (v: any) => menu.itemsFor(items, v).map((i) => i.label).join();
check("menu: visitor Home only; member Home,Hub; guide Home,Hub,Office; bad link dropped", names(VISITOR) === "Home" && names(MEMBER) === "Home,Hub" && names(GUIDE) === "Home,Hub,Office" && names(OWNER) === "Home,Hub,Office");
check("menu: default items are Discover, Tours, Experiences", menu.itemsFor(undefined, VISITOR).map((i) => i.label).join() === "Discover,Tours,Experiences");
check("menu: shows on / /tours /experiences by default; not /places; /tours/* covers children", menu.showsOn(menu.showOnPaths(undefined), "/") && menu.showsOn(menu.showOnPaths([]), "/tours/") && !menu.showsOn(menu.showOnPaths(undefined), "/places") && menu.showsOn(menu.showOnPaths(["/tours/*"]), "/tours/x"));
const nav = renderToStaticMarkup(React.createElement(phoneMenuBlock.Component, { shape: "pill", shown: menu.itemsFor(items, VISITOR) } as never));
check("menu: a visitor's markup has no Hub or Office", !nav.includes("Hub") && !nav.includes("Office") && !nav.includes("/manage"));

// ---- 5. the data side at defaults (public reads; needs the database, read only)
let dbOk = true;
try {
  const pick = await import("../src/lib/puck/mobile-pick");
  const { readMobileDiscover } = await import("../src/lib/puck/mobile-discover");
  const d = await readMobileDiscover();
  const shelf = await pick.shelfFor({}, { mobileDiscover: d });
  check("shelf at defaults = the starred places the page draws", JSON.stringify(shelf.places) === JSON.stringify(d.places));
  const gs = await pick.guidesFor({}, { mobileDiscover: d });
  check("guides at defaults = the guides the page draws", JSON.stringify(gs) === JSON.stringify(d.guides));
  const es = await pick.experiencesFor({}, { mobileDiscover: d });
  check("experiences at defaults = the experiences the page draws", JSON.stringify(es) === JSON.stringify(d.experiences));
  const { listTours } = await import("../src/lib/tours");
  const dated = await listTours();
  const cards = await pick.tourCardsFor({});
  check("tour cards at defaults = the dated tours, up to six, in the site's order", JSON.stringify(cards.map((c: any) => c.tour.id)) === JSON.stringify(dated.slice(0, 6).map((t) => t.id)), `${cards.length} vs ${dated.length}`);
  const allPub = await pick.tourCardsFor({ which: "all", count: 24 });
  check("'All published tours' includes the dated ones and every card is a published public tour", allPub.length >= dated.length && dated.every((t) => allPub.some((c: any) => c.tour.id === t.id)) && allPub.every((c: any) => c.tour.status === "published"));
  const { db } = await import("@elkdonis/db");
  const bad = (await db`SELECT count(*)::int AS n FROM threads WHERE org_id = 'elktours' AND kind = 'tour' AND id = ANY(${allPub.map((c: any) => c.tour.id)}) AND NOT (status = 'published' AND visibility = 'PUBLIC')`) as unknown as { n: number }[];
  check("'All published tours' returned no unpublished or non-public tour", bad[0]!.n === 0);
  const gOnly = await pick.guidesFor({ who: "chosen", people: [] }, { mobileDiscover: d });
  check("guides: 'only those I list' with none listed shows none", gOnly.length === 0);
  if (d.guides[0]) {
    const g0 = d.guides[0];
    const one = await pick.guidesFor({ who: "chosen", people: [{ person: "guide:" + g0.id, blurb: "Short blurb here" }], showTours: false }, { mobileDiscover: d });
    check("guides: chosen guide shows with this block's own blurb, no tours", one.length === 1 && one[0]!.bio === "Short blurb here" && one[0]!.tours.length === 0);
  }
  const noPlace = await pick.chosenPlaces([{ place: "place:00000000-0000-0000-0000-000000000000" }]);
  check("shelf: an unknown or non-public place is never drawn", noPlace.length === 0);
  if (d.places[0]) {
    const p0 = d.places[0];
    const withBadCover = await pick.chosenPlaces([{ place: "place:" + p0.id, cover: "https://evil.example/x.jpg" }]);
    check("shelf: a cover that is not one of the place's own pictures is ignored (the place's own cover shows)", withBadCover.length === 1 && withBadCover[0]!.img === p0.img);
    const photos = await (await import("../src/lib/places-public")).listPlacePhotos(p0.id);
    if (photos[0]) {
      const withCover = await pick.chosenPlaces([{ place: "place:" + p0.id, cover: photos[photos.length - 1]!.url }]);
      check("shelf: a chosen cover (one of the place's own pictures) is used", withCover[0]?.img === photos[photos.length - 1]!.url);
    }
  }
} catch (e) { dbOk = false; check("data checks ran", false, String(e).slice(0, 200)); }
void dbOk;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
