import { defineBlock, type PropsOf } from "@elkdonis/blocks";

// ============================================================================
// Who is in the organisation: its owners, guides and members, as chips.
//
// The same list `/profile` draws (everyone bar `viewer`, who are followers),
// filled by the resolver from the org in the page's metadata. Names and
// photos only — the public profile page already shows exactly these.
// ============================================================================

export interface PersonChip {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  href: string | null;
}

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "People", inlineEditable: true },
  { name: "showPhotos", kind: "boolean", label: "Show photos", default: true },
  { name: "showRoles", kind: "boolean", label: "Show roles", default: false },
  { name: "emptyMessage", kind: "string", label: "Message when nobody is listed", default: "No members listed." },
] as const;

export type AcPeopleProps = PropsOf<typeof props> & { people?: PersonChip[] };

export function AcPeople({
  heading = "People",
  showPhotos = true,
  showRoles = false,
  emptyMessage = "No members listed.",
  people = [],
}: AcPeopleProps) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-10" data-block="ac-people">
      {heading ? (
        <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">{heading}</h2>
      ) : null}
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {people.map((p) => {
            const body = (
              <>
                {showPhotos && p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : null}
                <span>{p.name}</span>
                {showRoles ? <span className="text-xs text-muted-foreground">{p.role}</span> : null}
              </>
            );
            const cls = "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm";
            return (
              <li key={p.id}>
                {p.href ? (
                  <a href={p.href} className={`${cls} hover:bg-accent`}>
                    {body}
                  </a>
                ) : (
                  <span className={cls}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export const acPeople = defineBlock(
  {
    id: "ac-people",
    label: "People",
    category: "listings",
    description: "The organisation's owners, guides and members.",
    memberSafe: true,
    styling: "tailwind",
    dataDriven: true,
    props,
  },
  AcPeople,
  () => ({
    heading: "People",
    showPhotos: true,
    showRoles: false,
    emptyMessage: "No members listed.",
    people: [
      { id: "a", name: "A. Member", avatarUrl: null, role: "owner", href: null },
      { id: "b", name: "B. Member", avatarUrl: null, role: "member", href: null },
    ],
  })
);
