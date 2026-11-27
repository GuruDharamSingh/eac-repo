import { linkOk } from "../fields/registry";
import { EDITOR_PROPS, LOOK_PROPS, type BlockContractLike } from "./types";

// ============================================================================
// The words door: a declared content setting of one block, checked by its kind.
// Lifted from the sandbox checker (apps/development ideas/manjushri/ops.ts).
// Three ways in: setWord (a value), unsetWord (back to the declared default), bindWord (choose a record).
// ============================================================================

/** A hex colour the public page can put in a style: 3, 4, 6 or 8 digits (direct-edit's HEX also lets 5 and 7 through). */
const COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TEXT_KINDS = new Set(["string", "text", "url", "image"]);
const LONGEST = { string: 400, text: 4000, url: 2000, image: 2000 } as const;
/** Rich text is HTML: the longest a single setting may hold before the host's sanitiser sees it. */
const LONGEST_RICH = 20000;

/** Every field is always present: the apps compile non-strict, where a union on a boolean does not narrow. */
export interface WordResult {
  ok: boolean;
  /** The block's props with the change (the same object when nothing changed; empty when refused). */
  props: Record<string, unknown>;
  changed: boolean;
  say: string;
  code: string;
}

/** What the words door may be given by its host. */
export interface WordOptions {
  /** The host's sanitiser for a rich-text setting (`sanitizePageText`). Absent: a rich-text setting is refused, never stored unchecked. */
  sanitizeRichText?: (html: string) => string;
}

const no = (code: string, say: string): WordResult => ({ ok: false, props: {}, changed: false, say, code });

type Def = BlockContractLike["props"][number];

/** The setting a name refers to, or the reason it may not be written. Shared by all three doors. */
function declared(contract: BlockContractLike, name: string): { def: Def | null; no: WordResult | null } {
  if (LOOK_PROPS.includes(name)) return { def: null, no: no("look_not_content", "The look is not content. Use set_look: it checks every value before it is kept.") };
  if (EDITOR_PROPS.includes(name)) return { def: null, no: no("editor_key", `"${name}" belongs to the editor, not to the page.`) };
  const def = contract.props.find((p) => p.name === name);
  if (!def) return { def: null, no: no("unknown_prop", `${contract.label} has no setting called "${name}". It has: ${contract.props.map((p) => p.name).join(", ")}.`) };
  return { def, no: null };
}

