// Atlas reports (2026-11-16): coverage.md, drift.md and, with --wave N, wording-wave-NN.md.
// Reads atlas/inventory.json and atlas/areas/*.ts (via atlas/index.ts); writes atlas/reports/.
//
// Run (any container with the workspace at /app; tsx comes from @elkdonis/lms):
//   pnpm --filter @elkdonis/actions atlas:reports [-- --wave 1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAreas } from '../atlas/index';
import type { Capability, InventoryHost } from '../atlas/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, '../atlas/reports');
const args = process.argv.slice(2);
const waveIdx = args.indexOf('--wave');
const wave = waveIdx >= 0 ? Number(args[waveIdx + 1]) : undefined;
if (waveIdx >= 0 && !(Number.isInteger(wave) && wave! > 0)) { console.error('--wave needs a positive integer'); process.exit(2); }

const inv = JSON.parse(fs.readFileSync(path.join(HERE, '../atlas/inventory.json'), 'utf8')) as { generatedAt: string; hosts: InventoryHost[] };
const byKey = new Map(inv.hosts.map((h) => [h.key as string, h]));
const areas = await loadAreas();
fs.mkdirSync(REPORTS, { recursive: true });

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const claimedBy = new Map<string, string>();
const ignoredBy = new Map<string, string>();
const capOf = new Map<string, { area: string; cap: Capability }>();
for (const [areaName, area] of Object.entries(areas)) {
  for (const ig of area.ignored) ignoredBy.set(ig.key, areaName);
  for (const cap of area.capabilities) for (const h of cap.hosts) { claimedBy.set(h.key, areaName); capOf.set(h.key, { area: areaName, cap }); }
}
const appOfKey = (k: string) => byKey.get(k)?.app ?? /^(?:sa|api|sql):(?:apps|packages)\/([^/]+)\//.exec(k)?.[1] ?? '?';
const allCaps = Object.entries(areas).flatMap(([a, ar]) => ar.capabilities.map((c) => ({ area: a, cap: c })));
const stamp = `Generated from inventory of ${inv.generatedAt}. Do not edit; regenerate with \`pnpm --filter @elkdonis/actions atlas:reports\`.`;

// ---------------------------------------------------------------- coverage.md
{
  const L: string[] = ['# Atlas coverage', '', stamp, ''];
  const apps = [...new Set(inv.hosts.map((h) => h.app))].sort(cmp);
  L.push('## Per app', '', '| app | hosts | claimed | ignored | unclaimed | covered |', '|---|--:|--:|--:|--:|--:|');
  let T = 0, C = 0, I = 0;
  const unclaimedByApp = new Map<string, InventoryHost[]>();
  for (const a of apps) {
    const hs = inv.hosts.filter((h) => h.app === a);
    const c = hs.filter((h) => claimedBy.has(h.key)).length;
    const i = hs.filter((h) => !claimedBy.has(h.key) && ignoredBy.has(h.key)).length;
    const un = hs.filter((h) => !claimedBy.has(h.key) && !ignoredBy.has(h.key));
    unclaimedByApp.set(a, un);
    T += hs.length; C += c; I += i;
    L.push(`| ${a} | ${hs.length} | ${c} | ${i} | ${un.length} | ${hs.length ? Math.round(((c + i) / hs.length) * 100) : 0}% |`);
  }
  L.push(`| **total** | ${T} | ${C} | ${I} | ${T - C - I} | ${T ? Math.round(((C + I) / T) * 100) : 0}% |`, '');

  L.push('## Per area', '');
  if (!Object.keys(areas).length) L.push('No area files yet (`atlas/areas/`).', '');
  else {
    L.push('| area | capabilities | hosts claimed | ignored | person rows | with entry | entry null (should get one) | no entry |', '|---|--:|--:|--:|--:|--:|--:|--:|');
    for (const [name, area] of Object.entries(areas)) {
      const person = area.capabilities.filter((c) => c.class === 'person');
      const withE = person.filter((c) => typeof c.entry === 'string').length;
      const nul = person.filter((c) => c.entry === null).length;
      L.push(`| ${name} | ${area.capabilities.length} | ${area.capabilities.reduce((n, c) => n + c.hosts.length, 0)} | ${area.ignored.length} | ${person.length} | ${withE} | ${nul} | ${person.length - withE - nul} |`);
    }
    L.push('');
  }

  const allPerson = allCaps.filter((x) => x.cap.class === 'person');
  const withEntry = allPerson.filter((x) => typeof x.cap.entry === 'string').length;
  const wantEntry = allPerson.filter((x) => x.cap.entry === null).length;
  L.push('## Registry coverage', '', `Person rows: ${allPerson.length}. With a registry entry: ${withEntry}. Should get one (entry null): ${wantEntry}. Without and not marked: ${allPerson.length - withEntry - wantEntry}.`, '');
  const rawRouted = inv.hosts.filter((h) => h.kind !== 'sql' && h.registry).length;
  L.push(`Hosts that call a registry door in code (inventory): ${rawRouted} of ${inv.hosts.filter((h) => h.kind !== 'sql').length} sa/api hosts.`, '');

  L.push('## Unclaimed, for apps with area files in progress', '');
  const inProgress = [...new Set(Object.keys(areas).map((n) => n.split('.')[0]))].sort(cmp);
  if (!inProgress.length) L.push('None in progress.', '');
  for (const a of inProgress) {
    const un = unclaimedByApp.get(a) ?? [];
    L.push(`### ${a} (${un.length} unclaimed)`, '');
    for (const h of un) L.push(`- \`${h.key}\`${h.rawSql ? ' (raw SQL)' : ''}`);
    L.push('');
  }
  fs.writeFileSync(path.join(REPORTS, 'coverage.md'), L.join('\n'));
}

