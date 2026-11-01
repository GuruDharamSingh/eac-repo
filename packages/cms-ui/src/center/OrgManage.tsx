"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";
import { OrgPanel } from "../surface/surfaces/journey-panels";

// ============================================================================
// The organisation section, for the people who run it (developer, 2026-10-18):
// Details and People in the page itself, where the org card used to be. Anyone
// else, and any host that cannot serve the forms, keeps the card (`children`).
// ============================================================================

export function OrgManage({ orgId, children }: { orgId: string; children: React.ReactNode }) {
  const surfaces = useSurfaceOptional();
  if (!surfaces?.connectors.profile) return <>{children}</>;
  return (
    <section className="eac-jt eac-orgmanage" aria-label="Your organisation">
      <OrgPanel orgId={orgId} />
    </section>
  );
}
