// Atlas query (2026-11-16): search and reverse-lookup the action atlas from the command line.
//
// Run (any container with the workspace at /app; tsx comes from @elkdonis/lms):
//   pnpm --filter @elkdonis/actions atlas:q -- <term...> [filters]
// Term: words, all must appear (case-insensitive) in id, label, does, area or any note/drift/open text.
// Filters:
//   --app <name>       a host lives in apps/<name> or packages/<name>
//   --area <text>      area file name or capability area contains text
//   --risk <value>     money | irreversible | public | emails | others | none
//   --status <value>   substring of the status text; `none` = no status; `unverifiable` = marked unverifiable
//   --security         rows whose notes carry SECURITY
//   --entry            rows with a registry entry
//   --needs-review     rows with a host whose body changed (or is new) against atlas/fingerprints.json
//   --file <path>      reverse lookup: capabilities with a host in that repo file
//   --host <key>       reverse lookup: the capability claiming that exact host key (sa:/api:/sql:...)
//   --full             print each row in full (default: one line per capability)
//   --json             machine-readable output (array of capabilities plus their area)
// Needs-review reads the same comparison as check-atlas (run atlas:inventory first so hashes are current).
import { loadAreas } from '../atlas/index';
import { readBaseline, readInventory, needsReviewKeys } from '../atlas/freshness';
import type { Capability } from '../atlas/types';

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--app', '--area', '--risk', '--status', '--file', '--host']);
const BOOL_FLAGS = new Set(['--security', '--entry', '--needs-review', '--full', '--json']);
const opt: Record<string, string> = {};
const bool = new Set<string>();
const words: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--') continue;
  if (VALUE_FLAGS.has(a)) {
    if (i + 1 >= argv.length) { console.error(`${a} needs a value`); process.exit(2); }
    opt[a] = argv[++i];
  } else if (BOOL_FLAGS.has(a)) bool.add(a);
  else if (a.startsWith('--')) { console.error(`unknown flag ${a}`); process.exit(2); }
  else words.push(a.toLowerCase());
}

const areas = await loadAreas();
const inv = readInventory();
const review = bool.has('--needs-review') ? needsReviewKeys(inv.hosts, readBaseline()) : new Set<string>();
const keyApp = (key: string) => /^(?:sa|api|sql):(?:apps|packages)\/([^/]+)\//.exec(key)?.[1] ?? '?';
const keyFile = (key: string) => key.replace(/^(?:sa|api|sql):/, '').replace(/#.*$/, '');
const textOf = (c: Capability) => [c.id, c.label, c.does, c.area, c.drift, c.open, c.canonical, c.inputs, ...c.hosts.map((h) => h.note)].filter(Boolean).join('\n').toLowerCase();
const securityOf = (c: Capability) => [c.drift, c.open, c.does, ...c.hosts.map((h) => h.note)].some((t) => t?.includes('SECURITY'));
const isUnverifiable = (c: Capability) => /unverifiable/i.test(c.status ?? '');

interface Row { areaFile: string; cap: Capability }
let rows: Row[] = Object.entries(areas).flatMap(([areaFile, a]) => a.capabilities.map((cap) => ({ areaFile, cap })));

rows = rows.filter(({ areaFile, cap }) => {
  const t = textOf(cap);
  if (!words.every((w) => t.includes(w))) return false;
  if (opt['--app'] && !cap.hosts.some((h) => keyApp(h.key) === opt['--app'])) return false;
  if (opt['--area']) { const q = opt['--area'].toLowerCase(); if (!areaFile.toLowerCase().includes(q) && !cap.area.toLowerCase().includes(q)) return false; }
  if (opt['--risk'] && !cap.risk.includes(opt['--risk'] as never)) return false;
  if (opt['--status']) {
    const v = opt['--status'].toLowerCase();
    if (v === 'none') { if (cap.status?.trim()) return false; }
    else if (v === 'unverifiable') { if (!isUnverifiable(cap)) return false; }
    else if (!(cap.status ?? '').toLowerCase().includes(v)) return false;
  }
  if (bool.has('--security') && !securityOf(cap)) return false;
  if (bool.has('--entry') && !cap.entry) return false;
  if (bool.has('--needs-review') && !cap.hosts.some((h) => review.has(h.key))) return false;
  if (opt['--file']) { const f = opt['--file'].replace(/^\.\//, ''); if (!cap.hosts.some((h) => keyFile(h.key) === f)) return false; }
  if (opt['--host'] && !cap.hosts.some((h) => h.key === opt['--host'])) return false;
  return true;
});
rows.sort((a, b) => (a.cap.id < b.cap.id ? -1 : a.cap.id > b.cap.id ? 1 : 0));

if (bool.has('--json')) {
  console.log(JSON.stringify(rows.map(({ areaFile, cap }) => ({ areaFile, ...cap, needsReview: cap.hosts.some((h) => review.has(h.key)) })), null, 1));
  process.exit(0);
}

for (const { areaFile, cap } of rows) {
  if (bool.has('--full')) {
    console.log(`${cap.id}  [${areaFile}]  added ${cap.added ?? '2026-11-16'}${cap.updated ? `, updated ${cap.updated}` : ''}`);
    console.log(`  ${cap.label}: ${cap.does}`);
    console.log(`  class ${cap.class} · actors ${cap.actors.join(',')} · scope ${cap.scope} · risk ${cap.risk.join(',') || 'none'}${cap.entry ? ` · entry ${cap.entry}` : ''}`);
    if (cap.status) console.log(`  status: ${cap.status}`);
    if (cap.drift) console.log(`  drift: ${cap.drift}`);
    if (cap.open) console.log(`  open: ${cap.open}`);
    for (const h of cap.hosts) console.log(`  - ${h.key}${h.case ? ` @${h.case}` : ''}${h.address ? `  -> ${h.address.app}${h.address.path}` : ''}${h.note ? `\n      ${h.note}` : ''}`);
    console.log('');
  } else {
    const first = cap.hosts[0] ? keyFile(cap.hosts[0].key) : '-';
    const flag = bool.has('--needs-review') || cap.hosts.some((h) => review.has(h.key)) ? ' *' : '';
    console.log(`${cap.id} · ${cap.label} · ${cap.risk.join(',') || 'none'} · ${cap.hosts.length} host${cap.hosts.length === 1 ? '' : 's'} · ${first}${flag}`);
  }
}
console.error(`${rows.length} capabilit${rows.length === 1 ? 'y' : 'ies'}`);
