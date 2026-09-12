import {
  ASPECT_BY_KEY,
  BODY_BY_KEY,
  HOUSES,
  HOUSE_SYSTEMS,
  SIGN_BY_KEY,
  formatArc,
  formatPosition,
  ordinal,
  type AspectPoint,
  type ChartResult,
  type Element,
} from "@elkdonis/astro";
import { cn } from "@/lib/utils";
import { ELEMENT_TEXT, Glyph } from "./glyph";

const ANGLE_LABEL: Record<string, { name: string; short: string }> = {
  ascendant: { name: "Ascendant", short: "AC" },
  midheaven: { name: "Midheaven", short: "MC" },
};
export function pointName(k: AspectPoint): string {
  return k in BODY_BY_KEY ? BODY_BY_KEY[k as keyof typeof BODY_BY_KEY].name : ANGLE_LABEL[k].name;
}
export function PointGlyph({ k }: { k: AspectPoint }) {
  if (k in BODY_BY_KEY) return <Glyph className="w-5 text-center text-primary">{BODY_BY_KEY[k as keyof typeof BODY_BY_KEY].glyph}</Glyph>;
  return <span className="w-5 text-center text-[10px] font-semibold tracking-wider text-gold">{ANGLE_LABEL[k].short}</span>;
}

/**
 * `bare` drops the card and its heading: inside a pop-out the panel already
 * has a frame and the button that opened it already said the name, so drawing
 * both again just makes a box in a box.
 */
function Section({
  title,
  children,
  className,
  bare,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  if (bare) return <div className={cn("p-3", className)}>{children}</div>;
  return (
    <section className={cn("rounded-xl border border-border bg-card/80 p-5", className)}>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{title}</h3>
      {children}
    </section>
  );
}

export function ChartSummary({ chart }: { chart: ChartResult }) {
  const items = [
    { label: "Sun", sign: chart.summary.sun },
    { label: "Moon", sign: chart.summary.moon },
    { label: "Rising", sign: chart.summary.rising },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(({ label, sign }) => {
        const s = SIGN_BY_KEY[sign];
        return (
          <div key={label} className="min-w-0 rounded-xl border border-border bg-card px-2 py-3 text-center shadow-sm">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
            <Glyph className={cn("mt-1.5 block text-2xl", ELEMENT_TEXT[s.element])}>{s.glyph}</Glyph>
            {/* The column these sit in is narrow; "Sagittarius" must still fit. */}
            <div className="mt-1.5 truncate font-display text-[13px]" title={s.name}>
              {s.name}
            </div>
          </div>
        );
      })}
      <p className="col-span-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
        {(Object.entries(chart.summary.elements) as [Element, number][]).map(([el, n]) => (
          <span key={el}>
            <span className={cn("capitalize", ELEMENT_TEXT[el])}>{el}</span> {n}
          </span>
        ))}
        <span aria-hidden>·</span>
        {Object.entries(chart.summary.modalities).map(([m, n]) => (
          <span key={m}>
            <span className="capitalize">{m}</span> {n}
          </span>
        ))}
        <span aria-hidden>·</span>
        <span>{HOUSE_SYSTEMS.find((h) => h.code === chart.input.houseSystem)?.name} houses</span>
      </p>
    </div>
  );
}

export function PositionsTable({ chart }: { chart: ChartResult }) {
  return (
    <Section title="Planets">
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr>
            <th>Planet</th>
            <th>Position</th>
            <th>House</th>
            <th>Motion</th>
          </tr>
        </thead>
        <tbody>
          {chart.bodies.map((b) => {
            const info = BODY_BY_KEY[b.key];
            const sign = SIGN_BY_KEY[b.sign];
            return (
              <tr key={b.key} className="border-t border-border/60 first:border-t-0">
                <td className="py-2 pr-2">
                  <Glyph className="mr-2 inline-block w-5 text-center text-lg text-primary">{info.glyph}</Glyph>
                  {info.name}
                </td>
                <td className="py-2 pr-2 tabular-nums">
                  <Glyph className={cn("mr-1.5", ELEMENT_TEXT[sign.element])}>{sign.glyph}</Glyph>
                  {formatPosition(b.longitude)}
                </td>
                <td className="py-2 pr-2 text-muted-foreground tabular-nums">{ordinal(b.house)}</td>
                <td className="py-2 text-right text-xs">
                  {b.retrograde ? <span className="font-semibold text-fire">R</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

export function HousesTable({ chart, bare }: { chart: ChartResult; bare?: boolean }) {
  return (
    <Section title="Houses" bare={bare}>
      <table className="w-full text-sm">
        <tbody>
          {chart.houses.map((h) => {
            const sign = SIGN_BY_KEY[h.sign];
            const info = HOUSES[h.house - 1];
            return (
              <tr key={h.house} className="border-t border-border/60 first:border-t-0">
                <td className="w-10 py-1.5 font-medium text-primary tabular-nums">{h.house}</td>
                <td className="py-1.5 pr-2 tabular-nums">
                  <Glyph className={cn("mr-1.5", ELEMENT_TEXT[sign.element])}>{sign.glyph}</Glyph>
                  {formatPosition(h.longitude)}
                </td>
                <td className="hidden py-1.5 text-xs text-muted-foreground sm:table-cell">
                  {info.keywords.slice(0, 2).join(", ")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

export function AspectsTable({ chart, bare }: { chart: ChartResult; bare?: boolean }) {
  const groups = [
    { title: "Major", rows: chart.aspects.filter((a) => a.major) },
    { title: "Minor", rows: chart.aspects.filter((a) => !a.major) },
  ];
  return (
    <Section title="Aspects" bare={bare}>
      {chart.aspects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No aspects within orb.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(
            (g) =>
              g.rows.length > 0 && (
                <div key={g.title}>
                  <div className="mb-1 text-xs text-muted-foreground">{g.title}</div>
                  <ul className="space-y-1 text-sm">
                    {g.rows.map((a) => {
                      const def = ASPECT_BY_KEY[a.type];
                      return (
                        <li key={`${a.a}-${a.b}-${a.type}`} className="flex items-center gap-2">
                          <PointGlyph k={a.a} />
                          <Glyph className="w-5 text-center" label={def.name}>
                            {def.glyph}
                          </Glyph>
                          <PointGlyph k={a.b} />
                          <span className="flex-1 truncate">
                            {pointName(a.a)} {def.name.toLowerCase()} {pointName(a.b)}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{formatArc(a.orb)}</span>
                          <span className="w-6 text-right text-xs text-muted-foreground" title={a.applying ? "Applying" : "Separating"}>
                            {a.applying ? "A" : "S"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
          )}
        </div>
      )}
    </Section>
  );
}
