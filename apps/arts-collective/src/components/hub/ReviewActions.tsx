"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Accept or return one submission. Authorisation lives entirely in the route
 * this calls — these are affordances, not a gate.
 */
export function ReviewActions({
  responseId,
  gatesTier,
  currentTier,
}: {
  responseId: string;
  gatesTier: string | null;
  currentTier: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [promote, setPromote] = useState(false);

  // Only offer promotion when it would actually change something.
  const order = ["member", "host", "partner"];
  const canPromote =
    Boolean(gatesTier) && order.indexOf(gatesTier!) > order.indexOf(currentTier);

  async function act(outcome: "reviewed" | "returned") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vetting/${responseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outcome,
          note: note.trim() || undefined,
          promote: outcome === "reviewed" ? promote : false,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note to the applicant (required when returning)…"
        rows={2}
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />

      {canPromote && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={promote}
            onChange={(e) => setPromote(e.target.checked)}
          />
          Also advance to <code className="text-foreground">{gatesTier}</code>{" "}
          (currently {currentTier})
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void act("reviewed")}
          disabled={disabled}
          className="inline-flex min-h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {disabled ? "Working…" : "Accept"}
        </button>
        <button
          type="button"
          onClick={() => void act("returned")}
          disabled={disabled || !note.trim()}
          title={!note.trim() ? "Add a note explaining what's needed" : undefined}
          className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-accent disabled:opacity-40"
        >
          Return for more
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}
