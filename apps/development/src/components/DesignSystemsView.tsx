import type { DesignSystem, ThemeApp } from "@/lib/types";

// A server component: pure presentation of what each app declares today (themes.json) beside
// the proposed vocabulary and alias map (design-system.json).

function Swatch({ value }: { value: string }) {
  return <i className="dev-swatch" style={{ background: value, display: "inline-block" }} title={value} />;
}

const isColour = (v: string) => /^(#|rgb|hsl|oklch|oklab|color\()/i.test(v.trim());

export function AppCards({ themes }: { themes: ThemeApp[] }) {
  return (
    <div className="dev-cards">
      {themes.map((t) => (
        <article key={t.id} className="dev-card">
          <h3>{t.label}</h3>
          {t.source ? <div className="dev-src">{t.source}</div> : null}
          <dl className="dev-kv">
            <dt>Variables</dt>
            <dd>{Object.keys(t.vars).length}</dd>
            {Object.entries(t.counts).map(([k, v]) => (
              <span key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </span>
            ))}
            <dt>Changed by</dt>
            <dd>{t.editedBy ?? "not editable today"}</dd>
          </dl>
          <div className="dev-swatches">
            {t.swatches.slice(0, 40).map((s, si) => (
              <Swatch key={`${s.name}-${si}`} value={s.value} />
            ))}
          </div>
          {Object.keys(t.fonts).length ? (
            <dl className="dev-kv">
              {Object.entries(t.fonts).map(([k, v]) => (
                <span key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd style={{ fontFamily: v }}>{v}</dd>
                </span>
              ))}
            </dl>
          ) : null}
          {t.families.length ? <p className="dev-src">Families: {t.families.join(", ")}</p> : null}
        </article>
      ))}
    </div>
  );
}

/** Rows = a variable name, columns = apps: where the same meaning is named differently, or missing. */
export function TokenMatrix({ themes }: { themes: ThemeApp[] }) {
  const names = new Map<string, number>();
  for (const t of themes) for (const k of Object.keys(t.vars)) names.set(k, (names.get(k) ?? 0) + 1);
  const all = [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // Names used by two or more apps first: that is where meanings overlap. Capped so the page stays light.
  const rows = all.slice(0, 300);
  if (!rows.length) return <p className="dev-note">No variables in themes.json yet.</p>;
  return (
    <div className="dev-scroll">
      <table className="dev-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Apps</th>
            {themes.map((t) => (
              <th key={t.id}>{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, n]) => (
            <tr key={name}>
              <td>
                <code>{name}</code>
              </td>
              <td>{n}</td>
              {themes.map((t) => {
                const v = t.vars[name];
                return (
                  <td key={t.id}>
                    {v ? (
                      <span className="dev-cell">
                        {isColour(v) ? <i style={{ background: v }} /> : null}
                        <code>{v}</code>
                      </span>
                    ) : (
                      <span style={{ color: "var(--dev-muted)" }}>none</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Proposal({ ds }: { ds: DesignSystem }) {
  return (
    <>
      <h2>{ds.title}</h2>
      {ds.summary ? <p className="dev-lede">{ds.summary}</p> : null}
      {ds.principle ? <p className="dev-lede">{ds.principle}</p> : null}
      {ds.layers.length ? (
        <div className="dev-cards" style={{ margin: "8px 0" }}>
          {ds.layers.map((l, li) => (
            <article key={`${l.id}-${li}`} className="dev-card" style={{ width: 220 }}>
              <h3>{l.label}</h3>
              <p className="dev-lede" style={{ margin: 0, fontSize: 12 }}>{l.summary}</p>
            </article>
          ))}
        </div>
      ) : null}
      <h3 style={{ fontSize: 13, margin: "16px 0 8px" }}>Vocabulary</h3>
      <div className="dev-scroll">
        <table className="dev-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Meaning</th>
              <th>Layer</th>
              <th>Kind</th>
              <th>Light</th>
              <th>Dark</th>
            </tr>
          </thead>
          <tbody>
            {ds.vocabulary.map((v, vi) => (
              <tr key={`${v.token}-${vi}`}>
                <td>
                  <code>{v.token}</code>
                </td>
                <td style={{ whiteSpace: "normal" }}>{v.meaning}</td>
                <td>{v.layer}</td>
                <td>{v.kind}</td>
                {[v.light, v.dark].map((c, i) => (
                  <td key={i}>
                    {c ? (
                      <span className="dev-cell">
                        {isColour(c) ? <i style={{ background: c }} /> : null}
                        <code>{c}</code>
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ fontSize: 13, margin: "16px 0 8px" }}>Alias map (today's name to the proposed one)</h3>
      <div className="dev-scroll">
        <table className="dev-table">
          <thead>
            <tr>
              <th>Today</th>
              <th>Proposed</th>
              <th>Used by</th>
            </tr>
          </thead>
          <tbody>
            {ds.aliases.map((a, i) => (
              <tr key={`${a.from}-${i}`}>
                <td>
                  <code>{a.from}</code>
                </td>
                <td>
                  <code>{a.to}</code>
                </td>
                <td style={{ whiteSpace: "normal" }}>{a.apps.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ds.notes.length ? (
        <ul className="dev-lede" style={{ marginTop: 12 }}>
          {ds.notes.map((n, ni) => (
            <li key={ni}>{n}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
