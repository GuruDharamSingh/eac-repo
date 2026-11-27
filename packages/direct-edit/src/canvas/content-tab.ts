// ============================================================================
// The Content tab (2026-11-21, PLAN §9 step A): a sealed block's declared settings, first in the side panel, drawn from
// its contract with the control each kind needs. What the panel cannot draw yet (rich text, rows, lists, a record this
// host cannot choose) is named with an "Edit in settings…" button that opens the host's settings sheet, and "More
// settings…" sits at the bottom. Plain functions: tree-editor stores what the controls change, through the host's door.
// Opt-in (`contentTab`); absent, the panel is as it was.
// ============================================================================

import { propNameOf, type BlockContract, type ContractProp } from "../block/contract";
import type { ResolvedSlot, SectionId } from "../model/schema";
import { blockSlots, blockValues } from "./block-fields";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export interface ContentHost {
  /** The host can open its settings sheet on this block (`editSettings`). */
  settings: boolean;
  /** The host chooses pictures (`choosePicture`). */
  picker: boolean;
  /** The body of a record-bound prop's control (what it is now, and its Choose button), or null when this host cannot choose such a record. */
  bound?(p: ContractProp): string | null;
  /** Props that are no field here at all (an Opens nobody can write by hand). */
  skip?(p: ContractProp): boolean;
}

export interface ContentView {
  slots: ResolvedSlot[];
  values: Record<string, unknown>;
  overridden: Record<string, boolean>;
  /** Host HTML before the sections. */
  top?: string;
  /** Host HTML after them: which settings fall back, and "More settings…". */
  bottom: string;
  /** Labels of the settings this panel cannot draw. */
  fallbacks: string[];
}

const SETTINGS_BTN = (label: string, f: string) => `<button type="button" class="de-picture-btn" data-tree-act="settings" data-f="${f}">${label}</button>`;
const plain = (v: unknown) => (typeof v === "string" ? v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "");

/** The Content tab for one block: its settings in the order it declares them, grouped as it groups them. */
export function contentOf(def: BlockContract, props: Record<string, unknown>, host: ContentHost): ContentView {
  const byName = new Map<string, ResolvedSlot>();
  for (const s of blockSlots(def, props)) { const n = propNameOf(s.key); if (n) byName.set(n, s); }
  const { values, overridden } = blockValues(def, props);
  const slots: ResolvedSlot[] = [];
  const fallbacks: string[] = [];
  const hostSlot = (s: ResolvedSlot, html: string): ResolvedSlot => ({ ...s, control: "host", allowed: {}, html });
  const fallback = (s: ResolvedSlot, p: ContractProp, words: string) => {
    fallbacks.push(p.label);
    slots.push(hostSlot(s, `<span class="de-readout" data-f="${esc(s.id)}">${esc(words)}</span>${host.settings ? ` ${SETTINGS_BTN("Edit in settings…", `edit-${esc(p.name)}`)}` : ""}`));
  };
  for (const p of def.props) {
    const s = byName.get(p.name);
    if (!s || host.skip?.(p)) continue;
    if (p.binds) {
      const body = host.bound?.(p);
      if (body != null) slots.push(hostSlot(s, body));
      else fallback(s, p, typeof props[p.name] === "string" && props[p.name] ? "Filled from a record" : "Not chosen yet");
    } else if (p.kind === "image" && host.picker) {
      const v = typeof props[p.name] === "string" ? (props[p.name] as string) : "";
      slots.push(hostSlot(s, `<div class="de-picture">${v ? `<span class="de-picture-thumb" style="background-image:url(&quot;${esc(v)}&quot;)"></span>` : ""}<button type="button" class="de-picture-btn" data-tree-act="propic:${esc(p.name)}" data-f="propic-${esc(p.name)}">${v ? "Change" : "Choose a picture"}</button>${v ? `<button type="button" class="de-picture-btn" data-tree-act="propclear:${esc(p.name)}" data-f="propclear-${esc(p.name)}">Remove</button>` : ""}</div>`));
    } else if (p.kind === "richtext") {
      const t = plain(props[p.name]);
      fallback(s, p, t ? (t.length > 40 ? `${t.slice(0, 40)}…` : t) : "Empty");
    } else if (p.kind === "rows" || p.kind === "list") {
      fallback(s, p, s.readout ?? "");
    } else slots.push(s);
  }
  const bottom =
    (fallbacks.length ? `<p class="de-note" data-f="content-fallback">${esc(fallbacks.join(", "))} ${fallbacks.length === 1 ? "is" : "are"} edited in the settings sheet for now.</p>` : "") +
    (host.settings ? `<p>${SETTINGS_BTN("More settings…", "more-settings")}</p>` : "");
  return { slots, values, overridden, bottom, fallbacks };
}

// ---------------------------------------------------------------------------
// One home: a look the block also declares as a setting is offered in Content only.
// ---------------------------------------------------------------------------

/** A declared setting (by name) and the Look controls (by panel key) that would write the same thing a second time. */
const LOOK_OF_PROP: Record<string, readonly string[]> = {
  height: ["hmode"], minHeight: ["hmode"],
  width: ["wmode"], maxWidth: ["wmode"],
  columns: ["gcols"], cols: ["gcols"],
  gap: ["gap"],
  padding: ["padding"],
  align: ["align"],
  layout: ["layout"], direction: ["dir"],
  color: ["color"], background: ["fill"],
  opacity: ["opacity"], radius: ["radius"],
};

/**
 * The Look slots without the ones the block declares as a setting, and a note in each section that lost one. A look that
 * already holds a value stays (so it can still be cleared), and the note then says both are set.
 */
export function dedupeLook(def: BlockContract, slots: ResolvedSlot[], stored: Record<string, boolean>): { slots: ResolvedSlot[]; notes: Partial<Record<SectionId, string>>; hidden: string[] } {
  const home = new Map<string, string>();
  for (const p of def.props) {
    if (!p.group || p.kind === "slot") continue;
    for (const k of LOOK_OF_PROP[p.name] ?? []) if (!home.has(k)) home.set(k, p.label);
  }
  const notes: Partial<Record<SectionId, string>> = {};
  const hidden: string[] = [];
  const kept = slots.filter((s) => {
    const label = home.get(s.key);
    if (!label) return true;
    // A block that declares `resize` has the one home for its height: a height stored on its look is kept but not drawn, so the row goes.
    const ignored = !!def.resize && s.key === "hmode";
    const set = !!stored[s.key] && !ignored;
    if (ignored && stored[s.key]) notes[s.section] = (notes[s.section] ?? "") + `<p class="de-note" data-f="home-${esc(s.id)}-kept">A height is also stored on this block's look. It is kept, and not drawn: the block's own “${esc(label)}” is the one that counts.</p>`;
    notes[s.section] = (notes[s.section] ?? "") + `<p class="de-note" data-f="home-${esc(s.id)}">${esc(s.label)} is a setting of this block: ${set ? `it is also set here, which wins over it. Reset it here and change` : "change"} “${esc(label)}” in the Content tab.</p>`;
    if (!set) hidden.push(s.key);
    return set;
  });
  return { slots: kept, notes, hidden };
}

export const mergeExtra = (a: Partial<Record<SectionId, string>> | undefined, b: Partial<Record<SectionId, string>> | undefined): Partial<Record<SectionId, string>> | undefined => {
  if (!a || !b) return a ?? b;
  const out: Partial<Record<SectionId, string>> = { ...a };
  for (const k of Object.keys(b) as SectionId[]) out[k] = (out[k] ?? "") + b[k];
  return out;
};
