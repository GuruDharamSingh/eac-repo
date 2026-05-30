"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pin } from "lucide-react";
import type { ForumThreadSummary } from "@/lib/forum";
import styles from "./forum.module.css";

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

export function ThreadCard({
  thread,
  canModerate,
}: {
  thread: ForumThreadSummary;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(thread.pinned);
  const [busy, setBusy] = useState(false);

  async function togglePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !pinned;
    setPinned(next); // optimistic
    try {
      const res = await fetch(
        `/api/forum/threads/${encodeURIComponent(thread.slug)}/pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: next }),
        }
      );
      if (!res.ok) throw new Error("Pin failed");
      router.refresh();
    } catch {
      setPinned(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`${styles.threadCard} ${pinned ? styles.threadCardPinned : ""}`}
    >
      <Link href={`/forum/${thread.slug}`} className={styles.threadCardLink}>
        <div className={styles.threadCardHead}>
          {pinned && (
            <span className={styles.pinBadge} aria-label="Pinned">
              <Pin size={12} />
              <span>Pinned</span>
            </span>
          )}
          <h3 className={styles.threadTitle}>{thread.title}</h3>
        </div>
        {thread.excerpt && (
          <p className={styles.threadExcerpt}>
            {thread.excerpt}
            {thread.excerpt.length >= 200 ? "…" : ""}
          </p>
        )}
        <div className={styles.threadMeta}>
          <span className={styles.threadMetaAuthor}>{thread.authorName}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>{formatRelative(thread.createdAt)}</span>
          <span className={styles.dot} aria-hidden="true" />
          <span>
            {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
          </span>
        </div>
        {thread.lastReply && (
          <p className={styles.lastReply}>
            <span className={styles.lastReplyArrow} aria-hidden="true">↳</span>
            <span
              className={styles.lastReplyAuthor}
              style={
                thread.lastReply.commentColor
                  ? { color: thread.lastReply.commentColor }
                  : undefined
              }
            >
              {thread.lastReply.userName}
            </span>
            <span className={styles.lastReplyTime}>
              {formatRelative(thread.lastReply.createdAt)}
            </span>
            <span className={styles.lastReplyText}>
              {" — "}
              {thread.lastReply.excerpt}
              {thread.lastReply.excerpt.length >= 120 ? "…" : ""}
            </span>
          </p>
        )}
      </Link>
      {canModerate && (
        <button
          type="button"
          className={`${styles.pinBtn} ${pinned ? styles.pinBtnActive : ""}`}
          onClick={togglePin}
          disabled={busy}
          aria-pressed={pinned}
          aria-label={pinned ? "Unpin thread" : "Pin thread"}
          title={pinned ? "Unpin thread" : "Pin thread"}
        >
          <Pin size={14} />
        </button>
      )}
    </article>
  );
}
