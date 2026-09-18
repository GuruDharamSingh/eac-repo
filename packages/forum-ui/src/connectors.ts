import type * as React from "react";
import { renderWikiBody } from "@elkdonis/utils/wiki-render";
import type {
  Constellation,
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
  /** The dictionary — the wiki's defined terms, A–Z. */
  dictionary?(): string | null;
  /**
   * Drawings (2026-09-17): the editor for one, and a new one — optionally
   * drawn over a thread's map. Only a host with the Excalidraw editor
   * (apps/forum) supplies these; elsewhere the affordances don't render and
   * a drawing still shows, since it is a post with a picture in it.
   */
  drawing?(threadId: string): string | null;
  newDrawing?(fromThreadId?: string): string | null;
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
  /**
   * The map (2026-09-17). Everything a thread is connected to — gathers,
   * mentions, shared tags, people's lines — under the viewer's visibility;
   * and one person's own lines as a map of their own.
   */
  constellation?(threadId: string, viewer: ForumViewer, opts?: { limit?: number }): Promise<Constellation | null>;
  personMap?(userId: string, viewer: ForumViewer, opts?: { limit?: number }): Promise<Constellation>;
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
   * @deprecated There is one design now (2026-09-17: steel, silver, paper
   * edges). Accepted and still emitted as data-forum-theme so an older
   * host's CSS keeps matching, but forum-modern.css is an empty stub.
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

/** A page as the editor needs it: the stored body, unresolved. */
export interface ForumWikiPageSource {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  parentId: string | null;
  updatedAt: Date;
  topicIds: string[];
}

export interface ForumWikiRevisionRow {
  id: string;
  title: string;
  createdAt: Date;
  editorName: string | null;
}

export interface ForumWikiTermRow {
  id: string;
  slug: string;
  title: string;
  firstSense: string | null;
  senseCount: number;
  aliases: string[];
  updatedAt: Date;
}

/**
 * What a host-supplied wiki editor receives. The package renders a plain
 * <textarea name="body"> when no editor is given, so the wiki is editable
 * with no client JavaScript at all; a host that has JavaScript (apps/forum)
 * hands in a client component that writes HTML into a hidden `body` field
 * and sets `format=html`. Either way the form posts the same fields.
 */
export interface ForumWikiEditorProps {
  name: string;
  defaultValue: string;
  wikiPages: Array<{ title: string; slug: string }>;
  sourceThreadId?: string;
}

export type ForumWikiWriteResult =
  | { ok: true; slug: string; threadId: string }
  | { ok: false; error: string }
  /** Somebody else saved first. Theirs is returned so the two can be reconciled by hand. */
  | { ok: false; conflict: true; error: string; theirs: { title: string; body: string | null }; updatedAt: string };

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
  /** The dictionary index: every page that has been given a sense. */
  listTerms?(opts?: { limit?: number; order?: "alpha" | "recent" }): Promise<ForumWikiTermRow[]>;

  // ── editing, owned by the forum since 2026-09-17 ─────────────────────────
  // All optional: a host without them shows the wiki read-only, exactly as
  // before. With them, /wiki/new, /wiki/[slug]/edit and /wiki/[slug]/history
  // render and the wiki-* actions accept posts.
  getSource?(slug: string): Promise<ForumWikiPageSource | null>;
  create?(input: { authorId: string; title: string; body: string; parentId: string | null }): Promise<ForumWikiWriteResult>;
  update?(input: {
    threadId: string; editorId: string; title: string; body: string; parentId: string | null;
    expectedUpdatedAt: string | null; topicIds?: string[];
  }): Promise<ForumWikiWriteResult>;
  archive?(threadId: string): Promise<{ ok: true; orphanedChildren: number } | { ok: false; error: string }>;
  revert?(threadId: string, revisionId: string, editorId: string): Promise<ForumWikiWriteResult>;
  listRevisions?(threadId: string): Promise<ForumWikiRevisionRow[]>;
  /** Network topics a page may be tagged with. */
  listTopicChoices?(): Promise<Array<{ id: string; name: string }>>;
  /** A client editor island, when the host has JavaScript. See ForumWikiEditorProps. */
  editor?: React.ComponentType<ForumWikiEditorProps>;
  /**
   * @deprecated The forum owns editing now. Kept so a host passing it keeps
   * compiling; ignored when `create`/`update` are present.
   */
  editHref?(slug: string): string | null;
  /** @deprecated see editHref */
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
  /** Take a topic down as its author (moderators use `moderateThread`). Archives. */
  removeThread?(viewer: ForumViewer, threadId: string): Promise<ForumWriteResult>;
  /** A person's line between two threads — theirs, undirected, idempotent. */
  drawLine?(viewer: ForumViewer, a: string, b: string, note: string | null): Promise<ForumWriteResult<{ created: boolean }>>;
  eraseLine?(viewer: ForumViewer, a: string, b: string): Promise<ForumWriteResult<{ erased: boolean }>>;
}

