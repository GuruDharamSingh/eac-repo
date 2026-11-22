// ============================================================================
// @elkdonis/house-editor/steps: the one door into a page document (contract C2).
//
// A page is Puck JSON. Every change to it is a STEP, and this file is the whole
// of "who may change what":
//   set_prop   the words door: a declared content setting of one block, by its kind.
//   set_look   the look door: one declared part, kept under props.morph (a state
//              or a screen size too, once the look format holds them).
//   set_token  the look door, for a block's declared colours and lengths.
//   insert, move, duplicate, remove   the structure door, on Puck's own reducer.
//
// The canvas, the Fields lens, the settings sheet's hand-back and an assistant all
// build the same step and get the same answer in the same words. A step never
// drops, reorders or rewrites a block it was not aimed at. Pure and server-safe:
// no React of its own, no DOM, no database. Lifted from the sandbox checker in
// apps/development (ideas/manjushri/ops.ts) and widened.
// ============================================================================

import { Engine, ROOT_ZONE, configHas, graft, newIds } from "./engine";
import { hasStatesAndSizes, setLook, setTokenValue } from "./look";
import {
  LOOK_PROPS,
  type BlockContractLike,
  type PageDoc,
  type PageNode,
  type Step,
  type StepContext,
  type StepResult,
} from "./types";
import { allHaveIds, countId, findNode, replaceProps, unknownTypes } from "./walk";
import { setWord } from "./words";

export type { BlockContractLike, LookSize, LookState, PageDoc, PageNode, Step, StepContext, StepResult, StepSide } from "./types";
export { LOOK_PROPS, EDITOR_PROPS } from "./types";
export { hasStatesAndSizes };

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const OPS = ["set_prop", "set_look", "set_token", "insert", "move", "duplicate", "remove"];
const STRUCTURE = new Set(["insert", "move", "duplicate", "remove"]);

const refuse = (doc: PageDoc, code: string, say: string): StepResult => ({ ok: false, doc, side: null, code, say });
const contractFor = (ctx: StepContext, type: string): BlockContractLike | undefined => (own(ctx.contracts, type) ? ctx.contracts[type] : undefined);

/** One step on one page. The page is never modified: the answer carries a new one (or, when refused, the same one). */
export function applyStep(doc: PageDoc, raw: unknown, ctx: StepContext): StepResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return refuse(doc, "not_a_step", 'That is not a step. A step is an object with an "op".');
  const step = raw as Record<string, unknown>;
  if (typeof step.op !== "string" || !OPS.includes(step.op)) {
    return refuse(doc, "unknown_op", `"${String(step.op)}" is not a step this page knows. It knows ${OPS.slice(0, -1).join(", ")} and ${OPS[OPS.length - 1]}.`);
  }
  if (!doc || !Array.isArray(doc.content)) return refuse(doc, "bad_page", "That is not a page.");

  if (!ctx.allowUnknownTypes) {
    const odd = unknownTypes(doc, (t) => own(ctx.contracts, t));
    if (odd.length) {
      return refuse(doc, "unknown_type_on_page", `This page has a block this editor does not know ("${odd[0]}"), so it cannot say what a change would do to it.`);
    }
  }

  // A step is aimed at one block. When two blocks share its id it cannot be: nothing is written (replaceProps and the reducer
  // would otherwise reach both).
  if (step.op !== "insert" && typeof step.block === "string" && countId(doc, step.block) > 1) {
    return refuse(doc, "duplicate_block_id", "Two blocks on this page share an id, so the change cannot be aimed at one of them.");
  }

  if (STRUCTURE.has(step.op)) return structureStep(doc, step, ctx);
  return contentStep(doc, step, ctx);
}

// ---------------------------------------------------------------------------
// words and look: aimed at one block, anywhere on the page
// ---------------------------------------------------------------------------

