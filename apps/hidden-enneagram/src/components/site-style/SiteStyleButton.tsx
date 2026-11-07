"use client";

import { useState, type ComponentType } from "react";
import { usePathname } from "next/navigation";
import type { SiteStyle } from "@elkdonis/direct-edit/site";
import type { SiteStyleEditorProps } from "@elkdonis/direct-edit/site/editor";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { saveSiteStyleAction } from "@/lib/site-style-actions";

/** Owners and guides see this (the layout decides; the action checks again). The editor loads only when opened. */
export function SiteStyleButton({ initial }: { initial: SiteStyle | null }) {
  const [Editor, setEditor] = useState<ComponentType<SiteStyleEditorProps> | null>(null);
  const [current, setCurrent] = useState(initial);
  const [failed, setFailed] = useState(false);
  // Not in the Studio: its block list sits where the button floats, and the
  // drawer styles the public pages (/manage/site points there). Not in
  // /manage either (2026-11-06): on a phone it covered the toasts and the
  // form buttons at the bottom-left; it is a public-pages tool.
  const path = usePathname() ?? "";
  const studio = path.startsWith("/studio") || path.startsWith("/manage");

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

  if (studio) return null;
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
  return (
    <button
      type="button"
      data-de-ui=""
      data-site-style-open=""
      onClick={open}
      style={{ position: "fixed", left: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1000, padding: "8px 14px", font: "600 13px system-ui, sans-serif", color: "#ece7d8", background: "#10131e", border: "1px solid #d4b062", borderRadius: 999, cursor: "pointer" }}
    >
      {failed ? "Could not open. Try again" : "Site style"}
    </button>
  );
}
