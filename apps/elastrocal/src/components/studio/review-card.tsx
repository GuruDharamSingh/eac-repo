"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DeckCandidate, DeckItem } from "@elkdonis/astro-corpus/server";
import { submitReviewAction, type ReviewFormInput } from "@/app/hub/studio/actions";
import { cn } from "@/lib/utils";
import { FootnotedDraft } from "@/components/footnote";
import type { FootnotedSentence } from "@/lib/footnotes";

/**
 * One question in the review deck, laid out for a phone.
 *
 * The question and its candidates scroll; the levers sit in a bar at the
 * bottom. Each lever changes what the candidates do:
 *   Pick   tap the better answer (or "Same"), optionally say why
 *   Rate   score one answer 1–5 on faithful / specific / usable
 *   Fix    edit an answer into the one you would give
 *   Write  write your own (the phone keyboard's microphone dictates)
 *   More   skip, flag, or correct the factor tags
 * "View" records whether the answer states a preference of yours or a claim
 * you hold to be true; it is remembered between questions.
 * Pick, Rate and Fix have an optional "Explain" section: why, in your own
 * words, plus an optional quoted phrase, severity and (Rate/Fix) reason chips.
 * Left closed and empty, the review is saved exactly as before.
 */

type Mode = "pick" | "rate" | "fix" | "write" | "more";
type Stance = "preference" | "claim";
type About = "winner" | "loser" | "both";
type Severity = "minor" | "major";

const LETTERS = "ABCDEFGHIJKL";
const STANCE_KEY = "elastrocal:studio-stance";
const TRADITION_KEY = "elastrocal:studio-tradition";

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the default is used next time */
  }
}

