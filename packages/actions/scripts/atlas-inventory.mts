// Atlas inventory generator (2026-11-16).
//
// Walks apps/*/src and packages/*/src, parses each file with the TypeScript compiler API (syntax only,
// no type checker) and writes packages/actions/atlas/inventory.json: every write *host* in the repo.
//   sa   exports of "use server" files, plus inline "use server" functions anywhere
//   api  POST/PUT/PATCH/DELETE handlers of src/app/**/route.ts(x)
//   sql  raw INSERT INTO / UPDATE x SET / DELETE FROM sites (apps and non-shared packages only)
// Key format: see HostKey in atlas/types.ts. Deterministic apart from the generatedAt date.
//
// Run (any container with the workspace at /app; tsx comes from @elkdonis/lms):
//   pnpm --filter @elkdonis/actions atlas:inventory
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(HERE, '../atlas/inventory.json');

type Kind = 'sa' | 'api' | 'sql';
interface Host {
  key: string; kind: Kind; app: string; file: string; symbol: string; line: number;
  imports: string[]; calls: string[]; registry: boolean; rawSql: boolean;
}
interface Reexport { file: string; name: string; from: string; kind: 'sa' | 'api' }

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'fixtures', '__tests__', '__fixtures__', 'coverage']);
const EXT = /\.(ts|tsx|mts|js|jsx|mjs)$/;
const SHARED_SQL_PKGS = new Set(['services', 'db']);
const REGISTRY_NAMES = new Set(['runAction', 'performAction', 'performHubAction', 'performSiteChannelAction', 'runDockAction']);
const API_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SQL_RES = [/\bINSERT\s+INTO\b/i, /\bUPDATE\s+[\w."`$\[\]]+\s+SET\b/i, /\bDELETE\s+FROM\b/i];

function cmp(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  entries.sort((a, b) => cmp(a.name, b.name));
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && EXT.test(e.name) && !/\.d\.ts$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
}

function listFiles(): string[] {
  const files: string[] = [];
  for (const top of ['apps', 'packages']) {
    const base = path.join(ROOT, top);
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
      if (!d.isDirectory()) continue;
      const src = path.join(base, d.name, 'src');
      if (fs.existsSync(src)) walk(src, files);
    }
  }
  return files;
}

function unwrap(e: ts.Expression): ts.Expression {
  let x = e;
  for (;;) {
    if (ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isNonNullExpression(x) || ts.isTypeAssertionExpression(x)) x = x.expression;
    else return x;
  }
}
const hasMod = (n: ts.Node, k: ts.SyntaxKind) => (ts.canHaveModifiers(n) ? ts.getModifiers(n) : undefined)?.some((m) => m.kind === k) ?? false;

function isUseServerStmt(s: ts.Statement): boolean {
  return ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use server';
}
/** Leading directive prologue contains "use server". */
function prologueHasUseServer(stmts: readonly ts.Statement[]): boolean {
  for (const s of stmts) {
    if (!(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression))) return false;
    if (isUseServerStmt(s)) return true;
  }
  return false;
}

function sqlText(n: ts.Node): string | undefined {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => '_x_' + s.literal.text).join('');
  return undefined;
}
const isWriteSql = (t: string) => SQL_RES.some((r) => r.test(t));

interface ImportInfo { module: string; imported: string; ns: boolean }

