// Bakes src/data/block-contract.json: every block read against the block contract
// (docs/open/BLOCK_CONTRACT_2026-11-23/CONTRACT.md). Static scan, read-only on the repo apart from that one file.
// Run on eris, from apps/development (node and typescript are the ones already installed; nothing to install):
//   node scripts/refresh-block-contract.mjs
// Inputs (all read-only):
//   src/data/blocks.json                      the block index of 2020-11-20 (ids, files, owners). A block's own source is
//                                             re-read; the index is used to FIND blocks and as a fallback when a declaration
//                                             cannot be read from source (the evidence line then says so).
//   packages/mcp/src/manifest/blocks.generated.ts   the block manifest assistants see, and its deny list result.
//   the source files named by the index       declarations (settings, parts, resize, binds, reads) read with the
//                                             TypeScript parser; typed-in colours and fonts counted in the block's own
//                                             file, the stylesheets that file imports, and the component files it imports.
// A static scan cannot run the code. What it cannot see is written into `cannotTell` in the output and shown on the page.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const APP = resolve(here, "..");
const ROOT = resolve(APP, "../..");
const OUT = process.env.BLOCK_CONTRACT_OUT || join(APP, "src/data/block-contract.json");

const require = createRequire(import.meta.url);
let ts;
try { ts = require("typescript"); } catch {
  const pnpm = join(ROOT, "node_modules/.pnpm");
  const d = readdirSync(pnpm).find((n) => n.startsWith("typescript@"));
  ts = require(join(pnpm, d, "node_modules/typescript"));
}

const index = JSON.parse(readFileSync(join(APP, "src/data/blocks.json"), "utf8"));

// ---------- the manifest (what assistants see) ----------
const manifest = new Map();
{
  const text = readFileSync(join(ROOT, "packages/mcp/src/manifest/blocks.generated.ts"), "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith('{"id":')) continue;
    try { const o = JSON.parse(t.replace(/,$/, "")); manifest.set(o.id, o); } catch { /* skip a line that is not one block */ }
  }
}

// ---------- reading source ----------
const fileCache = new Map();
const readSrc = (rel) => {
  if (!rel) return null;
  if (fileCache.has(rel)) return fileCache.get(rel);
  const abs = join(ROOT, rel);
  let v = null;
  if (existsSync(abs) && statSync(abs).isFile()) {
    const text = readFileSync(abs, "utf8");
    v = { text, sf: /\.tsx?$/.test(rel) ? ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : null };
  }
  fileCache.set(rel, v);
  return v;
};

const nameOf = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null);
const strOf = (n) => (n && ts.isStringLiteralLike(n) ? n.text : null);
const unwrap = (n) => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n) || ts.isTypeAssertionExpression?.(n) || ts.isNonNullExpression(n))) n = n.expression;
  return n;
};
const prop = (obj, name) => obj.properties.find((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && nameOf(p.name) === name);
const propInit = (obj, name) => { const p = prop(obj, name); return p ? (ts.isShorthandPropertyAssignment(p) ? p.name : p.initializer) : null; };
const isTrue = (n) => !!n && n.kind === ts.SyntaxKind.TrueKeyword;
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Top-level const initialisers of a file, by name. */
const constsOf = (sf) => {
  const m = new Map();
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) m.set(d.name.text, d.initializer);
  }
  return m;
};
const resolveId = (n, consts, depth = 0) => {
  n = unwrap(n);
  if (n && ts.isIdentifier(n) && depth < 4 && consts.has(n.text)) return resolveId(consts.get(n.text), consts, depth + 1);
  return n;
};

