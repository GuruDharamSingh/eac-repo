"use client";

import * as React from "react";
import { useSurface } from "@elkdonis/cms-ui/surface";
import type { ChannelModel, Piece, Suggestion } from "@/lib/channel/model";
import type { QuickSpec } from "./quick-spec";

// The Channel data context and the hook every Channel component (page or
// surface) reads it through. Kept apart from ChannelFrame so the surfaces it
// registers do not import the frame back.

export const CHANNEL_BASE = "/channel";

export interface ChannelData {
  model: ChannelModel;
  scopeOrg: string | null;
  /** A Channel path with the scope (?org=) kept. */
  href: (path: string, params?: Record<string, string | null | undefined>) => string;
  piece: (key: string) => Piece | undefined;
  identity: (id: string | null | undefined) => ChannelModel["identities"][number] | undefined;
}

export const DataCtx = React.createContext<ChannelData | null>(null);

/** The model plus the two ways Channel opens a pop-up. Use inside ChannelFrame (page or surface). */
export function useChannel() {
  const data = React.useContext(DataCtx);
  if (!data) throw new Error("useChannel outside ChannelFrame");
  const surface = useSurface();

  const openPiece = React.useCallback(
    (key: string, origin?: HTMLElement | null, tab: "overview" | "plan" = "overview") => {
      const p = data.piece(key);
      if (!p) return;
      const d = { type: "custom" as const, key: "channel:piece", title: p.title, size: "full" as const, kind: "product" as const, props: { pieceKey: key, tab } };
      const top = surface.stack[surface.stack.length - 1]?.descriptor;
      const fromLibrary = top?.type === "custom" && top.key === "channel:library";
      if (fromLibrary && surface.stack.length >= 2) {
        // Library stacked over a piece: picking replaces that piece (3b), so
        // drop the library first. Both updates queue in order on one render.
        surface.pop();
        surface.replace(d);
      } else if (surface.stack.length > 0) surface.replace(d);
      else surface.open(d, origin ?? null);
    },
    [data, surface]
  );

  /** The library; with `onPick` it is a chooser (New post's "Change"), and picking closes it. */
  const openLibrary = React.useCallback(
    (fromKey: string | null, onPick?: (key: string) => void) => {
      const d = { type: "custom" as const, key: "channel:library", title: onPick ? "Choose a piece" : "Content library", size: "full" as const, kind: "gallery" as const, props: { fromKey, onPick } };
      if (surface.stack.length > 0) surface.push(d);
      else surface.open(d);
    },
    [surface]
  );

  const openQuick = React.useCallback(
    (spec: QuickSpec, origin?: HTMLElement | null) => {
      const d = { type: "custom" as const, key: "channel:quick", title: spec.title, size: "standard" as const, kind: "channel-sheet" as never, props: { spec } };
      if (surface.stack.length > 0) surface.push(d);
      else surface.open(d, origin ?? null);
    },
    [surface]
  );

  /** The adjust sheet (planner): when, where, a star, the idea, skip or never. */
  const openAdjust = React.useCallback(
    (suggestion: Suggestion, origin?: HTMLElement | null) => {
      const d = { type: "custom" as const, key: "channel:adjust", title: suggestion.text, size: "standard" as const, kind: "channel-sheet" as never, props: { suggestion } };
      if (surface.stack.length > 0) surface.push(d);
      else surface.open(d, origin ?? null);
    },
    [surface]
  );

  /** A suggestion by its id, from the loaded pieces. */
  const suggestionById = React.useCallback(
    (id: string): Suggestion | undefined => {
      for (const p of data.model.pieces) {
        const s = p.suggestions.find((x) => x.id === id);
        if (s) return s;
      }
      return undefined;
    },
    [data.model.pieces]
  );

  return { ...data, surface, openPiece, openLibrary, openQuick, openAdjust, suggestionById };
}

export function suggestionInput(s: Suggestion, scopeOrg: string | null) {
  return { pieceKey: s.pieceKey, outlet: s.outlet, identityId: s.identityId, text: s.text, at: s.at, routineId: s.routineId, scopeOrg };
}