function analyze(node: ts.Node, imports: Map<string, ImportInfo>): { calls: string[]; registry: boolean } {
  const calls = new Set<string>();
  let registry = false;
  const addId = (name: string) => {
    const imp = imports.get(name);
    if (imp) {
      if (!imp.ns) calls.add(`${imp.module}#${imp.imported}`);
      if (REGISTRY_NAMES.has(imp.imported)) registry = true;
    }
    if (REGISTRY_NAMES.has(name)) registry = true;
  };
  const visit = (n: ts.Node) => {
    let callee: ts.Expression | undefined;
    if (ts.isCallExpression(n)) callee = n.expression;
    else if (ts.isTaggedTemplateExpression(n)) callee = n.tag;
    if (callee) {
      const c = unwrap(callee);
      if (ts.isIdentifier(c)) addId(c.text);
      else if (ts.isPropertyAccessExpression(c)) {
        if (REGISTRY_NAMES.has(c.name.text)) registry = true;
        let root: ts.Expression = c;
        while (ts.isPropertyAccessExpression(root)) root = root.expression;
        if (ts.isIdentifier(root)) {
          const imp = imports.get(root.text);
          if (imp?.ns) calls.add(`${imp.module}#${c.name.text}`);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return { calls: [...calls].sort(cmp), registry };
}

function rangeHasSql(sqlPos: number[], node: ts.Node): boolean {
  const lo = node.getStart(), hi = node.end;
  return sqlPos.some((p) => p >= lo && p < hi);
}

function fnLikeName(n: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(n)) {
    if (n.name) return n.name.text;
    return hasMod(n, ts.SyntaxKind.DefaultKeyword) ? 'default' : undefined;
  }
  if (ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n) || ts.isSetAccessorDeclaration(n)) {
    const nm = ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) ? n.name.text : '<computed>';
    const cls = n.parent;
    let cn: string | undefined;
    if ((ts.isClassDeclaration(cls) || ts.isClassExpression(cls)) && cls.name) cn = cls.name.text;
    return `${cn ?? '<class>'}.${nm}`;
  }
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
    if (ts.isFunctionExpression(n) && n.name) return n.name.text;
    const p = n.parent;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return p.name.text;
    if (ts.isExportAssignment(p)) return 'default';
  }
  return undefined;
}

function isTopLevelVarDecl(d: ts.VariableDeclaration): boolean {
  const list = d.parent, stmt = list?.parent;
  return !!stmt && ts.isVariableStatement(stmt) && ts.isSourceFile(stmt.parent);
}

/** Nearest named enclosing function (or top-level wrapped const / default export), with the node to analyze. */
function enclosing(n: ts.Node): { name: string; node: ts.Node | undefined } {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isSourceFile(p)) break;
    const nm = fnLikeName(p);
    if (nm) return { name: nm, node: p };
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && isTopLevelVarDecl(p) && p.initializer) return { name: p.name.text, node: p.initializer };
    if (ts.isExportAssignment(p)) return { name: 'default', node: p.expression };
  }
  return { name: '<module>', node: undefined };
}

