import { PersonSectionPanel } from "@elkdonis/cms-ui/profile";
import { defineBlock, type PropsOf } from "../registry";
import { PersonBlockNote, type PuckContext } from "./person-note";

// ============================================================================
// "Member of" — the orgs a person is publicly part of, each linked to its
// home, with their role there. The panel the plain ArtDirect page draws after
// its sections.
// ============================================================================

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "Member of" },
] as const;

export interface PersonMembership {
  name: string;
  href: string;
  role?: string | null;
}

export type PersonMembershipsProps = PropsOf<typeof props> & {
  orgs?: PersonMembership[];
  puck?: PuckContext;
};

export function PersonMemberships({ heading = "Member of", orgs = [], puck }: PersonMembershipsProps) {
  if (orgs.length === 0) return <PersonBlockNote puck={puck}>Not a public member of any organisation yet.</PersonBlockNote>;
  return (
    <div className="blk-person-section">
      <PersonSectionPanel title={heading || "Member of"}>
        <ul className="eac-person-list">
          {orgs.map((o) => (
            <li key={`${o.href}|${o.name}`}>
              <a href={o.href}>{o.name}</a>
              {o.role ? <p className="eac-person-meta">{o.role}</p> : null}
            </li>
          ))}
        </ul>
      </PersonSectionPanel>
    </div>
  );
}

export const personMemberships = defineBlock(
  {
    id: "person-memberships",
    category: "listings",
    label: "Member of",
    description: "The organisations they are publicly part of, with their role in each.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonMemberships,
  () => ({
    heading: "Member of",
    orgs: [
      { name: "IFAC", href: "#", role: "Artist" },
      { name: "Elkdonis Arts Collective", href: "#", role: null },
    ],
  })
);
