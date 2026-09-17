"use client";

import * as React from "react";

// ============================================================================
// The desk — the same center sections, loose.
//
// An org turns this on (layout.arrangement = 'desk'); after that the desk
// belongs to whoever is reading it. Cards are the faces exactly as the
// columns draw them: nothing here reaches inside a section, it only decides
// where the section lies and lets a hand push it somewhere else.
//
// Where they end up is per person and per browser (localStorage), never the
// org's row — the brief's "orgs customise, people don't" still holds for
// what the center *shows*; this is only where a reader left it.
//
// Server-rendered sections come in as `node`, so this client component adds
// behaviour to markup it never authored. It renders in flow — one column,
// the pre-hydration and phone layout — and only becomes a desk once it can
// measure. That first move, from the column into the scatter, is the page
// forming: a FLIP glide, staggered, skipped under prefers-reduced-motion.
// ============================================================================

export interface CenterDeskItem {
  id: string;
  /** For the move handle's label: "Move the feed". */
  label: string;
  node: React.ReactNode;
}

type Pos = { x: number; y: number };
type Positions = Record<string, Pos>;

const GAP = 16;
const EDGE = 2;
/** Below this the desk is a column: no room to scatter, and no pointer to do it with. */
const NARROW = 860;

/** What each section wants to be when it isn't in a column. */
const WIDTH: Record<string, number> = {
  profile: 300,
  buttons: 264,
  orgs: 306,
  promo: 306,
  site: 430,
  org: 412,
  pinned: 392,
  feed: 440,
  featured: 412,
  network: 470,
};
const FALLBACK_WIDTH = 340;

/** The same card lies at the same angle every time it is dealt. */
function tiltOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (((h % 9) + 9) % 9) - 4; // −4°…4°, in whole degrees
}

const sheetsIn = (desk: HTMLElement) =>
  Array.from(desk.querySelectorAll<HTMLElement>(":scope > .eac-desk-sheet"));

