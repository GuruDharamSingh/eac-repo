"use client";

import * as React from "react";

// ============================================================================
// "Latest": this org, or the whole network. Both lists are rendered on the
// server and handed in; this only decides which one shows. The choice is kept
// per browser so a person who reads network-wide keeps reading network-wide.
// (Center take three, 2026-10-18.)
// ============================================================================

export function FeedSwitch({
  orgName,
  org,
  network,
  storageKey = "eac-center-feed-scope",
}: {
  orgName: string;
  org: React.ReactNode;
  network: React.ReactNode | null;
  storageKey?: string;
}) {
  const [scope, setScope] = React.useState<"org" | "network">("org");
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(storageKey);
      if (v === "network" && network) setScope("network");
    } catch {}
  }, [storageKey, network]);
  const pick = (s: "org" | "network") => {
    setScope(s);
    try {
      window.localStorage.setItem(storageKey, s);
    } catch {}
  };
  return (
    <div className="eac-center-feedswitch">
      {network && (
        <div className="eac-center-scope" role="tablist" aria-label="Which latest">
          <button type="button" role="tab" aria-selected={scope === "org"} onClick={() => pick("org")}>
            {orgName}
          </button>
          <button type="button" role="tab" aria-selected={scope === "network"} onClick={() => pick("network")}>
            Across the network
          </button>
        </div>
      )}
      <div hidden={scope !== "org"}>{org}</div>
      {network && <div hidden={scope !== "network"}>{network}</div>}
    </div>
  );
}