function contentStep(doc: PageDoc, step: Record<string, unknown>, ctx: StepContext): StepResult {
  const node = findNode(doc, step.block);
  if (!node) return refuse(doc, "unknown_block", `There is no block "${String(step.block)}" on this page.`);
  const contract = contractFor(ctx, node.type);
  if (!contract) return refuse(doc, "unknown_type", `The block type "${node.type}" is not in this site's catalogue.`);
  const id = node.props.id as string;

  if (step.op === "set_prop") {
    const w = setWord(contract, node.props, String(step.prop), step.value);
    if (!w.ok) return refuse(doc, w.code, w.say);
    if (!w.changed) return { ok: true, doc, side: null, code: "same", say: w.say, touched: [] };
    return { ok: true, doc: replaceProps(doc, id, w.props), side: "words", code: "ok", say: w.say, touched: [id] };
  }

  if (step.op === "set_look") {
    const r = setLook(contract, node.props, String(step.part), step.look, { state: step.state as never, at: step.at as never });
    if (!r.ok) return refuse(doc, r.code, r.say);
    return { ok: true, doc: replaceProps(doc, id, r.props), side: "look", code: "ok", say: r.say, touched: [id] };
  }

  const r = setTokenValue(contract, node.props, String(step.name), step.value);
  if (!r.ok) return refuse(doc, r.code, r.say);
  return { ok: true, doc: replaceProps(doc, id, r.props), side: "look", code: "ok", say: r.say, touched: [id] };
}

// ---------------------------------------------------------------------------
// structure: Puck's reducer arranges, the original blocks are put back
// ---------------------------------------------------------------------------

function structureStep(doc: PageDoc, step: Record<string, unknown>, ctx: StepContext): StepResult {
  if (!ctx.config) return refuse(doc, "no_config", "This editor was not given the page's list of blocks, so it cannot add, move, copy or remove them.");
  if (doc.zones && Object.keys(doc.zones).length) return refuse(doc, "legacy_zones", "This page uses an older layout format that this editor does not rearrange.");
  if (!allHaveIds(doc)) return refuse(doc, "no_block_ids", "A block on this page has no id, so it cannot be told apart from the others.");

  const engine = new Engine(ctx.config as never, doc);
  const known = (t: string) => own(ctx.contracts, t) && configHas(ctx.config, t);
  const finish = (say: string, touched: string[]): StepResult => ({ ok: true, doc: graft(doc, engine.data), side: "structure", code: "ok", say, touched });

  if (step.op === "insert") {
    const type = String(step.type);
    if (!configHas(ctx.config, type)) return refuse(doc, "unknown_type", `The block type "${type}" is not in this site's catalogue.`);
    const contract = contractFor(ctx, type);
    const zone = step.zone === undefined ? ROOT_ZONE : String(step.zone);
    const size = engine.zoneLength(zone);
    if (size === null) return refuse(doc, "bad_zone", `There is no place called "${zone}" on this page.`);
    const index = step.index === undefined ? size : step.index;
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) > size) return refuse(doc, "bad_index", size === 0 ? "That place is empty, so a new block goes at 0." : `That place holds ${size} block${size === 1 ? "" : "s"}, so a new one goes at 0 to ${size}.`);
    const rules = engine.slotRules(zone);
    if ((rules.allow?.length && !rules.allow.includes(type)) || rules.disallow?.includes(type)) return refuse(doc, "slot_not_allowed", "That place does not take this kind of block.");
    // Settings given with the new block go through the words door, one by one: a refusal refuses the whole step.
    const given = step.props;
    if (given !== undefined && (!given || typeof given !== "object" || Array.isArray(given))) return refuse(doc, "bad_value", "The settings of a new block are an object.");
    const entries = Object.entries((given as Record<string, unknown>) ?? {});
    if (entries.length && !contract) return refuse(doc, "unknown_type", `The block type "${type}" is not in this site's catalogue.`);

    engine.insert(type, zone, index as number);
    let made = graft(doc, engine.data);
    const [id] = newIds(doc, made);
    if (!id) return refuse(doc, "engine", "The block could not be added.");
    for (const [name, value] of entries) {
      const node = findNode(made, id)!;
      const w = setWord(contract!, node.props, name, value);
      if (!w.ok) return refuse(doc, w.code, w.say);
      if (w.changed) made = replaceProps(made, id, w.props);
    }
    return { ok: true, doc: made, side: "structure", code: "ok", say: `Added ${contract?.label ?? type}.`, touched: [id] };
  }

  const block = String(step.block);
  const node = findNode(doc, block);
  if (!node) return refuse(doc, "unknown_block", `There is no block "${block}" on this page.`);
  if (!known(node.type)) return refuse(doc, "unknown_type", `The block type "${node.type}" is not in this site's catalogue.`);
  const here = engine.where(block);
  if (!here) return refuse(doc, "unknown_block", `There is no block "${block}" on this page.`);
  const label = contractFor(ctx, node.type)?.label ?? node.type;

  if (step.op === "remove") {
    engine.remove(here.zone, here.index);
    return finish(`Removed ${label}.`, [block]);
  }

  if (step.op === "duplicate") {
    engine.duplicate(here.zone, here.index);
    const made = graft(doc, engine.data);
    return { ok: true, doc: made, side: "structure", code: "ok", say: `Copied ${label}.`, touched: newIds(doc, made) };
  }

  // move
  const zone = step.zone === undefined ? here.zone : String(step.zone);
  const size = engine.zoneLength(zone);
  if (size === null) return refuse(doc, "bad_zone", `There is no place called "${zone}" on this page.`);
  const owner = engine.ownerOf(zone);
  if (owner && engine.isInside(owner, block)) return refuse(doc, "bad_zone", "A block cannot be moved inside itself.");
  // Within one place the index is where the block ends up, so the largest is size - 1; into another it is size.
  const room = zone === here.zone ? size - 1 : size;
  const index = step.index;
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) > room) return refuse(doc, "bad_index", `That place has room for 0 to ${room}.`);
  if (zone !== here.zone) {
    const rules = engine.slotRules(zone);
    if ((rules.allow?.length && !rules.allow.includes(node.type)) || rules.disallow?.includes(node.type)) return refuse(doc, "slot_not_allowed", "That place does not take this kind of block.");
  }
  engine.move(here, zone, index as number);
  return finish(`Moved ${label}.`, [block]);
}

