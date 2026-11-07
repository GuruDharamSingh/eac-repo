"use client";

import { useState, useTransition } from "react";
import { checkNewPageAction } from "@/lib/puck/actions";
import { NEW_PAGE_STARTS } from "@/lib/puck/starts";

/** Name a page, check the name is free, open the editor on it (as on Para Theater). */
export function NewPageForm() {
  const [name, setName] = useState("");
  const [startFrom, setStartFrom] = useState<string>(NEW_PAGE_STARTS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await checkNewPageAction(name);
          if ("error" in res) setError(res.error);
          else window.location.href = `/studio/${res.slug}?template=${startFrom}`;
        });
      }}
    >
      <label className="block text-sm font-medium" htmlFor="new-page-name">New page</label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">/</span>
        <input id="new-page-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="walking-notes" pattern="[a-z0-9]+(-[a-z0-9]+)*" required
          className="w-56 border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]" />
        <select aria-label="Start from" value={startFrom} onChange={(e) => setStartFrom(e.target.value)}
          className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[hsl(var(--primary))]">
          {NEW_PAGE_STARTS.map((o) => <option key={o.value} value={o.value}>Start from: {o.label}</option>)}
        </select>
        <button type="submit" disabled={pending} className="border border-input bg-background px-4 py-2 text-sm hover:border-[hsl(var(--primary))] disabled:opacity-60">
          {pending ? "Checking…" : "Create and open editor"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
