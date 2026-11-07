"use client";

import { useState } from "react";
import type { PuckDoc } from "@elkdonis/direct-edit/block";

/** Editors see this; the server decides that, and checks again on save. */
export function EditPageButton({ tree }: { tree: PuckDoc | null }) {
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setFailed(false);
    try {
      const { openLandingEditor } = await import("./page-editor-mount");
      await openLandingEditor({ tree });
      setEditing(true);
    } catch (err) {
      console.error("[home page editor] open:", err);
      setFailed(true);
    }
  }

  if (editing) return null;
  return (
    <button
      type="button"
      data-de-ui=""
      onClick={open}
      style={{ position: "fixed", left: 16, bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 1000, padding: "8px 14px", font: "600 13px system-ui, sans-serif", color: "#101214", background: "#c9a961", border: "1px solid #101214", cursor: "pointer" }}
    >
      {failed ? "Could not open the editor. Try again" : "Edit page"}
    </button>
  );
}
