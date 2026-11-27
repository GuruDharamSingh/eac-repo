// ============================================================================
// Fields lens, block content (contract C4, 2026-11-20). Server-safe: no React, no DOM, no database.
//
// A block already declares which element draws which setting: a part with a `prop`
// (`packages/blocks/src/types.ts` PartDef). This file turns that declaration into
//   fieldMapOf        the map the page-side lens reads (which part, which setting, how it may be typed)
//   createBlockFields the two server doors for `block:<page>:<id>:<prop>`: load a block's words, save a change as
//                     ONE `set_prop` step through the app's gated page save (stale guard included)
//   recordMarks       the "this value comes from a record" hook for buildPuckConfig({ marks: { from } })
// ============================================================================

import { applySteps, type BlockContractLike, type PageDoc, type StepContext } from "../steps";
import { findNode } from "../steps/walk";
import type { HouseSave } from "../save";
import { fieldMapOf, settingsOf, splitBlockId, type BlockFieldEntry, type BlockMapSource, type BlockSetting } from "./blockmap";

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export { fieldMapOf, blockSpecs, settingSpec, settingsOf, splitBlockId } from "./blockmap";
export type { BlockFieldMap, BlockFieldEntry, BlockPartField, BlockSetting, BlockMapSource, SettingKind, FieldMapOptions } from "./blockmap";

// ---------------------------------------------------------------------------
// the two server doors
// ---------------------------------------------------------------------------

export interface BlockFieldsOptions {
  contracts: Readonly<Record<string, BlockContractLike & BlockMapSource>>;
  /** The published Puck config: the same one the step door uses for a structure step. */
  config: unknown;
  /** The page as stored, and the version to hand back (`loadPageWithVersion` for the site's org). Null: no such page. */
  loadPage(slug: string): Promise<{ data: unknown; updatedAt: string } | null>;
  /** The app's gated page save (`createSavePageAction`): gate, slug rules, resolver-key strip, stale guard, revalidate. */
  save: HouseSave;
  /** Pass the version to `save` so the store's own guard runs too. Default true. See the note in `saveBlock`. */
  storeGuard?: boolean;
  /**
   * The host's sanitiser for formatted text (`sanitizePageText` from @elkdonis/utils/sanitize). Given: a rich-text setting
   * is offered and saved through it. Absent: rich text is not offered at all.
   */
  sanitizeRichText?: (html: string) => string;
}

export interface BlockLoad {
  ok: boolean;
  error?: string;
  values?: Record<string, string>;
  version?: string;
}
export interface BlockSave {
  ok: boolean;
  error?: string;
  stale?: boolean;
  values?: Record<string, string>;
  version?: string;
  /** What the step said, in plain words. */
  say?: string;
}

/**
 * The one step a changed value sends. A setting filled from a record is a `bind`; a choice, switch or number left empty
 * goes back to its default (`unset`); everything else is a `set_prop` with the value in its own type.
 */
export function stepFor(block: string, s: BlockSetting, raw: unknown): { step: unknown } | { error: string } {
  if (typeof raw !== "string") return { error: `"${s.label}" takes text.` };
  if (s.binds) return { step: { op: "bind", block, prop: s.prop, record: raw } };
  if (s.kind === "boolean") {
    if (raw === "") return { step: { op: "unset", block, prop: s.prop } };
    if (raw !== "true" && raw !== "false") return { error: `"${s.label}" is on or off.` };
    return { step: { op: "set_prop", block, prop: s.prop, value: raw === "true" } };
  }
  if (s.kind === "number") {
    if (raw.trim() === "") return { step: { op: "unset", block, prop: s.prop } };
    const n = Number(raw);
    if (!Number.isFinite(n)) return { error: `"${s.label}" takes a number.` };
    return { step: { op: "set_prop", block, prop: s.prop, value: n } };
  }
  if (s.kind === "select" && raw === "") return { step: { op: "unset", block, prop: s.prop } };
  return { step: { op: "set_prop", block, prop: s.prop, value: raw } };
}

