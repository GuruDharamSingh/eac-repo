import { renderWikiBody } from "@elkdonis/utils/wiki-render";
import type {
  CreateCategoryInput,
  CreateTopicInput,
  ForumActivityItem,
  ForumBoard,
  ForumMember,
  ForumMemberSort,
  ForumModLogEntry,
  ForumOrgCard,
  ForumSearchHit,
  ForumPerson,
  ForumPersonCard,
  ForumTopicEntry,
  ForumHappeningRow,
  ForumLatestRow,
  ForumModAction,
  ForumNotification,
  ForumPulse,
  ForumReply,
  ForumScope,
  ForumSort,
  ForumThreadRecord,
  ForumTopicIndexRow,
  ForumTopicRow,
  ForumViewer,
  ForumVoters,
  ForumWriteResult,
  Paged,
  PostReplyInput,
  TopicListTarget,
  VoteTarget,
} from "@elkdonis/services";

/** What a feed page needs to know about its feed. */
export interface ForumFeedInfo {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  presenter: string | null;
  accent: string | null;
  minRole: "member" | "guide" | "owner" | null;
}

// ============================================================================
// What a host supplies. Mirrors SurfaceConnectors: data in, links out, and
// the pages in between never learn where either came from.
// ============================================================================

export interface ForumHrefs {
  root(): string;
  latest(): string;
  happening(): string;
  board(orgSlug: string): string;
  feed(orgSlug: string, feedSlug: string): string;
  thread(id: string, slug: string): string;
  /** The forum's own member page. Null for a person without a slug. */
  member(slug: string | null): string | null;
  topic(slug: string): string | null;
  /** The wiki, inside the forum. Null on a host without a wiki section. */
  wiki?(): string | null;
  wikiPage?(slug: string): string | null;
  /** The org's own site, for the "↗" on a masthead. */
  orgSite(board: { slug: string; orgId: string; primaryDomain?: string | null }): string | null;
  /** The network-wide identity page (ArtDirect). Optional. */
  profile?(slug: string | null): string | null;
  signIn: string | null;
}

