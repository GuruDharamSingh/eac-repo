"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import styles from "../forum.module.css";

export function ThreadDeleteButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (!window.confirm("Delete this thread? This removes it from the forum.")) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/forum/threads/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      router.push("/forum");
      router.refresh();
    } catch {
      setBusy(false);
      window.alert("Could not delete the thread.");
    }
  }

  return (
    <button
      type="button"
      className={styles.moderateDeleteBtn}
      onClick={remove}
      disabled={busy}
      aria-label="Delete thread"
      title="Delete thread"
    >
      <Trash2 size={14} />
    </button>
  );
}
