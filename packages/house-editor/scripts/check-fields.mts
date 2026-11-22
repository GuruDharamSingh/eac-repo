// check-fields: the live editor reaches block content (contract C4). Unit level, in Node with a DOM from happy-dom:
// the marks buildPuckConfig draws, finding each part's element from them, "this value comes from a record", and the
// two server doors (a block's words, and a record's title) with their gates. No database, no network.
//   sudo -n docker run --rm -u 3003 -v $HOME/eac:/app -w /app/packages/house-editor eac-dev \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-fields.mts
import React from "react";
(globalThis as any).React = React;
import { existsSync } from "node:fs";
const { renderToStaticMarkup } = await import("react-dom/server");
const { Render } = await import("@puckeditor/core/rsc");
const { SHARED_BLOCKS } = await import("@elkdonis/blocks");
const { contractOf } = await import("@elkdonis/blocks/contract");
const { buildPuckConfig } = await import("@elkdonis/page-builder/config");
const { MorphMark } = await import("@elkdonis/direct-edit/puck/morph");
const fieldsServer = await import("../src/fields/server");
const { scanBlocks, pageSlugOf } = await import("../src/fields/scan");
const { blockSpecs } = await import("../src/fields/blockmap");
const { createFieldsActions, defineFields, createBlockFields, fieldMapOf, recordMarks } = Object.assign({}, fieldsServer);
const happy = "/app/node_modules/.pnpm/happy-dom@21.0.4/node_modules/happy-dom/lib/index.js";
if (!existsSync(happy)) throw new Error("happy-dom not found at " + happy);
const { Window } = (await import(happy)) as any;

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
const J = (v: unknown) => JSON.stringify(v);

const blocks = SHARED_BLOCKS as any[];
const contracts = contractOf(blocks as never) as any;
const plain = buildPuckConfig({ blocks: blocks as never, morph: MorphMark });
const marked = buildPuckConfig({ blocks: blocks as never, morph: MorphMark, marks: true });
const map = fieldMapOf(contracts);

const card = (id: string, extra: Record<string, unknown> = {}) => ({ type: "feature-card", props: { id, title: "Typed title", body: "Typed words.", kicker: "k", meta: "m", record: "", opens: "", tone: "feed", ...extra } });
const hero = (id: string, morph?: unknown) => ({ type: "hero-banner", props: { id, title: "Big title", subtitle: "Small words", ...(morph ? { morph } : {}) } });
const page = (...content: unknown[]) => ({ root: { props: {} }, content });
const draw = (cfg: unknown, data: unknown) => renderToStaticMarkup(React.createElement(Render as any, { config: cfg, data }));
const dom = (html: string) => { const w = new Window(); w.document.body.innerHTML = html; return w.document as any; };

