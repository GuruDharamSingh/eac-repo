"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SeriesReply } from "@elkdonis/commerce/server";
import { followSeriesAction, replySeriesAction } from "./actions";

// The series page's discussion (the mirror thread's replies) and "Follow this
// series" (a subscription on that thread), after the developer's template.

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export function SrsDiscussion({ slug, signedIn, viewerName, published, forumHref, replies, replyCount, following, followerCount }: {
  slug: string;
  signedIn: boolean;
  viewerName: string | null;
  published: boolean;
  forumHref: string | null;
  replies: SeriesReply[];
  replyCount: number;
  following: boolean;
  followerCount: number;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [isFollowing, setFollowing] = React.useState(following);
  const [count, setCount] = React.useState(followerCount);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    const r = await replySeriesAction(slug, text);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not post.");
    setText("");
    router.refresh();
  }
  async function follow() {
    setBusy(true);
    const r = await followSeriesAction(slug, !isFollowing);
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Could not follow.");
    setFollowing(Boolean(r.following));
    setCount((c) => c + (r.following ? 1 : -1));
    toast.success(r.following ? "You follow this series." : "You no longer follow this series.");
  }

  return (
    <section id="discussion" className="srs-discussion">
      <div className="srs-col-main">
        <div className="srs-sechead" style={{ marginBottom: 18 }}>
          <h2 className="srs-h2">Discussion</h2>
          {forumHref && <a href={forumHref} className="srs-more">Open in the forum →</a>}
        </div>
        {!published ? (
          <p className="srs-note">The discussion opens when the series is published.</p>
        ) : (
          <>
            <p className="srs-note">Posts here appear in the forum under Auction series.</p>
            {signedIn ? (
              <form className="srs-compose" onSubmit={post}>
                <label htmlFor="series-comment">Add to the discussion</label>
                <textarea id="series-comment" className="srs-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What caught your eye in this series?" maxLength={20000} />
                <div className="srs-compose-foot">
                  <span>{viewerName ? `Posting as ${viewerName}` : "Signed in"}</span>
                  <button type="submit" className="srs-post" disabled={busy || !text.trim()}>Post</button>
                </div>
              </form>
            ) : (
              <p className="srs-note"><Link href={`/login?next=/series/${slug}`} style={{ textDecoration: "underline" }}>Sign in</Link> to add to the discussion.</p>
            )}
            {replies.length === 0 ? (
              <p className="srs-note">No posts yet.</p>
            ) : (
              <ol className="srs-replies">
                {replies.map((r) => (
                  <li key={r.id}>
                    <span className="srs-reply-avatar" aria-hidden="true">{r.authorName.slice(0, 1)}</span>
                    <div style={{ minWidth: 0 }}>
                      <p className="srs-reply-meta"><strong>{r.authorName}</strong> · {ago(r.at)}</p>
                      <div className="srs-reply-body" dangerouslySetInnerHTML={{ __html: r.html }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {replyCount > replies.length && forumHref && (
              <p className="srs-note" style={{ marginTop: 14 }}><a href={forumHref} style={{ textDecoration: "underline" }}>All {replyCount} posts in the forum →</a></p>
            )}
          </>
        )}
      </div>
      <aside id="follow" className="srs-follow">
        <h2>Follow this series</h2>
        <p>A short email when new lots go up, and a reminder before the live auction.{count > 0 ? ` ${count} following.` : ""}</p>
        {signedIn ? (
          <button type="button" className={`srs-btn ${isFollowing ? "is-light" : "is-ghost"}`} disabled={busy || !published} onClick={follow}>
            {isFollowing ? "Following ✓" : "Follow"}
          </button>
        ) : (
          <Link href={`/login?next=/series/${slug}`} className="srs-btn is-ghost">Sign in to follow</Link>
        )}
        {!published && <p style={{ marginTop: 12, fontSize: 13 }}>Available once the series is published.</p>}
      </aside>
    </section>
  );
}
