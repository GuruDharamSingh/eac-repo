"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../forum.module.css";

export function NewThreadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (body.trim().length < 1) {
      setError("Please write something to begin the thread.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/forum/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not create thread.");
      }
      const data = await res.json();
      router.push(`/forum/${data.thread.slug}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create thread.");
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="thread-title">
        Title
      </label>
      <input
        id="thread-title"
        className={styles.input}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="A few words to name your thread"
        maxLength={200}
        required
      />

      <label className={styles.label} htmlFor="thread-body">
        Your thought
      </label>
      <textarea
        id="thread-body"
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Begin the conversation. What is art for, to you?"
        maxLength={8000}
        required
      />

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.formRow}>
        <button
          type="submit"
          className={styles.newThreadBtn}
          disabled={submitting}
        >
          {submitting ? "Posting…" : "Post thread"}
        </button>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