// ---------------------------------------------------------------- drift.md
{
  const L: string[] = ['# Atlas drift', '', stamp, '', 'Drift is recorded, not fixed. Merging to a `canonical` path is a separate, approved pass.', ''];
  const hostApp = (key: string) => byKey.get(key)?.app ?? (/^(?:sa|api|sql):(?:apps|packages)\/([^/]+)\//.exec(key)?.[1] ?? '?');
  const svcOf = (h: { key: string; service?: string[] }) => (h.service && h.service.length ? h.service : byKey.get(h.key)?.calls ?? []).slice().sort(cmp).join(', ') || '(none resolved)';
  // ---- A. one section per canonical target: the homogenising worklist
  L.push('## Homogenising worklist: one section per canonical target', '',
    'After consolidation 2 one capability = one row with every host across apps. Sections are grouped by the `canonical` path the hosts should converge on, widest first (apps, then hosts). "Differences" are the per-app notes the merge folded into the row\'s `drift`. Only groups that span two or more apps or two or more rows are listed.', '');
  const groups = new Map<string, { area: string; cap: Capability }[]>();
  for (const x of allCaps) {
    const k = (x.cap.canonical ?? '(no canonical recorded)').trim();
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(x);
  }
  const rows = [...groups.entries()].map(([canon, caps]) => {
    const hosts = caps.flatMap((c) => c.cap.hosts);
    const apps = [...new Set(hosts.map((h) => hostApp(h.key)))].sort(cmp);
    const svc = new Set(hosts.map(svcOf));
    return { canon, caps, hosts, apps, svc };
  }).filter((g) => g.apps.length >= 2 || g.caps.length >= 2)
    .sort((a, b) => Number(a.canon.startsWith('(no canonical')) - Number(b.canon.startsWith('(no canonical')) || b.apps.length - a.apps.length || b.hosts.length - a.hosts.length || cmp(a.canon, b.canon));
  L.push('| canonical target | apps | hosts | rows | service variants |', '|---|--:|--:|--:|--:|');
  const cell = (s: string) => s.replace(/\|/g, '/').slice(0, 90);
  for (const g of rows) L.push(`| ${cell(g.canon)} | ${g.apps.length} | ${g.hosts.length} | ${g.caps.length} | ${g.svc.size} |`);
  L.push('');
  for (const g of rows) {
    if (g.canon.startsWith('(no canonical')) {
      L.push(`### ${g.canon}`, '', `${g.caps.length} rows have no canonical path recorded yet (mostly single-app writers); ids: ${g.caps.map((c) => c.cap.id).sort(cmp).join(', ')}`, '');
      continue;
    }
    L.push(`### ${g.canon}`, '',
      `- apps (${g.apps.length}): ${g.apps.join(', ')}`,
      `- hosts: ${g.hosts.length}; rows: ${g.caps.length}; distinct service sets: ${g.svc.size}`, '');
    for (const { area, cap } of g.caps.sort((a, b) => cmp(a.cap.id, b.cap.id))) {
      const capApps = [...new Set(cap.hosts.map((h) => hostApp(h.key)))].sort(cmp);
      L.push(`#### ${cap.id} (${area}): ${cap.label}`, '', `${capApps.length} app(s), ${cap.hosts.length} host(s): ${capApps.join(', ')}.`, '');
      const d = cap.drift ?? '';
      const diffs = d.split('\n').filter((l) => l.startsWith('- '));
      const dir = d.split('\n').filter((l) => /^(Direction|amrit-canada is the oldest|Related|Kept separate)/.test(l));
      if (diffs.length) { L.push('Differences:', '', ...diffs, ''); }
      else if (d) L.push(`Curator note: ${d.replace(/\n/g, ' ').slice(0, 600)}`, '');
      if (dir.length) L.push(...dir.map((l) => `> ${l}`), '');
    }
  }

  // ---- B. within one row (and one app), hosts that call different services
  L.push('## Rows whose hosts call different services', '');
  let n = 0;
  for (const { area, cap } of allCaps.slice().sort((a, b) => cmp(a.cap.id, b.cap.id))) {
    if (cap.hosts.length < 2) continue;
    const variants = new Map<string, string[]>();
    for (const h of cap.hosts) variants.set(svcOf(h), [...(variants.get(svcOf(h)) ?? []), h.key]);
    if (variants.size < 2) continue;
    n++;
    L.push(`### ${cap.id} (${area})`, '', `${cap.label}.${cap.canonical ? ` Canonical: \`${cap.canonical}\`.` : ''}`, '');
    for (const [svc, keys] of [...variants.entries()].sort((a, b) => cmp(a[0], b[0]))) {
      L.push(`- calls: ${svc}`);
      for (const k of keys.sort(cmp)) L.push(`  - \`${k}\``);
    }
    L.push('');
  }
  if (!n) L.push('None.', '');

  L.push('## Hosts with raw SQL in their own body', '');
  const raw = inv.hosts.filter((h) => h.rawSql && h.kind !== 'sql');
  const apps = [...new Set(raw.map((h) => h.app))].sort(cmp);
  L.push(`${raw.length} sa/api hosts write SQL directly instead of going through a service. ${inv.hosts.filter((h) => h.kind === 'sql').length} sql sites in total (see inventory).`, '');
  L.push('| app | raw-SQL sa/api hosts | claimed |', '|---|--:|--:|');
  for (const a of apps) { const hs = raw.filter((h) => h.app === a); L.push(`| ${a} | ${hs.length} | ${hs.filter((h) => claimedBy.has(h.key)).length} |`); }
  L.push('');
  for (const a of apps) {
    L.push(`### ${a}`, '');
    for (const h of raw.filter((x) => x.app === a)) L.push(`- \`${h.key}\`${capOf.has(h.key) ? ` (cap: ${capOf.get(h.key)!.cap.id})` : ''}`);
    L.push('');
  }

  L.push('## Same export name in 3+ apps (homogenising candidates)', '');
  const bySym = new Map<string, Set<string>>();
  for (const h of inv.hosts) {
    if (h.kind !== 'sa' || h.symbol === 'default' || h.symbol.includes('/')) continue;
    (bySym.get(h.symbol) ?? bySym.set(h.symbol, new Set()).get(h.symbol)!).add(h.app);
  }
  const dup = [...bySym.entries()].filter(([, s]) => s.size >= 3).sort((a, b) => b[1].size - a[1].size || cmp(a[0], b[0]));
  L.push(`${dup.length} server-action names appear in 3 or more apps. Top 40:`, '', '| export | apps | where |', '|---|--:|---|');
  for (const [sym, set] of dup.slice(0, 40)) L.push(`| \`${sym}\` | ${set.size} | ${[...set].sort(cmp).join(', ')} |`);
  L.push('');
  fs.writeFileSync(path.join(REPORTS, 'drift.md'), L.join('\n'));
}

