"use client";

import { useEffect, useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import type { SiteStyle } from "@elkdonis/direct-edit/site";
import type { SiteStyleEditorProps } from "@elkdonis/direct-edit/site/editor";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { saveSiteStyleAction } from "@/lib/site-style-actions";

/** `/?site-style=1` (the hub's Site Builder card links here) opens the editor on arrival. */
export const SITE_STYLE_HREF = "/?site-style=1";

/**
 * Owners and guides see this (the layout decides; the action checks again). The editor loads only when opened.
 * Not on /studio: the page editors there have their own bars. Above "Edit this page" (lib/puck/render.tsx, bottom
 * right), so the two never cover each other.
 */
export function SiteStyleButton({ initial }: { initial: SiteStyle | null }) {
  const pathname = usePathname();
  const [Editor, setEditor] = useState<ComponentType<SiteStyleEditorProps> | null>(null);
  const [current, setCurrent] = useState(initial);
  const [failed, setFailed] = useState(false);

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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("site-style") === "1") void open();
  }, []);

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
  if (pathname?.startsWith("/studio")) return null;
  return (
    <button
      type="button"
      data-de-ui=""
      data-site-style-open=""
      onClick={open}
      style={{ position: "fixed", right: 16, bottom: "calc(68px + env(safe-area-inset-bottom, 0px))", zIndex: 1000, padding: "8px 14px", font: "600 13px system-ui, sans-serif", color: "#101214", background: "#c9ae79", border: "1px solid #101214", cursor: "pointer" }}
    >
      {failed ? "Could not open. Try again" : "Site style"}
    </button>
  );
}
