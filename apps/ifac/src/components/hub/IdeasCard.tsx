"use client";

import { useState } from "react";
import type { HubIdea } from "@/lib/hub-data";
import { HubCard } from "./HubCard";
import { formatDay } from "./format";

/**
 * Member suggestions — a condensed list on the face, the queue plus a form
 * behind it.
 *
 * The new idea is prepended optimistically. A suggestion box that makes you
 * wait for a round trip before showing your own words back reads as broken,
 * and the failure case here is cheap: the text stays in the form.
 */
export function IdeasCard({ initialIdeas }: { initialIdeas: HubIdea[] }) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      setError("Give the idea a short title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hub/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save that.");
        return;
      }
      setIdeas((current) => [
        {
          id: data.id,
          title: trimmed,
          body: body.trim() || null,
          authorName: "You",
          createdAt: new Date().toISOString(),
          status: "published",
          replyCount: 0,
        },
        ...current,
      ]);
      setTitle("");
      setBody("");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HubCard
      title="Suggested ideas"
      blurb="Propose something, or read the queue."
      glyph="☉"
      accent="moss"
      preview={
        ideas.length ? (
          <>
            {ideas.slice(0, 3).map((idea) => (
              <span key={idea.id} className="hub-preview-line">
                {idea.title}
              </span>
            ))}
            {ideas.length > 3 && (
              <span className="hub-preview-cue">
                +{ideas.length - 3} more
              </span>
            )}
          </>
        ) : (
          <span className="hub-preview-empty">No ideas yet — add the first</span>
        )
      }
    >
      <div className="hub-panel">
        <form className="hub-form" onSubmit={submit}>
          <label htmlFor="idea-title">Your idea</label>
          <input
            id="idea-title"
            className="hub-input"
            value={title}
            maxLength={200}
            placeholder="A show, a talk, a collaboration…"
            onChange={(e) => setTitle(e.target.value)}
          />

          <label htmlFor="idea-body">Anything more? (optional)</label>
          <textarea
            id="idea-body"
            className="hub-input"
            rows={3}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {error && (
            <p className="hub-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="hub-btn hub-btn--primary"
            disabled={saving}
          >
            {saving ? "Adding…" : "Add idea"}
          </button>
        </form>

        <h4 className="hub-panel-subhead">
          {ideas.length ? `${ideas.length} in the queue` : "The queue"}
        </h4>
        {ideas.length === 0 && (
          <p className="hub-muted">Nothing proposed yet.</p>
        )}
        <ul className="hub-list">
          {ideas.map((idea) => (
            <li key={idea.id} className="hub-list-row">
              <div>
                <p className="hub-list-title">{idea.title}</p>
                {idea.body && <p className="hub-list-body">{idea.body}</p>}
                <p className="hub-muted">
                  {[
                    idea.authorName,
                    formatDay(idea.createdAt),
                    idea.replyCount
                      ? `${idea.replyCount} ${idea.replyCount === 1 ? "reply" : "replies"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </HubCard>
  );
}
