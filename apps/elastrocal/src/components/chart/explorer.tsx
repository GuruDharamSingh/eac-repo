"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SIGNS, SIGN_BY_KEY, type AspectKey, type AspectPoint, type ChartResult } from "@elkdonis/astro";
import { renderWheelSvg } from "@elkdonis/astro/wheel";
import type { ExplorerElement, ExplorerModel, Fact } from "@/lib/chart-explorer";
import type { KeyPassages } from "@/lib/references";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import { ELEMENT_TEXT, Glyph } from "./glyph";
import { FactorItem, Favourites, RefsProvider, VoteError, useChartId, useStaleKeys, type RefState } from "./references-ui";

/**
 * The chart explorer.
 *
 * The wheel is the ordinary renderer's SVG (@elkdonis/astro/wheel), and over
 * it sits a second SVG in the same 1180×1180 coordinate space holding the
 * hit targets and the highlights. The geometry constants below are the
 * renderer's on-screen "full" wheel (svg-core.ts geometry(): wheel/full,
 * single chart); if those move, these must move with them.
 *
 * Interaction:
 *  - hover or keyboard focus → that element is ACTIVE: it and its related
 *    elements light up, everything else on the wheel dims, the panel shows it;
 *  - click / Enter / Space → PIN it (the panel stays on it while the pointer
 *    wanders); the same again, Esc, or a click on the empty centre → unpin;
 *  - while something is pinned, hovering still previews on the wheel, but the
 *    panel keeps the pinned element.
 */

// ── geometry: svg-core.ts, layout "wheel", variant "full", not a bi-wheel ──
const G = { W: 1180, CX: 590, CY: 590, R_OUT: 474, R_Z: 402, R_H: 350, R_P: 296, R_C: 262, halo: 25, spread: 12, axisOffset: 70 };
/** The renderer's aspect colours (svg-core.ts ASPECT_STYLE, not exported from ./wheel). */
const ASPECT_STYLE: Record<AspectKey, { color: string; dash?: string }> = {
  conjunction: { color: "#b08a33" },
  trine: { color: "#274f9e" },
  sextile: { color: "#6f9fe0" },
  square: { color: "#c9453d" },
  opposition: { color: "#a52a2a", dash: "6 4" },
  quincunx: { color: "#8a6bb5", dash: "2 3" },
  semisextile: { color: "#9aa4b8", dash: "2 3" },
  semisquare: { color: "#d08a7a", dash: "2 3" },
  sesquisquare: { color: "#d08a7a", dash: "2 3" },
};
const rad = (d: number) => (d * Math.PI) / 180;

