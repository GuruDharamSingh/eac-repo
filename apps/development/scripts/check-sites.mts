// Check for the Sites door (lane MACHINES, 2026-11-20): prints "N passed, M failed", exits non-zero on failure.
// No database, no browser. Run in a one-off container from apps/development:
//   tsx scripts/check-sites.mts
// It proves: every function of the door calls the admin gate first; the page helpers keep every block
// (placeholders for what cannot load); the one door accepts a words step on a checkable block, refuses the
// rest in plain words, and passes a block it does not know through byte for byte.
import React from "react";
(globalThis as unknown as { React: unknown }).React = React;
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let passes = 0;
let failures = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${!ok && extra !== undefined ? ` :: ${JSON.stringify(extra).slice(0, 300)}` : ""}`);
};
const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

// ---- the gate: every exported function of the door starts with adminOrThrow()
for (const [file, names] of [
  ["../src/lib/sites-actions.ts", ["saveSiteDraft", "publishSiteDraft", "discardSiteDraft"]],
  ["../src/lib/sites.ts", ["listSites", "loadSitePage"]],
] as const) {
  const text = src(file);
  for (const name of names) {
    const m = new RegExp(`export async function ${name}\\([^)]*\\)[^{]*\\{\\s*(?:const admin = )?await adminOrThrow\\(\\);`).exec(text);
    check(`${name} calls the admin gate as its first statement`, !!m);
  }
}
const actions = src("../src/lib/sites-actions.ts");
check("sites-actions.ts is a server-action module", actions.startsWith('"use server"'));
check("sites-actions.ts exports only async functions and types", !/export (const|let|var|class|function) /.test(actions) && !/export default/.test(actions));
for (const page of ["../src/app/sites/page.tsx", "../src/app/sites/[org]/[...slug]/page.tsx"]) {
  check(`${page.replace("../src/app/", "")} calls requireNetworkAdmin`, /await requireNetworkAdmin\(/.test(src(page)));
}
check("sites.ts says why it may read across organisations", /READING ACROSS ORGANISATIONS IS ALLOWED HERE ONLY/.test(src("../src/lib/sites.ts")));
check("a draft never keeps the admin's address (author label names the door)", !/author: \{[^}]*email/.test(actions) && /label: "Network admin/.test(actions));
check("Publish is refused for a page with blocks this app cannot check", /unknownTypesOn\(draft\.data\)/.test(actions));

// ---- page helpers
const { listBlocks, forDrawing } = await import("../src/lib/sites-doc");
const doc = {
  root: { props: { title: "T" } },
  content: [
    { type: "hero-banner", props: { id: "h1", title: "Hello" } },
    { type: "made-up-band", props: { id: "b1", heading: "Own block", look: { x: 1 } } },
    { type: "box", props: { id: "bx", items: [{ type: "words", props: { id: "w1", html: "Hi" } }, { type: "mystery", props: { id: "m1" } }] } },
  ],
};
const before = JSON.stringify(doc);
const listed = listBlocks(doc);
check("listBlocks finds every block, nested ones too, in page order", listed.map((l) => l.id).join(",") === "h1,b1,bx,w1,m1", listed.map((l) => l.id));
check("listBlocks gives the path and depth", listed[3]?.path === "content[2].items[0]" && listed[3]?.depth === 1);
const known = new Set(["hero-banner", "box", "words", "st-missing"]);
const drawn = forDrawing(doc, (t) => known.has(t), (t) => (t === "hero-banner" ? { rows: [1] } : null));
const flat = JSON.stringify(drawn);
check("forDrawing turns a block it cannot load into a labelled placeholder, keeping its place", drawn.content[1]?.type === "st-missing" && drawn.content[1]?.props.was === "made-up-band" && (drawn.content[2]!.props.items as any[])[1].type === "st-missing");
check("forDrawing keeps the blocks it can draw, with their settings", drawn.content[0]?.props.title === "Hello" && drawn.content[0]?.props.rows?.[0] === 1);
check("forDrawing never touches the stored document", JSON.stringify(doc) === before && !flat.includes("heading"));

// ---- the one door, against the real shared contracts
const { checkable, typesOnPage, unknownTypesOn } = await import("../src/lib/sites-contracts");
const { applySteps, applyStep } = await import("../src/lib/sites-door");
const { contracts } = checkable();
check("the door can check the shared blocks and the box blocks", !!contracts["hero-banner"] && !!contracts["feature-card"] && !!contracts["box"] && !!contracts["words"], Object.keys(contracts).length);
check("typesOnPage walks into slots", typesOnPage(doc).join(",") === "hero-banner,made-up-band,box,words,mystery", typesOnPage(doc));
check("unknownTypesOn names what the door cannot check", unknownTypesOn(doc).join(",") === "made-up-band,mystery");
check("a page of checkable blocks only has none unknown", unknownTypesOn({ content: [doc.content[0]] }).length === 0);

const ctx = { contracts, allowUnknownTypes: true };
const ok = applyStep(doc as any, { op: "set_prop", block: "h1", prop: "title", value: "Hello again" }, ctx);
check("a words step on a checkable block is accepted", ok.ok && ok.side === "words" && (ok.doc.content[0]!.props as any).title === "Hello again", ok);
check("the blocks the step was not aimed at are byte-identical, the unknown one too", JSON.stringify(ok.doc.content.slice(1)) === JSON.stringify(doc.content.slice(1)));
const onUnknown = applyStep(doc as any, { op: "set_prop", block: "b1", prop: "heading", value: "x" }, ctx);
check("a step aimed at a block the door cannot check is refused, in words", !onUnknown.ok && onUnknown.code === "unknown_type" && onUnknown.say.length > 10, onUnknown);
const lookViaWords = applyStep(doc as any, { op: "set_prop", block: "h1", prop: "morph", value: { v: 1, parts: {} } }, ctx);
check("the look cannot be written through the words door", !lookViaWords.ok, lookViaWords);
const badPart = applyStep(doc as any, { op: "set_look", block: "h1", part: "sidebar", look: { fill: "#c00" } }, ctx);
check("a part the block does not declare is refused", !badPart.ok && badPart.code === "unknown_part", badPart);
const structure = applyStep(doc as any, { op: "remove", block: "h1" }, ctx);
check("structure steps are refused here (no block list is given), in words", !structure.ok && structure.code === "no_config" && structure.say.length > 10, structure);
const many = applySteps(doc as any, [{ op: "set_prop", block: "h1", prop: "title", value: "A" }, { op: "set_prop", block: "nope", prop: "title", value: "B" }], ctx);
check("a list of steps stops whole at the first refusal and hands back the original page", !many.ok && many.doc === (doc as any) && many.results.length === 2);
const look = applyStep(doc as any, { op: "set_look", block: "h1", part: "title", look: { color: "#1f4e79" } }, ctx);
check("a look step on a declared part is accepted and writes only the look", look.ok && look.side === "look" && JSON.stringify({ ...(look.doc.content[0]!.props as any), morph: undefined }) === JSON.stringify({ ...(doc.content[0]!.props as any), morph: undefined }), look);

// ============================================================================
// Wave 2 (lane DEV): contracts for every block, structure steps, the development org's own pages.
// ============================================================================
import type { PageDoc, BlockContractLike } from "../src/lib/sites-door";
const { contractOf } = await import("@elkdonis/blocks/contract");
const { manifest } = await import("../../../packages/mcp/src/manifest/index");
const { manifestContracts, contractFromManifest } = await import("../src/lib/sites-manifest");
const { stepConfigOf } = await import("../src/lib/sites-config");
const { hasLegacyZones } = await import("../src/lib/sites-contracts");
const site = checkable();
const mf = manifest().file.blocks;

// ---- 1. contracts for EVERY block, from the manifest
check("the door can check every block in the manifest", mf.length >= 184 && mf.every((b) => !!site.contracts[b.id]), { manifest: mf.length, contracts: Object.keys(site.contracts).length });
const fromManifest = manifestContracts();
check("manifestContracts has one contract per manifest block, with its label", Object.keys(fromManifest).length === mf.length && mf.every((b) => fromManifest[b.id]?.label === b.label));
{
  const bad: string[] = [];
  for (const b of mf) {
    const c = fromManifest[b.id]!;
    if (c.props.map((p) => p.name).join() !== b.settings.map((s) => s.name).join()) bad.push(`${b.id}: settings`);
    if (Object.keys(c.parts ?? {}).join() !== b.parts.map((p) => p.name).join()) bad.push(`${b.id}: parts`);
    if (c.tokens.map((t) => t.name).join() !== b.tokens.join()) bad.push(`${b.id}: tokens`);
  }
  check("every contract carries its block's settings, part names and token names, in order", bad.length === 0, bad.slice(0, 5));
}
{
  // Where the app can load the real declaration, the manifest-built contract agrees with it on what the door checks.
  const real = site.blocks.map((b) => b.def.id);
  const bad: string[] = [];
  const realContracts = contractOf(site.blocks as never) as unknown as Record<string, BlockContractLike>;
  for (const id of real) {
    const m = fromManifest[id];
    const r = realContracts[id];
    if (!m || !r) continue;
    for (const p of r.props) {
      const q = m.props.find((x) => x.name === p.name);
      if (!q || q.kind !== p.kind) bad.push(`${id}.${p.name}: kind`);
      // The manifest may lack a select's options (a static scan cannot always read them): then the real declaration supplies them (checked below). Where it has them they must agree.
      if (p.kind === "select" && q?.options?.length && (p.options ?? []).map((o) => o.value).join() !== q.options.map((o) => o.value).join()) bad.push(`${id}.${p.name}: options`);
      if ((p.min ?? null) !== (q?.min ?? null) || (p.max ?? null) !== (q?.max ?? null)) bad.push(`${id}.${p.name}: limits`);
      if ((p.binds ?? null) !== (q?.binds ?? null)) bad.push(`${id}.${p.name}: binds`);
    }
    for (const [n, part] of Object.entries(r.parts ?? {})) if ((m.parts?.[n]?.prop ?? null) !== ((part as { prop?: string }).prop ?? null)) bad.push(`${id}.${n}: part setting`);
  }
  check(`the manifest-built contract agrees with the real one on kinds, options, limits, binds and part settings (${real.length} shared blocks)`, bad.length === 0 && real.length > 40, bad.slice(0, 6));
}
{
  const real = contractOf(site.blocks as never) as unknown as Record<string, BlockContractLike>;
  const lost = Object.entries(real).flatMap(([id, c]) => c.props.filter((p) => p.kind === "select" && p.options?.length && (site.contracts[id]?.props.find((q) => q.name === p.name)?.options ?? []).map((o) => o.value).join() !== p.options.map((o) => o.value).join()).map((p) => `${id}.${p.name}`));
  check("where the app can import a block, its real options, tokens and part selectors are in the contract the door uses", lost.length === 0 && site.contracts["box"]!.props.find((p) => p.name === "tag")!.options!.length > 1, lost.slice(0, 5));
}
const appLocal = mf.filter((b) => b.owner.startsWith("app:"));
const withText = appLocal.find((b) => b.settings.some((s) => s.fieldable && !s.binds));
check("the manifest has app-local blocks with a typeable setting (the case this lane unblocks)", !!withText, appLocal.length);
{
  const s = withText!.settings.find((x) => x.fieldable && !x.binds)!;
  const page = { root: { props: {} }, content: [{ type: withText!.id, props: { id: "L1", [s.name]: "old" } }, { type: "words", props: { id: "w", html: "x" } }] } as unknown as PageDoc;
  const r = applyStep(page, { op: "set_prop", block: "L1", prop: s.name, value: "new words" }, { contracts: site.contracts });
  check(`a words step on an app-local block (${withText!.id}.${s.name}) is accepted`, r.ok && r.side === "words" && (r.doc.content[0]!.props as Record<string, unknown>)[s.name] === "new words", r);
  const num = withText!.settings.find((x) => x.kind === "number" && x.max !== undefined);
  if (num) {
    const big = applyStep({ ...page, content: [{ type: withText!.id, props: { id: "L1" } }] } as PageDoc, { op: "set_prop", block: "L1", prop: num.name, value: (num.max as number) + 999 }, { contracts: site.contracts });
    check(`a number setting of an app-local block is held to its limit (${num.name} <= ${num.max})`, big.ok && (big.doc.content[0]!.props as Record<string, unknown>)[num.name] === num.max, big);
  }
  const bound = withText!.settings.find((x) => x.binds);
  if (bound) {
    const r2 = applyStep({ ...page, content: [{ type: withText!.id, props: { id: "L1" } }] } as PageDoc, { op: "set_prop", block: "L1", prop: bound.name, value: "x" }, { contracts: site.contracts });
    check("a setting filled from a record is refused in words", !r2.ok && r2.code === "bound_prop", r2);
  }
}
{
  const withPart = appLocal.find((b) => b.parts.length > 0);
  if (withPart) {
    const page = { root: { props: {} }, content: [{ type: withPart.id, props: { id: "P1" } }] } as unknown as PageDoc;
    const ok2 = applyStep(page, { op: "set_look", block: "P1", part: withPart.parts[0]!.name, look: { color: "#1f4e79" } }, { contracts: site.contracts });
    const bad2 = applyStep(page, { op: "set_look", block: "P1", part: "no-such-part", look: { color: "#1f4e79" } }, { contracts: site.contracts });
    check(`a look step on a declared part of an app-local block (${withPart.id}.${withPart.parts[0]!.name}) is accepted; an undeclared part is refused`, ok2.ok && !bad2.ok && bad2.code === "unknown_part", { ok2, bad2 });
  }
  const withTok = mf.find((b) => b.tokens.some((t) => /^--[a-z]+-(aurum|accent|ink)$/.test(t)) && b.owner.startsWith("app:"));
  if (withTok) {
    const page = { root: { props: {} }, content: [{ type: withTok.id, props: { id: "T1" } }] } as unknown as PageDoc;
    const tk = withTok.tokens.find((t) => /^--[a-z]+-(aurum|accent|ink)$/.test(t))!;
    const good = applyStep(page, { op: "set_token", block: "T1", name: tk, value: "#c0392b" }, { contracts: site.contracts });
    const nope = applyStep(page, { op: "set_token", block: "T1", name: tk, value: "red; background:url(x)" }, { contracts: site.contracts });
    check(`a colour of an app-local block (${withTok.id} ${tk}) takes a hex colour and refuses anything else`, good.ok && !nope.ok, { good: good.say, nope });
  }
  const font = mf.find((b) => b.tokens.includes("--blk-font-title"));
  if (font) {
    const page = { root: { props: {} }, content: [{ type: font.id, props: { id: "F1" } }] } as unknown as PageDoc;
    const r = applyStep(page, { op: "set_token", block: "F1", name: "--blk-font-title", value: "Comic Sans" }, { contracts: site.contracts });
    check("a font token is still refused (fonts come from the library)", !r.ok && r.code === "font_token", r);
  }
}
check("a block type in no manifest is still unknown, and its step is refused", unknownTypesOn({ content: [{ type: "made-up-block", props: { id: "z" } }] }).join() === "made-up-block" && !applyStep({ root: { props: {} }, content: [{ type: "made-up-block", props: { id: "z" } }] } as unknown as PageDoc, { op: "set_prop", block: "z", prop: "title", value: "x" }, { contracts: site.contracts, allowUnknownTypes: true }).ok);
check("a page of app-local and shared blocks has no unknown types, so it can be published", unknownTypesOn({ content: [{ type: withText!.id, props: { id: "a" } }, { type: "hero-banner", props: { id: "b" } }] }).length === 0);
check("legacy zones are still not vouched for", hasLegacyZones({ content: [], zones: { "a:b": [{ type: "words", props: { id: "q" } }] } }) && !hasLegacyZones({ content: [], zones: {} }));
check("the contracts are plain data (they can cross to the screen as a prop)", JSON.stringify(site.contracts).length > 1000 && JSON.parse(JSON.stringify(site.contracts))["hero-banner"].label === site.contracts["hero-banner"]!.label);

// ---- 2. structure steps against the small config built from the manifest
const cfg = site.config as { components: Record<string, { fields?: Record<string, { type?: string; allow?: string[]; disallow?: string[] }>; defaultProps?: Record<string, unknown> }> };
check("the small config has every manifest block", mf.every((b) => Object.prototype.hasOwnProperty.call(cfg.components, b.id)));
check("every slot of every block is a slot field", mf.every((b) => b.slots.every((s) => cfg.components[b.id]!.fields?.[s]?.type === "slot")));
{
  const hb = mf.find((b) => b.id === "hero-banner")!;
  const withDefault = hb.settings.find((s) => s.default !== undefined && typeof s.default === "string");
  check("defaults come from the block's own settings", !!withDefault && cfg.components["hero-banner"]!.defaultProps?.[withDefault.name] === withDefault.default, cfg.components["hero-banner"]!.defaultProps);
  check("a setting with no default has none in the config", hb.settings.filter((s) => s.default === undefined).every((s) => !(s.name in (cfg.components["hero-banner"]!.defaultProps ?? {}))));
}
// Allow and disallow, proven on a synthetic config built by the same function.
{
  const synthetic = stepConfigOf(
    [
      { id: "frame", slots: ["items"], settings: [] },
      { id: "para", slots: [], settings: [{ name: "text", kind: "string", default: "Hello" }] },
      { id: "pic", slots: [], settings: [] },
      { id: "wild", slots: [], settings: [] },
    ],
    { frame: { items: { allow: ["para", "pic"], disallow: ["pic"] } } },
  );
  const sctx = { contracts: { frame: { label: "Frame", props: [], tokens: [] }, para: { label: "Paragraph", props: [{ name: "text", kind: "string", label: "Text" }], tokens: [] }, pic: { label: "Picture", props: [], tokens: [] }, wild: { label: "Wild", props: [], tokens: [] } } as Record<string, BlockContractLike>, config: synthetic };
  const base = { root: { props: {} }, content: [{ type: "frame", props: { id: "f", items: [] } }] } as unknown as PageDoc;
  const okIn = applyStep(base, { op: "insert", type: "para", zone: "f:items" }, sctx);
  check("an insert into a slot takes a block its allow list names", okIn.ok && ((okIn.doc.content[0]!.props as { items: Array<{ type: string; props: { text?: string } }> }).items[0]?.props.text === "Hello"), okIn);
  const notListed = applyStep(base, { op: "insert", type: "wild", zone: "f:items" }, sctx);
  check("an insert into a slot refuses a block its allow list does not name, in words", !notListed.ok && notListed.code === "slot_not_allowed" && notListed.say.length > 10 && notListed.doc === base, notListed);
  const disallowed = applyStep(base, { op: "insert", type: "pic", zone: "f:items" }, sctx);
  check("an insert into a slot refuses a block its disallow list names, even when allow names it", !disallowed.ok && disallowed.code === "slot_not_allowed", disallowed);
  const badZone = applyStep(base, { op: "insert", type: "para", zone: "f:nothere" }, sctx);
  check("an insert into a slot the block does not have is refused", !badZone.ok && badZone.code === "bad_zone", badZone);
  const topLevel = applyStep(base, { op: "insert", type: "wild" }, sctx);
  check("an insert at the top of the page takes any block of the catalogue", topLevel.ok && topLevel.doc.content.length === 2 && topLevel.doc.content[1]!.type === "wild", topLevel);
  const toRoot = applyStep(okIn.doc, { op: "move", block: (okIn.doc.content[0]!.props as { items: Array<{ props: { id: string } }> }).items[0]!.props.id, zone: "root:default-zone", index: 0 }, sctx);
  check("a move out of a slot to the top of the page works", toRoot.ok && toRoot.doc.content[0]!.type === "para" && (toRoot.doc.content[1]!.props as { items: unknown[] }).items.length === 0, toRoot);
  const intoNo = applyStep(toRoot.doc, { op: "move", block: (toRoot.doc.content[0]!.props as { id: string }).id, zone: "f:items", index: 0 }, { ...sctx, contracts: sctx.contracts });
  check("a move into a slot that allows it works", intoNo.ok && ((intoNo.doc.content[0]!.props as { items: unknown[] }).items.length === 1), intoNo);
}
// The real shared catalogue: where a real block's slot has an allow list, the same rule holds through the real config.
{
  const realRules = site.blocks.flatMap((b) => b.def.props.filter((p) => p.kind === "slot" && (p as { allow?: readonly string[] }).allow?.length).map((p) => ({ id: b.def.id, slot: p.name, allow: (p as { allow: readonly string[] }).allow })));
  if (realRules.length) {
    const r = realRules[0]!;
    const outsider = mf.map((b) => b.id).find((id) => !r.allow.includes(id) && id !== r.id)!;
    const page = { root: { props: {} }, content: [{ type: r.id, props: { id: "host" } }] } as unknown as PageDoc;
    const no = applyStep(page, { op: "insert", type: outsider, zone: `host:${r.slot}` }, { contracts: site.contracts, config: site.config });
    const yes = applyStep(page, { op: "insert", type: r.allow[0]!, zone: `host:${r.slot}` }, { contracts: site.contracts, config: site.config });
    check(`a real slot's allow list holds (${r.id}.${r.slot})`, !no.ok && no.code === "slot_not_allowed" && yes.ok, { no, yes });
  } else {
    check("no shared block declares a slot allow list yet (nothing to carry over)", true);
  }
}
// Unknown blocks pass through byte for byte, through every structure step.
{
  const odd = { type: "mystery-from-elsewhere", props: { zeta: 1, alpha: [1, 2, { k: "v" }], id: "odd1", nested: { b: 2, a: 1 }, items: [{ type: "also-unknown", props: { id: "odd2", z: 1 } }] } };
  const oddBytes = JSON.stringify(odd);
  const doc = { root: { props: { title: "T" } }, content: [{ type: "hero-banner", props: { id: "hb1", title: "One" } }, odd, { type: "hero-banner", props: { id: "hb2", title: "Two" } }] } as unknown as PageDoc;
  const ctx2 = { contracts: site.contracts, config: site.config, allowUnknownTypes: true };
  const steps: unknown[][] = [
    [{ op: "insert", type: "hero-banner", index: 0 }],
    [{ op: "move", block: "hb2", index: 0 }],
    [{ op: "duplicate", block: "hb1" }],
    [{ op: "remove", block: "hb1" }],
    [{ op: "insert", type: "hero-banner", index: 1 }, { op: "move", block: "hb1", index: 2 }],
  ];
  const outs = steps.map((s) => applySteps(doc, s, ctx2));
  check("structure steps (insert, move, copy, remove) run on a page that holds blocks nobody here knows", outs.every((o) => o.ok), outs.map((o) => o.results.map((r) => r.say)));
  check("an unknown block, and what it holds, comes out byte-identical after every structure step", outs.every((o) => o.doc.content.some((n) => JSON.stringify(n) === oddBytes)));
  const aimed = applyStep(doc, { op: "remove", block: "odd1" }, ctx2);
  check("a structure step aimed at an unknown block is refused", !aimed.ok && aimed.code === "unknown_type", aimed);
  const mv = applyStep(doc, { op: "move", block: "odd1", index: 0 }, ctx2);
  check("moving an unknown block is refused as well", !mv.ok, mv);
}

