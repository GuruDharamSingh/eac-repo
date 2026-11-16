// Temporary lead helper (2026-11-16): unclaimed hosts grouped by app and file. Writes atlas/reports/_unclaimed-by-file.txt.
import { readFileSync, writeFileSync } from 'node:fs';
import { AREAS } from '../atlas/index';
const inv = JSON.parse(readFileSync(new URL('../atlas/inventory.json', import.meta.url), 'utf8')).hosts as Array<{ key: string; app: string; file: string }>;
const seen = new Set<string>();
for (const a of Object.values(AREAS)) {
  for (const c of a.capabilities) for (const h of c.hosts) seen.add(h.key);
  for (const i of a.ignored ?? []) seen.add(i.key);
}
const by = new Map<string, Map<string, number>>();
for (const h of inv) if (!seen.has(h.key)) {
  const m = by.get(h.app) ?? new Map(); m.set(h.file, (m.get(h.file) ?? 0) + 1); by.set(h.app, m);
}
const apps = [...by.entries()].sort((a, b) => sum(b[1]) - sum(a[1]));
function sum(m: Map<string, number>) { let s = 0; for (const v of m.values()) s += v; return s; }
const out: string[] = [];
for (const [app, m] of apps) {
  out.push(`## ${app} ${sum(m)}`);
  for (const [f, n] of [...m.entries()].sort((a, b) => b[1] - a[1])) out.push(`${n}\t${f}`);
  console.log(`${app} ${sum(m)} hosts in ${m.size} files`);
}
writeFileSync(new URL('../atlas/reports/_unclaimed-by-file.txt', import.meta.url), out.join('\n') + '\n');
