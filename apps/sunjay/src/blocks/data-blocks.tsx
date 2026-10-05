import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { WritingShelf, type ShelfItem } from "@elkdonis/cms-ui/writing";
import { ProfileCard, type ProfileCardLink } from "@/components/profile-card";
import type { Guide } from "@/lib/types";
import {
  CalendarView,
  ForumView,
  GalleryView,
  MemberView,
  StandingView,
  ThreadsView,
} from "./views.client";

// ============================================================================
// Para Theater's data blocks: what the landing page draws from the database.
//
// Each block here is a declaration plus a view. The rows come from a resolver
// (config.server.ts reads the database; config.client.ts asks
// /api/blocks/<id>), never from the page document: the keys a resolver fills
// are listed in resolved-keys.ts and removed before a page is saved.
//
// Declarations stay in this server-safe file; the six that use hooks or the
// surface popup render a view from views.client.tsx and say `interactive`, so
// the editor does not hand them its function-bearing `puck` context.
// ============================================================================

// ── next gathering ──────────────────────────────────────────────────────────

const standingProps = [
  {
    name: "tall",
    kind: "boolean",
    label: "Tall card",
    description: "The landing page's taller treatment of this card. Off draws it at its ordinary size.",
    default: true,
  },
] as const;

export const standing = defineBlock(
  {
    id: "pt-standing",
    category: "listings",
    label: "Next gathering",
    description: "The standing meeting: when it is next, where, and how to join. Fills itself from the calendar.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: standingProps,
  },
  StandingView as unknown as React.ComponentType<PropsOf<typeof standingProps>>,
  () => ({ tall: true })
);

// ── calendar ────────────────────────────────────────────────────────────────

export const calendar = defineBlock(
  {
    id: "pt-calendar",
    category: "listings",
    label: "Calendar (month)",
    description: "The month's gatherings on a grid. A day opens in place. Fills itself from the calendar.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: [],
  },
  CalendarView as unknown as React.ComponentType<Record<string, never>>,
  () => ({})
);

// ── profile card ────────────────────────────────────────────────────────────

const profileProps = [
  {
    name: "showLinks",
    kind: "boolean",
    label: "Show his links",
    description: "From his network profile, with the collective's link last.",
    default: true,
  },
  { name: "linkLabel", kind: "string", label: "Link to his page says", default: "Read more" },
  {
    name: "emptyNote",
    kind: "string",
    label: "When there is no profile",
    default: "The profile card appears here once a public profile exists for this site.",
  },
] as const;

type ProfileExtra = { guide?: Guide | null; links?: ProfileCardLink[] };

export function ProfileBlock({
  guide,
  links = [],
  showLinks = true,
  linkLabel = "Read more",
  // `<Render>` applies no defaults, so a stored page that never set this
  // arrives undefined; the default has to live here as well as in the prop.
  emptyNote = "The profile card appears here once a public profile exists for this site.",
}: PropsOf<typeof profileProps> & ProfileExtra) {
  if (!guide) {
    return (
      <div className="card-natural p-6">
        <h2 className="font-serif text-xl font-semibold">Profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">{emptyNote}</p>
      </div>
    );
  }
  return (
    <ProfileCard
      name={guide.displayName}
      title={guide.roleTitle}
      imageUrl={guide.photoUrl}
      bio={guide.bio}
      href={`/about/${guide.slug}`}
      linkLabel={linkLabel}
      links={showLinks ? links : []}
    />
  );
}

export const profile = defineBlock(
  {
    id: "pt-profile",
    category: "content",
    label: "Profile card",
    description: "The site's guide: photograph across the top, name, role, a short bio and links. Read from his profile.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: profileProps,
  },
  ProfileBlock,
  () => ({
    showLinks: true,
    linkLabel: "Read more",
    guide: {
      userId: "sample",
      slug: "sample",
      displayName: "A Teacher's Name",
      roleTitle: "Guide",
      bio: "A short biography appears here, drawn from the profile.",
      photoUrl: null,
      city: null,
      socialLinks: [],
      sortOrder: 0,
    } satisfies Guide,
    links: [{ label: "Elkdonis Arts", url: "https://elkdonis-arts.org", emphasis: true }],
  })
);

// ── threads ─────────────────────────────────────────────────────────────────

const threadsProps = [
  { name: "heading", kind: "string", label: "Heading", default: "" },
  { name: "intro", kind: "text", label: "Line under the heading", default: "" },
  { name: "rule", kind: "boolean", label: "Bronze line under the heading", default: true },
  {
    name: "source",
    kind: "select",
    label: "What to list",
    default: "feed",
    options: [
      { value: "feed", label: "A section of the site (a feed)" },
      { value: "author", label: "Everything the guide has posted, in any section" },
    ],
  },
  {
    name: "feed",
    kind: "string",
    label: "Section",
    description: "The section's address, as in /materials → materials. Used when listing a section.",
    default: "materials",
  },
  { name: "limit", kind: "number", label: "How many", default: 4, min: 1, max: 24, step: 1 },
  {
    name: "layout",
    kind: "select",
    label: "Look",
    default: "cards",
    options: [
      { value: "cards", label: "Cards" },
      { value: "list", label: "Plain list (title, line, date)" },
    ],
  },
  { name: "cardLabel", kind: "string", label: "Small label on each card", default: "" },
  { name: "emptyMessage", kind: "string", label: "When there is nothing", default: "Nothing here yet." },
] as const;

