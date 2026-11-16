// Track nexus check (2026-11-16, lane rails). Checks atlas/tracks against the atlas, writes atlas/reports/rails-nexus.md.
//   every step id is an atlas capability (or a { gap }); every gate resolves (or is `todo`); no cycles in the nexus;
//   leads_to ids exist; candidate courses use known tracks and their builds_on matches what the tracks imply.
// Run: pnpm --filter @elkdonis/actions check:rails  (throwaway container, as for check-atlas)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAreas } from '../atlas/index';
import { loadNexus } from '../atlas/tracks/index';
import type { Capability } from '../atlas/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const { tracks, gates, courses } = await loadNexus();
const areas = await loadAreas();
const caps = new Map<string, Capability>();
for (const a of Object.values(areas)) for (const c of a.capabilities) caps.set(c.id, c);
const errors: string[] = [];
const warns: string[] = [];
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };

// Gates
const gateById = new Map(gates.map((g) => [g.id, g]));
const gatesSrc = fs.readFileSync(path.join(HERE, '../src/server/gates.ts'), 'utf8');
const statusSrc = fs.readFileSync(path.join(HERE, '../src/server/status.ts'), 'utf8');
const servicesHas = (fn: string): boolean => {
  const re = new RegExp(`export (async )?(function|const) ${fn}\\b`);
  const walk = (d: string): boolean =>
    fs.readdirSync(d, { withFileTypes: true }).some((e) => (e.isDirectory() ? e.name !== 'node_modules' && walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && re.test(fs.readFileSync(path.join(d, e.name), 'utf8'))));
  return walk(path.join(ROOT, 'packages/services/src'));
};
for (const g of gates) {
  if (g.resolver === 'todo') continue;
  const m = /^(gates|services|status):(.+)$/.exec(g.resolver);
  if (!m) { errors.push(`gate ${g.id}: resolver '${g.resolver}' is not todo, gates:<fn>, services:<fn> or status:<id>`); continue; }
  const [, kind, name] = m;
  if (kind === 'gates' && !new RegExp(`export function ${name}\\b`).test(gatesSrc)) errors.push(`gate ${g.id}: gates.ts has no exported ${name}`);
  if (kind === 'status' && !new RegExp(`(async )?['"]?${name}['"]?\\(`).test(statusSrc)) errors.push(`gate ${g.id}: status.ts has no check '${name}'`);
  if (kind === 'services' && !servicesHas(name)) errors.push(`gate ${g.id}: packages/services has no exported ${name}`);
}

// Tracks
const trackById = new Map<string, (typeof tracks)[number]>();
for (const t of tracks) {
  if (trackById.has(t.id)) errors.push(`track ${t.id}: duplicate id`);
  trackById.set(t.id, t);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.id)) errors.push(`track ${t.id}: id is not kebab-case`);
}
const providers = new Map<string, string[]>();
for (const t of tracks) for (const g of t.provides ?? []) { push(providers, g, t.id); if (!gateById.has(g)) errors.push(`track ${t.id}: provides unknown gate ${g}`); }
const gaps: { track: string; area: string; text: string }[] = [];
const noEntry: { track: string; cap: string }[] = [];
let stepCount = 0;
for (const t of tracks) {
  for (const g of t.requires) if (!gateById.has(g)) errors.push(`track ${t.id}: requires unknown gate ${g}`);
  for (const n of t.leads_to) if (!trackById.has(n)) errors.push(`track ${t.id}: leads_to unknown track ${n}`);
  if (!t.steps.length) errors.push(`track ${t.id}: no steps`);
  for (const s of t.steps) {
    stepCount++;
    if (typeof s !== 'string') { gaps.push({ track: t.id, area: t.area, text: s.gap }); continue; }
    const c = caps.get(s);
    if (!c) errors.push(`track ${t.id}: step '${s}' is not an atlas capability`);
    else if (!c.entry) noEntry.push({ track: t.id, cap: s });
  }
}

