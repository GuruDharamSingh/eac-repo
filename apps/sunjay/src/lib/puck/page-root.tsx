import { createElement, type ReactNode } from "react";
import { BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";

/**
 * The page root as a visitor gets it (2026-11-04). A page whose root holds no look
 * draws no wrapper, so a stored page with nothing set publishes the markup it did
 * before the canvas editor. A look or a background picture set in the canvas draws
 * through the canvas's own root, so the two agree. Server-safe: no hooks.
 */
export function PublishedRoot({ settings, children }: { settings: Record<string, unknown>; children?: ReactNode }): ReactNode {
  if (!settings.look && !settings.image) return children ?? null;
  return createElement(BOX_ROOT.wrap, { settings }, children);
}
