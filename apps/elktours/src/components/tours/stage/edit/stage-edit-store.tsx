"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { StopDraft } from "@/components/manage/tour-builder/draft";
import type { Narratives } from "@/components/office/create-tour/types";

// Edit mode of the desktop tour stage (take C, 2026-11-26). TourStage owns one store; StageEditHost (mounted only while
// editing, so visitors never load the editor) publishes its API here and the stage's surfaces read it.

export interface StageEditApi {
  ready: boolean;
  saving: boolean;
  savedAt: Date | null;
  tourId: string;
  slug: string;
  stops: StopDraft[];
  narratives: Narratives;
  canUndo: boolean;
  /** Change the stops and/or lines and save in one call; remembered for Undo. */
  commit: (next: { stops?: StopDraft[]; narratives?: Narratives }) => Promise<boolean>;
  undo: () => Promise<void>;
  /** Re-render the page's server data (after a picture change). */
  refresh: () => void;
  openTourSettings: () => void;
}

interface Snap {
  editing: boolean;
  api: StageEditApi | null;
}

export interface StageEditStore {
  get: () => Snap;
  subscribe: (fn: () => void) => () => void;
  set: (p: Partial<Snap>) => void;
}

export function createStageEditStore(): StageEditStore {
  let snap: Snap = { editing: false, api: null };
  const subs = new Set<() => void>();
  return {
    get: () => snap,
    subscribe: (fn) => {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
    set: (p) => {
      snap = { ...snap, ...p };
      subs.forEach((f) => f());
    },
  };
}

const Ctx = createContext<StageEditStore | null>(null);
export const StageEditProvider = Ctx.Provider;

const NONE: Snap = { editing: false, api: null };
const noopSub = () => () => {};

/** The edit state, or null where editing is not offered (visitors, the popup, the phone). */
export function useStageEdit(): (Snap & { store: StageEditStore }) | null {
  const store = useContext(Ctx);
  const snap = useSyncExternalStore(store ? store.subscribe : noopSub, store ? store.get : () => NONE, () => NONE);
  return store ? { ...snap, store } : null;
}

/** The stop's draft in the editor (matched by its database id). */
export function draftFor(api: StageEditApi | null, stopId: string): { draft: StopDraft; index: number } | null {
  if (!api) return null;
  const index = api.stops.findIndex((s) => s.id === stopId);
  return index >= 0 ? { draft: api.stops[index]!, index } : null;
}
