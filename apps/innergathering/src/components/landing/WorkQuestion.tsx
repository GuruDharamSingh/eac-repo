"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkQuestion as Question, WorkQuestionResponse } from "@/lib/landing";

/**
 * The Current Work Question.
 *
 * The collective's standing inquiry, and the responses so far. Anyone may
 * answer; a name is optional, and a signed-in member's account name is used
 * when they have one. The previous version was a Mantine form with a rich
 * text editor; a question deserves plain words, so this is a textarea.
 */
export function WorkQuestion({
  question,
  responses,
  signedIn,
}: {
  question: Question;
  responses: WorkQuestionResponse[];
  signedIn: boolean;
}) {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState(responses);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/work-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, response: text.trim(), displayName: name.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send that.");
      setList((l) => [{ displayName: name.trim() || (signedIn ? "A member" : "Anonymous"), response: text.trim(), at: new Date().toISOString() }, ...l]);
      setText("");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that.");
      setState("error");
    }
  }

  return (
    <div className="cwq-form" style={{ maxWidth: 820, margin: "0 auto" }}>
      <h2 className="cwq-title" style={{ fontFamily: '"Venture", Georgia, serif', fontSize: "clamp(2rem, 5vw, 3.4rem)", margin: "0 0 1rem", textAlign: "center", color: "var(--eac-ink, #01124E)" }}>
        {question.question}
      </h2>
      <hr className="gold-rule" style={{ "--rule-width": "60px", margin: "1.25rem auto 2rem" } as React.CSSProperties} />

      <form onSubmit={submit} style={{ display: "grid", gap: "0.75rem" }}>
        <textarea
          className="cwq-textarea"
          rows={4}
          placeholder="Your response…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ width: "100%", padding: "0.9rem 1rem", border: "1px solid rgba(183,154,85,0.45)", borderRadius: 4, background: "rgba(255,253,248,0.85)", fontFamily: '"Basteleur", Georgia, serif', fontSize: "1.05rem", lineHeight: 1.6, color: "#01124E", resize: "vertical" }}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
          {!signedIn ? (
            <input
              type="text"
              placeholder="Sign your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: "1 1 220px", padding: "0.6rem 0.9rem", border: "1px solid rgba(183,154,85,0.45)", borderRadius: 4, background: "rgba(255,253,248,0.85)", fontFamily: '"Basteleur", Georgia, serif', fontSize: "0.95rem", color: "#01124E" }}
            />
          ) : (
            <span style={{ fontSize: "0.85rem", color: "var(--ig-muted, #4b5f85)" }}>Posting under your account name.</span>
          )}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/offerings" className="cwq-forum-link" style={{ fontSize: "0.78rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8f763c", textDecoration: "none" }}>
              See the offerings →
            </Link>
            <button type="submit" className="cta-btn cwq-submit" disabled={state === "sending" || !text.trim()} style={{ cursor: "pointer" }}>
              {state === "sending" ? "Sending…" : "Respond"}
            </button>
          </div>
        </div>
        {state === "done" && <p className="cwq-thanks" style={{ margin: 0, color: "#2a5a2a" }}>Thank you — your response is in.</p>}
        {error && <p className="cwq-error" style={{ margin: 0, color: "#8b2e2e" }}>{error}</p>}
      </form>

      {list.length > 0 && (
        <ul style={{ listStyle: "none", margin: "2rem 0 0", padding: 0, display: "grid", gap: "0.75rem" }} aria-label="Responses so far">
          {list.slice(0, 6).map((r, i) => (
            <li key={i} style={{ padding: "0.85rem 1rem", borderLeft: "3px solid rgba(183,154,85,0.6)", background: "rgba(255,253,248,0.6)" }}>
              <p style={{ margin: 0, fontFamily: '"Basteleur", Georgia, serif', lineHeight: 1.6, color: "#01124E" }}>{r.response.replace(/<[^>]+>/g, "")}</p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#8f763c" }}>
                — {r.displayName || "Anonymous"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
