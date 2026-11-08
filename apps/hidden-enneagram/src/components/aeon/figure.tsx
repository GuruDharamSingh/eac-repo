"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MODES, STRESS, TYPES, type CenterKey, type ModeKey, type TypeNum } from "./content";
import {
  arcPath,
  CX,
  CY,
  GROWTH,
  HEXAGRAM,
  isTypeNum,
  NODE_R,
  NUMS,
  nextType,
  prevType,
  pt,
  R,
  SIZE,
  ticks,
  TRIANGLE,
  trimmedLine,
  wingsOf,
} from "./geometry";
import { useFigureSound, type FigureSound, type FigureSoundState } from "./use-figure-sound";
import { SoundBar } from "./sound-bar";
import { chromaOf, nearestNote, toneOf, type Point } from "@/lib/sound/tuning";

// ============================================================================
// The instrument: ÆON's interactive enneagram (~/aeon-enneagram/js/aeon.js,
// 2026-10-29) as one React island. Same figure, same reading order; the DOM
// building and innerHTML of the draft became declarative markup, so the text
// is escaped by React and the server sends a complete, readable first frame
// (the selected type's first step) before any script runs.
//
// What it does:
//   - lens chips recolour the nine points by a lens's three poles
//     (Centers / Object relation / Energy style / Attitude style)
//   - selecting a point dims the lines not touching it, draws its stress and
//     growth lines and its wing arc, and opens its dossier
//   - the dossier reads in five steps (Essence, The fixation, Qualities,
//     Hidden triads, Wings & lines); the last step's button moves to the
//     next type. Arrow keys on a point move round the circle.
//   - `#type-4` in the address opens on type 4 (a link from anywhere)
//
// Colours are CSS tokens (--he-gut / --he-heart / --he-head and the site's
// own), so Site style and a block's look change them; nothing is hard-coded.
// ============================================================================

export type FigureSize = "small" | "medium" | "large";
export type FigureReader = "full" | "summary" | "none";

export interface AeonFigureProps {
  /** The lens the figure opens with. */
  mode?: ModeKey;
  /** The point selected at first. */
  start?: TypeNum;
  /** How large the wheel may grow. */
  size?: FigureSize;
  /** Lens chips and the legend under the wheel. */
  controls?: boolean;
  /** The dossier: all five steps, a short summary with a link, or none. */
  reader?: FigureReader;
  /** Where "Read the full dossier" goes in summary mode (`{n}` = the type). */
  readHref?: string;
  /** Where "Ario's page on this type" goes (`{n}` = the type); empty = no link. */
  typeHref?: string;
  /** Read `#type-N` from the address on load. */
  followHash?: boolean;
  /**
   * Prefix for the dossier element id (aria-controls). Passed in rather than
   * useId(): Puck renders the page tree on the server differently from the
   * client, so a useId differed and React warned of a hydration mismatch.
   */
  idBase?: string;
  /**
   * The figure's sound (opt-in for the visitor: a speaker toggle). Absent =
   * a silent figure, as before. See use-figure-sound.ts.
   */
  sound?: FigureSound | null;
}

const PC_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const WEB_R = R - 64;

/**
 * The web of music laid on the nine points (the research report's layout E):
 * a 36-tick ring inside the circle, where every 4th tick is an enneagram point
 * and every 3rd a pitch class in circle-of-fifths order from do. 9 and 12 meet
 * only at 0, 120 and 240 degrees (points 9, 3, 6), which are marked.
 */
