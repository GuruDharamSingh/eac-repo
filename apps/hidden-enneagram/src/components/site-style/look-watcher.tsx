"use client";

import { useEffect } from "react";

/**
 * Round 3: the house look preset (Site style → Look: "Quiet" or "ÆON").
 * The choice is the variable `--he-look`; CSS cannot switch a whole token set
 * on a variable's value, so the layout writes the STORED choice as
 * `data-he-look` on <html> (palette.css keys the ÆON tokens on it) and this
 * island follows the Site style editor's live preview: whenever a site-style
 * sheet changes, it reads `--he-look` back and moves the attribute. Close the
 * editor without saving and the stored choice returns with the server sheet.
 */
export function LookWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const look = getComputedStyle(root).getPropertyValue("--he-look").trim();
      const next = look === "aeon" ? "aeon" : "quiet";
      if (root.dataset.heLook !== next) root.dataset.heLook = next;
    };
    const watch = new MutationObserver((records) => {
      if (records.some((r) => (r.target as Element).nodeName === "STYLE" || [...r.addedNodes, ...r.removedNodes].some((n) => n.nodeName === "STYLE") || r.target.parentNode?.nodeName === "STYLE")) sync();
    });
    watch.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["media"] });
    watch.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["media"] });
    sync();
    return () => watch.disconnect();
  }, []);
  return null;
}