/** Settings: [{name, kind, binds, inline, hasMin}] and a count of entries that could not be read. */
function readSettings(expr, consts) {
  const out = []; let unresolved = 0;
  const visit = (e) => {
    e = resolveId(e, consts);
    if (!e) { unresolved++; return; }
    if (ts.isArrayLiteralExpression(e)) {
      for (const el of e.elements) {
        if (ts.isSpreadElement(el)) { const r = resolveId(el.expression, consts); if (r && ts.isArrayLiteralExpression(r)) visit(r); else unresolved++; continue; }
        const o = resolveId(el, consts);
        if (o && ts.isObjectLiteralExpression(o)) {
          const spread = o.properties.some((p) => ts.isSpreadAssignment(p));
          const name = strOf(propInit(o, "name")); const kind = strOf(propInit(o, "kind"));
          if (name || kind) out.push({ name: name ?? "?", kind: kind ?? "?", binds: strOf(propInit(o, "binds")), inline: isTrue(propInit(o, "inlineEditable")), spread });
          else unresolved++;
        } else unresolved++;
      }
    } else unresolved++;
  };
  visit(expr);
  return { list: out, unresolved };
}

/** Parts: [{name, label, repeat, prop}] and unresolved count. */
function readParts(expr, consts) {
  const out = []; let unresolved = 0;
  const visit = (e, d = 0) => {
    e = resolveId(e, consts);
    if (!e || d > 3) { unresolved++; return; }
    if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) {
        if (ts.isSpreadAssignment(p)) { visit(p.expression, d + 1); continue; }
        if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
          const nm = nameOf(p.name); const v = ts.isPropertyAssignment(p) ? resolveId(p.initializer, consts) : null;
          if (nm && v && ts.isObjectLiteralExpression(v)) out.push({ name: nm, label: strOf(propInit(v, "label")) ?? nm, repeat: isTrue(propInit(v, "repeat")), prop: strOf(propInit(v, "prop")) });
          else if (nm) { out.push({ name: nm, label: nm, repeat: false, prop: null, odd: true }); }
          else unresolved++;
        } else unresolved++;
      }
    } else unresolved++;
  };
  visit(expr);
  return { list: out, unresolved };
}

/** Find where a block is declared in a file. Returns a description of what the source says, or null. */
function findDeclaration(rec, f) {
  const { sf } = f; if (!sf) return null;
  const consts = constsOf(sf);
  const id = rec.id;
  let found = null;
  const visit = (n) => {
    if (found && found.form !== "call" && found.form !== "puck") return;
    if (ts.isObjectLiteralExpression(n) && strOf(propInit(n, "id")) === id && (prop(n, "props") || prop(n, "label"))) {
      found = { form: "object", node: n };
    } else if (!found && ts.isCallExpression(n) && n.arguments.length >= 3 && strOf(n.arguments[0]) === id) {
      found = { form: "call", node: n };
    } else if (!found && ts.isPropertyAssignment(n) && nameOf(n.name) === id) {
      const v = unwrap(n.initializer);
      if (v && ts.isObjectLiteralExpression(v) && (prop(v, "fields") || prop(v, "render"))) found = { form: "puck", node: v };
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!found) return null;
  const n = found.node;
  const d = { form: found.form, line: lineOf(sf, n), settings: null, parts: null, resize: null, reads: null, slots: 0, partsSeen: false };
  if (found.form === "object") {
    const pe = propInit(n, "props"); if (pe) d.settings = readSettings(pe, consts); else d.settings = { list: [], unresolved: 0, none: true };
    const pa = propInit(n, "parts"); if (pa) { d.partsSeen = true; d.parts = readParts(pa, consts); }
    const rz = propInit(n, "resize"); if (rz) { const o = resolveId(rz, consts); d.resize = o && ts.isObjectLiteralExpression(o) ? strOf(propInit(o, "height")) ?? "?" : "?"; }
    const rd = propInit(n, "reads"); if (rd) { const o = resolveId(rd, consts); d.reads = o && ts.isArrayLiteralExpression(o) ? o.elements.map((e) => { const x = resolveId(e, consts); return x && ts.isObjectLiteralExpression(x) ? { from: strOf(propInit(x, "from")), what: strOf(propInit(x, "what")), via: strOf(propInit(x, "via")) } : { from: "?" }; }) : []; }
  } else if (found.form === "call") {
    const args = [...n.arguments].slice(3);
    for (const a of args) {
      const r = resolveId(a, consts);
      if (r && ts.isArrayLiteralExpression(r)) d.settings = readSettings(r, consts);
      else if (r && ts.isObjectLiteralExpression(r) && !d.parts) { d.partsSeen = true; d.parts = readParts(r, consts); }
      else if (r && ts.isCallExpression(r) && !d.parts) { d.partsSeen = true; d.parts = { list: [], unresolved: 1 }; }
    }
  } else {
    const fe = propInit(n, "fields"); const list = []; let unresolved = 0;
    const fo = fe ? resolveId(fe, consts) : null;
    if (fo && ts.isObjectLiteralExpression(fo)) {
      for (const p of fo.properties) {
        if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) { unresolved++; continue; }
        let v = ts.isPropertyAssignment(p) ? unwrap(p.initializer) : null;
        let t = null;
        if (v && ts.isObjectLiteralExpression(v)) t = strOf(propInit(v, "type"));
        else if (v && ts.isCallExpression(v)) t = "call";
        list.push({ name: nameOf(p.name) ?? "?", kind: t === "textarea" ? "text" : t === "text" ? "string" : t ?? "?", binds: null, inline: false });
      }
    }
    d.settings = { list, unresolved };
  }
  // slots: a place inside the block that can receive another block
  if (d.settings) d.slots = d.settings.list.filter((s) => s.kind === "slot").length;
  return d;
}

