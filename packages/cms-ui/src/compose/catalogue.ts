// ============================================================================
// What this org can compose.
//
// Every hub had its own hardcoded card list: arts-collective's PublishSection
// declares nine cards with four permanently marked "Soon", amrit-canada's
// hub-cards.ts declares its own with `available: false`, and each app decides
// independently what a "post" is. So two orgs on the same platform offered
// different things for no reason other than which file someone edited.
//
// The catalogue is derived from what the org actually HAS instead. An org with
// feeds gets content that can be filed into one; an org that runs workshops
// gets the workshop wizard; an org whose members can be asked something gets
// questionnaires and polls. Nothing is listed as "Soon" — if the capability is
// not there, the option is not there, and if it is there it opens.
//
// This is data, not JSX: hubs differ in how they render a card, and agreeing on
// the render was never the problem. Agreeing on the list was.
// ============================================================================

export type ComposeKindId =
  | "article"
  | "event"
  | "meeting"
  | "workshop"
  | "questionnaire"
  | "poll"
  | "art-piece"
  | "blog";

export interface ComposeOption {
  id: ComposeKindId;
  title: string;
  /**
   * A few words, addressed to the person composing — examples, not a
   * specification. The picker shows it under a one-word title, and a long
   * sentence there was the part people stopped reading (owner, 2026-09-23).
   */
  blurb: string;
  /** Single glyph — every hub in the repo already renders one. */
  icon: string;
  /**
   * "dialog" opens in place; "route" navigates, for kinds whose authoring is
   * too large for a popup (the workshop wizard is ten manifest-derived steps).
   */
  mode: "dialog" | "route";
  /**
   * Which authoring surface opens. "form" is the compose popup; "writing" is
   * the writing room with a live preview of the finished page. Same kind, a
   * different surface over it — see HEADLESS_CMS_DIRECTION.md, "Blog is a
   * surface, not a kind".
   */
  surface?: "form" | "writing";
  /** Path for `mode: "route"`, with `:orgSlug` already substituted. */
  href?: string;
  /**
   * What this writes.
   *
   * `threads` is the shared composer's territory and needs only
   * `connectors.saveThread`. Anything else is per app — a questionnaire has
   * its own table, an artwork belongs to the commerce package — so the
   * catalogue offers it only when the host has registered
   * `connectors.custom["compose:<id>"]` to answer for it.
   */
  writes: { table: "threads" | "questionnaires" | "artwork" | "writing"; kind: string };
}

export interface ComposeContext {
  orgSlug: string;

  /**
   * Whether this app can save a thread at all. Default true.
   *
   * Not every hub is a publishing hub: IFAC's product is its roster, and it
   * has no content save path, 0 feeds and 0 threads. Offering it an "Article"
   * card would be a door onto nothing — which is precisely the "Soon" card
   * pattern this catalogue exists to replace.
   */
  canPublishContent?: boolean;
  /**
   * The org's feeds (`org_feeds`). An org with none still composes — the
   * content simply has no section — but an org WITH feeds must choose one,
   * which is the field amrit-canada added and arts-collective never had.
   */
  feeds?: Array<{ slug: string; name: string }>;
  /** Owner/guide. Gates the kinds that write org-wide state. */
  canManageOrg?: boolean;
  /**
   * Whether this viewer may publish DATED things — an event, a meeting — as
   * opposed to writing a post. Default true, so no existing host changes.
   *
   * IFAC (2026-09-19) is the first org to separate the two: a member may post
   * in the hub, while putting a gathering on the collective's calendar stays
   * with owners and guides. Without this the catalogue offered a member a
   * form the server action would then refuse.
   */
  canPublishDated?: boolean;
  /**
   * Where this same compose lives as a full PAGE, e.g.
   * "/hub/compose?kind=:kind". Given one, a composing surface offers a way out
   * of the popup into it — a long form should never be trapped in a modal.
   * `:kind` is replaced, and the popup adds the title typed so far.
   */
  pageHref?: string;
  /** Who may host a gathering here — offered as "Who's hosting" on dated kinds. */
  hostCandidates?: Array<{ userId: string; displayName: string }>;
  /**
   * Whether this org publishes workshops. Off by default: most orgs are not
   * running a workshop programme and the ten-step wizard is noise for them.
   */
  hasWorkshops?: boolean;
  /**
   * Whether the org has a Talk room / meeting capability wired. Gates the
   * meeting kind, which otherwise promises a room it cannot create.
   */
  hasMeetings?: boolean;
  /**
   * How a workshop is authored: the ten-step template wizard on its own page
   * ("route", the default — arts-collective), or the compose surface's form
   * with presentation and sessions groups ("dialog" — sites without a
   * template).
   */
  workshopMode?: "route" | "dialog";

