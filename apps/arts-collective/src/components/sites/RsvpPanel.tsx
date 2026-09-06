"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Member RSVP control for the offering page.
 *
 * Signed-out visitors get a link to sign in rather than a dead button — the
 * org's subdomain is a public page, so most people meeting this control do
 * not have an account yet. Guest RSVP (name + email, no account) exists on
 * amrit-canada and is deliberately not duplicated here yet.
 */
export function RsvpPanel({
  threadId,
  signedIn,
  attending: initiallyAttending,
  count: initialCount,
  attendeeLimit,
  loginUrl,
}: {
  threadId: string;
  signedIn: boolean;
  attending: boolean;
  count: number;
  attendeeLimit: number | null;
  loginUrl: string;
}) {
  const router = useRouter();
  const [attending, setAttending] = useState(initiallyAttending);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = attendeeLimit !== null && count >= attendeeLimit && !attending;

  async function submit(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/rsvp`, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "That didn't work.");
        return;
      }
      setAttending(method === "POST");
      if (typeof data?.count === "number") setCount(data.count);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-lg text-foreground">
            {attending ? "You're going." : full ? "This is full." : "Coming along?"}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {count} {count === 1 ? "person has" : "people have"} said yes
            {attendeeLimit !== null && ` · ${attendeeLimit} places`}
          </p>
        </div>
        {signedIn ? (
          <Button
            variant={attending ? "outline" : "default"}
            disabled={busy || (full && !attending)}
            onClick={() => submit(attending ? "DELETE" : "POST")}
          >
            {busy ? "…" : attending ? "Cancel my RSVP" : "Count me in"}
          </Button>
        ) : (
          <Button asChild variant="default">
            <a href={loginUrl}>Sign in to RSVP</a>
          </Button>
        )}
      </div>
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
