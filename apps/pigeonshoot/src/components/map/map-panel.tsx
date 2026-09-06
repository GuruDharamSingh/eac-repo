"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import type { LeafletMapProps } from "./leaflet-map";

/**
 * The client boundary around Leaflet.
 *
 * Leaflet reads `window` at import time, so it can never be server-rendered.
 * In Next 15+ `dynamic(..., { ssr: false })` is not allowed inside a Server
 * Component — it throws at build — so the dynamic() has to live in a
 * "use client" module. This is that module; server pages render <MapPanel/>.
 *
 * The loading skeleton reserves the full height so the page doesn't jump when
 * the map finally arrives.
 */
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-muted text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export function MapPanel({ className, ...props }: LeafletMapProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border", className)}>
      <LeafletMap {...props} className="size-full" />
    </div>
  );
}
