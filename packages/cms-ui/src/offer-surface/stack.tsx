"use client";

import * as React from "react";
import { useLayer, useSurface, type SurfaceLayer } from "../surface/context";
import { DONE_RETURNS_TO_ROOT_OFFER, offerProps, type OfferLayerId } from "./descriptor";

// ============================================================================
// Stack navigation for the offer layers. The rule is written at the top of
// descriptor.ts ("THE STACK RULE"). This file is its machinery:
//
//   - STEP_LAYERS / flowOrigin: which layers are steps of a flow, and where the
//     flow started (the nearest layer below that is not a step).
//   - popTo(n): pop until n layers remain (0 closes). The provider has only
//     `pop` (one layer, reading the stack of the last render), so several pops
//     in one handler would all do the same single pop. StackNavDriver (inside
//     the provider, mounted by OfferSurfaceRoot) pops once per commit in a
//     layout effect, so nothing paints between them.
//   - useFinish / useBackToTalk: the two returns the layers use.
// ============================================================================

/** The transaction layers: steps of a flow that begins on an offer or a profile. `done` ends one. */
export const STEP_LAYERS: ReadonlySet<OfferLayerId> = new Set<OfferLayerId>(["evt-rsvp", "art-order", "pay", "ser-sub", "follow", "join", "done"]);

function layerIdOf(l: SurfaceLayer): OfferLayerId | null {
  if (l.descriptor.type !== "custom") return null;
  const p = offerProps(l.descriptor as Parameters<typeof offerProps>[0]);
  return p ? p.layer : null;
}

/**
 * Depth (1-based) of the layer the flow at `depth` started from; 0 when there is none (the step is the
 * first layer: a shared link, the return from Stripe, a hover-card Follow).
 */
export function flowOrigin(stack: readonly SurfaceLayer[], depth: number): number {
  let i = depth - 1;
  while (i >= 0) {
    const id = layerIdOf(stack[i]!);
    if (!id || !STEP_LAYERS.has(id)) break;
    i--;
  }
  return i + 1;
}

/** Depth of the nearest layer below `depth` that is a `talk`, or 0. */
export function nearestBelow(stack: readonly SurfaceLayer[], depth: number, layer: OfferLayerId): number {
  for (let i = depth - 2; i >= 0; i--) if (layerIdOf(stack[i]!) === layer) return i + 1;
  return 0;
}

interface StackNav {
  /** Pop until `n` layers remain; 0 (or less) closes the whole stack. */
  popTo: (n: number) => void;
}

/**
 * The driver cannot sit above the layers (it needs the provider's stack) and the layers are rendered by the
 * provider itself, outside any component placed among its children. So the root holds a ref ABOVE the
 * provider (StackNavHolder); the driver, mounted inside it (StackNavDriver), fills the ref; the layers read it.
 */
const HolderCtx = React.createContext<React.MutableRefObject<StackNav | null> | null>(null);

export function StackNavHolder({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<StackNav | null>(null);
  return <HolderCtx.Provider value={ref}>{children}</HolderCtx.Provider>;
}

/** Mount once inside the SurfaceProvider (OfferSurfaceRoot does). Renders nothing. */
export function StackNavDriver() {
  const { stack, pop, close } = useSurface();
  const holder = React.useContext(HolderCtx);
  const target = React.useRef<number | null>(null);
  const stackRef = React.useRef(stack);
  stackRef.current = stack;
  const [kick, setKick] = React.useState(0);

  React.useLayoutEffect(() => {
    const t = target.current;
    if (t == null) return;
    if (stack.length <= t) {
      target.current = null;
      return;
    }
    pop();
  }, [stack, kick, pop]);

  const popTo = React.useCallback(
    (n: number) => {
      if (n <= 0) {
        target.current = null;
        close();
        return;
      }
      if (stackRef.current.length <= n) return;
      target.current = n;
      setKick((k) => k + 1);
    },
    [close]
  );

  React.useLayoutEffect(() => {
    if (!holder) return;
    holder.current = { popTo };
    return () => {
      holder.current = null;
    };
  }, [holder, popTo]);
  return null;
}

/** `popTo` from the root's driver; without one (a host that mounts the layers itself) it pops one layer or closes. */
export function useStackNav(): StackNav {
  const holder = React.useContext(HolderCtx);
  const { pop, close } = useSurface();
  return React.useMemo(
    () => ({
      popTo: (n: number) => {
        if (holder?.current) holder.current.popTo(n);
        else if (n <= 0) close();
        else pop();
      },
    }),
    [holder, pop, close]
  );
}

/**
 * What `done`'s primary does: back to the layer the flow started from. Returns the depth it will go to
 * (0 = close) and the handler. `from` is the depth recorded on the push (OfferCtx.from) when it is valid.
 */
export function useFinish(from?: number): { to: number; finish: () => void } {
  const { stack } = useSurface();
  const { depth } = useLayer();
  const { popTo } = useStackNav();
  let to = from != null && from >= 0 && from < depth ? from : flowOrigin(stack, depth);
  if (to === 1 && !DONE_RETURNS_TO_ROOT_OFFER) to = 0;
  return { to, finish: () => popTo(to) };
}

/** The depth a flow started from, for the layer about to push `done` (its own depth when it is not a step). */
export function useFlowOrigin(): number {
  const { stack } = useSurface();
  const { depth } = useLayer();
  return flowOrigin(stack, depth);
}

/** "Reply in the talk": back to the nearest talk layer below, else one layer. */
export function useBackToTalk(): () => void {
  const { stack, pop } = useSurface();
  const { depth } = useLayer();
  const { popTo } = useStackNav();
  return () => {
    const t = nearestBelow(stack, depth, "talk");
    if (t > 0) popTo(t);
    else pop();
  };
}
