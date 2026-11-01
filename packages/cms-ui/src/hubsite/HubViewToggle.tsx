"use client";

import * as React from "react";

// ============================================================================
// Which hub layout this person sees. A cookie, so the choice holds across
// visits and the server renders the right one first time; a reload applies
// it. The host reads the cookie (`hub_view`).
//
// Hosts that offer only Cards and Page pass nothing; a host that also has the
// card-to-page layout (innergathering, 2026-10-08) passes `views`.
// ============================================================================

import { HUB_VIEW_COOKIE, type HubView } from "./view-cookie";

const LABELS: Record<HubView, string> = { classic: "Cards", site: "Page", cards2: "Cards 2" };

export function HubViewToggle({
  current,
  views = ["classic", "site"],
}: {
  current: HubView;
  views?: HubView[];
}) {
  const set = (v: HubView) => {
    if (v === current) return;
    document.cookie = `${HUB_VIEW_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div className="eac-hs-seg eac-hs-seg--small eac-hs-toggle" role="group" aria-label="Hub layout">
      {views.map((v) => (
        <button key={v} type="button" aria-pressed={current === v} className={current === v ? "is-on" : undefined} onClick={() => set(v)}>
          {LABELS[v]}
        </button>
      ))}
    </div>
  );
}
