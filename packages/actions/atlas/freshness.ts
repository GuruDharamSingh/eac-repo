// Atlas freshness (2026-11-16): compares each inventory host's body fingerprint with the committed baseline
// atlas/fingerprints.json ({ hostKey: hash }). A host whose hash differs "needs review": its code changed since the
// row was last checked. Node-only; used by scripts/check-atlas.mts and scripts/atlas-q.mts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InventoryHost } from './types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const INVENTORY_PATH = path.join(HERE, 'inventory.json');
export const BASELINE_PATH = path.join(HERE, 'fingerprints.json');

export type Baseline = Record<string, string>;

export function readInventory(): { generatedAt: string; hosts: InventoryHost[] } {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

export function readBaseline(): Baseline {
  try { return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline; } catch { return {}; }
}

export function writeBaseline(b: Baseline): void {
  const keys = Object.keys(b).sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  const out: Baseline = {};
  for (const k of keys) out[k] = b[k];
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 1) + '\n');
}

export interface Freshness {
  /** hash differs from the baseline */
  changed: InventoryHost[];
  /** in the inventory, not in the baseline (added since it was seeded) */
  unbaselined: InventoryHost[];
  /** in the baseline, gone from the inventory (deleted or renamed) */
  gone: string[];
}

export function compareFreshness(hosts: InventoryHost[], baseline: Baseline): Freshness {
  const seen = new Set<string>();
  const changed: InventoryHost[] = [];
  const unbaselined: InventoryHost[] = [];
  for (const h of hosts) {
    seen.add(h.key);
    const b = baseline[h.key];
    if (b === undefined) unbaselined.push(h);
    else if (h.hash && b !== h.hash) changed.push(h);
  }
  const gone = Object.keys(baseline).filter((k) => !seen.has(k));
  return { changed, unbaselined, gone };
}

/** Keys that need review (changed or unbaselined), as a set, for atlas-q. */
export function needsReviewKeys(hosts: InventoryHost[], baseline: Baseline): Set<string> {
  const f = compareFreshness(hosts, baseline);
  return new Set([...f.changed, ...f.unbaselined].map((h) => h.key));
}
