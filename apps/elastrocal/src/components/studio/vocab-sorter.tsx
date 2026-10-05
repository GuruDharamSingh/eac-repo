"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { groupKey, matchGroup } from "@elkdonis/astro-corpus";
import type { VocabCard, VocabSearchHit } from "@elkdonis/astro-corpus/server";
import { addVocabTermAction, searchVocabAction, vocabReviewAction, type VocabReviewInput } from "@/app/hub/studio/vocabulary/actions";
import { cn } from "@/lib/utils";
import { useVocabUndo } from "@/components/studio/use-vocab-undo";

/**
 * One vocabulary card, sorted with as few taps (or keys) as possible.
 *
 * A term can sit in several groups: tap your groups (or press 1–9) to choose
 * them, type to find one or to name a new one, then "Save groups" (Enter).
 * The generator's hints are offered as suggestions that fill the group field —
 * never applied for you. "Rename" sets your preferred label; "Same as…"
 * searches the other cards and marks this one a synonym (it joins all of
 * that card's groups). n = not a term, s = skip, u = undo.
 *
 * Every action shows a toast with "Undo"; the Undo button (u) takes back the
 * latest, and "Last 5 actions" can take back any of them.
 *
 * Each example sentence takes a rating (good example / weak / wrong sense)
 * with an optional note, and "Add a term from this sentence": select words in
 * it (or type them) to make a new card of your own. "Suggest a term" adds one
 * from scratch. Your own terms are served right after the first deck.
 */

type Payload = Record<string, unknown>;

