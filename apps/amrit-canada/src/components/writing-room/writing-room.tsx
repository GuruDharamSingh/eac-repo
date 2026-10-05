"use client";

import * as React from "react";
import { RichTextEditor } from "@elkdonis/cms-ui/editor";
import { deleteRoomPiece, saveRoomPiece, type RoomPiece } from "@/lib/writing-room-actions";
import "./writing-room.css";

interface PieceRow {
  id: string;
  title: string;
  status: "draft" | "published";
  updatedAt: string;
}

interface WritingRoomProps {
  /** The piece to open, or null for a blank page. */
  initial: RoomPiece | null;
  /** The viewer's pieces on this site, newest first, for the drawer. */
  pieces: PieceRow[];
  /** users.slug; published pieces are read at /writing/<slug>/<piece>. */
  authorSlug: string | null;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 2000;

/**
 * The writing room: a dark page, a title and a body, nothing else in view.
 *
 * Covers the site chrome (fixed, full viewport) rather than living in a
 * separate layout, so the root layout stays one tree. Saves on a short pause
 * in typing and on Ctrl/Cmd+S; a new piece is created on its first save and
 * the address becomes /write?piece=<id>. A piece stays a draft until Publish.
 */
export function WritingRoom({ initial, pieces, authorSlug }: WritingRoomProps) {
  const [id, setId] = React.useState<string | null>(initial?.id ?? null);
  const [slug, setSlug] = React.useState(initial?.slug ?? "");
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.bodyHtml ?? "");
  const [status, setStatus] = React.useState<"draft" | "published">(initial?.status ?? "draft");
  const [state, setState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<Date | null>(
    initial ? new Date(initial.updatedAt) : null
  );
  const [error, setError] = React.useState<string | null>(null);
  const [drawer, setDrawer] = React.useState(false);
  const [typing, setTyping] = React.useState(false);

  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  // The latest values, for the debounced save and the key handler.
  const latest = React.useRef({ id, title, body });
  latest.current = { id, title, body };
  const inFlight = React.useRef(false);

  const words = React.useMemo(() => {
    const text = body.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").trim();
    return text ? text.split(/\s+/).length : 0;
  }, [body]);

  const save = React.useCallback(async (nextStatus?: "draft" | "published") => {
    const { id: currentId, title: t, body: b } = latest.current;
    if (!t.trim()) {
      setError("Add a title to save.");
      setState("error");
      return false;
    }
    if (inFlight.current) return false;
    inFlight.current = true;
    setState("saving");
    setError(null);
    try {
      const res = await saveRoomPiece({ id: currentId, title: t, bodyHtml: b, status: nextStatus });
      if (!res.ok || !res.piece) {
        setError(res.error ?? "Could not save that.");
        setState("error");
        return false;
      }
      if (!currentId) {
        window.history.replaceState(null, "", `/write?piece=${res.piece.id}`);
      }
      setId(res.piece.id);
      setSlug(res.piece.slug);
      setStatus(res.piece.status);
      setSavedAt(new Date());
      // Typing during the round trip leaves the room dirty.
      setState(latest.current.title === t && latest.current.body === b ? "saved" : "dirty");
      return true;
    } catch {
      setError("Could not reach the server.");
      setState("error");
      return false;
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Autosave after a pause in typing.
  React.useEffect(() => {
    if (state !== "dirty" || !title.trim()) return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [state, title, body, save]);

  // Ctrl/Cmd+S saves now; Escape closes the drawer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Unsaved words are the one thing on this page that cannot be recovered.
  React.useEffect(() => {
    if (state !== "dirty" && state !== "saving") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  // The room covers the page; the page underneath should not scroll.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // The bar dims while typing and returns when the pointer moves.
  React.useEffect(() => {
    if (!typing) return;
    const wake = () => setTyping(false);
    window.addEventListener("mousemove", wake, { once: true });
    return () => window.removeEventListener("mousemove", wake);
  }, [typing]);

  // Title grows with its text instead of scrolling.
  React.useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  React.useEffect(() => {
    if (!initial) titleRef.current?.focus();
  }, [initial]);

  function edited() {
    setState("dirty");
    setTyping(true);
    if (error) setError(null);
  }

  async function remove() {
    if (!id) return;
    if (!window.confirm(`Remove "${title || "Untitled"}"? It is archived, not erased.`)) return;
    const res = await deleteRoomPiece(id);
    if (!res.ok) {
      setError(res.error ?? "Could not remove that piece.");
      return;
    }
    setState("idle");
    window.location.assign("/write");
  }

  const statusLine =
    state === "saving"
      ? "Saving…"
      : state === "dirty"
        ? title.trim()
          ? "Unsaved"
          : "Add a title to save"
        : state === "error"
          ? (error ?? "Not saved")
          : savedAt
            ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "New piece";

  const readHref = status === "published" && authorSlug ? `/writing/${authorSlug}/${slug}` : null;

  return (
    <div className="wr" data-typing={typing ? "true" : undefined}>
      <header className="wr-bar">
        <span className="wr-brand">Amrit Canada · Writing room</span>
        <span className="wr-status" aria-live="polite">
          {status === "published" ? "Published" : "Draft"} · {statusLine}
          {words > 0 && ` · ${words} ${words === 1 ? "word" : "words"}`}
        </span>
        <span className="wr-spacer" />
        <button type="button" className="wr-btn" onClick={() => setDrawer((v) => !v)} aria-expanded={drawer}>
          Pieces
        </button>
        <a className="wr-btn" href="/write">
          New
        </a>
        {readHref && (
          <a className="wr-btn" href={readHref}>
            Read
          </a>
        )}
        {status === "published" ? (
          <button type="button" className="wr-btn" onClick={() => void save("draft")}>
            Unpublish
          </button>
        ) : (
          <button
            type="button"
            className="wr-btn wr-btn--primary"
            disabled={!title.trim() || state === "saving"}
            onClick={() => void save("published")}
          >
            Publish
          </button>
        )}
        <a className="wr-btn" href="/write/leave">
          View site
        </a>
      </header>

      <main className="wr-page">
        <textarea
          ref={titleRef}
          className="wr-title"
          rows={1}
          value={title}
          maxLength={200}
          placeholder="Title"
          aria-label="Title"
          onChange={(e) => {
            setTitle(e.target.value.replace(/\n/g, " "));
            edited();
          }}
        />
        <div className="wr-body">
          <RichTextEditor
            value={body}
            onChange={(html) => {
              setBody(html);
              edited();
            }}
            toolbar="compact"
            minHeight={480}
            placeholder="Begin…"
            ariaLabel="Body"
            sourceThreadId={id ?? undefined}
          />
        </div>
      </main>

      {drawer && (
        <aside className="wr-drawer" aria-label="Your pieces">
          <div className="wr-drawer-head">
            <span>Your pieces</span>
            <button type="button" className="wr-btn" onClick={() => setDrawer(false)}>
              Close
            </button>
          </div>
          {pieces.length === 0 ? (
            <p className="wr-drawer-empty">Nothing saved yet.</p>
          ) : (
            <ul className="wr-list">
              {pieces.map((p) => (
                <li key={p.id} data-current={p.id === id ? "true" : undefined}>
                  <a href={`/write?piece=${p.id}`}>
                    <span className="wr-list-title">{p.title || "Untitled"}</span>
                    <span className="wr-list-meta">
                      {p.status === "published" ? "Published" : "Draft"} ·{" "}
                      {new Date(p.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {id && (
            <button type="button" className="wr-btn wr-btn--quiet" onClick={() => void remove()}>
              Remove this piece
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
