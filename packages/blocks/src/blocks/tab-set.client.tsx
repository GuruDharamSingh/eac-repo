"use client";

import { useEffect, useRef } from "react";

/**
 * The Tabs block's only script (2026-11-07). It sits inside `.blk-tabs`, finds its
 * own tab row and panels, shows the chosen panel and hides the rest. Clicks and
 * the arrow, Home and End keys move between tabs (WAI-ARIA tabs pattern).
 *
 * It runs after every render, not once: in an editor a re-render can add a
 * panel (a tab was named), and that panel must be hidden or shown like the
 * others. React does not manage `hidden` or `aria-selected` after the first
 * render here, so setting them by hand does not fight it. The chosen tab is kept
 * on the block as `data-chosen`, so it survives those re-renders.
 */
export function TabSwitch() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>(".blk-tabs");
    if (!root) return;
    const tabs = () => Array.from(root.querySelectorAll<HTMLButtonElement>(":scope > .blk-tabs-list > .blk-tabs-tab"));
    const panels = () => Array.from(root.querySelectorAll<HTMLElement>(":scope > .blk-tabs-panel"));
    const show = (i: number, focus = false) => {
      const ts = tabs(), ps = panels();
      if (!ts.length) return;
      const at = Math.max(0, Math.min(ts.length - 1, i));
      ts.forEach((t, k) => { t.setAttribute("aria-selected", String(k === at)); t.tabIndex = k === at ? 0 : -1; });
      // Editing shows every panel (blocks.css), so nothing is hidden by hand there.
      const editing = root.dataset.editing !== undefined;
      ps.forEach((p, k) => { p.hidden = !editing && k !== at; });
      root.dataset.chosen = String(at);
      if (focus) ts[at]!.focus();
    };
    root.dataset.scripted = "";
    show(Number(root.dataset.chosen ?? 0) || 0);
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>(".blk-tabs-tab");
      if (!t || t.closest(".blk-tabs") !== root) return;
      show(tabs().indexOf(t));
    };
    const onKey = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>(".blk-tabs-tab");
      if (!t || t.closest(".blk-tabs") !== root) return;
      const ts = tabs(), i = ts.indexOf(t);
      const to = e.key === "ArrowRight" ? (i + 1) % ts.length : e.key === "ArrowLeft" ? (i - 1 + ts.length) % ts.length : e.key === "Home" ? 0 : e.key === "End" ? ts.length - 1 : -1;
      if (to < 0) return;
      e.preventDefault();
      show(to, true);
    };
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKey);
    return () => { root.removeEventListener("click", onClick); root.removeEventListener("keydown", onKey); };
  });
  return <span ref={ref} hidden className="blk-tabs-script" />;
}
