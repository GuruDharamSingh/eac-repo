import "server-only";
import {
  canModerate,
  getForumThread,
  hiddenReplyIds,
  listForumAttachments,
  listReplies,
  listReplyChildren,
  postReply,
  repliesHiddenSupported,
  setReplyHidden,
  type ForumAttachment,
  type ForumReply,
  type ForumViewer,
} from "@elkdonis/services";
import { getHubForumViewer } from "@/lib/hub-forum";

/**
 * The replies of one forum topic, as plain data for the thread frame (hub-forum-replies is the model's
 * apps/elktours/src/lib/forum-data.ts, restyled for this page and with reply hiding).
 *
 * Thin wrappers over @elkdonis/services: reading goes through getForumThread (its `visibleTo` decides whether
 * this viewer may see the topic at all, so a topic of an org the viewer cannot see answers null, which the route
 * turns into 404), writing goes through postReply (sign-in, lock, rate limit, Nextcloud rule all live there).
 * The viewer is always the session's.
 */

export interface HubReply {
  id: string;
  parentId: string | null;
  /** Name of the reply this one answers, when it answers a nested reply (the flatten marker). */
  replyingTo: string | null;
  author: { id: string; name: string; slug: string | null; avatarUrl: string | null };
  /** The author's role in the topic's org: owner or guide are marked; everyone else is plain. */
  role: "owner" | "guide" | null;
  contentHtml: string;
  createdAt: string;
  /** True for a reply an owner or guide hid. Only a moderator is ever sent one. */
  hidden: boolean;
  attachments: Array<{ kind: "image" | "video" | "link"; url: string; width: number | null; height: number | null; card: ForumAttachment["card"] }>;
}

export interface HubThreadReplies {
  viewer: { userId: string | null; signedIn: boolean; canReply: boolean; canModerate: boolean };
  thread: { id: string; locked: boolean; orgName: string };
  replies: HubReply[];
  /** Top-level replies in all (the page size is 30). */
  total: number;
  page: number;
  totalPages: number;
  /** False until the `replies.hidden_at` migration is applied: the Hide control is not drawn. */
  hideAvailable: boolean;
}

const PAGE = 30;

/** A topic's replies (flat: children follow their parent) with roles and attachments. Null when the viewer may not read the topic. */
export async function loadHubReplies(threadId: string, page = 1): Promise<HubThreadReplies | null> {
  const viewer = await getHubForumViewer();
  const thread = await getForumThread(threadId, viewer);
  if (!thread) return null;

  const paged = await listReplies(threadId, { page, limit: PAGE, viewer });
  const flat: ForumReply[] = [];
  for (const r of paged.rows) {
    flat.push(r);
    if (r.childCount > 0) flat.push(...(await listReplyChildren(r.id, viewer).catch(() => [] as ForumReply[])));
  }

  const [atts, hidden, hideAvailable] = await Promise.all([
    listForumAttachments(threadId).catch(() => [] as ForumAttachment[]),
    hiddenReplyIds(threadId).catch(() => new Map()),
    repliesHiddenSupported().catch(() => false),
  ]);
  const mod = canModerate(viewer, thread.org.id);

  // A hidden reply takes its answers with it, for everyone but a moderator (who sees them, and the hidden one marked).
  const gone = new Set<string>();
  if (hidden.size > 0) {
    for (const r of flat) {
      if (hidden.has(r.id) || (r.parentId && gone.has(r.parentId))) gone.add(r.id);
    }
  }

  const byReply = new Map<string, HubReply["attachments"]>();
  for (const a of atts) {
    if (!a.replyId) continue;
    byReply.set(a.replyId, [
      ...(byReply.get(a.replyId) ?? []),
      { kind: a.kind, url: a.url, width: a.width, height: a.height, card: a.card },
    ]);
  }

  const shown = mod ? flat : flat.filter((r) => !gone.has(r.id));
  return {
    viewer: {
      userId: viewer.userId,
      signedIn: Boolean(viewer.userId),
      canReply: Boolean(viewer.userId) && (!thread.locked || mod),
      canModerate: mod,
    },
    thread: { id: thread.id, locked: thread.locked, orgName: thread.org.name },
    replies: shown.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      replyingTo: r.replyingTo?.name ?? null,
      author: { id: r.author.id, name: r.author.name, slug: r.author.slug, avatarUrl: r.author.avatarUrl },
      role: r.authorRole === "owner" ? "owner" : r.authorRole === "guide" ? "guide" : null,
      contentHtml: r.contentHtml,
      createdAt: new Date(r.createdAt).toISOString(),
      hidden: hidden.has(r.id),
      attachments: byReply.get(r.id) ?? [],
    })),
    total: paged.total,
    page: paged.page,
    totalPages: paged.totalPages,
    hideAvailable,
  };
}

/** Post a reply as the session's viewer. The topic must be one this viewer may read (else "not found"). */
export async function postHubReply(input: { threadId: string; text: string; parentId?: string | null }) {
  const viewer: ForumViewer = await getHubForumViewer();
  if (!viewer.userId) return { ok: false as const, error: "Sign in to reply.", status: 401 };
  const thread = await getForumThread(input.threadId, viewer);
  if (!thread) return { ok: false as const, error: "Not found.", status: 404 };
  const r = await postReply(viewer, { threadId: thread.id, text: input.text ?? "", parentId: input.parentId ?? null });
  return r.ok === false ? { ok: false as const, error: r.error, status: 400 } : { ok: true as const, replyId: r.replyId, status: 200 };
}

/** Hide or unhide one reply. canModerate (owners, guides of the topic's org, network admins) is checked in the service. */
export async function hideHubReply(replyId: string, hidden: boolean) {
  const viewer: ForumViewer = await getHubForumViewer();
  if (!viewer.userId) return { ok: false as const, error: "Sign in first.", status: 401 };
  const r = await setReplyHidden(viewer, replyId, hidden);
  return r.ok === false
    ? { ok: false as const, error: r.error, status: /only|gone|switched/i.test(r.error) ? 403 : 400 }
    : { ok: true as const, hidden: r.hidden, status: 200 };
}