// ---------------------------------------------------------------------------
// many steps
// ---------------------------------------------------------------------------

/** Steps in order. The first refusal stops the whole run: the answer carries the ORIGINAL page and every result so far. */
export function applySteps(doc: PageDoc, steps: unknown[], ctx: StepContext): { ok: boolean; doc: PageDoc; results: StepResult[] } {
  const results: StepResult[] = [];
  let current = doc;
  for (const step of steps) {
    const r = applyStep(current, step, ctx);
    results.push(r);
    if (!r.ok) return { ok: false, doc, results };
    current = r.doc;
  }
  return { ok: true, doc: current, results };
}

// ---------------------------------------------------------------------------
// the two sides of a block
// ---------------------------------------------------------------------------

/** FNV-1a, base 36: a short fingerprint to show that one side of the document did not move. */
export function fingerprint(value: unknown): string {
  const text = stable(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).padStart(7, "0");
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/**
 * The two sides of one block: what it says (every setting but the id and the look keys) and how it looks.
 * `look` is `morph` alone when that is the only look key present (null when none), else an object of the look keys present.
 */
export function sidesOf(node: PageNode): { words: Record<string, unknown>; look: unknown } {
  const words: Record<string, unknown> = {};
  const look: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.props)) {
    if (k === "id") continue;
    if (LOOK_PROPS.includes(k)) look[k] = v;
    else words[k] = v;
  }
  const keys = Object.keys(look);
  return { words, look: keys.length === 0 ? null : keys.length === 1 && keys[0] === "morph" ? look.morph : look };
}
