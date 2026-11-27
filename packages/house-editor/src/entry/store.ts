"use client";

// ============================================================================
// The Edit button's small shared state (2026-11-23, lane LIVE). Three things a site's own pieces need to agree on, kept
// in one module so the button (mounted once, in the layout), the page that knows its own editor, and the Fields lens
// (mounted beside the footer) need no props between them:
//   live      Live edit is on (the lens draws its cursor, strip and bar while this is true)
//   editing   the in-place page editor is open (the button steps out of the way; the host reloads to come back)
//   editPage  how this page opens its in-place editor, registered by the page that has one (a landing page)
// ============================================================================

import { useSyncExternalStore } from "react";

export interface EditEntryState {
  live: boolean;
  editing: boolean;
  editPage: (() => void | Promise<void>) | null;
}

let state: EditEntryState = { live: false, editing: false, editPage: null };
const subs = new Set<() => void>();
const set = (next: Partial<EditEntryState>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export const useEditEntry = (): EditEntryState => useSyncExternalStore(subscribe, () => state, () => state);
export const getEditEntry = (): EditEntryState => state;
export const setLive = (live: boolean) => set({ live });
export const setEditing = (editing: boolean) => set({ editing, ...(editing ? { live: false } : {}) });

/**
 * A page that edits in place says how (its `openLandingEditor`). Returns the way to take it back, for the page's effect
 * cleanup. A page that registers nothing sends "Edit page" to the site's page editor instead.
 */
export function registerEditPage(open: () => void | Promise<void>): () => void {
  set({ editPage: open });
  return () => { if (state.editPage === open) set({ editPage: null }); };
}