/** Links for the network host: every org visible, boards under /o/. */
export function networkHrefs(opts: {
  base?: string; signIn?: string | null; orgSite?: ForumHrefs["orgSite"]; profile?: ForumHrefs["profile"];
  drawing?: ForumHrefs["drawing"]; newDrawing?: ForumHrefs["newDrawing"];
} = {}): ForumHrefs {
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
    dictionary: () => `${b}/dictionary`,
    orgSite: opts.orgSite ?? (() => null),
    profile: opts.profile,
    drawing: opts.drawing,
    newDrawing: opts.newDrawing,
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
    dictionary: () => `${b}/dictionary`,
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
   * @deprecated The forum owns wiki editing itself now (2026-09-17); the
   * Edit/New affordances point at the forum's own /wiki routes. Accepted and
   * ignored so an older host keeps compiling.
   */
  wikiConsole?: string;
  /**
   * A client editor for the wiki forms, on a host that has JavaScript. Omit
   * and the forms fall back to a plain textarea — still fully functional.
   */
  wikiEditor?: React.ComponentType<ForumWikiEditorProps>;
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
    constellation: (id, viewer, o) => s.getConstellation(id, { viewer, limit: o?.limit }),
    personMap: (userId, viewer, o) => s.getPersonMap(userId, { viewer, limit: o?.limit }),
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
          removeThread: (viewer, threadId) => s.removeThread(viewer, threadId).then((r) => (r.ok ? { ok: true } : r)),
          async drawLine(viewer, a, b, note) {
            if (!viewer.userId) return { ok: false, error: "Sign in first." };
            try {
              const r = await s.drawLine(viewer.userId, a, b, { note, viewer });
              return { ok: true, created: r.created };
            } catch (err) {
              if (err instanceof s.LineError) return { ok: false, error: err.message };
              throw err;
            }
          },
          async eraseLine(viewer, a, b) {
            if (!viewer.userId) return { ok: false, error: "Sign in first." };
            return { ok: true, erased: await s.eraseLine(viewer.userId, a, b) };
          },
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
      // Read links AND unwritten links both resolve to the forum's own
      // /wiki/… now that it owns the editor: a red link lands on /wiki/new.
      const { html } = renderWikiBody(resolved.html, base);

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

    listTerms: (o) => s.listDefinedTerms(o),

    async getSource(slug) {
      const page = await s.getWikiPage(slug);
      if (!page) return null;
      const topics = await s.listWikiTopics(page.id);
      return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        body: page.body,
        parentId: page.parentId,
        updatedAt: page.updatedAt,
        topicIds: topics.map((t) => t.id),
      };
    },

    async create(input) {
      const { sanitizeRichText } = await import("@elkdonis/utils");
      const parentId = await validParent(s, input.parentId);
      if (parentId === INVALID_PARENT) return { ok: false, error: "That parent page does not exist." };
      const page = await s.createWikiPage({
        authorId: input.authorId,
        title: input.title,
        body: sanitizeRichText(input.body),
        parentId,
      });
      return { ok: true, slug: page.slug, threadId: page.id };
    },

    async update(input) {
      const { sanitizeRichText } = await import("@elkdonis/utils");
      const parentId = await validParent(s, input.parentId, input.threadId);
      if (parentId === INVALID_PARENT) {
        return { ok: false, error: "A page can't sit under itself or one of its own subpages." };
      }
      let page;
      try {
        page = await s.updateWikiPage(input.threadId, input.editorId, {
          title: input.title,
          body: sanitizeRichText(input.body),
          parentId,
          expectedUpdatedAt: input.expectedUpdatedAt,
        });
      } catch (err) {
        if (err instanceof s.WikiConflictError) {
          return {
            ok: false,
            conflict: true,
            error: err.message,
            theirs: { title: err.currentTitle, body: err.currentBody },
            updatedAt: new Date(err.currentUpdatedAt).toISOString(),
          };
        }
        throw err;
      }
      // After the conflict check, so a refused save doesn't retag the page anyway.
      if (input.topicIds) await s.setWikiTopics(input.threadId, input.topicIds);
      return { ok: true, slug: page.slug, threadId: page.id };
    },

    async archive(threadId) {
      const r = await s.archiveWikiPage(threadId);
      return r.archived ? { ok: true, orphanedChildren: r.orphanedChildren } : { ok: false, error: "Page not found." };
    },

    async revert(threadId, revisionId, editorId) {
      const page = await s.revertWikiPage(threadId, revisionId, editorId);
      return { ok: true, slug: page.slug, threadId: page.id };
    },

    async listRevisions(threadId) {
      const rows = await s.getWikiRevisions(threadId);
      return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt, editorName: r.editorName ?? null }));
    },

    // The wiki lives under the collective's org, so that is whose proposed
    // topics are offered alongside the network-approved ones.
    listTopicChoices: async () => (await s.listTopicChoices("elkdonis")).map((c) => ({ id: c.id, name: c.name })),

    editor: opts.wikiEditor,
  };
}

const INVALID_PARENT = "__invalid_parent__";

/**
 * A parent must exist and, when editing, must not be the page itself or one
 * of its descendants — the picker never offers those, but the field arrives
 * from a form and forms can say anything.
 */
async function validParent(
  s: typeof import("@elkdonis/services"),
  requested: string | null | undefined,
  selfId?: string
): Promise<string | null | typeof INVALID_PARENT> {
  if (!requested) return null;
  if (selfId && requested === selfId) return INVALID_PARENT;
  const pages = await s.listWikiPages();
  if (!pages.some((p) => p.id === requested)) return selfId ? null : INVALID_PARENT;
  if (selfId && s.collectSubtreeIds(pages, selfId).has(requested)) return INVALID_PARENT;
  return requested;
}
