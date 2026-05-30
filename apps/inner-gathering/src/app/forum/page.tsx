import Link from "next/link";
import { EyeOff } from "lucide-react";
import { getServerSession } from "@elkdonis/auth-server";
import {
  canModerateForum,
  getActiveWorkQuestion,
  getAnonymousReflectionsSummary,
  listForumThreads,
} from "@/lib/forum";
import styles from "./forum.module.css";
import { ThreadCard } from "./thread-card";

export const dynamic = "force-dynamic";

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

export default async function ForumPage() {
  const [session, question, threads, anon] = await Promise.all([
    getServerSession(),
    getActiveWorkQuestion(),
    listForumThreads(),
    getAnonymousReflectionsSummary(),
  ]);

  const isAuthed = !!session?.user;
  const canModerate = isAuthed ? await canModerateForum(session!.user.id) : false;

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <p className={styles.eyebrow}>Current Work Question</p>
        <h1 className={styles.question}>
          {question?.question ?? "What is art for?"}
        </h1>
        <hr className={styles.rule} aria-hidden="true" />

        <div className={styles.header}>
          <h2 className={styles.headerTitle}>
            {threads.length === 0
              ? "Be the first to begin a thread."
              : `${threads.length} thread${threads.length === 1 ? "" : "s"}`}
          </h2>
          {isAuthed ? (
            <Link href="/forum/new" className={styles.newThreadBtn}>
              Start a thread
            </Link>
          ) : (
            <Link href="/login?next=/forum/new" className={styles.secondaryBtn}>
              Sign in to post
            </Link>
          )}
        </div>

        <Link href="/forum/anonymous" className={styles.anonCard}>
          <div className={styles.anonCardHead}>
            <span className={styles.anonBadge}>
              <EyeOff size={12} />
              <span>Anonymous Thread</span>
            </span>
            <h3 className={styles.anonCardTitle}>Reflections from passing voices</h3>
          </div>
          <p className={styles.anonCardBody}>
            Every anonymous answer to this question — from the landing page and
            from members&rsquo; feed — gathered here without names.
          </p>
          <div className={styles.threadMeta}>
            <span>
              {anon.count} {anon.count === 1 ? "reflection" : "reflections"}
            </span>
            {anon.latest && (
              <>
                <span className={styles.dot} aria-hidden="true" />
                <span>last {formatRelative(anon.latest.createdAt)}</span>
              </>
            )}
          </div>
          {anon.latest && (
            <p className={styles.anonCardLatest}>
              <span className={styles.lastReplyArrow} aria-hidden="true">↳</span>
              <span className={styles.lastReplyText}>
                &ldquo;{anon.latest.text.slice(0, 140)}
                {anon.latest.text.length > 140 ? "…" : ""}&rdquo;
              </span>
            </p>
          )}
        </Link>

        {threads.length === 0 ? (
          <p className={styles.empty}>
            No member threads yet. Be the first to begin one.
          </p>
        ) : (
          <ul className={styles.threadList}>
            {threads.map((t) => (
              <li key={t.id}>
                <ThreadCard thread={t} canModerate={canModerate} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
