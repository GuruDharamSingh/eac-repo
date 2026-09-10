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
  | "poll";

export interface ComposeOption {
  id: ComposeKindId;
  title: string;
  /** One line, addressed to the person composing. */
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
  /** The `threads.kind` or `questionnaires.kind` this writes. */
  writes: { table: "threads" | "questionnaires"; kind: string };
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
}

const ALL: Array<ComposeOption & { available: (ctx: ComposeContext) => boolean }> = [
  {
    id: "article",
    title: "Post",
    blurb: "Writing, an announcement, an update — anything without a date. The writing room is one step in.",
    icon: "◉",
    mode: "dialog",
    writes: { table: "threads", kind: "post" },
    available: (ctx) => ctx.canPublishContent !== false,
  },
  {
    id: "event",
    title: "Event",
    blurb: "A one-off gathering, performance, opening or pop-up.",
    icon: "◆",
    mode: "dialog",
    writes: { table: "threads", kind: "event" },
    available: (ctx) => ctx.canPublishContent !== false,
  },
  {
    id: "meeting",
    title: "Meeting",
    blurb: "A gathering with RSVPs, and a room to hold it in.",
    icon: "◎",
    mode: "dialog",
    writes: { table: "threads", kind: "meeting" },
    available: (ctx) => ctx.canPublishContent !== false && Boolean(ctx.hasMeetings),
  },
  {
    id: "workshop",
    title: "Workshop",
    blurb: "A full page: schedule, sessions, gallery, registration, facilitator.",
    icon: "◈",
    mode: "route",
    href: "/hub/workshops/:orgSlug/new",
    writes: { table: "threads", kind: "workshop" },
    available: (ctx) => Boolean(ctx.hasWorkshops),
  },
  {
    id: "questionnaire",
    title: "Questionnaire",
    blurb: "Ask your members a set of questions and read the answers.",
    icon: "▤",
    mode: "dialog",
    writes: { table: "questionnaires", kind: "questionnaire" },
    available: (ctx) => Boolean(ctx.canManageOrg),
  },
  {
    id: "poll",
    title: "Poll",
    blurb: "One question, a set of options, and a result bar everyone can see.",
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
