"use client";

import * as React from "react";
import { RichText } from "@elkdonis/blocks";
import { ago, useFlash, useNow } from "./live.client";
import type { WireDiscussion } from "@/lib/article-data";

// ============================================================================
// The discussion under an article: the forum thread's replies, kept fresh.
//
// Polls /api/auction/discussion every few seconds while the tab is visible.
// Replying is on the forum itself ("Join the discussion" opens the thread
// there), where sign-in, the editor and moderation already are; this block
// only shows what is being said. Display names only, never emails.
// ============================================================================

const SAMPLE_AT = "2026-10-24T18:00:00.000Z";
export const SAMPLE_DISCUSSION: WireDiscussion = {
  threadId: "sample",
  forumHref: "#",
  replyCount: 3,
  replies: [
    { id: "r1", parentId: null, authorName: "A member", html: "<p>The colour in the second lot is remarkable.</p>", at: new Date(Date.parse(SAMPLE_AT) - 4 * 60000).toISOString() },
    { id: "r2", parentId: null, authorName: "Another member", html: "<p>Does anyone know how it was framed?</p>", at: new Date(Date.parse(SAMPLE_AT) - 31 * 60000).toISOString() },
  ],
};

export function DiscussionView({
  discussion,
  heading = "Discussion",
  limit = 8,
  refresh = 10,
  joinLabel = "Join the discussion",
  emptyMessage = "No replies yet. Start the conversation on the forum.",
}: {
  discussion?: WireDiscussion | null;
  heading?: string;
  limit?: number;
  refresh?: number;
  joinLabel?: string;
  emptyMessage?: string;
}) {
  const [data, setData] = React.useState<WireDiscussion | null>(discussion ?? null);
  const [skew, setSkew] = React.useState(0);
  const sample = discussion?.threadId === "sample";
  const t = useNow(skew);

  React.useEffect(() => {
    setData(discussion ?? null);
    if (sample) setSkew(Date.parse(SAMPLE_AT) - Date.now());
  }, [discussion, sample]);

  const id = data?.threadId;
  React.useEffect(() => {
    if (!id || sample) return;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/auction/discussion?thread=${encodeURIComponent(id)}&limit=${limit}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const body = (await res.json()) as { now: string; discussion: WireDiscussion | null };
        if (body.discussion) {
          setData(body.discussion);
          setSkew(Date.parse(body.now) - Date.now());
        }
      } catch {
        // keep what is shown
      }
    };
    const timer = window.setInterval(tick, Math.max(5, refresh) * 1000);
    const onVisible = () => !document.hidden && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id, limit, refresh, sample]);

  const flash = useFlash(data?.replyCount);
  if (!data) {
    return <p className="m-0 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">The discussion appears here once this piece has a forum thread.</p>;
  }
  return (
    <section aria-label={heading || "Discussion"}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="m-0 font-serif text-2xl">
          {heading}{" "}
          <span className={`font-sans text-sm text-muted-foreground transition-colors ${flash ? "text-[hsl(var(--live))]" : ""}`}>
            {data.replyCount} {data.replyCount === 1 ? "reply" : "replies"}
          </span>
        </h2>
        <a
          href={data.forumHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground no-underline transition hover:opacity-90"
        >
          {joinLabel}
        </a>
      </div>
      {data.replies.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ol className="m-0 grid list-none gap-3 p-0">
          {data.replies.map((r) => (
            <li key={r.id} className="m-0 rounded-lg border border-border bg-card p-4 text-card-foreground">
              <div className="mb-1 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.authorName}</span>
                <time dateTime={r.at}>{ago(t - Date.parse(r.at))}</time>
              </div>
              <RichText body={r.html} className="text-sm leading-relaxed [&_p]:m-0 [&_p+p]:mt-2" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