// Nexus edges and cycles
const edges = new Map<string, string[]>();
for (const t of tracks) {
  for (const n of t.leads_to) push(edges, t.id, n);
  for (const g of t.requires) for (const p of providers.get(g) ?? []) if (p !== t.id) push(edges, p, t.id);
}
const color = new Map<string, number>();
const stack: string[] = [];
const dfs = (n: string): void => {
  color.set(n, 1); stack.push(n);
  for (const m of edges.get(n) ?? []) {
    if (color.get(m) === 1) errors.push(`cycle in the nexus: ${[...stack.slice(stack.indexOf(m)), m].join(' -> ')}`);
    else if (!color.get(m)) dfs(m);
  }
  stack.pop(); color.set(n, 2);
};
for (const t of tracks) if (!color.get(t.id)) dfs(t.id);

// Courses: builds_on derived from required gates
const courseById = new Map(courses.map((c) => [c.id, c]));
const courseOfTrack = new Map<string, string[]>();
for (const c of courses) for (const tid of c.tracks) push(courseOfTrack, tid, c.id);
const reach = (id: string, seen = new Set<string>()): Set<string> => {
  for (const b of courseById.get(id)?.builds_on ?? []) if (!seen.has(b)) { seen.add(b); reach(b, seen); }
  return seen;
};
const derived = new Map<string, Set<string>>();
for (const c of courses) {
  for (const b of c.builds_on) if (!courseById.has(b)) errors.push(`course ${c.id}: builds_on unknown course ${b}`);
  const d = new Set<string>();
  c.tracks.forEach((tid, i) => {
    const t = trackById.get(tid);
    if (!t) { errors.push(`course ${c.id}: unknown track ${tid}`); return; }
    for (const g of t.requires) {
      const ps = providers.get(g) ?? [];
      if (!ps.length) continue; // external state (is_org_member) or no track provides it yet
      if (ps.some((p) => c.tracks.indexOf(p) >= 0 && c.tracks.indexOf(p) < i)) continue;
      const hosts = ps.flatMap((p) => courseOfTrack.get(p) ?? []).filter((x) => x !== c.id);
      if (!hosts.length) { warns.push(`course ${c.id}: track ${tid} needs ${g}, and no course contains a track that provides it`); continue; }
      hosts.forEach((h) => d.add(h));
      if (!hosts.some((h) => reach(c.id).has(h))) errors.push(`course ${c.id}: track ${tid} needs ${g} (provided in ${hosts.join(' or ')}), but builds_on does not reach it`);
    }
  });
  derived.set(c.id, d);
}
const ccolor = new Map<string, number>();
const cdfs = (n: string, st: string[]): void => {
  ccolor.set(n, 1); st.push(n);
  for (const m of courseById.get(n)?.builds_on ?? []) {
    if (ccolor.get(m) === 1) errors.push(`course cycle: ${[...st.slice(st.indexOf(m)), m].join(' -> ')}`);
    else if (!ccolor.get(m) && courseById.has(m)) cdfs(m, st);
  }
  st.pop(); ccolor.set(n, 2);
};
for (const c of courses) if (!ccolor.get(c.id)) cdfs(c.id, []);

