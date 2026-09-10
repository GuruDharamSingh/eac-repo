"use client";

import { useState } from "react";

/**
 * RSVP for a member.
 *
 * Writes to `thread_rsvps` through /api/hub/rsvp, NOT to the app's existing
 * /api/rsvp — that one takes an email from a stranger and writes
 * `guest_submissions`, which has no user_id at all. Two genuinely different
 * things wearing one name: a member saying "I'll be there" and the public
 * expressing interest. The guest route stays for the public site.
 */
export function RsvpPanel({
  threadId,
  initialStatus,
  confirmed,
  attendeeLimit,
}: {
  threadId: string;
  initialStatus: string | null;
  confirmed: number;
  attendeeLimit: number | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [count, setCount] = useState(confirmed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = attendeeLimit !== null && count >= attendeeLimit && status !== "yes";

  async function set(next: "yes" | "no") {
    setSaving(true);
    setError(null);
    const previous = status;
    setStatus(next);
    try {
      const res = await fetch("/api/hub/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, status: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(previous);
        setError(data.error ?? "Could not save that.");
        return;
      }
      setCount(data.confirmed ?? count);
    } catch {
      setStatus(previous);
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hub-panel">
      <h4 className="hub-panel-subhead">Are you coming?</h4>
      <div className="hub-panel-actions">
        <button
          type="button"
          className={`hub-btn ${status === "yes" ? "hub-btn--primary" : ""}`}
          onClick={() => void set("yes")}
          disabled={saving || full}
          aria-pressed={status === "yes"}
        >
          {status === "yes" ? "You're coming" : "Count me in"}
        </button>
        <button
          type="button"
          className={`hub-btn ${status === "no" ? "hub-btn--primary" : ""}`}
          onClick={() => void set("no")}
          disabled={saving}
          aria-pressed={status === "no"}
        >
          Can&rsquo;t make it
        </button>
        <span className="hub-muted">
          {count} coming
          {attendeeLimit ? ` · ${attendeeLimit} places` : ""}
        </span>
      </div>
      {full && (
        <p className="hub-muted">This one is at capacity.</p>
      )}
      {error && (
        <p className="hub-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
