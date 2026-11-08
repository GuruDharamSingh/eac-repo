import type { ReactNode } from "react";

/**
 * Preview-only wrapper for design-sync cards: the card pages hard-code a white body, so this
 * paints the series `.ifs` root (near-black #0b0b0d, ink #ece7e1, Source Sans 3) the way the
 * IFAC series pages do. Not part of the platform; real pages put `className="ifs"` on their root.
 */
export function PreviewFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="ifs" style={{ minHeight: "100vh", padding: 24, margin: -24 }}>
      {children}
    </div>
  );
}
