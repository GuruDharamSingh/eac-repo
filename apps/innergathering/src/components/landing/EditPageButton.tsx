"use client";

import { useState } from "react";
import type { PagePatches, PuckDoc } from "@elkdonis/direct-edit/block";

/** Owners and guides see this; the server decides that, and checks again on save. */
export function EditPageButton({ doc, tree }: { page: string; doc: PagePatches; tree: PuckDoc | null }) {
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setFailed(false);
    try {
      const { openLandingEditor } = await import("./page-editor-mount");
      await openLandingEditor({ tree, edits: doc });
      setEditing(true);
    } catch (err) {
      console.error("[page-edits] open:", err);
      setFailed(true);
    }
  }

  if (editing) return null;
  return (
    <button
      type="button"
      data-de-ui=""
      onClick={open}
      style={{ position: "fixed", left: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1000, padding: "8px 14px", font: "600 13px system-ui, sans-serif", color: "#fff", background: "#01124E", border: "1px solid #b79a55", borderRadius: 6, cursor: "pointer" }}
    >
      {failed ? "Could not open the editor. Try again" : "Edit page"}
    </button>
  );
}
