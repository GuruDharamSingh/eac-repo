import { defineBlock, type PropsOf } from "../registry";
import type { PersonBlockLink, PersonBlockPerson } from "../person-context";
import { SAMPLE_PERSON } from "./person-header";

// ============================================================================
// The person card: portrait, bio and links — PersonPage's sidebar as a block.
//
// Same markup and classes as the sidebar in @elkdonis/cms-ui PersonPage, so
// it takes the page's look from person-page.css (see person-header.tsx for
// why the person blocks carry no `.blk` class). The name and role are off by
// default because a person page already opens with the Name and role block;
// a card used on its own (a featured page) turns them on.
// ============================================================================

const props = [
  { name: "showName", kind: "boolean", label: "Show name and role", default: false },
  { name: "showPortrait", kind: "boolean", label: "Show portrait", default: true },
  { name: "showBio", kind: "boolean", label: "Show bio", default: true },
  { name: "showLinks", kind: "boolean", label: "Show links", default: true },
] as const;

export type PersonCardProps = PropsOf<typeof props> & {
  /** From the resolver. */
  person?: PersonBlockPerson | null;
  puck?: { isEditing?: boolean };
};

function paragraphs(bio: string | null | undefined): string[] {
  if (!bio) return [];
  return bio
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function linkLabel(link: PersonBlockLink): string {
  if (link.label) return link.label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}

/** http(s) and mailto only: a link here is the person's own text. */
function safeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}

export function PersonCard({
  showName = false,
  showPortrait = true,
  showBio = true,
  showLinks = true,
  person,
}: PersonCardProps) {
  if (!person) return null;
  const bio = showBio ? paragraphs(person.bio) : [];
  const links = showLinks ? (person.socialLinks ?? []).filter((l) => l.url && safeUrl(l.url)) : [];
  const line = [person.role, person.city].filter(Boolean).join(" · ");

  return (
    <aside className="eac-person-sidebar eac-person-panel blk-person-card">
      {showName ? (
        <div className="blk-person-card-name">
          <h2 className="eac-person-section-title">{person.displayName}</h2>
          {line ? <p className="eac-person-meta">{line}</p> : null}
        </div>
      ) : null}
      {showPortrait && person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="eac-person-portrait" src={person.avatarUrl} alt={person.displayName} />
      ) : null}
      {bio.length > 0 ? (
        <div className="eac-person-bio">
          {bio.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}
      {links.length > 0 ? (
        <ul className="eac-person-links">
          {links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {linkLabel(l)}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

export const personCard = defineBlock(
  {
    id: "person-card",
    category: "content",
    label: "Person card",
    description: "Their portrait, bio and links, as on the side of their page.",
    props,
    memberSafe: true,
    styling: "tokens",
    dataDriven: true,
  },
  PersonCard,
  () => ({ showName: false, showPortrait: true, showBio: true, showLinks: true, person: SAMPLE_PERSON })
);
