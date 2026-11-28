import "./rails.css";
import { LEVELS, levelOf } from "./types";

/** A small coloured tag with the level's name. */
export function LevelTag({ n, where }: { n: number; where?: { mode: "dock" | "place"; why: string } }) {
  const l = levelOf(n);
  // Below "In the dock", say where it is headed: a form in the dock (to build) or "Take me there" (needs its page).
  const aim = where && n < 3 ? (where.mode === "dock" ? "→ to the dock" : "↗ take me there") : null;
  return (
    <span className="dev-r-tag" style={{ ["--lv" as string]: l.color }} title={aim ? `${l.means} ${where!.why}` : l.means}>
      <i />
      {l.name}
      {aim ? <em className="dev-r-aim">{aim}</em> : null}
    </span>
  );
}

/** The ladder: five levels, what each means, and (when given) how many are at each. */
export function Legend({ counts, total, note }: { counts?: Record<string, number>; total?: number; note?: string }) {
  return (
    <div className="dev-r-legend" aria-label="The five levels">
      {LEVELS.map((l) => (
        <div key={l.n} className="dev-r-legend-item" style={{ ["--lv" as string]: l.color }}>
          <span className="dev-r-legend-top">
            <i />
            <b>{l.name}</b>
            {counts ? <em>{counts[String(l.n)] ?? 0}</em> : null}
          </span>
          <span className="dev-r-legend-means">{l.means}</span>
        </div>
      ))}
      {total != null ? <div className="dev-r-legend-total">{total} in all</div> : null}
      {note ? <p className="dev-r-legend-note">{note}</p> : null}
    </div>
  );
}

/** A stacked bar of steps by level, with the numbers spelled out beside it. */
export function CountsBar({ counts }: { counts: Record<number, number> }) {
  const total = LEVELS.reduce((a, l) => a + (counts[l.n] ?? 0), 0);
  return (
    <span className="dev-r-counts">
      <span className="dev-r-bar" aria-hidden>
        {LEVELS.map((l) => ((counts[l.n] ?? 0) > 0 ? <i key={l.n} style={{ flex: counts[l.n], background: l.color }} /> : null))}
      </span>
      <span className="dev-r-counts-text">
        {total} step{total === 1 ? "" : "s"}:{" "}
        {LEVELS.filter((l) => (counts[l.n] ?? 0) > 0)
          .map((l) => `${counts[l.n]} ${l.name}`)
          .join(", ") || "none"}
      </span>
    </span>
  );
}

export function SampleBanner({ sample }: { sample?: boolean }) {
  if (!sample) return null;
  return (
    <p className="dev-r-sample">
      These numbers are a hand-made sample: the real list has not been copied in yet. Run <code>node scripts/refresh-rails.mjs</code> and rebuild.
    </p>
  );
}
