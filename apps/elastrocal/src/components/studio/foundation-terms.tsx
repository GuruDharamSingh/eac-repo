"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { termPagesText } from "@elkdonis/astro-corpus";
import type { FoundationCatalogueView, TermEntry } from "@elkdonis/astro-corpus/server";
import { foundationReviewAction, type FoundationReviewInput } from "@/app/hub/studio/foundations/actions";
import { cn } from "@/lib/utils";
import { useFoundationUndo } from "@/components/studio/use-foundation-undo";
import { GROUP_LABEL, TERM_FACET_LABEL, label } from "@/components/studio/foundation-labels";

/**
 * One book's basic terms, grouped (elements, modes, aspects, …). For each
 * term the owner says whether the AI got it Right, it Needs fixing, or it is
 * Not a basic term; clicks a keyword to strike it (again to put it back);
 * adds keywords of his own; and can leave a note. Every action shows a toast
 * with Undo. Keys on the highlighted term: ↓/j ↑/k move, 1 2 3 mark, u undo.
 */

const VERDICTS = [
  { key: "right", label: "Right", title: "The AI read this term correctly", on: "border-primary bg-primary text-primary-foreground" },
  { key: "fix", label: "Needs fixing", title: "A real term, but something here is wrong: say what in the note", on: "border-gold bg-gold/20 text-foreground" },
  { key: "not-basic", label: "Not a basic term", title: "Leave it out of the basics", on: "border-destructive bg-destructive/15 text-destructive" },
] as const;
const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Unchecked" },
  { key: "right", label: "Right" },
  { key: "fix", label: "Needs fixing" },
  { key: "not-basic", label: "Not basic" },
] as const;

