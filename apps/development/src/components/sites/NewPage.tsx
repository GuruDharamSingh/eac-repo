"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPageAction } from "@/lib/sites-pages-actions";

/** "New page" for the development organisation: a name, then a draft you can fill in. Nothing is live until you publish it. */
export function NewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [say, setSay] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const go = () =>
    start(async () => {
      try {
        const r = await createPageAction(title);
        setSay({ ok: r.ok, text: r.say });
        if (r.ok && r.slug) router.push(`/sites/development/${r.slug}`);
      } catch (e) {
        setSay({ ok: false, text: e instanceof Error ? e.message : "That did not work." });
      }
    });
  return (
    <div className="st-row st-newpage">
      <label className="st-field st-grow">
        <span>Name of the new page</span>
        <input type="text" value={title} maxLength={120} placeholder="For example: Test page" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && !busy && go()} />
      </label>
      <button type="button" className="st-primary" disabled={busy || !title.trim()} onClick={go}>
        New page
      </button>
      {say ? (
        <p className={say.ok ? "st-say st-ok" : "st-say st-bad"} role="status">
          {say.text}
        </p>
      ) : null}
    </div>
  );
}