export function ReviewCard({
  question,
  candidates,
  footnotes = {},
  explainHref,
  gold,
  pickReasons,
  flagReasons,
  traditions,
}: {
  question: DeckItem["question"];
  candidates: DeckCandidate[];
  /** Per-sentence sources for AI drafts, by candidate id (lib/draft-footnotes.ts). */
  footnotes?: Record<string, FootnotedSentence[]>;
  /** "Explain my thinking" for this question (not for test questions). */
  explainHref?: string;
  gold: DeckItem["gold"];
  pickReasons: string[];
  flagReasons: string[];
  traditions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const started = useRef(performance.now());

  const initialMode: Mode = question.isTest ? "write" : candidates.length >= 2 ? "pick" : candidates.length === 1 ? "rate" : "write";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [stance, setStance] = useState<Stance>("preference");
  const [tradition, setTradition] = useState<string>("");

  const [winner, setWinner] = useState<string | null | undefined>(undefined); // null = tie
  const [reasons, setReasons] = useState<string[]>([]);
  const [target, setTarget] = useState<string | null>(candidates[0]?.id ?? null);
  const [scores, setScores] = useState<{ faithful?: number; specific?: number; usable?: number }>({});
  const [draft, setDraft] = useState("");
  const [flag, setFlag] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(question.factorKeys);
  const [newTag, setNewTag] = useState("");

  const [explainOpen, setExplainOpen] = useState(false);
  const [exText, setExText] = useState("");
  const [exAbout, setExAbout] = useState<About>("winner");
  const [exQuote, setExQuote] = useState("");
  const [exSeverity, setExSeverity] = useState<Severity | null>(null);
  const [exPrinciples, setExPrinciples] = useState<string[]>([]);

  useEffect(() => {
    const s = readLocal(STANCE_KEY);
    if (s === "claim" || s === "preference") setStance(s);
    const t = readLocal(TRADITION_KEY);
    if (t !== null) setTradition(t);
  }, []);

  // Fix starts from the chosen candidate's text.
  useEffect(() => {
    if (mode === "fix") setDraft(candidates.find((c) => c.id === target)?.body ?? "");
    if (mode === "write") setDraft("");
  }, [mode, target, candidates]);

  const shownOrder = useMemo(() => candidates.map((c) => c.id), [candidates]);

  const ready =
    mode === "pick"
      ? winner !== undefined
      : mode === "rate"
        ? Boolean(target && scores.faithful && scores.specific && scores.usable)
        : mode === "fix" || mode === "write"
          ? draft.trim().length >= 10
          : false;

  function submit(action: ReviewFormInput["action"], payload: Record<string, unknown>, candidateIds: string[]) {
    const input: ReviewFormInput = {
      questionId: question.id,
      action,
      candidateIds,
      shownOrder,
      stance: action === "skip" || action === "flag" || action === "tag" ? null : stance,
      seconds: Math.round((performance.now() - started.current) / 100) / 10,
      payload,
    };
    startTransition(async () => {
      const r = await submitReviewAction(input);
      if (!r.ok) {
        toast.error(r.error ?? "Could not save");
        return;
      }
      if (action === "tag") {
        toast.success("Tags saved");
        return;
      }
      router.refresh();
      window.scrollTo({ top: 0 });
    });
  }

  /** The explanation to send with a pick, rate or fix: nothing unless some text was written. */
  function explanation(): Record<string, unknown> {
    const text = exText.trim();
    if (!text) return {};
    const quote = exQuote.trim();
    return {
      explanation: {
        text,
        about: mode === "pick" ? exAbout : "answer",
        ...(quote ? { quote } : {}),
        ...(exSeverity ? { severity: exSeverity } : {}),
        ...(mode !== "pick" && exPrinciples.length ? { principles: exPrinciples } : {}),
      },
    };
  }

  /** Fill the quote from text selected inside one of the answers. */
  function quoteSelection() {
    const sel = window.getSelection()?.toString().replace(/\s+/g, " ").trim() ?? "";
    const squash = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
    if (sel && candidates.some((c) => squash(c.body).includes(sel.toLowerCase()))) setExQuote(sel.slice(0, 300));
    else toast.message("Select a phrase in one of the answers first, or type it");
  }

  function save() {
    const trad = tradition || null;
    if (mode === "pick") submit("pick", { winner: winner ?? null, reasons, ...explanation() }, shownOrder);
    else if (mode === "rate" && target) submit("rate", { textId: target, scores, ...explanation() }, [target]);
    else if (mode === "fix" && target) submit("fix", { fromTextId: target, body: draft, tradition: trad, ...explanation() }, [target]);
    else if (mode === "write") submit("write", { body: draft, tradition: trad }, []);
  }

  const explainable = mode === "pick" || mode === "rate" || mode === "fix";

  const modes: { key: Mode; label: string; hidden?: boolean }[] = [
    { key: "pick", label: "Pick", hidden: candidates.length < 2 || question.isTest },
    { key: "rate", label: "Rate", hidden: candidates.length < 1 || question.isTest },
    { key: "fix", label: "Fix", hidden: candidates.length < 1 || question.isTest },
    { key: "write", label: "Write" },
    { key: "more", label: "More" },
  ];

  return (
    <div className="mt-4">
      {question.isTest && (
        <div className="mb-4 rounded-2xl border border-gold/60 bg-card px-4 py-3 text-sm">
          <span className="font-semibold">Test question.</span> Write your own answer, without looking anything up. It is
          the standard the AI is scored against and is never used for training.
        </div>
      )}
      {/* The question */}
      <div className="flex flex-wrap gap-1.5">
        {question.factorLabels.map((l) => (
          <span key={l} className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
            {l}
          </span>
        ))}
        {question.tradition && (
          <span className="rounded-full border border-gold/60 px-2.5 py-0.5 text-xs text-gold">{question.tradition}</span>
        )}
      </div>
      {/* Inline face: globals.css sets h1 to Cinzel (capitals only) outside any
          layer, so a Tailwind font utility cannot override it. */}
      <h1 className="mt-3 text-xl font-semibold leading-snug" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", letterSpacing: "normal" }}>
        {question.prompt}
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {question.sourceTitle ? `From ${question.sourceTitle}` : "Studio question"}
        {question.original && (
          <>
            {" · "}
            <details className="inline">
              <summary className="inline cursor-pointer underline decoration-dotted">original wording</summary>
              <span className="mt-1 block italic">{question.original}</span>
            </details>
          </>
        )}
      </p>

      {explainHref && (
        <Link
          href={explainHref}
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/60 bg-primary/5 px-4 py-3 text-sm text-primary transition-colors hover:bg-primary/10"
        >
          <span>
            <span className="block font-semibold">Give your own answer and let the AI guess your reasoning</span>
            <span className="block text-xs text-muted-foreground">Explain my thinking: write what you think; the AI proposes the reasoning and the passages behind it.</span>
          </span>
          <span aria-hidden className="text-lg">→</span>
        </Link>
      )}

      {/* Candidates */}
      <ol className="mt-5 space-y-3">
        {candidates.map((c, i) => {
          const selectedPick = mode === "pick" && winner === c.id;
          const selectedTarget = (mode === "rate" || mode === "fix") && target === c.id;
          const tappable = mode === "pick" || mode === "rate" || mode === "fix";
          return (
            <li key={c.id}>
              {/* A div acting as the button, so footnote markers (buttons) can sit inside the answer. */}
              <div
                role="button"
                tabIndex={tappable ? 0 : -1}
                aria-disabled={!tappable}
                onClick={() => {
                  if (!tappable) return;
                  // Dragging to select a phrase to quote is not a tap on the answer.
                  if (window.getSelection()?.toString().trim()) return;
                  if (mode === "pick") setWinner(c.id);
                  else setTarget(c.id);
                }}
                onKeyDown={(e) => {
                  if (!tappable || (e.key !== "Enter" && e.key !== " ")) return;
                  e.preventDefault();
                  if (mode === "pick") setWinner(c.id);
                  else setTarget(c.id);
                }}
                className={cn(
                  "w-full rounded-2xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedPick || selectedTarget ? "border-primary ring-2 ring-primary/30" : "border-border",
                  tappable && "cursor-pointer active:bg-accent",
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                      selectedPick || selectedTarget ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  <span>{c.sourceTitle}</span>
                  {c.tradition && <span>· {c.tradition}</span>}
                </div>
                {!(mode === "fix" && selectedTarget) && (
                  <p className={cn("mt-2 whitespace-pre-line text-[15px] leading-relaxed", explainOpen && "select-text")}>
                    {footnotes[c.id] ? <FootnotedDraft sentences={footnotes[c.id]} /> : c.body}
                  </p>
                )}
                {footnotes[c.id] && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    [n] = the passage the AI was given that best supports the sentence (shared words, approximate) ·{" "}
                    <span>[n~]</span> = weak support · <span className="text-fire">[?]</span> = no source found{" "}
                    ({footnotes[c.id].filter((s) => s.notes.length === 0).length} of {footnotes[c.id].length} sentences)
                  </p>
                )}
              </div>

              {mode === "rate" && selectedTarget && (
                <div className="mt-2 space-y-2 rounded-2xl border border-border/60 p-3">
                  {(["faithful", "specific", "usable"] as const).map((dim) => (
                    <div key={dim} className="flex items-center justify-between gap-2">
                      <span className="w-20 text-sm capitalize">{dim}</span>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setScores((s) => ({ ...s, [dim]: n }))}
                            className={cn(
                              "size-10 rounded-full border text-sm tabular-nums",
                              scores[dim] === n ? "border-primary bg-primary text-primary-foreground" : "border-border",
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground">
                    Faithful: true to the placement and the tradition. Specific: says something this placement does and others do not. Usable: you would say it to a client.
                  </p>
                </div>
              )}

              {mode === "fix" && selectedTarget && (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  className="mt-2 w-full rounded-2xl border border-primary bg-background p-4 text-[15px] leading-relaxed"
                  aria-label={`Corrected version of answer ${LETTERS[i]}`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {candidates.length === 0 && mode !== "write" && (
        <p className="mt-5 text-sm text-muted-foreground">No answers yet. Write one.</p>
      )}

      {mode === "pick" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setWinner(null)}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-sm",
              winner === null ? "border-primary bg-primary text-primary-foreground" : "border-border",
            )}
          >
            About the same
          </button>
          <div className="mt-3 flex flex-wrap gap-2">
            {pickReasons.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  reasons.includes(r) ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "write" && (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={10}
          placeholder="Your interpretation. The microphone on the keyboard dictates."
          className="mt-5 w-full rounded-2xl border border-primary bg-background p-4 text-[15px] leading-relaxed"
          aria-label="Your interpretation"
        />
      )}

      {(mode === "fix" || mode === "write") && (
        <label className="mt-3 flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Tradition</span>
          <select
            value={tradition}
            onChange={(e) => {
              setTradition(e.target.value);
              writeLocal(TRADITION_KEY, e.target.value);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
            <option value="">Not stated</option>
            {traditions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

      {explainable && candidates.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border/60">
          <button
            type="button"
            onClick={() => setExplainOpen((o) => !o)}
            aria-expanded={explainOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-sm"
          >
            <span className="font-medium">Explain (optional)</span>
            <span className="text-xs text-muted-foreground">
              {exText.trim() ? "written · " : ""}
              {explainOpen ? "hide" : "why?"}
            </span>
          </button>
          {explainOpen && (
            <div className="space-y-3 px-4 pb-4">
              <textarea
                value={exText}
                onChange={(e) => setExText(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Why, in your own words. A line is enough."
                className="w-full rounded-xl border border-border bg-background p-3 text-[15px] leading-relaxed"
                aria-label="Explanation"
              />

              {mode === "pick" ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">About</span>
                  <div className="flex rounded-full border border-border p-0.5">
                    {(["winner", "loser", "both"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setExAbout(a)}
                        className={cn("rounded-full px-3 py-1", exAbout === a ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                      >
                        {a === "winner" ? "the better one" : a === "loser" ? "the worse one" : "both"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {pickReasons.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setExPrinciples((ps) => (ps.includes(r) ? ps.filter((x) => x !== r) : [...ps, r]))}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs",
                        exPrinciples.includes(r) ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">How much it matters</span>
                <div className="flex rounded-full border border-border p-0.5">
                  {(["minor", "major"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setExSeverity((cur) => (cur === s ? null : s))}
                      className={cn("rounded-full px-3 py-1", exSeverity === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  value={exQuote}
                  onChange={(e) => setExQuote(e.target.value)}
                  maxLength={300}
                  placeholder="Quote the phrase you mean (optional)"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label="Quoted phrase"
                />
                <button
                  type="button"
                  // Keep the text selection alive: a tap would otherwise clear it before the click.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={quoteSelection}
                  className="rounded-lg border border-border px-3 text-xs"
                >
                  Use selection
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "more" && (
        <div className="mt-5 space-y-6">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("skip", {}, [])}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm"
          >
            Skip this question
          </button>

          <div>
            <h2 className="text-sm font-semibold">Flag the question</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {flagReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setFlag(r)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs",
                    flag === r ? "border-destructive bg-destructive/10 text-destructive" : "border-border text-muted-foreground",
                  )}
                >
                  {r.replace("-", " ")}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!flag || pending}
              onClick={() => flag && submit("flag", { reason: flag }, [])}
              className="mt-3 rounded-xl border border-destructive px-4 py-2 text-sm text-destructive disabled:opacity-40"
            >
              Flag and remove from the queue
            </button>
          </div>

          <div>
            <h2 className="text-sm font-semibold">Factor tags</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags((ts) => ts.filter((x) => x !== t))}>
                    ×
                  </button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="sign:moon:scorpio"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                autoCapitalize="none"
                autoCorrect="off"
              />
              <button
                type="button"
                onClick={() => {
                  const k = newTag.trim();
                  if (k && !tags.includes(k)) setTags((ts) => [...ts, k]);
                  setNewTag("");
                }}
                className="rounded-lg border border-border px-3 text-sm"
              >
                Add
              </button>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                submit(
                  "tag",
                  {
                    add: tags.filter((t) => !question.factorKeys.includes(t)),
                    remove: question.factorKeys.filter((t) => !tags.includes(t)),
                  },
                  [],
                )
              }
              className="mt-3 rounded-xl border border-border px-4 py-2 text-sm"
            >
              Save tags
            </button>
          </div>
        </div>
      )}

      {gold.length > 0 && (
        <details className="mt-6 rounded-2xl border border-border/60 p-4 text-sm">
          <summary className="cursor-pointer select-none font-medium">Already written for this factor ({gold.length})</summary>
          <ul className="mt-3 space-y-3">
            {gold.map((g) => (
              <li key={g.id} className="whitespace-pre-line text-muted-foreground">
                {g.body}
                <span className="mt-1 block text-[11px]">
                  {g.kind === "edit" ? "corrected" : "written"}
                  {g.tradition ? ` · ${g.tradition}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* The levers */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Your view is a</span>
            <div className="flex rounded-full border border-border p-0.5">
              {(["preference", "claim"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStance(s);
                    writeLocal(STANCE_KEY, s);
                  }}
                  className={cn("rounded-full px-3 py-1", stance === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
              {modes
                .filter((m) => !m.hidden)
                .map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-sm",
                      mode === m.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
            </div>
            {mode !== "more" && (
              <button
                type="button"
                disabled={!ready || pending}
                onClick={save}
                className="rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {pending ? "…" : "Save"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
