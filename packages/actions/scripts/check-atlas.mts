// Atlas consistency check (2026-11-16).
//
// Holds the generated inventory (atlas/inventory.json) and the curated areas (atlas/areas/*.ts, via
// atlas/index.ts) together. Hard errors exit 1; unclaimed hosts are warnings unless --strict.
//
// Run (any container with the workspace at /app; tsx comes from @elkdonis/lms):
//   pnpm --filter @elkdonis/actions atlas:check [-- --app arts-collective] [--strict]
//   ... --accept <capability id | repo file path | all>   re-baseline fingerprints after review (atlas/fingerprints.json)
// Freshness: each host's body fingerprint (inventory.json `hash`) is compared with atlas/fingerprints.json; hosts that
// differ are reported as "needs review". Regenerate the inventory first (atlas:inventory) so the hashes are current.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTION_CATALOGUE } from '../src/catalogue';
import { loadAreas } from '../atlas/index';
import type { InventoryHost } from '../atlas/types';
import { compareFreshness, readBaseline, writeBaseline } from '../atlas/freshness';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const appIdx = args.indexOf('--app');
const onlyApp = appIdx >= 0 ? args[appIdx + 1] : undefined;
if (appIdx >= 0 && !onlyApp) { console.error('--app needs a name'); process.exit(2); }

const acceptIdx = args.indexOf('--accept');
const acceptArg = acceptIdx >= 0 ? args[acceptIdx + 1] : undefined;
if (acceptIdx >= 0 && !acceptArg) { console.error('--accept needs a capability id, a repo file path or "all"'); process.exit(2); }

const inv = JSON.parse(fs.readFileSync(path.join(HERE, '../atlas/inventory.json'), 'utf8')) as { hosts: InventoryHost[] };
const byKey = new Map(inv.hosts.map((h) => [h.key as string, h]));
const catalogue = new Map(ACTION_CATALOGUE.map((m) => [m.id, m]));
const areas = await loadAreas();

const errors: string[] = [];
const warnings: string[] = [];
const keyApp = (key: string): string => {
  const h = byKey.get(key);
  if (h) return h.app;
  const m = /^(?:sa|api|sql):(?:apps|packages)\/([^/]+)\//.exec(key);
  return m ? m[1] : '?';
};
const inScope = (key: string) => !onlyApp || keyApp(key) === onlyApp;

const claimedBy = new Map<string, string>(); // key -> area/capability (last claim)
const claimCases = new Map<string, Set<string>>(); // key -> cases claimed ("" = whole host)
const ignoredBy = new Map<string, string>(); // key -> area
const capIds = new Map<string, string>(); // id -> area
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

for (const [areaName, area] of Object.entries(areas)) {
  for (const ig of area.ignored) {
    if (!inScope(ig.key)) continue;
    if (!byKey.has(ig.key)) errors.push(`${areaName}: ignored key not in inventory: ${ig.key}`);
    if (!ig.why?.trim()) errors.push(`${areaName}: ignored key has no reason: ${ig.key}`);
    if (ignoredBy.has(ig.key)) errors.push(`${ig.key}: ignored twice (${ignoredBy.get(ig.key)}, ${areaName})`);
    ignoredBy.set(ig.key, areaName);
  }
  for (const cap of area.capabilities) {
    const where = `${areaName}/${cap.id}`;
    const capInScope = !onlyApp || cap.hosts.some((h) => inScope(h.key));
    if (!capInScope) continue;
    if (capIds.has(cap.id)) errors.push(`${where}: capability id also used in ${capIds.get(cap.id)}`);
    capIds.set(cap.id, areaName);
    if (!KEBAB.test(cap.id)) errors.push(`${where}: id is not kebab-case`);
    for (const h of cap.hosts) {
      if (!inScope(h.key)) continue;
      if (!byKey.has(h.key)) errors.push(`${where}: claimed key not in inventory: ${h.key}`);
      // One host may serve several entries (a dispatcher such as runTenantHubAction): each claim then names its `case`.
      // A key claimed with cases may not also be claimed without one; (key, case) must be unique.
      const prior = claimCases.get(h.key);
      if (prior) {
        const c = h.case ?? '';
        if (!c || prior.has('')) errors.push(`${h.key}: claimed twice (${claimedBy.get(h.key)}, ${where}); give each claim a distinct \`case\` if one host serves several entries`);
        else if (prior.has(c)) errors.push(`${h.key}@${c}: case claimed twice (${claimedBy.get(h.key)}, ${where})`);
        prior.add(c);
      } else claimCases.set(h.key, new Set([h.case ?? '']));
      claimedBy.set(h.key, where);
      if (ignoredBy.has(h.key)) errors.push(`${h.key}: both claimed (${where}) and ignored (${ignoredBy.get(h.key)})`);
    }
    if (cap.entry) {
      if (!catalogue.has(cap.entry)) errors.push(`${where}: entry '${cap.entry}' is not in ACTION_CATALOGUE`);
    }
    if (cap.class === 'person') {
      if (!cap.risk || cap.risk.length === 0) errors.push(`${where}: person row has no risk`);
      if (!cap.status?.trim()) errors.push(`${where}: person row has no status (write 'unverifiable: why' if so)`);
      if (!cap.hosts.some((h) => h.address)) errors.push(`${where}: person row has no host with an address`);
      if (!cap.confirm?.text?.trim()) errors.push(`${where}: person row has no confirm wording`);
    }
    if (cap.risk?.includes('money')) {
      const m = cap.entry ? catalogue.get(cap.entry) : undefined;
      if (m?.runnable) warnings.push(`${where}: money risk but entry '${cap.entry}' is runnable (the dock must only link)`);
    }
  }
}
// A key both ignored in one area and claimed in another is caught above only within scope order; re-check.
for (const k of ignoredBy.keys()) if (claimedBy.has(k) && !errors.some((e) => e.startsWith(k))) errors.push(`${k}: both claimed (${claimedBy.get(k)}) and ignored (${ignoredBy.get(k)})`);

