"use client";

import * as React from "react";
import type {
  SurfaceAction,
  SurfaceBoard,
  SurfaceBoardCard,
  SurfaceBoardComment,
  SurfaceBoardStack,
  SurfaceDescriptor,
} from "../types";
import { useLayer, useSurface } from "../context";
import { SurfaceFacts, SurfaceFrame, SurfaceSection, SurfaceSkeleton } from "../SurfaceShell";
import { fmtShortDate, type FormatOptions } from "../format";

// ============================================================================
// The org's board, as a surface — and one card of it, as another.
//
// Every org has the same Kanban: lists, cards, due dates, comments. Each app
// had drawn its own (amrit-canada's Pipeline, inner-gathering's, IFAC's stub),
// so the same board looked different on every hub. This is the standard
// rendering: tall columns, a heavy rule under each list name, counts in ink,
// cards you can read at arm's length. It reads the host-neutral SurfaceBoard
// shape through `connectors.board`; the host maps Deck (or anything with lists
// and cards) onto it.
//
// Drag-and-drop stays on the full page — a popup is for looking something up
// and changing one thing. Here a card opens on top as its own surface, where
// it can be renamed, moved to another list, given a date, marked done, and
// discussed. "Open the board" goes to the page.
// ============================================================================

function labelStyle(color?: string | null): React.CSSProperties | undefined {
  if (!color) return undefined;
  const hex = color.replace(/^#/, "");
  const n = parseInt(hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex, 16);
  if (Number.isNaN(n)) return undefined;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { background: `#${hex}`, color: luma > 150 ? "#111" : "#fff" };
}

function dueMeta(card: SurfaceBoardCard, fmt: FormatOptions): React.ReactNode {
  if (!card.dueAt) return null;
  const due = new Date(card.dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const overdue = !card.done && due.getTime() < Date.now();
  return <span className={overdue ? "is-overdue" : undefined}>{overdue ? "Overdue · " : "Due "}{fmtShortDate(due, fmt)}</span>;
}

export function BoardSurface() {
  const { connectors, push } = useSurface();
  const layer = useLayer();
  const fmt: FormatOptions = { timeZone: connectors.timeZone, locale: connectors.locale };
  const [board, setBoard] = React.useState<SurfaceBoard | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [adding, setAdding] = React.useState<string | number | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!connectors.board) {
      setState("missing");
      return;
    }
    setState("loading");
    try {
      const b = await connectors.board.load();
      if (!b) return setState("missing");
      setBoard(b);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [connectors.board]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    layer.setMeta({ title: board?.title ?? "Board", kind: "board", size: "full" });
  }, [layer, board?.title]);

  async function addCard(stackId: string | number) {
    const title = draft.trim();
    if (!title || !connectors.board?.createCard || !board) return;
    setBusy(true);
    const card = await connectors.board.createCard(stackId, title);
    setBusy(false);
    if (!card) return;
    setDraft("");
    setBoard({
      ...board,
      stacks: board.stacks.map((s) => (s.id === stackId ? { ...s, cards: [...s.cards, card] } : s)),
    });
    connectors.onMutated?.();
  }

  const total = board?.stacks.reduce((n, s) => n + s.cards.length, 0) ?? 0;
  const actions: SurfaceAction[] = [];
  if (board?.pageHref) actions.push({ label: "Open the board", primary: true, href: board.pageHref });

  return (
    <SurfaceFrame
      kind="board"
      title={board?.title ?? "Board"}
      kicker={connectors.orgName ? `Board · ${connectors.orgName}` : "Board"}
      actions={actions}
      status={
        state === "ready"
          ? `${total} ${total === 1 ? "card" : "cards"} in ${board?.stacks.length ?? 0} lists`
          : state === "loading"
            ? "Loading…"
            : null
      }
      flush
    >
      {state === "loading" && (
        <div style={{ padding: 20 }}>
          <SurfaceSkeleton block />
        </div>
      )}
      {state === "missing" && <p className="eac-surface-empty">This org has no board yet.</p>}
      {state === "error" && (
        <p className="eac-surface-empty">
          Could not load the board.{" "}
          <button type="button" className="eac-btn eac-btn--quiet" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {state === "ready" && board && (
        <div className="eac-board" style={{ padding: "14px 16px 16px" }}>
          {board.stacks.map((stack) => (
            <section key={stack.id} className="eac-board-col" aria-label={stack.title}>
              <header className="eac-board-col-head">
                <h3>{stack.title}</h3>
                <span className="eac-board-count">{stack.cards.length}</span>
              </header>
              <div className="eac-board-cards">
                {stack.cards.length === 0 && <p className="eac-board-empty">Nothing here yet.</p>}
                {stack.cards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`eac-board-card${card.done ? " is-done" : ""}`}
                    onClick={() => push({ type: "boardCard", cardId: card.id, preview: { title: card.title } })}
                  >
                    {card.labels && card.labels.length > 0 && (
                      <span className="eac-board-labels">
                        {card.labels.map((l) => (
                          <span key={l.id} className="eac-board-label" style={labelStyle(l.color)}>
                            {l.title}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="eac-board-card-title">{card.title}</span>
                    {(card.dueAt || card.commentsCount || card.attachmentCount || card.assignees?.length) && (
                      <span className="eac-board-card-meta">
                        {dueMeta(card, fmt)}
                        {card.commentsCount ? <span>{card.commentsCount} comments</span> : null}
                        {card.attachmentCount ? <span>{card.attachmentCount} files</span> : null}
                        {card.assignees?.length ? <span>{card.assignees.join(", ")}</span> : null}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {board.canWrite && connectors.board?.createCard && (
                adding === stack.id ? (
                  <form
                    className="eac-board-add-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void addCard(stack.id);
                    }}
                  >
                    <input
                      autoFocus
                      className="eac-input"
                      placeholder="Card name"
                      value={draft}
                      disabled={busy}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setAdding(null);
                          setDraft("");
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="submit" className="eac-btn eac-btn--primary" disabled={busy || !draft.trim()}>
                        Add
                      </button>
                      <button type="button" className="eac-btn eac-btn--quiet" onClick={() => setAdding(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="eac-board-add" onClick={() => { setAdding(stack.id); setDraft(""); }}>
                    + Add a card
                  </button>
                )
              )}
            </section>
          ))}
        </div>
      )}
    </SurfaceFrame>
  );
}

// ── one card ─────────────────────────────────────────────────────────────────

type CardDescriptor = Extract<SurfaceDescriptor, { type: "boardCard" }>;

export function BoardCardSurface({ descriptor }: { descriptor: CardDescriptor }) {
  const { connectors, pop } = useSurface();
  const layer = useLayer();
  const fmt: FormatOptions = { timeZone: connectors.timeZone, locale: connectors.locale };
  const [board, setBoard] = React.useState<SurfaceBoard | null>(null);
  const [card, setCard] = React.useState<SurfaceBoardCard | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "missing" | "error">("loading");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [due, setDue] = React.useState("");
  const [stackId, setStackId] = React.useState<string | number>("");
  const [comments, setComments] = React.useState<SurfaceBoardComment[] | null>(null);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!connectors.board) return setState("missing");
      try {
        const b = await connectors.board.load();
        if (cancelled) return;
        const found = b?.stacks.flatMap((s) => s.cards).find((c) => String(c.id) === String(descriptor.cardId));
        if (!b || !found) return setState("missing");
        setBoard(b);
        setCard(found);
        setTitle(found.title);
        setDescription(found.description ?? "");
        setDue(found.dueAt ? found.dueAt.slice(0, 10) : "");
        setStackId(found.stackId);
        setState("ready");
        if (connectors.board.listComments) {
          connectors.board.listComments(found.id).then((c) => !cancelled && setComments(c)).catch(() => setComments([]));
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectors.board, descriptor.cardId]);

  React.useEffect(() => {
    layer.setMeta({ title: card?.title ?? descriptor.preview?.title ?? "Card", kind: "board", size: "wide" });
  }, [layer, card?.title, descriptor.preview?.title]);

  const stack: SurfaceBoardStack | undefined = board?.stacks.find((s) => s.id === card?.stackId);
  const canWrite = Boolean(board?.canWrite);

  async function save() {
    if (!card || !connectors.board) return;
    setSaving(true);
    setNotice(null);
    let ok = true;
    if (connectors.board.updateCard) {
      ok = await connectors.board.updateCard(card.id, {
        title: title.trim() || card.title,
        description,
        dueAt: due ? `${due}T12:00:00` : null,
      });
    }
    if (ok && stackId !== card.stackId && connectors.board.moveCard) {
      ok = await connectors.board.moveCard(card.id, stackId);
    }
    setSaving(false);
    if (!ok) return setNotice("Could not save that.");
    connectors.onMutated?.();
    pop();
  }

  async function toggleDone() {
    if (!card || !connectors.board?.setDone) return;
    const ok = await connectors.board.setDone(card.id, !card.done);
    if (!ok) return setNotice("Could not change that.");
    setCard({ ...card, done: !card.done });
    connectors.onMutated?.();
  }

  async function postComment() {
    if (!card || !connectors.board?.addComment || !comment.trim()) return;
    const ok = await connectors.board.addComment(card.id, comment.trim());
    if (!ok) return setNotice("Could not post that comment.");
    setComment("");
    if (connectors.board.listComments) setComments(await connectors.board.listComments(card.id));
  }

  if (state !== "ready" || !card || !board) {
    return (
      <SurfaceFrame kind="board" title={descriptor.preview?.title} kicker="Card">
        {state === "loading" ? <SurfaceSkeleton /> : <p className="eac-surface-empty">This card is no longer on the board.</p>}
      </SurfaceFrame>
    );
  }

  const actions: SurfaceAction[] = [{ label: "Cancel", quiet: true, onClick: pop }];
  if (canWrite && connectors.board?.setDone) {
    actions.push(card.done ? { label: "Done ✓", done: true, onClick: toggleDone } : { label: "Mark done", onClick: toggleDone });
  }
  if (canWrite && (connectors.board?.updateCard || connectors.board?.moveCard)) {
    actions.push({ label: saving ? "Saving…" : "Save", primary: true, onClick: save, disabled: saving });
  }

  const rail = (
    <>
      <SurfaceFacts
        facts={[
          { label: "List", value: stack?.title ?? null },
          { label: "Due", value: card.dueAt ? fmtShortDate(card.dueAt, fmt) : null },
          { label: "Labels", value: card.labels?.length ? card.labels.map((l) => l.title).join(", ") : null },
          { label: "Assigned", value: card.assignees?.length ? card.assignees.join(", ") : null },
          { label: "Files", value: card.attachmentCount ? String(card.attachmentCount) : null },
        ]}
      />
      {canWrite && connectors.board?.moveCard && board.stacks.length > 1 && (
        <SurfaceSection title="Move to">
          <div className="eac-field">
            <select className="eac-input" value={String(stackId)} onChange={(e) => setStackId(board.stacks.find((s) => String(s.id) === e.target.value)?.id ?? stackId)}>
              {board.stacks.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        </SurfaceSection>
      )}
    </>
  );

  return (
    <SurfaceFrame
      kind="board"
      title={card.title}
      kicker={`${board.title} · ${stack?.title ?? "Card"}`}
      rail={rail}
      actions={actions}
      status={notice ?? (card.done ? "Done" : null)}
      statusTone={notice ? "error" : "normal"}
    >
      <div className="eac-board-detail">
        {canWrite && connectors.board?.updateCard ? (
          <>
            <div className="eac-field">
              <label className="eac-field-label" htmlFor="bc-title">Title</label>
              <input id="bc-title" className="eac-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="eac-field-row">
              <div className="eac-field">
                <label className="eac-field-label" htmlFor="bc-due">Due</label>
                <input id="bc-due" type="date" className="eac-input" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
            <div className="eac-field">
              <label className="eac-field-label" htmlFor="bc-desc">Description</label>
              <textarea id="bc-desc" rows={6} className="eac-input eac-input--textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this card is about, in plain words or markdown." />
            </div>
          </>
        ) : (
          <div className="eac-surface-prose">
            {card.description ? <p style={{ whiteSpace: "pre-wrap" }}>{card.description}</p> : <p className="eac-surface-muted">No description.</p>}
          </div>
        )}

        {connectors.board?.listComments && (
          <SurfaceSection title="Comments">
            <div className="eac-board-comments">
              {comments === null && <SurfaceSkeleton />}
              {comments?.length === 0 && <p className="eac-surface-muted">No comments yet.</p>}
              {comments?.map((c) => (
                <div key={c.id} className="eac-board-comment">
                  <span className="eac-board-comment-meta">{c.author} · {fmtShortDate(c.at, fmt)}</span>
                  <p>{c.message}</p>
                </div>
              ))}
              {canWrite && connectors.board?.addComment && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void postComment();
                  }}
                  style={{ display: "grid", gap: 6 }}
                >
                  <textarea className="eac-input eac-input--textarea" rows={2} placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <div>
                    <button type="submit" className="eac-btn" disabled={!comment.trim()}>
                      Post
                    </button>
                  </div>
                </form>
              )}
            </div>
          </SurfaceSection>
        )}
      </div>
    </SurfaceFrame>
  );
}

// ── the face preview ─────────────────────────────────────────────────────────

/**
 * The board at a glance, for a face: each list as a stack of bars with its
 * name and count. Server-renderable. Up to six bars per list so a long
 * backlog reads as "many" rather than pushing the title off the tile.
 */
export function BoardMini({ stacks }: { stacks: Array<{ title: string; cards: Array<{ done?: boolean }> }> }) {
  const shown = stacks.slice(0, 5);
  if (shown.length === 0) return <span className="eac-preview-empty">No lists yet</span>;
  return (
    <div className="eac-board-mini" aria-hidden>
      {shown.map((s, i) => (
        <div key={i} className="eac-board-mini-col">
          {s.cards.slice(0, 6).map((c, j) => (
            <span key={j} className={`eac-board-mini-card${c.done ? " is-done" : ""}`} />
          ))}
          <span className="eac-board-mini-name">
            {s.title}
            <b>{s.cards.length}</b>
          </span>
        </div>
      ))}
    </div>
  );
}
