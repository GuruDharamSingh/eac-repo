"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { EnneagramProps } from "./enneagram";
import {
  ARC_R,
  CENTRES,
  CX,
  CY,
  ENNEAGRAM_TYPES,
  HEXAGRAM,
  LINE_GROUPS,
  LINE_GROUP_COLOURS,
  LINE_GROUP_LABELS,
  R,
  RING_R,
  TRIANGLE,
  TYPES,
  VIEWBOX,
  arcPath,
  connectionsOf,
  midDeg,
  pointOf,
  polar,
  sectorPath,
  type CentreId,
  type LineGroup,
  type TypeInfo,
} from "./enneagram.data";

// ============================================================================
// The interactive half of the enneagram block. See ./enneagram for what it is
// and why the declaration lives in a separate file.
//
// The draw-in is CSS, not JavaScript: every stroke has pathLength=1 and
// animates its dash offset from 1 to 0, staggered by a --at fraction of the
// total time. So the figure animates even before hydration, and a visitor who
// asked for reduced motion gets the finished figure from the stylesheet
// alone. JavaScript only pauses the drawing while the block is off screen, so
// a figure halfway down a page is still drawing when someone scrolls to it.
// ============================================================================

type Selection = { kind: "type"; n: number } | { kind: "centre"; id: CentreId } | null;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const colour = (v: unknown) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : undefined);

const ALL_LINES = [...TRIANGLE, ...HEXAGRAM];
const same = (a: readonly [number, number], b: readonly [number, number]) =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

// A circle as a path, so it can carry pathLength in every browser and start
// drawing from the top, where type 9 sits.
const RING_D = `M ${CX} ${CY - RING_R} A ${RING_R} ${RING_R} 0 1 1 ${CX - 0.01} ${CY - RING_R} Z`;

function initialGroups(colourLines: string | undefined): LineGroup[] {
  switch (colourLines) {
    case "369":
      return ["369"];
    case "hexagram":
      return ["hexagram"];
    case "both":
      return ["369", "hexagram"];
    default:
      return [];
  }
}

function initialSelection(startWith: string | undefined): Selection {
  if (startWith === "head" || startWith === "heart" || startWith === "body") {
    return { kind: "centre", id: startWith };
  }
  const n = Number(startWith);
  return n >= 1 && n <= 9 ? { kind: "type", n } : null;
}

const shortName = (name: string) => name.replace(/^The\s+/i, "");

