"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Confirms an org after its intake interview. Authorisation lives entirely in
 * the route this calls — this is just the affordance.
 */
export function ConfirmOrgButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/orgs/${encodeURIComponent(slug)}/confirm`,
        { method: "POST" }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void confirm()}
        disabled={busy || pending}
        className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy || pending ? "Confirming…" : "Confirm"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
