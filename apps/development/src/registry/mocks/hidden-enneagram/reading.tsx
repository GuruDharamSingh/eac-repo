import { Wheel, type WheelSpec } from "../../../../../hidden-enneagram/src/components/aeon/wheel";
import { SectionHead } from "./parts";

const SPEC: WheelSpec = { lens: "centers", core: 4, wings: "both", arrows: "both", lit: [], lines: "all", marks: [], pins: [{ point: 4, text: "the mask" }] };

/** The reading stage with the real Wheel component (pure SVG) and invented words for an invented person. */
export default function Mock() {
  return (
    <section className="blk he-reading-block">
      <SectionHead eyebrow="A reading" title="A reading for a sample person" lede="A few opening words, written for one person, before the first step." />
      <div className="he-reading" data-view="stepper">
        <div className="he-r-tools" role="group">
          <button type="button" className="he-chip" aria-pressed={true}>
            Step by step
          </button>
          <button type="button" className="he-chip" aria-pressed={false}>
            Written out
          </button>
          <button type="button" className="he-chip">
            Print
          </button>
        </div>
        <section className="he-r-stage">
          <div className="he-r-figure">
            <Wheel spec={SPEC} idBase="mock-reading" label="Core four, both wings, stress and growth lines" />
          </div>
          <div className="he-r-text">
            <p className="he-r-count">Step 2 of 4</p>
            <div className="he-r-body">
              <h3>Where the pattern lives</h3>
              <div className="he-r-words">
                <p>Sample words for this step: what the figure shows here, and why it matters for this person.</p>
              </div>
              <ul className="he-r-pins">
                <li>
                  <b>4</b> the mask
                </li>
              </ul>
            </div>
            <nav className="he-r-pager" aria-label="Reading steps">
              <button type="button" className="he-seg-btn">
                Back
              </button>
              <span className="he-r-dots">
                {[0, 1, 2, 3].map((n) => (
                  <button key={n} type="button" className="he-r-dot" aria-current={n === 1 ? "step" : undefined} aria-label={`Step ${n + 1}`} />
                ))}
              </span>
              <button type="button" className="he-seg-btn">
                Next
              </button>
            </nav>
            <p className="he-r-hint">Arrow keys move between steps.</p>
          </div>
        </section>
      </div>
    </section>
  );
}
