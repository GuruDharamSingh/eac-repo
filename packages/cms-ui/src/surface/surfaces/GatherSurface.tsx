"use client";

import * as React from "react";
import type {
  SurfaceDescriptor,
  SurfaceGathered,
  SurfaceGatherCandidate,
  SurfaceGatherRelation,
} from "../types";
import { useSurface } from "../context";
import { SurfaceFrame, SurfaceSection, SurfaceSkeleton } from "../SurfaceShell";

// ============================================================================
// Arrange what a thread holds.
//
// The week's meeting produced a document, three definitions, a discussion and
// a couple of board cards. The BAND on the thread shows them as one occasion;
// this is where somebody puts them there.
//
// A pushed layer over the thread rather than a section of the compose form,
// because gathering happens after the fact — you attach last week's minutes
// to last week's meeting, long after that row was written — and compose is for
// a thread's own columns. It also means the occasion stays on screen
// underneath, which is the whole reason the surface stack exists.
//
// Two halves, in the order the work happens: what is already here (removable,
// reorderable), then what could be added. Nothing is staged and nothing is
// saved — each action is its own call, because a half-arranged gathering that
// vanished on close would lose work nobody knew was unsaved.
// ============================================================================

type Descriptor = Extract<SurfaceDescriptor, { type: "gather" }>;

const RELATION_LABEL: Record<SurfaceGatherRelation, string> = {
  gathers: "Part of this",
  produced: "Came out of this",
  talk: "Discussion of this",
  cites: "Referred to",
};

const GLYPH: Record<string, string> = {
  thread: "▸",
  // `document` is both a kind and a legacy target type — see ThreadView.
  document: "▭",
  wiki_page: "\u203B",
  file: "▤",
  deck_card: "▦",
  deck_label: "▦",
  quote: "“",
  link: "↗",
};

