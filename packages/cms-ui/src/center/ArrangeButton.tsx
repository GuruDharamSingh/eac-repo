"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

/**
 * "Arrange" on the org card, for owners and guides. Opens the center-layout
 * surface; renders nothing where no provider (or no connector) can open it,
 * so a host that has not wired the surface shows no dead control.
 */
export function ArrangeButton({ orgId }: { orgId: string }) {
  const surfaces = useSurfaceOptional();
  if (!surfaces || !surfaces.connectors.centerLayout) return null;
  return (
    <button
      type="button"
      className="eac-center-btn"
      aria-haspopup="dialog"
      onClick={() => surfaces.open({ type: "centerLayout", orgId })}
    >
      Arrange center
    </button>
  );
}
