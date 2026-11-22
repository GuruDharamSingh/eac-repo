import { cleanStyle, declsToString, HEX, type PartStyle } from "@elkdonis/direct-edit/block";
import * as Morph from "@elkdonis/direct-edit/puck/morph";
import type { BlockContractLike, LookSize, LookState } from "./types";

// ============================================================================
// The look door: one declared part, or one declared colour or size, kept under
// props.morph. Lifted from the sandbox checker; the helpers are direct-edit's.
// A state (hover, focus, active) or a screen size (sm, md) goes through lane
// LOOK's partLookAt / setPartLookAt when they exist, and is refused as
// `not_yet` until then. They are probed on the module, never imported by name,
// so this file compiles and runs before and after they land.
// ============================================================================

type Props = Record<string, unknown>;
export interface Where {
  state?: LookState;
  at?: LookSize;
}
const M = Morph as unknown as {
  partLookOf(props: Props, part: string): PartStyle;
  setPartLook(props: Props, part: string, look: PartStyle): void;
  setToken(props: Props, name: string, value: string | undefined): void;
  partSafeDecls(css: string | undefined): Array<[string, string]>;
  partLookAt?: (props: Props, part: string, where: Where) => PartStyle;
  setPartLookAt?: (props: Props, part: string, where: Where, look: PartStyle) => void;
};

/** True when the look format in this build holds states and sizes. */
export const hasStatesAndSizes = () => typeof M.partLookAt === "function" && typeof M.setPartLookAt === "function";

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const LENGTH = /^\d{1,4}(\.\d{1,2})?(px|rem|em|%)$/;
const STATES = ["hover", "focus", "active"];
const SIZES = ["sm", "md"];

/** Every field is always present: the apps compile non-strict, where a union on a boolean does not narrow. */
export interface LookResult {
  ok: boolean;
  props: Props;
  say: string;
  code: string;
}
const no = (code: string, say: string): LookResult => ({ ok: false, props: {}, say, code });

const whereWords = (w: Where) =>
  w.state ? ` when ${w.state === "hover" ? "hovered" : w.state === "focus" ? "focused" : "pressed"}` : w.at ? (w.at === "sm" ? " on phones" : " on tablets and below") : "";

/** `source` is not modified: the answer carries a copy. */
export function setLook(contract: BlockContractLike, source: Props, part: string, askedLook: unknown, where: Where): LookResult {
  const props = structuredClone(source);
  const parts = contract.parts ?? {};
  if (part !== "root" && !own(parts, part)) {
    const names = ["root", ...Object.keys(parts).filter((p) => p !== "root")];
    return no("unknown_part", `${contract.label} has no part called "${part}". Its parts: ${names.join(", ")}.`);
  }
  const label = own(parts, part) ? parts[part]!.label : "The block";
  const placed = where.state !== undefined || where.at !== undefined;
  if (placed) {
    if (where.state !== undefined && where.at !== undefined) return no("bad_where", "Pick a state (hover, focus, active) or a screen size (sm, md), not both.");
    if (where.state !== undefined && !STATES.includes(where.state)) return no("bad_where", `A state is one of: ${STATES.join(", ")}.`);
    if (where.at !== undefined && !SIZES.includes(where.at)) return no("bad_where", `A screen size is one of: ${SIZES.join(", ")}.`);
    if (!hasStatesAndSizes()) return no("not_yet", "Looks for hover, focus and phone sizes are not stored by this build yet.");
  }
  const read = (): PartStyle => (placed ? M.partLookAt!(props, part, where) : M.partLookOf(props, part));
  const write = (look: PartStyle) => (placed ? M.setPartLookAt!(props, part, where, look) : M.setPartLook(props, part, look));
  const there = whereWords(where);

  if (askedLook === null) {
    write({});
    return { ok: true, code: "ok", props, say: `Cleared the look of "${label}"${there}.` };
  }
  if (!askedLook || typeof askedLook !== "object" || Array.isArray(askedLook)) return no("bad_look", "A look is a set of style keys, or null to clear it.");
  const asked = askedLook as Record<string, unknown>;
  // The change is cleaned on its own, then laid over what is stored: a value that is refused
  // must not take the stored one with it.
  const current = { ...read() } as Record<string, unknown>;
  const wanted: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [k, v] of Object.entries(asked)) {
    if (v === null) removed.push(k);
    else wanted[k] = v;
  }
  const kept = { ...(cleanStyle(wanted) ?? {}) } as Record<string, unknown>;
  // A part stays inside its block (morph.ts cleanLook).
  if (kept.pos === "absolute" || kept.pos === "sticky") {
    delete kept.pos;
    delete kept.x;
    delete kept.y;
  }
  const notes: string[] = [];
  delete kept.css;
  if (typeof wanted.css === "string") {
    const names = wanted.css.split(";").map((d) => d.split(":")[0]!.trim().toLowerCase()).filter(Boolean);
    const decls = M.partSafeDecls(wanted.css);
    if (decls.length) kept.css = declsToString(decls as never);
    const keptNames = new Set(decls.map(([k]) => k));
    const lost = names.filter((w) => !keptNames.has(w));
    if (lost.length) notes.push(`Left out of the CSS: ${[...new Set(lost)].join(", ")}.`);
  }
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(wanted)) {
    if (k === "css") continue;
    if (kept[k] === undefined) dropped.push(k);
    else if (typeof v === "number" && kept[k] !== v) notes.push(`${k} was held to ${String(kept[k])}.`);
  }
  if (dropped.length) notes.push(`Not a look value, so not kept: ${dropped.join(", ")}.`);
  const next: Record<string, unknown> = { ...current, ...kept };
  for (const k of removed) delete next[k];
  if (JSON.stringify(next) === JSON.stringify(current)) {
    return no(notes.length ? "not_a_look_value" : "no_change", notes.length ? `Nothing was kept. ${notes.join(" ")}` : "That is already its look.");
  }
  write(next as PartStyle);
  return { ok: true, code: "ok", props, say: [`Changed the look of "${label}"${there}.`, ...notes].join(" ") };
}

export function setTokenValue(contract: BlockContractLike, source: Props, name: string, value: unknown): LookResult {
  const def = contract.tokens.find((t) => t.name === name);
  if (!def) return no("unknown_token", `${contract.label} has no colour or size called "${name}".`);
  const props = structuredClone(source);
  if (value === null) {
    M.setToken(props, name, undefined);
    return { ok: true, code: "ok", props, say: `"${def.label}" is back to the site's own.` };
  }
  if (typeof value !== "string") return no("bad_token_value", `"${def.label}" takes a value in words, or null.`);
  if (def.type === "color" && !HEX.test(value)) return no("bad_token_value", `"${def.label}" takes a colour like #1f4e79.`);
  if (def.type === "length" && !LENGTH.test(value)) return no("bad_token_value", `"${def.label}" takes a size like 12px.`);
  if (def.type === "font") return no("font_token", "Fonts are chosen from the font library, which this editor does not load.");
  M.setToken(props, name, value);
  return { ok: true, code: "ok", props, say: `Set "${def.label}" for this block.` };
}
