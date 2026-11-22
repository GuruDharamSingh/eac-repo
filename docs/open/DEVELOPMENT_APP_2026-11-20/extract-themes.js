// Static theme/variable census. Reads CSS + the editor schemas; no app code is run.
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const ROOT = process.env.ROOT || "/app";
const OUT = process.env.OUT || path.join(ROOT, "docs/open/DEVELOPMENT_APP_2026-11-20");

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".next")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, acc);
    else if (exts.some((x) => e.name.endsWith(x)) && fs.statSync(p).size > 0) acc.push(p);
  }
  return acc;
}
const rel = (f) => f.replace(ROOT + "/", "");

// ---------- CSS parser ----------
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ""); }
function parseCss(text, onDecl, onFontFace, onAtStmt) {
  text = stripComments(text);
  function scan(src, ctx) {
    let buf = ""; let i = 0; let paren = 0; let q = null;
    const n = src.length;
    while (i < n) {
      const c = src[i];
      if (q) { buf += c; if (c === "\\") { buf += src[i + 1] || ""; i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; buf += c; i++; continue; }
      if (c === "(") paren++; if (c === ")") paren = Math.max(0, paren - 1);
      if (c === "{" && paren === 0) {
        // find matching }
        let d = 1, j = i + 1, qq = null;
        while (j < n && d > 0) { const cj = src[j]; if (qq) { if (cj === "\\") j++; else if (cj === qq) qq = null; } else if (cj === '"' || cj === "'") qq = cj; else if (cj === "{") d++; else if (cj === "}") d--; j++; }
        const inner = src.slice(i + 1, j - 1);
        const prelude = buf.trim().replace(/\s+/g, " ");
        if (/^@font-face/i.test(prelude)) { onFontFace(inner, ctx); } else scan(inner, ctx.concat(prelude));
        buf = ""; i = j; continue;
      }
      if (c === ";" && paren === 0) { handleDecl(buf, ctx); buf = ""; i++; continue; }
      buf += c; i++;
    }
    if (buf.trim()) handleDecl(buf, ctx);
  }
  function handleDecl(b, ctx) {
    b = b.trim(); if (!b) return;
    if (b.startsWith("@")) { onAtStmt && onAtStmt(b, ctx); return; }
    const m = b.match(/^(--[\w-]+|[a-z-]+)\s*:\s*([\s\S]+)$/i);
    if (!m) return;
    onDecl(m[1], m[2].trim().replace(/\s+/g, " ").replace(/\s*!important$/, ""), ctx);
  }
  scan(text, []);
}

// ---------- classification ----------
const SHADCN = new Set("background foreground card card-foreground popover popover-foreground primary primary-foreground secondary secondary-foreground muted muted-foreground accent accent-foreground destructive destructive-foreground border input ring radius chart-1 chart-2 chart-3 chart-4 chart-5".split(" "));
const FAMILY_NOTES = {
  shadcn: "shadcn/ui semantic set (HSL triplets or colours): background, foreground, primary, border...",
  ig: "innergathering (--ig-*)", dm: "danamccool site.css (--dm-*)", pts: "sunjay Para Theater (--pts-*)", he: "hidden-enneagram (--he-*)",
  blk: "shared blocks tokens (--blk-*), @elkdonis/blocks/blocks.css", frm: "site forms / studio forms (--frm-*)", fld: "field kit / wizard fields (--fld-*)",
  ktp: "katie the potter (--ktp-*)", sf: "cms-ui surface (--sf-*)", "eac-surface": "cms-ui surface tokens (--eac-surface-*)", eac: "network-wide --eac-* roles",
  site: "site-style schema vars (--site-*)", "tw-color": "Tailwind @theme colour scale", "tw-font": "Tailwind @theme font stacks", "tw-radius": "Tailwind @theme radii", "tw-shadow": "Tailwind @theme shadows", "tw-other": "Tailwind @theme other",
  font: "next/font CSS variables (--font-*)", color: "Tailwind v4 colour utilities (--color-*)",
};
function familyOf(name, atTheme) {
  const n = name.slice(2);
  if (SHADCN.has(n) || /^sidebar(-|$)/.test(n)) return "shadcn";
  if (atTheme) { const seg = n.split("-")[0]; return "tw-" + (["color", "font", "radius", "shadow"].includes(seg) ? seg : "other"); }
  const seg = n.split("-");
  if (["eac", "site"].includes(seg[0]) && seg[1]) return seg[0] === "eac" && ["surface", "block", "form"].includes(seg[1]) ? seg[0] + "-" + seg[1] : seg[0];
  return seg[0];
}
function kindOf(name, value) {
  const v = value.trim();
  if (/^var\(/.test(v)) return /font/.test(name) ? "font" : "alias";
  if (/gradient\(/.test(v) && /(bg|background|band)/.test(name)) return "background";
  if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\(|color-mix\()/i.test(v)) return "color";
  if (/^-?\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%(\s*\/\s*[\d.]+%?)?$/.test(v)) return "hsl-triplet";
  if (/^[a-z]+$/i.test(v) && /^(white|black|transparent|currentcolor|red|blue|green|gold|gray|grey|none)$/i.test(v)) return v === "none" ? "other" : "color";
  if (/font|family|serif|sans-serif|monospace/.test(name) && /[A-Za-z]/.test(v)) return "font";
  if (/(^|[\s,'"])(serif|sans-serif|monospace|system-ui|cursive)\b/i.test(v) || /^["'][A-Z][\w ]+["']\s*,/.test(v)) return "font";
  if (/shadow/.test(name) || /^\s*(inset\s+)?-?\d+(px)?\s+-?\d+(px)?\s+-?\d+(px)?/.test(v) && /rgba|#|hsl/.test(v)) return "shadow";
  if (/^-?\d*\.?\d+(px|rem|em|%|vw|vh|dvh|ch|svh)?$/.test(v) || /^(calc|clamp|min|max)\(/.test(v)) return "length";
  if (/^-?\d*\.?\d+(ms|s)$/.test(v) || /cubic-bezier|ease/.test(v)) return "timing";
  return "other";
}
function isDark(ctx) { return ctx.some((c) => /dark/i.test(c)); }

function scanCss(file, bucket, notes) {
  const text = fs.readFileSync(file, "utf8");
  const seen = new Set();
  parseCss(text,
    (name, value, ctx) => {
      if (name.startsWith("--")) {
        if (/^--tw-/.test(name)) return;
        const sel = ctx[ctx.length - 1] || "";
        const atTheme = ctx.some((c) => /^@theme/.test(c));
        const key = name + "|" + value + "|" + ctx.join(">");
        if (seen.has(key)) return; seen.add(key);
        bucket.vars.push({
          name, value: value.length > 160 ? value.slice(0, 157) + "..." : value, kind: kindOf(name, value), family: familyOf(name, atTheme),
          file: rel(file), scope: ctx.join(" > ") || "(top)", selector: sel, dark: isDark(ctx), atTheme,
          ...(/^var\(--[\w-]+\)$/.test(value) ? { aliasOf: value.slice(4, -1) } : {}),
        });
      } else if (name === "font-family" && ctx.length) {
        const sel = ctx[ctx.length - 1];
        if (/^(html|body|:root|h1|h1, h2|\.font-|\*|html, body|body, html)/i.test(sel) || /^(html|body)\b/.test(sel)) bucket.fontRules.push({ selector: sel, family: value.slice(0, 140), file: rel(file) });
      }
    },
    (inner, ctx) => {
      const m = inner.match(/font-family\s*:\s*([^;]+)/i);
      if (m) bucket.fontFaces.push({ family: m[1].trim().replace(/^["']|["']$/g, ""), file: rel(file), src: ((inner.match(/url\(([^)]+)\)/) || [])[1] || "").replace(/["']/g, "").slice(0, 100) });
    },
    (stmt) => {
      const m = stmt.match(/^@import\s+(?:url\()?["']?([^"')\s;]+)/i);
      if (m) { bucket.imports.push({ spec: m[1], file: rel(file) }); }
      const m2 = stmt.match(/^@source\s+["']([^"']+)/i);
      if (m2) bucket.sources.push({ spec: m2[1], file: rel(file) });
    });
}
const newBucket = () => ({ vars: [], fontRules: [], fontFaces: [], imports: [], sources: [] });

// ---------- TS evaluation (reused tiny evaluator) ----------
function parseTs(f) { const t = fs.readFileSync(f, "utf8"); return { text: t, sf: ts.createSourceFile(f, t, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS) }; }
function evalLiteral(node, sf, consts, depth = 0) {
  if (!node || depth > 20) return undefined;
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral: case ts.SyntaxKind.NoSubstitutionTemplateLiteral: return node.text;
    case ts.SyntaxKind.NumericLiteral: return Number(node.text);
    case ts.SyntaxKind.TrueKeyword: return true; case ts.SyntaxKind.FalseKeyword: return false;
    case ts.SyntaxKind.ParenthesizedExpression: case ts.SyntaxKind.AsExpression: case ts.SyntaxKind.SatisfiesExpression: return evalLiteral(node.expression, sf, consts, depth + 1);
    case ts.SyntaxKind.TemplateExpression: { let s = node.head.text; for (const sp of node.templateSpans) { const v = evalLiteral(sp.expression, sf, consts, depth + 1); s += (typeof v === "string" || typeof v === "number" ? v : "${…}") + sp.literal.text; } return s; }
    case ts.SyntaxKind.Identifier: return consts.has(node.text) ? evalLiteral(consts.get(node.text), sf, consts, depth + 1) : undefined;
    case ts.SyntaxKind.ArrayLiteralExpression: return node.elements.map((e) => ts.isSpreadElement(e) ? undefined : evalLiteral(e, sf, consts, depth + 1));
    case ts.SyntaxKind.ObjectLiteralExpression: { const o = {}; for (const p of node.properties) { if (ts.isPropertyAssignment(p)) { const k = p.name.text !== undefined ? p.name.text : p.name.getText(); o[k] = evalLiteral(p.initializer, sf, consts, depth + 1); } else if (ts.isShorthandPropertyAssignment(p)) o[p.name.text] = evalLiteral(p.name, sf, consts, depth + 1); } return o; }
    case ts.SyntaxKind.PropertyAccessExpression: { const o = evalLiteral(node.expression, sf, consts, depth + 1); return o && o[node.name.text]; }
    default: return undefined;
  }
}
function exportedLiteral(file, name) {
  if (!fs.existsSync(file)) return undefined;
  const { sf } = parseTs(file);
  const consts = new Map();
  for (const st of sf.statements) if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, d.initializer);
  return consts.has(name) ? evalLiteral(consts.get(name), sf, consts) : undefined;
}

// ---------- apps ----------
const appsDir = path.join(ROOT, "apps");
const apps = fs.readdirSync(appsDir).filter((a) => fs.existsSync(path.join(appsDir, a, "src")));
const result = { generated: new Date().toISOString(), apps: {}, packages: {}, families: {} };

// editor declarations
const EDITORS = {
  sunjay: { editor: "Site style (SiteStyleEditor, floating button)", schema: ["src/lib/site-style-schema.ts", "SITE_STYLE"], storeLib: "src/lib/site-style.ts" },
  elktours: { editor: "Site style (SiteStyleEditor, floating button)", schema: ["src/lib/site-style-schema.ts", "SITE_STYLE"], storeLib: "src/lib/site-style.ts" },
  "hidden-enneagram": { editor: "Site style (SiteStyleEditor) + /manage/site", schema: ["src/lib/site-style-schema.ts", "SITE_STYLE"], storeLib: "src/lib/site-style.ts" },
  innergathering: { editor: "Site style (SiteStyleEditor)", schema: ["src/lib/site-style-schema.ts", "SITE_STYLE"], storeLib: "src/lib/site-style.ts" },
  "katie-the-potter": { editor: "Site style (SiteStyleEditor)", schema: ["src/lib/site-style-schema.ts", "SITE_STYLE"], storeLib: "src/lib/site-style.ts" },
  "art-auction": { editor: "Site style (SiteStyleEditor)", schema: ["src/lib/site-style-schema.ts", "SITE_STYLE"], storeLib: "src/lib/site-style.ts" },
  danamccool: { editor: "Theme tab of the studio (palette roles + fonts; /studio/theme)", schema: null, storeLib: "src/lib/theme-store.ts" },
  "arts-collective": { editor: "AppearancePanel / MyAppearancePanel (CssPanel from @elkdonis/live-editor), per-org and per-page scope", schema: ["src/lib/theme-tokens.ts", "SITE_THEME_VARS"], storeLib: null },
  ifac: { editor: "AppearanceCard (CssPanel) with IFAC_THEME_VARS; hub skin picker (basic/salon)", schema: ["src/lib/theme-tokens.ts", "IFAC_THEME_VARS"], storeLib: null },
};
function storeFromSource(app, e) {
  const o = { tables: [] };
  if (e.storeLib) {
    const f = path.join(appsDir, app, e.storeLib);
    if (fs.existsSync(f)) {
      const t = fs.readFileSync(f, "utf8");
      if (/site_themes|saveSiteTheme|getThemeOverrides/.test(t)) o.tables.push("site_themes (org_id, page_key '' = whole site)");
      for (const m of t.matchAll(/(?:const\s+\w*KEY\w*\s*=\s*|key\s*=\s*)["']([a-z][\w:-]+)["']/gi)) o.tables.push("site_config key '" + m[1] + "'");
      const orgM = t.match(/org_id\s*=\s*\$\{(\w+)/);
      o.orgFrom = orgM ? orgM[1] : null;
    }
  }
  return o;
}

const globalPkgFamilies = {};
for (const app of apps) {
  const base = path.join(appsDir, app);
  const bucket = newBucket();
  const cssFiles = [...walk(path.join(base, "src"), [".css"]), ...(fs.existsSync(path.join(base, "tailwind.config.ts")) ? [] : [])];
  cssFiles.filter((f) => !/\.module\.css$/.test(f) || true).forEach((f) => scanCss(f, bucket));
  // package css imported from TS/TSX/CSS
  const pkgCss = new Set();
  for (const f of walk(path.join(base, "src"), [".ts", ".tsx"])) {
    const t = fs.readFileSync(f, "utf8");
    for (const m of t.matchAll(/import\s+["'](@elkdonis\/[^"']+\.css)["']/g)) pkgCss.add(m[1]);
  }
  for (const i of bucket.imports) if (/@elkdonis\//.test(i.spec)) pkgCss.add(i.spec);
  // next/font in layout files
  const fonts = [];
  for (const f of walk(path.join(base, "src"), [".tsx", ".ts"]).filter((x) => fs.readFileSync(x, "utf8").includes("next/font/") || fs.readFileSync(x, "utf8").includes("fonts.googleapis.com/css2") || x.endsWith("app/layout.tsx") || x.endsWith("lib/fonts.ts"))) {
    const t = fs.readFileSync(f, "utf8");
    for (const m of t.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']next\/font\/(google|local)["']/g)) {
      const names = m[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const nm of names) {
        const call = new RegExp(nm + "\\(\\{([\\s\\S]*?)\\}\\)", "g");
        for (const c of t.matchAll(call)) {
          const v = (c[1].match(/variable\s*:\s*["']([^"']+)/) || [])[1];
          fonts.push({ role: v || "(no css variable)", family: nm.replace(/_/g, " "), source: "next/font/" + m[2], file: rel(f) });
        }
      }
    }
    for (const m of t.matchAll(/fonts\.googleapis\.com\/css2\?family=([^"'`&]+)/g)) fonts.push({ role: "stylesheet <link>", family: decodeURIComponent(m[1]).replace(/\+/g, " "), source: "Google Fonts link", file: rel(f) });
  }
  for (const ff of bucket.fontFaces) fonts.push({ role: "@font-face", family: ff.family, source: ff.src || "local", file: ff.file });
  for (const gi of bucket.imports) if (/fonts\.googleapis/.test(gi.spec)) fonts.push({ role: "@import", family: decodeURIComponent((gi.spec.match(/family=([^&]+)/) || [, "?"])[1]).replace(/\+/g, " "), source: "Google Fonts @import", file: gi.file });
  // fonts declared in the site-style schema (a font var's default / fonts[])
  const ed = EDITORS[app];
  const editable = [];
  let schemaFile = null; let schemaFonts = [];
  if (ed && ed.schema) {
    const f = path.join(base, ed.schema[0]); schemaFile = rel(f);
    const sch = exportedLiteral(f, ed.schema[1]);
    const vars = (Array.isArray(sch) ? sch : sch && sch.vars) || undefined;
    if (Array.isArray(vars)) for (const v of vars.filter(Boolean)) if (v && v.name) editable.push({ name: v.name, label: v.label, group: v.group, kind: v.kind || v.type, default: v.default, hint: v.hint });
    if (sch && Array.isArray(sch.fonts)) schemaFonts = sch.fonts.filter(Boolean).map((x) => ({ label: x.label, stack: x.stack, google: x.google }));
    if (sch && sch.chrome) result._chrome = result._chrome || {}, result._chrome[app] = Object.fromEntries(Object.entries(sch.chrome).map(([k, v]) => [k, Object.keys(v.parts || {})]));
  }
  // danamccool: palette roles
  let paletteRoles = null;
  if (app === "danamccool") {
    const pr = exportedLiteral(path.join(base, "src/lib/theme.ts"), "PALETTE_ROLES");
    if (Array.isArray(pr)) {
      paletteRoles = pr.filter(Boolean).map((r) => ({ key: r.key, label: r.label, group: r.group, vars: r.vars, fallback: r.fallback, follows: r.follows }));
      for (const r of paletteRoles) for (const vn of r.vars || []) editable.push({ name: vn, label: r.label, group: "palette:" + r.group, kind: "color", default: r.fallback, hint: "role " + r.key });
    }
    const fl = path.join(base, "src/lib/fonts.ts");
    if (fs.existsSync(fl)) { const t = fs.readFileSync(fl, "utf8"); const fm = [...t.matchAll(/["']([A-Z][A-Za-z0-9 ]+)["']\s*[,:\]]/g)].map((m) => m[1]); schemaFonts = [...new Set(fm)].slice(0, 40).map((x) => ({ label: x })); }
  }
  // merge: mark CSS vars editable
  const editMap = new Map(editable.map((e) => [e.name, e]));
  for (const v of bucket.vars) if (editMap.has(v.name)) { v.editable = true; v.editorLabel = editMap.get(v.name).label; }
  // editor-only vars not found in CSS
  const cssNames = new Set(bucket.vars.map((v) => v.name));
  for (const e of editable) if (!cssNames.has(e.name)) bucket.vars.push({ name: e.name, value: String(e.default ?? ""), kind: kindOf(e.name, String(e.default ?? "")), family: familyOf(e.name, false), file: schemaFile || "(editor schema)", scope: "(editor default only; not declared in the app's CSS)", selector: "", dark: false, atTheme: false, editable: true, editorLabel: e.label, schemaOnly: true });
  // families
  const fam = {};
  for (const v of bucket.vars) { const f = (fam[v.family] = fam[v.family] || { id: v.family, prefix: "--" + v.family + "-", count: 0, colors: 0, fonts: 0, lengths: 0, dark: 0, editable: 0, files: new Set() }); f.count++; if (/color|hsl-triplet|background/.test(v.kind)) f.colors++; if (v.kind === "font") f.fonts++; if (v.kind === "length") f.lengths++; if (v.dark) f.dark++; if (v.editable) f.editable++; f.files.add(v.file); }
  const families = Object.values(fam).map((f) => ({ ...f, files: [...f.files], description: FAMILY_NOTES[f.id] || "" })).sort((a, b) => b.count - a.count);
  // light/dark
  const darkRows = bucket.vars.filter((v) => v.dark);
  const darkScopes = [...new Set(darkRows.map((v) => v.selector + (v.scope.includes("@media") ? " [media]" : "")))].slice(0, 10);
  const colorSchemeUse = (() => { try { return walk(path.join(base, "src"), [".tsx", ".ts"]).some((f) => /next-themes|data-theme=|classList\.(add|toggle)\(["']dark/.test(fs.readFileSync(f, "utf8"))); } catch { return false; } })();
  const store = ed ? storeFromSource(app, ed) : { tables: [] };
  if (ed && !store.tables.length) store.tables.push("site_themes (org_id, page_key) via @elkdonis/services getThemeOverrides/saveSiteTheme" + (app === "ifac" ? "; page keys '' (whole site) and 'hub'" : "; page_key '' = org default, or one page"));
  if (app === "ifac") store.extra = "hub skin (basic|salon) stored separately (apps/ifac/src/lib/hub-skin-store)";
  const varMap = {};
  for (const v of bucket.vars) if (!v.dark && !v.atTheme && /^(:root|html|:root, html|html, :root|\.light|body)(\b|$)/.test(v.selector || "")) if (!(v.name in varMap)) varMap[v.name] = v.value;
  for (const v of bucket.vars) if (v.atTheme && !(v.name in varMap)) varMap[v.name] = v.value;
  const fontMap = {};
  for (const f of fonts) if (f.role && f.role.startsWith("--")) fontMap[f.role] = f.family;
  result.apps[app] = {
    id: app, label: app, source: bucket.vars.length ? bucket.vars[0].file : null,
    families: families.map(({ files, ...r }) => ({ ...r, fileCount: files.length, files: files.slice(0, 6) })),
    vars: bucket.vars,
    varMap, fontMap,
    counts: { total: bucket.vars.length, colours: bucket.vars.filter((v) => /color|hsl-triplet|background/.test(v.kind)).length, fonts: fonts.length, fontVars: bucket.vars.filter((v) => v.kind === "font").length, lengths: bucket.vars.filter((v) => v.kind === "length").length, dark: darkRows.length, editable: editable.length, files: new Set(bucket.vars.map((v) => v.file)).size },
    fonts, fontRules: bucket.fontRules.slice(0, 20), schemaFonts,
    editor: ed ? ed.editor : "none", editedBy: ed ? ed.editor : "none",
    store: ed ? { ...store, schemaFile, chrome: result._chrome && result._chrome[app] ? "site_config 'site-style:chrome' (header/footer parts: " + JSON.stringify(result._chrome[app]) + ")" : null } : null,
    lightDark: { darkVarRows: darkRows.length, darkScopes, toggleCodePresent: colorSchemeUse, note: darkRows.length ? "declares dark variants" : "no dark variants declared" },
    packageCss: [...pkgCss].sort(),
    paletteRoles,
    notes: app === "danamccool" ? ["Fonts are chosen per role in /studio/theme and stored in site_config 'theme:fonts' (lib/fonts.ts): --dm-font-body, --dm-font-heading, --dm-font-nav, --dm-font-caption, --dm-font-reading; a page can override body and heading in its Page settings.", "The palette writes the app's OWN variables first (--violet, --ink, ...) then the Tailwind kit names (--color-*), as an unlayered :root style."] : app === "ifac" ? ["Own palette vocabulary (--ink/--paper/--oxide), not shadcn; fonts from a Google <link> in components/site/chrome.tsx; hub has two skins (basic, salon) that are CSS rules, not variables."] : app === "sunjay" ? ["Site style writes shadcn HSL triplets on :root plus --site-font-body/--site-font-heading (applied to body and h1-h4 directly); globals.css uses next/font variables (--font-spectral, --font-fraunces)."] : app === "development" ? ["B's new app; own --dev-* variables."] : [],
    tailwind: { postcss: fs.existsSync(path.join(base, "postcss.config.mjs")), configFile: fs.existsSync(path.join(base, "tailwind.config.ts")), atTheme: bucket.vars.some((v) => v.atTheme) },
  };
}
delete result._chrome;

// ---------- packages ----------
const pkgsDir = path.join(ROOT, "packages");
for (const p of fs.readdirSync(pkgsDir)) {
  const b = newBucket();
  const files = walk(path.join(pkgsDir, p, "src"), [".css"]);
  if (!files.length) continue;
  files.forEach((f) => scanCss(f, b));
  const fam = {};
  for (const v of b.vars) { fam[v.family] = fam[v.family] || { id: v.family, count: 0 }; fam[v.family].count++; }
  result.packages[p] = { id: p, cssFiles: files.map(rel), families: Object.values(fam).sort((a, c) => c.count - a.count).map((f) => ({ ...f, description: FAMILY_NOTES[f.id] || "" })), counts: { total: b.vars.length, colours: b.vars.filter((v) => /color|hsl-triplet|background/.test(v.kind)).length, dark: b.vars.filter((v) => v.dark).length }, vars: b.vars, fontFaces: b.fontFaces };
}
// shared editor schemas in packages
const bs = path.join(ROOT, "packages/blocks/src/contract.ts");
result.packages.blocks = result.packages.blocks || { id: "blocks" };
result.packages.blocks.blockTokens = (exportedLiteral(bs, "BLOCK_TOKENS") || []).filter(Boolean);

// ---------- family cross-index ----------
for (const [a, ar] of Object.entries(result.apps)) for (const f of ar.families) { const x = (result.families[f.id] = result.families[f.id] || { id: f.id, description: f.description, apps: {}, total: 0 }); x.apps[a] = f.count; x.total += f.count; }
for (const [p, pr] of Object.entries(result.packages)) for (const f of pr.families || []) { const x = (result.families[f.id] = result.families[f.id] || { id: f.id, description: f.description, apps: {}, total: 0 }); x.packages = x.packages || {}; x.packages[p] = f.count; }

const EXTRA = {
  ifac: ["site-theme-save: site_themes per page_key ('' site, 'hub')", "user-theme-save: users.theme (a member's own profile look)", "hub-skin-save: site_config 'hub-skin' (basic|salon)"],
  "arts-collective": ["site-theme-save / user-theme-save: site_themes and users.theme; also hosts site-style-save for org sites"],
  artdirect: ["setPageBackgroundAction: users.theme['--oad-page-bg'] (one dark page colour per person; no editor panel app-wide)"],
  forum: ["reader prefs (theme, light/dark, text size, layout) are COOKIES forum_theme/forum_mode/forum_size/forum_layout, not DB"],
  elktours: ["forum reader prefs also cookies (forum_theme...), plus Site style"],
  danamccool: ["site-theme-save bypasses @elkdonis/services: its own site_config keys (theme:palette, theme:fonts)"],
};
for (const [a, x] of Object.entries(EXTRA)) if (result.apps[a]) { result.apps[a].store = result.apps[a].store || { tables: [] }; result.apps[a].store.otherStores = x; }
fs.writeFileSync(path.join(OUT, "themes.json"), JSON.stringify(result, null, 1));
console.log("apps", Object.keys(result.apps).length, "packages", Object.keys(result.packages).length, "families", Object.keys(result.families).length);
for (const [a, r] of Object.entries(result.apps)) console.log(a.padEnd(24), JSON.stringify(r.counts), r.families.slice(0, 5).map((f) => f.id + ":" + f.count).join(" "), "| editor:", r.editor.slice(0, 30), "| stores:", (r.store ? r.store.tables.join(";") : "-").slice(0, 70));