const KIND_LABEL: Record<string, string> = {
  body_or_point: "body or point",
  sign_or_quality: "sign or quality",
  house_or_division: "house or division",
  aspect_or_configuration: "aspect or configuration",
  condition_or_state: "condition or state",
  relation_or_rulership: "relation or rulership",
  technique_or_method: "technique or method",
  cycle_or_phase: "cycle or phase",
  branch_or_school: "branch or school",
  author_coinage: "author's coinage",
  correspondence: "correspondence",
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** VOCAB_GROUPS_PER_CARD in @elkdonis/astro-corpus. */
const MAX_GROUPS = 8;

export function VocabSorter({
  card,
  current,
  groups,
  ratings,
  history,
  revisiting,
}: {
  card: VocabCard;
  current: { verdict: string; groups: string[]; preferred: string | null; sameAs: string | null } | null;
  groups: { name: string; cards: number }[];
  ratings: { text: string; rating: string; note: string | null }[];
  /** The last few undoable actions, newest first. */
  history: { reviewId: string; label: string }[];
  revisiting: boolean;
}) {
  const router = useRouter();
  const notify = useVocabUndo();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");
  // Groups chosen for this card; a re-sort starts from the card's own.
  const [selected, setSelected] = useState<string[]>(current?.verdict === "group" && !current.sameAs ? current.groups : []);
  const [preferred, setPreferred] = useState(current?.preferred ?? "");
  const [renaming, setRenaming] = useState(Boolean(current?.preferred));
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [sameOpen, setSameOpen] = useState(false);
  const opened = useRef(performance.now());
  const groupInput = useRef<HTMLInputElement>(null);

  const names = groups.map((g) => g.name);
  const shown = filter.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(filter.trim().toLowerCase()) || groupKey(g.name) === groupKey(filter))
    : groups;
  const top = shown.slice(0, 9);
  const typed = filter.replace(/\s+/g, " ").trim();
  // Typing "Aspects" when he has "Aspect" uses his group: no near-duplicates.
  const exact = typed ? matchGroup(typed, names) : null;
  // The generator's hints, as his own group when one matches (case, plural, punctuation ignored).
  const kindName = card.kindHint ? capital(KIND_LABEL[card.kindHint] ?? card.kindHint.replace(/_/g, " ")) : null;
  const hintGroup = matchGroup(card.groupHint, names);
  const kindGroup = matchGroup(kindName, names);
  const suggested = new Set([hintGroup, kindGroup].filter((x): x is string => Boolean(x)));
  // A new group typed but not yet in the list shows as a chip of its own.
  const newOnes = selected.filter((s) => !groups.some((g) => g.name === s));

  const send = (action: VocabReviewInput["action"], payload: Payload, message: string) =>
    startTransition(async () => {
      const r = await vocabReviewAction({ action, payload, seconds: Math.round((performance.now() - opened.current) / 1000) });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (action !== "vocab-undo") notify(message, r.reviewId);
      if (revisiting && action !== "vocab-undo") router.push("/hub/studio/vocabulary");
      else router.refresh();
    });

  const toggle = (name: string) => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : s.length >= MAX_GROUPS ? s : [...s, name]));
  const addTyped = () => {
    if (!typed) return;
    const name = exact ?? typed;
    setSelected((s) => (s.some((x) => x.toLowerCase() === name.toLowerCase()) || s.length >= MAX_GROUPS ? s : [...s, name]));
    setFilter("");
  };
  const extras = () => ({ preferred: renaming && preferred.trim() ? preferred.trim() : undefined, note: note.trim() || undefined });
  const save = () => {
    if (!selected.length) {
      toast.error("Choose at least one group");
      return;
    }
    send("vocab-sort", { cardId: card.id, verdict: "group", groups: selected, ...extras() }, `“${card.term}” → ${selected.join(", ")}`);
  };
  const sameAs = (other: { id: string; label: string }) =>
    send("vocab-sort", { cardId: card.id, verdict: "group", sameAs: other.id, ...extras() }, `“${card.term}” = ${other.label}`);
  const notTerm = () => send("vocab-sort", { cardId: card.id, verdict: "not-a-term", note: note.trim() || undefined }, `“${card.term}”: not a term`);
  const skip = () => send("vocab-sort", { cardId: card.id, verdict: "skip", note: note.trim() || undefined }, `“${card.term}” skipped`);
  const undo = (reviewId?: string) => {
    const id = reviewId ?? history[0]?.reviewId;
    if (!id) return;
    startTransition(async () => {
      const r = await vocabReviewAction({ action: "vocab-undo", payload: { reviewId: id } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast("Undone");
      router.refresh();
    });
  };

  // Keyboard: digits toggle the top groups, Enter saves, n / s / u — not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || pending) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "BUTTON" || el.isContentEditable)) return;
      if (/^[1-9]$/.test(e.key)) {
        const g = top[Number(e.key) - 1];
        if (g) {
          e.preventDefault();
          toggle(g.name);
        }
      } else if (e.key === "Enter" && selected.length) {
        e.preventDefault();
        save();
      } else if (e.key === "n") notTerm();
      else if (e.key === "s") skip();
      else if (e.key === "u") undo();
      else if (e.key === "g" || e.key === "/") {
        e.preventDefault();
        groupInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const suggest = (name: string) => {
    setFilter(name);
    groupInput.current?.focus();
  };

  return (
    <div className="mt-6">
      {current && (
        <p className="mb-3 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Currently:{" "}
          {current.verdict === "group"
            ? `${current.groups.join(", ") || "no group"}${current.preferred ? ` · as “${current.preferred}”` : ""}${current.sameAs ? " · a synonym" : ""}`
            : current.verdict === "skip"
              ? "skipped"
              : "not a term"}
        </p>
      )}

      {/* The card */}
      <p className="mb-2 mt-4 text-sm">
        <span className="font-medium">Where does this word belong?</span>{" "}
        <span className="text-muted-foreground">
          Pick one or more of your groups below (or type a new one), then save · or mark it the same as another word · or “not a term”.
        </span>
      </p>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h1 className="text-3xl font-semibold leading-tight" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif", letterSpacing: "normal" }}>
          {card.term}
        </h1>
        {card.also.length > 0 && <p className="mt-1 text-sm text-muted-foreground">also {card.also.join(" · ")}</p>}
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {card.books.toLocaleString()} book{card.books === 1 ? "" : "s"} · {card.uses.toLocaleString()} uses
          {card.deckOrder ? ` · first deck #${card.deckOrder}` : ""}
        </p>
        {card.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.sources.map((s, i) => (
              <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {s.source}
                {s.detail && <span className="text-foreground"> · {s.detail}</span>}
              </span>
            ))}
          </div>
        )}
        {card.examples.length > 0 && (
          <details className="mt-4">
            {/* The word in use, for when it is unclear; each sentence can be rated, and words in it added as terms. */}
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-primary">
              Not sure what it means here? See how the books use “{card.term}”
            </summary>
            <ul className="mt-2 space-y-3">
              {card.examples.slice(0, 2).map((e, i) => (
                <ExampleItem
                  key={i}
                  cardId={card.id}
                  index={i}
                  example={e}
                  terms={[card.term, ...card.also]}
                  current={ratings.find((r) => r.text === e.text) ?? null}
                />
              ))}
            </ul>
          </details>
        )}
      </section>

      <SuggestTerm cardId={card.id} />

      {/* Hints: shown as his own group when one matches (one tap chooses it), else one tap fills the group field. Never applied for him. */}
      {(card.groupHint || card.kindHint) && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {card.groupHint &&
            (hintGroup ? (
              <button
                type="button"
                onClick={() => toggle(hintGroup)}
                className={cn(
                  "rounded-full border border-dashed px-3 py-1",
                  selected.includes(hintGroup) ? "border-primary bg-primary/10 text-primary" : "border-primary/60 text-primary",
                )}
                title={hintGroup !== card.groupHint ? `The list suggests “${card.groupHint}”: that is your group “${hintGroup}”` : undefined}
              >
                Suggested: your group “{hintGroup}”{selected.includes(hintGroup) ? " ✓" : ""}
              </button>
            ) : (
              <button type="button" onClick={() => suggest(card.groupHint!)} className="rounded-full border border-dashed border-primary/60 px-3 py-1 text-primary">
                Suggested group: {card.groupHint}
              </button>
            ))}
          {kindName &&
            kindGroup !== hintGroup &&
            (kindGroup ? (
              <button type="button" onClick={() => toggle(kindGroup)} className="rounded-full border border-dashed border-border px-3 py-1 text-muted-foreground">
                Suggested kind: your group “{kindGroup}”{selected.includes(kindGroup) ? " ✓" : ""}
              </button>
            ) : (
              <button type="button" onClick={() => suggest(kindName)} className="rounded-full border border-dashed border-border px-3 py-1 text-muted-foreground">
                Suggested kind: {kindName.toLowerCase()}
              </button>
            ))}
        </div>
      )}

      {/* Groups: tap to choose one or more, then save */}
      <section className="mt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (typed) addTyped();
            else save();
          }}
          className="flex gap-2"
        >
          <input
            ref={groupInput}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setFilter("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            maxLength={80}
            placeholder={groups.length ? "Find a group, or name a new one (g)" : "Name your first group"}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            autoCapitalize="sentences"
          />
          <button
            type="button"
            disabled={pending || !typed}
            onClick={addTyped}
            className="rounded-lg border border-primary px-3 text-sm text-primary disabled:opacity-50"
          >
            {exact ? "Choose" : "+ New group"}
          </button>
        </form>
        {exact && exact !== typed && <p className="mt-1 text-xs text-primary">Using your group “{exact}”</p>}
        {(top.length > 0 || newOnes.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {top.map((g, i) => {
              const on = selected.includes(g.name);
              return (
                <button
                  key={g.name}
                  type="button"
                  disabled={pending}
                  aria-pressed={on}
                  onClick={() => toggle(g.name)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : suggested.has(g.name)
                        ? "border-dashed border-primary text-primary"
                        : "border-border hover:border-primary/60",
                  )}
                  title={!on && suggested.has(g.name) ? "Suggested for this card" : undefined}
                >
                  <span className={cn("mr-1 text-[10px] tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>{i + 1}</span>
                  {on && "✓ "}
                  {g.name} <span className={cn("text-xs", on ? "opacity-80" : "text-muted-foreground")}>{g.cards}</span>
                </button>
              );
            })}
            {newOnes.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className="rounded-full border border-dashed border-primary bg-primary/10 px-3 py-1.5 text-sm text-primary"
                title="New group — tap to remove"
              >
                ✓ {n} <span className="text-xs">new</span>
              </button>
            ))}
            {shown.length > top.length && <span className="self-center text-xs text-muted-foreground">+{shown.length - top.length} more: type to find</span>}
          </div>
        )}
        {selected.some((s) => !top.some((g) => g.name === s) && !newOnes.includes(s)) && (
          <p className="mt-1 text-xs text-muted-foreground">Also chosen: {selected.filter((s) => !top.some((g) => g.name === s) && !newOnes.includes(s)).join(", ")}</p>
        )}
        <button
          type="button"
          disabled={pending || selected.length === 0}
          onClick={save}
          className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Save groups ({selected.length}) <kbd className="ml-1 text-[10px] opacity-80">Enter</kbd>
        </button>
      </section>

      {/* Rename, note, same as */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <button type="button" onClick={() => setRenaming(!renaming)} className="text-primary">
          {renaming ? "Keep the term as it is" : "Rename (your preferred label)"}
        </button>
        <button type="button" onClick={() => setNoting(!noting)} className="text-primary">
          {noting ? "No note" : "Note"}
        </button>
        <button type="button" onClick={() => setSameOpen(!sameOpen)} className="text-primary">
          Same as…
        </button>
      </div>
      {renaming && (
        <input
          value={preferred}
          onChange={(e) => setPreferred(e.target.value)}
          maxLength={120}
          placeholder={`Your label for “${card.term}” (saved with the groups you choose)`}
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      )}
      {noting && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Note (saved with your decision)"
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      )}
      {sameOpen && <SameAs cardId={card.id} pending={pending} onPick={sameAs} onClose={() => setSameOpen(false)} />}

      {/* Not a term, skip, undo */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <button type="button" disabled={pending} onClick={notTerm} className="rounded-xl border border-border px-3 py-3 text-sm disabled:opacity-50">
          Not a term <kbd className="ml-1 text-[10px] text-muted-foreground">n</kbd>
        </button>
        <button type="button" disabled={pending} onClick={skip} className="rounded-xl border border-border px-3 py-3 text-sm disabled:opacity-50">
          Skip <kbd className="ml-1 text-[10px] text-muted-foreground">s</kbd>
        </button>
        <button
          type="button"
          disabled={pending || history.length === 0}
          onClick={() => undo()}
          title={history[0] ? `Undo: ${history[0].label}` : "Nothing to undo"}
          className="rounded-xl border border-gold/70 px-3 py-3 text-sm text-foreground hover:bg-gold/10 disabled:opacity-40"
        >
          ↶ Undo <kbd className="ml-1 text-[10px] text-muted-foreground">u</kbd>
        </button>
      </div>
      {history[0] && <p className="mt-1 text-center text-xs text-muted-foreground">Undo would take back: {history[0].label}</p>}

      {history.length > 0 && (
        <details className="mt-4 rounded-xl border border-border/60 px-3 py-2 text-sm">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground">Last {history.length} actions</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.reviewId} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs">{h.label}</span>
                <button type="button" disabled={pending} onClick={() => undo(h.reviewId)} className="shrink-0 rounded-lg border border-border px-2 py-0.5 text-[11px] hover:border-primary/60">
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Keys: 1–9 choose your top groups · Enter save · g find a group · n not a term · s skip · u undo
      </p>
    </div>
  );
}

function SameAs({
  cardId,
  pending,
  onPick,
  onClose,
}: {
  cardId: string;
  pending: boolean;
  onPick: (card: { id: string; label: string }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<VocabSearchHit[]>([]);
  const [searching, startSearch] = useTransition();
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => startSearch(async () => setHits(await searchVocabAction(query, cardId))), 250);
    return () => clearTimeout(t);
  }, [q, cardId]);
  return (
    <div className="mt-2 rounded-xl border border-border p-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        maxLength={100}
        placeholder="Search the other cards (sorted ones first)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        autoCapitalize="none"
      />
      {searching && <p className="mt-1 text-xs text-muted-foreground">Searching…</p>}
      {hits.length > 0 && (
        <ul className="mt-1 divide-y divide-border/60 rounded-lg border border-border">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick({ id: h.id, label: h.preferred ?? h.term })}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>
                  {h.preferred ?? h.term}
                  {h.preferred && <span className="text-xs text-muted-foreground"> ({h.term})</span>}
                  {h.also.length > 0 && <span className="block text-[11px] text-muted-foreground">also {h.also.slice(0, 4).join(" · ")}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{h.groups.length ? h.groups.join(", ") : "not sorted"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && !searching && hits.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No card matches.</p>}
      <button type="button" onClick={onClose} className="mt-2 text-xs text-muted-foreground">
        Close
      </button>
    </div>
  );
}


/** The example sentence with the card's term (or its other spellings) in bold. */
function highlight(text: string, terms: string[]): React.ReactNode {
  const words = terms.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`\\b(${words.join("|")})\\b`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <b key={i} className="font-semibold text-foreground">{part}</b> : part));
}

