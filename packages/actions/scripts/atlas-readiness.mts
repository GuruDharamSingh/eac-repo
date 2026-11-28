// The readiness ladder (2026-11-27, rails desk lane A; docs/open/RAILS_DESK_2026-11-27/PLAN.md).
// One computed level per person-class capability (and any capability a track names):
//   0 Not built   a gap in a track, or no address anywhere
//   1 Place       the atlas knows where it is done (a host with an address)
//   2 Checked     + a registry entry with a status check (the platform sees when it is done)
//   3 In the dock + a runnable entry done in the dock (a dockForm or an in-dock address) with confirm wording
//   4 Assistant   + agent exposure (read or draft) in src/agent.ts
// Money caps at 2 by rule. The level is computed here, never hand-typed.
// Writes atlas/reports/readiness.json (the `Readiness` interface of the PLAN) and readiness.md. Reads only.
//   pnpm --filter @elkdonis/actions atlas:readiness
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAreas } from '../atlas/index';
import { loadNexus } from '../atlas/tracks/index';
import type { Capability } from '../atlas/types';
import { ACTION_CATALOGUE } from '../src/catalogue';
import { CHECKS } from '../src/server/status';
import { RUNNERS } from '../src/server/run';
import { REGISTRY_CONFIRM } from '../src/server/registry-confirm';
import { APP_NAMES, pickAddress } from '../atlas/origins';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../atlas/reports');

type Level = 0 | 1 | 2 | 3 | 4;
type LevelKey = '0' | '1' | '2' | '3' | '4';
const LEVEL_NAME: Record<Level, string> = { 0: 'Not built', 1: 'Place', 2: 'Checked', 3: 'In the dock', 4: 'Assistant' };

interface Readiness {
  generated: string;
  counts: Record<LevelKey, number>;
  capabilities: Array<{
    id: string; label: string; does: string; area: string; family?: string;
    scope: string; actors: string[]; risk: string[];
    level: Level; why: string; next: string;
    entry: string | null; dockForm: string | null; status: string | null;
    confirm: { status: string; text: string } | null;
    address: { app: string; path: string; how?: string } | null;
    hosts: Array<{ key: string; file: string; line?: number }>;
    tracks: string[]; courses: string[]; open?: string;
    /** Added 2026-11-27 (lane F): can it be done out of context in the dock, or does it need its page? */
    where?: { mode: 'dock' | 'place'; why: string; deep?: string };
  }>;
  /** Added 2026-11-27 (lane F): how many of the not-yet-in-the-dock rows are classified dock, place, or not yet. */
  whereCounts?: { dock: number; place: number; unclassified: number };
  tracks: Array<{ id: string; label: string; area: string; steps: Array<{ cap?: string; gap?: string; level: number }>; leads_to: string[]; gates: string[] }>;
  courses: Array<{ id: string; label: string; area: string; tracks: string[]; builds_on: string[]; levels: Record<string, number> }>;
}

const areas = await loadAreas();
const { tracks, courses } = await loadNexus();
const caps = new Map<string, Capability>();
for (const a of Object.values(areas)) for (const c of a.capabilities) caps.set(c.id, c);
const meta = new Map(ACTION_CATALOGUE.map((m) => [m.id, m]));
const inventory: { hosts: Array<{ key: string; line: number }> } = JSON.parse(fs.readFileSync(path.join(HERE, '../atlas/inventory.json'), 'utf8'));
const lineOf = new Map((inventory.hosts ?? []).map((h) => [h.key, h.line]));

const tracksOf = new Map<string, string[]>();
for (const t of tracks) for (const s of t.steps) if (typeof s === 'string') tracksOf.set(s, [...(tracksOf.get(s) ?? []), t.id]);
const coursesOf = new Map<string, string[]>();
for (const c of courses) {
  for (const tid of c.tracks) {
    const t = tracks.find((x) => x.id === tid);
    for (const s of t?.steps ?? []) {
      if (typeof s !== 'string') continue;
      const l = coursesOf.get(s) ?? [];
      if (!l.includes(c.id)) l.push(c.id);
      coursesOf.set(s, l);
    }
  }
}

const hostFile = (key: string) => key.slice(key.indexOf(':') + 1, key.indexOf('#'));

const addressOf = (c: Capability) => pickAddress(c);

