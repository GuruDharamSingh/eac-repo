"use client";

import { useState } from "react";
import { PenLine } from "lucide-react";

/**
 * "Edit page" — opens the Silex editor on the page the editor is looking at.
 *
 * Lives in the React nav because the nav is the one part of a published
 * page that knows who is signed in; the Silex artifact itself is static and
 * cannot show a button to some visitors and not others.
 *
 * Mints a one-time token, then navigates in the same tab through /edit, which
 * redirects to the editor origin. Same tab on purpose: this is "go and change
 * it", and the way back is the editor's own preview/publish.
 */
export function EditPageButton({ page, className }: { page: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/silex/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open the editor");
        return;
      }
      window.location.href = data.editorUrl;
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      data-silex-edit={page}
      title={error ?? "Open this page in the editor"}
      className={[
        "inline-flex items-center gap-1.5 text-[13px] uppercase tracking-[0.12em] transition-colors",
        error ? "text-destructive" : "text-muted-foreground hover:text-primary",
        busy ? "opacity-60" : "",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <PenLine className="size-3.5" aria-hidden />
      {busy ? "Opening…" : error ? "Try again" : "Edit page"}
    </button>
  );
}