// Report
const AREAS_ORDER = ['profile', 'publishing', 'business', 'artwork', 'organisation', 'site', 'production', 'email'];
const todoGates = gates.filter((g) => g.resolver === 'todo');
const L: string[] = [
  '# Rails nexus', '',
  'Generated by `scripts/check-rails.mts` from `atlas/tracks/` and the atlas. Do not edit; regenerate with `pnpm --filter @elkdonis/actions check:rails`.', '',
  `${tracks.length} tracks, ${stepCount} steps, ${gates.length} gates (${gates.length - todoGates.length} resolve, ${todoGates.length} todo), ${courses.length} candidate courses, ${gaps.length} gaps. All tracks are \`candidate\`.`, '',
  '## Graph', '',
  'Solid arrows: `leads_to`. Dotted arrows: a gate the later track requires, labelled with the gate.', '',
  '```mermaid', 'flowchart LR',
];
const nid = (s: string) => s.replace(/[^a-z0-9]/gi, '_');
for (const a of AREAS_ORDER) {
  const ts = tracks.filter((t) => t.area === a);
  if (!ts.length) continue;
  L.push(`  subgraph ${nid(a)}["${a}"]`);
  for (const t of ts) L.push(`    ${nid(t.id)}["${t.id}"]`);
  L.push('  end');
}
for (const t of tracks) for (const n of t.leads_to) L.push(`  ${nid(t.id)} --> ${nid(n)}`);
for (const t of tracks) for (const g of t.requires) for (const p of providers.get(g) ?? []) {
  if (p === t.id || (trackById.get(p)?.leads_to ?? []).includes(t.id)) continue;
  L.push(`  ${nid(p)} -.${g}.-> ${nid(t.id)}`);
}
L.push('```', '', '## Tracks', '', '| track | area | steps | requires | provides | leads to |', '|---|---|--:|---|---|---|');
for (const t of tracks) L.push(`| ${t.id} | ${t.area} | ${t.steps.length} | ${t.requires.join(', ') || '-'} | ${(t.provides ?? []).join(', ') || '-'} | ${t.leads_to.join(', ') || '-'} |`);
L.push('', '## Gates', '', '| gate | resolver | label |', '|---|---|---|');
for (const g of gates) L.push(`| ${g.id}${g.param ? `(${g.param})` : ''} | ${g.resolver} | ${g.label} |`);
L.push('', '## Candidate courses (paths)', '', 'Course, then its ordered tracks and their steps. `[gap]` marks a step with no capability yet. `builds_on` is checked against the gates the tracks require.', '');
for (const c of courses) {
  L.push(`### ${c.id} (${c.area})`, '', `${c.label}. Builds on: ${c.builds_on.join(', ') || 'nothing'}. Derived from gates: ${[...(derived.get(c.id) ?? [])].join(', ') || 'nothing'}.`, '');
  for (const tid of c.tracks) {
    const t = trackById.get(tid);
    if (!t) continue;
    L.push(`- **${tid}**: ${t.steps.map((s) => (typeof s === 'string' ? `\`${s}\`${caps.get(s)?.entry ? ` (entry ${caps.get(s)!.entry})` : ''}` : `[gap] ${s.gap}`)).join('; ')}`);
  }
  L.push('');
}
L.push('## Gap list: what the MCP and the dock still need', '', '### Steps with no capability', '');
if (gaps.length) for (const g of gaps) L.push(`- ${g.text} (${g.track}, ${g.area})`); else L.push('- none');
L.push('', '### Steps with a capability but no registry entry', '');
const byCap = new Map<string, string[]>();
for (const n of noEntry) push(byCap, n.cap, n.track);
for (const [cap, ts] of [...byCap.entries()].sort()) L.push(`- ${cap}: ${[...new Set(ts)].join(', ')}`);
L.push('', '### Gates still todo', '');
for (const g of todoGates) L.push(`- ${g.id}: ${g.label}`);
fs.writeFileSync(path.join(HERE, '../atlas/reports/rails-nexus.md'), L.join('\n') + '\n');

console.log(`Rails check: ${tracks.length} tracks, ${stepCount} steps (${gaps.length} gaps, ${noEntry.length} without a registry entry), ${gates.length} gates, ${courses.length} courses -> atlas/reports/rails-nexus.md`);
for (const w of warns) console.warn(`warn: ${w}`);
if (errors.length) { console.error(`Rails check: ${errors.length} error(s)`); for (const e of errors) console.error(`  - ${e}`); process.exit(1); }
console.log('Rails check: no errors.');