const RATING_LABEL: Record<string, string> = { good: "Good example", weak: "Weak", "wrong-sense": "Wrong sense" };
const RATING_TITLE: Record<string, string> = {
  good: "Shows clearly what the term means",
  weak: "The term is there, but the sentence doesn't show much",
  "wrong-sense": "The word means something else in this sentence",
};

/** One example sentence: rate it, note why, or add words from it as a new term. */
function ExampleItem({
  cardId,
  index,
  example: e,
  terms,
  current,
}: {
  cardId: string;
  index: number;
  example: { text: string; book: string | null };
  terms: string[];
  current: { rating: string; note: string | null } | null;
}) {
  const router = useRouter();
  const notify = useVocabUndo();
  const [pending, startTransition] = useTransition();
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(current?.note ?? "");
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState("");
  const [existing, setExisting] = useState<{ id: string; term: string } | null>(null);
  const sentence = useRef<HTMLParagraphElement>(null);

  const rate = (rating: string, withNote?: string) =>
    startTransition(async () => {
      const r = await vocabReviewAction({
        action: "vocab-example",
        payload: { cardId, example: index, text: e.text, book: e.book ?? undefined, rating, note: rating === "clear" ? undefined : withNote?.trim() || undefined },
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setNoting(false);
      notify(rating === "clear" ? `Example ${index + 1}: rating cleared` : `Example ${index + 1}: ${RATING_LABEL[rating]}`, r.reviewId);
      router.refresh();
    });

  /** Open the add box with the words selected inside this sentence, if any. */
  const startAdd = () => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const inside = sel && sentence.current && sel.anchorNode && sentence.current.contains(sel.anchorNode);
    setTerm(inside ? sel!.toString().replace(/\s+/g, " ").trim() : "");
    setExisting(null);
    setAdding(true);
  };
  const add = () =>
    startTransition(async () => {
      const r = await addVocabTermAction({ term, fromCardId: cardId, fromExample: index });
      if (!r.ok) {
        if (r.existing) setExisting(r.existing);
        else toast.error(r.error);
        return;
      }
      notify(`Added “${r.term}”: it comes up right after the first deck`, r.reviewId);
      setAdding(false);
      setTerm("");
    });

  return (
    <li className="border-l-2 border-gold/60 pl-3 text-sm leading-relaxed text-muted-foreground">
      <p ref={sentence}>{highlight(e.text, terms)}</p>
      {e.book && <span className="mt-0.5 block text-[11px]">— {e.book}</span>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {(["good", "weak", "wrong-sense"] as const).map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            title={RATING_TITLE[k]}
            onClick={() => rate(current?.rating === k ? "clear" : k, note)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px]",
              current?.rating === k
                ? k === "good"
                  ? "border-primary bg-primary text-primary-foreground"
                  : k === "wrong-sense"
                    ? "border-destructive bg-destructive/15 text-destructive"
                    : "border-gold bg-gold/20 text-foreground"
                : "border-border hover:border-primary/60",
            )}
          >
            {RATING_LABEL[k]}
          </button>
        ))}
        <button type="button" onClick={() => setNoting(!noting)} className="text-[11px] text-primary">
          {current?.note ? "Edit note" : "Note"}
        </button>
        {/* onMouseDown: keep the selection in the sentence when the button takes focus */}
        <button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={startAdd} className="text-[11px] text-primary">
          + Add a term from this sentence
        </button>
      </div>
      {current?.note && !noting && <p className="mt-1 text-[11px] italic">“{current.note}”</p>}
      {noting && (
        <div className="mt-1.5">
          <textarea
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="How well does it show the term? (saved with your rating)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(["good", "weak", "wrong-sense"] as const).map((k) => (
              <button
                key={k}
                type="button"
                disabled={pending || !note.trim()}
                onClick={() => rate(k, note)}
                className="rounded-lg border border-border px-2.5 py-1 text-[11px] text-foreground disabled:opacity-50"
              >
                Save as “{RATING_LABEL[k]}”
              </button>
            ))}
          </div>
        </div>
      )}
      {adding && (
        <div className="mt-1.5 rounded-lg border border-border p-2">
          <p className="text-[11px]">Select words in the sentence first, or type the term:</p>
          <div className="mt-1 flex gap-2">
            <input
              value={term}
              onChange={(ev) => {
                setTerm(ev.target.value);
                setExisting(null);
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && term.trim()) add();
              }}
              autoFocus
              maxLength={120}
              placeholder="e.g. moksha"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <button type="button" disabled={pending || !term.trim()} onClick={add} className="rounded-lg bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-border px-2 text-xs">
              Cancel
            </button>
          </div>
          {existing && (
            <p className="mt-1 text-[11px]">
              Already a card:{" "}
              <a href={`/astro/hub/studio/vocabulary?c=${existing.id}`} className="text-primary">
                {existing.term}
              </a>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** "Suggest a term": a term of your own, not taken from a sentence. */
function SuggestTerm({ cardId }: { cardId: string }) {
  const notify = useVocabUndo();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const [existing, setExisting] = useState<{ id: string; term: string } | null>(null);
  const add = () =>
    startTransition(async () => {
      const r = await addVocabTermAction({ term, fromCardId: cardId, note: note.trim() || null });
      if (!r.ok) {
        if (r.existing) setExisting(r.existing);
        else toast.error(r.error);
        return;
      }
      notify(`Added “${r.term}”: it comes up right after the first deck`, r.reviewId);
      setTerm("");
      setNote("");
      setOpen(false);
    });
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs text-primary">
        + Suggest a term the list is missing
      </button>
    );
  return (
    <div className="mt-2 rounded-xl border border-border p-3">
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(ev) => {
            setTerm(ev.target.value);
            setExisting(null);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && term.trim()) add();
          }}
          autoFocus
          maxLength={120}
          placeholder="The term, as you would write it"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <button type="button" disabled={pending || !term.trim()} onClick={add} className="rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">
          Add
        </button>
      </div>
      <input
        value={note}
        onChange={(ev) => setNote(ev.target.value)}
        maxLength={1000}
        placeholder="Note (optional): what it means, where it comes from"
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      {existing && (
        <p className="mt-1 text-xs text-muted-foreground">
          Already a card:{" "}
          <a href={`/astro/hub/studio/vocabulary?c=${existing.id}`} className="text-primary">
            {existing.term}
          </a>
        </p>
      )}
      <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs text-muted-foreground">
        Close
      </button>
    </div>
  );
}
