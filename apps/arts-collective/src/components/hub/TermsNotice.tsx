"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Asks a member from before the Terms existed (or before a new version) to
 * accept them (migration 223). Rendered by the hub only when the server says
 * the current version is not yet accepted.
 */
export function TermsNotice({ version }: { version: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/terms/accept", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setError("Could not record that. Try again.");
    router.refresh();
  }
  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-5 text-sm" role="region" aria-label="Terms">
      <p className="font-medium">The network has Terms and Acceptable Use (version {version}).</p>
      <p className="mt-1 text-muted-foreground">
        They say what you may do here and that what you publish, here or to an account you connect, is published by you.{" "}
        <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-4">Read them</a>.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={() => void accept()} className="rounded-full bg-foreground px-4 py-1.5 text-background disabled:opacity-50">
          {busy ? "Recording…" : "I accept"}
        </button>
        {error && <span className="text-destructive">{error}</span>}
      </div>
    </div>
  );
}
