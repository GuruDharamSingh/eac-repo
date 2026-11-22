"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import type { SiteStyle } from "@elkdonis/direct-edit/site";
import type { SiteStyleEditorProps } from "@elkdonis/direct-edit/site/editor";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { saveSiteStyleAction } from "@/lib/site-style-actions";

// Where a floating button would sit on top of working UI: the page editors,
// the manage and hub rooms, the account page.
const HIDDEN_ON = /^\/(studio|manage|hub|account)(\/|$)/;

/**
 * Owners and guides see this (the layout decides; the action checks again).
 * The editor loads only when opened. Sits above "Edit page" (bottom left), and
 * steps aside while the page canvas is open: the canvas draws its own bars,
 * all marked data-de-ui and none of them a button.
 */
export function SiteStyleButton({ initial }: { initial: SiteStyle | null }) {
  const [Editor, setEditor] = useState<ComponentType<SiteStyleEditorProps> | null>(null);
  const [current, setCurrent] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const hidden = HIDDEN_ON.test(usePathname() ?? "");

  useEffect(() => {
    const check = () => setCanvasOpen(Boolean(document.documentElement.classList.contains("de-editing")));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  async function open() {
    setFailed(false);
    try {
      const mod = await import("@elkdonis/direct-edit/site/editor");
      setEditor(() => mod.SiteStyleEditor);
    } catch (err) {
      console.error("[site-style] open:", err);
      setFailed(true);
    }
  }

  if (hidden) return null;
  if (Editor) {
    return (
      <Editor
        schema={SITE_STYLE}
        initial={current}
        onSave={async (style) => {
          const res = await saveSiteStyleAction(style);
          if (res.ok) setCurrent(style);
          return res;
        }}
        onClose={() => setEditor(null)}
      />
    );
  }
  if (canvasOpen) return null;
  return (
    <button
      type="button"
      data-de-ui=""
      data-site-style-open=""
      onClick={open}
      style={{ position: "fixed", left: 16, bottom: "calc(60px + env(safe-area-inset-bottom, 0px))", zIndex: 1000, padding: "8px 14px", font: "600 13px system-ui, sans-serif", color: "#fff", background: "#01124E", border: "1px solid #b79a55", borderRadius: 6, cursor: "pointer" }}
    >
      {failed ? "Could not open. Try again" : "Site style"}
    </button>
  );
}
