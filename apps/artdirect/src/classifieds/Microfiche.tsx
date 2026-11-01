"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CELL_H, CELL_W, findNearest, homeCellFor, tileAt, type RealEntry, type Tile, type Unit } from "./plane";
import { zonesIn, zoneAt } from "./zones";
import { TileView, UnitLarge } from "./Sheet";
import { RECIPES } from "./catalog";
import { setNewsPool, type Ad } from "./copy";
import { setReaderDials, styleVars } from "./style";
import { setWorldSeed } from "./rng";
import { DIAL_KEYS, DIAL_LABELS, NEUTRAL, decodeDials, encodeDials, type Dials } from "./dials";

/**
 * The reader. One continuous sheet: the world div is scaled and translated
 * with a CSS transform and the tiles that touch the viewport are mounted at
 * their world coordinates, edge to edge. Zoom is only scale; nothing changes
 * mode as the reader moves in or out.
 *
 * Camera: `cam.x/y` is the world point under the viewport centre, `cam.z`
 * the scale. Moves write the transform directly; React re-renders only when
 * the set of visible tiles changes.
 */
const Z_MIN = 0.2;
const Z_MAX = 3;
const PICK = 0.45;

type Cam = { x: number; y: number; z: number };

/**
 * The hash carries the spot, the reader's dials and the world seed:
 * `#x,y,z;d=5555555555;w=7`. Dials and seed are optional.
 */
function readHash(): { cam: Cam | null; dials: Dials | null; world: number | null } {
  if (typeof window === "undefined") return { cam: null, dials: null, world: null };
  const parts = window.location.hash.replace(/^#/, "").split(";");
  const m = /^(-?[\d.]+),(-?[\d.]+),([\d.]+)$/.exec(parts[0] ?? "");
  const cam = m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: Math.min(Z_MAX, Math.max(Z_MIN, parseFloat(m[3]))) } : null;
  let dials: Dials | null = null;
  let world: number | null = null;
  for (const p of parts.slice(1)) {
    if (p.startsWith("d=")) dials = decodeDials(p.slice(2));
    if (p.startsWith("w=")) world = parseInt(p.slice(2), 10) || 0;
  }
  return { cam, dials, world };
}

/** Dial presets the reader can start from (the keyframes' own settings are reachable through the catalog). */
const PRESETS: Array<[string, Dials]> = [
  ["Neutral", { ...NEUTRAL }],
  ["Dense, narrow, one face", { density: 10, breaks: 1, heterogeneity: 1, colour: 1, fontMix: 1, borders: 1, headers: 4, scale: 1, structures: 1, editorial: 1 }],
  ["Colour, big boxes, white space", { density: 2, breaks: 5, heterogeneity: 7, colour: 9, fontMix: 7, borders: 9, headers: 6, scale: 9, structures: 5, editorial: 2 }],
  ["Broken, many faces", { density: 6, breaks: 10, heterogeneity: 9, colour: 4, fontMix: 10, borders: 6, headers: 5, scale: 6, structures: 6, editorial: 3 }],
  ["The newspaper", { density: 6, breaks: 6, heterogeneity: 3, colour: 2, fontMix: 2, borders: 3, headers: 7, scale: 5, structures: 6, editorial: 10 }],
];

function randomCam(): Cam {
  const i = Math.floor(Math.random() * 61) - 30;
  const j = Math.floor(Math.random() * 41) - 20;
  return { x: i * CELL_W + Math.random() * CELL_W, y: j * CELL_H + Math.random() * CELL_H, z: 0.9 };
}

