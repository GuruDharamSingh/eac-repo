"use client";

import * as React from "react";
import type { Quote, QuoteStatus } from "@elkdonis/services";
import {
  addQuoteAction,
  deleteQuoteAction,
  setQuoteStatusAction,
  setQuoteWeightAction,
} from "@/lib/quote-actions";

// ============================================================================
// The quote desk.
//
// One scope at a time: the collective's own lines, or one organisation's.
// Pending first, because the only thing here that needs a decision is a line
// somebody sent in from their center and nobody has read yet.
//
// The preview is the point of the page — a line is written to be read one at
// a time in a wide band, and judging it in a table row is judging the wrong
// object. So the top of the desk shows the next line exactly as the band
// draws it, and everything below is the list.
// ============================================================================

const STATUS_LABEL: Record<QuoteStatus, string> = {
  pending: "Waiting",
  published: "In the rotation",
  hidden: "Out",
};

export function QuotesManager({
  scope,
  scopeName,
  quotes,
}: {
  /** The org id, or null for the collective's own. */
  scope: string | null;
  scopeName: string;
  quotes: Quote[];
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const pending = quotes.filter((q) => q.status === "pending");
  const live = quotes.filter((q) => q.status === "published");
  const out = quotes.filter((q) => q.status === "hidden");

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const row = (q: Quote) => (
    <li
      key={q.id}
      className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"
    >
      <div className="min-w-0">
        <p className="font-serif text-lg leading-snug">{q.body}</p>
        <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
          {[q.attribution, q.source].filter(Boolean).join(" · ") || "unattributed"}
          {q.submittedByName ? ` · sent in by ${q.submittedByName}` : ""}
          {q.weight !== 0 ? ` · weight ${q.weight}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {q.status !== "published" && (
          <button
            type="button"
            disabled={busy === q.id}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => run(q.id, () => setQuoteStatusAction(q.id, scope, "published"))}
          >
            Put it in
          </button>
        )}
        {q.status === "published" && (
          <>
            <button
              type="button"
              disabled={busy === q.id}
              className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={() => run(q.id, () => setQuoteWeightAction(q.id, scope, q.weight + 5))}
              title="Sort it earlier in the rotation"
            >
              Lead with it
            </button>
            <button
              type="button"
              disabled={busy === q.id}
              className="rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              onClick={() => run(q.id, () => setQuoteStatusAction(q.id, scope, "hidden"))}
            >
              Take it out
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy === q.id}
          className="rounded-md px-3 py-1.5 text-sm text-destructive disabled:opacity-50"
          onClick={() => {
            if (confirm("Delete this line? It cannot be undone.")) {
              void run(q.id, () => deleteQuoteAction(q.id, scope));
            }
          }}
        >
          Delete
        </button>
      </div>
    </li>
  );

  const group = (title: string, note: string, list: Quote[]) =>
    list.length === 0 ? null : (
      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {title} <span className="opacity-60">· {note}</span>
        </h2>
        <ul className="space-y-2">{list.map(row)}</ul>
      </section>
    );

  return (
    <div className="space-y-10">
      {live[0] && (
        <section>
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            As the band draws it
          </h2>
          <blockquote className="mt-3 rounded-lg border border-border bg-muted/40 p-6">
            <p className="max-w-[60ch] font-serif text-2xl leading-snug">{live[0].body}</p>
            {(live[0].attribution || live[0].source) && (
              <footer className="mt-4 border-t border-border pt-2 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-muted-foreground">
                {live[0].attribution}
                {live[0].source ? <em className="ml-3 normal-case">{live[0].source}</em> : null}
              </footer>
            )}
          </blockquote>
        </section>
      )}

      <form action={addQuoteAction} className="space-y-3 rounded-lg border border-border p-5">
        <input type="hidden" name="orgId" value={scope ?? "network"} />
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Add a line to {scopeName}
        </h2>
        <label className="block">
          <span className="sr-only">The line</span>
          <textarea
            name="body"
            required
            minLength={8}
            maxLength={600}
            rows={3}
            placeholder="Something worth reading twice."
            className="w-full rounded-md border border-border bg-background p-3 font-serif text-lg"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Who said it
            </span>
            <input
              name="attribution"
              maxLength={120}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">
              Where from
            </span>
            <input
              name="source"
              maxLength={120}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          File it
        </button>
      </form>

      {group("Waiting", "sent in from someone's center", pending)}
      {group("In the rotation", "what the band is turning over", live)}
      {group("Out", "kept, but not shown", out)}

      {quotes.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {scopeName} has no lines yet. The first one you file is the one every
          center shows.
        </p>
      )}
    </div>
  );
}

export { STATUS_LABEL };
