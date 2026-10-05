"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FOUNDATION_MODES, FOUNDATION_ROLES } from "@elkdonis/astro-corpus";
import type { FoundationLessonView, FoundationSource, FoundationViewItem } from "@elkdonis/astro-corpus/server";
import { addFoundationItemAction, foundationReviewAction, foundationSourcesAction, type FoundationReviewInput } from "@/app/hub/studio/foundations/actions";
import { cn } from "@/lib/utils";
import { useFoundationUndo } from "@/components/studio/use-foundation-undo";
import { RulebookEntry } from "@/components/studio/foundation-rulebook";
import { SubjectPanel } from "@/components/studio/foundation-cells";
import { BALANCE_HEADING, FACET_HEADING, LESSON_NOUN, MODE_LABEL, ROLE_LABEL, label } from "@/components/studio/foundation-labels";

/**
 * One basic idea (Fire, Earth, …) of a Foundations lesson: what the books
 * say about it, for the owner to confirm, reject, correct and add to.
 *
 * Top to bottom: his own definition; "What each book gives" (each book's own
 * keywords and correspondences for it, side by side); the qualities the books
 * give it across the shelf (Core / Fits / Not the element, or "same as"
 * another quality), in subsections — the idea itself, then its balance in a
 * chart: a lot of it, little or none of it; the
 * pictures and metaphors (Apt / Not apt, meaning editable); the teaching
 * passages (Good teaching / Fine / Misread, with the AI's reading — what the
 * text is doing and the kind of reading — correctable in one click); things
 * of his own; and the rulebook entry so far.
 *
 * Keys work on the highlighted row: ↓/j and ↑/k move, 1 2 3 mark, 0 removes
 * the mark, Enter opens the quotes, m is "same as", u undoes. A mark made
 * with a key moves on to the next row. Every action shows a toast with Undo.
 * Rows keep their place until the page is reloaded (unreviewed first, then
 * by how many books agree).
 */

type Item = FoundationViewItem;
type Payload = Record<string, unknown>;

const VERDICTS: Record<string, { key: string; label: string; title: string; tone: "yes" | "mid" | "no" }[]> = {
  trait: [
    { key: "core", label: "Core", title: "Essential: without this it would not be this", tone: "yes" },
    { key: "fits", label: "Fits", title: "True of it, but secondary", tone: "mid" },
    { key: "not", label: "Not the %", title: "Belongs to the sign, the planet or the passage instead — or the AI misread", tone: "no" },
  ],
  image: [
    { key: "apt", label: "Apt", title: "A good picture of it", tone: "yes" },
    { key: "not-apt", label: "Not apt", title: "Misleading, or not really about it", tone: "no" },
  ],
  passage: [
    { key: "good", label: "Good teaching", title: "Teaches it well: keep it for the rulebook", tone: "yes" },
    { key: "fine", label: "Fine", title: "Correct, but nothing special", tone: "mid" },
    { key: "misread", label: "Misread", title: "The AI got this passage wrong, or it is not about this", tone: "no" },
  ],
  figurative: [
    { key: "counts", label: "Counts as the %", title: "The writer really does mean this, not just a turn of phrase", tone: "yes" },
    { key: "figure", label: "Just a figure of speech", title: "Only a way of speaking: it says nothing about this", tone: "no" },
  ],
  note: [],
};
const optionsOf = (it: { kind: string; role: string | null }) => VERDICTS[it.kind === "passage" && it.role === "figurative" ? "figurative" : it.kind] ?? [];
const VERDICT_WORD: Record<string, string> = Object.fromEntries(Object.values(VERDICTS).flatMap((l) => l.map((v) => [v.key, v.label])));
const TONE: Record<string, string> = {
  yes: "border-primary bg-primary text-primary-foreground",
  mid: "border-gold bg-gold/20 text-foreground",
  no: "border-destructive bg-destructive/15 text-destructive",
};
const FACETS = ["itself", "dominant", "lacking"] as const;
const TRAIT_FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Unreviewed" },
  { key: "core", label: "Core" },
  { key: "fits", label: "Fits" },
  { key: "not", label: "Rejected" },
] as const;

const books = (n: number) => `${n} book${n === 1 ? "" : "s"}`;
const cite = (s: FoundationSource) => [[s.book, s.author].filter(Boolean).join(", "), s.where, s.pages.length ? `p. ${s.pages.join(", ")}` : null].filter(Boolean).join(" · ");

