"use client";

import * as React from "react";
import { SurfaceFrame, SurfaceSkeleton, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { listOverlapsAction } from "@/lib/overlap-actions";
import type { Overlap } from "@/lib/slot-overlaps";
import { OverlapList } from "@/components/office/overlap-list";

/** The hub card's descriptor (registered as `office-overlaps` in HubSurfaces). */
export const overlapsDescriptor: SurfaceDescriptor = {
  type: "custom",
  key: "office-overlaps",
  title: "Overlapping runs",
  kind: "event",
  size: "wide",
};

/** Overlap notices in a popup over the hub: runs of one guide that overlap, with Dismiss. */
export function OverlapsPopup({ descriptor }: { descriptor: Extract<SurfaceDescriptor, { type: "custom" }> }) {
  const [items, setItems] = React.useState<Overlap[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    void listOverlapsAction()
      .then((r) => (r.ok ? setItems(r.overlaps) : setError(r.error)))
      .catch(() => setError("Could not load the overlaps."));
  }, []);
  return (
    <SurfaceFrame kind="event" kicker="Office" title={descriptor.title ?? "Overlapping runs"} actions={[{ label: "Full schedule", href: "/manage/schedule", quiet: true }]}>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : items == null ? <SurfaceSkeleton block /> : <OverlapList initial={items} />}
    </SurfaceFrame>
  );
}
