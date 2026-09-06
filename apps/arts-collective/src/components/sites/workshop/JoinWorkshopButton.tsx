"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The way into a workshop from the org's profile listing: join it, or — once
 * you are in — step through to the workspace.
 */
export function JoinWorkshopButton({
  threadId,
  workshopSlug,
  signedIn,
  enrolled: initiallyEnrolled,
  loginUrl,
}: {
  threadId: string;
  workshopSlug: string;
  signedIn: boolean;
  enrolled: boolean;
  loginUrl: string;
}) {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(initiallyEnrolled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (enrolled) {
    return (
      <a
        href={`/workshop/${workshopSlug}`}
        className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Enter workshop →
      </a>
    );
  }

  if (!signedIn) {
    return (
      <a
        href={loginUrl}
        className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
      >
        Sign in to join
      </a>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/threads/${threadId}/rsvp`, { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              setError(data?.error ?? "Couldn't join.");
              return;
            }
            setEnrolled(true);
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? "…" : "Join workshop"}
      </button>
    </span>
  );
}