// ---------------------------------------------------------------- wording wave
let waveRows = 0;
if (wave !== undefined) {
  const nn = String(wave).padStart(2, '0');
  const rows = allCaps
    .filter(({ cap }) => cap.class === 'person' && cap.confirm?.status === 'draft' && (cap.confirm.wave === undefined || cap.confirm.wave === wave))
    .map((r) => ({ area: r.cap.area, cap: r.cap }))
    .sort((a, b) => cmp(a.area.split('.')[0], b.area.split('.')[0]) || cmp(a.area, b.area) || cmp(a.cap.id, b.cap.id));
  waveRows = rows.length;
  const WHO: Record<string, string> = { visitor: 'a visitor', person: 'any signed-in person', member: 'a member', guide: 'a guide', owner: 'an owner', operator: 'an operator', admin: 'a network admin', system: 'the system' };
  const RISK: Record<string, string> = {
    money: '[MONEY: the dock only points to the checkout, it never pays or charges]',
    irreversible: '[CANNOT BE UNDONE]', public: '[PUBLIC: others can see the result]', emails: '[SENDS EMAIL]', others: '[AFFECTS OTHER PEOPLE]',
  };
  const firstSentence = (t: string) => { const m = /^.*?[.!?](?=\s|$)/.exec(t.trim()); return m ? m[0] : t.trim(); };
  const plainHow = (h: string) => h.replace(/\s*\([^)]*\.tsx?[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' or ' + xs[xs.length - 1]);
  const AREA_NAMES: Record<string, string> = { hub: 'Your hub', studio: 'The Studio', channel: 'Channel (social posting)', learn: 'Learning', network: 'Account and network', sites: 'Organisation sites', media: 'Pureland', orgapps: 'The other organisations’ sites' };
  const L: string[] = [
    `# Confirm wording, wave ${nn}`, '', stamp, '',
    '## How to answer', '',
    'When the dock helps someone do something on the network, it first shows a small card asking "are you sure?". Below is every card in this batch, so you can check the wording before anyone sees it. Nothing here is live until you approve it.',
    '',
    'Each item has a short description, the card text, and one line to answer:',
    '',
    '- **Approve:** put an x in "approve" if the card text is right as it is.',
    '- **Change:** put an x in "change to" and write the sentence you want after it.',
    '- Words in {curly braces}, such as {title} or {org}, are filled in with the real name when the card appears. Leave them in.',
    '- The badges tell you how careful the card must be. MONEY cards never run anything: the dock only takes the person to the checkout or Stripe page.',
    '- The style we aimed for: short, plain, "you", say what changes and who will see it. Tell us if a card does not sound like you.',
    '', `${rows.length} cards.`, '',
  ];
  let lastArea = '';
  let n = 0;
  for (const { area, cap } of rows) {
    if (area !== lastArea) { L.push(`## ${AREA_NAMES[area.split('.')[0]] ?? area.split('.')[0]} (${area})`, ''); lastArea = area; }
    n++;
    const where = cap.hosts.find((h) => h.address?.how)?.address;
    const badges = cap.risk.filter((r) => RISK[r]).map((r) => RISK[r]);
    L.push(
      `### ${n}. ${cap.label} (${cap.id})`,
      '',
      `${firstSentence(cap.does)} Done by ${list(cap.actors.map((a) => WHO[a] ?? a))}.${where ? ` You find it at: ${plainHow(where.how)}` : ''}`,
      '',
      badges.length ? badges.join(' ') : '[No special risk]',
      '',
      `> **The card will say:** ${cap.confirm!.text}`,
    );
    if (cap.confirm!.note) L.push('', `Note: ${cap.confirm!.note}`);
    L.push('', '**Answer:**  [ ] approve   [ ] change to: ______________________________', '');
  }
  if (!rows.length) L.push('No draft person rows for this wave.', '');
  fs.writeFileSync(path.join(REPORTS, `wording-wave-${nn}.md`), L.join('\n'));
}

console.log(`Atlas reports written to atlas/reports/: coverage.md, drift.md${wave !== undefined ? `, wording-wave-${String(wave).padStart(2, '0')}.md (${waveRows} rows)` : ''}`);
