"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { leaveNote, notesForPage } from "./actions";
import { ThreadCard, anchorLabel } from "./ThreadCard";
import { isFail, isOpenStatus, PERSON_KINDS, type Thread } from "./types";
import "./desk.css";

// "Note for Claude": a small button on every page. Pick a spot, say what you want, and Claude finds it
// again later (page + the spot's data-dev-anchor, or a short CSS path). Open notes show as numbered pins.

const SNIPPET = 120;

/** Short CSS path to an element: up to 5 levels, stopping at an id. Stored as "css:<path>". */
function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; cur && cur !== document.body && i < 5; i++) {
    if (cur.id && !/\s/.test(cur.id)) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const tag = cur.tagName.toLowerCase();
    const same = cur.parentElement ? Array.from(cur.parentElement.children).filter((c) => c.tagName === cur!.tagName) : [];
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = cur.parentElement;
  }
  return `css:${parts.join(" > ")}`;
}

function pickTarget(el: Element | null): Element | null {
  if (!el || el.closest(".desk-root")) return null;
  return el.closest("[data-dev-anchor]") ?? el;
}
function anchorOf(el: Element): string {
  return el.closest("[data-dev-anchor]") === el ? (el.getAttribute("data-dev-anchor") as string) : cssPath(el);
}
function snippetOf(el: Element): string {
  return ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, SNIPPET);
}
function findAnchor(anchor: string | null): Element | null {
  if (!anchor) return null;
  try {
    if (anchor.startsWith("css:")) return document.querySelector(anchor.slice(4));
    return Array.from(document.querySelectorAll("[data-dev-anchor]")).find((e) => e.getAttribute("data-dev-anchor") === anchor) ?? null;
  } catch {
    return null;
  }
}

type Pin = { id: string; n: number; x: number; y: number };
type Picked = { anchor: string | null; anchorText: string | null };

