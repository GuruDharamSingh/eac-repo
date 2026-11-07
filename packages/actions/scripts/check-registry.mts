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
import { RUNNERS } from '../src/server/run';
import { CHECKS } from '../src/server/status';

const problems: string[] = [];
const ids = new Set<string>();

for (const m of ACTION_CATALOGUE) {
  if (ids.has(m.id)) problems.push(`${m.id}: listed twice in the catalogue`);
  ids.add(m.id);
  const hasRunner = Object.hasOwn(RUNNERS, m.id);
  const hasCheck = Object.hasOwn(CHECKS, m.id);
  if (m.runnable !== hasRunner) problems.push(`${m.id}: catalogue says runnable=${m.runnable}, RUNNERS ${hasRunner ? 'has' : 'lacks'} a runner`);
  if (m.derived !== hasCheck) problems.push(`${m.id}: catalogue says derived=${m.derived}, CHECKS ${hasCheck ? 'has' : 'lacks'} a check`);
  for (const p of m.params ?? []) {
    if (!p.options.some((o) => o.value === p.default)) problems.push(`${m.id}: param ${p.name} default '${p.default}' is not one of its options`);
    const values = p.options.map((o) => o.value);
    if (new Set(values).size !== values.length) problems.push(`${m.id}: param ${p.name} repeats an option`);
  }
}
for (const id of Object.keys(RUNNERS)) if (!ids.has(id)) problems.push(`${id}: has a runner but no catalogue entry`);
for (const id of Object.keys(CHECKS)) if (!ids.has(id)) problems.push(`${id}: has a check but no catalogue entry`);

if (problems.length) {
  console.error(`Registry check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`Registry check: ${ACTION_CATALOGUE.length} entries, ${Object.keys(RUNNERS).length} runners, ${Object.keys(CHECKS).length} checks, consistent.`);
process.exit(0);