export interface ForumConnectors {
  scope: ForumScope;
  /** Name of the host, for the first breadcrumb. */
  siteName: string;
  viewer(): Promise<ForumViewer>;
  listBoards(scope: ForumScope, viewer: ForumViewer): Promise<ForumBoard[]>;
  getBoardBySlug(orgSlug: string, viewer: ForumViewer): Promise<ForumBoard | null>;
  getFeed(orgId: string, slug: string): Promise<ForumFeedInfo | null>;
  listTopics(target: TopicListTarget, viewer: ForumViewer, opts: { sort?: ForumSort; page?: number; limit?: number }): Promise<Paged<ForumTopicRow>>;
  getThread(id: string, viewer: ForumViewer): Promise<ForumThreadRecord | null>;
  recordView?(id: string): Promise<void>;
  listReplies(threadId: string, opts: { page?: number; limit?: number; viewer?: ForumViewer }): Promise<Paged<ForumReply>>;
  listReplyChildren(parentId: string, viewer?: ForumViewer): Promise<ForumReply[]>;
  listHappening(scope: ForumScope, viewer: ForumViewer, opts: { limit?: number; days?: number }): Promise<ForumHappeningRow[]>;
  listLatest(scope: ForumScope, viewer: ForumViewer, opts: { limit?: number }): Promise<ForumLatestRow[]>;
  pulse?(viewer: ForumViewer): Promise<ForumPulse>;
  listTopicIndex?(viewer: ForumViewer, limit: number): Promise<ForumTopicIndexRow[]>;
  firstUnreadReply?(threadId: string, viewer: ForumViewer): Promise<{ replyId: string; page: number } | null>;
  listVoters?(target: VoteTarget): Promise<ForumVoters>;
  listTopicChoices?(orgId: string): Promise<Array<{ id: string; slug: string; name: string; status: string }>>;
  listNotifications?(userId: string, limit: number): Promise<ForumNotification[]>;
  countUnreadNotifications?(userId: string): Promise<number>;
  // People and taxonomy (phase 3). All optional; pages that need one and
  // don't have it render their empty state.
  listPeopleCards?(userIds: string[]): Promise<Record<string, ForumPersonCard>>;
  getMember?(slug: string): Promise<ForumMember | null>;
  listMemberActivity?(userId: string, viewer: ForumViewer, opts: { page?: number; limit?: number; only?: "topic" | "reply" }): Promise<Paged<ForumActivityItem>>;
  listMembers?(opts: { sort?: ForumMemberSort; q?: string; page?: number; limit?: number }): Promise<Paged<ForumPersonCard>>;
  listPresent?(minutes?: number, limit?: number): Promise<{ count: number; people: ForumPerson[] }>;
  listNewMembers?(limit?: number): Promise<Array<ForumPerson & { joinedAt: Date }>>;
  listOrgCards?(viewer: ForumViewer): Promise<ForumOrgCard[]>;
  listTopicEntries?(viewer: ForumViewer, opts?: { includeProposed?: boolean }): Promise<ForumTopicEntry[]>;
  getTopicBySlug?(slug: string): Promise<ForumTopicEntry | null>;
  searchForum?(q: string, viewer: ForumViewer, opts: { scope?: ForumScope; page?: number; limit?: number; only?: "thread" | "reply" }): Promise<Paged<ForumSearchHit>>;
  listModLog?(orgId: string, opts: { page?: number; limit?: number }): Promise<Paged<ForumModLogEntry>>;
  /**
   * The network wiki, as a section of the forum. Absent and the /wiki routes
   * 404 and the masthead link doesn't render — same posture as every other
   * optional connector here.
   *
   * The wiki is a PEER of the boards, not a board: its pages are excluded
   * from listTopics and searchForum by kind, because a collectively edited
   * reference page has no post #1 (decision 3b — the thread IS post #1).
   * Discussion about a page is a real topic that references it, which is what
   * `talkThread` resolves.
   */
  wiki?: ForumWikiConnectors;
  /** Writes. Absent on a read-only host; the forms then don't render. */
  write?: ForumWriteConnectors;
  hrefs: ForumHrefs;
  /** Where the host mounted handleForumAction, e.g. "/api/forum". */
  actionBase?: string;
  /**
   * Which skin to render in. One markup, two stylesheets:
   *
   *   "classic" (default) — the board. Tables, dense rows, hairlines.
   *                         Needs only forum.css.
   *   "modern"            — the same pages as a card feed. Needs
   *                         forum.css AND forum-modern.css; the host imports
   *                         both and the second overrides the first, scoped
   *                         under [data-forum-theme="modern"].
   *
   * The attribute is emitted by renderForumRoute, so a host switches themes
   * by setting this and adding one @import — no markup change anywhere.
   */
  theme?: "classic" | "modern";
  /**
   * Light or dark ground, independent of the skin — a host can offer a card
   * feed on paper or a board on brushed silver. "auto" follows the reader's
   * own prefers-color-scheme. Emitted as data-forum-mode by renderForumRoute;
   * forum-theme.css carries the palettes.
   */
  mode?: "light" | "dark" | "auto";
}

/** A wiki page as the forum needs it — shaped here so forum-ui stays free of
 *  any dependency on @elkdonis/services. */
export interface ForumWikiPageRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  updatedAt: Date;
  /** Depth in the page tree, for an indented outline. 0 is a root. */
  depth?: number;
}

export interface ForumWikiPage extends ForumWikiPageRow {
  /** Already resolved for rendering: hrefs stamped, terms filled in. */
  bodyHtml: string | null;
  authorName?: string | null;
  /** Contributed senses, when the page is a defined term. */
  senses?: Array<{ id: string; text: string; byName?: string | null; at: string }>;
  topics?: Array<{ id: string; slug: string; name: string }>;
  ancestors?: Array<{ slug: string; title: string }>;
  children?: ForumWikiPageRow[];
  backlinks?: Array<{ slug: string; title: string }>;
}

export interface ForumWikiSearchSpan {
  text: string;
  hit: boolean;
}

export interface ForumWikiSearchHit {
  id: string;
  slug: string;
  title: string;
  titleSpans: ForumWikiSearchSpan[];
  snippetSpans: ForumWikiSearchSpan[];
  viaDefinition: boolean;
}

