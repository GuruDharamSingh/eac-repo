import Link from "next/link";
import { notFound } from "next/navigation";
import { Pin } from "lucide-react";
import { getServerSession } from "@elkdonis/auth-server";
import {
  canModerateForum,
  getForumThread,
  getRepliesFlat,
} from "@/lib/forum";
import styles from "../forum.module.css";
import { RepliesThread } from "./replies-thread";
import { ThreadPinButton } from "./thread-pin-button";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [session, thread] = await Promise.all([
    getServerSession(),
    getForumThread(slug),
  ]);

  if (!thread) {
    notFound();
  }

  const replies = await getRepliesFlat(thread.id);
  const isAuthed = !!session?.user;
  const canModerate = isAuthed ? await canModerateForum(session!.user.id) : false;

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <p className={styles.crumbs}>
          <Link href="/forum">← Forum</Link>
        </p>

        <div className={styles.threadHeadingRow}>
          {thread.pinned && (
            <span className={styles.pinBadge} aria-label="Pinned">
              <Pin size={12} />
              <span>Pinned</span>
            </span>
          )}
          <h1 className={styles.threadHeading}>{thread.title}</h1>
          {canModerate && (
            <ThreadPinButton slug={thread.slug} initialPinned={thread.pinned} />
          )}
        </div>
        <p className={styles.threadByline}>
          <span
            style={
              thread.authorCommentColor
                ? { color: thread.authorCommentColor, fontWeight: 500 }
                : { fontWeight: 500, color: "#01124E" }
            }
          >
            {thread.authorName}
          </span>{" "}
          · {formatDate(thread.createdAt)}
        </p>

        <article className={styles.threadBody}>{thread.body}</article>

        <RepliesThread
          replies={replies}
          threadSlug={thread.slug}
          isAuthed={isAuthed}
        />
      </div>
    </main>
  );
}
