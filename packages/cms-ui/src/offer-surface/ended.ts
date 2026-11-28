"use client";

import * as React from "react";
import { hasEnded } from "./format";
import type { SurfaceOffer } from "./types";

/**
 * The browser's clock, or null until the page has mounted (and on the server). Anything that depends on it
 * draws the live state first and switches after mount, so the server and the browser always agree
 * (the same way the event countdown draws dashes first). Re-reads once a minute.
 */
export function useNowMs(): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** True once mounted and the event is over. */
export function useHasEnded(offer: SurfaceOffer | null | undefined): boolean {
  const now = useNowMs();
  return now != null && hasEnded(offer, now);
}