export function EnneagramView({
  heading,
  intro,
  layout = "side",
  labels = "numbers",
  colourLines = "none",
  showControls = false,
  startWith = "none",
  animate = true,
  speed = 3,
  palette = "dark",
  font = "serif",
  size = 960,
  background,
  ink,
  headColour,
  heartColour,
  gutColour,
  headText,
  heartText,
  gutText,
  types,
}: EnneagramProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [pinned, setPinned] = useState<Selection>(() => initialSelection(startWith));
  const [hover, setHover] = useState<Selection>(null);
  const [groups, setGroups] = useState<LineGroup[]>(() => initialGroups(colourLines));
  const [playing, setPlaying] = useState(true);

  // An editor changing these should see the result, not keep the old state.
  useEffect(() => setPinned(initialSelection(startWith)), [startWith]);
  useEffect(() => setGroups(initialGroups(colourLines)), [colourLines]);

  // Hold the drawing until the figure is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!animate || !el || typeof IntersectionObserver === "undefined") return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;
    setPlaying(false);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPlaying(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [animate]);

  const centreColour: Record<CentreId, string | undefined> = {
    head: colour(headColour),
    heart: colour(heartColour),
    body: colour(gutColour),
  };
  const centreWords: Record<CentreId, string | undefined> = {
    head: headText,
    heart: heartText,
    body: gutText,
  };
  const centreVar = (id: CentreId) => `var(--enn-${id})`;

  // The hidden-enneagram text, with any rewritten fields laid over it.
  const info = useMemo(() => {
    const out: Record<number, TypeInfo> = {};
    for (const n of TYPES) out[n] = { ...ENNEAGRAM_TYPES[n]! };
    for (const row of types ?? []) {
      const n = Number(row.type);
      const base = out[n];
      if (!base) continue;
      const text = (k: string) => String(row[k] ?? "").trim();
      if (text("name")) base.name = text("name");
      if (text("tagline")) base.tagline = text("tagline");
      if (text("description")) base.description = text("description");
      if (text("keywords")) {
        base.keywords = text("keywords")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    return out;
  }, [types]);

  const shown = hover ?? pinned;
  const shownCentre: CentreId | null =
    shown?.kind === "centre" ? shown.id : shown?.kind === "type" ? info[shown.n]!.centre : null;
  const shownType = shown?.kind === "type" ? shown.n : null;

  const isSame = (a: Selection, b: Selection) =>
    !!a && !!b && a.kind === b.kind && (a.kind === "type" ? a.n === (b as { n: number }).n : a.id === (b as { id: CentreId }).id);
  const toggle = (s: Selection) => setPinned((prev) => (isSame(prev, s) ? null : s));

  const pointState = (n: number) => {
    if (!shown) return "on";
    if (shownType !== null) return n === shownType ? "lit" : info[n]!.centre === shownCentre ? "on" : "dim";
    return info[n]!.centre === shownCentre ? "lit" : "dim";
  };

  const lineColour = (line: readonly [number, number]) => {
    if (shownType !== null && (line[0] === shownType || line[1] === shownType)) {
      return { stroke: centreVar(info[shownType]!.centre), state: "lit" };
    }
    const group = groups.find((g) => LINE_GROUPS[g].some((l) => same(l, line)));
    if (group) return { stroke: LINE_GROUP_COLOURS[group], state: shownType !== null ? "dim" : "group" };
    return { stroke: "var(--enn-line)", state: shownType !== null ? "dim" : "on" };
  };

  // Hover belongs to a mouse. A finger "hovers" on touch-down and never
  // leaves, so on touch the tap alone decides.
  const hoverProps = (s: Selection) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setHover(s);
    },
    onPointerLeave: () => setHover(null),
    onFocus: () => setHover(s),
    onBlur: () => setHover(null),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      toggle(s);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(s);
      }
    },
  });

  const style = {
    "--enn-dur": `${Math.min(10, Math.max(1, Number(speed) || 3))}s`,
    "--enn-max": `${Number(size) || 960}px`,
    ...(colour(background) ? { "--enn-bg": colour(background) } : {}),
    ...(colour(ink) ? { "--enn-ink": colour(ink) } : {}),
    ...(centreColour.head ? { "--enn-head": centreColour.head } : {}),
    ...(centreColour.heart ? { "--enn-heart": centreColour.heart } : {}),
    ...(centreColour.body ? { "--enn-body": centreColour.body } : {}),
  } as CSSProperties;

  // Drawing order, as fractions of the total time: ring, centre arcs, the
  // triangle, the hexagram in one continuous stroke, then the points.
  const lineAt = (i: number) => 0.22 + i * 0.06;
  const pointAt = (i: number) => 0.78 + i * 0.022;

  return (
    <section
      ref={rootRef}
      className="blk blk-enn"
      data-layout={layout}
      data-palette={palette}
      data-font={font}
      data-animate={animate ? "true" : "false"}
      data-play={playing ? "running" : "paused"}
      style={style}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setPinned(null);
          setHover(null);
        }
      }}
    >
      {heading ? <h2 className="blk-enn-title">{heading}</h2> : null}

      <div className="blk-enn-body">
        <div className="blk-enn-figure">
          {showControls && (
            <div className="blk-enn-chips" role="group" aria-label="Line groups">
              {(Object.keys(LINE_GROUP_LABELS) as LineGroup[]).map((g) => {
                const on = groups.includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    className="blk-enn-chip"
                    aria-pressed={on}
                    style={{ "--chip": LINE_GROUP_COLOURS[g] } as CSSProperties}
                    onClick={() =>
                      setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
                    }
                  >
                    {LINE_GROUP_LABELS[g]}
                  </button>
                );
              })}
            </div>
          )}

          <svg
            // Remount, and so redraw, when the drawing itself is re-set.
            key={`${animate}-${speed}`}
            className="blk-enn-svg"
            viewBox={VIEWBOX}
            role="group"
            aria-label="Enneagram: nine points in three centres"
          >
            <rect
              x="-24"
              y="-24"
              width="608"
              height="608"
              fill="transparent"
              onClick={() => setPinned(null)}
            />

            {/* Centre tint, behind everything */}
            {CENTRES.map((c) => (
              <path
                key={`sector-${c.id}`}
                className="blk-enn-sector"
                data-state={shownCentre === c.id ? "lit" : "off"}
                d={sectorPath(c.startDeg, c.endDeg, RING_R)}
                fill={centreVar(c.id)}
              />
            ))}

            <path
              className="blk-enn-ring blk-enn-draw"
              d={RING_D}
              pathLength={1}
              style={{ "--at": 0, "--len": 0.2 } as CSSProperties}
            />

            {/* The three centres, as arcs around the ring */}
            {CENTRES.map((c, i) => {
              const mid = midDeg(c);
              const label = polar(mid, ARC_R + 20);
              // Side labels read away from their arc rather than across it.
              const labelAnchor = mid > 30 && mid < 150 ? "start" : mid > 210 && mid < 330 ? "end" : "middle";
              const state = !shownCentre ? "on" : shownCentre === c.id ? "lit" : "dim";
              return (
                <g
                  key={c.id}
                  className="blk-enn-centre"
                  data-state={state}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c.label} centre: types ${c.types.join(", ")}`}
                  aria-pressed={pinned?.kind === "centre" && pinned.id === c.id}
                  {...hoverProps({ kind: "centre", id: c.id })}
                >
                  <path
                    className="blk-enn-arc blk-enn-draw"
                    d={arcPath(c.startDeg + 4, c.endDeg - 4, ARC_R)}
                    pathLength={1}
                    stroke={centreVar(c.id)}
                    style={{ "--at": 0.12 + i * 0.04, "--len": 0.14 } as CSSProperties}
                  />
                  <path className="blk-enn-hit" d={arcPath(c.startDeg, c.endDeg, ARC_R)} />
                  <text
                    className="blk-enn-centre-label blk-enn-fade"
                    x={label.x}
                    y={label.y}
                    textAnchor={labelAnchor}
                    fill={centreVar(c.id)}
                    style={{ "--at": 0.2 + i * 0.04 } as CSSProperties}
                  >
                    {c.label.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* The figure */}
            {ALL_LINES.map((line, i) => {
              const a = pointOf(line[0]);
              const b = pointOf(line[1]);
              const { stroke, state } = lineColour(line);
              return (
                <path
                  key={`${line[0]}-${line[1]}`}
                  className="blk-enn-line blk-enn-draw"
                  data-state={state}
                  d={`M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`}
                  pathLength={1}
                  stroke={stroke}
                  style={{ "--at": lineAt(i), "--len": 0.07 } as CSSProperties}
                />
              );
            })}

            {/* The nine points */}
            {TYPES.map((n, i) => {
              const p = pointOf(n);
              const t = info[n]!;
              const state = pointState(n);
              const inward = pointOf(n, R - 34);
              const dx = inward.x - CX;
              // Top and bottom points label centred, the rest toward the middle,
              // so neighbouring names never run into each other.
              const centred = Math.abs(dx) < 60;
              const anchor = centred ? "middle" : dx > 0 ? "end" : "start";
              return (
                <g
                  key={n}
                  className="blk-enn-point"
                  data-state={state}
                  role="button"
                  tabIndex={0}
                  aria-label={`Type ${n}: ${t.name}`}
                  aria-pressed={pinned?.kind === "type" && pinned.n === n}
                  style={{ "--c": centreVar(t.centre) } as CSSProperties}
                  {...hoverProps({ kind: "type", n })}
                >
                  <g className="blk-enn-pop" style={{ "--at": pointAt(i) } as CSSProperties}>
                    <circle className="blk-enn-glow" cx={p.x} cy={p.y} r={28} />
                    <circle className="blk-enn-dot" cx={p.x} cy={p.y} r={18} />
                    <text className="blk-enn-num" x={p.x} y={p.y}>
                      {n}
                    </text>
                    {labels === "names" && (
                      <text
                        className="blk-enn-name"
                        x={inward.x}
                        y={inward.y + (centred ? (inward.y < CY ? 6 : -2) : 4)}
                        textAnchor={anchor}
                      >
                        {shortName(t.name)}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="blk-enn-panel" aria-live="polite">
          {shownType !== null ? (
            <TypePanel
              n={shownType}
              t={info[shownType]!}
              onPick={(n) => setPinned({ kind: "type", n })}
            />
          ) : shownCentre ? (
            <CentrePanel
              id={shownCentre}
              words={centreWords[shownCentre]}
              info={info}
              onPick={(n) => setPinned({ kind: "type", n })}
            />
          ) : (
            <div className="blk-enn-intro">
              {intro ? <p>{intro}</p> : null}
              <ul className="blk-enn-legend">
                {CENTRES.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      style={{ "--c": centreVar(c.id) } as CSSProperties}
                      onClick={() => setPinned({ kind: "centre", id: c.id })}
                    >
                      <span className="blk-enn-swatch" aria-hidden />
                      {c.label} · {c.types.join(" ")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TypePanel({ n, t, onPick }: { n: number; t: TypeInfo; onPick: (n: number) => void }) {
  const centre = CENTRES.find((c) => c.id === t.centre)!;
  return (
    <div className="blk-enn-card" style={{ "--c": `var(--enn-${t.centre})` } as CSSProperties}>
      <p className="blk-enn-eyebrow">
        Type {n} · {centre.label} centre
      </p>
      <h3 className="blk-enn-name-lg">{t.name}</h3>
      {t.tagline ? <p className="blk-enn-tagline">{t.tagline}</p> : null}
      <p className="blk-enn-desc">{t.description}</p>
      {t.keywords.length > 0 && (
        <ul className="blk-enn-keywords">
          {t.keywords.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      )}
      <p className="blk-enn-links">
        Joined to{" "}
        {connectionsOf(n).map((m, i) => (
          <span key={m}>
            {i > 0 ? " and " : null}
            <button type="button" onClick={() => onPick(m)}>
              {m}
            </button>
          </span>
        ))}
      </p>
    </div>
  );
}

function CentrePanel({
  id,
  words,
  info,
  onPick,
}: {
  id: CentreId;
  words: string | undefined;
  info: Record<number, TypeInfo>;
  onPick: (n: number) => void;
}) {
  const centre = CENTRES.find((c) => c.id === id)!;
  return (
    <div className="blk-enn-card" style={{ "--c": `var(--enn-${id})` } as CSSProperties}>
      <p className="blk-enn-eyebrow">Centre · types {centre.types.join(", ")}</p>
      <h3 className="blk-enn-name-lg">{centre.label}</h3>
      <p className="blk-enn-desc">{words?.trim() || centre.description}</p>
      <ul className="blk-enn-members">
        {centre.types.map((n) => (
          <li key={n}>
            <button type="button" onClick={() => onPick(n)}>
              <span className="blk-enn-member-num">{n}</span> {info[n]!.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
