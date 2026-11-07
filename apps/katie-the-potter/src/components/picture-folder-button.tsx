"use client";

import { useState, useTransition } from "react";
import { finishPictureFolderAction } from "@/lib/claim-actions";

/** "Finish setting up your picture folder" (see picture-folder-notice.tsx). */
export function PictureFolderButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span style={{ display: "inline-flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className="ktp-btn"
        disabled={pending || Boolean(msg?.ok)}
        onClick={() =>
          start(async () => {
            const r = await finishPictureFolderAction().catch(() => null);
            setMsg(r ? { ok: r.ok, text: r.message } : { ok: false, text: "That didn't work. Please try again." });
          })
        }
      >
        {pending ? "Setting up…" : "Finish setting up your picture folder"}
      </button>
      {msg ? (
        <span className="ktp-m-msg" data-ok={msg.ok ? "true" : undefined} role="status">
          {msg.text}
        </span>
      ) : null}
    </span>
  );
}