export function FoundationTerms({ catalogue, history }: { catalogue: FoundationCatalogueView; history: { reviewId: string; label: string }[] }) {
  const router = useRouter();
  const notify = useFoundationUndo();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string | null>>({});
  useEffect(() => setLocal({}), [catalogue]);

  const verdictOf = (t: TermEntry) => (t.id in local ? local[t.id] : t.verdict);
  const shown = catalogue.terms.filter((t) => filter === "all" || (filter === "open" ? !verdictOf(t) : verdictOf(t) === filter));
  const groups = [...new Set(catalogue.terms.map((t) => t.group))];
  const rows = groups.flatMap((g) => shown.filter((t) => t.group === g));
  const count = (f: string) => catalogue.terms.filter((t) => (f === "all" ? true : f === "open" ? !verdictOf(t) : verdictOf(t) === f)).length;

  const send = (action: FoundationReviewInput["action"], payload: Record<string, unknown>, message: string) =>
    startTransition(async () => {
      const r = await foundationReviewAction({ action, payload });
      if (!r.ok) {
        toast.error(r.error);
        setLocal({});
      } else if (action !== "foundation-undo") notify(message, r.reviewId);
      else toast("Undone");
      router.refresh();
    });
  const mark = (t: TermEntry, v: string) => {
    const next = verdictOf(t) === v ? "clear" : v;
    setLocal((l) => ({ ...l, [t.id]: next === "clear" ? null : next }));
    send("foundation-term-verdict", { termId: t.id, verdict: next }, next === "clear" ? `“${t.term}”: mark removed` : `“${t.term}”: ${VERDICTS.find((x) => x.key === next)!.label}`);
  };
  const undo = (reviewId?: string) => {
    const id = reviewId ?? history[0]?.reviewId;
    if (id) send("foundation-undo", { reviewId: id }, "");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "u") return undo();
      const at = rows.findIndex((r) => r.id === cursor);
      const go = (i: number) => {
        const next = rows[Math.max(0, Math.min(rows.length - 1, i))];
        if (!next) return;
        setCursor(next.id);
        document.getElementById(`t-${next.id}`)?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(at + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(at < 0 ? 0 : at - 1);
      } else if (/^[1-3]$/.test(e.key) && at >= 0) {
        e.preventDefault();
        const v = VERDICTS[Number(e.key) - 1].key;
        if (verdictOf(rows[at]) !== v) mark(rows[at], v);
        go(at + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="mt-2">
      <h1 className="text-2xl font-semibold">{catalogue.book}</h1>
      <p className="text-sm text-muted-foreground">
        {catalogue.author ? `${catalogue.author} · ` : ""}
        {catalogue.reviewed} of {catalogue.total} terms checked
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        These are the basic terms the AI found in this book. For each one: say whether it is <b className="text-foreground">Right</b>,{" "}
        <b className="text-foreground">Needs fixing</b> or <b className="text-foreground">Not a basic term</b>. Click a keyword to cross it out if it does not belong
        (click again to bring it back). Add keywords the book uses that are missing. If something is wrong, say what in the note.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("rounded-full border px-3 py-1 text-xs", filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
          >
            {f.label} <span className="tabular-nums opacity-80">{count(f.key)}</span>
          </button>
        ))}
      </div>

      {groups.map((g) => {
        const list = shown.filter((t) => t.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {label(GROUP_LABEL, g)} <span className="tabular-nums">· {list.length}</span>
            </h2>
            <ul className="mt-2 space-y-3">
              {list.map((t) => (
                <TermCard key={t.id} term={t} verdict={verdictOf(t)} active={cursor === t.id} onFocus={() => setCursor(t.id)} onMark={(v) => mark(t, v)} send={send} />
              ))}
            </ul>
          </section>
        );
      })}

      <div className="sticky bottom-3 z-10 mt-8 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={history.length === 0} onClick={() => undo()} className="rounded-xl border border-gold/70 px-4 py-2 text-sm hover:bg-gold/10 disabled:opacity-40">
            ↶ Undo <kbd className="ml-1 text-[10px] text-muted-foreground">u</kbd>
          </button>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{history[0] ? `Undo would take back: ${history[0].label}` : "Nothing to undo yet."}</span>
          <span className="text-xs text-muted-foreground">{pending ? "Saving…" : ""}</span>
        </div>
        {history.length > 1 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer select-none text-xs text-muted-foreground">Last {history.length} actions</summary>
            <ul className="mt-2 space-y-1">
              {history.map((h) => (
                <li key={h.reviewId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs">{h.label}</span>
                  <button type="button" onClick={() => undo(h.reviewId)} className="shrink-0 rounded-lg border border-border px-2 py-0.5 text-[11px] hover:border-primary/60">
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">Keys: click a term, then ↓ ↑ move · 1 Right · 2 Needs fixing · 3 Not a basic term · u undo</p>
      </div>
    </div>
  );
}

function TermCard({
  term: t,
  verdict,
  active,
  onFocus,
  onMark,
  send,
}: {
  term: TermEntry;
  verdict: string | null;
  active: boolean;
  onFocus: () => void;
  onMark: (v: string) => void;
  send: (action: FoundationReviewInput["action"], payload: Record<string, unknown>, message: string) => void;
}) {
  const [adding, setAdding] = useState("");
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(t.note ?? "");
  const saved = useRef(t.note ?? "");
  const facet = t.facet ? (TERM_FACET_LABEL[t.facet] ?? t.facet) : "";
  const pages = termPagesText(t.pages, t.bookPages);
  const keyword = (k: string, keep: boolean) => send("foundation-term-keyword", { termId: t.id, keyword: k, keep }, `“${t.term}”: keyword “${k.slice(0, 40)}” ${keep ? "kept" : "dropped"}`);
  const add = () => {
    const k = adding.trim();
    if (!k) return;
    send("foundation-term-add-keyword", { termId: t.id, keyword: k }, `“${t.term}”: added keyword “${k}”`);
    setAdding("");
  };
  const chip = (k: string, state: "kept" | "dropped" | "yours") => (
    <button
      key={`${state}-${k}`}
      type="button"
      onClick={() => keyword(k, state === "dropped")}
      title={state === "dropped" ? "Crossed out. Click to bring it back" : state === "yours" ? "You added this. Click to remove it" : "Click to cross it out"}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-left text-xs",
        state === "dropped" ? "border-border text-muted-foreground line-through opacity-70" : state === "yours" ? "border-gold bg-gold/10" : "border-border hover:border-destructive/60",
      )}
    >
      {k}
      {state === "yours" && <span className="ml-1 text-[10px] text-gold">yours</span>}
    </button>
  );
  return (
    <li id={`t-${t.id}`} onClick={onFocus} className={cn("rounded-xl border border-border bg-card p-4", active && "ring-1 ring-primary/60")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold">
          {t.term}
          {facet && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{facet}</span>}
          {t.code && <span className="ml-1.5 rounded border border-border px-1 text-[10px] font-normal text-muted-foreground">{t.code}</span>}
          {t.stale && <span className="ml-1.5 text-xs font-normal text-muted-foreground">no longer in the latest reading</span>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VERDICTS.map((v, i) => (
            <button
              key={v.key}
              type="button"
              title={v.title}
              aria-pressed={verdict === v.key}
              onClick={() => onMark(v.key)}
              className={cn("rounded-full border px-2.5 py-1 text-xs", verdict === v.key ? v.on : "border-border hover:border-primary/60")}
            >
              {v.label}
              {active && <kbd className="ml-1 text-[10px] opacity-70">{i + 1}</kbd>}
            </button>
          ))}
        </div>
      </div>

      {(t.keywords.length > 0 || t.droppedKeywords.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Keywords:</span>
          {t.keywords.map((k) => chip(k, t.addedKeywords.includes(k) ? "yours" : "kept"))}
          {t.droppedKeywords.map((k) => chip(k, "dropped"))}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          maxLength={200}
          placeholder="Add a keyword"
          className="w-48 rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
        />
        {adding.trim() && (
          <button type="button" onClick={add} className="rounded-lg border border-primary px-2 py-1 text-xs text-primary">
            Add
          </button>
        )}
      </div>

      {(t.secondary.length > 0 || t.droppedSecondary.length > 0) && (
        <div className="mt-3">
          <p className="text-[11px] text-muted-foreground">Also said of it (click to cross out):</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {t.secondary.map((k) => chip(k, "kept"))}
            {t.droppedSecondary.map((k) => chip(k, "dropped"))}
          </div>
        </div>
      )}
      {t.definition && (
        <p className="mt-3 text-sm leading-relaxed">
          <span className="text-[11px] text-muted-foreground">What it is: </span>
          {t.definition}
        </p>
      )}
      {t.howToWeigh && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="text-[11px] text-muted-foreground">How it is counted: </span>
          {t.howToWeigh}
        </p>
      )}
      {t.figure && (
        <p className="mt-2 text-sm leading-relaxed">
          <span className="text-[11px] text-muted-foreground">Diagram in the book: </span>
          {t.figure}
        </p>
      )}
      {t.related.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Goes with: {t.related.join(" · ")}</p>}
      {t.quote && (
        <blockquote className="mt-3 border-l-2 border-gold/60 pl-3 text-sm leading-relaxed text-muted-foreground">
          “{t.quote}”{pages && <span className="mt-0.5 block text-[11px]">— {pages}</span>}
        </blockquote>
      )}
      {!t.quote && pages && <p className="mt-2 text-[11px] text-muted-foreground">{pages}</p>}
      {t.bookNote && <p className="mt-2 text-[11px] text-muted-foreground">The AI’s remark: {t.bookNote}</p>}

      <div className="mt-3 text-xs">
        {!noting ? (
          <p>
            {t.note && <span className="italic text-muted-foreground">Your note: “{t.note}” </span>}
            <button type="button" onClick={() => setNoting(true)} className="text-primary">
              {t.note ? "Edit note" : "Add a note"}
            </button>
          </p>
        ) : (
          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
              autoFocus
              placeholder="What is wrong, or what should it say?"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={note.trim() === saved.current}
                onClick={() => {
                  send("foundation-term-note", { termId: t.id, note }, note.trim() ? `“${t.term}”: note saved` : `“${t.term}”: note removed`);
                  saved.current = note.trim();
                  setNoting(false);
                }}
                className="rounded-lg border border-primary px-3 py-1 text-primary disabled:opacity-40"
              >
                Save note
              </button>
              <button type="button" onClick={() => setNoting(false)} className="text-muted-foreground">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
