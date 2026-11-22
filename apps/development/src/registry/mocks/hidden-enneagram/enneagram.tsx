import { MODES, STRESS, TYPES, type TypeNum } from "../../../../../hidden-enneagram/src/components/aeon/content";
import { CX, CY, GROWTH, HEXAGRAM, NODE_R, NUMS, R, SIZE, arcPath, pt, ticks, TRIANGLE, trimmedLine, wingsOf } from "../../../../../hidden-enneagram/src/components/aeon/geometry";
import { SectionHead } from "./parts";

const HUE = { gut: "var(--he-gut)", heart: "var(--he-heart)", head: "var(--he-head)" } as const;
const TICKS = ticks(108, 12, 12, 17, 24);
const SEL: TypeNum = 4;
const hueFor = (t: TypeNum) => {
  for (const g of MODES.centers.groups) if (g.types.includes(t)) return HUE[g.hue];
  return "var(--he-ink-dim)";
};

/** The figure picture and dossier as a still (no sound, no state); geometry and words come from the app own modules. */
export default function Mock() {
  const d = TYPES[SEL];
  const [w1, w2] = wingsOf(SEL);
  const touches = (a: number, b: number) => a === SEL || b === SEL;
  const stress = trimmedLine(SEL, STRESS[SEL]);
  const growth = trimmedLine(GROWTH[SEL], SEL);
  return (
    <section className="blk he-fig-block" data-reader="full" data-in="page">
      <SectionHead eyebrow="The instrument" title="Nine points, one circle" lede="Nine ways the psyche contracts around a core wound. Select a point and read its fixation a step at a time." />
      <div className="he-fig" data-size="large" data-reader="full" data-mode="centers">
        <div className="he-fig-grid">
          <div className="he-fig-stage">
            <div className="he-mode-chips" role="group">
              {["Centers", "Object relation", "Energy style", "Attitude"].map((c, i) => (
                <button key={c} type="button" className="he-chip" aria-pressed={i === 0}>
                  {c}
                </button>
              ))}
            </div>
            <div className="he-wheel-box">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="The enneagram figure">
                <circle cx={CX} cy={CY} r={R} className="he-ring" />
                <g className="he-ring-ticks">
                  {TICKS.map((l, n) => (
                    <line key={n} {...l} />
                  ))}
                </g>
                {TRIANGLE.map(([a, b]) => (
                  <line key={`t${a}${b}`} {...trimmedLine(a, b)} className={`he-figure-line he-triangle${touches(a, b) ? "" : " he-dimmed"}`} />
                ))}
                {HEXAGRAM.map(([a, b]) => (
                  <line key={`h${a}${b}`} {...trimmedLine(a, b)} className={`he-figure-line${touches(a, b) ? "" : " he-dimmed"}`} />
                ))}
                <path d={arcPath(SEL)} className="he-wing-arc" />
                <line {...stress} className="he-flow-line he-stress" />
                <line {...growth} className="he-flow-line he-growth" />
                {NUMS.map((t) => {
                  const lp = pt(t, R + 52);
                  return (
                    <text key={t} x={lp.x} y={lp.y} className={`he-node-label${t === SEL ? " he-show" : ""}`}>
                      {TYPES[t].name.replace(/^The /, "")}
                    </text>
                  );
                })}
                {NUMS.map((t) => {
                  const p = pt(t);
                  return (
                    <g key={t} className={`he-node${t === SEL ? " he-selected" : ""}`} style={{ ["--node-hue" as string]: hueFor(t) }}>
                      <circle cx={p.x} cy={p.y} r={NODE_R + 7} className="he-halo" />
                      <circle cx={p.x} cy={p.y} r={NODE_R} className="he-face" />
                      <text x={p.x} y={p.y + 1}>
                        {t}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="he-figure-legend">
              {MODES.centers.groups.map((g) => (
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
          </div>
          <article className="he-dossier" style={{ ["--type-hue" as string]: HUE[d.center] }}>
            <header className="he-dossier-head">
              <span className="he-dossier-num">{SEL}</span>
              <div className="he-dossier-id">
                <h3>{d.name}</h3>
                <span className="he-dossier-script">
                  {d.script} — {d.tagline}
                </span>
              </div>
            </header>
            <nav className="he-seg-rail" aria-label="Reading steps">
              {["Essence", "The fixation", "Qualities", "Hidden triads", "Wings and lines"].map((l, n) => (
                <span key={l} className="he-seg-item">
                  <button type="button" className="he-seg-dot" aria-current={n === 0 ? "step" : undefined}>
                    {l}
                  </button>
                  {n < 4 ? <span className="he-seg-sep">-</span> : null}
                </span>
              ))}
            </nav>
            <div className="he-seg-body">
              <p className="he-dossier-epithets">{d.epithets}</p>
              <p className="he-lead-cap">{d.essence[0]}</p>
            </div>
            <div className="he-dossier-relations">
              <span>
                wings{" "}
                <b>
                  {w1} / {w2}
                </b>
              </span>
              <span className="he-rel-stress">
                stress to <b>{STRESS[SEL]}</b>
              </span>
              <span className="he-rel-growth">
                growth to <b>{GROWTH[SEL]}</b>
              </span>
            </div>
            <div className="he-seg-pager">
              <button type="button" className="he-seg-btn" disabled>
                Back
              </button>
              <span className="he-seg-count">1 / 5</span>
              <button type="button" className="he-seg-btn">
                Next
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