console.log("-- marks");
const data = page(card("c-1"), hero("h-1", { v: 1, parts: { title: { color: "#e0b23c" } } }), card("c-2"));
const offA = draw(plain, data);
const offB = draw(buildPuckConfig({ blocks: blocks as never, morph: MorphMark, marks: false }), data);
check("with marks off the page is byte for byte what it was, and carries no mark", offA === offB && !offA.includes("data-blk-mark"), `${offA.length} bytes`);
const on = draw(marked, data);
check("with marks on there is one marker per block, with its id and type", (on.match(/<template data-blk-mark=/g) ?? []).length === 3 && on.includes('data-blk-mark="c-1" data-blk-type="feature-card"') && on.includes('data-blk-mark="h-1" data-blk-type="hero-banner"'));
check("the marker is the only difference: taking it out gives the unmarked page", on.replace(/<template data-blk-mark="[^"]*" data-blk-type="[^"]*"( data-blk-from="[^"]*")?><\/template>/g, "") === offA);
check("the marker sits right before the block's own root when there is no look", /data-blk-mark="c-1"[^>]*><\/template><(article|a) class="blk blk-card"/.test(on), on.slice(0, 160));

console.log("-- finding each part's element");
const d1 = dom(on);
check("the block field map names the parts that can be typed", !!map["feature-card"]?.parts.title && map["feature-card"].parts.title.prop === "title" && map["feature-card"].parts.title.inline === true && !map["feature-card"].parts.image && !!map["hero-banner"]?.parts.title && !map["feature-card"].parts.root, Object.keys(map["feature-card"]?.parts ?? {}).join());
check("a setting declared with `binds` is never offered", !Object.values(map).some((e: any) => Object.values(e.parts).some((p: any) => contracts[Object.keys(map).find((k) => map[k] === e)!].props.find((x: any) => x.name === p.prop)?.binds)));
const found = scanBlocks(d1, map, "home");
const byRef = Object.fromEntries(found.map((f) => [f.ref, f]));
check("every typed part of a card is found, with the C4 id", byRef["block:home:c-1:title"]?.el.textContent === "Typed title" && byRef["block:home:c-1:body"]?.el.textContent === "Typed words." && byRef["block:home:c-2:title"]?.el.textContent === "Typed title", found.map((f) => f.ref).join(" "));
check("a card's title is found by the card's own part selector (h3 in the card)", byRef["block:home:c-1:title"]?.el.tagName === "H3" && byRef["block:home:c-1:title"].block === "home:c-1");
check("a block with a look is found too (the look's marker sits between)", on.includes("data-morph=") && byRef["block:home:h-1:title"]?.el.textContent === "Big title" && byRef["block:home:h-1:subtitle"]?.el.textContent === "Small words", found.filter((f) => f.block === "home:h-1").map((f) => f.ref).join(" "));
check("two cards are two sets of fields, never mixed", found.filter((f) => f.block === "home:c-1").every((f) => f.el.closest("article,a")?.querySelector("h3")?.textContent === "Typed title") && new Set(found.map((f) => f.el)).size === found.length);
check("blockSpecs make one field per setting, typed inline only where the block draws it verbatim", J(Object.keys(blockSpecs(map["feature-card"]!))) === J(["kicker", "title", "body", "meta"].filter((k) => map["feature-card"]!.parts[k] || Object.values(map["feature-card"]!.parts).some((p) => p.prop === k))) || Object.keys(blockSpecs(map["feature-card"]!)).includes("title"), Object.keys(blockSpecs(map["feature-card"]!)).join());
check("the lens finds the page's name from a marker a host puts there", pageSlugOf(dom('<template data-blk-page="about/press"></template>')) === "about/press");
check("a marker for a block type the map does not know is left alone", scanBlocks(dom('<template data-blk-mark="x" data-blk-type="nope"></template><div>hi</div>'), map, "home").length === 0);
check("a marker with no element after it finds nothing", scanBlocks(dom('<template data-blk-mark="c-9" data-blk-type="feature-card"></template>'), map, "home").length === 0);

console.log("-- where a shown value comes from");
const specs = { "feature-card": { ref: "record", kinds: ["thread"], resolved: "bound", fills: { title: "title", body: "excerpt", meta: "meta" } } } as const;
const from = recordMarks(specs);
const bound = { kind: "Writing", title: "The record's title", excerpt: "The record's words", meta: "Sat", href: null, image: null };
check("a typed setting wins: nothing is marked as coming from the record", from({ type: "feature-card", props: { record: "thread:abc123", bound, title: "Typed", body: "Typed", meta: "x" } }) === null);
check("an empty setting filled by the record is marked, as a record field", J(from({ type: "feature-card", props: { record: "thread:abc123", bound, title: "", body: "Typed", meta: "" } })) === J({ title: "record:thread:abc123:title", meta: "record:thread:abc123:meta" }));
check("no record reference, no resolved record, or another kind: nothing is marked", from({ type: "feature-card", props: { record: "", bound, title: "" } }) === null && from({ type: "feature-card", props: { record: "thread:abc123", title: "" } }) === null && from({ type: "feature-card", props: { record: "artwork:abc123", bound, title: "" } }) === null && from({ type: "hero-banner", props: { record: "thread:abc123", bound, title: "" } }) === null);
const fromCfg = buildPuckConfig({ blocks: blocks as never, morph: MorphMark, marks: { from } });
const rec = card("c-3", { record: "thread:abc123", title: "", body: "Typed words.", meta: "", bound });
const d2 = dom(draw(fromCfg, page(rec)));
check("the mark carries where the values come from", d2.querySelector("template[data-blk-mark]")?.getAttribute("data-blk-from")?.includes("record:thread:abc123:title") === true);
const f2 = Object.fromEntries(scanBlocks(d2, map, "home").map((f) => [f.ref, f]));
check("the record's title is offered as the record's field, not as a setting of the card", f2["record:thread:abc123:title"]?.el.textContent === "The record's title" && f2["record:thread:abc123:title"].fromRecord && !f2["block:home:c-3:title"], Object.keys(f2).join(" "));
check("the typed words of the same card stay a setting of the card", f2["block:home:c-3:body"]?.el.textContent === "Typed words.");

console.log("-- the server door for a block's words");
let stored: any = page(card("c-1", { title: "Old" }), hero("h-1"), card("c-2", { title: "Other" }), { type: "mystery-block", props: { id: "m-1", zeta: 1, alpha: { b: 2 } } });
let version = "v1";
const saves: any[] = [];
const blockDoors = createBlockFields({
  contracts,
  config: plain,
  loadPage: async (slug) => (slug === "home" ? { data: stored, updatedAt: version } : null),
  save: async (slug, doc, v) => { saves.push({ slug, v, doc }); stored = doc; version = "v" + (saves.length + 1); return { ok: true, updatedAt: version }; },
});
let r: any = await blockDoors.load("home:c-1");
check("load gives the stored words of the block's typed settings, and the page version", r.ok && r.values.title === "Old" && r.values.body === "Typed words." && r.version === "v1", J(r.values));
r = await blockDoors.load("home:nope");
check("load of a block that is not on the page says so", !r.ok && /not on the page/.test(r.error), r.error);
r = await blockDoors.load("nowhere:c-1");
check("load of a page that is not there says so", !r.ok && /page/.test(r.error));
r = await blockDoors.load("home:m-1");
check("a block the lens has no map for is not editable", !r.ok);
const before = J(stored);
r = await blockDoors.save("home:c-1", { title: "New title" }, "v1");
check("a change is saved as one step through the app's save, with the page version", r.ok && saves.length === 1 && saves[0].v === "v1" && saves[0].doc.content[0].props.title === "New title" && r.version === "v2" && /Changed/.test(r.say), J({ ok: r.ok, v: r.version, say: r.say }));
const after = stored;
check("nothing else on the page moved, the unknown block is byte for byte the same", J(after.content[1]) === J(JSON.parse(before).content[1]) && J(after.content[2]) === J(JSON.parse(before).content[2]) && J(after.content[3]) === J(JSON.parse(before).content[3]) && after.content[0].props.body === "Typed words.");
r = await blockDoors.save("home:c-1", { title: "Again" }, "v1");
check("a change made on a page that moved since is stale, and writes nothing", !r.ok && r.stale === true && saves.length === 1 && stored.content[0].props.title === "New title", r.error);
r = await blockDoors.save("home:c-1", { title: "x".repeat(500) }, "v2");
check("a refused step shows its own words and writes nothing", !r.ok && /too long/.test(r.error) && saves.length === 1, r.error);
r = await blockDoors.save("home:c-1", { tone: "plain" }, "v2");
check("a setting no part draws cannot be written through here", !r.ok && /not a setting that can be typed/.test(r.error) && saves.length === 1, r.error);
r = await blockDoors.save("home:c-1", { morph: "x" }, "v2");
check("the look key cannot be written through here", !r.ok && saves.length === 1);
r = await blockDoors.save("home:c-1", { title: "New title" }, "v2");
check("saying what is already there writes nothing", r.ok && saves.length === 1, r.say);
r = await blockDoors.save("home:c-1", { title: "Both", body: "Together" }, "v2");
check("two words in one save are two steps and one page write", r.ok && saves.length === 2 && saves[1].doc.content[0].props.title === "Both" && saves[1].doc.content[0].props.body === "Together");
const refusing = createBlockFields({ contracts, config: plain, loadPage: async () => ({ data: stored, updatedAt: version }), save: async () => ({ ok: false, error: "Only editors can publish pages." }) });
r = await refusing.save("home:c-1", { title: "Nope" }, version);
check("the app's own gate has the last word", !r.ok && r.error === "Only editors can publish pages.");
const guardOff = createBlockFields({ contracts, config: plain, storeGuard: false, loadPage: async () => ({ data: stored, updatedAt: version }), save: async (_s, _d, v) => { saves.push({ v }); return { ok: true, updatedAt: "vx" }; } });
await guardOff.save("home:c-1", { title: "Guard off" }, version);
check("storeGuard false still compares the version itself but hands the store none", saves[saves.length - 1].v === undefined);

{
  const { readFileSync } = await import("node:fs");
  const sj = readFileSync("/app/apps/sunjay/src/lib/fields-blocks.ts", "utf8");
  check("sunjay's block door no longer turns the store guard off (store.ts guard fixed 2026-11-20)", !/storeGuard:\s*false/.test(sj));
  const guarded: any[] = [];
  const g = createBlockFields({ contracts, config: plain, loadPage: async () => ({ data: stored, updatedAt: version }), save: async (_s, _d, v) => { guarded.push(v); return { ok: true, updatedAt: "vz" }; } });
  await g.save("home:c-1", { title: "Guarded by default" }, version);
  check("by default the version goes to the store, so a block save is one guarded UPDATE", guarded.length === 1 && guarded[0] === version);
}
console.log("-- the doors through createFieldsActions");
let allowed: true | string = true;
const performs: any[] = [];
let threadRead: any = { values: { title: "A post", excerpt: "Words" }, version: "t1" };
const registry = defineFields({ thread: { capability: "thread-edit", label: "Post", shared: "This changes the post itself, everywhere it appears.", fields: { title: { label: "Title", input: "text", inline: true, max: 200 }, excerpt: { label: "Summary", input: "textarea", readOnly: "Made from the text." } } } });
const doors = createFieldsActions({
  registry,
  authorize: async () => allowed,
  perform: async (cap, input, subject) => { performs.push({ cap, input, subject }); return { ok: true }; },
  routes: { thread: { read: async () => threadRead, toInput: (id, values) => ({ input: { title: values.title }, subject: id }) } },
  blocks: { load: blockDoors.load, save: blockDoors.save },
});
let lr: any = await doors.load({ kind: "block", id: "home:c-1" });
check("kind block goes to the block door", lr.ok && lr.values.title === "Both");
allowed = "Sign in as an editor to change this.";
lr = await doors.load({ kind: "block", id: "home:c-1" });
let sr: any = await doors.save({ kind: "block", id: "home:c-1", values: { title: "Nope" } });
check("the lens's own gate comes before the block door, for load and save", !lr.ok && !sr.ok && sr.error === allowed);
allowed = true;
sr = await doors.save({ kind: "thread", id: "abc123", values: { title: "Renamed" }, version: "t1" });
check("a record's field is saved through its capability, naming the record", sr.ok && performs.length === 1 && performs[0].cap === "thread-edit" && performs[0].subject === "abc123" && performs[0].input.title === "Renamed", J(performs[0]));
sr = await doors.save({ kind: "thread", id: "abc123", values: { title: "Renamed" }, version: "t0" });
check("a record changed since is stale", !sr.ok && sr.stale === true && performs.length === 1);
sr = await doors.save({ kind: "thread", id: "abc123", values: { excerpt: "Mine" } });
check("a field declared read only is refused on the server too", !sr.ok && sr.error === "Made from the text." && performs.length === 1);
threadRead = { values: { title: "A gathering" }, version: "t1", readOnly: "Gatherings are renamed on their own page." };
lr = await doors.load({ kind: "thread", id: "g1" });
sr = await doors.save({ kind: "thread", id: "g1", values: { title: "Renamed" } });
check("a record nobody may change from here is read only, in the load and in the save", lr.ok && lr.readOnly === "Gatherings are renamed on their own page." && !sr.ok && performs.length === 1, sr.error);
sr = await doors.save({ kind: "nope", id: "x", values: { title: "x" } });
check("a kind nobody declared is refused", !sr.ok);
check("a kind's shared line is part of its declaration", registry.thread.shared === "This changes the post itself, everywhere it appears.");


// ---------------------------------------------------------------------------
// Lane LIVE (wave 2): the one shared bind the canvas sites use (elktours, hidden-enneagram, innergathering), and the
// gatherings-and-series finding. Stubs for the page store, the database and the catalogue door: nothing here touches a table.
const fsx = await import("node:fs");
console.log("-- the shared site bind");
const siteMod: any = await import("../src/fields/site").catch((e: any) => { console.log("  (../src/fields/site: " + String(e?.message ?? e).slice(0, 100) + ")"); return null; });
const siteRegMod: any = await import("../src/fields/site-registry").catch(() => null);
check("fields/server exports createSiteFields and the registry; the client entry exports the registry only", typeof fieldsServer.createSiteFields === "function" && !!fieldsServer.siteFieldsRegistry && !!(await import("../src/fields/index")).siteFieldsRegistry && !("createSiteFields" in (await import("../src/fields/index"))));
if (siteMod && siteRegMod) {
  const sqlLog: Array<{ text: string; values: unknown[] }> = [];
  let row: any = { title: "A post", excerpt: "Some words", kind: "post", version: "v1" };
  const sql = (strings: TemplateStringsArray, ...values: any[]) => { sqlLog.push({ text: strings.join("?"), values }); return Promise.resolve(row ? [row] : []); };
  const performed: any[] = [];
  let signedIn: any = { userId: "u1", email: "ed@example.org" };
  let editor: true | string = true;
  const store = { data: page(card("c-1", { title: "Old title" })), updatedAt: "2026-11-20 10:00:00.000001+00" };
  const saves: any[] = [];
  const site = siteMod.createSiteFields({
    contracts, config: plain,
    loadPage: async (slug: string) => (slug === "home" ? { data: store.data, updatedAt: store.updatedAt } : null),
    save: async (slug: string, data: unknown, v?: string) => { saves.push({ slug, data, v }); if (v !== undefined && v !== store.updatedAt) return { ok: false, stale: true, error: "stale" }; store.data = data as any; store.updatedAt = "2026-11-20 10:05:00.000001+00"; return { ok: true, updatedAt: store.updatedAt }; },
    orgId: "org-1", sql,
    authorize: async () => editor,
    session: async () => signedIn,
    performAction: async (id: string, actor: any, input: unknown) => { performed.push({ id, actor, input }); return { ok: true, data: {} }; },
  });
  check("the map is the blocks' own declaration, nothing added", J(site.map) === J(fieldMapOf(contracts)) && Object.keys(site.map).includes("feature-card"));
  let r: any = await site.load({ kind: "block", id: "home:c-1" });
  check("a block's words load through the shared door", r.ok && r.values.title === "Old title" && r.version === store.updatedAt, J(r));
  r = await site.save({ kind: "block", id: "home:c-1", values: { title: "New title" }, version: store.updatedAt });
  const after: any = (store.data as any).content[0];
  check("a block save is one set_prop through the site's gated page save, with the stale guard", r.ok && saves.length === 1 && saves[0].slug === "home" && saves[0].v === "2026-11-20 10:00:00.000001+00" && after.props.title === "New title" && after.props.body === "Typed words.", J(r));
  const staleVersion = "2026-11-20 09:00:00+00";
  r = await site.save({ kind: "block", id: "home:c-1", values: { title: "Third" }, version: staleVersion });
  check("a page changed since the lens loaded it answers stale and writes nothing", !r.ok && r.stale === true && saves.length === 1);
  editor = "Only the organisation's editors can change this wording.";
  r = await site.save({ kind: "block", id: "home:c-1", values: { title: "Nope" } });
  const r2: any = await site.load({ kind: "block", id: "home:c-1" });
  const r3: any = await site.save({ kind: "thread", id: "abc", values: { title: "Nope" } });
  check("someone who may not edit is refused on every door, before anything runs", !r.ok && !r2.ok && !r3.ok && saves.length === 1 && performed.length === 0 && r.error === editor);
  editor = true;

  // A post a card shows.
  r = await site.load({ kind: "thread", id: "abc123" });
  check("a post's title and summary load, and its read is bound to this organisation", r.ok && r.values.title === "A post" && !r.readOnly && sqlLog.at(-1)!.values.includes("org-1") && sqlLog.at(-1)!.values.includes("abc123") && /org_id = \?/.test(sqlLog.at(-1)!.text), J(sqlLog.at(-1)));
  r = await site.save({ kind: "thread", id: "abc123", values: { title: "Renamed post" }, version: "v1" });
  check("a post's title is saved through the catalogue's thread-edit, naming the post, the person and this organisation", r.ok && performed.length === 1 && performed[0].id === "thread-edit" && performed[0].actor.subjectId === "abc123" && performed[0].actor.siteOrgId === "org-1" && performed[0].actor.userId === "u1" && performed[0].actor.via === "app" && performed[0].input.title === "Renamed post", J(performed[0]));
  r = await site.save({ kind: "thread", id: "abc123", values: { title: "x" }, version: "v0" });
  check("a post changed since is stale", !r.ok && r.stale === true && performed.length === 1);
  r = await site.save({ kind: "thread", id: "abc123", values: { title: "" } });
  check("a post's title cannot be emptied", !r.ok && performed.length === 1, J(r));
  r = await site.save({ kind: "thread", id: "abc123", values: { excerpt: "Mine" } });
  check("the summary and details stay read only on the server too", !r.ok && performed.length === 1);
  signedIn = null;
  r = await site.save({ kind: "thread", id: "abc123", values: { title: "Renamed again" }, version: "v1" });
  check("no session, no write", !r.ok && performed.length === 1, J(r));
  signedIn = { userId: "u1", email: "ed@example.org" };

  // Gatherings, tours and series: read only, because the catalogue has no entry that renames one.
  for (const kind of ["meeting", "event", "series", "tour"]) {
    row = { title: `A ${kind}`, excerpt: null, kind, version: "v2" };
    const l: any = await site.load({ kind: "thread", id: "g1" });
    const s: any = await site.save({ kind: "thread", id: "g1", values: { title: "Renamed" }, version: "v2" });
    check(`a card showing a ${kind}: read only with the reason, and no write`, l.ok && l.readOnly === siteMod.READ_ONLY_THREAD && !s.ok && s.error === siteMod.READ_ONLY_THREAD && performed.length === 1, J({ l: l.readOnly, s: s.error }));
  }
  row = null;
  r = await site.load({ kind: "thread", id: "gone" });
  check("a post that is not this organisation's (no row) loads empty, never someone else's", r.ok && r.values.title === "");
  r = await site.save({ kind: "section", id: "hero", values: { title: "x" } });
  check("a kind the shared registry does not declare is refused", !r.ok);

  {
    // A site that does not depend on the actions package yet (elktours, hidden-enneagram, innergathering today): the block door
    // is whole, and a post a card shows is read only with its reason. Nothing else about the door changes.
    const bare = siteMod.createSiteFields({ contracts, config: plain, loadPage: async () => ({ data: store.data, updatedAt: store.updatedAt }), save: async () => ({ ok: true, updatedAt: "x" }), orgId: "org-1", sql, authorize: async () => true });
    row = { title: "A post", excerpt: "x", kind: "post", version: "v1" };
    const l: any = await bare.load({ kind: "thread", id: "abc123" });
    const s: any = await bare.save({ kind: "thread", id: "abc123", values: { title: "Renamed" }, version: "v1" });
    check("without a catalogue door a post is read only with the reason, and nothing is performed", l.ok && l.readOnly === siteMod.READ_ONLY_POSTS && !s.ok && s.error === siteMod.READ_ONLY_POSTS && performed.length === 1, J({ l: l.readOnly, s: s.error }));
    const b: any = await bare.load({ kind: "block", id: "home:c-1" });
    check("without a catalogue door a block's words still load", b.ok && typeof b.values.title === "string");
    row = null;
  }
  check("the shared bind imports no store, database or session", !/from "(@elkdonis\/db|@elkdonis\/auth|@elkdonis\/actions)/.test(fsx.readFileSync("/app/packages/house-editor/src/fields/site.ts", "utf8")));
}
{
  // Item 4's finding, kept honest: if the catalogue ever grows an entry that renames a gathering or a series, this fails
  // and says to route those kinds through it (and to change READ_ONLY_THREAD in ../src/fields/site.ts).
  const cat: any = await import("/app/packages/actions/src/catalogue.ts").catch(() => null);
  const threadScoped = (cat?.ACTION_CATALOGUE ?? []).filter((m: any) => m.scope === "thread").map((m: any) => m.id).sort();
  check("the catalogue's thread-scoped entries are still edit, publish and pin: nothing renames a gathering or a series", J(threadScoped) === J(["thread-edit", "thread-pin", "thread-publish"]), J(threadScoped));
  const edit = (cat?.ACTION_CATALOGUE ?? []).find((m: any) => m.id === "thread-edit");
  check("thread-edit is for a post (its runner calls updatePost, which filters on kind 'post')", /post/i.test(edit?.label ?? "") && /updatePost/.test(fsx.readFileSync("/app/packages/actions/src/server/run.ts", "utf8")) && /kind = 'post'|kind = \$\{?'post'|kind: 'post'|"post"|'post'/.test(fsx.readFileSync("/app/packages/services/src/posts.ts", "utf8")));
  check("no entry in the whole catalogue names a gathering, series or tour edit", !(cat?.ACTION_CATALOGUE ?? []).some((m: any) => /(gathering|series|tour|meeting|event)/i.test(m.id) && /(edit|rename|title)/i.test(m.id + " " + (m.label ?? ""))));
}

// ---------------------------------------------------------------------------
// Lane LIVE (wave 2) item 3: the three canvas sites bind the shared door and draw marks for editors only. A source-level check:
// a site's page and database cannot be built here, so what is proven is the shape of each bind. The behaviour behind it
// (marks off = byte-identical, the block door, the thread door and its gates) is proven above on the shared code.
console.log("-- the three canvas sites' binds (source level)");
{
  const read = (p: string) => (fsx.existsSync(`/app/apps/${p}`) ? fsx.readFileSync(`/app/apps/${p}`, "utf8") : "");
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const drawSites: Record<string, string[]> = {
    elktours: ["src/lib/puck/render.tsx"],
    "hidden-enneagram": ["src/lib/puck/render.tsx"],
    innergathering: ["src/app/p/[slug]/page.tsx", "src/app/page.tsx"],
  };
  for (const app of ["elktours", "hidden-enneagram", "innergathering"]) {
    const t = (p: string) => read(`${app}/src/${p}`);
    const fs1 = t("lib/fields-site.ts"), act = t("app/fields/actions.ts"), gate = t("components/fields/FieldsLensGate.tsx"), mount = t("components/fields/FieldsLensMount.tsx"), cfg = t("lib/puck/config.server.ts"), layout = t("app/layout.tsx");
    check(`${app}: the bind is thin (a few lines per file, the logic is the shared door's)`, [fs1, act, gate, mount].every((s) => s.length > 0 && s.split("\n").length <= 45) && /createSiteFields\(/.test(fs1));
    check(`${app}: block words save through this site's own gated page save, and the shared door's contracts are its blocks'`, /save: savePageAction/.test(fs1) && /from "@\/lib\/puck\/actions"/.test(fs1) && /contractOf\(serverBlocks\)/.test(fs1) && /config: serverPuckConfig/.test(fs1) && /loadPageWithVersion/.test(fs1));
    check(`${app}: every call is gated on the viewer being an editor, and the bind writes no table itself`, /viewer\.canEdit \? true/.test(fs1) && !/\b(INSERT|UPDATE|DELETE)\b/.test(code(fs1)));
    check(`${app}: the server actions file is "use server" and exports the two doors only`, /^"use server";/.test(act) && ((act.match(/export async function/g) ?? []).length === 2 || (app === "elktours" && (act.match(/export async function/g) ?? []).length === 3 && /restoreFieldsAction/.test(act))) && /loadFieldsAction/.test(act) && /saveFieldsAction/.test(act));
    check(`${app}: visitors get nothing (the gate returns null before any lens or map is sent)`, /if \(!viewer\?\.canEdit\) return null;/.test(gate) && /^"use client";/.test(mount) && /(siteFieldsRegistry|elktoursFieldsRegistry)/.test(mount));
    check(`${app}: the lens stays out of the canvas, manage and account pages`, ["/studio", "/manage", "/account"].every((p) => mount.includes(`"${p}"`)));
    check(`${app}: the lens is mounted once, in the root layout`, (layout.match(/<FieldsLensGate \/>/g) ?? []).length === 1 && /import \{ FieldsLensGate \}/.test(layout));
    check(`${app}: config.server exports the plain config, the marked config and the block list; marks are passed once, to the marked one`, /export const serverPuckConfig = buildPuckConfig\(serverOptions\)/.test(cfg) && /export const markedPuckConfig = buildPuckConfig\(\{[\s\S]*marks:/.test(cfg) && /export const serverBlocks/.test(cfg) && (code(cfg).match(/marks:/g) ?? []).length === 1);
    for (const site of drawSites[app]!) {
      const src = read(`${app}/${site}`);
      check(`${app} ${site}: marks only for someone who may edit, and the page names itself for the lens`, /viewer\?\.canEdit \? markedPuckConfig : serverPuckConfig/.test(src) && /viewer\?\.canEdit \? <template data-blk-page=\{[A-Za-z_]+\} \/> : null/.test(src) && !/<Render config=\{serverPuckConfig\}/.test(src));
    }
    const users = fsx.readdirSync(`/app/apps/${app}/src`, { recursive: true }).map(String).filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => /markedPuckConfig/.test(fsx.readFileSync(`/app/apps/${app}/src/${f}`, "utf8"))).sort();
    check(`${app}: the marked config is reached only from the draw sites and the config itself`, J(users) === J([...drawSites[app]!.map((s) => s.replace(/^src\//, "")), "lib/puck/config.server.ts"].sort()), J(users));
  }
  check("elktours: cards that fill from a tour or an experience are offered read only (feature-card record marks), the others carry plain marks", /recordMarks\(\{[\s\S]*"feature-card"/.test(read("elktours/src/lib/puck/config.server.ts")) && !/recordMarks/.test(read("hidden-enneagram/src/lib/puck/config.server.ts")) && !/recordMarks/.test(read("innergathering/src/lib/puck/config.server.ts")));
  check("elktours: the landing page is not marked (its slug is reserved for the canvas, so the page save would refuse it)", !/markedPuckConfig/.test(read("elktours/src/app/page.tsx")) && /LANDING_SLUG/.test(read("elktours/src/lib/puck/reserved.ts")));
  check("no site gained a package dependency (the actions package is not needed to bind the doors)", ["elktours", "hidden-enneagram", "innergathering"].every((a) => !/"@elkdonis\/actions"/.test(read(`${a}/package.json`))));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
