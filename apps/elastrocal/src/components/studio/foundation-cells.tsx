"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CellView, CorrespondenceView, SubjectView } from "@elkdonis/astro-corpus/server";
import { addCorrespondenceCellAction, foundationReviewAction, type FoundationReviewInput } from "@/app/hub/studio/foundations/actions";
import { cn } from "@/lib/utils";
import { useFoundationUndo } from "@/components/studio/use-foundation-undo";
import { BALANCE_HEADING, FACET_HEADING, RULING_LABEL, SUBJECT_TYPE_LABEL, label } from "@/components/studio/foundation-labels";

/**
 * The correspondence table of the Foundations section, three ways:
 *   CorrespondenceTable  one kind of subject (signs, planets, …): subjects as
 *                        columns, categories as rows, every book's values in
 *                        the cell with a small mark saying which book.
 *   SubjectPanel         everything every book gives for one subject (Fire),
 *                        in its subsections: the thing itself, then its
 *                        balance in a chart (a lot of it / little or none).
 *   SubjectPage          the panel as a page of its own, with Undo.
 * A cell can hold several values; they are not conflicts (a traditional
 * ruler and a later addition both stand). Click a value to say Keep or
 * Wrong, fix its wording, or re-file it as traditional / a later addition.
 */

type Send = (action: FoundationReviewInput["action"], payload: Record<string, unknown>, message: string) => void;
type Book = { slug: string; book: string; author: string | null };

function useCellActions() {
  const router = useRouter();
  const notify = useFoundationUndo();
  const [pending, startTransition] = useTransition();
  const send: Send = (action, payload, message) =>
    startTransition(async () => {
      const r = await foundationReviewAction({ action, payload });
      if (!r.ok) toast.error(r.error);
      else if (action !== "foundation-undo") notify(message, r.reviewId);
      else toast("Undone");
      router.refresh();
    });
  const add = (input: { subjectType: string; subject: string; category: string; value: string; facet?: "itself" | "dominant" | "lacking" | null }) =>
    startTransition(async () => {
      const r = await addCorrespondenceCellAction(input);
      if (!r.ok) toast.error(r.error);
      else notify(`Added “${r.value.slice(0, 40)}”`, r.reviewId);
      router.refresh();
    });
  return { send, add, pending };
}

/** A one- or two-letter mark per book (E = Erlewine, M = Marks, …), for the small source tags. */
function bookMarks(books: Book[]): Map<string, string> {
  const marks = new Map<string, string>();
  for (const b of books) {
    const name = (b.author?.trim().split(/\s+/).pop() || b.book.replace(/^(our|the|a)\s+/i, "")).replace(/[^\p{L}]/gu, "") || "?";
    let mark = name.charAt(0).toUpperCase();
    if ([...marks.values()].includes(mark)) mark = name.slice(0, 2);
    marks.set(b.slug, mark);
  }
  return marks;
}

function Legend({ books, marks }: { books: Book[]; marks: Map<string, string> }) {
  if (!books.length) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>Books:</span>
      {books.map((b) => (
        <span key={b.slug}>
          <b className="rounded border border-border px-1 text-foreground">{marks.get(b.slug)}</b> {b.book}
          {b.author ? `, ${b.author}` : ""}
        </span>
      ))}
      <span>
        <b className="rounded border border-gold px-1 text-gold">you</b> added by you
      </span>
    </p>
  );
}

