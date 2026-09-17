"use client";

import * as React from "react";
import { SurfaceCard, useSurface, type SurfaceIdea } from "../surface";

// ============================================================================
// Suggested ideas — the face IS the form.
//
// There was no popup worth building here. IFAC's version opened a modal
// holding a one-line text field and a list; the modal was furniture around a
// sentence. So the field is on the tile: type it, press Enter, it is posted,
// and it appears in the list underneath without the page moving.
//
// Opening the tile therefore does the OTHER thing — it goes to the ideas feed
// on the forum, where the ideas are discussed. An idea is a thread
// (`kind = 'idea'`) in that feed, so proposing one here and replying to it
// there are the same object; this face is just the shortest path to the first
// step.
//
// Posted immediately, not queued: a suggestion box whose contents only an
// admin can see is a comment form.
//
// HEADER-LED (2026-09-16). The title and blurb moved to the top of the card,
// into the band the kind's medallion used to decorate. On a face whose point
// is a thing you DO, the instruction belongs above the control rather than
// underneath the result of using it — the footer layout had you read the
// field, the list, and then finally what any of it was for.
//
// The rows underneath are links now, not text. Each idea already carries the
// href of its own thread on the board (`SurfaceIdea.href`); printing the
// title without it meant the one obvious thing to do with an idea — go and
// read the replies — was the one thing the card would not let you do.
// ============================================================================

export function IdeasFace({
  initialIdeas = [],
  /** Overrides the connector's feed link. */
  href,
}: {
  initialIdeas?: SurfaceIdea[];
  href?: string;
}) {
  const { connectors } = useSurface();
  const ideas = connectors.ideas;

  const [items, setItems] = React.useState(initialIdeas);
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const feedHref = href ?? ideas?.href;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length < 3) {
      setError("Give the idea a few more words.");
      return;
    }
    if (!ideas) return;
    setSaving(true);
    setError(null);
    const result = await ideas.create({ title: trimmed });
    setSaving(false);
    // `result.ok === false`, not `!result.ok`: this union does not narrow
    // through the negation here, the same way forum-ui's WriteResult does not
    // in its action handler.
    if (result.ok === false) {
      // The text stays in the field, so a failure costs nothing but the press.
      setError(result.error);
      return;
    }
    setItems((current) => [result.idea, ...current]);
    setTitle("");
    connectors.onMutated?.();
  }

  return (
    <SurfaceCard
      kind="idea"
      layout="header"
      title="Suggested ideas"
      blurb="Propose something. It opens as a topic everyone can reply to."
      href={feedHref}
      ariaLabel="Open the suggested ideas feed"
      preview={
        <div className="eac-face-live eac-idea-face">
          {ideas ? (
            <form onSubmit={submit} className="eac-idea-form">
              <input
                className="eac-idea-input"
                value={title}
                maxLength={200}
                disabled={saving}
                placeholder="A show, a talk, a collaboration…"
                aria-label="Your idea"
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
              />
              <button
                type="submit"
                className="eac-preview-action"
                disabled={saving || title.trim().length < 3}
              >
                {saving ? "Adding…" : "Enter"}
              </button>
            </form>
          ) : (
            <span className="eac-preview-empty">Ideas are not open on this site.</span>
          )}

          {error && (
            <span className="eac-idea-error" role="alert">
              {error}
            </span>
          )}

          {/* The latest two, at the foot of the card, each linking to its own
              thread. Two rather than three: with the title block now at the
              top the card has one line less to give, and a card that lists
              is a feed — the point here is the most recent thing and a way
              in, not a digest. */}
          <div className="eac-idea-latest">
            {items.slice(0, 2).map((idea) =>
              idea.href ? (
                <a key={idea.id} className="eac-idea-row" href={idea.href}>
                  {idea.title}
                </a>
              ) : (
                <span key={idea.id} className="eac-idea-row">
                  {idea.title}
                </span>
              )
            )}
            {items.length > 2 && feedHref && (
              <a className="eac-preview-cue" href={feedHref}>
                +{items.length - 2} more in the feed
              </a>
            )}
            {items.length === 0 && ideas && (
              <span className="eac-preview-empty">Nothing proposed yet — add the first.</span>
            )}
          </div>
        </div>
      }
    />
  );
}