// ---------- typed-in colours and fonts ----------
const stripComments = (text, isCss) => {
  let t = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  if (!isCss) t = t.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, a) => a + " ".repeat(m.length - a.length));
  return t;
};
const HEX = /(?<![&\w#&-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;
const FUNC = /\b(?:rgba?|hsla?)\(\s*[\d.]/g;
const FONT_CSS = /font-family\s*:\s*([^;}\n]+)/g;
const FONT_JS = /fontFamily\s*:\s*(["'`])([^"'`]*)\1/g;
function scanLiterals(rel) {
  const f = readSrc(rel); if (!f) return null;
  const isCss = rel.endsWith(".css");
  const t = stripComments(f.text, isCss);
  const where = (re, test) => {
    const hits = [];
    for (const m of t.matchAll(re)) {
      if (test && !test(m)) continue;
      const line = t.slice(0, m.index).split("\n").length;
      hits.push({ line, text: m[0].slice(0, 40) });
    }
    return hits;
  };
  const hex = where(HEX);
  const fn = where(FUNC);
  const font = [...where(FONT_CSS, (m) => !/^\s*(var\(|inherit|initial)/.test(m[1])), ...where(FONT_JS, (m) => !/^\s*(var\(|inherit)/.test(m[2]))];
  return { file: rel, hex, fn, font };
}

const importsOf = (rel, f) => {
  const dir = dirname(rel);
  const appRoot = rel.startsWith("apps/") ? rel.split("/").slice(0, 2).join("/") : null;
  const css = new Set(), comps = new Set();
  const re = /(?:import|export)\s+(?:[^'"]*?from\s*)?["']([^"']+)["']/g;
  const tryFile = (base) => {
    for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) { const p = base + ext; const a = join(ROOT, p); if (existsSync(a) && statSync(a).isFile()) return p.replace(/\\/g, "/"); }
    return null;
  };
  for (const m of f.text.matchAll(re)) {
    const spec = m[1];
    let base = null;
    if (spec.startsWith(".")) base = join(dir, spec).replace(/\\/g, "/");
    else if (spec.startsWith("@/") && appRoot) base = `${appRoot}/src/${spec.slice(2)}`;
    if (!base) continue;
    if (spec.endsWith(".css")) { if (existsSync(join(ROOT, base))) css.add(base); continue; }
    // Component files only: a drawing file, not a library of data.
    if (/\/components\//.test(base) || spec.startsWith("./")) { const p = tryFile(base); if (p && p !== rel && /\.tsx$/.test(p)) comps.add(p); }
  }
  return { css: [...css], comps: [...comps] };
};

// ---------- the scan ----------
const fileUse = new Map();
for (const r of index) { const k = r.componentFile || r.file; fileUse.set(k, (fileUse.get(k) ?? 0) + 1); }

const appOf = (r) => (r.ownerKind === "app" ? r.ownerName : `package:${r.ownerName}`);
const stageNames = [
  { n: 1, key: "written", name: "Written", plain: "The code exists and draws." },
  { n: 2, key: "declared", name: "Declared", plain: "Its settings and its parts are named." },
  { n: 3, key: "themed", name: "Themed", plain: "No colour or font is typed into it; the theme's roles supply them." },
  { n: 4, key: "inplace", name: "Editable in place", plain: "Its parts can be selected, its words typed in place, its record ties named." },
  { n: 5, key: "hosts", name: "Hosts and guests", plain: "Its places say what they offer, and a guest block says what it looks for. Not built yet." },
  { n: 6, key: "listed", name: "Listed for assistants", plain: "It is in the block manifest and not on the deny list." },
];
const ruleDefs = [
  { id: "declared", rules: "B1, B2", name: "Settings declared", plain: "The block names at least one setting or place." },
  { id: "parts", rules: "B1", name: "Parts declared", plain: "The block names its parts, so a page can select and restyle them." },
  { id: "themed", rules: "B3", name: "Theme only", plain: "No colour or font typed into its own files." },
  { id: "words", rules: "E1, B1", name: "Words in place", plain: "A words setting can be typed in place (inline editing, or a part tied to the setting)." },
  { id: "resize", rules: "B4", name: "Height has one home", plain: "A height setting is named in resize, so a handle writes that setting." },
  { id: "binds", rules: "B5", name: "Record named", plain: "Words that come from a record say which record (binds or reads)." },
  { id: "manifest", rules: "E1", name: "In the manifest", plain: "Assistants can look it up, and what they see matches the source." },
  { id: "agent", rules: "E1", name: "Not on the deny list", plain: "An assistant may read it." },
];

const blocks = [];
for (const r of index) {
  const defRel = r.file; const compRel = r.componentFile || r.file;
  const f = readSrc(defRel);
  const decl = f ? findDeclaration(r, f) : null;
  const rules = {};
  const cat = { propCount: r.propCount ?? r.props?.length ?? 0, parts: r.parts ?? [] };

  // settings
  let settings, settingsSource;
  if (decl?.settings && !(decl.settings.unresolved > 0 && decl.settings.list.length === 0 && cat.propCount > 0)) { settings = decl.settings; settingsSource = `source ${defRel}:${decl.line}`; }
  else { settings = { list: (r.props ?? []).map((p) => ({ name: p.name, kind: p.kind, binds: p.binds ?? null, inline: !!p.inlineEditable })), unresolved: 0 }; settingsSource = decl ? `index of 2026-11-20 (source ${defRel}:${decl.line} could not be read in full)` : `index of 2026-11-20 (declaration not found in ${defRel})`; }
  const nSet = settings.list.length;

  // parts
  let parts, partsSource;
  if (decl?.parts && decl.parts.list.length > 0) { parts = decl.parts; partsSource = `source ${defRel}:${decl.line}`; }
  else if (cat.parts.length > 0) { parts = { list: cat.parts.map((n) => ({ name: typeof n === "string" ? n : n.name, label: typeof n === "string" ? n : n.label ?? n.name, repeat: null, prop: null })), unresolved: 0 }; partsSource = `index of 2026-11-20 (names only; the source does not spell them out where the scan could read)`; }
  else { parts = { list: [], unresolved: decl?.parts?.unresolved ?? 0 }; partsSource = decl ? `source ${defRel}:${decl.line}: none declared` : "no declaration found"; }
  const nParts = parts.list.length;
  const nRepeat = parts.list.filter((p) => p.repeat === true).length;
  const repeatKnown = parts.list.every((p) => p.repeat !== null);

  // resize / binds / reads
  const heightSettings = settings.list.filter((s) => s.kind === "number" && /height|tall/i.test(s.name)).map((s) => s.name);
  const resizeDeclared = decl ? decl.resize : (r.resize ? r.resize.height ?? "?" : null);
  const binds = settings.list.filter((s) => s.binds).map((s) => `${s.name} -> ${s.binds}`);
  const readsList = decl?.reads ?? (Array.isArray(r.reads) ? r.reads : null);
  const reads = decl?.reads ?? [];
  const readsRecord = reads.some((x) => x.from === "record" || (x.from === "route" && x.what === "record"));
  const wordSettings = settings.list.filter((s) => ["string", "text", "richtext"].includes(s.kind) && !s.binds && !/^(slug|id|href|url|link|tag|alt|label|variant|class)/i.test(s.name));
  const inlineCount = settings.list.filter((s) => s.inline || s.kind === "richtext").length + parts.list.filter((p) => p.prop).length;

  // literals
  const own = [scanLiterals(compRel)];
  if (defRel !== compRel) own.push(scanLiterals(defRel));
  const cf = readSrc(compRel);
  const reached = [];
  if (cf) {
    const im = importsOf(compRel, cf);
    for (const c of im.css) own.push(scanLiterals(c));
    for (const c of im.comps) { const s = scanLiterals(c); if (s) reached.push(s); }
  }
  const ownOk = own.filter(Boolean);
  const sumOf = (xs) => ({ hex: xs.reduce((a, x) => a + x.hex.length, 0), fn: xs.reduce((a, x) => a + x.fn.length, 0), font: xs.reduce((a, x) => a + x.font.length, 0) });
  const so = sumOf(ownOk), sr = sumOf(reached);
  const lit = (x) => x.hex + x.fn + x.font;
  const firsts = [...ownOk, ...reached].flatMap((x) => [...x.hex.map((h) => ({ k: "colour", ...h })), ...x.fn.map((h) => ({ k: "colour", ...h })), ...x.font.map((h) => ({ k: "font", ...h }))].map((h) => `${x.file}:${h.line} ${h.text.trim()}`)).slice(0, 4);
  const shared = fileUse.get(compRel) ?? 1;

  // ---- rules ----
  const R = (id, status, evidence) => { rules[id] = { status, evidence }; };
  if (!decl && !r.props) R("declared", "unknown", `Declaration not found in ${defRel}.`);
  else if (nSet > 0 || decl?.slots > 0 || nParts > 0) R("declared", "pass", `${nSet} setting${nSet === 1 ? "" : "s"}${nParts && !nSet ? ` (it fills itself), ${nParts} parts` : ""} (${settingsSource}).${settings.unresolved ? ` ${settings.unresolved} more could not be read.` : ""}`);
  else if (settings.unresolved > 0) R("declared", "unknown", `Settings are built by code the scan cannot read (${settingsSource}).`);
  else R("declared", "fail", `No settings declared (${settingsSource}).`);

  if (nParts > 0) R("parts", "pass", `${nParts} part${nParts === 1 ? "" : "s"}${repeatKnown ? `, ${nRepeat} repeating` : ""} (${partsSource}).`);
  else if (decl?.parts?.unresolved > 0) R("parts", "unknown", `Parts are built by code the scan cannot read (${partsSource}).`);
  else if (decl?.form === "puck") R("parts", "fail", `A Puck-form block: it declares fields, not parts (${defRel}:${decl.line}).`);
  else R("parts", "fail", `No parts declared (${partsSource}).`);

  if (!cf) R("themed", "unknown", `Component file ${compRel} not found.`);
  else if (lit(so) > 0) R("themed", "fail", `${so.hex} hex, ${so.fn} rgb/hsl, ${so.font} font-family typed in; first: ${firsts.slice(0, 2).join("; ")}${shared > 1 ? `. File shared by ${shared} blocks, so the count is the file's.` : ""}`);
  else if (lit(sr) > 0) R("themed", "fail", `Own file clean; component files it imports hold ${sr.hex} hex, ${sr.fn} rgb/hsl, ${sr.font} font-family; first: ${firsts.slice(0, 2).join("; ")}`);
  else R("themed", "pass", `None found in ${ownOk.length} own file${ownOk.length === 1 ? "" : "s"}${reached.length ? ` and ${reached.length} component file${reached.length === 1 ? "" : "s"} it imports` : ""}. Styles reached through global sheets or Tailwind names are not seen.`);

  if (wordSettings.length === 0) R("words", "na", "No plain words setting.");
  else if (inlineCount > 0) R("words", "pass", `${inlineCount} in-place words (inline setting or part tied to a setting).`);
  else R("words", "fail", `${wordSettings.length} words setting${wordSettings.length === 1 ? "" : "s"} (${wordSettings.slice(0, 3).map((s) => s.name).join(", ")}) none typed in place.`);

  if (heightSettings.length === 0) R("resize", "na", "No height setting.");
  else if (resizeDeclared) R("resize", "pass", `resize.height = ${resizeDeclared}.`);
  else R("resize", "fail", `Height setting ${heightSettings.join(", ")} but no resize declared.`);

  const drawsRecord = !!r.dataDriven || readsRecord || binds.length > 0;
  if (!drawsRecord) R("binds", "na", "Not data-driven; names no record.");
  else if (binds.length > 0 || readsRecord) R("binds", "pass", binds.length ? `binds: ${binds.slice(0, 2).join(", ")}.` : `reads: ${reads.filter((x) => x.from === "record" || x.from === "route").map((x) => `${x.from} ${x.what ?? x.via}`).join(", ")}.`);
  else if (r.source?.db) R("binds", "fail", "Data-driven and reads the database, but names no record kind (no binds, no reads).");
  else R("binds", "unknown", "Data-driven, no binds or reads declared; the scan cannot tell which record it draws.");

  const m = manifest.get(r.id);
  if (!m) { R("manifest", "fail", "Not in the block manifest."); R("agent", "unknown", "Not in the manifest, so no deny-list answer."); }
  else {
    const mset = (m.settings ?? []).length, mparts = (m.parts ?? []).length;
    const stale = (settings.unresolved ? mset < nSet : mset !== nSet) || mparts !== nParts;
    if (stale) R("manifest", "fail", `In the manifest, but it is out of date: manifest has ${mset} settings and ${mparts} parts, source has ${nSet} and ${nParts}. Rebuild the manifest.`);
    else R("manifest", "pass", `In the manifest (${mset} settings, ${mparts} parts).`);
    if (m.agent?.read) R("agent", "pass", "An assistant may read it.");
    else {
      const w = m.agent?.why ?? "";
      const onPurpose = /secret or a private|person or a private|raw markup|address its owner/.test(w);
      R("agent", onPurpose ? "na" : "fail", `${onPurpose ? "Closed on purpose: " : "Closed: "}${w}`);
    }
  }

  // ---- stages ----
  const ok = (id) => ["pass", "na"].includes(rules[id].status);
  const meets = [
    !!(decl || r.props),
    rules.declared.status === "pass" && rules.parts.status === "pass",
    rules.themed.status === "pass",
    rules.parts.status === "pass" && ok("words") && ok("binds") && ok("resize"),
    false,
    rules.manifest.status === "pass" && rules.agent.status === "pass",
  ];
  let stage = 0;
  for (const i of [0, 1, 2, 3, 5]) { if (meets[i]) stage = i + 1; else break; }

  blocks.push({
    id: r.id, label: r.label, app: appOf(r), owner: r.owner, form: decl?.form === "puck" ? "puck-config" : r.form,
    file: defRel, line: decl?.line ?? r.line, componentFile: compRel,
    category: r.category ?? null, styling: r.styling ?? null, dataDriven: !!r.dataDriven,
    stage, meets,
    settings: { count: nSet, names: settings.list.slice(0, 14).map((s) => s.name), unresolved: settings.unresolved, source: settingsSource, places: decl?.slots ?? 0 },
    parts: { count: nParts, repeating: repeatKnown ? nRepeat : null, names: parts.list.slice(0, 12).map((p) => p.label || p.name), source: partsSource },
    literals: { colours: so.hex + so.fn, fonts: so.font, reachedColours: sr.hex + sr.fn, reachedFonts: sr.font, filesScanned: ownOk.length + reached.length, sharedBy: shared, first: firsts },
    resize: resizeDeclared ?? null, binds, reads: reads.length,
    inManifest: !!m, rules,
  });
}

// blocks declared in source that the index does not list
const unindexed = [];
{
  const known = new Set(index.map((b) => b.id));
  const roots = ["packages/blocks/src", "packages/direct-edit/src", ...readdirSync(join(ROOT, "apps")).map((a) => `apps/${a}/src`)];
  const walk = (d) => {
    const abs = join(ROOT, d);
    if (!existsSync(abs)) return;
    for (const n of readdirSync(abs)) {
      if (n === "node_modules" || n === ".next") continue;
      const p = `${d}/${n}`; const a = join(ROOT, p);
      if (statSync(a).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n)) {
        const t = readFileSync(a, "utf8");
        if (!t.includes("defineBlock(")) continue;
        for (const m of t.matchAll(/defineBlock\(\s*\{[\s\S]{0,200}?\bid:\s*["']([^"']+)["']/g)) if (!known.has(m[1])) unindexed.push({ id: m[1], file: p });
      }
    }
  };
  roots.forEach(walk);
}

// ---------- totals ----------
const rulesOut = ruleDefs.map((d) => {
  const c = { pass: 0, fail: 0, unknown: 0, na: 0 };
  for (const b of blocks) c[b.rules[d.id].status]++;
  return { ...d, ...c };
});
const stagesOut = stageNames.map((s, i) => ({
  ...s, new: i === 4,
  meets: blocks.filter((b) => b.meets[i]).length,
  reached: i === 4 ? 0 : blocks.filter((b) => b.stage >= s.n).length,
}));
const apps = {};
for (const b of blocks) apps[b.app] = (apps[b.app] ?? 0) + 1;

const result = {
  generated: new Date().toISOString(),
  note: "Generated by scripts/refresh-block-contract.mjs: a static read of every block's source against the block contract. It reads; it runs no block code.",
  blockCount: blocks.length,
  apps,
  stages: stagesOut,
  rules: rulesOut,
  stageRule: "A block has reached stage N when its checks for every stage up to N pass. Stage 5 (hosts and guests) is not built, so it is skipped when working out the stage a block has reached; its places (slots) are counted separately.",
  places: { blocksWithPlaces: blocks.filter((b) => b.settings.places > 0).length, offersDeclared: 0 },
  unindexed,
  cannotTell: [
    "Whether a block really draws what it declares: a part's selector is not checked against the markup, only counted.",
    "Colours and fonts that arrive from a global stylesheet, a Tailwind class name such as text-white, an inline style built at run time, or a file the block imports that is not a component (a data or library file). Only typed-in hex, rgb/hsl and font-family values in the block's own file, the stylesheets it imports and the component files it imports are counted.",
    "Settings or parts built by a function call or a spread from another file: the block is read from the 2026-11-20 index instead, and says so in its evidence line.",
    "Whether a block that is not marked data-driven still reads a record by code. Only a declared dataDriven flag, binds or reads count as drawing a record.",
    "Whether a words setting is 'plain words': the scan names a setting words by its kind (string, text, richtext) and skips address-like names (slug, href, url, tag, alt, label).",
    "Whether a hex colour is a deliberate fixed colour (a brand mark, an image overlay) or a mistake: it counts the literal, not the intent.",
    "Whether the manifest assistants really see is the one in the repo: this reads packages/mcp/src/manifest/blocks.generated.ts, which is a checked-in copy.",
    "Blocks added after the 2026-11-20 index are listed under unindexed, not read.",
  ],
  blocks,
};
writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");
console.log(`${blocks.length} blocks -> ${relative(ROOT, OUT)}`);
console.log("stages (meets / reached):", stagesOut.map((s) => `${s.n} ${s.meets}/${s.reached}`).join("  "));
console.log("rules:", rulesOut.map((r) => `${r.id} ${r.pass}p ${r.fail}f ${r.unknown}?`).join("  "));
console.log("unindexed:", unindexed.length);
