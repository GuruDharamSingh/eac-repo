"use client";

import * as React from "react";
import type { SurfaceDescriptor } from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFrame } from "../SurfaceShell";
import { OrgPanel, ProfilePanel, SellingPanel, SitePanel } from "./journey-panels";

// ============================================================================
// A journey, opened: one of the Center's guided errands in a centered dialog
// (take three, 2026-10-18 — the developer preferred the popup to the inline
// section: larger type, one thing at a time). The panel inside carries its
// own dark rail and steps (journey-panels.tsx); this frame only names it.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "journey" }>;

const TITLE: Record<Descriptor["id"], { kicker: string; title: string }> = {
  auction: { kicker: "market.arts-collective.com", title: "Sell your art on the market" },
  org: { kicker: "Your organisation", title: "Set up your organisation" },
  profile: { kicker: "directory.arts-collective.com", title: "Your listing in the artist directory" },
  site: { kicker: "arts-collective.com", title: "Create a collective" },
};

export function JourneySurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors } = useSurface();
  const layer = useLayer();
  const t = TITLE[descriptor.id] ?? TITLE.auction;

  React.useEffect(() => {
    layer.setMeta({ title: t.title, kind: descriptor.id === "auction" ? "product" : "neutral", size: "wide" });
  }, [layer, t.title, descriptor.id]);

  let body: React.ReactNode;
  if (descriptor.id === "org") {
    body = descriptor.orgId ? (
      <OrgPanel orgId={descriptor.orgId} />
    ) : (
      <p className="eac-surface-empty">Which organisation? Open this from its Center.</p>
    );
  } else if (descriptor.id === "profile") {
    body = <ProfilePanel />;
  } else if (descriptor.id === "site") {
    body = <SitePanel />;
  } else if (!connectors.journey) {
    body = <p className="eac-surface-empty">This site does not take part in the auction.</p>;
  } else {
    body = <SellingPanel />;
  }

  return (
    <SurfaceFrame kind={descriptor.id === "auction" ? "product" : "neutral"} title={t.title} kicker={t.kicker} flush>
      <div className="eac-journey-dialog">{body}</div>
    </SurfaceFrame>
  );
}
