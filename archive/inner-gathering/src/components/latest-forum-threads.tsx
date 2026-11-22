"use client";

import Link from "next/link";
import { MessageSquare, Pin } from "lucide-react";
import type { ForumThreadSummary } from "@/lib/forum";
import { HorizontalCarousel } from "./horizontal-carousel";

function formatRelative(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ms < minute) return "just now";
  if (ms < hour) return `${Math.floor(ms / minute)}m ago`;
  if (ms < day) return `${Math.floor(ms / hour)}h ago`;
  if (ms < 30 * day) return `${Math.floor(ms / day)}d ago`;
  return new Date(date).toLocaleDateString();
}

export function LatestForumThreads({ threads }: { threads: ForumThreadSummary[] }) {
  // Anyone can post — signed in or not. Empty state still offers the CTA.
  if (threads.length === 0) {
    return (
      <section className="feed-carousel">
        <header className="feed-carousel__header">
          <div className="feed-carousel__heading">
            <p className="feed-carousel__kicker">From the forum</p>
            <h3 className="feed-carousel__title">Latest threads</h3>
          </div>
          <div className="feed-carousel__controls">
            <Link href="/forum/new" className="feed-carousel__all-link">
              Start a thread
            </Link>
          </div>
        </header>
        <p style={{ margin: "0.5rem 0 0", opacity: 0.7, fontSize: "0.9rem" }}>
          No threads yet — be the first to begin one. You can post anonymously.
        </p>
      </section>
    );
  }

  return (
    <HorizontalCarousel
      kicker="From the forum"
      title="Latest threads"
      count={threads.length}
      headerRight={
        <>
          <Link href="/forum/new" className="feed-carousel__all-link">
            Start a thread
          </Link>
          <Link href="/forum" className="feed-carousel__all-link">
            View all
          </Link>
        </>
      }
    >
      {threads.map((t) => (
        <Link
          key={t.id}
          href={`/forum/${t.slug}`}
          className="feed-carousel-item forum-mini-card"
        >
          <div className="forum-mini-card__head">
            {t.pinned && (
              <span className="forum-mini-card__pin" aria-label="Pinned">
                <Pin size={11} />
                Pinned
              </span>
            )}
            <h4 className="forum-mini-card__title">{t.title}</h4>
          </div>
          {t.excerpt && (
            <p className="forum-mini-card__excerpt">
              {t.excerpt.slice(0, 140)}
              {t.excerpt.length > 140 ? "…" : ""}
            </p>
          )}
          <div className="forum-mini-card__meta">
            <span className="forum-mini-card__author">{t.authorName}</span>
            <span className="forum-mini-card__dot" aria-hidden="true" />
            <span>{formatRelative(t.createdAt)}</span>
            <span className="forum-mini-card__dot" aria-hidden="true" />
            <span className="forum-mini-card__replies">
              <MessageSquare size={11} />
              {t.replyCount}
            </span>
          </div>
        </Link>
      ))}
    </HorizontalCarousel>
  );
}
