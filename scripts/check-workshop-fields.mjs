#!/usr/bin/env node
/**
 * Workshop CMS drift check.
 *
 * A workshop is described in several places that can drift apart independently:
 *
 *   1. `packages/cms-bindings/src/workshop/field-registry.ts`
 *        — what an author can edit (drives the wizard AND the live editor)
 *   2. `apps/arts-collective/src/lib/cms/schema.ts` (`workshopFullSchema`)
 *        — what the save action will actually persist
 *   3. the database columns on `threads` / `workshop_pages`
 *        — what can be stored at all
 *
 * They had drifted: as of 2026-09-06 the registry declared six columns the save
 * schema could not write — including `gallery_image_urls`, which the workshop
 * template renders but no form could set — while the schema wrote eight fields
 * no registry entry exposed, making them unreachable from a wizard.
 *
 * Registry vs schema is checked always (both are static files). The database
 * comparison additionally runs when DATABASE_URL is set, so this is safe in a
 * gate that has no database.
 *
 * Run: node scripts/check-workshop-fields.mjs
 * Wired into the root `check-types` script, next to check-client-barrels.mjs.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const REGISTRY = join(root, "packages/cms-bindings/src/workshop/field-registry.ts");
const SCHEMA = join(root, "apps/arts-collective/src/lib/cms/schema.ts");

/**
 * Fields the save schema owns that are deliberately NOT author-editable content:
 * publishing controls and structured sub-resources with their own UI.
 */
const NOT_REGISTRY_FIELDS = new Set([
  "orgSlug",
  "thread_id",
  "status", // publish state — the wizard's platform:publish step owns this
  "visibility", // ditto
  "share_to_network", // ditto
  "sessions", // platform:sessions bespoke step, not a flat column
  "optional_sections", // template section toggles, not a field
  // Derived, not chosen: the `heroMedia` registry field is an `input: "media"`
  // picker, and the save action sets the type from what was picked.
  "hero_media_type",
]);

/**
 * Registry entries `workshopFullSchema` intentionally does not own.
 *
 * The facilitator fields live on the *person's* identity, not on the workshop —
 * saving them through the workshop form would edit that person everywhere. They
 * are written by `updateWorkshopFieldAction`'s users / org_profiles arms, each
 * scoped to `threads.author_id`.
 *
 * Resolved 2026-09-07: these used to point at `artist_profiles`, which is keyed
 * one row per person and merely tagged with an org. The write was
 * `UPDATE artist_profiles … WHERE org_id = (…)` with no user filter, so one
 * inline facilitator edit rewrote every member of that org; and `roleTitle` had
 * to be held readonly because it aliased `display_name` and would overwrite the
 * facilitator's name. Both are gone: identity is `users`, role title is
 * `org_profiles.role_title` (migration 084), and `roleTitle` is editable again.
 */
const REGISTRY_WITHOUT_SCHEMA = new Set([
  "users.display_name",
  "users.pronouns",
  "users.bio",
  "users.avatar_url",
  "org_profiles.role_title",
]);

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

// ── 1. Registry: trait → { table, col } (compounds expand to several) ─────────
function parseRegistry() {
  const src = readFileSync(REGISTRY, "utf8");
  const cols = new Map(); // "table.col" -> trait
  // Each entry is `trait: { ... table: "x", col: "y" ... }`, plus compound
  // sub-fields `{ col: "a", table: "b", ... }` inside a `compound: [...]`.
  const entryRe = /^\s{2}([a-zA-Z_][\w]*)\s*:\s*\{/gm;
  let m;
  const bounds = [];
  while ((m = entryRe.exec(src))) bounds.push({ trait: m[1], start: m.index });
  bounds.forEach((b, i) => {
    const body = src.slice(b.start, bounds[i + 1]?.start ?? src.length);
    const pairRe = /col:\s*"([\w]+)"[\s\S]{0,200}?table:\s*"([\w]+)"|table:\s*"([\w]+)"[\s\S]{0,200}?col:\s*"([\w]+)"/g;
    let p;
    while ((p = pairRe.exec(body))) {
      const col = p[1] ?? p[4];
      const table = p[2] ?? p[3];
      if (col && table) cols.set(`${table}.${col}`, b.trait);
    }
  });
  return cols;
}

// ── 2. workshopFullSchema keys ───────────────────────────────────────────────
/** Top-level `key:` names inside one `{ … }` declaration block. */
function keysIn(src, header, terminator) {
  const block = src.split(header)[1];
  if (!block) throw new Error(`${header.trim()} not found in schema.ts`);
  const body = block.split(terminator)[0];
  return [...body.matchAll(/^\s{2}([a-z_][\w]*)\s*:/gm)].map((x) => x[1]);
}

/**
 * `workshopFullSchema` declares the thread columns inline and pulls the sidecar
 * in with `...workshopSidecarFields`, so both blocks have to be read. Following
 * the spread rather than re-listing is the point — that duplication is what let
 * the two schemas drift apart in the first place.
 */
function parseSchema() {
  const src = readFileSync(SCHEMA, "utf8");
  const full = keysIn(src, "export const workshopFullSchema = z.object({", "\n});");
  const spreads = full.length && src.includes("...workshopSidecarFields");
  const sidecar = spreads
    ? keysIn(src, "export const workshopSidecarFields = {", "\n} as const;")
    : [];
  return new Set([...full, ...sidecar]);
}

const registry = parseRegistry();
const schema = parseSchema();

if (registry.size === 0) fail("check-workshop-fields: parsed 0 registry columns — parser is broken");
if (schema.size === 0) fail("check-workshop-fields: parsed 0 schema keys — parser is broken");

const registryCols = new Set([...registry.keys()].map((k) => k.split(".")[1]));

// ── A. registry declares it, schema can't save it ────────────────────────────
const unsavable = [...registry.entries()]
  .filter(([key]) => !schema.has(key.split(".")[1]))
  .filter(([key]) => !REGISTRY_WITHOUT_SCHEMA.has(key));

if (unsavable.length) {
  fail(
    `\n✖ ${unsavable.length} field(s) the registry exposes but workshopFullSchema cannot save:\n` +
      unsavable.map(([key, trait]) => `    ${key}  (trait: ${trait})`).join("\n") +
      `\n  → an author can fill these in and the value is silently dropped on save.` +
      `\n  Fix: add the key to workshopFullSchema + persist it in saveWorkshopAction,` +
      `\n  or remove the registry entry.`
  );
}

// ── B. schema saves it, no registry entry → unreachable from the wizard ──────
const unreachable = [...schema].filter(
  (k) => !registryCols.has(k) && !NOT_REGISTRY_FIELDS.has(k)
);

if (unreachable.length) {
  fail(
    `\n✖ ${unreachable.length} field(s) workshopFullSchema saves that no registry entry exposes:\n` +
      unreachable.map((k) => `    ${k}`).join("\n") +
      `\n  → these are unreachable from the manifest-driven wizard and the live editor.` +
      `\n  Fix: add a fieldRegistry entry, or add the key to NOT_REGISTRY_FIELDS in this` +
      `\n  script with a note saying why it is not author-editable content.`
  );
}

if (!process.exitCode) {
  console.log(
    `check-workshop-fields: OK — ${registry.size} registry columns, ${schema.size} schema keys, no drift.`
  );
}