  // ── Passed through to the field builder ────────────────────────────────────
  // One context object rather than two: a hub describes its org once, and both
  // "what can I make" and "what does that thing have" read the same facts.
  /** Offer network cross-posting. Off for single-org sites. */
  canShareToNetwork?: boolean;
  /** Offer "create a collaborative document" — needs Nextcloud wired. */
  canCreateDocument?: boolean;
  /** Offer "create a Talk room" — needs Nextcloud Talk wired. */
  canCreateTalkRoom?: boolean;
  /**
   * Whether members sell work here. Adds "Art piece" — an object with
   * measurements rather than a post with a date, written to the commerce
   * package's `artwork`. Off by default: most orgs are not a marketplace,
   * and the form asks for dimensions and provenance.
   */
  hasArtworks?: boolean;
  /**
   * Whether a member can have a blog section on their profile on this site.
   * Off by default; the org needs member profiles for it to hang on.
   */
  hasMemberBlogs?: boolean;
}

const ALL: Array<ComposeOption & { available: (ctx: ComposeContext) => boolean }> = [
  {
    id: "article",
    title: "Post",
    blurb: "An announcement, an update, an article",
    icon: "◉",
    mode: "dialog",
    writes: { table: "threads", kind: "post" },
    available: (ctx) => ctx.canPublishContent !== false,
  },
  {
    id: "event",
    title: "Event",
    blurb: "An opening, a show, a talk",
    icon: "◆",
    mode: "dialog",
    writes: { table: "threads", kind: "event" },
    available: (ctx) => ctx.canPublishContent !== false && ctx.canPublishDated !== false,
  },
  {
    id: "meeting",
    title: "Meeting",
    blurb: "A gathering people can join",
    icon: "◎",
    mode: "dialog",
    writes: { table: "threads", kind: "meeting" },
    available: (ctx) =>
      ctx.canPublishContent !== false && ctx.canPublishDated !== false && Boolean(ctx.hasMeetings),
  },
  {
    id: "workshop",
    title: "Workshop",
    blurb: "Sessions, a schedule, sign-up",
    icon: "◈",
    mode: "route",
    href: "/hub/workshops/:orgSlug/new",
    writes: { table: "threads", kind: "workshop" },
    // Dated, and an org-wide commitment: same gate as an event.
    available: (ctx) => Boolean(ctx.hasWorkshops) && ctx.canPublishDated !== false,
  },
  {
    id: "questionnaire",
    title: "Questionnaire",
    blurb: "Questions for the members",
    icon: "▤",
    mode: "dialog",
    writes: { table: "questionnaires", kind: "questionnaire" },
    available: (ctx) => Boolean(ctx.canManageOrg),
  },
  {
    id: "art-piece",
    title: "Art piece",
    blurb: "A work, with its picture and details",
    icon: "▣",
    mode: "dialog",
    // Not a thread: an artwork is an OBJECT with measurements, and the
    // commerce package already owns that table. The host registers
    // `compose:art-piece` and that surface writes through `createArtwork`.
    writes: { table: "artwork", kind: "artwork" },
    available: (ctx) => Boolean(ctx.hasArtworks),
  },
  {
    id: "blog",
    title: "Blog",
    blurb: "Your own writing, on your page",
    icon: "▤",
    mode: "dialog",
    // Also not an org thread — a member's writing belongs to the member. The
    // surface behind this is a door, not a form: it asks once whether to add
    // the section and what it should show, then takes them there.
    writes: { table: "writing", kind: "writing" },
    available: (ctx) => Boolean(ctx.hasMemberBlogs),
  },
  {
    id: "poll",
    title: "Poll",
    blurb: "One question, a quick vote",
    icon: "▥",
    mode: "dialog",
    writes: { table: "questionnaires", kind: "poll" },
    available: (ctx) => Boolean(ctx.canManageOrg),
  },
];

export function buildComposeCatalogue(ctx: ComposeContext): ComposeOption[] {
  return ALL.filter((o) => o.available(ctx)).map(({ available: _skip, ...option }) => {
    if (option.id === "workshop" && ctx.workshopMode === "dialog") {
      return { ...option, mode: "dialog" as const, href: undefined };
    }
    return { ...option, href: option.href?.replace(":orgSlug", ctx.orgSlug) };
  });
}

/** Look one up by id, after filtering — returns undefined if unavailable here. */
export function findComposeOption(
  ctx: ComposeContext,
  id: ComposeKindId
): ComposeOption | undefined {
  return buildComposeCatalogue(ctx).find((o) => o.id === id);
}
