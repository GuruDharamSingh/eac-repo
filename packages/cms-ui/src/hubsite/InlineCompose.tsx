"use client";

import * as React from "react";
import { useSurface } from "../surface";

// ============================================================================
// Start a post the way the writing shelf starts a piece: one line, a title,
// and Enter. Enter unfolds the rest in place — what kind of thing it is, the
// body, a cover from the group's library — and Publish.
//
// A post is saved here through the host's `saveThread` (the same write the
// compose popup uses). Other kinds need more than a body (a date, sessions),
// so choosing one carries the title and body into the full compose popup for
// that kind. A viewer who may not publish for the org gets "Post to…"
// instead, which writes only where their role allows.
// ============================================================================

const OTHER_KINDS: Array<{ id: string; label: string }> = [
  { id: "event", label: "Gathering" },
  { id: "workshop", label: "Workshop" },
];

export function InlineCompose({
  name,
  avatarUrl,
  feeds = [],
}: {
  name: string;
  avatarUrl: string | null;
  /** This org's feeds; a post lands in one. */
  feeds?: Array<{ slug: string; name: string }>;
}) {
  const { connectors, open } = useSurface();
  const canPublish = Boolean(connectors.viewer.canCompose && connectors.saveThread);
  const canPostTo = Boolean(connectors.postTo);

  const [title, setTitle] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [cover, setCover] = React.useState<unknown>(null);
  const [feed, setFeed] = React.useState(feeds[0]?.slug ?? "");
  const [saving, setSaving] = React.useState<null | "draft" | "published">(null);
  const [status, setStatus] = React.useState<{ text: string; error?: boolean } | null>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLElement>(null);

  if (!canPublish && !canPostTo) return null;

  function start() {
    if (!title.trim()) return;
    if (!canPublish) {
      // Only "Post to…" for this viewer: it carries the title over.
      open({ type: "postTo", title: title.trim() }, rootRef.current);
      setTitle("");
      return;
    }
    setExpanded(true);
    setStatus(null);
  }

  function reset() {
    setTitle("");
    setBody("");
    setCover(null);
    setExpanded(false);
  }

  async function save(to: "draft" | "published") {
    if (!connectors.saveThread || !title.trim()) return;
    setSaving(to);
    setStatus(null);
    const coverUrl = typeof cover === "string" ? cover : null;
    const result = await connectors
      .saveThread({
        kind: "post",
        status: to,
        answers: {
          title: title.trim(),
          body,
          ...(coverUrl ? { cover_image_url: coverUrl } : {}),
          ...(feed ? { feed_slug: feed } : {}),
        },
      })
      .catch(() => ({ ok: false as const, error: "Could not save it." }));
    setSaving(null);
    if (result.ok === false) {
      setStatus({ text: result.error ?? "Could not save it.", error: true });
      return;
    }
    const id = result.id;
    reset();
    setStatus({ text: to === "published" ? "Published." : "Saved as a draft." });
    connectors.onMutated?.();
    if (id) open({ type: "thread", id, preview: { title: title.trim(), kind: "post" } }, rootRef.current);
  }

  const BodySlot = connectors.composeSlots?.body;
  const MediaSlot = connectors.composeSlots?.media;

  return (
    <section className={`eac-hs-compose${expanded ? " is-open" : ""}`} aria-label="Write something" ref={rootRef}>
      <form
        className="eac-hs-compose-line"
        onSubmit={(e) => {
          e.preventDefault();
          if (!expanded) start();
        }}
      >
        <span className="eac-hs-avatar">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" />
          ) : (
            <span aria-hidden>{name.slice(0, 1)}</span>
          )}
        </span>
        <label className="eac-hs-sr" htmlFor="eac-hs-compose-title">
          Title
        </label>
        <input
          id="eac-hs-compose-title"
          ref={titleRef}
          className="eac-hs-compose-title"
          value={title}
          maxLength={200}
          placeholder={`Start something, ${name.split(" ")[0] || "you"} — give it a title`}
          onChange={(e) => setTitle(e.target.value)}
        />
        {!expanded && (
          <button type="submit" className="eac-btn eac-btn--primary" aria-label="Start" disabled={!title.trim()}>
            ↵
          </button>
        )}
      </form>

      {expanded && (
        <div className="eac-hs-compose-more">
          <div className="eac-hs-compose-kinds" role="group" aria-label="What is it?">
            <span className="eac-hs-kicker">What is it?</span>
            <button type="button" className="eac-hs-chip is-on" aria-pressed="true">
              Post
            </button>
            {OTHER_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="eac-hs-chip"
                aria-pressed="false"
                onClick={() => {
                  open(
                    { type: "compose", kind: k.id, prefill: { title: title.trim(), body }, tier: "full" },
                    rootRef.current
                  );
                  reset();
                }}
              >
                {k.label} …
              </button>
            ))}
            {feeds.length > 1 && (
              <label className="eac-hs-compose-feed">
                <span className="eac-hs-kicker">In</span>
                <select value={feed} onChange={(e) => setFeed(e.target.value)}>
                  {feeds.map((f) => (
                    <option key={f.slug} value={f.slug}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="eac-hs-compose-body">
            {BodySlot ? (
              BodySlot({ value: body, onChange: setBody, tier: "full" })
            ) : (
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write it here" />
            )}
          </div>

          {MediaSlot && (
            <div className="eac-hs-compose-media">
              {MediaSlot({
                value: cover,
                onChange: setCover,
                label: "Cover image",
                hint: "Upload one, or choose from the group's library.",
              })}
            </div>
          )}

          <div className="eac-hs-compose-actions">
            {status && <span className={`eac-hs-status${status.error ? " is-error" : ""}`}>{status.text}</span>}
            <button type="button" className="eac-btn eac-btn--quiet" onClick={reset} disabled={Boolean(saving)}>
              Cancel
            </button>
            <button type="button" className="eac-btn" onClick={() => void save("draft")} disabled={Boolean(saving) || !title.trim()}>
              {saving === "draft" ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="eac-btn eac-btn--primary"
              onClick={() => void save("published")}
              disabled={Boolean(saving) || !title.trim()}
            >
              {saving === "published" ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      )}
      {!expanded && status && <p className={`eac-hs-status${status.error ? " is-error" : ""}`}>{status.text}</p>}
    </section>
  );
}