// ---- 3. the development org's own pages
const core = await import("../src/lib/sites-pages-core");
check("the development org is the one this app builds in", core.DEV_ORG === "development");
check("a page name is made from a title in plain letters, or refused", core.slugOfTitle("My First Page!") === "my-first-page" && core.slugOfTitle("  ") === null && core.slugOfTitle("../etc") === "etc");
{
  const doc0 = core.newPageDoc("My page");
  check("a new page holds its title and no blocks", doc0.content.length === 0 && (doc0.root.props as { title?: string }).title === "My page");
}
const pagesSrc = src("../src/app/pages/[...slug]/page.tsx");
check("/pages/[...slug] calls requireNetworkAdmin", /await requireNetworkAdmin\(/.test(pagesSrc));
check("/pages draws only the published page (it never loads a draft)", !/loadDraft/.test(pagesSrc) && /loadPageWithVersion|loadDevPage/.test(pagesSrc));
for (const [file, names] of [
  ["../src/lib/sites-pages-actions.ts", ["createPageAction", "pagesFieldsLoad", "pagesFieldsSave"]],
] as const) {
  const text = src(file);
  check(`${file.replace("../src/lib/", "")} is a server-action module that exports only async functions`, text.startsWith('"use server"') && !/export (const|let|var|class|function) /.test(text) && !/export default/.test(text));
  for (const n of names) {
    const m = new RegExp(`export async function ${n}\\([^)]*\\)[^{]*\\{\\s*(?:const admin = )?await adminOrThrow\\(\\);`).exec(text);
    check(`${n} calls the admin gate as its first statement`, !!m);
  }
}
check("the in-place save is gated by the network admin check and keeps the stale guard (it hands the store the version)", /getNetworkAdmin|adminOrThrow/.test(src("../src/lib/sites-pages-core.ts")) || /getNetworkAdmin|adminOrThrow/.test(src("../src/lib/sites-pages-actions.ts")));
check("the in-place save never turns the store guard off", !/storeGuard:\s*false/.test(src("../src/lib/sites-pages-actions.ts")) && !/storeGuard:\s*false/.test(src("../src/lib/sites-pages-core.ts")));
check("the Sites list always includes the development org, even with no pages", /DEV_ORG/.test(src("../src/lib/sites-list.ts")));

if (!process.env.DATABASE_URL) {
  check("the database checks need DATABASE_URL (run with --network guru-eac_eac-network --env-file $HOME/eac/.env)", false);
} else {
  const { db } = await import("@elkdonis/db");
  const pb = await import("@elkdonis/page-builder/server");
  const { cleanBoxDoc } = await import("@elkdonis/direct-edit/block");
  const { stripResolvedKeys } = await import("@elkdonis/blocks/record");
  const { createBlockFields, fieldMapOf } = await import("../../../packages/house-editor/src/fields/blocks");
  const { listSitesFrom } = await import("../src/lib/sites-list");
  const clean = (d: unknown) => cleanBoxDoc(stripResolvedKeys(d, {}));
  const ROLLBACK = new Error("rollback on purpose");
  const slug = `zz-check-${Date.now().toString(36)}`;
  const author = { id: "check", kind: "person" as const, label: "Network admin, development app" };
  const [before] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM site_config WHERE org_id = 'development'`;
  const livePages = await pb.listPages("development");
  try {
    await db.begin(async (tx) => {
      const sql = tx as unknown as typeof db;
      const [org] = await sql<Array<{ id: string }>>`SELECT id FROM organizations WHERE id = ${core.DEV_ORG}`;
      check("the development org exists", org?.id === "development");

      // New page: a draft first.
      const made = await core.createDraftPage(core.DEV_ORG, slug, "Check page", author, { tx: sql });
      check("a new page is made as a draft", made.ok, made);
      const d0 = await pb.loadDraft(core.DEV_ORG, slug, { tx: sql });
      check("the draft starts from nothing (base null), by a person, with the page's title", !!d0 && d0.base === null && d0.author.kind === "person" && d0.data.content.length === 0 && (d0.data.root.props as { title?: string }).title === "Check page", d0);
      const [liveRow] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM site_config WHERE org_id = ${core.DEV_ORG} AND key = ${"puck:" + slug}`;
      check("a new page is not live until published", liveRow?.n === 0);
      const again = await core.createDraftPage(core.DEV_ORG, slug, "Check page", author, { tx: sql });
      check("a second New page with the same name is refused, in words", !again.ok && again.say.length > 10, again);
      const dup = await core.createDraftPage(core.DEV_ORG, "../bad", "x", author, { tx: sql });
      check("a page name that is not usable is refused", !dup.ok);

      // The Sites list names the org even without pages, and shows the waiting draft as a new page.
      const sites = await listSitesFrom(sql);
      const dev = sites.find((s) => s.id === "development");
      check("the Sites list holds the development org, with its waiting new draft", !!dev && dev.newDrafts.includes(slug), dev);

      // Three blocks, from nothing, as steps.
      const fm = fieldMapOf(site.contracts as never);
      const typeable = Object.entries(fm).filter(([type, e]) => site.blocks.some((b) => b.def.id === type) && Object.values(e.parts).some((p) => p.kind === "string")).map(([t]) => t).slice(0, 3);
      check("there are at least three shared blocks with a typeable part", typeable.length === 3, typeable);
      const build = applySteps(d0!.data, typeable.map((type) => ({ op: "insert", type })), { contracts: site.contracts, config: site.config, allowUnknownTypes: true });
      check("three blocks are added to the empty page as steps", build.ok && build.doc.content.length === 3 && build.doc.content.map((n) => n.type).join() === typeable.join(), build.results.map((r) => r.say));
      const ids = build.doc.content.map((n) => n.props.id as string);
      const wordsOf = (type: string) => Object.values(fm[type]!.parts).find((p) => p.kind === "string")!.prop;
      const typed = applySteps(build.doc, typeable.map((type, i) => ({ op: "set_prop", block: ids[i], prop: wordsOf(type), value: `Words ${i + 1}` })), { contracts: site.contracts, config: site.config, allowUnknownTypes: true });
      check("words are typed into all three", typed.ok, typed.results.map((r) => r.say));
      const lookPart = Object.entries(fm[typeable[0]!]!.parts)[0]![0];
      const hover = applyStep(typed.doc, { op: "set_look", block: ids[0], part: lookPart, look: { color: "#c0392b" }, state: "hover" }, { contracts: site.contracts, config: site.config, allowUnknownTypes: true });
      check("a hover look on one part is accepted and stored under its block", hover.ok && JSON.stringify((hover.doc.content[0]!.props as { morph?: unknown }).morph).includes('"hover"'), hover);
      const base = await pb.loadDraft(core.DEV_ORG, slug, { tx: sql });
      const saved = await pb.saveDraft(core.DEV_ORG, slug, { data: hover.doc, base: base!.base, author, steps: [] }, { tx: sql });
      check("the draft with three blocks, words and a hover look is saved", saved.ok, saved);

      // Publish.
      const pub = await pb.publishDraft(core.DEV_ORG, slug, { tx: sql, clean });
      check("the draft publishes", pub.ok && !!pub.updatedAt, pub);
      const [row] = await sql<Array<{ value: { content: Array<{ type: string; props: Record<string, unknown> }> }; version: string }>>`SELECT value, updated_at::text AS version FROM site_config WHERE org_id = ${core.DEV_ORG} AND key = ${"puck:" + slug}`;
      check("the page is stored under puck:<slug> with its three blocks and the hover look", row?.value.content.length === 3 && JSON.stringify(row.value.content[0]!.props.morph).includes("#c0392b"), row?.value.content.length);
      const [gone] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM site_config WHERE org_id = ${core.DEV_ORG} AND key = ${"puck-draft:" + slug}`;
      check("publishing clears the draft", gone?.n === 0);

      // Change a word in place, through the same door the lens uses: one set_prop step, the stale guard, the page stays changed.
      const loadPage = async (s: string) => {
        const [r] = await sql<Array<{ value: unknown; version: string }>>`SELECT value, updated_at::text AS version FROM site_config WHERE org_id = ${core.DEV_ORG} AND key = ${"puck:" + s}`;
        return r ? { data: r.value, updatedAt: r.version } : null;
      };
      const saveLive = async (s: string, data: unknown, version?: string) => {
        const rows = await sql<Array<{ version: string }>>`UPDATE site_config SET value = ${sql.json(clean(data) as never)}, updated_at = clock_timestamp() WHERE org_id = ${core.DEV_ORG} AND key = ${"puck:" + s} AND (${version ?? null}::text IS NULL OR updated_at = ${version ?? null}::text::timestamptz) RETURNING updated_at::text AS version`;
        return rows.length ? { ok: true, updatedAt: rows[0]!.version } : { ok: false, stale: true };
      };
      const fields = createBlockFields({ contracts: site.contracts as never, config: site.config, loadPage, save: saveLive });
      const target = `${slug}:${ids[1]}:${wordsOf(typeable[1]!)}`;
      const loaded = await fields.load(`${slug}:${ids[1]}`);
      check("the lens loads the block's words and the page's version", loaded.ok && loaded.values?.[wordsOf(typeable[1]!)] === "Words 2" && loaded.version === row!.version, loaded);
      const changed = await fields.save(`${slug}:${ids[1]}`, { [wordsOf(typeable[1]!)]: "A changed word" }, loaded.version);
      check("a word typed on the page is saved as one set_prop step", changed.ok && changed.say !== undefined, { changed, target });
      const [after] = await sql<Array<{ value: { content: Array<{ props: Record<string, unknown> }> } }>>`SELECT value FROM site_config WHERE org_id = ${core.DEV_ORG} AND key = ${"puck:" + slug}`;
      check("after a reload the changed word is still there, and the other blocks and the look are as they were", after?.value.content[1]!.props[wordsOf(typeable[1]!)] === "A changed word" && after.value.content[0]!.props[wordsOf(typeable[0]!)] === "Words 1" && JSON.stringify(after.value.content[0]!.props.morph).includes("#c0392b"));
      const stale = await fields.save(`${slug}:${ids[1]}`, { [wordsOf(typeable[1]!)]: "From an old screen" }, loaded.version);
      check("a save from a screen that opened before that change is refused as stale, and writes nothing", !stale.ok && stale.stale === true);
      const [after2] = await sql<Array<{ value: { content: Array<{ props: Record<string, unknown> }> } }>>`SELECT value FROM site_config WHERE org_id = ${core.DEV_ORG} AND key = ${"puck:" + slug}`;
      check("the stale save left the page alone", after2?.value.content[1]!.props[wordsOf(typeable[1]!)] === "A changed word");
      const refused = await fields.save(`${slug}:${ids[1]}`, { notASetting: "x" }, changed.version);
      check("a setting no part draws cannot be typed on the page", !refused.ok);

      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) check(`unexpected error in the database checks: ${String(e)}`, false);
  }
  const [afterCount] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM site_config WHERE org_id = 'development'`;
  const livePagesAfter = await pb.listPages("development");
  check("the database checks left no row behind", afterCount?.n === before?.n && livePagesAfter.length === livePages.length);
  await db.end({ timeout: 2 }).catch(() => {});
}


// ---- review fixes: slot rules of app-local blocks (hand-kept table)
{
  const { APP_SLOT_RULES } = await import("../src/lib/sites-slot-rules");
  const realIds = new Set(site.blocks.map((b) => b.def.id));
  const missing = mf.filter((b) => b.owner.startsWith("app:") && !realIds.has(b.id)).flatMap((b) => b.slots.map((s) => `${b.id}.${s}`)).filter((k) => !(k in APP_SLOT_RULES));
  check("every app-local slot in the manifest has an entry in the slot-rule table (add one with its source line)", missing.length === 0, missing);
  check("every table entry with a rule names its source path:line", Object.values(APP_SLOT_RULES).every((e) => e === null || /^apps\/[a-z-]+\/src\/.+:\d+$/.test(e.source)));
  const ctx3 = { contracts: site.contracts, config: site.config };
  const other = mf.map((b) => b.id).find((id) => id !== "ktp-piece" && id !== "ktp-piece-row" && id !== "ktp-quick-landing")!;
  for (const [host, slot] of [["ktp-piece-row", "pieces"], ["ktp-quick-landing", "feature"]] as const) {
    const page = { root: { props: {} }, content: [{ type: host, props: { id: "kh" } }] } as unknown as PageDoc;
    const no = applyStep(page, { op: "insert", type: other, zone: `kh:${slot}` }, ctx3);
    const no2 = applyStep(page, { op: "insert", type: "hero-banner", zone: `kh:${slot}` }, ctx3);
    const yes = applyStep(page, { op: "insert", type: "ktp-piece", zone: `kh:${slot}` }, ctx3);
    check(`${host}.${slot}: any other block is refused, ktp-piece is allowed`, !no.ok && no.code === "slot_not_allowed" && !no2.ok && yes.ok, { no: no.code, no2: no2.code, yes: yes.code });
  }
  const mover = { root: { props: {} }, content: [{ type: "ktp-piece-row", props: { id: "kh", pieces: [] } }, { type: "hero-banner", props: { id: "hb" } }] } as unknown as PageDoc;
  check("moving another block into a restricted slot is refused as well", !applyStep(mover, { op: "move", block: "hb", zone: "kh:pieces", index: 0 }, ctx3).ok);
  check("a token named --x-sizing-ink is a colour, --x-card-size a length", contractFromManifest({ id: "t", label: "T", tokens: ["--x-sizing-ink", "--x-card-size"], settings: [], slots: [], parts: [] } as never).tokens.map((t) => t.type).join() === "color,length");
  check("/pages says a waiting draft goes stale when a word is typed on the published page", /goes stale|draft waiting/i.test(src("../src/components/sites/PagesView.tsx")));
}


// ---- review fixes: lost update on drafts
check("a draft save hands the store what it started from (compare-and-set), and a changed draft is answered in plain words", /expected: draft\?\.savedAt \?\? null/.test(src("../src/lib/sites-actions.ts")) && /draft_changed/.test(src("../src/lib/sites-actions.ts")) && /Reload the page/.test(src("../src/lib/sites-actions.ts")));
check("a new page is started only if no draft exists (compare-and-set with none)", /expected: null/.test(src("../src/lib/sites-pages-core.ts")));

console.log(`
${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
