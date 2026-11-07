"use client";

import { useState, type ComponentType } from "react";
import type { SiteStyle } from "@elkdonis/direct-edit/site";
import type { SiteStyleEditorProps } from "@elkdonis/direct-edit/site/editor";
import { SITE_STYLE } from "@/lib/site-style-schema";
import { saveSiteStyleAction } from "@/lib/site-style-actions";

/** Owners and guides see this (the layout decides; the action checks again). The editor loads only when opened. */
export function SiteStyleButton({ initial }: { initial: SiteStyle | null }) {
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
      style={{ position: "fixed", right: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1000, padding: "8px 14px", font: "600 13px system-ui, sans-serif", color: "#fff", background: "#01124E", border: "1px solid #b79a55", borderRadius: 6, cursor: "pointer" }}
    >
      {failed ? "Could not open. Try again" : "Site style"}
    </button>
  );
}