// Coverage per app
interface Cov { total: number; claimed: number; ignored: number; unclaimed: number }
const cov = new Map<string, Cov>();
const unclaimed: string[] = [];
for (const h of inv.hosts) {
  if (onlyApp && h.app !== onlyApp) continue;
  const c = cov.get(h.app) ?? { total: 0, claimed: 0, ignored: 0, unclaimed: 0 };
  c.total++;
  if (claimedBy.has(h.key)) c.claimed++;
  else if (ignoredBy.has(h.key)) c.ignored++;
  else { c.unclaimed++; unclaimed.push(h.key); }
  cov.set(h.app, c);
}
const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(`Atlas check${onlyApp ? ` (app ${onlyApp})` : ''}: ${Object.keys(areas).length} area file(s), ${capIds.size} capabilities, ${inv.hosts.length} inventory hosts`);
console.log(pad('app', 28) + pad('hosts', 8) + pad('claimed', 9) + pad('ignored', 9) + 'unclaimed');
const tot: Cov = { total: 0, claimed: 0, ignored: 0, unclaimed: 0 };
for (const [a, c] of [...cov.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
  console.log(pad(a, 28) + pad(c.total, 8) + pad(c.claimed, 9) + pad(c.ignored, 9) + c.unclaimed);
  tot.total += c.total; tot.claimed += c.claimed; tot.ignored += c.ignored; tot.unclaimed += c.unclaimed;
}
console.log(pad('TOTAL', 28) + pad(tot.total, 8) + pad(tot.claimed, 9) + pad(tot.ignored, 9) + tot.unclaimed);

if (unclaimed.length) {
  const msg = `${unclaimed.length} unclaimed host(s)${strict ? '' : ' (warning; --strict makes it an error)'}`;
  if (strict) { errors.push(msg); for (const k of unclaimed.slice(0, 20)) errors.push(`  unclaimed: ${k}`); }
  else warnings.push(msg);
}
// Freshness against the fingerprint baseline.
const baseline = readBaseline();
if (acceptArg) {
  const invHosts = onlyApp ? inv.hosts.filter((h) => h.app === onlyApp) : inv.hosts;
  let keys: string[];
  if (acceptArg === 'all') keys = invHosts.map((h) => h.key);
  else {
    const capHosts = Object.values(areas).flatMap((a) => a.capabilities).filter((c) => c.id === acceptArg).flatMap((c) => c.hosts.map((h) => h.key));
    const fileNorm = acceptArg.replace(/^\.\//, '');
    keys = capHosts.length ? capHosts : invHosts.filter((h) => h.file === fileNorm).map((h) => h.key);
    if (!keys.length) { console.error(`--accept: '${acceptArg}' matches no capability id and no inventory file`); process.exit(2); }
  }
  let n = 0;
  for (const k of keys) { const h = byKey.get(k); if (h?.hash && baseline[k] !== h.hash) { baseline[k] = h.hash; n++; } }
  if (acceptArg === 'all') for (const k of Object.keys(baseline)) if (!byKey.has(k) && (!onlyApp || keyApp(k) === onlyApp)) { delete baseline[k]; n++; }
  writeBaseline(baseline);
  console.log(`Accepted ${n} fingerprint(s) for '${acceptArg}' -> atlas/fingerprints.json`);
}
const fresh = compareFreshness(onlyApp ? inv.hosts.filter((h) => h.app === onlyApp) : inv.hosts, baseline);
const claimedCap = new Map<string, string>();
for (const area of Object.values(areas)) for (const c of area.capabilities) for (const h of c.hosts) claimedCap.set(h.key, c.id);
if (fresh.changed.length) {
  console.log(`Needs review (${fresh.changed.length}): host body changed since the baseline. Re-check the row, bump \`updated\`, then --accept <capability id | file>.`);
  for (const h of fresh.changed) console.log(`  ${claimedCap.get(h.key) ?? '(unclaimed)'}  ${h.key}`);
}
if (fresh.unbaselined.length) warnings.push(`${fresh.unbaselined.length} host(s) have no fingerprint yet (new since the baseline): ${fresh.unbaselined.slice(0, 5).map((h) => h.key).join(', ')}${fresh.unbaselined.length > 5 ? ', ...' : ''}`);
if (fresh.gone.length) warnings.push(`${fresh.gone.length} baseline entr${fresh.gone.length === 1 ? 'y is' : 'ies are'} gone from the inventory (deleted or renamed; remove the row): ${fresh.gone.slice(0, 5).join(', ')}${fresh.gone.length > 5 ? ', ...' : ''}`);
if (!fresh.changed.length) console.log('Needs review: none.');
for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  console.error(`Atlas check: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('Atlas check: no hard errors.');
process.exit(0);