/** The block's props with one setting changed, or why not. `props` is not modified. */
export function setWord(contract: BlockContractLike, props: Record<string, unknown>, name: string, rawValue: unknown, opts: WordOptions = {}): WordResult {
  const d = declared(contract, name);
  if (d.no) return d.no;
  const def = d.def!;
  if (def.binds) return no("bound_prop", `"${def.label}" is filled from a record (${def.binds}). Choose another record with a bind step (op "bind"), or "unset" to clear it; typing a value here would bypass the record.`);
  let value = rawValue;
  if (TEXT_KINDS.has(def.kind)) {
    if (typeof value !== "string") return no("bad_value", `"${def.label}" takes words.`);
    const most = LONGEST[def.kind as keyof typeof LONGEST];
    if (value.length > most) return no("too_long", `"${def.label}" is too long (${most} characters at most).`);
    if ((def as { format?: string }).format === "color" && value !== "" && !COLOUR.test(value)) {
      return no("not_a_colour", `"${def.label}" takes a colour like #1f4e79, or nothing to use the site's own.`);
    }
    if (def.kind === "url" && value !== "" && !linkOk(value)) return no("bad_value", `"${def.label}" takes a web address (https://...), a path starting with /, or mailto:.`);
    if (def.kind === "image" && value !== "" && !(/^https?:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//")))) {
      return no("bad_value", `"${def.label}" takes a picture address (https://...) or a path starting with /.`);
    }
  } else if (def.kind === "richtext") {
    if (!opts.sanitizeRichText) return no("unsupported_kind", `"${def.label}" is formatted text. This editor was not given the site's text cleaner, so it will not store formatted text.`);
    if (typeof value !== "string") return no("bad_value", `"${def.label}" takes words.`);
    if (value.length > LONGEST_RICH) return no("too_long", `"${def.label}" is too long (${LONGEST_RICH} characters at most).`);
    value = value === "" ? "" : opts.sanitizeRichText(value);
    if (typeof value !== "string") return no("bad_value", `"${def.label}" could not be cleaned.`);
  } else if (def.kind === "number") {
    if (typeof value !== "number" || !isFinite(value)) return no("bad_value", `"${def.label}" takes a number.`);
    value = Math.max(def.min ?? -Infinity, Math.min(def.max ?? Infinity, value));
  } else if (def.kind === "boolean") {
    if (typeof value !== "boolean") return no("bad_value", `"${def.label}" is on or off.`);
  } else if (def.kind === "select") {
    if (!def.options?.some((o) => o.value === value)) return no("bad_value", `"${def.label}" takes one of: ${(def.options ?? []).map((o) => o.value).join(", ")}.`);
  } else {
    return no("unsupported_kind", `"${def.label}" is a ${def.kind} setting. This editor changes plain settings only.`);
  }
  if (props[name] === value) return { ok: true, props, changed: false, say: `"${def.label}" already says that.`, code: "same" };
  return { ok: true, props: { ...props, [name]: value }, changed: true, say: `Changed "${def.label}".`, code: "ok" };
}

/** A copy that shares nothing mutable with the declaration (a default may be a list). */
const fresh = (v: unknown): unknown => (Array.isArray(v) ? [...v] : v);

/**
 * Put one setting back to its declared default. A setting with no declared default is removed, so the block's own
 * fallback shows. Refused: the look keys, the editor's keys, an unknown setting, and a region (slot) that holds blocks.
 */
export function unsetWord(contract: BlockContractLike, props: Record<string, unknown>, name: string): WordResult {
  const d = declared(contract, name);
  if (d.no) return d.no;
  const def = d.def!;
  if (def.kind === "slot") return no("slot_prop", `"${def.label}" holds other blocks. Take them out one by one; it has no default to go back to.`);
  const has = Object.prototype.hasOwnProperty.call(props, name);
  if (def.default === undefined) {
    if (!has) return { ok: true, props, changed: false, say: `"${def.label}" is already at its default.`, code: "same" };
    const { [name]: _gone, ...rest } = props;
    void _gone;
    return { ok: true, props: rest, changed: true, say: `"${def.label}" is back to its default.`, code: "ok" };
  }
  const to = fresh(def.default);
  if (has && JSON.stringify(props[name]) === JSON.stringify(to)) return { ok: true, props, changed: false, say: `"${def.label}" is already at its default.`, code: "same" };
  return { ok: true, props: { ...props, [name]: to }, changed: true, say: `"${def.label}" is back to its default.`, code: "ok" };
}

/** `<kind>:<id>`, for the setting that takes any kind of record (declared `binds: "record"`). */
const RECORD_REF = /^[a-z][a-z0-9-]{0,31}:[A-Za-z0-9_-]{1,64}$/;
/** What every other kind of reference looks like: an id, a path, or a colon-joined key. Never a space, a quote or an angle bracket. */
const PLAIN_REF = /^(?!\/\/)[A-Za-z0-9_\-:./#]{1,300}$/;

/**
 * Choose the record a setting is filled from. The setting must be declared with `binds`; the reference is checked
 * against what that declaration takes and is never fetched here (whether the record exists is the host's to say when
 * the page is drawn). An empty reference clears the choice.
 */
export function bindWord(contract: BlockContractLike, props: Record<string, unknown>, name: string, record: unknown): WordResult {
  const d = declared(contract, name);
  if (d.no) return d.no;
  const def = d.def!;
  if (!def.binds) return no("not_bound_prop", `"${def.label}" is not filled from a record. Use set_prop to change it.`);
  if (def.kind !== "string") return no("unsupported_kind", `"${def.label}" is a ${def.kind} setting and cannot hold a record.`);
  if (typeof record !== "string") return no("bad_record", `"${def.label}" takes a record reference, or an empty one to clear it.`);
  const ref = record.trim();
  if (ref !== "") {
    if (def.binds === "record") {
      if (!RECORD_REF.test(ref)) return no("bad_record", `"${def.label}" takes a record like kind:id (for example post:abc123).`);
    } else if (!PLAIN_REF.test(ref) || ref.includes("..")) {
      return no("bad_record", `"${ref.length > 40 ? ref.slice(0, 40) + "..." : ref}" is not a ${def.binds} reference this setting can hold.`);
    }
  }
  if (props[name] === ref || (ref === "" && props[name] === undefined)) {
    return { ok: true, props, changed: false, say: ref === "" ? `"${def.label}" has no record chosen.` : `"${def.label}" already comes from that record.`, code: "same" };
  }
  return { ok: true, props: { ...props, [name]: ref }, changed: true, say: ref === "" ? `Cleared the record "${def.label}" came from.` : `"${def.label}" now comes from the record you chose.`, code: "ok" };
}
