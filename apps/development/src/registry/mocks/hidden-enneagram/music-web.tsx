import { HEXAGRAM, NUMS, TRIANGLE } from "../../../../../hidden-enneagram/src/components/aeon/geometry";
import { SectionHead } from "./parts";

const SIZE = 640;
const C = SIZE / 2;
const OUT = 270;
const MID = 170;
const NOTES = ["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F"];
const DIA = [0, 1, 2, 3, 4, 5, 11];
const at = (i: number, n: number, r: number) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
const pt9 = (t: number) => at(t % 9, 9, MID);

/** A still of the ring: twelve notes outside, the nine inside. Sound and microphone are not mocked. */
export default function Mock() {
  return (
    <section className="blk he-music-web">
      <SectionHead eyebrow="Sound" title="The web of music" lede="Twelve notes make the musical world; the enneagram has nine points. Here they sit side by side." />
      <div className="he-mw" data-view="ring">
        <div className="he-sound-row">
          <button type="button" className="he-chip he-sound-toggle" aria-pressed={false}>
            Sound off
          </button>
          <span className="he-mw-sep" aria-hidden="true" />
          <button type="button" className="he-chip" aria-pressed={true}>
            Ring of 9 and 12
          </button>
          <button type="button" className="he-chip" aria-pressed={false}>
            Tonnetz
          </button>
        </div>
        <div className="he-mw-stage">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="he-mw-svg" role="img" aria-label="The web of music">
            <circle cx={C} cy={C} r={OUT} className="he-web-circle" />
            {NOTES.map((n, i) => {
              const p = at(i, 12, OUT);
              return (
                <g key={n} className={`he-mw-pc${DIA.includes(i) ? " he-mw-dia" : ""}${i === 0 ? " he-on" : ""}`}>
                  <circle cx={p.x} cy={p.y} r={21} />
                  <text x={p.x} y={p.y}>
                    {n}
                  </text>
                </g>
              );
            })}
            <circle cx={C} cy={C} r={MID} className="he-ring" />
            {TRIANGLE.map(([a, b]) => (
              <line key={`t${a}${b}`} x1={pt9(a).x} y1={pt9(a).y} x2={pt9(b).x} y2={pt9(b).y} className="he-figure-line he-triangle" />
            ))}
            {HEXAGRAM.map(([a, b]) => (
              <line key={`h${a}${b}`} x1={pt9(a).x} y1={pt9(a).y} x2={pt9(b).x} y2={pt9(b).y} className="he-figure-line" />
            ))}
            {NUMS.map((t) => {
              const p = pt9(t);
              return (
                <g key={t} className={`he-mw-pt${t === 9 ? " he-on" : ""}`}>
                  <circle cx={p.x} cy={p.y} r={18} />
                  <text x={p.x} y={p.y}>
                    {t}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="he-mw-credit he-sound-note">A sample note under the web: how the nine are tuned against the twelve.</p>
      </div>
    </section>
  );
}
