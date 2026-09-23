"use client";

/**
 * Group research, on the page layout: put something to the membership.
 *
 * The card hub's KindTilesFace in panel form, sitting beside the chat. Two of
 * the three are real and open their own page (a question set is too long a
 * form for a popup); "arrange a time" is declared so the set reads whole.
 */
const DOORS: Array<{ glyph: string; label: string; note: string; href?: string }> = [
  { glyph: "▤", label: "Questionnaire", note: "A set of questions", href: "/hub/compose?kind=questionnaire" },
  { glyph: "▥", label: "Poll", note: "One question, a result bar", href: "/hub/compose?kind=poll" },
  { glyph: "◷", label: "Arrange a time", note: "Find when everyone is free" },
];

export function ResearchPanel() {
  return (
    <section className="ifac-research" aria-labelledby="ifac-research-h">
      <header>
        <p className="eac-hs-kicker">Group research</p>
        <h2 id="ifac-research-h" className="eac-hs-h">Ask the membership</h2>
      </header>
      <ul className="ifac-research__list">
        {DOORS.map((d) =>
          d.href ? (
            <li key={d.label}>
              <a className="ifac-research__door" href={d.href}>
                <span className="ifac-research__glyph" aria-hidden>{d.glyph}</span>
                <span>
                  <strong>{d.label}</strong>
                  <em>{d.note}</em>
                </span>
              </a>
            </li>
          ) : (
            <li key={d.label}>
              <span className="ifac-research__door is-soon">
                <span className="ifac-research__glyph" aria-hidden>{d.glyph}</span>
                <span>
                  <strong>{d.label}</strong>
                  <em>{d.note} — coming</em>
                </span>
              </span>
            </li>
          )
        )}
      </ul>
    </section>
  );
}