/** One value: what it says, which book, its scheme; click to judge or fix it. */
function Value({ v, mark, send, block }: { v: CellView; mark: string | undefined; send: Send; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(v.value);
  const what = `“${v.value.slice(0, 40)}”`;
  const verdict = (verdictKey: string, extra: Record<string, unknown> = {}) => {
    const scheme = (extra.scheme as string | undefined) ?? (v.scheme !== v.bookScheme ? (v.scheme ?? undefined) : undefined);
    const value = verdictKey === "fixed" ? ((extra.value as string | undefined) ?? v.value) : undefined;
    send("foundation-cell-verdict", { cellId: v.id, verdict: verdictKey, value, scheme }, verdictKey === "clear" ? `${what}: mark removed` : verdictKey === "fixed" ? `Changed to “${String(value).slice(0, 40)}”` : `${what}: ${verdictKey === "right" ? "kept" : "wrong"}`);
    setOpen(false);
  };
  const keepKind = v.verdict === "fixed" ? "fixed" : "right";
  return (
    <span className={cn(block ? "block" : "inline-block", "align-top")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={[v.source, v.page ? `p. ${v.page}` : null, v.derived ? "the same for every sign of this group" : null, v.bookNote, v.note].filter(Boolean).join(" · ") || undefined}
        className={cn(
          "rounded-lg border px-1.5 py-0.5 text-left text-xs leading-snug",
          v.verdict === "wrong"
            ? "border-destructive/50 text-muted-foreground line-through"
            : v.verdict === "right" || v.verdict === "fixed"
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/60",
        )}
      >
        {(v.verdict === "right" || v.verdict === "fixed") && <span className="mr-0.5 text-primary">✓</span>}
        {v.value}
        {v.degree === "extreme" && <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">too much</span>}
        {v.scheme && (
          <span className={cn("ml-1 rounded px-1 text-[10px]", v.scheme === "later addition" ? "bg-gold/20 text-foreground" : "bg-muted text-muted-foreground")}>
            {v.scheme === "later addition" ? "later addition" : "traditional"}
          </span>
        )}
        <sup className={cn("ml-1 rounded border px-0.5 text-[9px] no-underline", v.yours ? "border-gold text-gold" : "border-border text-muted-foreground")}>{v.yours ? "you" : (mark ?? "?")}</sup>
      </button>
      {v.original && <span className="ml-1 text-[10px] text-muted-foreground">was: {v.original}</span>}
      {open && (
        <span className="mt-1 block rounded-xl border border-border bg-background p-2 text-xs shadow-sm">
          <span className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => verdict(v.verdict === "right" ? "clear" : "right")} className={cn("rounded-full border px-2.5 py-0.5", v.verdict === "right" ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
              Keep
            </button>
            <button type="button" onClick={() => verdict(v.verdict === "wrong" ? "clear" : "wrong")} className={cn("rounded-full border px-2.5 py-0.5", v.verdict === "wrong" ? "border-destructive bg-destructive/15 text-destructive" : "border-border")}>
              Wrong
            </button>
            {(["traditional", "later addition"] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => v.scheme !== sc && verdict(keepKind, { scheme: sc })}
                title="File this value as the traditional one, or as a later addition (Uranus, Neptune, Pluto)"
                className={cn("rounded-full border px-2.5 py-0.5", v.scheme === sc ? "border-gold bg-gold/20" : "border-dashed border-border text-muted-foreground")}
              >
                {sc === "traditional" ? "Traditional" : "Later addition"}
              </button>
            ))}
          </span>
          <span className="mt-1.5 flex gap-1.5">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1" aria-label="Fix the wording" />
            <button type="button" disabled={!text.trim() || text.trim() === v.value} onClick={() => verdict("fixed", { value: text })} className="rounded-lg border border-primary px-2 text-primary disabled:opacity-40">
              Save fix
            </button>
          </span>
          <span className="mt-1 block text-[10px] text-muted-foreground">
            {v.source ?? (v.yours ? "Added by you" : "")}
            {v.page ? ` · p. ${v.page}` : ""}
            {v.derived ? " · the same for every sign of this group" : ""}
            {v.bookNote ? ` · The book says: ${v.bookNote}` : ""}
          </span>
        </span>
      )}
    </span>
  );
}

function AddValue({ onAdd, label: text = "+" }: { onAdd: (value: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} title="Add a value of your own" className="rounded-lg border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:border-primary/60 hover:text-primary">
        {text}
      </button>
    );
  const save = () => {
    if (value.trim()) onAdd(value.trim());
    setValue("");
    setOpen(false);
  };
  return (
    <span className="inline-flex gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setOpen(false);
        }}
        autoFocus
        maxLength={1000}
        placeholder="Your value"
        className="w-32 rounded-lg border border-border bg-background px-2 py-0.5 text-xs"
      />
      <button type="button" onClick={save} className="rounded-lg border border-primary px-1.5 text-xs text-primary">
        Add
      </button>
    </span>
  );
}

