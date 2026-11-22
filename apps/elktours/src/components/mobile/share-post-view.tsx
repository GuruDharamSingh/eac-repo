"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Chip, PrimaryButton } from "@/components/mobile";
import { Field, FormTop } from "./board-bits";
import { submitFeedPostAction } from "@/lib/feed-actions";

// Screen 39, Share a post or a link (G7b). A guide's post goes to the office first; the office's own goes straight up.
// A link post needs a web address containing a dot. Plain form over submitFeedPostAction (fixed copy).

export function SharePostView({ isOffice }: { isOffice: boolean }) {
  const [kind, setKind] = useState<"post" | "link">("post");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"pending" | "published" | null>(null);

  const ready = title.trim().length > 0 && body.trim().length > 0 && (kind === "post" || url.trim().includes("."));
  const cta = isOffice ? "Publish on Discover" : "Send to the office";

  function send() {
    setError(null);
    start(async () => {
      const r = await submitFeedPostAction({ title, body, link: kind === "link" ? url : null });
      if (!r.ok) return setError(r.error);
      setDone(r.status);
      toast.success(r.status === "pending" ? "Sent for review." : "Published on Discover.");
    });
  }

  if (done) {
    return (
      <div className="bf">
        <FormTop href="/manage" kicker="Share on Discover" title="Done" />
        <div className="bf-body">
          <h2 className="bf-h">{done === "pending" ? "Sent for review" : "Published"}</h2>
          <p className="bf-sub">
            {done === "pending"
              ? "The office reads it first. Once it is confirmed it appears in the Feed and in the forum."
              : "It is on Discover now, in the Feed and in the forum."}
          </p>
          <Link href="/feed" className="bf-dashed">See the Feed</Link>
          <button
            type="button"
            className="bf-dashed"
            onClick={() => {
              setDone(null);
              setTitle("");
              setBody("");
              setUrl("");
            }}
          >
            Share another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bf">
      <FormTop href="/manage" kicker="Share on Discover" title="A post or a link" />
      <div className="bf-body">
        <div className="bf-wrap">
          <Chip selected={kind === "post"} onClick={() => setKind("post")}>A post</Chip>
          <Chip selected={kind === "link"} onClick={() => setKind("link")}>A link</Chip>
        </div>
        <Field label="Title">
          <input className="m-field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </Field>
        {kind === "link" && (
          <Field label="Link">
            <input className="m-field" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoCapitalize="none" placeholder="example.com/page" />
          </Field>
        )}
        <Field label={kind === "link" ? "Why it is worth a look" : "Your post"}>
          <textarea className="m-field" value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <p className="bf-note">
          {isOffice
            ? "As the office, this goes straight up. Once public it appears in the Feed and as a topic in the forum."
            : "The office reads it first. Once it is confirmed it appears in the Feed and as a topic in the forum."}
        </p>
        {error && <p className="bf-err" role="alert">{error}</p>}
      </div>
      <div className="bf-bar">
        <PrimaryButton disabled={!ready || pending} onClick={send}>{pending ? "Sending…" : cta}</PrimaryButton>
      </div>
    </div>
  );
}
