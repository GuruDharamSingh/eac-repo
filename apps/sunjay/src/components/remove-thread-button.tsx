"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@elkdonis/primitives";

/**
 * "Remove" on a published page, for its author or an editor.
 *
 * Archives through the same route the popup uses (DELETE /api/hub/threads/:id
 * — the rule lives in @elkdonis/services), then leaves the page, since the
 * page is gone. Nothing is destroyed: a manage console can restore it.
 */
export function RemoveThreadButton({
  threadId,
  title,
  backHref,
  className,
}: {
  threadId: string;
  title: string;
  backHref: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Remove “${title}”? It comes off every page and list. An editor can restore it.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/hub/threads/${encodeURIComponent(threadId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not remove it.");
        setBusy(false);
        return;
      }
      window.location.href = backHref;
    } catch {
      setError("Could not remove it.");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" className={className} onClick={remove} disabled={busy}>
        <Trash2 className="size-3.5" aria-hidden /> {busy ? "Removing…" : "Remove"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