export const threads = defineBlock(
  {
    id: "pt-threads",
    category: "listings",
    label: "Posts (cards or list)",
    description:
      "Posts, gatherings or materials from one section, or everything the guide has posted. Fills itself from what is published.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: threadsProps,
  },
  ThreadsView as unknown as React.ComponentType<PropsOf<typeof threadsProps>>,
  () => ({
    heading: "Suggested materials",
    rule: true,
    source: "feed" as const,
    feed: "materials",
    limit: 4,
    layout: "cards" as const,
  })
);

// ── sign up / your membership ───────────────────────────────────────────────

const memberProps = [
  {
    name: "showMembership",
    kind: "boolean",
    label: "Show “Your membership” when signed in",
    description:
      "A signed-out visitor sees the sign-up form. A signed-in one sees who they are, and with this on, where they stand and what they have said yes to.",
    default: true,
  },
] as const;

export const member = defineBlock(
  {
    id: "pt-member",
    category: "actions",
    label: "Sign up / your membership",
    description:
      "The sign-up form for a visitor; for someone signed in, their name, a way into the hub and what they are coming to.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: memberProps,
  },
  MemberView as unknown as React.ComponentType<PropsOf<typeof memberProps>>,
  () => ({ showMembership: true })
);

// ── forum ───────────────────────────────────────────────────────────────────

const forumProps = [{ name: "heading", kind: "string", label: "Heading", default: "Forum" }] as const;

export const forum = defineBlock(
  {
    id: "pt-forum",
    category: "listings",
    label: "Forum",
    description: "The site's forum at card size: its sections and latest topics. Fills itself.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: forumProps,
  },
  ForumView as unknown as React.ComponentType<PropsOf<typeof forumProps>>,
  () => ({ heading: "Forum" })
);

// ── writing shelf ───────────────────────────────────────────────────────────

const writingProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Writing" },
  { name: "limit", kind: "number", label: "How many pieces", default: 6, min: 1, max: 24, step: 1 },
  { name: "allLabel", kind: "string", label: "Link to all of it says", default: "All writing →" },
  { name: "allHref", kind: "url", label: "Link goes to", default: "/writing" },
] as const;

export function WritingBlock({
  items = [],
  heading = "Writing",
  allLabel = "All writing →",
  allHref = "/writing",
}: PropsOf<typeof writingProps> & { items?: ShelfItem[] }) {
  // Hides while empty, as the landing page's shelf did.
  if (items.length === 0) return null;
  return (
    <div>
      <WritingShelf items={items} basePath="/writing" heading={heading} kicker={null} intro={null} />
      {allLabel && allHref ? (
        <div className="mt-6">
          <a href={allHref as string} className="text-sm font-medium text-[hsl(var(--rust))] underline underline-offset-4">
            {allLabel}
          </a>
        </div>
      ) : null}
    </div>
  );
}

export const writing = defineBlock(
  {
    id: "pt-writing",
    category: "listings",
    label: "Writing shelf",
    description: "The site's most recent written pieces. Hidden while there are none.",
    memberSafe: true,
    dataDriven: true,
    styling: "tailwind",
    props: writingProps,
  },
  WritingBlock,
  () => ({
    heading: "Writing",
    limit: 6,
    items: [
      { id: "s1", slug: "a-piece", title: "A written piece", lede: "Its opening line appears here.", publishedAt: null },
    ] as ShelfItem[],
  })
);

// ── gallery ─────────────────────────────────────────────────────────────────

const galleryProps = [
  { name: "heading", kind: "string", label: "Heading", default: "Gallery" },
  { name: "limit", kind: "number", label: "How many pictures", default: 12, min: 1, max: 48, step: 1 },
  {
    name: "autoAdvanceSeconds",
    kind: "number",
    label: "Move on by itself every",
    description: "0 leaves it still. Any click or key press stops it for good.",
    default: 0,
    min: 0,
    max: 30,
    step: 1,
    unit: "s",
  },
] as const;

export const gallery = defineBlock(
  {
    id: "pt-gallery",
    category: "listings",
    label: "Gallery",
    description: "The site's pictures, as the gallery card. Hidden while there are none.",
    memberSafe: true,
    interactive: true,
    dataDriven: true,
    styling: "tailwind",
    props: galleryProps,
  },
  GalleryView as unknown as React.ComponentType<PropsOf<typeof galleryProps>>,
  () => ({ heading: "Gallery", limit: 12, autoAdvanceSeconds: 0 })
);
