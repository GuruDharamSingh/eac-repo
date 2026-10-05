"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { RefVoteListItem } from "@elkdonis/astro-corpus/server";
import type { KeyPassages, Passage, PassageRef, RefVote, ReferencePage, ReferenceScope, ReferenceSort } from "@/lib/references";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { Footnoted } from "@/components/footnote";

/**
 * The explorer's references — BOOK PASSAGES, passage first. The AI-digested
 * statements are never the reference; they appear only behind an "AI summary
 * (unverified)" toggle.
 *
 * Every passage card says what the passage is about (its corrected heading
 * scope), so its pronouns read right: "'you' here = someone with Sun in the
 * 7th house". Votes (helpful / not helpful, optional note) target the
 * passage (POST /api/astro/ref-votes {textId, factorKey, …}).
 */

type Verdict = RefVote["verdict"];
const voteKey = (textId: string, factorKey: string) => `${textId}|${factorKey}`;

interface RefsContextValue {
  chartId: string;
  /** The studio owner: votes, Favourites and whole passages. Everyone else sees excerpts and no votes. */
  isOwner: boolean;
  elementId: string | null;
  voteOf: (p: { textId: string; vote: RefVote | null }, factorKey: string) => RefVote | null;
  castVote: (p: { textId: string }, factorKey: string, verdict: Verdict | "clear", note?: string) => Promise<void>;
  voteError: string | null;
  staleKeys: Set<string>;
  passage: (textId: string, factorKey: string) => Promise<Passage>;
}

const RefsContext = createContext<RefsContextValue | null>(null);
const useRefs = () => {
  const v = useContext(RefsContext);
  if (!v) throw new Error("RefsProvider missing");
  return v;
};