export function DeskNotes(_props: { email?: string } = {}) {
  const path = usePathname() || "/";
  const [threads, setThreads] = useState<Thread[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "setup" | "off">("loading");
  const [panel, setPanel] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [kind, setKind] = useState("note");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [hot, setHot] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const outline = useRef<HTMLDivElement>(null);
  const threadsRef = useRef<Thread[]>([]);
  threadsRef.current = threads;

  const load = useCallback(async () => {
    const r = await notesForPage(path);
    if (!isFail(r)) {
      setThreads(r.threads);
      setState("ok");
    } else if (r.reason === "setup") setState("setup");
    else if (r.reason === "denied") setState("off");
    else setState("ok");
  }, [path]);

  useEffect(() => {
    setPanel(false);
    setPicking(false);
    setPicked(null);
    setThreads([]);
    load();
  }, [load]);

  // Pins: put a numbered dot at each open note's anchor; skip quietly when the anchor is gone.
  const numbered = threads.filter((t) => isOpenStatus(t.status));
  const place = useCallback(() => {
    const out: Pin[] = [];
    numbered
      .slice()
      .reverse()
      .forEach((t, i) => {
        const el = findAnchor(t.anchor);
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return;
        out.push({ id: t.id, n: i + 1, x: Math.min(Math.max(r.left, 8), window.innerWidth - 20), y: Math.min(Math.max(r.top, 8), window.innerHeight - 20) });
      });
    setPins((old) => (old.length === out.length && old.every((p, i) => p.id === out[i].id && p.x === out[i].x && p.y === out[i].y) ? old : out));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads]);
  useEffect(() => {
    if (state !== "ok" || !numbered.length) {
      setPins([]);
      return;
    }
    let raf = 0;
    let timer = 0;
    const soon = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(place);
    };
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(soon, 250);
    };
    soon();
    window.addEventListener("scroll", soon, true);
    window.addEventListener("resize", soon);
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true });
    const poll = window.setInterval(soon, 2000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("scroll", soon, true);
      window.removeEventListener("resize", soon);
      mo.disconnect();
    };
  }, [state, threads, place]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?note=<id>: scroll to the spot, flash it, open the panel on that note.
  useEffect(() => {
    if (state !== "ok") return;
    const id = new URLSearchParams(window.location.search).get("note");
    const t = id ? threads.find((x) => x.id === id) : null;
    if (!t) return;
    setHot(t.id);
    setPanel(true);
    let tries = 0;
    const go = window.setInterval(() => {
      const el = findAnchor(t.anchor);
      if (el || ++tries > 12) {
        window.clearInterval(go);
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.add("desk-flash");
        window.setTimeout(() => el.classList.remove("desk-flash"), 3600);
      }
    }, 250);
    return () => window.clearInterval(go);
    // only when the notes first arrive for this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, threads.length]);

  // Pick mode.
  useEffect(() => {
    if (!picking) return;
    document.documentElement.classList.add("desk-picking");
    let current: Element | null = null;
    const move = (e: MouseEvent) => {
      current = pickTarget(document.elementFromPoint(e.clientX, e.clientY));
      const box = outline.current;
      if (!box) return;
      if (!current) {
        box.style.display = "none";
        return;
      }
      const r = current.getBoundingClientRect();
      Object.assign(box.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    const click = (e: MouseEvent) => {
      const el = pickTarget(document.elementFromPoint(e.clientX, e.clientY));
      if (!el) return; // a click on the notes' own controls goes through
      e.preventDefault();
      e.stopPropagation();
      setPicked({ anchor: anchorOf(el), anchorText: snippetOf(el) || null });
      setPicking(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setPicking(false);
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.documentElement.classList.remove("desk-picking");
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [picking]);

  useEffect(() => {
    if (!picked && !panel) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPicked(null);
      setPanel(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [picked, panel]);

  async function save() {
    if (!picked) return;
    setBusy(true);
    setErr("");
    const r = await leaveNote({ path, anchor: picked.anchor, anchorText: picked.anchorText, kind, body: text });
    setBusy(false);
    if (isFail(r)) return setErr(r.message);
    setPicked(null);
    setText("");
    setKind("note");
    setPanel(true);
    load();
  }

  if (state === "off") return null;
  const open = numbered.length;
  const closed = threads.filter((t) => !isOpenStatus(t.status));

  return (
    <div className="desk-root">
      <button className="desk-btn" aria-expanded={panel} aria-label="Notes for Claude" onClick={() => { setPanel((v) => !v); if (!panel) load(); }}>
        Note for Claude
        {open ? <span className="desk-badge">{open}</span> : null}
      </button>

      {pins.length ? (
        <div className="desk-pins">
          {pins.map((p) => (
            <button key={p.id} className="desk-pin" style={{ left: p.x, top: p.y }} title="Open this note" onClick={() => { setHot(p.id); setPanel(true); }}>
              {p.n}
            </button>
          ))}
        </div>
      ) : null}

      {picking ? (
        <>
          <div ref={outline} className="desk-outline" style={{ display: "none" }} />
          <div className="desk-hint">Click the thing you mean. Esc to cancel.</div>
        </>
      ) : null}

      {panel && !picking ? (
        <aside className="desk-panel" aria-label="Notes for Claude on this page">
          <div className="desk-panel-head">
            <span>Notes on this page</span>
            <button className="desk-x" aria-label="Close" onClick={() => setPanel(false)}>
              &times;
            </button>
          </div>
          <div className="desk-panel-body">
            {state === "setup" ? (
              <div className="desk-empty">Notes are not switched on yet.</div>
            ) : picked ? (
              <div className="desk-card">
                <div className="desk-meta">
                  <span className="desk-kind">New note</span>
                  <span>{path}</span>
                </div>
                {picked.anchor ? <div className="desk-where">{anchorLabel(picked.anchor)}</div> : <div className="desk-muted">The whole page</div>}
                {picked.anchorText ? <div className="desk-snip">&ldquo;{picked.anchorText}&rdquo;</div> : null}
                <div className="desk-row">
                  {PERSON_KINDS.map((k) => (
                    <button key={k.kind} className={`desk-b${kind === k.kind ? " desk-on" : ""}`} onClick={() => setKind(k.kind)}>
                      {k.label}
                    </button>
                  ))}
                </div>
                <textarea className="desk-t" rows={4} maxLength={4000} autoFocus value={text} placeholder="What should Claude know or do here?" onChange={(e) => setText(e.target.value)} />
                {err ? <div className="desk-err">{err}</div> : null}
                <div className="desk-row">
                  <button className="desk-b desk-go" disabled={busy || !text.trim()} onClick={save}>
                    Leave note
                  </button>
                  <button className="desk-b" onClick={() => { setPicked(null); setErr(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="desk-row">
                <button className="desk-b desk-go" onClick={() => { setPicking(true); setPanel(false); }}>
                  Pick a spot
                </button>
                <button className="desk-b" onClick={() => setPicked({ anchor: null, anchorText: null })}>
                  Note about the whole page
                </button>
              </div>
            )}

            {state === "loading" ? <div className="desk-empty">Loading</div> : null}
            {state === "ok" && !picked && !threads.length ? <div className="desk-empty">No notes on this page yet.</div> : null}
            {numbered.map((t, i) => (
              <ThreadCard key={t.id} t={t} hot={hot === t.id} pinNo={numbered.length - i} onChange={load} />
            ))}
            {closed.length ? (
              <details>
                <summary className="desk-muted" style={{ cursor: "pointer" }}>
                  Finished ({closed.length})
                </summary>
                <div className="desk-list" style={{ marginTop: 8 }}>
                  {closed.map((t) => (
                    <ThreadCard key={t.id} t={t} onChange={load} />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export default DeskNotes;