function WebRing({ s }: { s: FigureSoundState }) {
  const doChroma = nearestNote(s.doHz).chroma;
  const lit = new Set<number>();
  if (s.heard) lit.add(nearestNote(s.heard.hz).chroma);
  for (const p of s.sounding) {
    const c = chromaOf(p, doChroma, s.tuning, s.temperament);
    if (c !== null) lit.add(c);
  }
  return (
    <g className="he-web-ring" aria-hidden="true">
      <circle cx={CX} cy={CY} r={WEB_R} className="he-web-circle" />
      {Array.from({ length: 36 }, (_, i) => {
        const deg = i * 10 - 90;
        const rad = (deg * Math.PI) / 180;
        const nine = i % 4 === 0;
        const twelve = i % 3 === 0;
        const len = nine && twelve ? 14 : nine || twelve ? 9 : 4;
        const x1 = Math.round((CX + WEB_R * Math.cos(rad)) * 100) / 100;
        const y1 = Math.round((CY + WEB_R * Math.sin(rad)) * 100) / 100;
        const x2 = Math.round((CX + (WEB_R - len) * Math.cos(rad)) * 100) / 100;
        const y2 = Math.round((CY + (WEB_R - len) * Math.sin(rad)) * 100) / 100;
        const chroma = twelve ? (doChroma + 7 * (i / 3)) % 12 : -1;
        const lr = WEB_R - 24;
        return (
          <g key={i} className={`he-web-tick${nine && twelve ? " he-web-meet" : ""}${twelve && lit.has(chroma) ? " he-web-lit" : ""}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {twelve ? (
              <text x={Math.round((CX + lr * Math.cos(rad)) * 100) / 100} y={Math.round((CY + lr * Math.sin(rad)) * 100) / 100}>
                {PC_NAMES[chroma]}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Each point's note in the current tuning, just inside the circle. */
function NoteLabels({ s }: { s: FigureSoundState }) {
  const doChroma = nearestNote(s.doHz).chroma;
  return (
    <g className="he-web-notes" aria-hidden="true">
      {NUMS.map((t) => {
        const tone = toneOf(t as Point, s.tuning, s.temperament);
        const c = chromaOf(t as Point, doChroma, s.tuning, s.temperament);
        const lp = pt(t, R - 46);
        return (
          <text key={t} x={lp.x} y={lp.y} className={tone.kind === "shock" ? "he-web-shock" : undefined}>
            {tone.kind === "shock" ? "shock" : s.tuning === "harmonic" ? tone.ratio : `${tone.name} ${c === null ? "" : PC_NAMES[c]}`}
          </text>
        );
      })}
    </g>
  );
}

const HUE: Record<CenterKey, string> = { gut: "var(--he-gut)", heart: "var(--he-heart)", head: "var(--he-head)" };
const MODE_KEYS = Object.keys(MODES) as ModeKey[];
const CHIP_LABEL: Record<ModeKey, string> = { centers: "Centers", object: "Object relation", energy: "Energy style", attitude: "Attitude" };
const INSTRUMENT_TICKS = ticks(108, 12, 12, 17, 24);

function hueFor(mode: ModeKey, t: TypeNum): string {
  for (const g of MODES[mode].groups) if (g.types.includes(t)) return HUE[g.hue];
  return "var(--he-ink-dim)";
}

const fill = (tpl: string, t: TypeNum) => tpl.replace(/\{n\}/g, String(t));

interface Segment {
  label: string;
  body: React.ReactNode;
}

function segmentsFor(t: TypeNum, typeHref: string): Segment[] {
  const d = TYPES[t];
  const [w1, w2] = wingsOf(t);
  return [
    {
      label: "Essence",
      body: (
        <>
          <p className="he-dossier-epithets">{d.epithets}</p>
          <p className="he-lead-cap">{d.essence[0]}</p>
        </>
      ),
    },
    {
      label: "The fixation",
      body: (
        <>
          {d.essence.slice(1).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <blockquote className="he-dossier-story">{d.story}</blockquote>
        </>
      ),
    },
    {
      label: "Qualities",
      body: (
        <ul className="he-qualities">
          {d.qualities.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      ),
    },
    {
      label: "Hidden triads",
      body: (
        <div className="he-triad-list">
          {d.triads.map(([k, v]) => (
            <div key={k}>
              <b>{k}</b> — {v}
            </div>
          ))}
        </div>
      ),
    },
    {
      label: "Wings & lines",
      body: (
        <>
          <div className="he-wing-pair">
            {d.wings.map(([w, v]) => (
              <article key={w}>
                <span className="he-wing-tag">{w}</span>
                {v}
              </article>
            ))}
          </div>
          <div className="he-dossier-relations">
            <span>
              wings <b>{w1} · {w2}</b>
            </span>
            <span className="he-rel-stress">
              stress → <b>{STRESS[t]}</b>
            </span>
            <span className="he-rel-growth">
              growth → <b>{GROWTH[t]}</b>
            </span>
          </div>
          {typeHref ? (
            <p className="he-dossier-more">
              <a href={fill(typeHref, t)}>Ario&rsquo;s page on type {t} →</a>
            </p>
          ) : null}
        </>
      ),
    },
  ];
}

export function AeonFigure({
  mode: initialMode = "centers",
  start = 9,
  size = "large",
  controls = true,
  reader = "full",
  readHref = "/enneagram#type-{n}",
  typeHref = "",
  followHash = false,
  idBase = "he-fig",
  sound = null,
}: AeonFigureProps) {
  const [mode, setMode] = useState<ModeKey>(MODES[initialMode] ? initialMode : "centers");
  const [selected, setSelected] = useState<TypeNum>(isTypeNum(start) ? start : 9);
  const [segment, setSegment] = useState(0);
  const [turned, setTurned] = useState(0);
  const [hovered, setHovered] = useState<TypeNum | null>(null);
  const nodeRefs = useRef<Partial<Record<TypeNum, SVGGElement | null>>>({});
  const s = useFigureSound(sound, mode);

  // The editor changes the props in place: follow them.
  useEffect(() => setMode(MODES[initialMode] ? initialMode : "centers"), [initialMode]);
  useEffect(() => {
    if (isTypeNum(start)) setSelected(start);
  }, [start]);

  // `#type-N` opens on that type (and follows later hash changes on the page).
  useEffect(() => {
    if (!followHash) return;
    const read = () => {
      const m = /^#type-([1-9])$/.exec(window.location.hash);
      if (m) {
        setSelected(Number(m[1]) as TypeNum);
        setSegment(0);
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [followHash]);

  function select(t: TypeNum, focus = false) {
    s.tap(t);
    setSelected(t);
    setSegment(0);
    setTurned((n) => n + 1);
    if (focus) nodeRefs.current[t]?.focus();
  }

  function onNodeKey(e: KeyboardEvent<SVGGElement>, t: TypeNum) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(t);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(nextType(t), true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(prevType(t), true);
    }
  }

  const d = TYPES[selected];
  const segs = segmentsFor(selected, typeHref);
  const i = Math.min(segment, segs.length - 1);
  const last = i === segs.length - 1;
  const touches = (a: number, b: number) => a === selected || b === selected;
  const stress = trimmedLine(selected, STRESS[selected]);
  const growth = trimmedLine(GROWTH[selected], selected);
  const dossierId = `${idBase.replace(/[^A-Za-z0-9_-]/g, "-")}-dossier`;

  return (
    <div className="he-fig" data-size={size} data-reader={reader} data-mode={mode}>
      <div className="he-fig-grid">
      <div className="he-fig-stage">
        {controls ? (
          <div className="he-mode-chips" role="group" aria-label="Figure lens">
            {MODE_KEYS.map((k) => (
              <button key={k} type="button" className="he-chip" aria-pressed={k === mode} onClick={() => setMode(k)}>
                {CHIP_LABEL[k]}
              </button>
            ))}
          </div>
        ) : null}

        {sound ? <SoundBar s={s} mic={sound.mic} /> : null}

        <div className="he-wheel-box" data-sounding={s.sounding.length ? "" : undefined}>
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="group"
            aria-label="Interactive enneagram. Nine points on a circle; select a point to read its type."
          >
            <circle cx={CX} cy={CY} r={R} className="he-ring" />
            <g className="he-ring-ticks">
              {INSTRUMENT_TICKS.map((l, n) => (
                <line key={n} {...l} />
              ))}
            </g>
            <g>
              {TRIANGLE.map(([a, b]) => (
                <line key={`t${a}-${b}`} {...trimmedLine(a, b)} className={`he-figure-line he-triangle${touches(a, b) ? "" : " he-dimmed"}`} />
              ))}
              {HEXAGRAM.map(([a, b]) => (
                <line key={`h${a}-${b}`} {...trimmedLine(a, b)} className={`he-figure-line${touches(a, b) ? "" : " he-dimmed"}`} />
              ))}
            </g>
            {sound?.web === "ring" ? <WebRing s={s} /> : null}
            {sound && sound.web !== "off" ? <NoteLabels s={s} /> : null}
            <g>
              <path d={arcPath(selected)} className="he-wing-arc" />
            </g>
            <g key={`flow-${selected}`}>
              <line {...stress} className="he-flow-line he-stress" />
              <line {...growth} className="he-flow-line he-growth" />
            </g>
            <g>
              {NUMS.map((t) => {
                const lp = pt(t, R + 52);
                const show = t === selected || t === hovered;
                return (
                  <text key={t} x={lp.x} y={lp.y} className={`he-node-label${show ? " he-show" : ""}`}>
                    {TYPES[t].name.replace(/^The /, "")}
                  </text>
                );
              })}
            </g>
            {NUMS.map((t) => {
              const p = pt(t);
              return (
                <g
                  key={t}
                  ref={(node) => {
                    nodeRefs.current[t] = node;
                  }}
                  className={`he-node${t === selected ? " he-selected" : ""}${s.sounding.includes(t as Point) ? " he-sounding" : ""}${s.heard?.point === t ? " he-heard" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={t === selected}
                  aria-controls={reader === "none" ? undefined : dossierId}
                  aria-label={`Type ${t}, ${TYPES[t].name}, ${TYPES[t].script}`}
                  style={{ ["--node-hue" as string]: hueFor(mode, t) }}
                  onClick={() => select(t)}
                  onKeyDown={(e) => onNodeKey(e, t)}
                  onMouseEnter={() => setHovered(t)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle cx={p.x} cy={p.y} r={NODE_R + 7} className="he-halo" />
                  <circle cx={p.x} cy={p.y} r={NODE_R} className="he-face" />
                  <text x={p.x} y={p.y + 1}>
                    {t}
                  </text>
                  {s.heard?.point === t ? (
                    <text x={p.x} y={p.y + NODE_R + 18} className="he-heard-cents" aria-hidden="true">
                      {s.heard.cents > 0 ? "+" : ""}
                      {s.heard.cents}¢
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>

        {controls ? (
          <div className="he-figure-legend">
            {MODES[mode].groups.map((g) => (
              <span key={g.name} className="he-key">
                <i className="he-swatch" style={{ ["--sw" as string]: HUE[g.hue] }} />
                {g.name}
              </span>
            ))}
            <span className="he-key">
              <i className="he-swatch he-dash" style={{ ["--sw" as string]: "var(--he-stress)" }} />
              stress line
            </span>
            <span className="he-key">
              <i className="he-swatch he-dash" style={{ ["--sw" as string]: "var(--he-growth)" }} />
              growth line
            </span>
          </div>
        ) : null}
      </div>

      {reader === "none" ? null : (
        <article
          id={dossierId}
          className="he-dossier"
          aria-live="polite"
          style={{ ["--type-hue" as string]: HUE[d.center] }}
        >
          <header className="he-dossier-head">
            <span className="he-dossier-num">{selected}</span>
            <div className="he-dossier-id">
              <h3>{d.name}</h3>
              <span className="he-dossier-script">
                {d.script} — {d.tagline}
              </span>
            </div>
          </header>

          {reader === "summary" ? (
            <div className="he-seg-body">
              <p className="he-dossier-epithets">{d.epithets}</p>
              <p>{d.description}</p>
              {d.keywords.length ? (
                <p className="he-keywords">
                  {d.keywords.map((k) => (
                    <span key={k}>{k}</span>
                  ))}
                </p>
              ) : null}
              <p className="he-dossier-more">
                <a href={fill(readHref, selected)}>Read type {selected} step by step →</a>
              </p>
            </div>
          ) : (
            <>
              <nav className="he-seg-rail" aria-label="Reading steps">
                {segs.map((s, n) => (
                  <span key={s.label} className="he-seg-item">
                    <button
                      type="button"
                      className="he-seg-dot"
                      aria-current={n === i ? "step" : undefined}
                      onClick={() => {
                        setSegment(n);
                        setTurned((x) => x + 1);
                      }}
                    >
                      {s.label}
                    </button>
                    {n < segs.length - 1 ? (
                      <span className="he-seg-sep" aria-hidden="true">
                        —
                      </span>
                    ) : null}
                  </span>
                ))}
              </nav>
              <div key={`${selected}-${i}-${turned}`} className={`he-seg-body${turned ? " he-turning" : ""}`}>
                {segs[i]!.body}
              </div>
              <div className="he-seg-pager">
                <button
                  type="button"
                  className="he-seg-btn"
                  disabled={i === 0}
                  onClick={() => {
                    setSegment(i - 1);
                    setTurned((x) => x + 1);
                  }}
                >
                  ← Back
                </button>
                <span className="he-seg-count">
                  {i + 1} / {segs.length}
                </span>
                {last ? (
                  <button type="button" className="he-seg-btn he-next-type" onClick={() => select(nextType(selected))}>
                    Type {nextType(selected)} →
                  </button>
                ) : (
                  <button
                    type="button"
                    className="he-seg-btn"
                    onClick={() => {
                      setSegment(i + 1);
                      setTurned((x) => x + 1);
                    }}
                  >
                    Next →
                  </button>
                )}
              </div>
            </>
          )}
        </article>
      )}
      </div>
    </div>
  );
}
