"use client";

import { useEffect, useId, useRef, useState } from "react";
import { stemOf, type Footnote, type FootnotedSentence } from "@/lib/footnotes";
import { cn } from "@/lib/utils";

/**
 * Footnotes on AI-written text: superscript markers [1] [2] after a
 * statement; hover, focus or tap one for where it came from and why (see
 * lib/footnotes.ts). The popover closes on Esc, on a tap or click outside,
 * and when the pointer leaves. Markers are real buttons, so they work from
 * the keyboard; clicks inside never reach a surrounding clickable card.
 */

const pagesLabel = (pages: readonly number[]) =>
  pages.length ? `p. ${pages[0]}${pages.length > 1 && pages[pages.length - 1] !== pages[0] ? `–${pages[pages.length - 1]}` : ""}` : "";

/** A sentence with its shared words highlighted. */
function Highlit({ text, shared }: { text: string; shared: readonly string[] }) {
  const set = new Set(shared);
  const parts = text.split(/([A-Za-z][A-Za-z'-]+)/);
  return (
    <>
      {parts.map((p, i) => {
        const st = i % 2 === 1 ? stemOf(p) : null;
        return st && set.has(st) ? (
          <mark key={i} className="rounded-sm bg-gold/25 px-0.5 text-foreground">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
    </>
  );
}

function NoteBody({ note }: { note: Footnote }) {
  return (
    <div className="space-y-2 text-xs leading-snug">
      <p className="text-muted-foreground">
        {note.book ? <span className="italic text-foreground">{note.book}</span> : "Unknown book"}
        {note.author ? `, ${note.author}` : ""}
        {pagesLabel(note.pages) ? `, ${pagesLabel(note.pages)}` : ""}
      </p>
      {(note.breadcrumb.length > 0 || note.ignored.length > 0) && (
        <p className="text-[11px] text-muted-foreground">
          {note.breadcrumb.join(" › ")}
          {note.ignored.length > 0 && <span className="italic"> (ignored sibling heading: {note.ignored.join("; ")})</span>}
        </p>
      )}
      {note.subject && (
        <p className="text-[11px]">
          <span className="text-muted-foreground">Passage is about </span>
          <span className="font-medium">{note.subject}</span>
        </p>
      )}
      {note.weak && (
        <p className="rounded bg-gold/15 px-2 py-1 text-[11px]">
          Weak support: the sentence shares only {note.weak.shared} of its {note.weak.of} content words with this source.
        </p>
      )}
      {note.contextWarning && (
        <p className="rounded bg-fire/10 px-2 py-1 text-[11px] text-fire">
          Context check: {note.contextWarning} Pronouns and “this placement” in it refer to that.
        </p>
      )}
      {note.found ? (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Source sentence{note.sentences.length > 1 ? "s" : ""} · approximate (shared words)</p>
          {note.sentences.map((s) => (
            <blockquote key={s.n} className="mt-1 border-l-2 border-gold/60 pl-2">
              <span className="mr-1 text-[10px] text-muted-foreground">{s.n}.</span>
              <Highlit text={s.text} shared={s.shared} />
            </blockquote>
          ))}
        </div>
      ) : (
        <p className="rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">No source sentence found in this passage by shared words.</p>
      )}
      {note.viaClaim && (
        <p className="text-[11px] text-muted-foreground">
          Matched through the AI digest&apos;s claim (unverified): <span className="italic">“{note.viaClaim}”</span>
        </p>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Why</p>
        {note.because ? (
          <p className="mt-0.5">
            <span className="text-muted-foreground">The book&apos;s reason: </span>
            <span className="italic">{note.because}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-muted-foreground">The book gives no reason here.</p>
        )}
      </div>
      {note.tags.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Why these tags</p>
          <ul className="mt-0.5 space-y-0.5">
            {note.tags.map((t) => (
              <li key={t.key} className={cn(t.unsupported && "text-fire")}>
                <span className="font-medium">{t.label}</span>
                <span className={cn(!t.unsupported && "text-muted-foreground")}> — {t.from}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One superscript marker and its popover. */
export function FootnoteMarker({ n, note, missing }: { n: number; note?: Footnote; missing?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = () => {
    if (pinned) return;
    timer.current = setTimeout(() => setOpen(false), 180);
  };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <span ref={root} className="relative inline-block align-super leading-none" onMouseEnter={enter} onMouseLeave={leave} onClick={stop} onKeyDown={stop}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={missing ? `Footnote ${n}: no source found` : `Footnote ${n}: source`}
        onFocus={enter}
        onBlur={leave}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !(p && open));
          setOpen((o) => !(o && pinned));
        }}
        className={cn(
          "mx-px rounded px-0.5 text-[10px] font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          missing ? "text-fire hover:bg-fire/10" : "text-primary hover:bg-accent",
        )}
      >
        [{missing ? "?" : n}
        {note?.weak ? "~" : ""}]
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={missing ? "No source found" : `Source for footnote ${n}`}
          className="absolute left-0 top-full z-50 mt-1 block w-[min(24rem,calc(100vw-2rem))] cursor-auto whitespace-normal rounded-xl border border-border bg-popover p-3 text-left align-baseline font-normal text-popover-foreground shadow-lg"
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          {missing || !note ? (
            <span className="block text-xs">
              <span className="font-medium text-fire">No source found.</span>{" "}
              <span className="text-muted-foreground">None of the passages the AI was given shares enough words with this sentence — it may be the AI&apos;s own invention.</span>
            </span>
          ) : (
            <NoteBody note={note} />
          )}
        </span>
      )}
    </span>
  );
}

/** A statement followed by its footnote markers. */
export function Footnoted({ text, notes, start = 1, className }: { text: string; notes: Footnote[]; start?: number; className?: string }) {
  return (
    <span className={className}>
      {text}
      {notes.length === 0 ? <FootnoteMarker n={start} missing /> : notes.map((note, i) => <FootnoteMarker key={i} n={start + i} note={note} />)}
    </span>
  );
}

/** A draft, sentence by sentence, each with its footnote (or a "no source found" marker). */
export function FootnotedDraft({ sentences }: { sentences: FootnotedSentence[] }) {
  let n = 0;
  return (
    <>
      {sentences.map((s, i) => {
        const start = n + 1;
        n += Math.max(1, s.notes.length);
        return (
          <span key={i} className={cn(s.notes.length === 0 && "decoration-fire/40 decoration-dotted underline-offset-4 [text-decoration-line:underline]")}>
            <Footnoted text={s.text} notes={s.notes} start={start} />{" "}
          </span>
        );
      })}
    </>
  );
}