export function createBlockFields(o: BlockFieldsOptions) {
  const map = fieldMapOf(o.contracts, { richtext: !!o.sanitizeRichText });
  const ctx: StepContext = { contracts: o.contracts, config: o.config, allowUnknownTypes: true, sanitizeRichText: o.sanitizeRichText };

  async function locate(id: string): Promise<{ error: string } | { slug: string; block: string; type: string; entry: BlockFieldEntry; page: { data: unknown; updatedAt: string }; props: Record<string, unknown> }> {
    const at = splitBlockId(id);
    if (!at) return { error: "That is not an editable field." };
    const page = await o.loadPage(at.slug);
    if (!page) return { error: "That page could not be found." };
    const node = findNode(page.data as PageDoc, at.block);
    if (!node) return { error: "That block is not on the page any more. Reload to see the newest version." };
    if (!own(map, node.type)) return { error: "That is not an editable field." };
    return { ...at, type: node.type, entry: map[node.type]!, page, props: node.props };
  }

  /** Each offered setting as text. "" is "nothing set": the block's own default shows. A switch is "true" or "false". */
  const wordsOf = (entry: BlockFieldEntry, props: Record<string, unknown>) => {
    const values: Record<string, string> = {};
    for (const s of Object.values(settingsOf(entry))) {
      const v = props[s.prop];
      values[s.prop] = s.kind === "boolean" ? (typeof v === "boolean" ? String(v) : "") : s.kind === "number" ? (typeof v === "number" ? String(v) : "") : typeof v === "string" ? v : "";
    }
    return values;
  };

  /** The stored words of one block's typed settings, and the page's version. */
  async function load(id: string): Promise<BlockLoad> {
    const at = await locate(id);
    if ("error" in at) return { ok: false, error: at.error };
    return { ok: true, values: wordsOf(at.entry, at.props), version: at.page.updatedAt };
  }

  /** Save changed words of one block: one `set_prop` step each, all or none, through the app's gated page save. */
  async function saveBlock(id: string, values: Record<string, string>, version?: string): Promise<BlockSave> {
    const at = await locate(id);
    if ("error" in at) return { ok: false, error: at.error };
    const settings = settingsOf(at.entry);
    const steps: unknown[] = [];
    for (const [prop, value] of Object.entries(values ?? {})) {
      if (!own(settings, prop)) return { ok: false, error: `"${prop}" is not a setting that can be changed here.` };
      const s = stepFor(at.block, settings[prop]!, value);
      if ("error" in s) return { ok: false, error: s.error };
      steps.push(s.step);
    }
    if (!steps.length) return { ok: true, values: wordsOf(at.entry, at.props), version: at.page.updatedAt };
    // The page may have moved since the editor loaded it: say so before writing anything.
    if (version !== undefined && at.page.updatedAt !== version) return { ok: false, stale: true, error: "This page was changed somewhere else. Reload to see the newest version." };
    const run = applySteps(at.page.data as PageDoc, steps, ctx);
    if (!run.ok) return { ok: false, error: run.results[run.results.length - 1]!.say };
    const say = run.results.map((r) => r.say).join(" ");
    if (run.results.every((r) => r.code === "same")) return { ok: true, say, values: wordsOf(at.entry, at.props), version: at.page.updatedAt };
    // The version goes to the store, whose `UPDATE ... WHERE updated_at = <version>` is the guard that holds across two
    // writers (a canvas save that lands between our read and our write makes this one answer stale). page-builder's store
    // compared `${version}::timestamptz`, which postgres.js sends as a JS Date (milliseconds), so a version with microseconds
    // never matched; that was fixed on 2026-11-20 (`::text::timestamptz`). `storeGuard: false` is only for a host on a build
    // from before the fix; it keeps the comparison above and drops the store's.
    const res = await o.save(at.slug, run.doc, o.storeGuard === false ? undefined : at.page.updatedAt);
    if (!res.ok) return { ok: false, stale: res.stale, error: res.error ?? "That could not be saved.", ...(res.stale ? { error: "This page was changed somewhere else. Reload to see the newest version." } : {}) };
    const after = findNode(run.doc, at.block);
    return { ok: true, say, values: after ? wordsOf(at.entry, after.props) : undefined, version: res.updatedAt };
  }

  return { load, save: saveBlock, map };
}

export { recordMarks } from "./marks";
export type { RecordMarkSpec } from "./marks";
