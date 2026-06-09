import Link from "next/link";
import { getActiveWorkQuestion } from "@/lib/forum";
import styles from "../forum.module.css";
import { NewThreadForm } from "./new-thread-form";

export const dynamic = "force-dynamic";

export default async function NewThreadPage() {
  // Open to everyone — signed-out visitors post as a stable anonymous guest.
  const question = await getActiveWorkQuestion();

  return (
    <main className={styles.shell}>
      <div className={styles.container}>
        <p className={styles.crumbs}>
          <Link href="/forum">← Forum</Link>
        </p>
        <p className={styles.eyebrow}>Current Work Question</p>
        <h1 className={styles.question}>
          {question?.question ?? "What is art for?"}
        </h1>
        <hr className={styles.rule} aria-hidden="true" />
        <NewThreadForm />
      </div>
    </main>
  );
}