/** The text with the given words in bold. */
function highlight(text: string, terms: string[]): React.ReactNode {
  const words = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`\\b(${words.join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <b key={i} className="font-semibold text-foreground">{part}</b> : part));
}

export function FoundationsReview({ view }: { view: FoundationLessonView }) {
  const router = useRouter();
  const notify = useFoundationUndo();
  const [pending, startTransition] = useTransition();
  const lesson = view.lesson.lesson;
  const concept = view.concept;
  const noun = LESSON_NOUN[lesson] ?? "idea";
  const opened = useRef(performance.now());

  // What was just done, shown at once; dropped when the server's version arrives.
  const [local, setLocal] = useState<Record<string, Partial<Item>>>({});
  useEffect(() => setLocal({}), [view]);
  const items = useMemo(() => view.items.map((it) => (local[it.id] ? { ...it, ...local[it.id] } : it)), [view.items, local]);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // Rows keep the place they had when the page loaded: unreviewed first, then by books.
  const order = useRef<Map<string, number> | null>(null);
  if (!order.current) {
    const sorted = [...view.items].sort((a, b) => Number(Boolean(a.verdict)) - Number(Boolean(b.verdict)) || b.books - a.books || b.uses - a.uses || a.text.localeCompare(b.text));
    order.current = new Map(sorted.map((it, i) => [it.id, i]));
  }
  const inOrder = (list: Item[]) => [...list].sort((a, b) => (order.current!.get(a.id) ?? -1) - (order.current!.get(b.id) ?? -1));

  const [traitFilter, setTraitFilter] = useState<(typeof TRAIT_FILTERS)[number]["key"]>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Source quotes, fetched when a row is opened.
  const [quotes, setQuotes] = useState<Record<string, FoundationSource[]>>({});
  const loadQuotes = (ids: string[]) => {
    const need = ids.filter((id) => !quotes[id]);
    if (need.length) void foundationSourcesAction(need).then((r) => setQuotes((q) => ({ ...q, ...r })));
  };

  const allTraits = items.filter((it) => it.kind === "trait");
  const heads = allTraits.filter((it) => !it.mergedInto);
  const synonymsOf = (id: string) => allTraits.filter((it) => it.mergedInto === id);
  const traitShown = (it: Item) => traitFilter === "all" || (traitFilter === "open" ? !it.verdict : it.verdict === traitFilter);
  const traits = inOrder(heads.filter(traitShown));
  const facets = FACETS.filter((f) => heads.some((t) => t.facet === f));
  const traitRows = facets.flatMap((f) => traits.filter((t) => t.facet === f));
  const images = inOrder(items.filter((it) => it.kind === "image"));
  const allPassages = items.filter((it) => it.kind === "passage" && it.role !== "figurative");
  const figurative = inOrder(items.filter((it) => it.kind === "passage" && it.role === "figurative"));
  const roleOf = (it: Item) => it.hisRole ?? it.role ?? "none";
  const modeOf = (it: Item) => it.hisMode ?? it.mode;
  const passages = inOrder(allPassages.filter((it) => (roleFilter === "all" || roleOf(it) === roleFilter) && (!openOnly || !it.verdict)));
  const ownNotes = items.filter((it) => it.kind === "note");
  const rowsOf = (it: Item | undefined) => (!it || it.kind === "trait" ? traitRows : it.kind === "image" ? images : it.kind === "passage" ? (it.role === "figurative" ? figurative : passages) : []);

  const send = (action: FoundationReviewInput["action"], payload: Payload, message: string, patch?: [string, Partial<Item>]) => {
    if (patch) setLocal((l) => ({ ...l, [patch[0]]: { ...l[patch[0]], ...patch[1] } }));
    startTransition(async () => {
      const r = await foundationReviewAction({ action, payload, seconds: Math.round((performance.now() - opened.current) / 1000) });
      if (!r.ok) {
        toast.error(r.error);
        setLocal({});
      } else if (action !== "foundation-undo") notify(message, r.reviewId);
      else toast("Undone");
      router.refresh();
    });
  };

  const verdict = (it: Item, v: string, extra: { meaning?: string } = {}) => {
    const next = it.verdict === v && extra.meaning === undefined ? "clear" : v;
    const note = (notes[it.id] ?? it.note ?? "").trim() || undefined;
    const meaning = extra.meaning ?? it.hisMeaning ?? undefined;
    send(
      "foundation-verdict",
      { itemId: it.id, verdict: next, note, meaning: it.kind === "image" ? meaning : undefined },
      next === "clear" ? `“${it.text.slice(0, 40)}”: mark removed` : `“${it.text.slice(0, 40)}”: ${VERDICT_WORD[next].replace("%", noun)}`,
      [it.id, next === "clear" ? { verdict: null, note: null, hisMeaning: null } : { verdict: next, note: note ?? null, hisMeaning: it.kind === "image" ? (meaning ?? null) : null, mergedInto: null }],
    );
  };
  const merge = (it: Item, into: Item | null) => {
    setMerging(null);
    send(
      "foundation-merge",
      { itemId: it.id, intoItemId: into?.id ?? null },
      into ? `“${it.text}” is the same as “${into.text}”` : `“${it.text}” stands on its own again`,
      [it.id, into ? { mergedInto: into.mergedInto ?? into.id, verdict: null } : { mergedInto: null }],
    );
  };
  const correct = (it: Item, field: "role" | "mode", value: string) => {
    if ((field === "role" ? roleOf(it) : modeOf(it)) === value) return;
    const back = value === (field === "role" ? it.role : it.mode);
    send(
      "foundation-correct",
      { itemId: it.id, [field]: value },
      field === "mode" ? `Kind of reading: ${label(MODE_LABEL, value)}` : `What the text is doing: ${label(ROLE_LABEL, value)}`,
      [it.id, field === "role" ? { hisRole: back ? null : value } : { hisMode: back ? null : value }],
    );
  };
  const undo = (reviewId?: string) => {
    const id = reviewId ?? view.history[0]?.reviewId;
    if (id) send("foundation-undo", { reviewId: id }, "");
  };
  const openRow = (it: Item) => {
    if (!expanded.has(it.id)) loadQuotes([it.id, ...(it.kind === "trait" ? synonymsOf(it.id).map((s) => s.id) : [])]);
    toggle(it.id);
  };
  const toggle = (id: string) => setExpanded((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));

  // Keyboard: works on the highlighted row — not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "u") return undo();
      const cur = cursor ? byId.get(cursor) : undefined;
      const rows = rowsOf(cur);
      const at = cur ? rows.findIndex((r) => r.id === cur.id) : -1;
      const go = (i: number) => {
        const next = rows[Math.max(0, Math.min(rows.length - 1, i))];
        if (!next) return;
        setCursor(next.id);
        document.getElementById(`f-${next.id}`)?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        go(at + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        go(at < 0 ? 0 : at - 1);
      } else if (cur && at >= 0) {
        const options = optionsOf(cur);
        if (/^[1-3]$/.test(e.key) && options[Number(e.key) - 1]) {
          e.preventDefault();
          const v = options[Number(e.key) - 1].key;
          if (cur.verdict !== v) verdict(cur, v);
          go(at + 1);
        } else if (e.key === "0" && cur.verdict) verdict(cur, cur.verdict);
        else if (e.key === "Enter" && (el?.tagName !== "BUTTON" && el?.tagName !== "A")) {
          e.preventDefault();
          openRow(cur);
        } else if (e.key === "m" && cur.kind === "trait") {
          e.preventDefault();
          setMerging(cur.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stats = concept.stats;
  const modes = Object.entries(stats.byMode).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const rolesPresent = [...new Set(allPassages.map(roleOf))];
  const count = (f: string) => heads.filter((it) => (f === "all" ? true : f === "open" ? !it.verdict : it.verdict === f)).length;

  const buttons = (it: Item) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {optionsOf(it).map((v, i) => (
        <button
          key={v.key}
          type="button"
          title={v.title}
          aria-pressed={it.verdict === v.key}
          onClick={() => {
            setCursor(it.id);
            verdict(it, v.key);
          }}
          className={cn("rounded-full border px-2.5 py-1 text-xs", it.verdict === v.key ? TONE[v.tone] : "border-border hover:border-primary/60")}
        >
          {v.label.replace("%", noun)}
          {cursor === it.id && <kbd className="ml-1 text-[10px] opacity-70">{i + 1}</kbd>}
        </button>
      ))}
    </div>
  );

  const noteBox = (it: Item) => (
    <NoteBox
      key={`${it.id}:${it.note ?? ""}`}
      saved={it.note}
      canSave={Boolean(it.verdict)}
      onDraft={(t) => setNotes((n) => ({ ...n, [it.id]: t }))}
      onSave={(t) => {
        if (!it.verdict) return;
        send(
          "foundation-verdict",
          { itemId: it.id, verdict: it.verdict, note: t.trim() || undefined, meaning: it.hisMeaning ?? undefined },
          t.trim() ? "Note saved" : "Note removed",
          [it.id, { note: t.trim() || null }],
        );
      }}
    />
  );

  const passageCard = (it: Item) => {
    const src = it.sources[0];
            const mode = modeOf(it);
    return (
              <li key={it.id} id={`f-${it.id}`} onClick={() => setCursor(it.id)} className={cn("rounded-xl border border-border bg-card p-4", cursor === it.id && "ring-1 ring-primary/60")}>
                <blockquote className="whitespace-pre-line border-l-2 border-gold/60 pl-3 text-sm leading-relaxed">{highlight(it.text, [concept.label])}</blockquote>
                {src && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    — {cite(src) || "source unknown"}
                    {src.reader && <span className="ml-1.5 rounded border border-border px-1 uppercase tracking-wide">{src.reader}</span>}
                    {it.stale && " · no longer in the latest reading"}
                  </p>
                )}
                {src?.why && <p className="mt-1 text-[11px] text-muted-foreground">Why the AI read it this way: {src.why}</p>}
                {src?.context && <Context text={src.context} />}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Kind of reading:</span>
                  {FOUNDATION_MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={mode === m}
                      onClick={() => correct(it, "mode", m)}
                      title={m === it.mode ? "What the AI said" : "Click to correct"}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5",
                        mode === m ? (it.hisMode ? "border-gold bg-gold/20 text-foreground" : "border-primary bg-primary/10 text-primary") : "border-border text-muted-foreground hover:border-primary/60",
                        m === it.mode && it.hisMode && "line-through",
                      )}
                    >
                      {label(MODE_LABEL, m)}
                    </button>
                  ))}
                  {it.hisMode && <span className="text-gold">you corrected this (the AI said {label(MODE_LABEL, it.mode).toLowerCase()})</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <label className="text-muted-foreground" htmlFor={`role-${it.id}`}>
                    What the text is doing:
                  </label>
                  <select
                    id={`role-${it.id}`}
                    value={roleOf(it)}
                    onChange={(e) => correct(it, "role", e.target.value)}
                    className={cn("rounded-lg border bg-background px-2 py-1", it.hisRole ? "border-gold" : "border-border")}
                  >
                    {roleOf(it) === "none" && <option value="none">Not said</option>}
                    {FOUNDATION_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {label(ROLE_LABEL, r)}
                        {r === it.role ? " (the AI's reading)" : ""}
                      </option>
                    ))}
                  </select>
                  {it.hisRole && <span className="text-gold">you corrected this</span>}
                </div>
                <div className="mt-3">{buttons(it)}</div>
                {noteBox(it)}
              </li>
    );
  };

  return (
    <div className="mt-5">
      {/* Header: how much the books say */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-3xl font-semibold leading-tight">{concept.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Named {stats.mentions.toLocaleString()} time{stats.mentions === 1 ? "" : "s"} in {books(stats.books)}
          {stats.notElement > 0 && ` · ${stats.notElement} more where the word meant something else (left out)`}
        </p>
        {modes.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Kind of reading:</span>
            {modes.map(([m, n]) => (
              <span key={m} className="rounded-full border border-border px-2 py-0.5">
                {label(MODE_LABEL, m)} <span className="tabular-nums text-foreground">{n}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* His definition */}
      <Definition
        key={view.definition ?? ""}
        name={concept.label}
        saved={view.definition}
        pending={pending}
        onSave={(text) => send("foundation-define", { lesson, concept: concept.id, text }, text.trim() ? `Your definition of ${concept.label} saved` : `Your definition of ${concept.label} removed`)}
      />

      {/* What each book gives */}
      {view.correspondences && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">What each book gives</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each book’s own keywords and facts for {concept.label}, side by side. The books do not have to agree. Click a value to <b className="text-foreground">Keep</b> it, mark it{" "}
            <b className="text-foreground">Wrong</b> or fix it.{" "}
            <Link href={`/hub/studio/foundations/subject/${view.correspondences.subjectType}/${encodeURIComponent(view.correspondences.subject)}`} className="text-primary">
              Open {concept.label} on its own page →
            </Link>
          </p>
          <details className="mt-3 rounded-2xl border border-border bg-card px-5 py-4" open>
            <summary className="cursor-pointer select-none text-sm font-medium">
              {view.correspondences.total} values from {view.correspondences.books.length} book{view.correspondences.books.length === 1 ? "" : "s"}
            </summary>
            <SubjectPanel view={view.correspondences} name={concept.label} compact />
          </details>
        </section>
      )}

      {/* Qualities */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Qualities the books give it, across the whole shelf</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For each word, say whether it is <b className="text-foreground">Core</b> (essential to {concept.label}), <b className="text-foreground">Fits</b> (true but
          secondary) or <b className="text-foreground">Not the {noun}</b> (it belongs to the sign, the planet or the passage, or the AI misread). If two words mean
          the same, use “Same as…”. Open a row to read every quote.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TRAIT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={traitFilter === f.key}
              onClick={() => setTraitFilter(f.key)}
              className={cn("rounded-full border px-3 py-1 text-xs", traitFilter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
            >
              {f.label} <span className="tabular-nums opacity-80">{count(f.key)}</span>
            </button>
          ))}
        </div>
        {heads.length === 0 && <p className="mt-3 text-sm text-muted-foreground">The books give no qualities yet.</p>}
        {facets.map((f) => {
          const rows = traits.filter((t) => t.facet === f);
          return (
            <div key={f} className="mt-4">
              {f !== "itself" && f === facets.find((x) => x !== "itself") && (
                <h3 className="mb-2 mt-6 border-t border-border/60 pt-4 text-base font-semibold">{BALANCE_HEADING[noun === "mode" ? "modality" : noun] ?? `${concept.label} in the balance of a chart`}</h3>
              )}
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {f === "itself" ? `${concept.label} itself` : FACET_HEADING[f]} <span className="tabular-nums">· {rows.length}</span>
              </h3>
              {rows.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Nothing here with this filter.</p>}
              <ul className="mt-1.5 divide-y divide-border/60 rounded-xl border border-border">
                {rows.map((it) => {
                  const syn = synonymsOf(it.id);
                  const open = expanded.has(it.id);
                  const ids = [it.id, ...syn.map((x) => x.id)];
                  const loaded = ids.every((id) => quotes[id]);
                  const sources = ids.flatMap((id) => quotes[id] ?? []);
                  return (
                    <li key={it.id} id={`f-${it.id}`} onClick={() => setCursor(it.id)} className={cn("px-3 py-2", cursor === it.id && "bg-primary/5 ring-1 ring-inset ring-primary/60")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button type="button" onClick={() => openRow(it)} className="min-w-0 text-left" title="Show the quotes">
                          <span className="mr-1 text-xs text-muted-foreground">{open ? "▾" : "▸"}</span>
                          <span className="font-medium">{it.text}</span>{" "}
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {it.yours ? <span className="text-gold">yours</span> : `${books(it.books)} · ${it.uses} use${it.uses === 1 ? "" : "s"}`}
                            {it.degree === "extreme" && " · too much of it"}
                            {it.stale && " · no longer in the latest reading"}
                          </span>
                        </button>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {buttons(it)}
                          <button type="button" onClick={() => setMerging(merging === it.id ? null : it.id)} className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs hover:border-primary/60" title="This word means the same as another one in the list">
                            Same as…
                          </button>
                        </div>
                      </div>
                      {syn.length > 0 && (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 pl-4 text-xs text-muted-foreground">
                          same as:
                          {syn.map((s) => (
                            <span key={s.id} className="rounded-full border border-border px-2 py-0.5">
                              {s.text}{" "}
                              <button type="button" onClick={() => merge(s, null)} title="Separate it again" className="text-muted-foreground hover:text-destructive">
                                ×
                              </button>
                            </span>
                          ))}
                        </p>
                      )}
                      {merging === it.id && (
                        <MergePicker
                          item={it}
                          options={heads.filter((h) => h.id !== it.id && h.facet === it.facet)}
                          onPick={(into) => merge(it, into)}
                          onClose={() => setMerging(null)}
                        />
                      )}
                      {open && (
                        <div className="mt-2 pl-4">
                          {!loaded ? (
                            <p className="text-xs text-muted-foreground">Loading the quotes…</p>
                          ) : sources.length ? (
                            <Sources sources={sources} terms={[it.text, ...syn.map((s) => s.text)]} />
                          ) : (
                            <p className="text-xs text-muted-foreground">{it.yours ? "You added this one; it has no quotes." : "No quotes came with this one."}</p>
                          )}
                          {noteBox(it)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      {/* Pictures and metaphors */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Pictures and metaphors</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The books compare {concept.label} to these. Say whether each picture is <b className="text-foreground">Apt</b> or <b className="text-foreground">Not apt</b>. If
          the line saying what the picture means is off, fix it.
        </p>
        {images.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No pictures yet.</p>}
        <ul className="mt-3 space-y-3">
          {images.map((it) => (
            <li key={it.id} id={`f-${it.id}`} onClick={() => setCursor(it.id)} className={cn("rounded-xl border border-border bg-card p-4", cursor === it.id && "ring-1 ring-primary/60")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">
                  {it.text} {it.yours && <span className="text-xs text-gold">yours</span>}
                  {!it.yours && <span className="text-xs font-normal text-muted-foreground"> · {books(it.books)}</span>}
                </p>
                {buttons(it)}
              </div>
              <Meaning key={`${it.hisMeaning ?? ""}|${it.meaning ?? ""}`} item={it} onSave={(m) => verdict(it, it.verdict ?? "apt", { meaning: m })} />
              {it.sources.length > 0 && (
                <div className="mt-2">
                  <Sources sources={expanded.has(it.id) && quotes[it.id] ? quotes[it.id] : it.sources} terms={[it.text]} />
                  {it.sourceCount > 1 && (
                    <button type="button" onClick={() => openRow(it)} className="mt-1 text-[11px] text-primary">
                      {expanded.has(it.id) ? "Show only the first quote" : `Show all ${it.sourceCount} quotes`}
                    </button>
                  )}
                </div>
              )}
              {noteBox(it)}
            </li>
          ))}
        </ul>
      </section>

      {/* Teaching passages */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Teaching passages</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read each quote and say whether it is <b className="text-foreground">Good teaching</b>, <b className="text-foreground">Fine</b> or <b className="text-foreground">Misread</b>. Then check
          the two labels under it: if the AI got the <b className="text-foreground">kind of reading</b> wrong (for example it says “Birth chart” but the passage is about
          a transit), click the right one.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {["all", ...rolesPresent].map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={roleFilter === r}
              onClick={() => setRoleFilter(r)}
              className={cn("rounded-full border px-3 py-1 text-xs", roleFilter === r ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
            >
              {r === "all" ? "All" : label(ROLE_LABEL, r === "none" ? null : r)}{" "}
              <span className="tabular-nums opacity-80">{r === "all" ? allPassages.length : allPassages.filter((p) => roleOf(p) === r).length}</span>
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Unreviewed only
          </label>
        </div>
        {passages.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No passages here.</p>}
        <ul className="mt-3 space-y-3">
          {passages.map(passageCard)}
        </ul>
      </section>

      {/* Figurative uses */}
      {figurative.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Figurative uses — is this the {noun}?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Here the word is used as a turn of phrase (“the fiery nature of Mars”, “flames of love”), so the AI set these aside. For each one, say whether it really{" "}
            <b className="text-foreground">counts as the {noun}</b> or is <b className="text-foreground">just a figure of speech</b>.
          </p>
          <ul className="mt-3 space-y-3">{figurative.map(passageCard)}</ul>
        </section>
      )}

      {/* Add your own */}
      <AddOwn
        name={concept.label}
        onAdd={async (input) => {
          const r = await addFoundationItemAction({ lesson, concept: concept.id, ...input });
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          notify(`Added “${r.text.slice(0, 40)}”`, r.reviewId);
          router.refresh();
          return true;
        }}
      />
      {ownNotes.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your notes</h3>
          <ul className="mt-1.5 space-y-1.5">
            {ownNotes.map((n) => (
              <li key={n.id} className={cn("flex items-start justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm", n.verdict === "not" && "text-muted-foreground line-through")}>
                <span>{n.text}</span>
                <button type="button" onClick={() => verdict(n, n.verdict === "not" ? "keep" : "not")} className="shrink-0 text-xs text-primary">
                  {n.verdict === "not" ? "Keep after all" : "Drop"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The rulebook entry so far */}
      <details className="mt-10 rounded-2xl border border-gold/60 px-5 py-4">
        <summary className="cursor-pointer select-none font-semibold">
          The rulebook entry for {concept.label} so far
          <span className="ml-2 text-xs font-normal text-muted-foreground">what you have confirmed, as the AI will be given it</span>
        </summary>
        <div className="mt-4">
          <RulebookEntry name={concept.label} entry={view.entry} />
        </div>
        <Link href={`/hub/studio/foundations/${lesson}/rulebook`} className="mt-4 inline-block text-sm text-primary">
          See the whole rulebook for this lesson →
        </Link>
      </details>

      {/* Undo */}
      <div className="sticky bottom-3 z-10 mt-8 rounded-2xl border border-border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={view.history.length === 0}
            onClick={() => undo()}
            className="rounded-xl border border-gold/70 px-4 py-2 text-sm hover:bg-gold/10 disabled:opacity-40"
          >
            ↶ Undo <kbd className="ml-1 text-[10px] text-muted-foreground">u</kbd>
          </button>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{view.history[0] ? `Undo would take back: ${view.history[0].label}` : "Nothing to undo yet."}</span>
          <span className="text-xs tabular-nums text-muted-foreground">{pending ? "Saving…" : `${view.entry.progress.reviewed} / ${view.entry.progress.total} reviewed`}</span>
        </div>
        {view.history.length > 1 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer select-none text-xs text-muted-foreground">Last {view.history.length} actions</summary>
            <ul className="mt-2 space-y-1">
              {view.history.map((h) => (
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
        <p className="mt-2 text-[11px] text-muted-foreground">Keys: click a row, then ↓ ↑ move · 1 2 3 mark it · 0 remove the mark · Enter open the quotes · m same as · u undo</p>
      </div>
    </div>
  );
}

/** The source quotes of one item: where, the quote with the item's words in bold, the AI's reason, more context on request. */
function Sources({ sources, terms }: { sources: FoundationSource[]; terms: string[] }) {
  return (
    <ul className="space-y-2.5">
      {sources.map((s, i) => (
        <li key={`${s.mention ?? ""}-${i}`} className="border-l-2 border-gold/60 pl-3 text-sm leading-relaxed text-muted-foreground">
          <p>{highlight(s.quote, terms)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span>— {cite(s) || "source unknown"}</span>
            {s.phrase && <span className="text-foreground">from “{s.phrase}”</span>}
            {s.mode && (
              <span className={cn("rounded-full border px-1.5", s.mode === "general" ? "border-border" : "border-gold text-foreground")} title="The kind of reading the passage is about">
                {label(MODE_LABEL, s.mode)}
              </span>
            )}
            {s.facet && s.facet !== "itself" && <span className="rounded-full border border-border px-1.5">{FACET_HEADING[s.facet]}</span>}
            {s.reader && <span className="rounded border border-border px-1 uppercase tracking-wide">{s.reader}</span>}
          </p>
          {s.why && <p className="mt-0.5 text-[11px]">Why the AI read it this way: {s.why}</p>}
          {s.context && s.context !== s.quote && <Context text={s.context} />}
        </li>
      ))}
    </ul>
  );
}

function Context({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} className="mt-0.5 text-[11px] text-primary">
        {open ? "Hide the context" : "Show more context"}
      </button>
      {open && <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{text}</p>}
    </>
  );
}

function Definition({ name, saved, pending, onSave }: { name: string; saved: string | null; pending: boolean; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(!saved);
  const [text, setText] = useState(saved ?? "");
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Your definition</h2>
      <p className="mt-1 text-sm text-muted-foreground">In a few sentences of your own, say what {name} is. You can change it any time; the latest one counts.</p>
      {saved && !editing ? (
        <div className="mt-2 rounded-xl border border-gold/50 bg-gold/5 px-4 py-3">
          <p className="whitespace-pre-line text-sm leading-relaxed">{saved}</p>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-primary">
            Edit
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={3000}
            placeholder={`${name} is…`}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              disabled={pending || text.trim() === (saved ?? "")}
              onClick={() => onSave(text)}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-40"
            >
              Save definition
            </button>
            {saved && (
              <button type="button" onClick={() => (setText(saved), setEditing(false))} className="rounded-lg border border-border px-3 py-1.5 text-sm">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** What a picture says about the idea: the AI's line, or his own once he edits it. */
function Meaning({ item, onSave }: { item: Item; onSave: (meaning: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.hisMeaning ?? item.meaning ?? "");
  if (editing)
    return (
      <div className="mt-1 flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={600} autoFocus className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
        <button type="button" disabled={!text.trim()} onClick={() => onSave(text)} className="rounded-lg bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-border px-2 text-xs">
          Cancel
        </button>
      </div>
    );
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      <span className="text-xs">What it says: </span>
      <span className="text-foreground">{item.hisMeaning ?? item.meaning ?? "(nothing written)"}</span>
      {item.hisMeaning && item.meaning && <span className="text-xs text-gold"> · your wording (the AI wrote: {item.meaning})</span>}{" "}
      {!item.yours && (
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary">
          Edit
        </button>
      )}
    </p>
  );
}

/** A note on one item. It is stored with the item's mark, so it needs a mark first. */
function NoteBox({ saved, canSave, onDraft, onSave }: { saved: string | null; canSave: boolean; onDraft: (t: string) => void; onSave: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(saved ?? "");
  if (!open)
    return (
      <p className="mt-2 text-xs">
        {saved && <span className="italic text-muted-foreground">Your note: “{saved}” </span>}
        <button type="button" onClick={() => setOpen(true)} className="text-primary">
          {saved ? "Edit note" : "Add a note"}
        </button>
      </p>
    );
  return (
    <div className="mt-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onDraft(e.target.value);
        }}
        rows={2}
        maxLength={1000}
        autoFocus
        placeholder="Why? What is wrong or right about it?"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="mt-1 flex items-center gap-2 text-xs">
        {canSave ? (
          <button type="button" onClick={() => (onSave(text), setOpen(false))} className="rounded-lg border border-primary px-3 py-1 text-primary">
            Save note
          </button>
        ) : (
          <span className="text-muted-foreground">Now pick a mark above: the note is saved with it.</span>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground">
          Close
        </button>
      </div>
    </div>
  );
}

/** "Same as…": pick the other quality this one means the same as. */
function MergePicker({ item, options, onPick, onClose }: { item: Item; options: Item[]; onPick: (into: Item) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const stem = item.text.toLowerCase().slice(0, 4);
  const hits = options
    .filter((o) => (query ? o.text.toLowerCase().includes(query) : true))
    .sort((a, b) => Number(b.text.toLowerCase().startsWith(stem)) - Number(a.text.toLowerCase().startsWith(stem)) || b.books - a.books)
    .slice(0, 12);
  return (
    <div className="mt-2 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">
        “{item.text}” means the same as which word? It will be listed under that word and share its mark.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && hits[0]) onPick(hits[0]);
        }}
        autoFocus
        maxLength={100}
        placeholder="Type to find the other word"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {hits.map((h) => (
          <button key={h.id} type="button" onClick={() => onPick(h)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:border-primary/60">
            {h.text} <span className="text-muted-foreground">{h.books}</span>
          </button>
        ))}
        {hits.length === 0 && <span className="text-xs text-muted-foreground">No other word matches.</span>}
      </div>
      <button type="button" onClick={onClose} className="mt-2 text-xs text-muted-foreground">
        Close
      </button>
    </div>
  );
}

type AddInput = { kind: "trait" | "image" | "note"; text: string; meaning?: string | null; facet?: "itself" | "dominant" | "lacking" | null };

function AddOwn({ name, onAdd }: { name: string; onAdd: (input: AddInput) => Promise<boolean> }) {
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<AddInput["kind"]>("trait");
  const [facet, setFacet] = useState<NonNullable<AddInput["facet"]>>("itself");
  const [text, setText] = useState("");
  const [meaning, setMeaning] = useState("");
  const add = () =>
    startTransition(async () => {
      if (await onAdd({ kind, text, meaning: kind === "image" ? meaning : null, facet: kind === "trait" ? facet : null })) {
        setText("");
        setMeaning("");
      }
    });
  const KINDS: { key: AddInput["kind"]; label: string; placeholder: string }[] = [
    { key: "trait", label: "A quality", placeholder: "One word or a short phrase, e.g. warmth" },
    { key: "image", label: "A picture", placeholder: "The picture, e.g. a forge" },
    { key: "note", label: "A note", placeholder: "Something the books missed, in your own words" },
  ];
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Add your own</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Anything about {name} the books missed: a quality, a picture, or a note. Yours count as confirmed and are marked “yours”.
      </p>
      <div className="mt-3 rounded-xl border border-border p-3">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              aria-pressed={kind === k.key}
              onClick={() => setKind(k.key)}
              className={cn("rounded-full border px-3 py-1 text-xs", kind === k.key ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/60")}
            >
              {k.label}
            </button>
          ))}
          {kind === "trait" && (
            <select value={facet} onChange={(e) => setFacet(e.target.value as typeof facet)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs" aria-label="Which group it goes in">
              <option value="itself">{name} itself</option>
              <option value="dominant">{FACET_HEADING.dominant}</option>
              <option value="lacking">{FACET_HEADING.lacking}</option>
            </select>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim() && kind !== "image") add();
            }}
            maxLength={kind === "note" ? 1000 : 300}
            placeholder={KINDS.find((k) => k.key === kind)!.placeholder}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button type="button" disabled={pending || !text.trim()} onClick={add} className="rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
            Add
          </button>
        </div>
        {kind === "image" && (
          <input
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            maxLength={600}
            placeholder={`What the picture says about ${name}`}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        )}
      </div>
    </section>
  );
}