function compute(c: Capability): { level: Level; why: string; next: string } {
  const addr = addressOf(c);
  const money = c.risk.includes('money');
  const entryId = typeof c.entry === 'string' ? c.entry : null;
  const m = entryId ? meta.get(entryId) ?? null : null;
  const hasCheck = Boolean(m && Object.hasOwn(CHECKS, m.id));
  const hasRunner = Boolean(m && Object.hasOwn(RUNNERS, m.id));
  const conf = m ? REGISTRY_CONFIRM[m.id] : undefined;
  const inDock = Boolean(m && !m.appOnly && hasRunner && conf && (m.dockForm || m.address?.dock));
  const assistant = Boolean(m && !m.appOnly && m.agent);
  const where = addr ? (APP_NAMES[addr.app] ?? addr.app) : '';

  if (!addr) return { level: 0, why: 'Nobody has recorded where this is done yet.', next: 'Find where it is done and record the page in the atlas.' };
  if (money) {
    const lvl: Level = hasCheck ? 2 : 1;
    return {
      level: lvl,
      why: `Money is involved, so the dock only links to it and never runs it${hasCheck ? '' : '; there is no status check yet'}.`,
      next: hasCheck ? 'Nothing: money steps stay a link by rule.' : 'Add a status check so the platform sees when it is done. It stays a link.',
    };
  }
  if (!entryId) return { level: 1, why: `It is done in ${where}; there is no registry entry, so the platform cannot see when it is done.`, next: 'Add a registry entry with a status check.' };
  if (!m) return { level: 1, why: `Its registry entry (${entryId}) is not in the catalogue.`, next: 'Add the entry to the catalogue, with a status check.' };
  if (!hasCheck) return { level: 1, why: 'It has a registry entry but no status check.', next: 'Add a status check so the platform sees when it is done.' };
  if (!inDock) {
    const bits: string[] = [];
    if (m.appOnly) bits.push('it is done only from the site’s own pages');
    else {
      if (!hasRunner) bits.push('nothing runs it for the person yet');
      else if (!m.dockForm && !m.address?.dock) bits.push('there is no form for it in the dock');
      if (!conf) bits.push('there is no confirm wording');
    }
    const note = m.agent ? ' The assistant can already read it.' : '';
    return {
      level: 2,
      why: `The platform sees when it is done, but ${bits.join(' and ')}.${note}`,
      next: m.appOnly ? 'Stays here: it is done from the site’s own pages.' : !hasRunner ? 'Add a runner, a form for the dock and confirm wording.' : 'Add a form for the dock and confirm wording.',
    };
  }
  if (!assistant) {
    const draft = conf && conf.status !== 'approved' && conf.status !== 'changed';
    return {
      level: 3,
      why: `It opens as a form in the dock.${draft ? ' Its confirm wording is still a draft, so the dock shows a plain line until Justin approves it.' : ''}`,
      next: 'Let the assistant read it (and propose it, if it only drafts).',
    };
  }
  return { level: 4, why: 'It is in the dock and the assistant can use it.', next: 'Nothing: top of the ladder.' };
}

// Which capabilities: every person-class row, and any row a track names.
const wanted = [...caps.values()].filter((c) => c.class === 'person' || tracksOf.has(c.id));
const rows: Readiness['capabilities'] = wanted.map((c) => {
  const r = compute(c);
  const entryId = typeof c.entry === 'string' ? c.entry : null;
  const m = entryId ? meta.get(entryId) : undefined;
  const conf = m ? REGISTRY_CONFIRM[m.id] : undefined;
  return {
    id: c.id, label: c.label, does: c.does, area: c.area, ...(c.family ? { family: c.family } : {}),
    scope: c.scope, actors: c.actors, risk: c.risk,
    level: r.level, why: r.why, next: r.next,
    entry: entryId, dockForm: m?.dockForm ?? null,
    status: m && Object.hasOwn(CHECKS, m.id) ? m.id : c.status ?? null,
    confirm: conf ? { status: conf.status, text: conf.text } : c.confirm ? { status: c.confirm.status, text: c.confirm.text } : null,
    address: addressOf(c),
    hosts: c.hosts.map((h) => ({ key: h.key, file: hostFile(h.key), ...(lineOf.has(h.key) ? { line: lineOf.get(h.key) } : {}) })),
    tracks: tracksOf.get(c.id) ?? [], courses: coursesOf.get(c.id) ?? [],
    ...(c.open ? { open: c.open } : {}),
    ...(c.where ? { where: c.where } : {}),
  };
});
const levelOf = new Map(rows.map((r) => [r.id, r.level]));
const unknown = new Set<string>();

