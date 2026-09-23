"use client";

import * as React from "react";

// ============================================================================
// Classic ↔ Site: which hub layout this person sees. A cookie, so the choice
// holds across visits and the server renders the right one first time; a
// reload applies it. The host reads the cookie (`hub_view`).
// ============================================================================

import { HUB_VIEW_COOKIE } from "./view-cookie";

export function HubViewToggle({ current }: { current: "classic" | "site" }) {
  const set = (v: "classic" | "site") => {
    if (v === current) return;
    document.cookie = `${HUB_VIEW_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div className="eac-hs-seg eac-hs-seg--small eac-hs-toggle" role="group" aria-label="Hub layout">
      <button type="button" aria-pressed={current === "classic"} className={current === "classic" ? "is-on" : undefined} onClick={() => set("classic")}>
        Cards
      </button>
      <button type="button" aria-pressed={current === "site"} className={current === "site" ? "is-on" : undefined} onClick={() => set("site")}>
        Page
      </button>
    </div>
  );
}
