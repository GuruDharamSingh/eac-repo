"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { failToast } from "./fail-toast";
import { FormTop } from "./board-bits";
import { reviewFeedPostAction } from "@/lib/feed-actions";

// Posts to confirm (Board screen 30, office). A phone list of guides' feed posts waiting for the office:
// Put on Discover (approve) or Decline, through reviewFeedPostAction. Owners only; the page checks.

export interface ReviewPost {
  id: string;
  kind: "post" | "link";
  title: string;
  excerpt: string | null;
  author: string | null;
  host: string | null;
  linkUrl: string | null;
  createdAt: string;
}

export function FeedReviewView({ posts, isOwner }: { posts: ReviewPost[]; isOwner: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function decide(id: string, d: "approve" | "decline") {
    setBusy(id);
    start(async () => {
      const r = await reviewFeedPostAction(id, d);
      setBusy(null);
      if (!r.ok) return void failToast(r.error);
      toast.success(d === "approve" ? "Put on Discover." : "Declined.");
      router.refresh();
    });
  }

  return (
    <div className="bf">
      <FormTop href="/manage" kicker="Manage" title="Posts to confirm" />
      <div className="bf-body">
        {!isOwner && <p className="bf-note">Only the office confirms posts. You can read the queue.</p>}
        {posts.length === 0 && <p className="bf-note">Nothing waiting.</p>}
        {posts.map((p) => (
          <div key={p.id} className="bf-card">
            <span className="bf-pill">{p.kind === "link" ? "A link" : "A post"}</span>
            <h3>{p.title}</h3>
            <p className="bf-meta">
              From {p.author ?? "a guide"} ·{" "}
              {new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(p.createdAt))}
            </p>
            {p.excerpt && <p>{p.excerpt}</p>}
            {p.linkUrl && (
              <a className="bf-link" href={p.linkUrl} target="_blank" rel="noopener noreferrer">{p.host ?? p.linkUrl} ↗</a>
            )}
            {isOwner && (
              <div className="bf-actions">
                <button type="button" className="bf-btn-fill" disabled={pending && busy === p.id} onClick={() => decide(p.id, "approve")}>Put on Discover</button>
                <button type="button" className="bf-btn-line" disabled={pending && busy === p.id} onClick={() => decide(p.id, "decline")}>Decline</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
