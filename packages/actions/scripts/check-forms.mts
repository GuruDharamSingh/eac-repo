// Checks the declared action forms against the runners (2026-11-27, lane E): every declared form belongs to a
// runnable catalogue entry, names fields the runner takes, and has an MCP input schema. Run:
//   pnpm --filter @elkdonis/lms exec tsx ../actions/scripts/check-forms.mts
// Add --print <entry> to see an entry's JSON schema.
import { ACTION_FORMS } from '../src/forms';
import { actionMeta } from '../src/catalogue';
import { actionFormJsonSchema, checkFormAgainstRunner } from '../src/server/forms';

const problems: string[] = [];
for (const [entry, form] of Object.entries(ACTION_FORMS)) {
  const meta = actionMeta(entry);
  if (!meta) { problems.push(`${entry}: declared form for an entry the catalogue does not have.`); continue; }
  if (!meta.runnable) problems.push(`${entry}: declared form but the entry is not runnable.`);
  if (meta.dockForm !== entry) problems.push(`${entry}: catalogue dockForm is "${meta.dockForm}", expected the entry id.`);
  const names = new Set<string>();
  for (const f of form.fields) {
    if (names.has(f.name)) problems.push(`${entry}: field "${f.name}" appears twice.`);
    names.add(f.name);
    if ((f.kind === 'select' || f.kind === 'choice') && !f.options.length) problems.push(`${entry}: ${f.name} has no options.`);
    if (f.showIf && !form.fields.some((g) => g.name === f.showIf!.field)) problems.push(`${entry}: ${f.name} shows on an unknown field "${f.showIf.field}".`);
  }
  problems.push(...checkFormAgainstRunner(entry));
  if (!actionFormJsonSchema(entry)) problems.push(`${entry}: no JSON schema.`);
}
const i = process.argv.indexOf('--print');
if (i > 0) console.log(JSON.stringify(actionFormJsonSchema(process.argv[i + 1]), null, 2));
console.log(`Forms check: ${Object.keys(ACTION_FORMS).length} declared forms, ${problems.length} problems.`);
for (const p of problems) console.log(' -', p);
process.exit(problems.length ? 1 : 0);
