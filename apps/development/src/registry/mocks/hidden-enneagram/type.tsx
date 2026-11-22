import "./he-mock.css";

const HUE = { gut: "var(--he-gut)", heart: "var(--he-heart)", head: "var(--he-head)" } as const;
const ROWS = [
  { n: 4, c: "heart" as const, name: "Four: Heart-Longing", epithets: "The Romantic · Absence Made Beautiful · The Deep Well" },
  { n: 5, c: "head" as const, name: "Five: Head-Withholding", epithets: "The Observer · Mind Behind Glass" },
];

export default function Mock() {
  return (
    <div className="he-mock-narrow">
      {ROWS.map((r, i) => (
        <details key={r.n} className="blk he-type" id={`type-${r.n}`} open={i === 0} style={{ ["--type-hue" as string]: HUE[r.c] }}>
          <summary className="he-type-row">
            <span className="he-type-num" aria-hidden="true">
              {r.n}
            </span>
            <span className="he-type-id">
              <span className="he-type-name">{r.name}</span>
              <span className="he-type-epithets">{r.epithets}</span>
            </span>
            <span className="he-type-open" aria-hidden="true">
              Read
            </span>
          </summary>
          <div className="he-type-text">
            <div className="he-type-lead">
              <p>A sample opening paragraph for this chapter: the fixation described in a few plain sentences, as the author wrote them for the page.</p>
              <p>A second paragraph carries the thread further, naming what the pattern protects and what it costs.</p>
            </div>
            <div className="he-type-body">
              <h3>Key Qualities</h3>
              <ul>
                <li>A first quality, written as a short phrase</li>
                <li>A second quality, as the chapter lists them</li>
                <li>A third quality</li>
              </ul>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
