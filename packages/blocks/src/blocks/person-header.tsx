import { defineBlock, type PropsOf } from "../registry";
import type { PersonBlockPerson } from "../person-context";

// ============================================================================
// The top of a person page: their name, then role and city.
//
// The person blocks (person-*) are PersonPage's parts as blocks, for a person
// page arranged in the editor (ArtDirect, 2026-09-26). They draw the same
// markup and classes as @elkdonis/cms-ui PersonPage, so the look comes from
// person-page.css (`--eac-person-*`, and the frame look under
// `.eac-person-page--frame`) and a designed page matches the plain one. They
// therefore need a `.eac-person-page` ancestor, which the host provides; they
// carry no `.blk` class, so the frame's link and panel rules reach them.
//
// Data comes from the host's resolver (`personPageResolvers`,
// ../person-context.ts), never from typed props: the name is the person's
// own, wherever it is shown.
// ============================================================================

const props = [
  {
    name: "showRole",
    kind: "boolean",
    label: "Show role and city",
    default: true,
  },
] as const;

export type PersonHeaderProps = PropsOf<typeof props> & {
  /** From the resolver. */
  person?: PersonBlockPerson | null;
};

export function PersonHeader({ showRole = true, person }: PersonHeaderProps) {
  if (!person) return null;
  const line = [person.role, person.city].filter(Boolean).join(" · ");
  return (
    <header className="blk-person-intro">
      <h1 className="eac-person-name">{person.displayName}</h1>
      {showRole && (line || person.verified) ? (
        <p className="eac-person-role">
          {line}
          {person.verified && <span className="eac-person-verified">{line ? " · " : ""}Verified</span>}
        </p>
      ) : null}
    </header>
  );
}

const samplePerson: PersonBlockPerson = {
  displayName: "Mara Okafor",
  role: "Printmaker",
  bio: "Intaglio and relief prints from a shared studio by the lake.\n\nEditions of twelve, pulled by hand.",
  avatarUrl: null,
  city: "Toronto",
  verified: true,
  socialLinks: [{ label: "Studio site", url: "https://example.org" }],
};

export const personHeader = defineBlock(
  {
    id: "person-header",
    category: "headers",
    label: "Name and role",
    description: "The person's name, with their role and city beneath it.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonHeader,
  () => ({ showRole: true, person: samplePerson })
);

export { samplePerson as SAMPLE_PERSON };