export function CenterDesk({
  items,
  storageKey,
  note = "Move these where you like — your desk stays in this browser.",
}: {
  items: CenterDeskItem[];
  /** Per person, per org: the org id is enough, the browser supplies the person. */
  storageKey: string;
  note?: string;
}) {
  const deskRef = React.useRef<HTMLDivElement>(null);
  const posRef = React.useRef<Positions>({});
  const topRef = React.useRef(10);
  const dragRef = React.useRef<
    { id: string; el: HTMLElement; pid: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null
  >(null);
  const droppedAt = React.useRef(0);

  const read = React.useCallback((): Positions => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      const pos = parsed && typeof parsed === "object" ? (parsed as { pos?: unknown }).pos : null;
      if (!pos || typeof pos !== "object") return {};
      const out: Positions = {};
      for (const [id, p] of Object.entries(pos as Record<string, unknown>)) {
        const q = p as Partial<Pos>;
        if (typeof q?.x === "number" && typeof q?.y === "number" && Number.isFinite(q.x) && Number.isFinite(q.y)) {
          out[id] = { x: q.x, y: q.y };
        }
      }
      return out;
    } catch {
      return {}; // a private window, or storage turned off: the desk just deals fresh
    }
  }, [storageKey]);

  const write = React.useCallback(
    (pos: Positions) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({ v: 1, pos }));
      } catch {
        /* nothing to do: the arrangement lasts this visit */
      }
    },
    [storageKey]
  );

  /** The desk grows to whatever it holds, so the page scrolls rather than clipping. */
  const fit = React.useCallback(() => {
    const desk = deskRef.current;
    if (!desk) return;
    let bottom = 0;
    for (const el of sheetsIn(desk)) bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
    desk.style.height = `${Math.round(bottom + 40)}px`;
  }, []);

  /**
   * Deal: pack the cards into tracks in the org's own order, then let any
   * position this reader saved overrule it. Measuring happens at the width
   * the card will actually have, so a tall card claims the room it needs.
   */
  const pack = React.useCallback(
    (saved: Positions) => {
      const desk = deskRef.current;
      if (!desk) return;
      const els = sheetsIn(desk);
      const W = desk.clientWidth;
      const cols = Math.max(2, Math.min(4, Math.round(W / 360)));
      const track = (W - GAP * (cols - 1)) / cols;
      const colY = new Array<number>(cols).fill(0);
      const dealt: Positions = {};

      for (const el of els) {
        const id = el.dataset.id ?? "";
        const w = Math.min(WIDTH[id] ?? FALLBACK_WIDTH, W - EDGE * 2);
        el.style.width = `${Math.round(w)}px`;
        const h = el.offsetHeight;
        const span = Math.max(1, Math.min(cols, Math.ceil((w - 1) / (track + GAP))));
        let start = 0;
        let y = Infinity;
        for (let t = 0; t + span <= cols; t++) {
          let top = 0;
          for (let k = t; k < t + span; k++) top = Math.max(top, colY[k] ?? 0);
          if (top < y - 0.5) {
            y = top;
            start = t;
          }
        }
        if (!Number.isFinite(y)) y = 0;
        const spanW = span * track + (span - 1) * GAP;
        dealt[id] = { x: start * (track + GAP) + Math.max(0, (spanW - w) / 2), y };
        for (let k = start; k < start + span; k++) colY[k] = y + h + GAP;
      }

      const settled: Positions = {};
      for (const el of els) {
        const id = el.dataset.id ?? "";
        const from = saved[id] ?? dealt[id] ?? { x: 0, y: 0 };
        const maxX = Math.max(EDGE, W - el.offsetWidth - EDGE);
        const p = {
          x: Math.min(Math.max(from.x, EDGE), maxX),
          y: Math.max(from.y, 0),
        };
        el.style.left = `${Math.round(p.x)}px`;
        el.style.top = `${Math.round(p.y)}px`;
        el.style.setProperty("--rot", `${tiltOf(id)}deg`);
        if (!el.style.zIndex) el.style.zIndex = String(++topRef.current);
        settled[id] = p;
      }
      posRef.current = settled;
      fit();
    },
    [fit]
  );

  const arrange = React.useCallback(
    (opts: { animate?: boolean; saved?: Positions } = {}) => {
      const desk = deskRef.current;
      if (!desk) return;
      const els = sheetsIn(desk);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const animate = Boolean(opts.animate) && !still;
      const before = animate
        ? new Map(els.map((el) => [el.dataset.id ?? "", el.getBoundingClientRect()]))
        : null;

      desk.dataset.mode = "desk";
      pack(opts.saved ?? posRef.current);
      if (!before) return;

      // FLIP: hold each card where it was, then let go all together.
      for (const el of els) {
        const b = before.get(el.dataset.id ?? "");
        if (!b) continue;
        const a = el.getBoundingClientRect();
        el.style.transition = "none";
        el.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) rotate(0deg)`;
      }
      void desk.offsetWidth;
      els.forEach((el, i) => {
        el.style.transition = `transform 560ms cubic-bezier(0.2, 0.9, 0.3, 1) ${i * 45}ms`;
        el.style.transform = "";
      });
      window.setTimeout(() => {
        for (const el of els) el.style.transition = "";
      }, 640 + els.length * 45);
    },
    [pack]
  );

  /** Back to one column: every inline decision this component made, undone. */
  const flow = React.useCallback(() => {
    const desk = deskRef.current;
    if (!desk) return;
    delete desk.dataset.mode;
    desk.style.height = "";
    for (const el of sheetsIn(desk)) el.setAttribute("style", "");
  }, []);

  React.useEffect(() => {
    const narrow = () => window.matchMedia(`(max-width: ${NARROW}px)`).matches;
    if (!narrow()) {
      posRef.current = read();
      arrange({ animate: true, saved: posRef.current });
    }
    let t = 0;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (narrow()) flow();
        else arrange({ saved: posRef.current });
      }, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, [arrange, flow, read]);

  // ── moving a card ───────────────────────────────────────────────────────
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const desk = deskRef.current;
      if (!d || !desk || e.pointerId !== d.pid) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved) {
        // Under four pixels it is still a click: the card's own link wins.
        if (Math.hypot(dx, dy) < 4) return;
        d.moved = true;
        d.el.classList.add("is-held");
        try {
          d.el.setPointerCapture(d.pid);
        } catch {
          /* the pointer went away; the window listeners still carry it */
        }
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) sel.removeAllRanges();
      }
      const maxX = Math.max(EDGE, desk.clientWidth - d.el.offsetWidth - EDGE);
      const x = Math.min(Math.max(d.ox + dx, EDGE), maxX);
      const y = Math.max(d.oy + dy, 0);
      d.el.style.left = `${Math.round(x)}px`;
      d.el.style.top = `${Math.round(y)}px`;
      posRef.current[d.id] = { x, y };
    };

    const onUp = () => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      d.el.classList.remove("is-held");
      if (!d.moved) return;
      droppedAt.current = Date.now();
      fit();
      write(posRef.current);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [fit, write]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    const desk = deskRef.current;
    if (!desk || desk.dataset.mode !== "desk") return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Typing, choosing and scrolling stay themselves; everything else is paper.
    if (target.closest("input, textarea, select, [contenteditable='true'], [data-no-drag]")) return;
    const el = e.currentTarget;
    el.style.zIndex = String(++topRef.current);
    dragRef.current = {
      id,
      el,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      ox: parseFloat(el.style.left) || 0,
      oy: parseFloat(el.style.top) || 0,
      moved: false,
    };
  };

  /** A drag that ends over a link must not also follow it. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (Date.now() - droppedAt.current < 250) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onGripKey = (e: React.KeyboardEvent<HTMLButtonElement>, id: string) => {
    const desk = deskRef.current;
    if (!desk || desk.dataset.mode !== "desk") return;
    const step = e.shiftKey ? 48 : 12;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const el = e.currentTarget.closest<HTMLElement>(".eac-desk-sheet");
    if (!el) return;
    const maxX = Math.max(EDGE, desk.clientWidth - el.offsetWidth - EDGE);
    const x = Math.min(Math.max((parseFloat(el.style.left) || 0) + move[0], EDGE), maxX);
    const y = Math.max((parseFloat(el.style.top) || 0) + move[1], 0);
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.zIndex = String(++topRef.current);
    posRef.current[id] = { x, y };
    fit();
    write(posRef.current);
  };

  const tidy = () => {
    posRef.current = {};
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* nothing saved to clear */
    }
    if (deskRef.current) for (const el of sheetsIn(deskRef.current)) el.style.zIndex = "";
    topRef.current = 10;
    arrange({ animate: true, saved: {} });
  };

  return (
    <div className="eac-desk-wrap">
      <div className="eac-desk-bar">
        <p className="eac-desk-note">{note}</p>
        <button type="button" className="eac-center-btn" onClick={tidy}>
          Tidy the desk
        </button>
      </div>
      <div className="eac-desk" ref={deskRef} onClickCapture={onClickCapture}>
        {items.map((it) => (
          <div
            key={it.id}
            className="eac-desk-sheet"
            data-id={it.id}
            onPointerDown={(e) => onPointerDown(e, it.id)}
          >
            {it.node}
            <button
              type="button"
              className="eac-desk-grip"
              aria-label={`Move ${it.label}. Use the arrow keys.`}
              onKeyDown={(e) => onGripKey(e, it.id)}
            >
              <span aria-hidden>⠿</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
