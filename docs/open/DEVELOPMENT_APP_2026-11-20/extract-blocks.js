// Static extractor: finds defineBlock() calls and Puck `components:` literals, evaluates declarations (no imports of app code).
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const ROOT = process.env.ROOT || "/app";
const OUT = process.env.OUT || path.join(ROOT, "docs/open/DEVELOPMENT_APP_2026-11-20");
const UNK = { $unresolved: true };
const cache = new Map();
function parse(file) {
  if (cache.has(file)) return cache.get(file);
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const info = { file, text, sf, consts: new Map(), imports: new Map(), exports: new Map(), reexports: [] };
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      const exp = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) { info.consts.set(d.name.text, d.initializer); if (exp) info.exports.set(d.name.text, d.name.text); }
    } else if (ts.isImportDeclaration(st) && st.importClause) {
      const spec = st.moduleSpecifier.text;
      const c = st.importClause;
      if (c.name) info.imports.set(c.name.text, { spec, name: "default" });
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) for (const e of c.namedBindings.elements) info.imports.set(e.name.text, { spec, name: (e.propertyName || e.name).text });
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier) {
      const spec = st.moduleSpecifier.text;
      if (st.exportClause && ts.isNamedExports(st.exportClause)) for (const e of st.exportClause.elements) info.exports.set(e.name.text, { spec, name: (e.propertyName || e.name).text });
      else info.reexports.push(spec);
    } else if (ts.isFunctionDeclaration(st) && st.name) { info.consts.set(st.name.text, st); }
  }
  cache.set(file, info);
  return info;
}
function tryFile(base) {
  for (const c of [base, base + ".ts", base + ".tsx", base + "/index.ts", base + "/index.tsx", base.replace(/\.js$/, ".ts"), base.replace(/\.js$/, ".tsx")]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
function appOf(file) { const m = file.replace(ROOT + "/", "").match(/^apps\/([^/]+)\//); return m ? m[1] : null; }
function resolveSpec(spec, from) {
  if (spec.startsWith(".")) return tryFile(path.resolve(path.dirname(from), spec));
  if (spec.startsWith("@/")) { const a = appOf(from); return a ? tryFile(path.join(ROOT, "apps", a, "src", spec.slice(2))) : null; }
  const m = spec.match(/^@elkdonis\/([^/]+)(?:\/(.+))?$/);
  if (m) {
    const pk = path.join(ROOT, "packages", m[1]);
    if (m[2]) return tryFile(path.join(pk, "src", m[2])) || tryFile(path.join(pk, m[2]));
    return tryFile(path.join(pk, "src/index"));
  }
  return null;
}
function lookupExport(file, name, depth = 0, seen = new Set()) {
  if (!file || depth > 8) return null;
  const key = file + "#" + name; if (seen.has(key)) return null; seen.add(key);
  const info = parse(file);
  if (info.consts.has(name) && (info.exports.has(name) || true)) return { info, node: info.consts.get(name) };
  const ex = info.exports.get(name);
  if (ex && typeof ex === "object") { const f = resolveSpec(ex.spec, file); const r = lookupExport(f, ex.name, depth + 1, seen); if (r) return r; }
  for (const spec of info.reexports) { const f = resolveSpec(spec, file); const r = lookupExport(f, name, depth + 1, seen); if (r) return r; }
  const imp = info.imports.get(name);
  if (imp) { const f = resolveSpec(imp.spec, file); return lookupExport(f, imp.name, depth + 1, seen); }
  return null;
}
function unresolved(node, why) { return { $unresolved: (why || node.getText().replace(/\s+/g, " ")).slice(0, 120) }; }
function ev(node, info, depth = 0) {
  if (depth > 25) return unresolved(node, "depth");
  if (!node) return undefined;
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral: case ts.SyntaxKind.NoSubstitutionTemplateLiteral: return node.text;
    case ts.SyntaxKind.NumericLiteral: return Number(node.text);
    case ts.SyntaxKind.TrueKeyword: return true;
    case ts.SyntaxKind.FalseKeyword: return false;
    case ts.SyntaxKind.NullKeyword: return null;
    case ts.SyntaxKind.ParenthesizedExpression: case ts.SyntaxKind.AsExpression: case ts.SyntaxKind.SatisfiesExpression: case ts.SyntaxKind.NonNullExpression: case ts.SyntaxKind.TypeAssertionExpression:
      return ev(node.expression, info, depth + 1);
    case ts.SyntaxKind.PrefixUnaryExpression: { const v = ev(node.operand, info, depth + 1); return node.operator === ts.SyntaxKind.MinusToken && typeof v === "number" ? -v : unresolved(node); }
    case ts.SyntaxKind.TemplateExpression: {
      let s = node.head.text; let ok = true;
      for (const sp of node.templateSpans) { const v = ev(sp.expression, info, depth + 1); if (typeof v === "string" || typeof v === "number") s += v; else { ok = false; s += "${…}"; } s += sp.literal.text; }
      return ok ? s : s;
    }
    case ts.SyntaxKind.BinaryExpression: {
      if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) { const a = ev(node.left, info, depth + 1), b = ev(node.right, info, depth + 1); if (typeof a === "string" && typeof b === "string") return a + b; }
      return unresolved(node);
    }
    case ts.SyntaxKind.ArrayLiteralExpression: {
      const out = [];
      for (const e of node.elements) {
        if (ts.isSpreadElement(e)) { const v = ev(e.expression, info, depth + 1); if (Array.isArray(v)) out.push(...v); else out.push(unresolved(e)); } else out.push(ev(e, info, depth + 1));
      }
      return out;
    }
    case ts.SyntaxKind.ObjectLiteralExpression: {
      const out = {};
      for (const p of node.properties) {
        if (ts.isPropertyAssignment(p)) {
          let k = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name) ? p.name.text : null;
          if (k == null && ts.isComputedPropertyName(p.name)) { const kv = ev(p.name.expression, info, depth + 1); k = typeof kv === "string" ? kv : null; }
          if (k == null) continue;
          out[k] = ev(p.initializer, info, depth + 1);
        } else if (ts.isShorthandPropertyAssignment(p)) out[p.name.text] = ev(p.name, info, depth + 1);
        else if (ts.isSpreadAssignment(p)) { const v = ev(p.expression, info, depth + 1); if (v && typeof v === "object" && !Array.isArray(v) && !v.$unresolved) Object.assign(out, v); else out["$spread:" + p.expression.getText().slice(0, 40)] = UNK; }
        else if (ts.isMethodDeclaration(p)) out[p.name.getText()] = { $fn: true };
      }
      return out;
    }
    case ts.SyntaxKind.Identifier: {
      const n = node.text;
      if (n === "undefined") return undefined;
      const r = lookupExport(info.file, n);
      if (!r) return unresolved(node);
      if (ts.isFunctionDeclaration(r.node) || ts.isArrowFunction(r.node) || ts.isFunctionExpression(r.node)) return { $fn: n };
      return ev(r.node, r.info, depth + 1);
    }
    case ts.SyntaxKind.PropertyAccessExpression: {
      const o = ev(node.expression, info, depth + 1);
      if (o && typeof o === "object" && !o.$unresolved && node.name.text in o) return o[node.name.text];
      if (Array.isArray(o) && node.name.text === "length") return o.length;
      return unresolved(node);
    }
    case ts.SyntaxKind.ElementAccessExpression: {
      const o = ev(node.expression, info, depth + 1), k = ev(node.argumentExpression, info, depth + 1);
      if (o && typeof o === "object" && !o.$unresolved && (typeof k === "string" || typeof k === "number") && k in o) return o[k];
      return unresolved(node);
    }
    case ts.SyntaxKind.CallExpression: {
      // def(...) helper used by BOX_BLOCKS and `.map(...)` forms are not evaluated here
      const callee = node.expression.getText();
      if (callee === "Object.freeze") return ev(node.arguments[0], info, depth + 1);
      if (ts.isIdentifier(node.expression)) {
        const r = lookupExport(info.file, node.expression.text);
        if (r && (ts.isArrowFunction(r.node) || ts.isFunctionDeclaration(r.node) || ts.isFunctionExpression(r.node))) {
          const fn = r.node;
          const env = Object.assign({}, info.__env || {});
          fn.parameters.forEach((p, i) => {
            const a = node.arguments[i];
            env[p.name.getText()] = a ? ev(a, info, depth + 1) : (p.initializer ? ev(p.initializer, { ...r.info, __env: env }, depth + 1) : undefined);
          });
          let expr = null;
          if (fn.body && !ts.isBlock(fn.body)) expr = fn.body;
          else if (fn.body) { const ret = fn.body.statements.filter(ts.isReturnStatement).pop(); expr = ret && ret.expression; }
          if (expr) return ev(expr, { ...r.info, __env: env }, depth + 1);
        }
      }
      return unresolved(node);
    }
    case ts.SyntaxKind.ArrowFunction: case ts.SyntaxKind.FunctionExpression: return { $fn: true };
    default: return unresolved(node);
  }
}
// env support: identifiers that are params
const _ev = ev;
ev = function (node, info, depth) {
  if (node && node.kind === ts.SyntaxKind.Identifier && info.__env && node.text in info.__env) return info.__env[node.text];
  return _ev(node, info, depth);
};

// ---------- walk files ----------
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".next") || e.name === "harness" || e.name === "dist") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const files = [];
for (const a of fs.readdirSync(path.join(ROOT, "apps"))) { const s = path.join(ROOT, "apps", a, "src"); if (fs.existsSync(s)) walk(s, files); }
for (const p of ["blocks", "direct-edit"]) { const s = path.join(ROOT, "packages", p, "src"); if (fs.existsSync(s)) walk(s, files); }