export interface ForumWikiConnectors {
  /** Flat list, tree order, for the index outline. */
  listPages(): Promise<ForumWikiPageRow[]>;
  getPage(slug: string): Promise<ForumWikiPage | null>;
  search?(q: string, limit?: number): Promise<ForumWikiSearchHit[]>;
  /**
   * The discussion topic for a wiki page — the Talk page. Returns the thread
   * that already references it, or null when nobody has started one.
   * `ensure: true` creates it (used behind the "Discuss this page" button).
   */
  talkThread?(
    wikiThreadId: string,
    opts?: { ensure?: boolean; authorId?: string }
  ): Promise<{ id: string; slug: string; replyCount: number } | null>;
  /**
   * Add a word to the dictionary from inside the forum — the wiki section is
   * an input space, not only a reading one, because reading is when you
   * notice a term nobody has defined.
   *
   * Never overwrites: a word that already has a page gains another sense
   * attributed to whoever wrote it. `sourceThreadId` records the topic being
   * read as a reference to the term.
   *
   * It does NOT mark up the post the word came from — that is somebody
   * else's prose. Terms are only glossed where their own author marked them.
   */
  define?(input: {
    term: string;
    definition: string;
    authorId: string;
    sourceThreadId?: string;
  }): Promise<{ slug: string; created: boolean; senses: number; duplicate: boolean }>;
  /** Where a page is edited — the wiki's own console, off the forum. */
  editHref?(slug: string): string | null;
  newHref?(title?: string): string | null;
}

export interface ForumWriteConnectors {
  postReply(viewer: ForumViewer, input: PostReplyInput): Promise<ForumWriteResult<{ replyId: string; page: number }>>;
  createTopic(viewer: ForumViewer, input: CreateTopicInput): Promise<ForumWriteResult<{ threadId: string; slug: string }>>;
  /** Add a category (an org_feeds row) to this org's board. Member and up. */
  createCategory?(viewer: ForumViewer, input: CreateCategoryInput): Promise<ForumWriteResult<{ slug: string; name: string }>>;
  setVote(viewer: ForumViewer, target: VoteTarget, kind: "up" | "down"): Promise<ForumWriteResult<{ score: number; vote: "up" | "down" | null }>>;
  toggleHeart(viewer: ForumViewer, target: VoteTarget): Promise<ForumWriteResult<{ hearts: number; hearted: boolean }>>;
  toggleWatch(viewer: ForumViewer, threadId: string): Promise<ForumWriteResult<{ watching: boolean }>>;
  toggleBookmark(viewer: ForumViewer, threadId: string): Promise<ForumWriteResult<{ bookmarked: boolean }>>;
  markThreadRead(userId: string, threadId: string, lastReplyId: string | null): Promise<void>;
  markAllRead(viewer: ForumViewer): Promise<ForumWriteResult>;
  proposeTopic(viewer: ForumViewer, input: { name: string; orgId: string }): Promise<ForumWriteResult<{ topicId: string; status: string }>>;
  moderateThread(viewer: ForumViewer, threadId: string, action: ForumModAction, arg?: string): Promise<ForumWriteResult>;
  markNotificationsRead(userId: string): Promise<void>;
  htmlToQuote(html: string): string;
  reviewTopic?(viewer: ForumViewer, topicId: string, decision: "approved" | "rejected"): Promise<ForumWriteResult>;
}

/** Links for the network host: every org visible, boards under /o/. */
export function networkHrefs(opts: { base?: string; signIn?: string | null; orgSite?: ForumHrefs["orgSite"]; profile?: ForumHrefs["profile"] } = {}): ForumHrefs {
  const b = (opts.base ?? "").replace(/\/$/, "");
  return {
    root: () => `${b}/`,
    latest: () => `${b}/latest`,
    happening: () => `${b}/happening`,
    board: (org) => `${b}/o/${org}`,
    feed: (org, feed) => `${b}/o/${org}/${feed}`,
    thread: (id, slug) => `${b}/t/${id}/${slug}`,
    member: (slug) => (slug ? `${b}/members/${slug}` : null),
    topic: (slug) => `${b}/topics/${slug}`,
    wiki: () => `${b}/wiki`,
    wikiPage: (slug) => `${b}/wiki/${slug}`,
    orgSite: opts.orgSite ?? (() => null),
    profile: opts.profile,
    signIn: opts.signIn ?? null,
  };
}

