"use client";

import * as React from "react";
import type { SurfaceDescriptor } from "../types";
import { SurfaceFrame } from "../SurfaceShell";
import { ProfilePanel } from "./journey-panels";

// ============================================================================
// "View profile" on /center (2026-10-31): the person's own profile as a
// control panel. The same tabs as the artist-directory journey (details,
// offer, where you show, links) plus Connections (Facebook & Instagram,
// Threads, YouTube), with no journey rail: the developer found the rail took
// the room the forms need. Opened from the bar above the journeys and from
// the Studio's "Manage connections" link (`?surface=me:connections`).
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "me" }>;

export function MeSurface({ descriptor }: { descriptor: Descriptor }) {
  return (
    <SurfaceFrame kind="neutral" title="Your profile" kicker="You, across the network" flush>
      <div className="eac-journey-dialog eac-me-dialog">
        <ProfilePanel bare initialTab={descriptor.tab ?? null} />
      </div>
    </SurfaceFrame>
  );
}
