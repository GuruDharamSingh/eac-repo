/**
 * Every declared merge field must actually become a slot.
 *
 *   pnpm --filter @elkdonis/email check:fields
 *
 * The seeder finds a field in a rendered letter by searching for the string
 * that field rendered AS. That only works while the field's `from` reader
 * produces the same string the template wrote — and three of them did not:
 * `when` used one date format while `reminder` uses another, `threadUrl` and
 * `rsvpUrl` shared a sample value so only one could be found, and
 * `reminderSettingsUrl` on the reminder renders in the footer, outside the
 * region an org can edit at all.
 *
 * None of those failed loudly. The seeded layout simply had a real date baked
 * in where a slot should have been, and would have mailed that date to
 * everyone. So the check is: seed each letter, and assert every field it
 * declares is present as `{token}` and none of its sample values survived.
 */
import { renderTemplateBody } from "../src/seed";
import { mergeFieldsFor, mergeValuesFor, fillHtml } from "../src/merge-fields";
import { sampleProps, type SampleOptions } from "../src/samples";
import { TEMPLATE_META } from "../src/samples";

const ORG = "Amrit Canada";
let failures = 0;

/**
 * Sample variants per letter. A field may appear in only one variant: the
 * reminder's `{comingUrl}` is seeded only for `purpose: 'subscriber'`
 * (claude, 2026-10-10). Every declared field must appear in at least one
 * variant; the other checks run on each variant.
 */
const VARIANTS: Record<string, SampleOptions[]> = {
  reminder: [{}, { purpose: "subscriber" }],
};

for (const meta of TEMPLATE_META) {
  const fields = mergeFieldsFor(meta.key);
  if (!meta.editable || fields.length === 0) continue;

  const problems: string[] = [];
  const seeds: string[] = [];
  for (const variant of VARIANTS[meta.key] ?? [{}]) {
    const opts: SampleOptions = { orgName: ORG, ...variant };
    const label = variant.purpose ? ` (${variant.purpose})` : "";
    const body = await renderTemplateBody(meta.key, opts);
    seeds.push(body);
    if (!body) {
      problems.push(`seeded to nothing${label} — no editable body found in the render`);
    }
    problems.push(...checkSeed(meta.key, body, opts).map((p) => p + label));
  }

  for (const field of fields) {
    if (!seeds.some((body) => body.includes(`{${field.name}}`))) {
      problems.push(
        `{${field.name}} is declared but never appears — its reader does not ` +
          `match what the template renders, or the value is outside the editable body`
      );
    }
  }

  const mark = problems.length === 0 ? "ok  " : "FAIL";
  console.log(
    `${mark}  ${meta.key.padEnd(16)} ${fields.length} field(s), ${seeds.map((b) => b.length).join("/")} bytes`
  );
  for (const problem of problems) console.log(`        ${problem}`);
  if (problems.length > 0) failures += 1;
}

function checkSeed(key: string, body: string, opts: SampleOptions): string[] {
  const problems: string[] = [];
  const fields = mergeFieldsFor(key);
  // The other direction: a sample value that survived into the seed is a real
  // person's name about to be mailed to everyone.
  const rendered = mergeValuesFor(key, sampleProps(key, opts));
  for (const [name, value] of Object.entries(rendered)) {
    if (value && value.length > 6 && body.includes(value)) {
      problems.push(`the sample value for {${name}} survived into the seed: "${value}"`);
    }
  }

  // The round trip: what the editor is seeded with must fill back in. This is
  // the thing that actually has to hold at send time, and asserting it here
  // means a token that renders but cannot be filled — a mismatched key, a
  // stray brace in copy — fails the script instead of shipping.
  const filled = fillHtml(body, rendered);
  const leftOver = [...filled.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (leftOver.length > 0) {
    problems.push(`unfilled after substitution: ${[...new Set(leftOver)].join(", ")}`);
  }
  for (const field of fields) {
    const value = rendered[field.name];
    if (value && !filled.includes(value)) {
      problems.push(`{${field.name}} did not fill back in`);
    }
  }

  // And that case does not matter, because an uppercase cell displays
  // {THREADKIND} on the canvas while the HTML says {threadKind}.
  const shouted = body.replace(/\{(\w+)\}/g, (_w, k: string) => `{${k.toUpperCase()}}`);
  if (/\{\w+\}/.test(fillHtml(shouted, rendered))) {
    problems.push("an upper-cased token was not filled — fillHtml is case-sensitive again");
  }
  return problems;
}

console.log(failures === 0 ? "\nall letters seed cleanly" : `\n${failures} letter(s) with problems`);
if (failures > 0) process.exitCode = 1;
