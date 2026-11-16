// Registry consistency check (2026-11-06).
//
// The catalogue is client-safe and cannot import the server files, so its
// `runnable` and `derived` flags are written by hand next to RUNNERS and
// CHECKS. This compares them, and the declared params, and exits 1 on any
// mismatch. Reads no rows and writes nothing.
//
// Run (any container with the workspace at /app; tsx comes from @elkdonis/lms):
//   pnpm --filter @elkdonis/actions check:registry
import { ACTION_CATALOGUE } from '../src/catalogue';
import { AGENT_EXPOSURE } from '../src/agent';
import { RUNNERS } from '../src/server/run';
import { CHECKS } from '../src/server/status';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRIES } from '../atlas/entries';
import { REGISTRY_CONFIRM } from '../src/server/registry-confirm';
import { render } from './atlas-emit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');

const problems: string[] = [];
const ids = new Set<string>();

for (const m of ACTION_CATALOGUE) {
  if (ids.has(m.id)) problems.push(`${m.id}: listed twice in the catalogue`);
  ids.add(m.id);
  const hasRunner = Object.hasOwn(RUNNERS, m.id);
  const hasCheck = Object.hasOwn(CHECKS, m.id);
  if (m.runnable !== hasRunner) problems.push(`${m.id}: catalogue says runnable=${m.runnable}, RUNNERS ${hasRunner ? 'has' : 'lacks'} a runner`);
  if (m.derived !== hasCheck) problems.push(`${m.id}: catalogue says derived=${m.derived}, CHECKS ${hasCheck ? 'has' : 'lacks'} a check`);
  // Agent exposure (2026-11-08, src/agent.ts): default deny; never appOnly; read ⇒ a check; draft ⇒ a runner.
  if (m.agent && m.appOnly) problems.push(`${m.id}: appOnly entries cannot have agent exposure`);
  if (m.agent === 'read' && !hasCheck) problems.push(`${m.id}: agent 'read' needs a status check (derived)`);
  if (m.agent === 'draft' && !hasRunner) problems.push(`${m.id}: agent 'draft' needs a runner (runnable)`);
  for (const p of m.params ?? []) {
    if (!p.options.some((o) => o.value === p.default)) problems.push(`${m.id}: param ${p.name} default '${p.default}' is not one of its options`);
    const values = p.options.map((o) => o.value);
    if (new Set(values).size !== values.length) problems.push(`${m.id}: param ${p.name} repeats an option`);
  }
}
for (const id of Object.keys(AGENT_EXPOSURE)) if (!ids.has(id)) problems.push(`${id}: has agent exposure but no catalogue entry`);
for (const id of Object.keys(RUNNERS)) if (!ids.has(id)) problems.push(`${id}: has a runner but no catalogue entry`);
for (const id of Object.keys(CHECKS)) if (!ids.has(id)) problems.push(`${id}: has a check but no catalogue entry`);

// Registry data (2026-11-16, DOCK_LOOP_SLICE1 §2.4): address, confirm, risk, roles.
{
  const emitted = await render();
  const file = path.join(HERE, '../src/registry-data.ts');
  const fileC = path.join(HERE, '../src/server/registry-confirm.ts');
  const same = (f: string, s: string) => fs.existsSync(f) && fs.readFileSync(f, 'utf8') === s;
  if (!same(file, emitted.data) || !same(fileC, emitted.confirms)) problems.push('src/registry-data.ts or src/server/registry-confirm.ts is stale: run atlas:emit');
  const SURFACE = /^(profile(:(edit|details|show|page|payouts|connections))?|journey:(auction|org|profile|site)(:\{org\}|:[A-Za-z0-9_-]{1,50})?|artwork)$/;
  const anchors = new Map<string, string>();
  for (const id of Object.keys(ENTRIES)) if (!ids.has(id)) problems.push(`${id}: in atlas/entries.ts but not in the catalogue`);
  for (const m of ACTION_CATALOGUE) {
    if (!ENTRIES[m.id]) continue;
    if (!m.risk) problems.push(`${m.id}: curated in entries.ts but the catalogue entry has no risk (re-run atlas:emit)`);
    const money = Boolean(m.risk?.includes('money'));
    const a = m.address;
    const conf = REGISTRY_CONFIRM[m.id];
    if (conf && conf.status === 'approved' && !conf.text.trim()) problems.push(`${m.id}: approved confirm with no text`);
    if (a?.dock) {
      if (money) problems.push(`${m.id}: a money entry cannot be done in the dock (address.dock)`);
      if (!conf) problems.push(`${m.id}: done in the dock but has no confirm text`);
      if (!m.runnable) problems.push(`${m.id}: address.dock needs a runner`);
    }
    if (a?.surface && !SURFACE.test(a.surface)) problems.push(`${m.id}: address.surface '${a.surface}' is not a surface cms-ui parses`);
    if (a && !a.dock && !a.external && !a.path) problems.push(`${m.id}: address has no path`);
    if (a && !a.dock && !a.external && a.path && a.anchor) anchors.set(m.id, a.anchor);
  }
  // Anchors exist in source, in any spelling: data-eac-anchor="id", "data-eac-anchor": "id", anchorProps('id'), anchor: 'id'.
  const roots = ['packages/cms-ui/src', 'packages/studio/src', ...fs.readdirSync(path.join(REPO, 'apps')).map((a) => `apps/${a}/src`)];
  const parts: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(e.name)) parts.push(fs.readFileSync(p, 'utf8'));
    }
  };
  for (const r of roots) walk(path.join(REPO, r));
  const blob = parts.join('\n');
  for (const [id, anchor] of anchors) {
    const spellings = [`data-eac-anchor="${anchor}"`, `"data-eac-anchor": "${anchor}"`, `anchorProps('${anchor}'`, `anchor: "${anchor}"`, `anchor: '${anchor}'`];
    if (!spellings.some((s) => blob.includes(s))) problems.push(`${id}: anchor '${anchor}' is not in any source file`);
  }
  const uncurated = ACTION_CATALOGUE.filter((m) => !m.appOnly && (!m.address || !REGISTRY_CONFIRM[m.id] || !m.risk)).length;
  console.log(`Registry data: ${Object.keys(ENTRIES).length} entries curated, ${anchors.size} anchors checked; ${uncurated} person-facing entries still lack an address, confirm or risk (warning only).`);
}

if (problems.length) {
  console.error(`Registry check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Registry check: ${ACTION_CATALOGUE.length} entries, ${Object.keys(RUNNERS).length} runners, ${Object.keys(CHECKS).length} checks, consistent.`);
process.exit(0);
