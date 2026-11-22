"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pin } from "lucide-react";
import styles from "../forum.module.css";

export function ThreadPinButton({
  slug,
  initialPinned,
}: {
  slug: string;
  initialPinned: boolean;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !pinned;
    setPinned(next);
    try {
      const res = await fetch(
        `/api/forum/threads/${encodeURIComponent(slug)}/pin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinned: next }),
        }
      );
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setPinned(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`${styles.pinBtn} ${pinned ? styles.pinBtnActive : ""}`}
      style={{ position: "static" }}
      onClick={toggle}
      disabled={busy}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin thread" : "Pin thread"}
      title={pinned ? "Unpin thread" : "Pin thread"}
    >
      <Pin size={14} />
    </button>
  );
}
