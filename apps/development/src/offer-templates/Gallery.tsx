"use client";

import * as React from "react";
import { GalleryLive } from "./GalleryLive";
import { Catalogue } from "./Catalogue";
import "./gallery.css";

// The gallery shell. One view today ("Live": frames); a second "Catalogue" view
// (docs, live example, code, data needs, read from templates/*.meta.tsx) slots in
// by adding an entry to VIEWS.
const VIEWS: Array<{ id: string; label: string; render: () => React.ReactNode }> = [
  { id: "live", label: "Live", render: () => <GalleryLive /> },
  { id: "catalogue", label: "Catalogue", render: () => <Catalogue /> },
];

export function Gallery() {
  const [view, setView] = React.useState(VIEWS[0]!.id);
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0]!;
  return (
    <div className="gl">
      {VIEWS.length > 1 && (
        <div className="gl-views" role="tablist">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === view} onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      )}
      {current.render()}
    </div>
  );
}