function main(): void {
  const files = listFiles();
  const hosts = new Map<string, Host>();
  const reexports: Reexport[] = [];
  const sharedSites = new Map<string, Set<string>>();
  const pkgSharedSites = (pkg: string) => { let s = sharedSites.get(pkg); if (!s) sharedSites.set(pkg, (s = new Set())); return s; };

  for (const abs of files) {
    const file = path.relative(ROOT, abs).split(path.sep).join('/');
    const parts = file.split('/');
    const top = parts[0], app = parts[1];
    const text = fs.readFileSync(abs, 'utf8');
    if (!/use server|route\.|INSERT|UPDATE|DELETE/i.test(text) && !/\/route\.(t|j)sx?$/.test(file)) continue;
    const sk = /\.tsx$/.test(abs) ? ts.ScriptKind.TSX : /\.jsx$/.test(abs) ? ts.ScriptKind.JSX : /\.(js|mjs)$/.test(abs) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, sk);
    const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    // Imports of @elkdonis/*
    const imports = new Map<string, ImportInfo>();
    const importSpecs = new Set<string>();
    for (const s of sf.statements) {
      if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const mod = s.moduleSpecifier.text;
      if (!mod.startsWith('@elkdonis/')) continue;
      const ic = s.importClause;
      if (ic?.isTypeOnly) continue;
      importSpecs.add(mod);
      if (!ic) continue;
      if (ic.name) imports.set(ic.name.text, { module: mod, imported: 'default', ns: false });
      const nb = ic.namedBindings;
      if (nb && ts.isNamespaceImport(nb)) imports.set(nb.name.text, { module: mod, imported: '*', ns: true });
      else if (nb && ts.isNamedImports(nb)) {
        for (const el of nb.elements) if (!el.isTypeOnly) imports.set(el.name.text, { module: mod, imported: (el.propertyName ?? el.name).text, ns: false });
      }
    }
    const importList = [...importSpecs].sort(cmp);

    // SQL literal positions
    const sqlLits: ts.Node[] = [];
    const scan = (n: ts.Node) => {
      const t = sqlText(n);
      if (t !== undefined && isWriteSql(t)) { sqlLits.push(n); if (ts.isTemplateExpression(n)) ts.forEachChild(n, scan); return; }
      ts.forEachChild(n, scan);
    };
    scan(sf);
    const sqlPos = sqlLits.map((n) => n.getStart(sf));

    const useServerFile = prologueHasUseServer(sf.statements);
    const isRoute = /\/src\/app\/(?:.*\/)?route\.(ts|tsx|js|jsx|mjs|mts)$/.test(file);

    const add = (kind: Kind, symbol: string, anchor: ts.Node, body: ts.Node | undefined, rawSqlOverride?: boolean): void => {
      const key = `${kind}:${file}#${symbol}`;
      if (hosts.has(key)) return;
      const a = body ? analyze(body, imports) : { calls: [], registry: false };
      hosts.set(key, {
        key, kind, app, file, symbol, line: lineOf(anchor), imports: importList, calls: a.calls, registry: a.registry,
        rawSql: rawSqlOverride ?? (body ? rangeHasSql(sqlPos, body) : false),
      });
    };

    // Top-level local declarations, for `export { x }` and `export default x`
    const locals = new Map<string, { anchor: ts.Node; body: ts.Node }>();
    for (const s of sf.statements) {
      if (ts.isFunctionDeclaration(s) && s.name && s.body) locals.set(s.name.text, { anchor: s.name, body: s });
      else if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) locals.set(d.name.text, { anchor: d.name, body: d.initializer });
      }
    }
    let defaultLocal: string | undefined;
    for (const s of sf.statements) {
      if (ts.isExportAssignment(s) && !s.isExportEquals) {
        const e = unwrap(s.expression);
        if (ts.isIdentifier(e)) defaultLocal = e.text;
      }
    }

    const isFnInit = (e: ts.Expression): boolean => {
      const x = unwrap(e);
      return ts.isArrowFunction(x) || ts.isFunctionExpression(x) || ts.isCallExpression(x);
    };

    // Exported symbols: [{name, anchor, body}]
    const exported: { name: string; anchor: ts.Node; body: ts.Node | undefined; plainConst: boolean }[] = [];
    for (const s of sf.statements) {
      if (ts.isFunctionDeclaration(s) && hasMod(s, ts.SyntaxKind.ExportKeyword)) {
        if (!s.body) continue; // overload signature
        exported.push({ name: hasMod(s, ts.SyntaxKind.DefaultKeyword) ? 'default' : s.name?.text ?? 'default', anchor: s.name ?? s, body: s, plainConst: false });
      } else if (ts.isVariableStatement(s) && hasMod(s, ts.SyntaxKind.ExportKeyword)) {
        for (const d of s.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || !d.initializer) continue;
          exported.push({ name: d.name.text, anchor: d.name, body: d.initializer, plainConst: !isFnInit(d.initializer) });
        }
      } else if (ts.isExportAssignment(s) && !s.isExportEquals) {
        const e = unwrap(s.expression);
        if (ts.isIdentifier(e)) {
          const l = locals.get(e.text);
          exported.push({ name: 'default', anchor: s, body: l?.body, plainConst: false });
        } else exported.push({ name: 'default', anchor: s, body: s.expression, plainConst: false });
      } else if (ts.isExportDeclaration(s)) {
        if (s.isTypeOnly) continue;
        const from = s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier) ? s.moduleSpecifier.text : undefined;
        if (s.exportClause && ts.isNamedExports(s.exportClause)) {
          for (const el of s.exportClause.elements) {
            if (el.isTypeOnly) continue;
            const ename = el.name.text;
            if (from) {
              if (useServerFile) reexports.push({ file, name: ename, from, kind: 'sa' });
              else if (isRoute && API_METHODS.has(ename)) reexports.push({ file, name: ename, from, kind: 'api' });
            } else {
              const l = locals.get((el.propertyName ?? el.name).text);
              if (l) exported.push({ name: ename, anchor: el.name, body: l.body, plainConst: !(ts.isFunctionDeclaration(l.body) || isFnInit(l.body as ts.Expression)) });
            }
          }
        } else if (from && useServerFile) reexports.push({ file, name: '*', from, kind: 'sa' });
      }
    }

    if (useServerFile) {
      for (const ex of exported) {
        if (ex.plainConst) continue;
        add('sa', ex.name, ex.anchor, ex.body);
      }
    }
    if (isRoute) {
      for (const ex of exported) {
        if (API_METHODS.has(ex.name)) add('api', ex.name, ex.anchor, ex.body);
      }
    }

    // Inline "use server" in function bodies (files that are not already "use server")
    if (!useServerFile) {
      const anonCount = new Map<string, number>();
      for (const s of sf.statements) {
        let outer = '<module>';
        if (ts.isFunctionDeclaration(s)) outer = hasMod(s, ts.SyntaxKind.DefaultKeyword) ? 'default' : s.name?.text ?? 'default';
        else if (ts.isVariableStatement(s)) { const d = s.declarationList.declarations[0]; outer = d && ts.isIdentifier(d.name) ? d.name.text : '<module>'; }
        else if (ts.isClassDeclaration(s)) outer = s.name?.text ?? 'default';
        else if (ts.isExportAssignment(s)) outer = 'default';
        else continue;
        if (outer === defaultLocal) outer = 'default';
        const visit = (n: ts.Node) => {
          if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) && n.body && ts.isBlock(n.body) && prologueHasUseServer(n.body.statements)) {
            let nm = fnLikeName(n);
            if (nm && nm.includes('.')) nm = nm.split('.').pop();
            if (!nm || nm === 'default') { const i = anonCount.get(outer) ?? 0; anonCount.set(outer, i + 1); nm = `anon${i}`; }
            add('sa', `${outer}/${nm}`, n, n);
          }
          ts.forEachChild(n, visit);
        };
        visit(s);
      }
    }

    // Raw SQL sites
    const shared = top === 'packages' && SHARED_SQL_PKGS.has(app);
    const seenSites = new Set<string>();
    for (const lit of sqlLits) {
      const enc = enclosing(lit);
      const siteKey = `${file}#${enc.name}`;
      if (seenSites.has(siteKey)) continue;
      seenSites.add(siteKey);
      if (shared) { pkgSharedSites(app).add(siteKey); continue; }
      add('sql', enc.name, enc.node ?? lit, enc.node, true);
    }
  }

  const list = [...hosts.values()].sort((a, b) => cmp(a.key, b.key));
  const byKind: Record<string, number> = {};
  const byApp: Record<string, Record<string, number>> = {};
  for (const h of list) {
    byKind[h.kind] = (byKind[h.kind] ?? 0) + 1;
    const a = (byApp[h.app] ??= { sa: 0, api: 0, sql: 0 });
    a[h.kind]++;
  }
  const sortObj = <T,>(o: Record<string, T>) => Object.fromEntries(Object.keys(o).sort(cmp).map((k) => [k, o[k]]));
  const sharedSqlCount = Object.fromEntries([...sharedSites.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, v]) => [k, v.size]));
  reexports.sort((a, b) => cmp(`${a.file}#${a.name}`, `${b.file}#${b.name}`));
  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    counts: { byKind: sortObj(byKind), byApp: sortObj(byApp) },
    sharedSqlCount,
    reexports,
    hosts: list,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');

  // Summary
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  console.log(`Atlas inventory: ${files.length} files scanned, ${list.length} hosts -> ${path.relative(ROOT, OUT)}`);
  console.log(pad('app', 28) + pad('sa', 7) + pad('api', 7) + pad('sql', 7) + 'registry-routed');
  const routed: Record<string, number> = {};
  for (const h of list) if (h.registry && h.kind !== 'sql') routed[h.app] = (routed[h.app] ?? 0) + 1;
  for (const [a, c] of Object.entries(sortObj(byApp))) console.log(pad(a, 28) + pad(c.sa, 7) + pad(c.api, 7) + pad(c.sql, 7) + (routed[a] ?? 0));
  console.log(pad('TOTAL', 28) + pad(byKind.sa ?? 0, 7) + pad(byKind.api ?? 0, 7) + pad(byKind.sql ?? 0, 7) + Object.values(routed).reduce((x, y) => x + y, 0));
  console.log(`re-exports (not hosts): ${reexports.length}; shared-layer sql sites: ${JSON.stringify(sharedSqlCount)}`);
}

main();
