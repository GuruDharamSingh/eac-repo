"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { openHouse, type HouseOptions } from "./open";

// ============================================================================
// The house page editor (2026-11-20): direct-edit's canvas on one stored page,
// Puck's block settings over it, the page's version held for the stale-save
// guard. An app binds this with its own catalogue, gated save action, resolver
// keys and routes (about 30 lines); it does not copy the canvas component.
//
// The editor and its stylesheet load on opening (a visitor's page references
// neither). `config` may be a loader so the app's catalogue, picture chooser
// and record sources load then too.
// ============================================================================

export type HouseEditorProps = Omit<HouseOptions, "host" | "cancelled"> & {
  /** The mount element's style. Default `{ minHeight: "100vh" }`. */
  hostStyle?: CSSProperties;
};

export function HouseEditor({ hostStyle, ...options }: HouseEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    openHouse({ ...options, host: host.current!, cancelled: () => cancelled })
      .then((handle) => {
        if (!handle) return;
        if (cancelled) handle.dispose();
        else stop = handle.dispose;
      })
      .catch((err) => {
        console.error("[canvas] open:", err);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
    // Mount once per page load; the editor owns its state from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return <p style={{ padding: "2rem" }}>The editor could not open. Reload the page to try again.</p>;
  return <div ref={host} style={hostStyle ?? { minHeight: "100vh" }} />;
}
