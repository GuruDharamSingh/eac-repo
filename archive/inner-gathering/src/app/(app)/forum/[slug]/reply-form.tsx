"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "../forum.module.css";

interface ReplyFormProps {
  threadSlug: string;
  parentReplyId?: string | null;
  placeholder?: string;
  onCancel?: () => void;
}

export function ReplyForm({
  threadSlug,
  parentReplyId = null,
  placeholder = "Add to the conversation…",
  onCancel,
}: ReplyFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (content.trim().length < 1) {
      setError("Please write something before posting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/forum/threads/${encodeURIComponent(threadSlug)}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, parentReplyId }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not post reply.");
      }
      setContent("");
      router.refresh();
      onCancel?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not post reply.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        maxLength={4000}
        required
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.formRow}>
        <button type="submit" className={styles.newThreadBtn} disabled={submitting}>
          {submitting ? "Posting…" : parentReplyId ? "Post reply" : "Add comment"}
        </button>
        {onCancel && (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
