"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Answer the work question without an account.
 *
 * Replies in the forum thread above need one; this keeps the older promise
 * that anyone may answer. Answers go to the work-question store
 * (`work_question_responses`), where the collective reads them, not into
 * the thread.
 */
export function GuestAnswer({ questionId, question }: { questionId: string; question: string }) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/work-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, response: text.trim(), displayName: name.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send that.");
      setText("");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that.");
      setState("error");
    }
  }

  return (
    <form className="ig-guest-answer" onSubmit={submit}>
      <div className="ig-guest-answer-head">
        <p className="ig-guest-answer-title">No account? Answer here.</p>
        <p className="ig-guest-answer-note">
          &ldquo;{question}&rdquo; — your answer goes to the collective directly.{" "}
          <Link href="/login?next=/forum">Sign in</Link> to reply in the forum instead.
        </p>
      </div>
      <textarea
        rows={3}
        placeholder="Your answer…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Your answer"
      />
      <div className="ig-guest-answer-row">
        <input
          type="text"
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your name (optional)"
        />
        <button type="submit" disabled={state === "sending" || !text.trim()}>
          {state === "sending" ? "Sending…" : "Send answer"}
        </button>
      </div>
      {state === "done" && <p className="ig-guest-answer-thanks">Thank you — your answer is in.</p>}
      {error && <p className="ig-guest-answer-error">{error}</p>}
    </form>
  );
}
