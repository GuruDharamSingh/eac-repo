"use client";

import { useEffect } from "react";
import { useSurfaceOptional } from "@elkdonis/cms-ui/surface";
import { typeDescriptor } from "./type-surface";

// ============================================================================
// /enneagram (round 3): a tap on a type, in the figure or in the text, opens
// that type as a Surface popup. One listener for the page, so the figure
// (its "Read type N" link) and the passages (any link to `#type-N`, and the
// chapter rows) need no wiring of their own. Without script every one of them
// still works: the link goes to `#type-N`, the row opens in place.
//
// Not caught: modifier clicks, links inside a popup (its "In the page" must
// navigate), and anything inside `[data-he-plain]`.
//
// Also: `#type-N` in the address (where /type-N redirects) opens that row in
// place and brings it into view.
// ============================================================================

const HREF = /^(?:\/enneagram)?#type-([1-9])$/;

function openRowFromHash() {
  const m = /^#type-([1-9])$/.exec(window.location.hash);
  if (!m) return;
  const row = document.getElementById(`type-${m[1]}`);
  if (row instanceof HTMLDetailsElement) {
    row.open = true;
    row.scrollIntoView({ block: "start" });
  }
}

export function TypeLinks() {
  const surface = useSurfaceOptional();

  useEffect(() => {
    openRowFromHash();
    window.addEventListener("hashchange", openRowFromHash);
    return () => window.removeEventListener("hashchange", openRowFromHash);
  }, []);

  useEffect(() => {
    if (!surface) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      if (!target || target.closest("[data-he-plain], [role='dialog'], dialog")) return;
      let n: number | null = null;
      let origin: HTMLElement | null = null;
      const row = target.closest<HTMLElement>("summary[data-he-type-open]");
      if (row) {
        n = Number(row.dataset.heTypeOpen);
        origin = row;
      } else {
        const a = target.closest<HTMLAnchorElement>("a[href]");
        const m = a ? HREF.exec(a.getAttribute("href") ?? "") : null;
        if (a && m) {
          n = Number(m[1]);
          origin = a;
        }
      }
      if (!n || n < 1 || n > 9) return;
      e.preventDefault();
      surface.open(typeDescriptor(n), origin);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [surface]);

  return null;
}