export function RefsProvider({
  chartId,
  elementId,
  isOwner,
  children,
}: {
  chartId: string;
  elementId: string | null;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const [votes, setVotes] = useState<Record<string, RefVote | null>>({});
  const [voteError, setVoteError] = useState<string | null>(null);
  const [staleKeys] = useState(() => new Set<string>());
  const passages = useRef(new Map<string, Promise<Passage>>());
  const opened = useRef(Date.now());

  const voteOf = useCallback(
    (p: { textId: string; vote: RefVote | null }, factorKey: string) => {
      const k = voteKey(p.textId, factorKey);
      return k in votes ? votes[k] : p.vote;
    },
    [votes],
  );

  const castVote = useCallback(
    async (p: { textId: string }, factorKey: string, verdict: Verdict | "clear", note?: string) => {
      const k = voteKey(p.textId, factorKey);
      const before = votes[k];
      setVotes((v) => ({ ...v, [k]: verdict === "clear" ? null : { verdict, note: note ?? null } }));
      staleKeys.add(factorKey);
      try {
        const res = await fetch(withBase("/api/astro/ref-votes"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            textId: p.textId,
            factorKey,
            chartId,
            ...(elementId ? { elementId } : {}),
            verdict,
            ...(note ? { note } : {}),
            seconds: Math.round((Date.now() - opened.current) / 1000),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setVoteError(null);
      } catch (err) {
        setVotes((v) => {
          const next = { ...v };
          if (before === undefined) delete next[k];
          else next[k] = before;
          return next;
        });
        setVoteError(err instanceof Error ? err.message : "Could not save the vote");
      }
    },
    [votes, chartId, elementId, staleKeys],
  );

  const passage = useCallback((textId: string, factorKey: string) => {
    const k = `${textId}|${factorKey}`;
    let p = passages.current.get(k);
    if (!p) {
      p = fetch(withBase(`/api/astro/references/passage?${new URLSearchParams({ textId, factorKey, chartId })}`)).then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        return json.passage as Passage;
      });
      p.catch(() => passages.current.delete(k));
      passages.current.set(k, p);
    }
    return p;
  }, [chartId]);

  const value = useMemo(
    () => ({ chartId, isOwner, elementId, voteOf, castVote, voteError, staleKeys, passage }),
    [chartId, isOwner, elementId, voteOf, castVote, voteError, staleKeys, passage],
  );
  return <RefsContext.Provider value={value}>{children}</RefsContext.Provider>;
}

export function VoteError() {
  const { voteError } = useRefs();
  return voteError ? <p className="mb-2 text-xs text-destructive">Vote not saved: {voteError}</p> : null;
}

/** Keys whose summary ranking a vote has made stale (refetched on next open). */
export const useStaleKeys = () => useRefs().staleKeys;
/** The chart the explorer is showing (references are relative to it). */
export const useChartId = () => useRefs().chartId;

// ── one passage ─────────────────────────────────────────────────────────────

const pagesLabel = (pages: number[] | null) =>
  pages?.length ? `p. ${pages[0]}${pages.length > 1 && pages[pages.length - 1] !== pages[0] ? `–${pages[pages.length - 1]}` : ""}` : "";

/** What to highlight in a passage for a factor: its label ("Venus in Aries"), or a pattern's phrase. */
export function highlightOf(key: string, label: string): string {
  if (key.startsWith("pattern:")) return key.slice(8).replace(/-/g, " ");
  return label.replace(/ \(.*\)$/, "");
}

function Highlighted({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-gold/25 px-0.5 text-foreground">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** The corrected heading path, with the subject heading(s) emphasised and dropped siblings noted. */
function Breadcrumb({ p }: { p: { breadcrumb: PassageRef["breadcrumb"]; ignored: string[] } }) {
  if (!p.breadcrumb.length && !p.ignored.length) return null;
  return (
    <div className="text-[11px] leading-snug text-muted-foreground">
      {p.breadcrumb.map((c, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1 opacity-60">›</span>}
          <span className={cn(c.keys.some((k) => !k.startsWith("planet:") && !k.startsWith("aspect-type:")) && "font-semibold text-foreground")}>{c.text}</span>
        </span>
      ))}
      {p.ignored.length > 0 && (
        <span className="ml-2 italic opacity-80" title="A same-level heading the PDF chunker nested by mistake (or a running page header); it is not a parent of this passage.">
          (ignored sibling heading{p.ignored.length > 1 ? "s" : ""}: {p.ignored.join("; ")})
        </span>
      )}
    </div>
  );
}

/** The passage's subject, so its pronouns read right. */
function Subject({ p }: { p: PassageRef }) {
  if (!p.subject) return <p className="text-[11px] text-muted-foreground">Subject not placed by headings or text.</p>;
  return (
    <p className="text-[11px]">
      <span className="text-muted-foreground">About </span>
      <span className="font-medium text-foreground">{p.subject}</span>
      <span className="text-muted-foreground"> ({p.subjectFrom === "headings" ? "from its headings" : "from its own text"})</span>
      {p.anaphora && (
        <span className="text-muted-foreground">
          {" "}
          · “{p.anaphora}” here = {/^(you|your)$/i.test(p.anaphora) ? "someone with " : ""}
          {p.subject}
        </span>
      )}
    </p>
  );
}

const READING_LABEL: Record<string, string> = {
  general: "general teaching",
  natal: "natal",
  transit: "transit",
  progression: "progression",
  synastry: "two charts compared",
  technique: "technique",
  example: "worked example",
  other: "other",
  front_back: "front or back matter",
};

/** How the passage relates to the chart being viewed. */
function FitBadge({ p }: { p: PassageRef }) {
  const parts: React.ReactNode[] = [];
  // The kind of reading its section is, from the book's outline; books without an outline yet say so.
  parts.push(
    <span
      key="r"
      className={cn(
        "rounded px-1.5 py-0.5",
        !p.reading ? "border border-dashed border-border text-muted-foreground" : p.reading === "natal" || p.reading === "general" ? "bg-primary/10 text-primary" : "bg-fire/10 text-fire",
      )}
    >
      {p.reading ? (READING_LABEL[p.reading] ?? p.reading) : "kind not known yet"}
    </span>,
  );
  if (p.group === "about" && p.fit === "other" && p.missing.length)
    parts.push(
      <span key="m" className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
        not your chart: needs {p.missing.join("; ")}
      </span>,
    );
  if (p.group === "about" && p.matched.length)
    parts.push(
      <span key="x" className="rounded bg-air/10 px-1.5 py-0.5 text-air">
        matches your chart: also {p.matched.join("; ")}
      </span>,
    );
  if (p.group === "about" && p.alternatives)
    parts.push(
      <span key="a" className="rounded bg-accent px-1.5 py-0.5 text-accent-foreground">
        said of {p.alternatives}
      </span>,
    );
  if (p.group !== "about" && p.note)
    parts.push(
      <span key="n" className={cn("rounded px-1.5 py-0.5", p.group === "mismatch" ? "bg-fire/10 text-fire" : "bg-muted text-muted-foreground")}>
        {p.group === "mismatch" ? "context mismatch: " : ""}
        {p.note}
      </span>,
    );
  return parts.length ? <p className="flex flex-wrap gap-1 text-[10.5px] leading-tight">{parts}</p> : null;
}

/** A passage: where it sits, what it is about, the text, the vote; the whole passage and the AI summary on demand. */
export function PassageCard({
  p,
  factorKey,
  term,
  showBook = true,
  extra,
}: {
  p: PassageRef;
  factorKey: string;
  /** Highlighted in the text. */
  term: string;
  showBook?: boolean;
  extra?: React.ReactNode;
}) {
  const { voteOf, isOwner } = useRefs();
  const [whole, setWhole] = useState(false);
  const [ai, setAi] = useState(false);
  const vote = voteOf(p, factorKey);
  const tossed = vote?.verdict === "not";
  return (
    <li className={cn("space-y-1.5 border-l-2 pl-3 transition-opacity", vote?.verdict === "helpful" ? "border-gold" : "border-gold/40", tossed && "opacity-50 hover:opacity-90")}>
      <p className="text-[11px] text-muted-foreground">
        {showBook && (
          <>
            <span className="italic text-foreground/80">{p.book.title}</span>
            {p.book.author ? `, ${p.book.author}` : ""}
          </>
        )}
        {pagesLabel(p.pages) && `${showBook ? ", " : ""}${pagesLabel(p.pages)}`}
        {showBook && p.inBook > 1 ? ` · ${p.inBook} passages in this book` : ""}
        {extra ? <> · {extra}</> : null}
      </p>
      <Breadcrumb p={p} />
      <Subject p={p} />
      <FitBadge p={p} />
      {!whole && (
        <div className={cn("max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-paper/70 px-2.5 py-2 text-[13px] leading-relaxed", tossed && "line-through decoration-muted-foreground/40")}>
          <Highlighted text={p.excerpt} term={term} />
        </div>
      )}
      {whole && <WholePassage p={p} factorKey={factorKey} term={term} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {isOwner && <VoteBar p={p} factorKey={factorKey} />}
        {isOwner ? (
          <button type="button" onClick={() => setWhole((w) => !w)} className="text-[11px] text-primary hover:underline" aria-expanded={whole}>
            {whole ? "Excerpt" : `Whole passage (${p.length.toLocaleString()} chars)`}
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Excerpt shown; full text available to the studio owner.</span>
        )}
        <button type="button" onClick={() => setAi((a) => !a)} className="text-[11px] text-muted-foreground hover:text-foreground" aria-expanded={ai}>
          {ai ? "Hide AI summary" : "AI summary (unverified)"}
        </button>
        {p.aiTagged && <span className="text-[10px] text-muted-foreground" title="The AI first pass also tagged this factor in this passage. A hint only.">AI digest also tagged this</span>}
      </div>
      {isOwner && vote?.note && <p className="text-[11px] italic text-muted-foreground">Note: {vote.note}</p>}
      {ai && <AiSummary p={p} factorKey={factorKey} />}
    </li>
  );
}

function usePassage(textId: string, factorKey: string) {
  const { passage } = useRefs();
  const [p, setP] = useState<Passage | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    passage(textId, factorKey).then(
      (x) => live && setP(x),
      (e: unknown) => live && setError(e instanceof Error ? e.message : "Could not load the passage"),
    );
    return () => {
      live = false;
    };
  }, [passage, textId, factorKey]);
  return { p, error };
}

function WholePassage({ p, factorKey, term }: { p: PassageRef; factorKey: string; term: string }) {
  const { p: full, error } = usePassage(p.textId, factorKey);
  const [tall, setTall] = useState(false);
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!full) return <p className="text-xs text-muted-foreground">Loading the passage…</p>;
  return (
    <div className="rounded-md border border-border bg-paper/70 p-2.5">
      {full.headings.length > 0 && <p className="mb-1 text-[10.5px] text-muted-foreground">As recorded: {full.headings.join(" › ")}</p>}
      <div className={cn("overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed", tall ? "max-h-none" : "max-h-96")}>
        <Highlighted text={full.body ?? "Excerpt shown; full text available to the studio owner."} term={term} />
      </div>
      <button type="button" onClick={() => setTall((t) => !t)} className="mt-1 text-[11px] text-primary hover:underline">
        {tall ? "Scroll it" : "Full height"}
      </button>
    </div>
  );
}

function AiSummary({ p, factorKey }: { p: PassageRef; factorKey: string }) {
  const { p: full, error } = usePassage(p.textId, factorKey);
  // Each claim footnoted (server-side: lib/references.ts getPassage) to its source sentence(s), the book's reason and where its tags come from.
  const notes = full?.claimNotes ?? [];
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!full) return <p className="text-xs text-muted-foreground">Loading…</p>;
  return (
    <div className="rounded-md border border-dashed border-border px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">AI first-pass digest — unverified, not a reference</p>
      {full.claims.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No claims were digested from this passage.</p>
      ) : (
        <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
          {full.claims.map((c, i) => (
            <li key={c.id} className={cn(c.tagged && "text-foreground")}>
              <Footnoted text={c.body} notes={notes[i] ? [notes[i]] : []} start={i + 1} />
              {c.tagged ? " ◂ tagged with this factor" : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** ☆ Helpful · ✕ Not helpful · Note — one click each; the same click again clears. */
export function VoteBar({ p, factorKey }: { p: { textId: string; vote: RefVote | null }; factorKey: string }) {
  const { voteOf, castVote } = useRefs();
  const vote = voteOf(p, factorKey);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(vote?.note ?? "");
  const click = (v: Verdict) => castVote(p, factorKey, vote?.verdict === v ? "clear" : v, vote?.verdict === v ? undefined : (vote?.note ?? undefined));
  const saveNote = () => {
    setNoting(false);
    if (vote && note.trim() !== (vote.note ?? "")) castVote(p, factorKey, vote.verdict, note.trim() || undefined);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => click("helpful")}
        aria-pressed={vote?.verdict === "helpful"}
        title={vote?.verdict === "helpful" ? "Helpful (click to clear)" : "Mark helpful: it floats to the top for this factor"}
        className={cn(
          "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
          vote?.verdict === "helpful" ? "border-gold bg-gold/15 text-gold" : "border-border text-muted-foreground hover:border-gold/60 hover:text-gold",
        )}
      >
        {vote?.verdict === "helpful" ? "★" : "☆"} Helpful
      </button>
      <button
        type="button"
        onClick={() => click("not")}
        aria-pressed={vote?.verdict === "not"}
        title={vote?.verdict === "not" ? "Not helpful (click to clear)" : "Toss: it sinks to the bottom for this factor"}
        className={cn(
          "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
          vote?.verdict === "not" ? "border-fire/60 bg-fire/10 text-fire" : "border-border text-muted-foreground hover:border-fire/50 hover:text-fire",
        )}
      >
        ✕ Not helpful
      </button>
      {vote &&
        (noting ? (
          <input
            autoFocus
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveNote();
              if (e.key === "Escape") {
                e.stopPropagation();
                setNoting(false);
                setNote(vote.note ?? "");
              }
            }}
            placeholder="Why? (optional, Enter to save)"
            className="h-6 w-56 max-w-full rounded-md border border-input bg-card px-2 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <button type="button" onClick={() => setNoting(true)} className="text-[11px] text-muted-foreground hover:text-foreground">
            {vote.note ? "Edit note" : "+ Note"}
          </button>
        ))}
    </span>
  );
}

// ── a factor key: summary, then every passage ───────────────────────────────

export type RefState = KeyPassages | "loading" | "error";

const SIDE_GROUPS: Array<{ scope: ReferenceScope; count: (r: KeyPassages) => number; title: string; hint: string }> = [
  { scope: "transits", count: (r) => r.transits, title: "About transits", hint: "from a section on transits or progressions, not on the birth chart" },
  { scope: "twoCharts", count: (r) => r.twoCharts, title: "About relationships between two charts", hint: "from a section comparing two people's charts" },
  { scope: "example", count: (r) => r.example, title: "From a worked example chart", hint: "said of one example chart, not of the placement in general" },
  { scope: "other", count: (r) => r.other, title: "Other combinations", hint: "about this placement together with placements this chart doesn't have" },
  { scope: "mentions", count: (r) => r.mentions, title: "About something else, mentions it", hint: "the passage's subject is another placement" },
  { scope: "mismatch", count: (r) => r.mismatch, title: "Context mismatch", hint: "tagged from a sibling heading — its “this placement” means something else" },
  { scope: "passing", count: (r) => r.passing, title: "Mentions in passing", hint: "named in passing, without a placement" },
];

export function FactorItem({
  factor,
  state,
  canSee,
  groupBy,
  defaultOpen,
}: {
  factor: { key: string; label: string };
  state: RefState | undefined;
  canSee: boolean;
  groupBy: "book" | "author";
  defaultOpen: boolean;
}) {
  const [all, setAll] = useState(false);
  const r = state && state !== "loading" && state !== "error" ? state : null;
  const term = highlightOf(factor.key, factor.label);
  const head = (
    <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
      <span className="min-w-0">
        <span className="text-sm">{factor.label}</span>
        <code className="ml-2 break-all font-mono text-[10.5px] text-muted-foreground">{factor.key}</code>
      </span>
      {canSee && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {state === "loading" ? "…" : state === "error" ? "—" : r ? (
            <>
              {r.helpful > 0 && <span className="mr-1.5 text-gold">★{r.helpful}</span>}
              <span className={cn("font-semibold", r.books >= 10 ? "text-primary" : r.books >= 3 ? "text-foreground" : "")}>{r.books}</span> book{r.books === 1 ? "" : "s"}
            </>
          ) : null}
        </span>
      )}
    </div>
  );
  if (!canSee || !r) return <li className="rounded-lg border border-border/60 px-3 py-2">{head}</li>;

  const groups =
    groupBy === "book"
      ? r.byBook.map((b) => ({ name: b.title, sub: b.author, n: b.passages }))
      : Object.values(
          r.byBook.reduce<Record<string, { name: string; sub: string | null; n: number; books: number }>>((acc, b) => {
            const k = b.author ?? b.title;
            acc[k] ??= { name: k, sub: null, n: 0, books: 0 };
            acc[k].n += b.passages;
            acc[k].books += 1;
            acc[k].sub = `${acc[k].books} book${acc[k].books === 1 ? "" : "s"}`;
            return acc;
          }, {}),
        ).sort((a, b) => b.n - a.n);

  return (
    <li className="rounded-lg border border-border/60">
      <details open={defaultOpen} className="group">
        <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
          <span className="mt-0.5 text-xs text-muted-foreground transition-transform group-open:rotate-90">›</span>
          {head}
        </summary>
        <div className="space-y-3 px-3 pb-3">
          {r.passages === 0 ? (
            <p className="text-xs text-muted-foreground">No passage about this fits the chart{r.other + r.mentions + r.mismatch + r.passing + r.transits + r.twoCharts + r.example > 0 ? " — see the groups below" : " yet"}.</p>
          ) : all ? (
            <FullList factorKey={factor.key} term={term} total={r.passages} scope="fit" initialSort={groupBy} onClose={() => setAll(false)} />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {r.books} book{r.books === 1 ? "" : "s"} by {r.authors} author{r.authors === 1 ? "" : "s"} have passages about this that fit the chart · {r.passages} passage
                {r.passages === 1 ? "" : "s"}
                {r.more > 0 ? ` (${r.more} naming more of it)` : ""}
                {r.tossed > 0 ? ` · ${r.tossed} tossed` : ""}
              </p>
              <ul className="space-y-4">
                {r.top.map((p) => (
                  <PassageCard key={p.textId} p={p} factorKey={factor.key} term={term} />
                ))}
              </ul>
              <button type="button" onClick={() => setAll(true)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent">
                Show all {r.passages}
              </button>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Who says the most ({groupBy})</div>
                <ol className="space-y-0.5 text-xs">
                  {groups.slice(0, 8).map((g) => (
                    <li key={g.name} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {g.name}
                        {g.sub && <span className="text-muted-foreground"> · {g.sub}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{g.n}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
          {SIDE_GROUPS.filter((g) => g.count(r) > 0).map((g) => (
            <SideGroup key={g.scope} factorKey={factor.key} term={term} scope={g.scope} total={g.count(r)} title={g.title} hint={g.hint} groupBy={groupBy} />
          ))}
        </div>
      </details>
    </li>
  );
}

/** A collapsed group of passages kept out of the main list; loaded when opened. */
function SideGroup({
  factorKey,
  term,
  scope,
  total,
  title,
  hint,
  groupBy,
}: {
  factorKey: string;
  term: string;
  scope: ReferenceScope;
  total: number;
  title: string;
  hint: string;
  groupBy: "book" | "author";
}) {
  const [open, setOpen] = useState(false);
  return (
    <details className="rounded-md border border-dashed border-border" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-muted-foreground">
        {title} ({total}) · {hint}
      </summary>
      {open && (
        <div className="px-2.5 pb-2.5">
          <FullList factorKey={factorKey} term={term} total={total} scope={scope} initialSort={groupBy} />
        </div>
      )}
    </details>
  );
}

const PAGE = 25;
const SORT_LABEL: Record<ReferenceSort, string> = { rank: "Ranked", book: "By book", author: "By author" };

/** Every passage on one key in one group: paged ("Load more"), filterable, sorted or grouped by book or author. */
function FullList({
  factorKey,
  term,
  total,
  scope,
  initialSort,
  onClose,
}: {
  factorKey: string;
  term: string;
  total: number;
  scope: ReferenceScope;
  initialSort: "book" | "author";
  onClose?: () => void;
}) {
  const { chartId } = useRefs();
  const [sort, setSort] = useState<ReferenceSort>(initialSort === "author" ? "author" : "rank");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PassageRef[]>([]);
  const [matching, setMatching] = useState(total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (offset: number) => {
      const id = ++req.current;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ key: factorKey, chartId, scope, offset: String(offset), limit: String(PAGE), sort, ...(query ? { q: query } : {}) });
        const res = await fetch(withBase(`/api/astro/references?${qs}`));
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (id !== req.current) return;
        const page = json.page as ReferencePage;
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setMatching(page.total);
        setError(null);
      } catch (e) {
        if (id === req.current) setError(e instanceof Error ? e.message : "Could not load");
      } finally {
        if (id === req.current) setLoading(false);
      }
    },
    [factorKey, sort, query, scope, chartId],
  );
  useEffect(() => {
    load(0);
  }, [load]);

  const groupName = (p: PassageRef) => (sort === "author" ? (p.book.author ?? p.book.title) : p.book.title);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {scope !== "passing" && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter these passages…"
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Filter passages"
          />
        )}
        {scope !== "passing" && (
          <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
            {(["rank", "book", "author"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSort(s)} className={cn("px-2 py-1", sort === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                {SORT_LABEL[s]}
              </button>
            ))}
          </div>
        )}
        {onClose && (
          <button type="button" onClick={onClose} className="text-[11px] text-muted-foreground hover:text-foreground">
            Summary
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {query ? `${matching} of ${total} match “${query}”` : `${total} passages`} · showing {items.length}
        {scope === "passing" ? " · by book" : sort === "rank" ? " · helpful first, then those naming more of this chart, tossed last" : " · tossed last"}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="space-y-4">
        {items.map((p, i) => {
          const g = groupName(p);
          const header = sort !== "rank" && scope !== "passing" && (i === 0 || groupName(items[i - 1]) !== g);
          return (
            <li key={p.textId} className="list-none">
              {header && (
                <div className="mb-1.5 mt-2 text-[11px] font-semibold text-foreground">
                  {sort === "author" ? g : <span className="italic">{g}</span>}
                  {sort === "book" && p.book.author ? <span className="font-normal text-muted-foreground"> · {p.book.author}</span> : null}
                </div>
              )}
              <ul>
                <PassageCard p={p} factorKey={factorKey} term={term} showBook={sort !== "book"} />
              </ul>
            </li>
          );
        })}
      </ul>
      {items.length < matching && (
        <button type="button" disabled={loading} onClick={() => load(items.length)} className="w-full rounded-md border border-border py-1.5 text-xs hover:bg-accent disabled:opacity-60">
          {loading ? "Loading…" : `Load more (${matching - items.length} left)`}
        </button>
      )}
      {loading && items.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}
    </div>
  );
}

// ── Favourites ───────────────────────────────────────────────────────────────

/** A vote with its passage, classified against the chart being viewed. */
type VoteItem = RefVoteListItem & { chartName: string | null; ref: PassageRef };

/** The owner's helpful passages (and the toss list), grouped by factor key. */
export function Favourites({ chartId, factorLabels }: { chartId: string; factorLabels: Record<string, string> }) {
  const [scope, setScope] = useState<"chart" | "all">("chart");
  const [verdict, setVerdict] = useState<Verdict>("helpful");
  const [list, setList] = useState<VoteItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setList(null);
    const qs = new URLSearchParams({ verdict, viewChart: chartId, ...(scope === "chart" ? { chartId } : {}) });
    fetch(withBase(`/api/astro/ref-votes?${qs}`))
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        if (live) setList(json.votes as VoteItem[]);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : "Could not load"));
    return () => {
      live = false;
    };
  }, [scope, verdict, chartId]);

  const groups = useMemo(() => {
    const m = new Map<string, VoteItem[]>();
    for (const v of list ?? []) m.set(v.factorKey, [...(m.get(v.factorKey) ?? []), v]);
    return [...m.entries()];
  }, [list]);

  const toggle = <T extends string>(value: T, set: (v: T) => void, options: readonly [T, string][]) => (
    <div className="flex overflow-hidden rounded-md border border-border text-xs">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => set(v)} className={cn("px-2.5 py-1", value === v ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="rounded-xl border border-border bg-card/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{verdict === "helpful" ? "Favourites" : "Tossed"}</h3>
        <div className="flex flex-wrap gap-2">
          {toggle(verdict, setVerdict, [["helpful", "★ Helpful"], ["not", "✕ Tossed"]] as const)}
          {toggle(scope, setScope, [["chart", "This chart"], ["all", "All charts"]] as const)}
        </div>
      </div>
      <VoteError />
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      {!list && !error && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {list && list.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {verdict === "helpful" ? "Nothing starred yet. Mark passages ☆ Helpful in the chart view and they collect here." : "Nothing tossed."}
        </p>
      )}
      <div className="mt-4 space-y-5">
        {groups.map(([key, items]) => {
          const label = factorLabels[key] ?? items[0].factorLabel ?? key;
          return (
            <div key={key}>
              <div className="mb-2 flex items-baseline justify-between gap-2 border-b border-border/60 pb-1">
                <span className="text-sm">{label}</span>
                <code className="font-mono text-[10.5px] text-muted-foreground">{key}</code>
              </div>
              <ul className="space-y-4">
                {items.map((v) => (
                  <PassageCard
                    key={`${v.textId}|${key}`}
                    p={v.ref}
                    factorKey={key}
                    term={highlightOf(key, label)}
                    extra={scope === "all" && v.chartId !== chartId ? `voted on ${v.chartName ?? "another chart"}` : undefined}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
