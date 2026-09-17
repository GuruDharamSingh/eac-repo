"use client";

import { useState, type FormEvent } from "react";
import { withBase } from "@/lib/base-path";

export function SuggestForm({
  initialTitle,
  signedIn,
  mode = "book",
}: {
  initialTitle: string;
  signedIn: boolean;
  mode?: "book" | "host";
}) {
  const hosting = mode === "host";
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    const back = hosting ? "/suggest?kind=host" : `/suggest${initialTitle ? `?title=${encodeURIComponent(initialTitle)}` : ""}`;
    return (
      <div className="empty">
        <a href={withBase(`/login?next=${encodeURIComponent(back)}`)}>Sign in</a> to {hosting ? "offer to host" : "suggest a book"} — it takes a
        moment, and the same account works across the network.
      </div>
    );
  }
  if (state === "done") {
    return <div className="empty">Thank you — it&rsquo;s with the circle. <a href="/books">Back to the books.</a></div>;
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("busy");
    setError(null);
    const d = new FormData(e.currentTarget);
    const res = await fetch(withBase("/api/suggest"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, title: d.get("title"), author: d.get("author"), why: d.get("why") }),
    }).catch(() => null);
    if (res?.ok) return setState("done");
    const body = await res?.json().catch(() => ({}));
    setError(body?.error ?? "That didn't go through.");
    setState("idle");
  };

  return (
    <form className="card" onSubmit={submit} style={{ display: "grid", gap: 14, maxWidth: 560 }}>
      <label>
        <span className="eyebrow">{hosting ? "Where, or how" : "Title"}</span>
        <input name="title" required minLength={3} defaultValue={initialTitle} className="field" />
      </label>
      {!hosting && (
        <label>
          <span className="eyebrow">Author</span>
          <input name="author" className="field" />
        </label>
      )}
      <label>
        <span className="eyebrow">{hosting ? "When could you, and for how many?" : "Why this one, read aloud?"}</span>
        <textarea name="why" rows={4} className="field" />
      </label>
      {error && <p className="eyebrow" style={{ color: "var(--crimson)" }}>{error}</p>}
      <div><button className="btn btn--primary" disabled={state === "busy"}>{state === "busy" ? "Sending…" : hosting ? "Offer it" : "Suggest it"}</button></div>
    </form>
  );
}
