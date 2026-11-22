import { linkOk } from "../fields/registry";
import { EDITOR_PROPS, LOOK_PROPS, type BlockContractLike } from "./types";

// ============================================================================
// The words door: a declared content setting of one block, checked by its kind.
// Lifted from the sandbox checker (apps/development ideas/manjushri/ops.ts).
// ============================================================================

/** A hex colour the public page can put in a style: 3, 4, 6 or 8 digits (direct-edit's HEX also lets 5 and 7 through). */
const COLOUR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TEXT_KINDS = new Set(["string", "text", "url", "image"]);
const LONGEST = { string: 400, text: 4000, url: 2000, image: 2000 } as const;

/** Every field is always present: the apps compile non-strict, where a union on a boolean does not narrow. */
export interface WordResult {
  ok: boolean;
  /** The block's props with the change (the same object when nothing changed; empty when refused). */
  props: Record<string, unknown>;
  changed: boolean;
  say: string;
  code: string;
}

const no = (code: string, say: string): WordResult => ({ ok: false, props: {}, changed: false, say, code });

/** The block's props with one setting changed, or why not. `props` is not modified. */
export function setWord(contract: BlockContractLike, props: Record<string, unknown>, name: string, rawValue: unknown): WordResult {
  if (LOOK_PROPS.includes(name)) return no("look_not_content", "The look is not content. Use set_look: it checks every value before it is kept.");
  if (EDITOR_PROPS.includes(name)) return no("editor_key", `"${name}" belongs to the editor, not to the page.`);
  const def = contract.props.find((p) => p.name === name);
  if (!def) return no("unknown_prop", `${contract.label} has no setting called "${name}". It has: ${contract.props.map((p) => p.name).join(", ")}.`);
  if (def.binds) return no("bound_prop", `"${def.label}" is filled from a record (${def.binds}). Change the record, or choose another one.`);
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