const out: Readiness = {
  generated: new Date().toISOString(),
  counts: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 },
  capabilities: rows,
  tracks: tracks.map((t) => ({
    id: t.id, label: t.label, area: t.area,
    steps: t.steps.map((s) => {
      if (typeof s !== 'string') return { gap: s.gap, level: 0 };
      if (!levelOf.has(s)) unknown.add(s);
      return { cap: s, level: levelOf.get(s) ?? 0 };
    }),
    leads_to: t.leads_to, gates: t.requires,
  })),
  courses: courses.map((c) => {
    const levels: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 };
    for (const tid of c.tracks) for (const s of tracks.find((t) => t.id === tid)?.steps ?? []) levels[String(typeof s === 'string' ? levelOf.get(s) ?? 0 : 0)]++;
    return { id: c.id, label: c.label, area: c.area, tracks: c.tracks, builds_on: c.builds_on, levels };
  }),
};
for (const r of rows) out.counts[String(r.level) as LevelKey]++;
// Rows a track names that are below level 3: how many are classified dock, place, or not yet.
{
  const named = rows.filter((r) => r.tracks.length && r.level < 3);
  out.whereCounts = { dock: named.filter((r) => r.where?.mode === 'dock').length, place: named.filter((r) => r.where?.mode === 'place').length, unclassified: named.filter((r) => !r.where).length };
}
if (unknown.size) console.error(`track steps that are not atlas capabilities: ${[...unknown].join(', ')}`);

fs.writeFileSync(path.join(OUT, 'readiness.json'), JSON.stringify(out, null, 2) + '\n');

// ── readiness.md: plain words, by course then by level ──────────────────────
const capById = new Map(rows.map((r) => [r.id, r]));
const md: string[] = [];
md.push('# Readiness of the actions', '', `Generated ${out.generated} by \`scripts/atlas-readiness.mts\`. Do not edit: run \`atlas:readiness\`.`, '');
md.push('Each action a person can take has one level, worked out from the atlas, the registry and the dock:', '');
md.push('| Level | Name | Means |', '|---|---|---|');
const MEANS: Record<Level, string> = {
  0: 'Nothing built, or nobody has recorded where it is done.',
  1: 'We know where it is done. The dock can take the person there; they say when it is done.',
  2: 'The platform can see when it is done, so the step ticks itself.',
  3: 'It opens as a form inside the dock.',
  4: 'The assistant can use it too.',
};
for (const l of [0, 1, 2, 3, 4] as Level[]) md.push(`| ${l} | ${LEVEL_NAME[l]} | ${MEANS[l]} |`);
md.push('', 'Money steps stay at level 2 or below: the dock only links to them.', '');
md.push(`## Totals (${rows.length} actions)`, '', ...([0, 1, 2, 3, 4] as Level[]).map((l) => `- ${LEVEL_NAME[l]} (level ${l}): ${out.counts[String(l) as LevelKey]}`), '');
md.push('## By course', '');
for (const c of out.courses) {
  const lv = c.levels;
  md.push(`### ${c.label}`, '', `Steps by level: ${([0, 1, 2, 3, 4] as Level[]).map((l) => `${LEVEL_NAME[l]} ${lv[String(l)]}`).join(', ')}.${c.builds_on.length ? ` Builds on: ${c.builds_on.join(', ')}.` : ''}`, '');
  for (const tid of c.tracks) {
    const t = out.tracks.find((x) => x.id === tid)!;
    md.push(`**${t.label}**`, '');
    for (const s of t.steps) {
      if (s.gap) { md.push(`- Level 0, Not built: ${s.gap}`); continue; }
      const r = capById.get(s.cap!);
      md.push(r ? `- Level ${r.level}, ${LEVEL_NAME[r.level]}: ${r.label}. ${r.why}` : `- Level 0: ${s.cap} (not in the atlas)`);
    }
    md.push('');
  }
}
md.push('## By level', '');
for (const l of [4, 3, 2, 1, 0] as Level[]) {
  const list = rows.filter((r) => r.level === l).sort((a, b) => a.area.localeCompare(b.area) || a.label.localeCompare(b.label));
  md.push(`### Level ${l}, ${LEVEL_NAME[l]} (${list.length})`, '');
  for (const r of list) md.push(`- **${r.label}** (${r.area}${r.risk.includes('money') ? ', money' : ''}). ${r.why} Next: ${r.next}`);
  md.push('');
}
fs.writeFileSync(path.join(OUT, 'readiness.md'), md.join('\n'));
console.log(`readiness: ${rows.length} capabilities. ${([0, 1, 2, 3, 4] as Level[]).map((l) => `level ${l} ${LEVEL_NAME[l]}: ${out.counts[String(l) as LevelKey]}`).join(' | ')}`);
console.log('wrote atlas/reports/readiness.json and readiness.md');
process.exit(0);