const RULINGS = [
  { key: "useful", label: "Useful", title: "Useful for readings" },
  { key: "lore", label: "Lore", title: "Lore only: keep it, but do not use it to interpret" },
  { key: "drop", label: "Drop", title: "Leave this category out" },
] as const;

function Ruling({ category, ruling, send }: { category: string; ruling: string | null; send: Send }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {RULINGS.map((r) => (
        <button
          key={r.key}
          type="button"
          title={r.title}
          aria-pressed={ruling === r.key}
          onClick={() => send("foundation-category", { category, ruling: ruling === r.key ? "clear" : r.key }, `${category}: ${ruling === r.key ? "ruling removed" : r.title.toLowerCase()}`)}
          className={cn(
            "rounded-full border px-1.5 py-px text-[10px]",
            ruling === r.key ? (r.key === "useful" ? "border-primary bg-primary text-primary-foreground" : r.key === "lore" ? "border-gold bg-gold/20" : "border-destructive bg-destructive/15 text-destructive") : "border-border text-muted-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </span>
  );
}

function UndoBar({ history, send, pending }: { history: { reviewId: string; label: string }[]; send: Send; pending: boolean }) {
  const undo = (id?: string) => {
    const reviewId = id ?? history[0]?.reviewId;
    if (reviewId) send("foundation-undo", { reviewId }, "");
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"))) return;
      if (e.key === "u") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="sticky bottom-3 z-10 mt-8 max-w-3xl rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
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
    </div>
  );
}

const SCHEME_FILTERS = [
  { key: "all", label: "All values" },
  { key: "traditional", label: "Traditional only" },
  { key: "later", label: "With later additions" },
] as const;

export function CorrespondenceTable({ view }: { view: CorrespondenceView }) {
  const { send, add, pending } = useCellActions();
  const { table } = view;
  const marks = useMemo(() => bookMarks(table.books), [table.books]);
  const [q, setQ] = useState("");
  const [scheme, setScheme] = useState<(typeof SCHEME_FILTERS)[number]["key"]>("all");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [hideDropped, setHideDropped] = useState(true);
  const [newCategory, setNewCategory] = useState("");
  const query = q.trim().toLowerCase();
  const type = table.subjectType;

  const shown = (values: CellView[]) => (scheme === "traditional" ? values.filter((v) => v.scheme !== "later addition") : values);
  const groups = table.groups
    .map((g) => ({
      ...g,
      categories: g.categories.filter(
        (c) =>
          (!query || c.category.toLowerCase().includes(query) || g.group.toLowerCase().includes(query)) &&
          (!hideDropped || c.ruling !== "drop") &&
          (scheme !== "later" || Object.values(c.cells).some((vs) => vs.some((v) => v.scheme === "later addition"))),
      ),
    }))
    .filter((g) => g.categories.length);
  const dropped = table.groups.reduce((n, g) => n + g.categories.filter((c) => c.ruling === "drop").length, 0);

  return (
    <div className="mt-3">
      <nav className="flex flex-wrap gap-1.5" aria-label="Kind of subject">
        {view.types.map((t) => (
          <Link
            key={t.type}
            href={`/hub/studio/foundations/correspondences?type=${t.type}`}
            aria-current={t.type === type ? "page" : undefined}
            className={cn("rounded-xl border px-3 py-1.5 text-sm", t.type === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/60")}
          >
            {label(SUBJECT_TYPE_LABEL, t.type)}{" "}
            <span className={cn("text-xs tabular-nums", t.type === type ? "opacity-80" : "text-muted-foreground")}>
              {t.judged}/{t.total}
            </span>
          </Link>
        ))}
      </nav>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        Each row is one kind of fact; each column is one {label(SUBJECT_TYPE_LABEL, type).toLowerCase().replace(/s$/, "")}. Click a value to say <b className="text-foreground">Keep</b> or{" "}
        <b className="text-foreground">Wrong</b>, to fix its wording, or to file it as traditional or a later addition. A cell may hold several values: they are not in conflict, each
        just shows which book gives it. Use <b className="text-foreground">+</b> to add a value of your own. Under each row name, say whether the row is{" "}
        <b className="text-foreground">Useful</b> for readings, <b className="text-foreground">Lore</b> only, or to <b className="text-foreground">Drop</b>.
      </p>
      <Legend books={table.books} marks={marks} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a row (e.g. color, tarot)" className="w-56 rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
        {SCHEME_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={scheme === f.key}
            onClick={() => setScheme(f.key)}
            className={cn("rounded-full border px-3 py-1 text-xs", scheme === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
          >
            {f.label}
          </button>
        ))}
        {dropped > 0 && (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={!hideDropped} onChange={(e) => setHideDropped(!e.target.checked)} /> Show the {dropped} dropped row{dropped === 1 ? "" : "s"}
          </label>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs">
              <th className="sticky left-0 z-10 min-w-[11rem] max-w-[13rem] bg-muted px-3 py-2 font-semibold">Row</th>
              {table.subjects.map((sub) => (
                <th key={sub} className="min-w-[9rem] max-w-[18rem] px-2 py-2 font-semibold capitalize">
                  <Link href={`/hub/studio/foundations/subject/${type}/${encodeURIComponent(sub)}`} className="hover:text-primary" title="Everything the books give for this one">
                    {sub} →
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => {
            const isClosed = closed.has(g.group) && !query;
            return (
              <tbody key={g.group}>
                <tr className="border-t border-border bg-card">
                  <td colSpan={table.subjects.length + 1} className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => setClosed((s) => (s.has(g.group) ? new Set([...s].filter((x) => x !== g.group)) : new Set([...s, g.group])))}
                      className="sticky left-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground hover:text-primary"
                    >
                      {isClosed ? "▸" : "▾"} {g.group} <span className="tabular-nums">· {g.categories.length}</span>
                    </button>
                  </td>
                </tr>
                {!isClosed &&
                  g.categories.map((c) => (
                    <tr key={c.category} className={cn("border-t border-border/60 align-top", c.ruling === "drop" && "opacity-50")}>
                      <th scope="row" className="sticky left-0 z-10 min-w-[11rem] max-w-[13rem] bg-background px-3 py-2 text-left text-xs font-medium">
                        {c.category}
                        {c.yours && <span className="ml-1 text-gold">yours</span>}
                        {c.ruling && <span className="ml-1 font-normal text-muted-foreground">· {RULING_LABEL[c.ruling]}</span>}
                        <Ruling category={c.category} ruling={c.ruling} send={send} />
                      </th>
                      {table.subjects.map((sub) => (
                        <td key={sub} className="min-w-[9rem] max-w-[18rem] px-2 py-2">
                          <span className="flex flex-wrap gap-1">
                            {shown(c.cells[sub] ?? []).map((v) => (
                              <Value key={v.id} v={v} mark={marks.get(v.bookSlug)} send={send} />
                            ))}
                            <AddValue onAdd={(value) => add({ subjectType: type, subject: sub, category: c.category, value })} />
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            );
          })}
        </table>
      </div>
      {groups.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No row matches.</p>}

      <div className="mt-4 flex max-w-xl items-center gap-2">
        <input
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          maxLength={80}
          placeholder="Add a new row, e.g. Season"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={pending || !newCategory.trim()}
          onClick={() => {
            send("foundation-category-add", { subjectType: type, category: newCategory }, `Added the row “${newCategory.trim()}”`);
            setNewCategory("");
          }}
          className="rounded-lg border border-primary px-3 py-1.5 text-sm text-primary disabled:opacity-40"
        >
          Add row
        </button>
      </div>
      <UndoBar history={view.history} send={send} pending={pending} />
    </div>
  );
}

/** Everything every book gives for one subject, in its subsections. `compact` leaves out the row rulings (for the lesson tab). */
export function SubjectPanel({ view, name, compact }: { view: SubjectView; name: string; compact?: boolean }) {
  const { send, add } = useCellActions();
  const marks = useMemo(() => bookMarks(view.books), [view.books]);
  const bookName = (slug: string) => view.books.find((b) => b.slug === slug)?.author?.split(/\s+/).pop() ?? view.books.find((b) => b.slug === slug)?.book ?? "You";
  const balance = view.facets.filter((f) => f.facet !== "itself");
  const section = (f: SubjectView["facets"][number]) => (
    <div key={f.facet} className="mt-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{f.facet === "itself" ? `${name} itself` : FACET_HEADING[f.facet]}</h4>
      <dl className="mt-1.5 space-y-2.5">
        {f.categories.map((c) => {
          const slugs = [...new Set(c.values.map((v) => (v.yours ? "owner" : v.bookSlug)))];
          const long = c.values.some((v) => v.value.length > 90);
          return (
            <div key={c.category} className={cn(c.ruling === "drop" && "opacity-50")}>
              <dt className="text-xs font-medium">
                {c.category.replace(" (list)", "")}
                {c.ruling && <span className="ml-1 font-normal text-muted-foreground">· {RULING_LABEL[c.ruling]}</span>}
                {!compact && <Ruling category={c.category} ruling={c.ruling} send={send} />}
              </dt>
              <dd className="mt-1 space-y-1">
                {slugs.map((slug) => (
                  <div key={slug} className={cn("flex gap-1.5", long ? "flex-col" : "flex-wrap items-start")}>
                    <span className="w-16 shrink-0 pt-0.5 text-[11px] text-muted-foreground">{slug === "owner" ? "You" : bookName(slug)}</span>
                    <span className={cn("flex min-w-0 flex-1 gap-1", long ? "flex-col" : "flex-wrap")}>
                      {c.values
                        .filter((v) => (v.yours ? "owner" : v.bookSlug) === slug)
                        .map((v) => (
                          <Value key={v.id} v={v} mark={marks.get(v.bookSlug)} send={send} block={long} />
                        ))}
                    </span>
                  </div>
                ))}
                <AddValue label="+ your own" onAdd={(value) => add({ subjectType: view.subjectType, subject: view.subject, category: c.category, value, facet: f.facet as "itself" | "dominant" | "lacking" })} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
  return (
    <div>
      <Legend books={view.books} marks={marks} />
      {view.facets.filter((f) => f.facet === "itself").map(section)}
      {balance.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-3">
          <h3 className="text-sm font-semibold">{BALANCE_HEADING[view.subjectType] ?? "Its balance in a chart"}</h3>
          {balance.map(section)}
        </div>
      )}
    </div>
  );
}

export function SubjectPage({ view, history }: { view: SubjectView; history: { reviewId: string; label: string }[] }) {
  const { send, pending } = useCellActions();
  const name = view.subject.charAt(0).toUpperCase() + view.subject.slice(1);
  return (
    <div className="mt-3">
      <h1 className="text-3xl font-semibold">{name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything the books give for {name}, in one place. Each value shows which book it comes from; books do not have to agree, they sit side by side. Click a value to say{" "}
        <b className="text-foreground">Keep</b> or <b className="text-foreground">Wrong</b>, or to fix it. Add your own where something is missing.
      </p>
      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <SubjectPanel view={view} name={name} />
      </section>
      <UndoBar history={history} send={send} pending={pending} />
    </div>
  );
}