/** Links for an org host mounting the forum at `base` (default /forum). */
export function orgHrefs(opts: { base?: string; signIn?: string | null } = {}): ForumHrefs {
  const b = (opts.base ?? "/forum").replace(/\/$/, "");
  return {
    root: () => `${b}`,
    latest: () => `${b}/latest`,
    happening: () => `${b}/happening`,
    board: () => `${b}`,
    feed: (_org, feed) => `${b}/${feed}`,
    thread: (id, slug) => `${b}/t/${id}/${slug}`,
    member: (slug) => (slug ? `${b}/members/${slug}` : null),
    topic: (slug) => `${b}/topics/${slug}`,
    wiki: () => `${b}/wiki`,
    wikiPage: (slug) => `${b}/wiki/${slug}`,
    orgSite: () => null,
    signIn: opts.signIn ?? null,
  };
}

export interface ServiceConnectorOptions {
  scope: ForumScope;
  siteName: string;
  viewer: () => Promise<ForumViewer>;
  hrefs: ForumHrefs;
  /** Where the host mounted handleForumAction. Omit for a read-only host. */
  actionBase?: string;
  /** "classic" (default) or "modern". See ForumConnectors.theme. */
  theme?: "classic" | "modern";
  /** "light" (default), "dark" or "auto". See ForumConnectors.mode. */
  mode?: "light" | "dark" | "auto";
  /**
   * Where the wiki is EDITED, if anywhere reachable from this host — e.g.
   * "https://arts-collective.com/hub/wiki". The forum displays the wiki and
   * links out to its console; it never hosts the editor, so omitting this
   * simply hides the Edit and New affordances.
   */
  wikiConsole?: string;
}

/**
 * Connectors bound straight to @elkdonis/services — what both hosts use.
 * A host that stores threads somewhere else writes its own ForumConnectors;
 * this one exists so the common case is four lines.
 */
export async function serviceConnectors(opts: ServiceConnectorOptions): Promise<ForumConnectors> {
  const s = await import("@elkdonis/services");
  return {
    scope: opts.scope,
    siteName: opts.siteName,
    viewer: opts.viewer,
    listBoards: s.listBoards,
    getBoardBySlug: s.getBoardBySlug,
    getFeed: s.getOrgFeed,
    listTopics: s.listTopics,
    getThread: s.getForumThread,
    recordView: s.recordThreadView,
    listReplies: s.listReplies,
    listReplyChildren: s.listReplyChildren,
    listHappening: s.listHappening,
    listLatest: s.listLatest,
    pulse: s.getPulse,
    listTopicIndex: s.listTopicIndex,
    firstUnreadReply: s.firstUnreadReply,
    listVoters: s.listVoters,
    listTopicChoices: s.listTopicChoices,
    listNotifications: s.listNotifications,
    countUnreadNotifications: s.countUnreadNotifications,
    listPeopleCards: s.listPeopleCards,
    getMember: s.getMember,
    listMemberActivity: s.listMemberActivity,
    listMembers: s.listMembers,
    listPresent: s.listPresent,
    listNewMembers: s.listNewMembers,
    listOrgCards: s.listOrgCards,
    listTopicEntries: s.listTopicEntries,
    getTopicBySlug: s.getTopicBySlug,
    searchForum: s.searchForum,
    listModLog: s.listModLog,
    wiki: wikiConnectors(s, opts),
    write: opts.actionBase
      ? {
          postReply: s.postReply,
          createTopic: s.createTopic,
          createCategory: s.createCategory,
          setVote: s.setVote,
          toggleHeart: s.toggleHeart,
          toggleWatch: s.toggleWatch,
          toggleBookmark: s.toggleBookmark,
          markThreadRead: s.markThreadRead,
          markAllRead: s.markAllRead,
          proposeTopic: s.proposeTopic,
          moderateThread: s.moderateThread,
          markNotificationsRead: s.markNotificationsRead,
          htmlToQuote: s.htmlToQuote,
          reviewTopic: s.reviewTopicAndNotify,
        }
      : undefined,
    actionBase: opts.actionBase,
    theme: opts.theme,
    mode: opts.mode,
    hrefs: opts.hrefs,
  };
}

