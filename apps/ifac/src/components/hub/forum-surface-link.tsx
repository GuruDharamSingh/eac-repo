"use client";

import type { MouseEvent, ReactNode } from "react";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";

/**
 * The cards-2 hub's Forum card (2026-11-14, hand-test #7a): the same card, but a plain click opens the forum
 * surface over the hub, as the normal cards layout's ForumFace does, instead of leaving for /forum. A click with a
 * modifier (new tab or window) and a page without the surface provider still follow the link.
 */
export function ForumSurfaceLink({ children }: { children: ReactNode }) {
  const surface = useSurfaceOptional();
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!surface || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!(e.target as HTMLElement).closest("a[href]")) return;
    e.preventDefault();
    surface.open({ type: "forum" });
  };
  return (
    <div onClickCapture={onClickCapture} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