function ownerOf(file) {
  const rel = file.replace(ROOT + "/", "");
  let m = rel.match(/^apps\/([^/]+)\//); if (m) return { kind: "app", name: m[1] };
  m = rel.match(/^packages\/([^/]+)\//); if (m) return { kind: "package", name: m[1] };
  return { kind: "?", name: "?" };
}
function lineOf(info, node) { return info.sf.getLineAndCharacterOfPosition(node.getStart()).line + 1; }

// follow Component identifier to the file that defines it (for imports analysis)
function componentFile(argNode, info) {
  if (!argNode) return null;
  if (!ts.isIdentifier(argNode)) return info.file;
  const n = argNode.text;
  if (info.consts.has(n)) return info.file;
  const imp = info.imports.get(n);
  if (imp) return resolveSpec(imp.spec, info.file) || null;
  // function declarations / classes
  return info.file;
}
function reachable(file, depth = 3, seen = new Set()) {
  if (!file || seen.has(file) || depth < 0) return [];
  seen.add(file);
  const info = parse(file);
  const out = [info];
  for (const st of info.sf.statements) {
    if (ts.isImportDeclaration(st) || (ts.isExportDeclaration(st) && st.moduleSpecifier)) {
      const spec = st.moduleSpecifier.text;
      if (spec.startsWith(".")) { const f = resolveSpec(spec, file); if (f) out.push(...reachable(f, depth - 1, seen)); }
    }
  }
  return out;
}
function analyseSource(compFile) {
  const infos = reachable(compFile, 2);
  const specs = new Set(); const flags = new Set(); const css = new Set();
  for (const inf of infos) {
    for (const st of inf.sf.statements) {
      if (ts.isImportDeclaration(st)) { const sp = st.moduleSpecifier.text; if (!sp.startsWith(".") ) specs.add(sp); else if (/\.css$/.test(sp)) css.add(sp); }
    }
    if (/^\s*["']use client["']/m.test(inf.text.slice(0, 300))) flags.add("use-client");
    if (/\buse[A-Z]\w*Context\b|\bcreateContext\(|\buseContext\(/.test(inf.text)) flags.add("react-context");
    if (/\buse(Router|Pathname|SearchParams|Params)\(/.test(inf.text)) flags.add("next-router-hooks");
  }
  const s = [...specs];
  return {
    imports: s.filter((x) => !/^react($|\/)/.test(x)).sort(),
    appLocal: s.filter((x) => x.startsWith("@/")),
    db: s.some((x) => new RegExp('@elkdonis\/db|server-only|^pg$|@elkdonis\/(auth-server|nextcloud)|@elkdonis\/[a-z-]+\/server').test(x)),
    next: s.filter((x) => /^next\//.test(x)),
    css: [...css],
    flags: [...flags],
  };
}

const blocks = [];
const offeredByApp = {};
function slotNamesOf(props) { return props.filter((p) => p.kind === "slot").map((p) => p.name); }

function normProp(p) {
  const o = { name: p.name, kind: p.kind, label: p.label };
  for (const k of ["default", "required", "options", "min", "max", "step", "unit", "binds", "format", "inlineEditable", "description", "allow", "summary", "addLabel"]) if (p[k] !== undefined) o[k] = p[k];
  if (o.options && !Array.isArray(o.options)) o.options = "dynamic: " + (o.options.$unresolved || "?"); else if (o.options) o.options = o.options.map((x) => (x && x.value !== undefined ? x.value : x));
  if (Array.isArray(p.fields)) o.fields = p.fields.map(normProp);
  return o;
}
function pushBlock(rec) { blocks.push(rec); }

for (const file of files) {
  const info = parse(file);
  if (!info.text.includes('defineBlock(') && !info.text.includes('components:') && !info.text.includes('Component: ')) continue;
  const own = ownerOf(file);
  const rel = file.replace(ROOT + "/", "");
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineBlock" && node.arguments.length >= 1 && !/\bfunction defineBlock\b/.test(info.text.slice(0, 0))) {
      const def = ev(node.arguments[0], info);
      if (def && typeof def === "object" && typeof def.id === "string") {
        // exported var
        let exportName = null; let p = node.parent;
        while (p && !ts.isVariableDeclaration(p)) p = p.parent;
        if (p && ts.isIdentifier(p.name)) exportName = p.name.text;
        const compNode = node.arguments[1];
        const compFile = componentFile(compNode, info);
        const src = compFile ? analyseSource(compFile) : null;
        const propsRaw = Array.isArray(def.props) ? def.props : [];
        const props = propsRaw.map((x) => (x && x.name ? normProp(x) : { name: "?", kind: "unresolved", label: String((x && x.$unresolved) || x && Object.keys(x)[0] || "?") })).filter(Boolean);
        const unresolvedProps = propsRaw.filter((x) => !x || !x.name).length + (Array.isArray(def.props) ? 0 : 1);
        pushBlock({
          id: def.id, label: def.label, description: def.description, form: "defineBlock",
          owner: own.kind + ":" + own.name, ownerKind: own.kind, ownerName: own.name,
          exportName, file: rel, line: lineOf(info, node), componentName: compNode ? compNode.getText().slice(0, 60) : null,
          componentFile: compFile ? compFile.replace(ROOT + "/", "") : null,
          category: def.category || null, styling: def.styling || null, memberSafe: def.memberSafe ?? null,
          interactive: !!def.interactive, dataDriven: !!def.dataDriven, hasSample: node.arguments.length >= 3,
          props, propCount: props.length, unresolvedProps,
          slots: slotNamesOf(props),
          hasParts: !!def.parts && typeof def.parts === "object" && Object.keys(def.parts).length > 0,
          parts: def.parts && typeof def.parts === "object" ? Object.keys(def.parts).filter((k) => !k.startsWith("$")) : [],
          bindsKinds: [...new Set(props.flatMap((x) => [x.binds, ...(x.fields || []).map((f) => f.binds)]).filter(Boolean))],
          tokens: Array.isArray(def.tokens) ? def.tokens.filter((t) => t && t.name).map((t) => ({ name: t.name, type: t.type, label: t.label })) : [],
          silexRoot: def.silexRoot || null, manipulate: def.manipulate || null, resize: def.resize || null,
          source: src,
        });
      }
    }
    if (ts.isObjectLiteralExpression(node) && !/registry|types.ts$/.test(file)) {
      const dn = node.properties.find((q) => ts.isPropertyAssignment(q) && q.name.getText() === "def");
      const cn = node.properties.find((q) => ts.isPropertyAssignment(q) && q.name.getText() === "Component");
      if (dn && cn && !/^[A-Z_]/.test(dn.initializer.getText().slice(0, 1))) {
        const d = ev(dn.initializer, info);
        if (d && typeof d.id === "string") {
          const props = (Array.isArray(d.props) ? d.props : []).filter((x) => x && x.name).map(normProp);
          const compFile = componentFile(cn.initializer, info);
          const isBox = own.name === "direct-edit";
          pushBlock({
            id: d.id, label: d.label, description: d.description, form: isBox ? "box-block" : "block-literal",
            owner: own.kind + ":" + own.name, ownerKind: own.kind, ownerName: own.name,
            exportName: (() => { let p = node.parent; while (p && !ts.isVariableDeclaration(p)) p = p.parent; return p && ts.isIdentifier(p.name) ? p.name.text : null; })(),
            file: rel, line: lineOf(info, node), componentName: cn.initializer.getText().slice(0, 60), componentFile: compFile ? compFile.replace(ROOT + "/", "") : null,
            category: d.category || null, styling: d.styling || null, memberSafe: d.memberSafe ?? null, interactive: !!d.interactive, dataDriven: !!d.dataDriven, hasSample: false,
            props, propCount: props.length, unresolvedProps: 0, slots: props.filter((p) => p.kind === "slot").map((p) => p.name),
            hasParts: !!d.parts && typeof d.parts === "object" && Object.keys(d.parts).length > 0, parts: d.parts && typeof d.parts === "object" ? Object.keys(d.parts) : [],
            bindsKinds: [], tokens: [], silexRoot: null, manipulate: null, resize: null, source: compFile ? analyseSource(compFile) : null,
            note: isBox ? "Host opts in via blocks: [...SHARED_BLOCKS, ...BOX_BLOCKS], root: BOX_ROOT. Look stored in one look prop." : "Block literal ({def, Component}), not defineBlock.",
          });
        }
      }
    }
    // Puck literal config: components: { Name: { label, fields, defaultProps, render } }
    if (ts.isPropertyAssignment(node) && node.name.getText() === "components" && ts.isObjectLiteralExpression(node.initializer) && /fields\s*:/.test(node.initializer.getText().slice(0, 4000)) && /defaultProps/.test(node.initializer.getText())) {
      for (const comp of node.initializer.properties) {
        if (!ts.isPropertyAssignment(comp)) continue;
        const id = comp.name.getText();
        let ini = comp.initializer; while (ts.isSatisfiesExpression(ini) || ts.isAsExpression(ini)) ini = ini.expression;
        if (!ts.isObjectLiteralExpression(ini)) continue;
        const get = (k) => { const pr = ini.properties.find((q) => ts.isPropertyAssignment(q) && q.name.getText() === k); return pr ? pr.initializer : null; };
        const fieldsNode = get("fields"), dpNode = get("defaultProps");
        const fields = fieldsNode ? ts.isObjectLiteralExpression(fieldsNode) ? fieldsNode.properties.map((f) => {
          if (!ts.isPropertyAssignment(f)) return null;
          const fv = ts.isObjectLiteralExpression(f.initializer) ? ev(f.initializer, info) : ev(f.initializer, info);
          return { name: f.name.getText(), fv, hasCallInit: ts.isCallExpression(f.initializer) ? f.initializer.expression.getText() : null };
        }).filter(Boolean) : [] : [];
        const dp = dpNode ? ev(dpNode, info) : {};
        const kindMap = { text: "string", textarea: "text", number: "number", radio: "select", select: "select", custom: "custom" };
        const props = fields.map(({ name, fv, hasCallInit }) => {
          const t = fv && fv.type;
          const o = { name, kind: kindMap[t] || (hasCallInit ? "select" : "custom"), label: fv && fv.label, puckType: t || (hasCallInit ? "radio (via " + hasCallInit + ")" : "?") };
          if (dp && name in dp && !(dp[name] && dp[name].$unresolved)) o.default = dp[name];
          if (fv && fv.min !== undefined) o.min = fv.min; if (fv && fv.max !== undefined) o.max = fv.max;
          if (fv && Array.isArray(fv.options)) o.options = fv.options.map((x) => x && x.value !== undefined ? x.value : x);
          if (hasCallInit === "yesNo") o.options = [true, false];
          return o;
        });
        const renderNode = get("render");
        const compFile = renderNode ? componentFile(renderNode, info) : null;
        pushBlock({
          id, label: (ev(get("label"), info)) || id, description: null, form: "puck-config",
          owner: own.kind + ":" + own.name, ownerKind: own.kind, ownerName: own.name,
          exportName: null, file: rel, line: lineOf(info, comp), componentName: renderNode ? renderNode.getText().slice(0, 60) : null,
          componentFile: compFile ? compFile.replace(ROOT + "/", "") : null,
          category: null, styling: null, memberSafe: null, interactive: true, dataDriven: true, hasSample: false,
          props, propCount: props.length, unresolvedProps: 0, slots: [], hasParts: false, parts: [], bindsKinds: [], tokens: [],
          silexRoot: null, manipulate: null, resize: null,
          source: compFile ? analyseSource(compFile) : null,
          note: "raw Puck ComponentConfig; page-scoped (reads tour/experience context). Key is persisted identifier.",
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(info.sf);
}

// ---------- per-app catalogue membership ----------
const apps = fs.readdirSync(path.join(ROOT, "apps")).filter((a) => fs.existsSync(path.join(ROOT, "apps", a, "src")));
const sharedBlocks = blocks.filter((b) => b.owner === "package:blocks");
const sharedIds = new Set(sharedBlocks.map((b) => b.id));
const sharedVar = new Map(sharedBlocks.map((b) => [b.exportName, b.id]));
const appInfo = {};
for (const a of apps) {
  const cfgFiles = [];
  const puckDir = path.join(ROOT, "apps", a, "src/lib/puck");
  if (fs.existsSync(puckDir)) for (const f of fs.readdirSync(puckDir)) if (/^(catalogue|config.*|templates?|landing.*)\.tsx?$/.test(f)) cfgFiles.push(path.join(puckDir, f));
  const text = cfgFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const usesPuck = fs.existsSync(puckDir) || fs.existsSync(path.join(ROOT, "apps", a, "src/blocks"));
  const allShared = /\.\.\.SHARED_BLOCKS\s*[,\]]/.test(text) || /\.\.\.SHARED_BLOCKS\b(?!\.)/.test(text.replace(/SHARED_BLOCKS\.filter/g, ""));
  const idsQuoted = new Set([...text.matchAll(/["']([a-z][a-z0-9-]+)["']/g)].map((m) => m[1]).filter((x) => sharedIds.has(x)));
  const varsMentioned = new Set([...text.matchAll(/\b([a-z][A-Za-z0-9]+)\b/g)].map((m) => m[1]).filter((v) => sharedVar.has(v)).map((v) => sharedVar.get(v)));
  const hasFilter = /SHARED_BLOCKS\.filter/.test(text);
  const offeredShared = allShared && !hasFilter ? [...sharedIds] : [...new Set([...idsQuoted, ...varsMentioned])];
  const hasBox = /BOX_BLOCKS/.test(fs.existsSync(puckDir) ? fs.readdirSync(puckDir).map((f) => { try { return fs.readFileSync(path.join(puckDir, f), "utf8"); } catch { return ""; } }).join("\n") : "");
  // resolver keys
  let resolved = {};
  for (const rk of [path.join(ROOT, "apps", a, "src/blocks/resolved-keys.ts"), path.join(ROOT, "apps", a, "src/lib/puck/resolved.ts"), path.join(ROOT, "apps", a, "src/lib/puck/catalogue.ts")]) {
    if (fs.existsSync(rk)) { const inf = parse(rk); const n = inf.consts.get("RESOLVED_KEYS"); if (n) { const v = ev(n, inf); if (v && !v.$unresolved) resolved = { ...resolved, ...v }; } }
  }
  const ownIds = blocks.filter((b) => b.owner === "app:" + a && b.form !== "puck-config").map((b) => b.id);
  appInfo[a] = { usesPuck, offeredShared, allShared: allShared && !hasFilter, hasBox, resolvedKeys: resolved, ownIds };
}

// ---------- verdicts ----------
for (const b of blocks) {
  b.offeredBy = [];
  if (b.owner === "package:blocks") { for (const a of apps) if (appInfo[a].offeredShared.includes(b.id)) b.offeredBy.push(a); }
  else if (b.owner === "package:direct-edit") { for (const a of apps) if (appInfo[a].hasBox) b.offeredBy.push(a); }
  else b.offeredBy.push(b.ownerName);
  const resolverApps = Object.entries(appInfo).filter(([, v]) => v.resolvedKeys[b.id]).map(([k, v]) => ({ app: k, keys: v.resolvedKeys[b.id] }));
  b.resolver = resolverApps; // which apps register a resolveData / RESOLVED_KEYS fill for this block id
  // importability
  const exported = b.owner === "package:blocks" && b.exportName && /export \{[^}]*\b/.test("") ;
  if (b.owner === "package:blocks") b.importability = { mode: "package", importPath: "@elkdonis/blocks", name: b.exportName, note: "Exported from @elkdonis/blocks (blocks/index.ts); also in SHARED_BLOCKS." };
  else if (b.owner === "package:direct-edit") b.importability = { mode: "package", importPath: "@elkdonis/direct-edit (puck entry)", name: "BOX_BLOCKS", note: "Package export; Component functions are server-safe." };
  else if (b.form === "puck-config") b.importability = { mode: "app-local-context", importPath: "relative: " + b.file, name: b.id, note: "Raw Puck config; render components read tour/experience context. Not a defineBlock." };
  else {
    const s = b.source || {};
    b.importability = { mode: (s.appLocal && s.appLocal.length) ? "app-local-context" : "app-local", importPath: "relative: " + b.file.replace(/^apps\/[^/]+\/src\//, "@/") + " (apps/" + b.ownerName + ")", name: b.exportName,
      note: (s.appLocal && s.appLocal.length) ? "Imports app modules (" + s.appLocal.slice(0, 4).join(", ") + ") so only works inside its app." : "Imports only relative files + packages; copyable/importable by relative path from another app (not a package export)." };
  }
  const s = b.source || { imports: [], appLocal: [], db: false, next: [], css: [], flags: [] };
  const needs = []; const notes = [];
  const reqNoDefault = b.props.filter((p) => p.required && p.default === undefined && p.kind !== "slot").map((p) => p.name);
  if (b.dataDriven) needs.push("data");
  if (s.db) needs.push("db-import");
  if (b.bindsKinds.length) notes.push("optional record bindings: " + b.bindsKinds.join(","));
  if (b.resolver.length && !b.dataDriven) needs.push("resolver-filled-props");
  if (s.appLocal.length) needs.push("app-context");
  if (s.next.length) notes.push("uses " + s.next.join(","));
  if (s.flags.includes("react-context") || s.flags.includes("next-router-hooks")) needs.push("react-context");
  if (b.styling === "tailwind") needs.push("tailwind");
  if (b.styling === "tokens") notes.push("needs @elkdonis/blocks/blocks.css (--blk-*)");
  if (b.form === "puck-config") needs.push("page-context");
  if (s.css.length) needs.push("own-css:" + s.css.join(","));
  if (b.ownerKind === "app" && b.styling == null && b.form === "defineBlock") notes.push("styling not declared");
  if (reqNoDefault.length) notes.push("required props without defaults: " + reqNoDefault.join(","));
  b.needs = needs; b.notes = notes;
  let verdict = "standalone";
  if (needs.includes("data") || needs.includes("db-import")) verdict = "needs-data";
  else if (needs.includes("app-context") || needs.includes("react-context") || needs.includes("page-context") || needs.includes("resolver-filled-props")) verdict = "needs-context";
  else if (needs.includes("tailwind") || needs.some((n) => n.startsWith("own-css"))) verdict = "needs-css";
  b.standalone = verdict; // standalone | needs-css | needs-context | needs-data
  b.rendersWithDefaults = verdict === "standalone" || verdict === "needs-css";
}

for (const b of blocks) {
  // aliases matching B's loader shape
  b.app = b.ownerKind === "app" ? b.ownerName : (b.ownerName === "direct-edit" ? "shared" : "shared");
  b.package = b.ownerKind === "package" ? "@elkdonis/" + b.ownerName : null;
  b.source_file = b.file;
  b.catalogues = b.ownerName === "blocks" ? ["SHARED_BLOCKS"] : b.ownerName === "direct-edit" ? ["BOX_BLOCKS"] : b.ownerKind === "app" ? [b.ownerName + " site blocks"] : [];
  b.importable = b.importability.mode === "package" ? "yes" : "app-only";
  b.blocker = b.importable === "yes" ? null : b.importability.note;
}
fs.writeFileSync(path.join(OUT, "blocks.json"), JSON.stringify(blocks, null, 1));
fs.writeFileSync(path.join(OUT, "blocks.apps.json"), JSON.stringify(appInfo, null, 1));
console.log("blocks", blocks.length);
const by = {}; for (const b of blocks) by[b.owner] = (by[b.owner] || 0) + 1; console.log(by);
const v = {}; for (const b of blocks) v[b.standalone] = (v[b.standalone] || 0) + 1; console.log(v);
