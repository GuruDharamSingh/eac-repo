"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withBase } from "@/lib/base-path";

/**
 * RSVP for a thread. Signed-out visitors are sent to sign in with a return
 * path; the server decides eligibility (lib/thread-rsvp in services). One
 * button, two states, no optimism — the page re-renders from the server.
 */
export function RsvpButton({
  threadId,
  signedIn,
  going,
  returnTo = "/",
  joining = false,
}: {
  threadId: string;
  signedIn: boolean;
  going: boolean;
  returnTo?: string;
  /** A reading group is joined once, not attended once — same row, different words. */
  joining?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <a className="btn btn--primary" href={withBase(`/login?next=${encodeURIComponent(returnTo)}`)}>
        {joining ? "Sign in to join" : "Sign in to RSVP"}
      </a>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(withBase(`/api/threads/${threadId}/rsvp`), {
        method: going ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That didn't go through.");
      } else {
        router.refresh();
      }
    } catch {
      setError("That didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button type="button" className={going ? "btn" : "btn btn--primary"} onClick={toggle} disabled={busy}>
        {busy ? "…" : joining ? (going ? "You're in · leave" : "Join the group") : going ? "You're going · cancel" : "RSVP"}
      </button>
      {error && <span className="eyebrow" style={{ color: "var(--crimson)" }}>{error}</span>}
    </span>
  );
}
