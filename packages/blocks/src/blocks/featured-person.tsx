import { defineBlock, type PropsOf } from "../registry";
import { OPENS_PROP, openedAttrs, type Opened } from "../opens";

// ============================================================================
// Featured person (2026-11-06): one person, chosen from a record, drawn with
// their portrait, name, role and bio as their profile on this site has them.
//
// The page stores only `person`, a reference the host reads per request (in
// @elkdonis/services/featured-people: `user:<id>`, or a choice that follows a
// thread such as `thread:<id>:next-host`). The host's resolver returns `who`,
// or nothing: then visitors see nothing and an editor sees a note. No person
// is chosen by default, and nothing about the person is copied into the page.
//
// This package knows no database: `person` is declared `binds: "person"` and
// the host supplies the chooser and the resolver.
// ============================================================================

/** What a host's resolver fills in. Structural; draw-only. */
export interface FeaturedWho {
  displayName: string;
  roleTitle?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  /** The person's page on this site, if it has one. */
  href?: string | null;
  /** When the reference follows a record: the stored role and the date, e.g. "host" and "7 Nov". */
  via?: { label: string; at?: string | null; thread?: string | null } | null;
}

const props = [
  {
    name: "person",
    kind: "string",
    binds: "person",
    label: "Who",
    description: "A person of this site, or someone on one of its tours or series. Only people with a public profile here are shown.",
    default: "",
  },
  { ...OPENS_PROP, description: "Where the name goes: a page, or a popup. Empty: the person's page on this site." },
  {
    name: "layout",
    kind: "select",
    label: "Layout",
    default: "side",
    options: [
      { value: "side", label: "Portrait beside the words" },
      { value: "stack", label: "Portrait above the words" },
    ],
  },
  { name: "showPortrait", kind: "boolean", label: "Show portrait", default: true },
  { name: "showRole", kind: "boolean", label: "Show role", default: true },
  { name: "showVia", kind: "boolean", label: "Show what they do there", description: "For a choice that follows a tour or series: e.g. host, 7 Nov.", default: true },
  { name: "showBio", kind: "boolean", label: "Show bio", default: true },
] as const;

export type FeaturedPersonProps = PropsOf<typeof props> & {
  /** From the host's resolver. Never stored. */
  who?: FeaturedWho | null;
  /** From the host's resolver for `opens`: where the name goes instead of the person's page. */
  opened?: Opened | null;
  puck?: { isEditing?: boolean; boxEditing?: boolean };
};

const firstParagraph = (bio: string | null | undefined) => (bio ?? "").split(/\n{2,}/)[0]?.trim() ?? "";
/** The person's own picture address: https or a path on this site. */
const safePicture = (u: string | null | undefined) => (u && (/^https:\/\//i.test(u) || /^\/(?!\/)/.test(u)) ? u : null);
const safeHref = (u: string | null | undefined) => (u && /^\/(?!\/)[^\s"]*$/.test(u) ? u : null);

export function FeaturedPerson({ person, layout = "side", showPortrait = true, showRole = true, showVia = true, showBio = true, who, opened, puck }: FeaturedPersonProps) {
  const editing = !!(puck?.isEditing || puck?.boxEditing);
  if (!who) {
    if (!editing) return null;
    return (
      <div className="blk blk-fperson blk-fperson--empty" data-layout={layout}>
        <p className="blk-fperson-note">
          {person ? "Not shown: this person has no public profile here, or the tour or series has no one for this yet." : "Featured person: choose who it shows."}
        </p>
      </div>
    );
  }
  const photo = showPortrait ? safePicture(who.photoUrl) : null;
  const open = openedAttrs(opened);
  const href = open?.href ?? safeHref(who.href);
  const via = showVia && who.via ? [who.via.label, who.via.at].filter(Boolean).join(", ") : "";
  const bio = showBio ? firstParagraph(who.bio) : "";
  const name = <span className="blk-fperson-name">{who.displayName}</span>;
  return (
    <div className="blk blk-fperson" data-layout={layout}>
      {showPortrait &&
        (photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="blk-fperson-portrait" src={photo} alt="" loading="lazy" />
        ) : (
          <span className="blk-fperson-portrait blk-fperson-portrait--none" aria-hidden />
        ))}
      <div className="blk-fperson-body">
        <p className="blk-fperson-title">{href ? <a href={href} {...(open?.["data-opens"] ? { "data-opens": open["data-opens"] } : {})}>{name}</a> : name}</p>
        {showRole && who.roleTitle && <p className="blk-fperson-role">{who.roleTitle}</p>}
        {via && <p className="blk-fperson-via">{via}</p>}
        {bio && <p className="blk-fperson-bio">{bio}</p>}
      </div>
    </div>
  );
}

export const featuredPerson = defineBlock(
  {
    id: "featured-person",
    label: "Featured person",
    category: "content",
    description: "One person from this site or from one of its tours or series, drawn from their profile.",
    memberSafe: true,
    dataDriven: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Featured person", sel: "> .blk-fperson" },
      portrait: { label: "Portrait", sel: ".blk-fperson-portrait" },
      body: { label: "Words", sel: ".blk-fperson-body" },
      name: { label: "Name", sel: ".blk-fperson-title" },
      role: { label: "Role", sel: ".blk-fperson-role" },
      via: { label: "What they do there", sel: ".blk-fperson-via" },
      bio: { label: "Bio", sel: ".blk-fperson-bio" },
    },
  },
  FeaturedPerson
);
