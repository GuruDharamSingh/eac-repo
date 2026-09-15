"use client";

import { createContext, useContext } from "react";
import type { SurfaceConnectors, SurfaceDescriptor, SurfaceSize } from "./types";

// ============================================================================
// The two contexts a surface reads. Kept apart from the provider so surfaces
// can import these without importing the provider that imports them.
// ============================================================================

export interface LayerMeta {
  title?: string | null;
  kind?: string;
  size?: SurfaceSize;
}

export interface SurfaceLayer {
  id: number;
  descriptor: SurfaceDescriptor;
  meta: LayerMeta;
}

/**
 * Where a surface is opening FROM — the face that was clicked.
 *
 * The system's claim is that a face and a surface are the same object at two
 * sizes; handing over the face's element is what lets the surface actually
 * grow out of it (the morph in surface.css). Omit it and the surface simply
 * appears, as it always did.
 */
export type SurfaceOrigin = HTMLElement | DOMRect | null;

export interface SurfaceApi {
  stack: SurfaceLayer[];
  /** Start fresh: whatever is open is replaced by this one layer. */
  open: (descriptor: SurfaceDescriptor, origin?: SurfaceOrigin) => void;
  /** Add a layer; the masthead grows a "‹ back" to the one beneath. */
  push: (descriptor: SurfaceDescriptor) => void;
  /** Swap the top layer — after publishing, show what was published. */
  replace: (descriptor: SurfaceDescriptor) => void;
  /** Drop the top layer; closes when it was the only one. */
  pop: () => void;
  close: () => void;
  connectors: SurfaceConnectors;
}

export const SurfaceCtx = createContext<SurfaceApi | null>(null);

export function useSurface(): SurfaceApi {
  const ctx = useContext(SurfaceCtx);
  if (!ctx) {
    throw new Error("useSurface must be used inside <SurfaceProvider>");
  }
  return ctx;
}

/** For components that work with or without a provider — the face. */
export function useSurfaceOptional(): SurfaceApi | null {
  return useContext(SurfaceCtx);
}

export interface LayerApi {
  id: number;
  /** 1-based position in the stack. */
  depth: number;
  isTop: boolean;
  meta: LayerMeta;
  /** A surface tells the shell its title, kind and width once it knows them. */
  setMeta: (patch: LayerMeta) => void;
}

export const LayerCtx = createContext<LayerApi | null>(null);

export function useLayer(): LayerApi {
  const ctx = useContext(LayerCtx);
  if (!ctx) throw new Error("useLayer must be used inside a surface layer");
  return ctx;
}
