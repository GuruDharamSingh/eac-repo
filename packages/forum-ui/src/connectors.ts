import type {
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
  /** Writes. Absent on a read-only host; the forms then don't render. */
  write?: ForumWriteConnectors;
  hrefs: ForumHrefs;
  /** Where the host mounted handleForumAction, e.g. "/api/forum". */
  actionBase?: string;
}

export interface ForumWriteConnectors {
  postReply(viewer: ForumViewer, input: PostReplyInput): Promise<ForumWriteResult<{ replyId: string; page: number }>>;
  createTopic(viewer: ForumViewer, input: CreateTopicInput): Promise<ForumWriteResult<{ threadId: string; slug: string }>>;
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
    write: opts.actionBase
      ? {
          postReply: s.postReply,
          createTopic: s.createTopic,
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
    hrefs: opts.hrefs,
  };
}
