import Link from "next/link";
import { RichText } from "@elkdonis/ui";
import {
  getActiveWorkQuestion,
  listAnonymousReflections,
} from "@/lib/forum";
import styles from "../forum.module.css";

export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AnonymousReflectionsPage() {
  const [question, reflections] = await Promise.all([
    getActiveWorkQuestion(),
    listAnonymousReflections(),
  ]);

  return (
    <main className={styles.shellCream}>
      <div className={styles.container}>
        <p className={styles.crumbs}>
          <Link href="/forum">← Forum</Link>
        </p>

        <div className={styles.anonHeader}>
          <p className={styles.eyebrow}>Anonymous Reflections</p>
          <h1 className={styles.threadHeading}>
            {question?.question ?? "What is art for?"}
          </h1>
          <p className={styles.anonIntro}>
            Write your Thoughts and sign your name, or not.
          </p>
          <hr className={styles.rule} aria-hidden="true" />
          <p className={styles.anonCount}>
            {reflections.length}{" "}
            {reflections.length === 1 ? "reflection" : "reflections"} so far
          </p>
        </div>

        {reflections.length === 0 ? (
          <p className={styles.empty}>
            No reflections yet. The first will appear here when someone answers.
          </p>
        ) : (
          <ul className={styles.anonList}>
            {reflections.map((r) => (
              <li key={r.id} className={styles.anonItem}>
                <RichText
                  html={r.text}
                  className={`${styles.anonText} ${styles.richText}`}
                />
                <p className={styles.anonMeta}>
                  <span
                    className={styles.anonSource}
                    data-source={r.source}
                    aria-label={`Source: ${r.source}`}
                  >
                    {r.source === "landing" ? "from the entrance" : "from the gathering"}
                  </span>
                  <span className={styles.dot} aria-hidden="true" />
                  <time dateTime={new Date(r.createdAt).toISOString()}>
                    {formatDate(r.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
