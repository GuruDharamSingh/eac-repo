/*
 * extract.mjs
 * ===========
 * Reads every workspace package.json under apps/ and packages/ and scans each
 * workspace's source for imports of other workspaces. Used by build.mjs.
 *
 * An edge exists when a workspace declares another in dependencies,
 * devDependencies or peerDependencies, or imports it from a .ts/.tsx/.js/.jsx/
 * .mjs/.cjs/.css file. `field` is null for an import with no declaration;
 * `files` is 0 for a declaration with no import found.
 */
import fs from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', 'out', '.git', 'android', 'ios']);
const EXT = /\.(tsx?|jsx?|mjs|cjs|css)$/;
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'];
// Bare specifier of an import, require, dynamic import or CSS @import; the
// first capture is the package name without any subpath.
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"](@[^/'"]+\/[^/'"]+|[^./'"@][^/'"]*)(?:\/[^'"]*)?['"]/g;

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, files);
    else if (EXT.test(e.name) && !e.name.endsWith('.d.ts')) files.push(p);
  }
  return files;
}

export function extract(root) {
  const ws = [];
  for (const group of ['apps', 'packages']) {
    for (const d of fs.readdirSync(path.join(root, group))) {
      const pj = path.join(root, group, d, 'package.json');
      if (!fs.existsSync(pj)) continue;
      ws.push({ dir: `${group}/${d}`, kind: group === 'apps' ? 'app' : 'package', pkg: JSON.parse(fs.readFileSync(pj, 'utf8')) });
    }
  }
  const names = new Set(ws.map(w => w.pkg.name));

  const nodes = [];
  const edges = [];
  for (const w of ws) {
    const declared = {};
    const external = new Set();
    for (const field of DEP_FIELDS) {
      for (const dep of Object.keys(w.pkg[field] || {})) {
        if (!names.has(dep)) external.add(dep);
        else if (dep !== w.pkg.name && !declared[dep]) declared[dep] = field;
      }
    }

    // Count files that import each workspace package.
    const files = walk(path.join(root, w.dir));
    let lines = 0;
    const imports = {};
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      lines += src.split('\n').length;
      const seen = new Set();
      for (const m of src.matchAll(IMPORT_RE)) if (names.has(m[1]) && m[1] !== w.pkg.name) seen.add(m[1]);
      for (const s of seen) imports[s] = (imports[s] || 0) + 1;
    }

    for (const target of new Set([...Object.keys(declared), ...Object.keys(imports)])) {
      edges.push({ source: w.pkg.name, target, field: declared[target] || null, files: imports[target] || 0 });
    }
    nodes.push({
      id: w.pkg.name,
      dir: w.dir,
      kind: w.kind,
      description: w.pkg.description || '',
      files: files.length,
      lines,
      external: external.size,
      exportsSource: JSON.stringify(w.pkg.exports || w.pkg.main || '').includes('src/'),
    });
  }
  return { nodes, edges, cycles: findCycles(nodes, edges) };
}

// One representative cycle per back edge found by depth-first search.
function findCycles(nodes, edges) {
  const adj = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) adj.get(e.source).push(e.target);
  const state = new Map(), cycles = [];
  const dfs = (id, stack) => {
    state.set(id, 1);
    for (const t of adj.get(id)) {
      if (state.get(t) === 1) cycles.push([...stack.slice(stack.indexOf(t)), id, t].filter((x, i, a) => i === a.length - 1 || x !== a[i + 1]));
      else if (!state.has(t)) dfs(t, [...stack, id]);
    }
    state.set(id, 2);
  };
  for (const n of nodes) if (!state.has(n.id)) dfs(n.id, []);
  return cycles;
}
