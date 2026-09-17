import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A dated list — the shape most of an artist's site is actually made of.
//
// A CV, a run of exhibitions, a publication history, a list of collections:
// all the same thing, a year and an entry, repeated. Dana's site has that
// shape on four pages, hand-written every time, and until `rows` existed the
// block library could not hold it at all — `list` holds strings, and a year
// beside an entry is two things.
//
// The year is a STRING, not a number. "1998", "2019–22" and "Ongoing" are all
// real answers, and a numeric field would accept only the first.
// ============================================================================

const props = [
  {
    name: "entries",
    kind: "rows",
    label: "Entry",
    addLabel: "Add an entry",
    summary: ["year", "text"],
    description: "Newest first is the convention, but the order is yours.",
    fields: [
      {
        name: "year",
        kind: "string",
        label: "Year",
        description: "Or a span, or a word — 2019–22, Ongoing.",
        default: "",
      },
      { name: "text", kind: "string", label: "Entry", default: "" },
      {
        name: "detail",
        kind: "string",
        label: "Detail",
        description: "Venue, city, publisher — shown quieter, underneath.",
        default: "",
      },
      { name: "href", kind: "url", label: "Link", default: "" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Years",
    description: "Whether the years sit in their own column or run inline.",
    default: "column",
    options: [
      { value: "column", label: "In a column of their own" },
      { value: "inline", label: "Inline, before the entry" },
    ],
  },
  {
    name: "rules",
    kind: "boolean",
    label: "Line between entries",
    default: false,
  },
] as const;

export type EntryListProps = PropsOf<typeof props>;

export function EntryList({ entries, align = "column", rules = false }: EntryListProps) {
  // An entry with nothing in it is a row someone added and did not fill; it
  // should take up no space rather than drawing an empty line with a rule.
  const rowsToDraw = (entries ?? []).filter(
    (row) => String(row.year ?? "").trim() || String(row.text ?? "").trim()
  );
  if (rowsToDraw.length === 0) return null;

  return (
    <dl className="blk blk-entries" data-align={align} data-rules={rules ? "on" : "off"}>
      {rowsToDraw.map((row, i) => {
        const text = String(row.text ?? "");
        const href = String(row.href ?? "").trim();
        const detail = String(row.detail ?? "").trim();
        return (
          // <dl> because that is what this is: a term and its description.
          // A screen reader announces the pairing, which a <ul> of "1998 Solo
          // show" cannot convey.
          <div className="blk-entries-row" key={i}>
            <dt className="blk-entries-year">{String(row.year ?? "")}</dt>
            <dd className="blk-entries-text">
              {href ? (
                <a className="blk-entries-link" href={href}>
                  {text}
                </a>
              ) : (
                text
              )}
              {detail ? <span className="blk-entries-detail">{detail}</span> : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export const entryList = defineBlock(
  {
    id: "entry-list",
    label: "Dated list",
    category: "listings",
    description:
      "Years and entries — a CV, exhibitions, publications, anything with a date beside it.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  EntryList,
  () => ({
    entries: [
      { year: "2024", text: "Radical Renaissance", detail: "Solo exhibition, Toronto", href: "" },
      { year: "2022", text: "The Universal Pharmacy", detail: "Two-person show", href: "" },
      { year: "2019–21", text: "Botanical resin sculptures", detail: "Ongoing series", href: "" },
    ],
    align: "column" as const,
    rules: false,
  })
);
