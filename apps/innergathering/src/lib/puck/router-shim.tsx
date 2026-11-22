"use client";

import { createElement, useContext, type ComponentType, type ReactNode } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { Block } from "@elkdonis/blocks";

// ============================================================================
// The landing blocks inside the editor (2026-11-21).
//
// The page editor draws a block in its own React root (the canvas, and the "Settings..." sheet's Puck), outside
// Next's app router. The offerings band holds the RSVP panel, which calls `useRouter()` to refresh the page after an
// answer, and `useRouter()` throws "invariant expected app router to be mounted" when there is no router: Puck's
// whole sheet then went blank. Here the block is drawn inside a router that does nothing, so a click in the editor
// never navigates. On the page itself the real router is there and is left alone.
// ============================================================================

const noop = () => {};
const quiet = { back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop, hmrRefresh: noop };

function WithRouter({ children }: { children?: ReactNode }) {
  const router = useContext(AppRouterContext);
  return router ? <>{children}</> : <AppRouterContext.Provider value={quiet as never}>{children}</AppRouterContext.Provider>;
}

/** The same block, its component drawn inside `WithRouter`. Made once, at module load, so its identity is stable. */
export function withRouter<P>(block: Block<P>): Block<P> {
  const Inner = block.Component as ComponentType<P>;
  const Drawn = (props: P) => createElement(WithRouter, null, createElement(Inner as ComponentType<never>, props as never));
  Drawn.displayName = `WithRouter(${block.def.id})`;
  return { ...block, Component: Drawn as ComponentType<P> };
}
