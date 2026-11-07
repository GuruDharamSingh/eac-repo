"use client";

// ============================================================================
// The parts plugin's own state (2026-11-06): which part is selected, and the
// typing spell in progress. Module state, like the row focus in
// drag/item-focus.tsx: Puck's UiState is a closed type and is recorded in its
// undo history. One editor per page, so one selection.
//
// Writes go through Puck's `replace`, so a look lands in Puck's data and
// history. While a field is being typed in, each change is dispatched with
// `recordHistory: false`; when the spell ends (blur, Enter, Escape, another
// part, the panel closing) one history entry is added with
// `history.setHistories`, which is synchronous. Puck's own recording is
// debounced by 250 ms, so a recorded `replace` at blur followed by a click on
// Puck's undo button within that time would undo the step before the spell.
// ============================================================================

import { useSyncExternalStore } from "react";
import type { useGetPuck } from "@puckeditor/core";
import type { PartSelection } from "./types";

type GetPuck = ReturnType<typeof useGetPuck>;
type Props = Record<string, unknown> & { id: string };

let current: PartSelection = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export const partSelection = (): PartSelection => current;
export const usePartSelection = () => useSyncExternalStore(subscribe, () => current, () => null);
export const onPartSelection = subscribe;

export function selectPart(next: PartSelection): void {
  if (next?.id === current?.id && next?.part === current?.part) return;
  current = next;
  hovered = null;
  notify();
}

// ── The part a layer row points at (outlined on the canvas while hovered) ───
let hovered: string | null = null;
export const hoveredPart = () => hovered;
export const useHoveredPart = () => useSyncExternalStore(subscribe, () => hovered, () => null);
export function hoverPart(next: string | null): void {
  if (next === hovered) return;
  hovered = next;
  notify();
}

// ── The canvas document, shared by the picker (iframe) and the panel ────────
let canvasDoc: Document | null = null;
export const setCanvasDocument = (doc: Document | null) => {
  canvasDoc = doc;
};
export const canvasDocument = () => canvasDoc;

// ── Writing ─────────────────────────────────────────────────────────────────

interface Spell {
  id: string;
  /** The block's props before the spell, for Ctrl+Z inside a field. */
  before: Props;
  getPuck: GetPuck;
}
let spell: Spell | null = null;

export const spellPending = () => spell !== null;

function dispatchProps(getPuck: GetPuck, id: string, props: Props, recordHistory: boolean): boolean {
  const { dispatch, getItemById, getSelectorForId } = getPuck();
  const item = getItemById(id);
  const where = getSelectorForId(id);
  if (!item || !where) return false;
  dispatch({
    type: "replace",
    destinationIndex: where.index,
    destinationZone: where.zone,
    data: { ...item, props } as never,
    recordHistory,
  });
  return true;
}

/** The block's props, changed by `edit` (which may mutate the copy it is given). */
function nextProps(getPuck: GetPuck, id: string, edit: (props: Props) => void): Props | null {
  const item = getPuck().getItemById(id);
  if (!item) return null;
  const props = { ...(item.props as Props) };
  edit(props);
  return props;
}

/** One change inside a typing spell: drawn at once, recorded when the spell ends. */
export function writeLive(getPuck: GetPuck, id: string, edit: (props: Props) => void): void {
  if (spell && spell.id !== id) endSpell();
  const item = getPuck().getItemById(id);
  if (!item) return;
  if (!spell) spell = { id, before: item.props as Props, getPuck };
  const props = nextProps(getPuck, id, edit);
  if (props) dispatchProps(getPuck, id, props, false);
}

/** One whole step (a select, a chip, a reset): ends any spell, then records this change. */
export function writeStep(getPuck: GetPuck, id: string, edit: (props: Props) => void): void {
  endSpell();
  const props = nextProps(getPuck, id, edit);
  if (props && dispatchProps(getPuck, id, props, false)) record(getPuck);
}

/** Close the spell as one history entry. Safe to call when none is open. */
export function endSpell(): void {
  if (!spell) return;
  const { getPuck } = spell;
  spell = null;
  record(getPuck);
}

/** Ctrl+Z inside a field while typing: the spell is put back, and nothing is recorded. */
export function revertSpell(): boolean {
  if (!spell) return false;
  const { getPuck, id, before } = spell;
  spell = null;
  dispatchProps(getPuck, id, before, false);
  return true;
}

/** One history entry for the data Puck holds now (the popup's hand-back). */
export const recordStep = (getPuck: GetPuck): void => record(getPuck);

function record(getPuck: GetPuck): void {
  const { history, appState } = getPuck();
  const at = history.histories[history.index];
  // Nothing changed since the entry Puck holds: no empty step.
  if (at && (at.state as { data?: unknown }).data === appState.data) return;
  history.setHistories([
    ...history.histories.slice(0, history.index + 1),
    { id: `parts-${Date.now().toString(36)}`, state: { data: appState.data, ui: appState.ui } },
  ] as never);
}
