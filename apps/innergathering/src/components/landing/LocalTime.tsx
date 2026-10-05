"use client";

import { useEffect, useState } from "react";

/**
 * "· 11:00 p.m. your time" beside a Toronto clock reading, for a visitor
 * whose browser is in another zone (the collective meets from Paris and
 * Los Angeles as well). Rendered after mount only: the server does not know
 * the visitor's zone, and guessing would mismatch on hydration.
 */
export function LocalTime({ iso, sourceZone = "America/Toronto" }: { iso: string; sourceZone?: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || zone === sourceZone) return;
    const at = new Date(iso);
    const fmt = (tz: string) =>
      at.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: tz });
    // Same clock reading in both zones (e.g. Toronto and New York): nothing to add.
    if (fmt(zone) === fmt(sourceZone)) return;
    setLabel(`${fmt(zone)} your time`);
  }, [iso, sourceZone]);

  return label ? <span className="ig-offer-localtime">{label}</span> : null;
}