export function GatherSurface({ descriptor }: { descriptor: Descriptor }) {
  const { connectors } = useSurface();
  const gather = connectors.gather;

  const [items, setItems] = React.useState<SurfaceGathered[] | null>(null);
  const [candidates, setCandidates] = React.useState<SurfaceGatherCandidate[]>([]);
  const [q, setQ] = React.useState("");
  const [relation, setRelation] = React.useState<SurfaceGatherRelation>("gathers");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<"normal" | "error">("normal");

  const load = React.useCallback(async () => {
    if (!gather) return;
    try {
      setItems(await gather.list(descriptor.threadId));
    } catch {
      setItems([]);
      say("Could not read what this holds.", "error");
    }
  }, [gather, descriptor.threadId]);

  function say(message: string, t: "normal" | "error" = "normal") {
    setNotice(message);
    setTone(t);
  }

  React.useEffect(() => {
    void load();
  }, [load]);

  // Search is debounced rather than fired per keystroke: `candidates` searches
  // threads, documents and possibly a Nextcloud board, which is too expensive
  // to run on every letter.
  React.useEffect(() => {
    if (!gather) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const found = await gather.candidates(descriptor.threadId, q.trim());
        if (live) setCandidates(found);
      } catch {
        if (live) setCandidates([]);
      }
    }, q.trim() ? 220 : 0);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [gather, descriptor.threadId, q]);

  if (!gather) {
    return (
      <SurfaceFrame kind="neutral" title={descriptor.title ?? "Gather"}>
        <p className="eac-surface-empty">This site has not wired gathering.</p>
      </SurfaceFrame>
    );
  }

  const attached = items ?? [];
  // Already-attached things are not offered again. The unique index would
  // refuse the second attach anyway; this keeps the list honest rather than
  // letting someone click a row that cannot do anything.
  const heldKeys = new Set(
    attached.map((i) => `${i.targetType}:${i.threadId ?? i.title}`)
  );

  async function attach(candidate: SurfaceGatherCandidate) {
    const key = `${candidate.targetType}:${candidate.targetThreadId ?? candidate.targetRef}`;
    setBusy(key);
    const ok = await gather!.attach(descriptor.threadId, { ...candidate, relation });
    setBusy(null);
    if (!ok) {
      say("Could not attach that.", "error");
      return;
    }
    say(`Added “${candidate.title}”.`);
    await load();
    connectors.onMutated?.();
  }

  async function detach(item: SurfaceGathered) {
    setBusy(item.id);
    const ok = await gather!.detach(descriptor.threadId, item.id);
    setBusy(null);
    if (!ok) {
      say("Could not remove that.", "error");
      return;
    }
    // Worth saying plainly: people hesitate to remove an attachment in case
    // it deletes the document.
    say(`Removed “${item.title}”. The ${nounFor(item)} itself is untouched.`);
    await load();
    connectors.onMutated?.();
  }

  async function move(index: number, delta: number) {
    if (!gather!.reorder) return;
    const next = [...attached];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    setItems(next);
    const ok = await gather!.reorder(descriptor.threadId, next.map((i) => i.id));
    if (!ok) {
      say("Could not save that order.", "error");
      await load();
    }
  }

  return (
    <SurfaceFrame
      kind="neutral"
      title={descriptor.title ?? "What this holds"}
      kicker="Gather"
      status={notice}
      statusTone={tone}
    >
      <SurfaceSection title="Held here">
        {items === null ? (
          <SurfaceSkeleton />
        ) : attached.length === 0 ? (
          <p className="eac-surface-muted">
            Nothing yet. Attach the document written here, the discussion it
            started, or the board it moved — they will show on this thread as
            one occasion.
          </p>
        ) : (
          <ul className="eac-occ-list">
            {attached.map((item, i) => (
              <li key={item.id} className="eac-gather-held">
                <div className="eac-occ eac-occ--static">
                  <span className="eac-occ-glyph" aria-hidden>
                    {(item.kind && GLYPH[item.kind]) ?? GLYPH[item.targetType] ?? "▪"}
                  </span>
                  <span>
                    <span className="eac-occ-title">{item.title}</span>
                    <span className="eac-occ-meta">
                      {[item.subtitle, RELATION_LABEL[item.relation]].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </div>
                <div className="eac-gather-tools">
                  {gather.reorder && (
                    <>
                      <button
                        type="button"
                        className="eac-btn eac-btn--quiet"
                        onClick={() => void move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${item.title} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="eac-btn eac-btn--quiet"
                        onClick={() => void move(i, 1)}
                        disabled={i === attached.length - 1}
                        aria-label={`Move ${item.title} down`}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="eac-btn eac-btn--quiet"
                    onClick={() => void detach(item)}
                    disabled={busy === item.id}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SurfaceSection>

      <SurfaceSection title="Add something">
        <div className="eac-gather-add">
          <input
            type="search"
            className="eac-gather-input"
            placeholder="Search threads, documents, board cards…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            aria-label="Search for something to attach"
          />
          <label className="eac-gather-rel">
            <span>as</span>
            <select
              className="eac-gather-input"
              value={relation}
              onChange={(e) => setRelation(e.currentTarget.value as SurfaceGatherRelation)}
            >
              {(Object.keys(RELATION_LABEL) as SurfaceGatherRelation[]).map((r) => (
                <option key={r} value={r}>
                  {RELATION_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {candidates.length === 0 ? (
          <p className="eac-surface-muted">
            {q.trim() ? "Nothing matching." : "Start typing to find something."}
          </p>
        ) : (
          <ul className="eac-occ-list">
            {candidates
              .filter(
                (c) => !heldKeys.has(`${c.targetType}:${c.targetThreadId ?? c.title}`)
              )
              .map((c) => {
                const key = `${c.targetType}:${c.targetThreadId ?? c.targetRef}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className="eac-occ"
                      onClick={() => void attach(c)}
                      disabled={busy === key}
                    >
                      <span className="eac-occ-glyph" aria-hidden>
                        {GLYPH[c.targetType] ?? "▪"}
                      </span>
                      <span>
                        <span className="eac-occ-title">{c.title}</span>
                        {c.subtitle && <span className="eac-occ-meta">{c.subtitle}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </SurfaceSection>
    </SurfaceFrame>
  );
}

/** What to call the thing in "the ___ itself is untouched". */
function nounFor(item: SurfaceGathered): string {
  switch (item.targetType) {
    case "document":
      return "document";
    case "deck_card":
    case "deck_label":
      return "board";
    case "file":
      return "file";
    case "link":
      return "page";
    default:
      return "thread";
  }
}