/**
 * The wiki, bound to the same services the boards use.
 *
 * The one piece of real work here is the body: a stored wiki page carries
 * link TARGETS (`data-wiki-slug`), never hrefs, precisely so that whoever
 * renders it decides where a wikilink points. arts-collective serves the same
 * page under /hub/wiki/…; here it has to come out under the forum's own
 * /wiki/…, which is what renderWikiBody's basePath is for. Defined terms are
 * resolved the same way, server-side, so a reader gets the meaning inline.
 *
 * `editHref`/`newHref` point OFF the forum at the wiki's own console — the
 * forum shows the wiki, it does not own editing it.
 */
function wikiConnectors(
  s: typeof import("@elkdonis/services"),
  opts: ServiceConnectorOptions
): ForumWikiConnectors {
  const base = opts.hrefs.wiki?.() ?? "/wiki";
  const console_ = opts.wikiConsole;

  return {
    async listPages() {
      const pages = await s.listWikiPages();
      // Tree order with depth, so the index reads as an outline rather than
      // an alphabetical dump that hides the hierarchy.
      const out: ForumWikiPageRow[] = [];
      const walk = (nodes: ReturnType<typeof s.buildWikiTree>, depth: number) => {
        for (const n of nodes) {
          out.push({
            id: n.id,
            slug: n.slug,
            title: n.title,
            excerpt: n.excerpt,
            updatedAt: n.updatedAt,
            depth,
          });
          walk(n.children, depth + 1);
        }
      };
      walk(s.buildWikiTree(pages), 0);
      return out;
    },

    async getPage(slug) {
      const page = await s.getWikiPage(slug);
      if (!page) return null;

      const [ancestors, backlinks, all, senses, topics] = await Promise.all([
        s.getWikiAncestors(page.id),
        s.getWikiBacklinks(page.id),
        s.listWikiPages(),
        s.getTermDefinitions(page.id),
        s.listWikiTopics(page.id),
      ]);

      const resolved = await s.resolveTerms(page.body ?? "", base);
      // Read links resolve to the forum's own /wiki/…, but an UNWRITTEN link
      // has to point at the editing console: the forum has no /wiki/new of
      // its own, so defaulting would make every red link a 404.
      const { html } = renderWikiBody(resolved.html, base, {
        newBase: console_ ? `${console_}/new` : undefined,
      });

      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        excerpt: page.excerpt,
        updatedAt: page.updatedAt,
        bodyHtml: page.body ? html : null,
        authorName: page.authorName ?? null,
        senses: senses.map((d) => ({ id: d.id, text: d.text, byName: d.byName ?? null, at: d.at })),
        topics,
        ancestors: ancestors.map((a) => ({ slug: a.slug, title: a.title })),
        children: all
          .filter((p) => p.parentId === page.id)
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((p) => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            updatedAt: p.updatedAt,
          })),
        backlinks: backlinks.map((b) => ({ slug: b.slug, title: b.title })),
      };
    },

    search: (q, limit) => s.searchWiki(q, limit),

    talkThread: (wikiThreadId, o) => s.wikiTalkThread(wikiThreadId, o),

    async define(input) {
      const r = await s.defineTerm({
        term: input.term,
        definition: input.definition,
        authorId: input.authorId,
        sourceThreadId: input.sourceThreadId,
      });
      return {
        slug: r.slug,
        created: r.created,
        senses: r.definitions.length,
        duplicate: r.duplicate,
      };
    },

    editHref: console_ ? (slug) => `${console_}/${slug}/edit` : undefined,
    newHref: console_
      ? (title) => (title ? `${console_}/new?title=${encodeURIComponent(title)}` : `${console_}/new`)
      : undefined,
  };
}
