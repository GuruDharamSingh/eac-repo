"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The comment box under a week. Posts a reply to the week's topic thread
 * through /api/series/comment; the list above it is server-rendered and
 * refreshes after a post.
 */
export function WeekCommentForm({ seriesId, occurrenceAt, signedIn, returnTo }: { seriesId: string; occurrenceAt: string; signedIn: boolean; returnTo: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="ifs-comments__gate">
        <a className="ifs-btn ifs-btn--small" href={`/login?mode=signup&next=${encodeURIComponent(returnTo)}`}>Sign in to join the conversation</a>
      </p>
    );
  }

  return (
    <form
      className="ifs-comments__form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/series/comment", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ seriesId, occurrenceAt, text }),
          });
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            setError(body.error ?? "Could not post.");
            return;
          }
          setText("");
          router.refresh();
        } catch {
          setError("Could not reach the server.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="ifs-comments__label" htmlFor="week-comment">Add a comment</label>
      <textarea id="week-comment" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="A question for the host, a thought about the work…" />
      <div className="ifs-comments__actions">
        <button type="submit" className="ifs-btn ifs-btn--primary ifs-btn--small" disabled={busy || !text.trim()}>{busy ? "Posting…" : "Post comment"}</button>
        {error && <span className="ifs-rsvp-form__err">{error}</span>}
      </div>
    </form>
  );
}
