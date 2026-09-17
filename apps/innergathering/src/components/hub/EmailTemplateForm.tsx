"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The simple path: type what this organisation wants said.
 *
 * Deliberately one textarea. The network supplies the structure — the
 * confirmation, the cards, the footer — and what an org actually wants to add
 * is a paragraph in its own voice. Anything more than that is what the layout
 * editor is for, linked below rather than crowded in here.
 */
export function EmailTemplateForm({
  templateKey,
  initialBodyText,
  hint,
  hasOwnLayout,
  editHref,
  saveEndpoint,
  testEndpoint,
}: {
  templateKey: string;
  initialBodyText: string;
  hint: string;
  hasOwnLayout: boolean;
  editHref: string;
  saveEndpoint: string;
  testEndpoint: string;
}) {
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setBusy("save");
    setStatus(null);
    try {
      const res = await fetch(saveEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? "Saved. Reload to see the preview update." : (data.error ?? "Could not save."));
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    setStatus(null);
    try {
      const res = await fetch(testEndpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? `Sent to ${data.to}.` : (data.error ?? "Could not send."));
    } catch {
      setStatus("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Your words
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>

      <textarea
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        rows={10}
        maxLength={8000}
        placeholder="Leave this empty to send only the words the network supplies."
        className="mt-3 w-full rounded border border-border bg-background p-3 text-sm leading-relaxed"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={Boolean(busy)}
          className="rounded border border-border px-4 py-2 text-sm"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={Boolean(busy)}
          className="rounded border border-border px-4 py-2 text-sm"
        >
          {busy === "test" ? "Sending…" : "Send it to me"}
        </button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>

      <p className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
        {hasOwnLayout
          ? "This organisation has laid this letter out itself, so the words above are not what sends."
          : "Want to lay the whole letter out yourself?"}{" "}
        <Link href={editHref} className="underline underline-offset-4">
          Open the layout editor
        </Link>
        {" — "}it replaces the body; the header, footer and unsubscribe stay.
      </p>
      <input type="hidden" value={templateKey} readOnly />
    </div>
  );
}
