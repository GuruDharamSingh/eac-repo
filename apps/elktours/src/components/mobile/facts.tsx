export interface FactItem {
  label: string;
  value: string;
}

/** Four facts in one ruled row (duration, price, group size, language). */
export function FactsStrip({ items }: { items: FactItem[] }) {
  return (
    <dl className="m-facts m-facts-strip" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
      {items.map((f, i) => (
        <div key={i} className="m-fact">
          <dt className="m-kicker m-fact-k">{f.label}</dt>
          <dd className="m-fact-v">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Facts as a 2 x 2 grid. */
export function FactsGrid({ items }: { items: FactItem[] }) {
  return (
    <dl className="m-facts m-facts-grid">
      {items.map((f, i) => (
        <div key={i} className="m-fact">
          <dt className="m-kicker m-fact-k">{f.label}</dt>
          <dd className="m-fact-v">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