/** Props every hover/pin target carries, on the wheel and in the lists. */
interface TargetProps {
  tabIndex: number;
  role: "button";
  "aria-label": string;
  "aria-pressed": boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: (e: React.MouseEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}
const f2 = (n: number) => Number(n.toFixed(2));

function useGeometry(chart: ChartResult) {
  return useMemo(() => {
    const origin = chart.angles.ascendant;
    const pt = (lon: number, r: number): [number, number] => {
      const phi = rad(180 + (lon - origin));
      return [f2(G.CX + r * Math.cos(phi)), f2(G.CY - r * Math.sin(phi))];
    };
    const annulus = (a0: number, a1: number, r0: number, r1: number) => {
      const span = (((a1 - a0) % 360) + 360) % 360;
      const [sx, sy] = pt(a0, r1), [ix, iy] = pt(a0 + span, r1), [ex, ey] = pt(a0 + span, r0), [jx, jy] = pt(a0, r0);
      const big = span > 180 ? 1 : 0;
      return `M ${sx} ${sy} A ${r1} ${r1} 0 ${big} 0 ${ix} ${iy} L ${ex} ${ey} A ${r0} ${r0} 0 ${big} 1 ${jx} ${jy} Z`;
    };
    // The renderer's glyph spreading (spreadRing), so targets sit on the glyphs.
    const sorted = [...chart.bodies].sort((a, b) => a.longitude - b.longitude);
    const placed: Array<{ key: AspectPoint; lon: number; disp: number }> = [];
    for (const b of sorted) {
      let disp = b.longitude;
      const prev = placed[placed.length - 1];
      if (prev && disp - prev.disp < G.spread) disp = prev.disp + G.spread;
      placed.push({ key: b.key, lon: b.longitude, disp });
    }
    if (placed.length > 1) {
      const first = placed[0], last = placed[placed.length - 1];
      if (first.lon + 360 - last.disp < G.spread) first.disp = last.disp + G.spread - 360;
    }
    const glyphAt = new Map<AspectPoint, [number, number]>();
    const lonOf = new Map<AspectPoint, number>();
    for (const p of placed) {
      glyphAt.set(p.key, pt(p.disp, G.R_P));
      lonOf.set(p.key, p.lon);
    }
    glyphAt.set("ascendant", pt(chart.angles.ascendant, G.R_OUT + G.axisOffset));
    glyphAt.set("midheaven", pt(chart.angles.midheaven, G.R_OUT + G.axisOffset));
    lonOf.set("ascendant", chart.angles.ascendant);
    lonOf.set("midheaven", chart.angles.midheaven);
    return { pt, annulus, glyphAt, lonOf };
  }, [chart]);
}

type View = "chart" | "favourites";

/**
 * The explorer with its two views: the chart (wheel + panel) and Favourites
 * (?view=favourites). The view is kept in the URL so it can be linked to.
 */
export function ChartExplorer({
  chartId,
  chart,
  model,
  canSeeReferences,
  isOwner = false,
  initialView = "chart",
}: {
  chartId: string;
  chart: ChartResult;
  model: ExplorerModel;
  canSeeReferences: boolean;
  /** The studio owner: votes, Favourites, whole passages. */
  isOwner?: boolean;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(isOwner ? initialView : "chart");
  const [elementId, setElementId] = useState<string | null>(null);
  const choose = (v: View) => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === "favourites") url.searchParams.set("view", "favourites");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };
  const factorLabels = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of Object.values(model.elements)) for (const f of e.factors) m[f.key] = f.label;
    return m;
  }, [model]);

  return (
    <RefsProvider chartId={chartId} elementId={elementId} isOwner={isOwner}>
      {isOwner && (
        <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
          {(
            [
              ["chart", "Chart"],
              ["favourites", "★ Favourites"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => choose(v)}
              className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", view === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {view === "favourites" ? (
        <Favourites chartId={chartId} factorLabels={factorLabels} />
      ) : (
        <ChartView chart={chart} model={model} canSeeReferences={canSeeReferences} onPanelElement={setElementId} />
      )}
    </RefsProvider>
  );
}

function ChartView({
  chart,
  model,
  canSeeReferences,
  onPanelElement,
}: {
  chart: ChartResult;
  model: ExplorerModel;
  canSeeReferences: boolean;
  onPanelElement: (id: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  // The last thing hovered stays in the panel, so the pointer can travel to it.
  const [lastHover, setLastHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const staleKeys = useStaleKeys();
  const chartId = useChartId();
  const [showMinor, setShowMinor] = useState(false);
  const [refs, setRefs] = useState<Record<string, RefState>>({});
  const [refsError, setRefsError] = useState<string | null>(null);
  const geo = useGeometry(chart);
  const els = model.elements;

  const wheelSvg = useMemo(
    () =>
      renderWheelSvg(chart, {
        variant: "full",
        minorAspects: showMinor,
        rootAttrs: 'role="img" aria-label="Chart wheel"',
        background: "#ffffff",
      }),
    [chart, showMinor],
  );

  // What the wheel shows (hover wins, so the pointer can preview while pinned)
  // and what the panel shows (a pin wins, so it can be read at leisure).
  const wheelId = hover ?? pinned;
  const panelId = pinned ?? hover ?? lastHover;
  useEffect(() => onPanelElement(panelId), [panelId, onPanelElement]);
  const lit = useMemo(() => {
    const s = new Set<string>();
    if (!wheelId || !els[wheelId]) return s;
    s.add(wheelId);
    for (const r of els[wheelId].related) s.add(r);
    return s;
  }, [wheelId, els]);

  const togglePin = useCallback((id: string) => setPinned((p) => (p === id ? null : id)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(null);
        setHover(null);
        setLastHover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── references: fetch what the panel's element needs, once per key ──
  const refsRef = useRef(refs);
  useEffect(() => {
    refsRef.current = refs;
  }, [refs]);
  useEffect(() => {
    if (!canSeeReferences || !panelId) return;
    const el = els[panelId];
    if (!el) return;
    const fresh = (k: string) => refsRef.current[k] && !staleKeys.has(k);
    const keys = el.factors.map((f) => f.key).filter((k) => !fresh(k));
    const slug = el.patternPhrase?.toLowerCase().replace(/\s+/g, "-");
    const patterns = slug && !fresh(`pattern:${slug}`) ? [slug] : [];
    if (keys.length === 0 && patterns.length === 0) return;
    // A short wait, so sweeping the pointer across the wheel doesn't fire a request per glyph.
    const timer = setTimeout(async () => {
      const marking = Object.fromEntries([...keys, ...patterns.map((p) => `pattern:${p}`)].map((k) => [k, "loading" as const]));
      setRefs((r) => ({ ...marking, ...r }));
      try {
        const qs = new URLSearchParams({ chartId, keys: keys.join(","), patterns: patterns.join(","), limit: "3" });
        const res = await fetch(withBase(`/api/astro/references?${qs}`));
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setRefs((r) => ({ ...r, ...(json.refs as Record<string, KeyPassages>) }));
        for (const k of Object.keys(marking)) staleKeys.delete(k);
        setRefsError(null);
      } catch (err) {
        setRefs((r) => {
          const next = { ...r };
          for (const k of Object.keys(marking)) if (next[k] === "loading") next[k] = "error";
          return next;
        });
        setRefsError(err instanceof Error ? err.message : "Lookup failed");
      }
    }, pinned ? 0 : 160);
    return () => clearTimeout(timer);
  }, [panelId, pinned, els, canSeeReferences, staleKeys, chartId]);

  // Handlers shared by every target, on the wheel and in the lists.
  // `sticky`: hovering also makes it the panel's subject (wheel targets) — not for chips inside the panel.
  const targetProps = (id: string, label: string, sticky = true): TargetProps => ({
    tabIndex: 0,
    role: "button" as const,
    "aria-label": label,
    "aria-pressed": pinned === id,
    onMouseEnter: () => {
      setHover(id);
      if (sticky) setLastHover(id);
    },
    onMouseLeave: () => setHover((h) => (h === id ? null : h)),
    onFocus: () => {
      setHover(id);
      if (sticky) setLastHover(id);
    },
    onBlur: () => setHover((h) => (h === id ? null : h)),
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      togglePin(id);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        togglePin(id);
      }
    },
  });

  const aspectOf = (id: string) => {
    const e = els[id];
    return { a: e.points[0], b: e.points[1], type: e.aspect!.type, major: e.aspect!.major };
  };
  // The chords the base wheel actually draws (no conjunctions; minors on request).
  const drawnAspects = model.order.aspects.filter((id) => {
    const { type, major } = aspectOf(id);
    return type !== "conjunction" && (major || showMinor);
  });
  const dimming = lit.size > 0;
  const activePattern = wheelId && els[wheelId]?.kind === "pattern" ? els[wheelId] : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-paper p-2 shadow-sm">
          <div className="relative mx-auto aspect-square w-full" onClick={() => {
              setPinned(null);
              setLastHover(null);
            }}>
            <div className="wheel absolute inset-0" dangerouslySetInnerHTML={{ __html: wheelSvg }} />
            <svg
              viewBox={`0 0 ${G.W} ${G.W}`}
              className="absolute inset-0 h-full w-full select-none"
              aria-label="Chart elements"
              role="group"
            >
              {/* Signs: the zodiac band. */}
              {SIGNS.map((s, i) => {
                const id = `sign:${s.key}`;
                const on = lit.has(id);
                return (
                  <path
                    key={id}
                    d={geo.annulus(i * 30, i * 30 + 30, G.R_Z, G.R_OUT)}
                    className={cn("cursor-pointer outline-none transition-opacity", on ? `${FILL_EL[s.element]} opacity-30` : "fill-transparent")}
                    {...targetProps(id, `${s.name}`)}
                    tabIndex={-1}
                  />
                );
              })}
              {/* Houses: the band where the house numbers sit. */}
              {model.order.houses.map((id) => {
                const n = Number(id.split(":")[1]);
                const a0 = chart.houses[n - 1].longitude;
                const a1 = chart.houses[n % 12].longitude;
                const on = lit.has(id);
                return (
                  <path
                    key={id}
                    d={geo.annulus(a0, a1, G.R_H, G.R_Z)}
                    className={cn("cursor-pointer outline-none", on ? "fill-primary/15" : "fill-transparent")}
                    {...targetProps(id, els[id].label)}
                    tabIndex={-1}
                  />
                );
              })}

              {/* The dimming veil over the aspect web, under the highlights. */}
              {dimming && <circle cx={G.CX} cy={G.CY} r={G.R_C - 1} className="pointer-events-none fill-white opacity-75" />}

              {/* An aspect-figure pattern: its shape across the centre. */}
              {activePattern && activePattern.points.length >= 3 && activePattern.patternType !== "stellium-sign" && activePattern.patternType !== "stellium-house" && (
                <polygon
                  points={activePattern.points.map((p) => geo.pt(geo.lonOf.get(p)!, G.R_C - 4).join(",")).join(" ")}
                  className="pointer-events-none fill-gold/10 stroke-gold"
                  strokeWidth={2}
                  strokeDasharray="8 6"
                />
              )}

              {/* Lit aspects, redrawn heavy above the veil — including conjunctions and minors the base leaves out. */}
              {model.order.aspects
                .filter((id) => lit.has(id))
                .map((id) => {
                  const { a, b, type } = aspectOf(id);
                  const st = ASPECT_STYLE[type] ?? { color: "#6a6474" };
                  const la = geo.lonOf.get(a), lb = geo.lonOf.get(b);
                  if (la === undefined || lb === undefined) return null;
                  if (type === "conjunction") {
                    // Two glyphs side by side: an arc along the centre's rim joins them.
                    const lo = Math.min(la, lb), hi = Math.max(la, lb);
                    const [s0, s1] = hi - lo > 180 ? [hi, lo + 360] : [lo, hi];
                    const [x0, y0] = geo.pt(s0, G.R_C - 10), [x1, y1] = geo.pt(s1, G.R_C - 10);
                    return (
                      <path key={id} d={`M ${x0} ${y0} A ${G.R_C - 10} ${G.R_C - 10} 0 0 0 ${x1} ${y1}`} fill="none" stroke="#b08a33" strokeWidth={7} strokeLinecap="round" className="pointer-events-none" />
                    );
                  }
                  const [x0, y0] = geo.pt(la, G.R_C - 4), [x1, y1] = geo.pt(lb, G.R_C - 4);
                  return (
                    <line key={id} x1={x0} y1={y0} x2={x1} y2={y1} stroke={st.color} strokeWidth={id === wheelId ? 6 : 4} strokeDasharray={st.dash} strokeLinecap="round" className="pointer-events-none" />
                  );
                })}

              {/* Aspect hit targets: wide, invisible strokes along each drawn chord. */}
              {drawnAspects.map((id) => {
                const { a, b } = aspectOf(id);
                const la = geo.lonOf.get(a), lb = geo.lonOf.get(b);
                if (la === undefined || lb === undefined) return null;
                const [x0, y0] = geo.pt(la, G.R_C - 4), [x1, y1] = geo.pt(lb, G.R_C - 4);
                return (
                  <line
                    key={`hit-${id}`}
                    x1={x0} y1={y0} x2={x1} y2={y1}
                    stroke="transparent"
                    strokeWidth={16}
                    pointerEvents="stroke"
                    className="cursor-pointer outline-none"
                    {...targetProps(id, `${els[id].label}, ${els[id].detail}`)}
                  />
                );
              })}

              {/* Points: rings around glyphs; unrelated glyphs fade while something is lit. */}
              {model.order.points.map((id) => {
                const p = els[id].points[0];
                const at = geo.glyphAt.get(p);
                if (!at) return null;
                const on = lit.has(id);
                const isAngle = p === "ascendant" || p === "midheaven";
                const r = isAngle ? 36 : G.halo + 4;
                return (
                  <g key={id} className="cursor-pointer outline-none" {...targetProps(id, `${els[id].label}, ${els[id].detail}`)}>
                    {dimming && !on && !isAngle && <circle cx={at[0]} cy={at[1]} r={G.halo} className="pointer-events-none fill-white opacity-70" />}
                    <circle
                      cx={at[0]}
                      cy={at[1]}
                      r={r}
                      className={cn(on ? "stroke-primary" : "stroke-transparent", "fill-transparent")}
                      strokeWidth={id === wheelId ? 5 : 3}
                    />
                    {p === model.chartRuler && <circle cx={at[0] + r * 0.72} cy={at[1] - r * 0.72} r={5} className="pointer-events-none fill-gold" />}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Lists: the same targets as buttons — for touch, and for keyboard order. */}
        <div className="space-y-3">
          {model.order.patterns.length > 0 && (
            <ChipRow title="Patterns">
              {model.order.patterns.map((id) => (
                <Chip key={id} on={lit.has(id)} pinned={pinned === id} {...targetProps(id, `${els[id].label}: ${els[id].detail}`)}>
                  <span className="font-medium">{els[id].label}</span>
                  <span className="text-muted-foreground"> · {els[id].points.map((p) => els[`point:${p}`]?.label ?? p).join(", ")}</span>
                </Chip>
              ))}
            </ChipRow>
          )}
          <ChipRow title="Points">
            {model.order.points.map((id) => (
              <Chip key={id} on={lit.has(id)} pinned={pinned === id} {...targetProps(id, els[id].label)} tabIndex={-1}>
                <Glyph className="mr-1 text-primary">{els[id].glyph ?? ""}</Glyph>
                {els[id].label}
              </Chip>
            ))}
          </ChipRow>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={showMinor} onChange={(e) => setShowMinor(e.target.checked)} className="accent-[hsl(var(--primary))]" />
            Draw minor aspects
          </label>
        </div>
      </div>

      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
        <Panel
          el={panelId ? els[panelId] : null}
          model={model}
          pinned={pinned !== null && pinned === panelId}
          onPin={togglePin}
          refs={refs}
          refsError={refsError}
          canSeeReferences={canSeeReferences}
          targetProps={(id, label) => targetProps(id, label, false)}
          lit={lit}
        />
      </aside>
    </div>
  );
}

const FILL_EL: Record<string, string> = { fire: "fill-fire", earth: "fill-earth", air: "fill-air", water: "fill-water" };

function ChipRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, pinned, children, className, ...rest }: { on: boolean; pinned: boolean; children: React.ReactNode; className?: string } & Partial<TargetProps>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        pinned ? "border-primary bg-primary text-primary-foreground [&_.text-muted-foreground]:text-primary-foreground/80 [&_.text-primary]:text-primary-foreground" : on ? "border-primary/60 bg-accent text-accent-foreground" : "border-border bg-card hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

const KIND_LABEL: Record<ExplorerElement["kind"], string> = { point: "Point", aspect: "Aspect", pattern: "Pattern", sign: "Sign", house: "House" };
const TONE: Record<NonNullable<Fact["tone"]>, string> = { good: "text-air", bad: "text-fire", gold: "text-gold" };

function Panel({
  el,
  model,
  pinned,
  onPin,
  refs,
  refsError,
  canSeeReferences,
  targetProps,
  lit,
}: {
  el: ExplorerElement | null;
  model: ExplorerModel;
  pinned: boolean;
  onPin: (id: string) => void;
  refs: Record<string, RefState>;
  refsError: string | null;
  canSeeReferences: boolean;
  targetProps: (id: string, label: string) => TargetProps;
  lit: Set<string>;
}) {
  const [groupBy, setGroupBy] = useState<"book" | "author">("book");
  const els = model.elements;

  if (!el) {
    const ruler = els[`point:${model.chartRuler}`];
    return (
      <section className="rounded-xl border border-border bg-card/80 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">The chart</h3>
        <dl className="space-y-1.5 text-sm">
          <FactRow label="Chart ruler" value={ruler ? `${ruler.label} — ${ruler.detail}` : "—"} tone="gold" />
          <FactRow label="Patterns" value={model.order.patterns.length ? model.order.patterns.map((id) => `${els[id].label} (${els[id].points.length})`).join(", ") : "none detected"} />
          <FactRow label="Aspects" value={`${model.order.aspects.length} in orb`} />
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">
          Hover a planet, an aspect line, a sign or a house. Its factor keys, the rulebook facts and
          {canSeeReferences ? " what the books say" : " (for studio reviewers) what the books say"} appear here.
        </p>
      </section>
    );
  }

  const patternKey = el.patternPhrase ? `pattern:${el.patternPhrase.toLowerCase().replace(/\s+/g, "-")}` : null;
  const refKeys = [...(patternKey ? [{ key: patternKey, label: `“${el.patternPhrase}” in the corpus` }] : []), ...el.factors];
  const related = el.related.filter((id) => els[id] && (els[id].kind === "point" || els[id].kind === "aspect" || els[id].kind === "pattern"));

  return (
    <section className="rounded-xl border border-border bg-card/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold">{KIND_LABEL[el.kind]}</div>
          <h3 className="mt-1 flex items-center gap-2 text-xl">
            {el.glyph && <Glyph className={cn("text-primary", el.kind === "sign" && ELEMENT_TEXT[SIGN_BY_KEY[el.id.split(":")[1] as keyof typeof SIGN_BY_KEY]?.element])}>{el.glyph}</Glyph>}
            <span className="truncate">{el.label}</span>
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{el.detail}</p>
        </div>
        <button
          type="button"
          onClick={() => onPin(el.id)}
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1 text-xs",
            pinned ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent",
          )}
        >
          {pinned ? "Pinned ✕" : "Pin"}
        </button>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        {el.facts.map((f, i) => (
          <FactRow key={i} {...f} />
        ))}
      </dl>

      {related.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Lights up</div>
          <div className="flex flex-wrap gap-1.5">
            {related.map((id) => (
              <Chip key={id} on={lit.has(id)} pinned={false} {...targetProps(id, els[id].label)} tabIndex={-1}>
                {els[id].glyph && <Glyph className="mr-1 text-primary">{els[id].glyph!}</Glyph>}
                {els[id].label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Factors &amp; references</h4>
          {canSeeReferences && (
            <div className="flex overflow-hidden rounded-md border border-border text-[11px]">
              {(["book", "author"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGroupBy(g)} className={cn("px-2 py-0.5", groupBy === g ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  by {g}
                </button>
              ))}
            </div>
          )}
        </div>
        {!canSeeReferences && <p className="mb-2 text-xs text-muted-foreground">Corpus references are shown to studio reviewers.</p>}
        {refsError && <p className="mb-2 text-xs text-destructive">{refsError}</p>}
        <VoteError />
        <ul className="space-y-2">
          {refKeys.map((f, i) => (
            <FactorItem key={f.key} factor={f} state={refs[f.key]} canSee={canSeeReferences} groupBy={groupBy} defaultOpen={i < 2} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function FactRow({ label, value, tone }: Fact) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(tone && TONE[tone])}>{value}</dd>
    </div>
  );
}