export function Microfiche({ reals, news, start }: { reals: RealEntry[]; news?: Ad[]; start?: Cam }) {
  setNewsPool(news ?? []); // before any tile is drawn; see copy.ts
  const viewRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cam = useRef<Cam>(start ?? { x: CELL_W / 2, y: CELL_H / 2, z: 0.9 });
  const [range, setRange] = useState<{ i0: number; i1: number; j0: number; j1: number; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [zoomUi, setZoomUi] = useState(cam.current.z);
  const [centre, setCentre] = useState<[number, number]>([0, 0]);
  const [focus, setFocus] = useState<{ unit: Unit; tile: Tile } | null>(null);
  const [panel, setPanel] = useState<"none" | "catalog" | "help" | "dials">("none");
  const [dials, setDials] = useState<Dials>({ ...NEUTRAL });
  const [world, setWorld] = useState(0);
  const [gen, setGen] = useState(0); // bumps when dials or world change, so tiles regenerate
  const tiles = useRef(new Map<string, Tile>());

  const getTile = useCallback(
    (r: number, k: number) => {
      const key = `${r},${k}`;
      let t = tiles.current.get(key);
      if (!t) {
        t = tileAt(r, k, reals);
        tiles.current.set(key, t);
        if (tiles.current.size > 200) tiles.current.clear();
      }
      return t;
    },
    [reals],
  );

  const apply = useCallback(() => {
    const v = viewRef.current;
    const w = worldRef.current;
    if (!v || !w) return;
    const { x, y, z } = cam.current;
    const vw = v.clientWidth;
    const vh = v.clientHeight;
    w.style.transform = `translate(${vw / 2 - x * z}px, ${vh / 2 - y * z}px) scale(${z})`;
    const margin = 0.25;
    const x0 = x - (vw / z) * (0.5 + margin);
    const x1 = x + (vw / z) * (0.5 + margin);
    const y0 = y - (vh / z) * (0.5 + margin);
    const y1 = y + (vh / z) * (0.5 + margin);
    // Visible range in zone indices: the zones touching the margin-padded viewport.
    const zs = zonesIn(x0, y0, x1, y1, 1);
    const za = zonesIn(x1, y1, x1, y1, 1);
    const next = { i0: zs[0]?.k ?? 0, i1: za[0]?.k ?? 0, j0: zs[0]?.r ?? 0, j1: za[0]?.r ?? 0, x0, y0, x1, y1 };
    setRange((r) => (r && r.i0 === next.i0 && r.i1 === next.i1 && r.j0 === next.j0 && r.j1 === next.j1 ? r : next));
    setCentre([Math.floor(x / CELL_W), Math.floor(y / CELL_H)]);
    setZoomUi(z);
  }, []);

  const hashTimer = useRef<number | undefined>(undefined);
  const settings = useRef({ dials: { ...NEUTRAL }, world: 0 });
  const commitHash = useCallback(() => {
    window.clearTimeout(hashTimer.current);
    hashTimer.current = window.setTimeout(() => {
      const { x, y, z } = cam.current;
      const d = settings.current.dials;
      const extra = (encodeDials(d) === encodeDials(NEUTRAL) ? "" : `;d=${encodeDials(d)}`) + (settings.current.world ? `;w=${settings.current.world}` : "");
      history.replaceState(null, "", `#${x.toFixed(0)},${y.toFixed(0)},${z.toFixed(3)}${extra}`);
    }, 250);
  }, []);

  /** Apply dials and world to the generators, drop every tile, re-render. */
  const applySettings = useCallback(
    (d: Dials, w: number) => {
      settings.current = { dials: d, world: w };
      setReaderDials(d);
      setWorldSeed(w);
      tiles.current.clear();
      setDials(d);
      setWorld(w);
      setGen((g) => g + 1);
      commitHash();
    },
    [commitHash],
  );

  const move = useCallback(
    (next: Partial<Cam>) => {
      cam.current = { ...cam.current, ...next };
      cam.current.z = Math.min(Z_MAX, Math.max(Z_MIN, cam.current.z));
      apply();
      commitHash();
    },
    [apply, commitHash],
  );

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const v = viewRef.current;
      if (!v) return;
      const { x, y, z } = cam.current;
      const nz = Math.min(Z_MAX, Math.max(Z_MIN, z * factor));
      const vw = v.clientWidth;
      const vh = v.clientHeight;
      const wx = x + (px - vw / 2) / z;
      const wy = y + (py - vh / 2) / z;
      move({ x: wx - (px - vw / 2) / nz, y: wy - (py - vh / 2) / nz, z: nz });
    },
    [move],
  );

  const goTo = useCallback((i: number, j: number, z = 0.9) => move({ x: i * CELL_W + CELL_W / 2, y: j * CELL_H + CELL_H / 2, z }), [move]);

  useEffect(() => {
    const h = readHash();
    if (h.cam) cam.current = h.cam;
    else if (!start) cam.current = randomCam();
    if (h.dials || h.world !== null) applySettings(h.dials ?? { ...NEUTRAL }, h.world ?? 0);
    apply();
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply, applySettings, start]);

  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = v.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      else {
        const { x, y, z } = cam.current;
        const k = e.deltaMode === 1 ? 16 : 1;
        move({ x: x + (e.deltaX * k) / z, y: y + (e.deltaY * k) / z });
      }
    };
    v.addEventListener("wheel", onWheel, { passive: false });
    return () => v.removeEventListener("wheel", onWheel);
  }, [move, zoomAt]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; lastDist?: number }>({ moved: false });
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: React.PointerEvent) => {
    // No pointer capture yet: a captured pointer sends its click to the viewer,
    // never to the box under it. Capture starts once the press becomes a drag.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const { x, y, z } = cam.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = viewRef.current!.getBoundingClientRect();
      if (drag.current.lastDist) zoomAt(dist / drag.current.lastDist, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      drag.current.lastDist = dist;
      drag.current.moved = true;
      return;
    }
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2 && !drag.current.moved) {
      drag.current.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    move({ x: x - dx / z, y: y - dy / z });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
    drag.current.lastDist = undefined;
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = viewRef.current!.getBoundingClientRect();
    zoomAt(1.6, e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const { x, y, z } = cam.current;
      const step = 120 / z;
      const v = viewRef.current!;
      switch (e.key) {
        case "ArrowLeft": move({ x: x - step }); break;
        case "ArrowRight": move({ x: x + step }); break;
        case "ArrowUp": move({ y: y - step }); break;
        case "ArrowDown": move({ y: y + step }); break;
        case "+": case "=": zoomAt(1.25, v.clientWidth / 2, v.clientHeight / 2); break;
        case "-": case "_": zoomAt(0.8, v.clientWidth / 2, v.clientHeight / 2); break;
        case "r": case "R": move(randomCam()); break;
        case "c": case "C": setPanel((p) => (p === "catalog" ? "none" : "catalog")); break;
        case "d": case "D": setPanel((p) => (p === "dials" ? "none" : "dials")); break;
        case "?": case "h": case "H": setPanel((p) => (p === "help" ? "none" : "help")); break;
        case "Escape": setFocus(null); setPanel("none"); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, zoomAt]);

  const onPick = useCallback((unit: Unit, tile: Tile) => {
    if (drag.current.moved || cam.current.z < PICK) return;
    // A story from off the platform (the news sheet) opens where it was published.
    if (unit.ad.href && /^https?:/.test(unit.ad.href)) {
      window.open(unit.ad.href, "_blank", "noopener");
      return;
    }
    setFocus({ unit, tile });
    setPanel("none");
  }, []);

  const visible = useMemo(() => {
    if (!range) return [];
    return zonesIn(range.x0, range.y0, range.x1, range.y1, 40).map((z) => getTile(z.r, z.k));
    // gen is part of the key on purpose: a dial change regenerates every tile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, getTile, gen]);

  const centreTile = range ? (() => { const z = zoneAt(cam.current.x, cam.current.y); return getTile(z.r, z.k); })() : null;

  return (
    <div
      ref={viewRef}
      className={`cl-viewer${dragging ? " cl-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div ref={worldRef} className="cl-world">
        {visible.map((t) => (
          <TileView key={`${t.i},${t.j}`} tile={t} onPick={onPick} />
        ))}
      </div>

      <div className="cl-hud cl-hud-top" onPointerDown={(e) => e.stopPropagation()}>
        <a className="cl-wordmark" href="/">ArtDirect</a>
        <span className="cl-hud-sep">·</span>
        <span>Classifieds</span>
        <span className="cl-hud-sep">·</span>
        <button type="button" onClick={() => setPanel(panel === "dials" ? "none" : "dials")}>Dials</button>
        <button type="button" onClick={() => setPanel(panel === "catalog" ? "none" : "catalog")}>Keyframes</button>
        <button type="button" onClick={() => setPanel(panel === "help" ? "none" : "help")}>Keys</button>
      </div>

      <div className="cl-hud cl-hud-bottom" onPointerDown={(e) => e.stopPropagation()}>
        <span className="cl-readout">
          <b>WORLD</b> {world} <b>REEL</b> {String(centre[1] + 500).padStart(4, "0")} <b>FRAME</b> {String(centre[0] + 500).padStart(4, "0")}
        </span>
        {centreTile ? (
          <>
            <span className="cl-hud-sep">·</span>
            <span title={`grid ${centreTile.style.anchors.grid.label} · type ${centreTile.style.anchors.type.label} · heads ${centreTile.style.anchors.device.label}`}>
              {centreTile.style.anchors.mix.label}
              {centreTile.style.coherence > 0.6 ? "" : " (drifting)"}
            </span>
          </>
        ) : null}
      </div>

      <div className="cl-hud cl-hud-right" onPointerDown={(e) => e.stopPropagation()}>
        <span className="cl-zoom">
          <button type="button" aria-label="Zoom out" onClick={() => zoomAt(0.8, viewRef.current!.clientWidth / 2, viewRef.current!.clientHeight / 2)}>−</button>
          <input type="range" min={Math.log(Z_MIN)} max={Math.log(Z_MAX)} step={0.01} value={Math.log(zoomUi)} onChange={(e) => move({ z: Math.exp(parseFloat(e.target.value)) })} aria-label="Zoom" />
          <button type="button" aria-label="Zoom in" onClick={() => zoomAt(1.25, viewRef.current!.clientWidth / 2, viewRef.current!.clientHeight / 2)}>+</button>
        </span>
        <span>{Math.round(zoomUi * 100)}%</span>
        <span className="cl-hud-sep">·</span>
        <button type="button" onClick={() => move(randomCam())}>Random spot</button>
      </div>

      {focus ? <FocusPanel focus={focus} onClose={() => setFocus(null)} goTo={goTo} /> : null}
      {panel === "dials" ? <DialsPanel dials={dials} world={world} onChange={applySettings} onClose={() => setPanel("none")} /> : null}
      {panel === "catalog" ? <CatalogPanel onClose={() => setPanel("none")} centre={centre} goTo={goTo} /> : null}
      {panel === "help" ? <HelpPanel onClose={() => setPanel("none")} /> : null}
    </div>
  );
}

function FocusPanel({ focus, onClose, goTo }: { focus: { unit: Unit; tile: Tile }; onClose: () => void; goTo: (i: number, j: number, z?: number) => void }) {
  const { unit: u, tile } = focus;
  const a: Ad = u.ad;
  const s = tile.style;
  const v = u.voice;
  const home = u.homeCell ?? (a.origin === "real" ? homeCellFor(a.id) : null);
  const external = !!a.href && /^https?:/.test(a.href);
  // The box opens as itself, about twice the size, with the tile's theme behind it.
  const vars = styleVars(s) as React.CSSProperties;
  return (
    <div className="cl-focus" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} onClick={onClose}>
      <button type="button" className="cl-focus-close" aria-label="Close" onClick={onClose}>×</button>
      <div className="cl-focus-card" style={vars} onClick={(e) => e.stopPropagation()}>
        <UnitLarge unit={u} width={Math.min(720, Math.max(360, u.w * 1.9))} />
        <div className="cl-focus-meta">
          <div>
            <span className={`cl-tag${a.origin === "real" ? " cl-tag--real" : ""}`}>{a.origin === "real" ? "Real entry" : a.origin === "archive" ? "From the archive" : "Generated"}</span>
            <span className="cl-tag">{a.type}</span>
            <span className="cl-tag">{u.kind}</span>
            {u.home ? <span className="cl-tag">Home spot</span> : null}
          </div>
          {a.href ? (
            <p>
              <a className="cl-open" href={a.href} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined}>{a.via ? `Open on ${a.via} →` : "Open →"}</a>
              {home && !u.home ? <a className="cl-open" href="#" onClick={(e) => { e.preventDefault(); onClose(); goTo(home[0], home[1], 1.1); }}>Home spot →</a> : null}
            </p>
          ) : (
            <p>Generated filler: it stands in for a real post until one takes its place. A real entry opens to the page, organisation or site that placed it.</p>
          )}
          <h2 style={{ marginTop: 12 }}>Why it looks like this</h2>
          <dl>
            <dt>Template</dt><dd>{v.tpl} · {v.fontHead.split(",")[0].replace(/'/g, "")} / {v.fontBody.split(",")[0].replace(/'/g, "")} · {v.border}{v.fill ? " · filled" : ""}{v.reverse ? " · reversed" : ""}</dd>
            <dt>Area</dt><dd>{s.anchors.mix.label} · palette {s.palette.id} · {s.columns} cols · {Math.round(s.coherence * 100)}% coherent</dd>
            <dt>Dials here</dt><dd style={{ fontVariantNumeric: "tabular-nums" }}>{DIAL_KEYS.map((k) => Math.round(s.dials[k])).join(" ")}</dd>
            <dt>Keyframes</dt><dd>{Object.entries(s.weights).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([id, w]) => `${id} ${Math.round(w * 100)}%`).join(" · ")}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}

function DialsPanel({ dials, world, onChange, onClose }: { dials: Dials; world: number; onChange: (d: Dials, w: number) => void; onClose: () => void }) {
  const [seedText, setSeedText] = useState(String(world));
  return (
    <aside className="cl-panel" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <button type="button" className="cl-panel-close" aria-label="Close" onClick={onClose}>×</button>
      <h2>Dials</h2>
      <p>Each keyframe sets these for itself; the field blends them from place to place. Your setting pushes every spot from there. 5 is no push.</p>
      <div className="cl-dials-actions">
        <select
          id="cl-preset"
          aria-label="Preset"
          defaultValue=""
          onChange={(e) => {
            const p = PRESETS.find(([n]) => n === e.target.value);
            if (p) onChange({ ...p[1] }, world);
          }}
        >
          <option value="" disabled>Preset…</option>
          {PRESETS.map(([n]) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" onClick={() => onChange({ ...NEUTRAL }, world)}>Reset</button>
      </div>
      <div className="cl-dials">
        {DIAL_KEYS.map((k) => (
          <label key={k} className="cl-dial">
            <b>{k} · {dials[k]}</b>
            <input id={`cl-dial-${k}`} type="range" min={0} max={10} step={1} value={dials[k]} onChange={(e) => onChange({ ...dials, [k]: Number(e.target.value) }, world)} />
            <span className="cl-dial-row"><span>{DIAL_LABELS[k][0]}</span><span>{DIAL_LABELS[k][1]}</span></span>
          </label>
        ))}
      </div>
      <div className="cl-seed">
        <label htmlFor="cl-world">World</label>
        <input id="cl-world" value={seedText} onChange={(e) => setSeedText(e.target.value)} onBlur={() => onChange(dials, parseInt(seedText, 10) || 0)} onKeyDown={(e) => { if (e.key === "Enter") onChange(dials, parseInt(seedText, 10) || 0); }} />
        <button type="button" onClick={() => { const w = Math.floor(Math.random() * 9000) + 1; setSeedText(String(w)); onChange(dials, w); }}>Random world</button>
      </div>
      <p style={{ marginTop: 10, fontSize: 11, opacity: 0.7 }}>A world is the same rules on a different seed: another plane entirely. The address bar carries the world and the dials with the spot.</p>
    </aside>
  );
}

function CatalogPanel({ onClose, centre, goTo }: { onClose: () => void; centre: [number, number]; goTo: (i: number, j: number, z?: number) => void }) {
  return (
    <aside className="cl-panel cl-catalog" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <button type="button" className="cl-panel-close" aria-label="Close" onClick={onClose}>×</button>
      <h2>Keyframes</h2>
      <p>The looks the section morphs between. Each is drawn from the specimens; areas hold to one, and between them the grid, faces, colours and heads drift apart box by box.</p>
      <ul>
        {RECIPES.map((r) => (
          <li key={r.id}>
            <b>{r.label}</b> <small>{r.era} · {r.family.name} · {r.specimens.join(", ")}</small>
            <ul className="cl-devices">{r.devices.map((d) => <li key={d}>{d}</li>)}</ul>
            <button type="button" onClick={() => { const c = findNearest(centre[0], centre[1], r.id); if (c) goTo(c[0], c[1], 0.9); }}>
              Go to the nearest →
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside className="cl-panel cl-help" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="cl-panel-close" aria-label="Close" onClick={onClose}>×</button>
      <h2>Reading the fiche</h2>
      <p>Drag or scroll to move the carriage. <kbd>ctrl</kbd>+scroll or pinch to zoom; double-click zooms in on a spot.</p>
      <p><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> move · <kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>R</kbd> random spot · <kbd>D</kbd> dials · <kbd>C</kbd> keyframes · <kbd>Esc</kbd> close.</p>
      <p>Click any ad to read it, see whether it is real or generated, and follow a real one home.</p>
      <p>The address bar carries your spot; copy it to send someone there.</p>
    </aside>
  );
}
