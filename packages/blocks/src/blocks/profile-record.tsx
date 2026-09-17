import { defineBlock, type PropsOf } from "../registry";

// ============================================================================
// A working life, as a ledger.
//
// Where someone has shown, taught, been collected, or held a post. It is the
// oldest thing on an artist's own website and the one thing this network had
// no shape for at all — not a table, not a column, not a component.
//
// Deliberately NOT a schema. The entries are free text in the order the person
// wrote them, because a CV is prose that happens to have dates in the margin,
// and every attempt to normalise one ends up unable to express "Selected,
// Biennial of Works on Paper" or "Summer 2019, two weeks". The caller supplies
// the lines; where they are stored is the caller's business (the dossier keeps
// them in `users.oad_dossier.work_history`).
// ============================================================================

export interface ProfileRecordEntry {
  /** What they did. The only required part. */
  role: string;
  /** Who with, or where. */
  organisation?: string | null;
  /** Free text, not a date: "2019", "Spring 2021", "2019 — present". */
  from?: string | null;
  to?: string | null;
  detail?: string | null;
}

const props = [
  {
    name: "limit",
    kind: "number",
    label: "How many lines to show",
    default: 20,
  },
  {
    name: "emptyMessage",
    kind: "string",
    label: "Message when there is nothing",
    default: "Nothing on record yet.",
  },
] as const;

export type ProfileRecordProps = PropsOf<typeof props> & {
  entries: ProfileRecordEntry[];
};

function span(entry: ProfileRecordEntry): string {
  const from = entry.from?.trim();
  const to = entry.to?.trim();
  if (from && to) return `${from} — ${to}`;
  return from || to || "";
}

export function ProfileRecord({
  entries = [],
  limit = 20,
  emptyMessage = "Nothing on record yet.",
}: ProfileRecordProps) {
  const shown = entries.slice(0, Math.max(0, limit)).filter((e) => e.role?.trim());
  if (shown.length === 0) {
    return <div className="blk blk-feed-empty">{emptyMessage}</div>;
  }

  return (
    // A description list, because that is what this is: a term in the margin
    // and what it refers to beside it. A table would claim a grid of facts
    // that the free-text spans cannot honour.
    <dl className="blk blk-ledger">
      {shown.map((entry, i) => (
        <div className="blk-ledger-line" key={`${entry.role}-${i}`}>
          <dt className="blk-ledger-when">{span(entry) || "—"}</dt>
          <dd className="blk-ledger-what">
            <b className="blk-ledger-role">{entry.role}</b>
            {entry.organisation && (
              <span className="blk-ledger-where">{entry.organisation}</span>
            )}
            {entry.detail && <span className="blk-ledger-detail">{entry.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const profileRecord = defineBlock(
  {
    id: "profile-record",
    category: "content",
    label: "Work history",
    description:
      "Where someone has shown, taught, been collected or held a post — dates in the margin, entry beside them.",
    props,
    memberSafe: true,
    styling: "tokens",
    silexRoot: "eac-dossier-record",
  },
  ProfileRecord,
  () => ({
    entries: [
      {
        role: "Artist in residence",
        organisation: "Lakeside Print Co-operative, Toronto",
        from: "2023",
        to: "Present",
        detail: "Two winters in the cold room. Nine editions pulled.",
      },
      { role: "Selected, Biennial of Works on Paper", organisation: "Art Gallery of Hamilton", from: "2021" },
      { role: "Instructor, intaglio", organisation: "Open Studio", from: "2018", to: "2021" },
    ],
  })
);
