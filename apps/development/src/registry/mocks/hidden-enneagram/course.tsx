import { SectionHead } from "./parts";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const MODULES = [
  { title: "Orientation", summary: "What the enneagram maps, and where your story begins", steps: 3 },
  { title: "The Three Centers", summary: "Gut, Heart and Head, and the one working overtime", steps: 3 },
  { title: "The Core Fixation", summary: "The looped response pattern and the hidden triads", steps: 3 },
  { title: "Wings and Movement", summary: "The figure in motion: wings, stress and growth", steps: 2 },
  { title: "The Nine Points", summary: "One reading per fixation", steps: 10 },
  { title: "The Instincts", summary: "Self-preservation, sexual, social, and the blind spot", steps: 3 },
];

export default function Mock() {
  const steps = MODULES.reduce((n, m) => n + m.steps, 0);
  const badges = ["Free", "Self-paced", `${steps} steps`, "Private reflections"];
  return (
    <section className="blk he-course-block">
      <SectionHead
        eyebrow="Learn"
        title="Enneagram Foundations"
        lede="The whole system, taught in order: short steps, a practice in each module, and reflections that stay private to you. Hosted on Sophia, the network's learning space."
      />
      <div className="he-course">
        <div className="he-course-intro">
          <h3>A free walk through the map</h3>
          <p>A sample summary of the course: the three centers, the core fixation, wings, the nine types and the instincts, in short steps with private reflections.</p>
          <div className="he-course-badges">
            {badges.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
          <a className="he-btn he-primary" href="#mock">
            Open the course
          </a>
        </div>
        <nav className="he-module-list" aria-label="Course modules">
          {MODULES.map((m, i) => (
            <a key={m.title} href="#mock">
              <span className="he-m-roman">{ROMAN[i]}</span>
              <span className="he-m-title">
                {m.title}
                <span className="he-m-sub">{m.summary}</span>
              </span>
              <span className="he-m-steps">{m.steps} steps</span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
