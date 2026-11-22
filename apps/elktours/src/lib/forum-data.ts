// The forum's replies and write paths as plain data, for the phone surfaces (popup replies panel, topic page, compose
// surface). Server only. Thin wrappers over @elkdonis/services: every visibility and permission rule stays there
// (getForumThread, listReplies, postReply, createTopic, setTopicAudience); this file only shapes the results as JSON.
import { db } from "@elkdonis/db";
import {
  createTopic,
  getForumThread,
  listForumAttachments,
  listReplies,
  listReplyChildren,
  postReply,
  setTopicAudience,
  type ForumAttachment,
  type ForumAttachmentInput,
  type ForumReply,
} from "@elkdonis/services";
import { storageToAudience, type Audience } from "@elkdonis/services/thread-audience";
import { getForumViewer, forumHrefs } from "@/lib/forum";
import { artistBadges } from "@/lib/forum-badges";
import { siteConfig } from "@/config/site";

type Row = Record<string, unknown>;

export type ForumRing = "owner" | "guide" | "artist" | "guest";

export interface PhoneReply {
  id: string;
  parentId: string | null;
  author: { id: string; name: string; slug: string | null; avatarUrl: string | null };
  /** owner and guide come from the org role, artist from experience_people, everyone else is a guest. */
  ring: ForumRing;
  contentHtml: string;
  createdAt: string;
  attachments: Array<{ kind: "image" | "video" | "link"; url: string; width: number | null; height: number | null; card: ForumAttachment["card"] }>;
}

export interface PhoneThreadReplies {
  viewer: { userId: string | null; signedIn: boolean };
  thread: { id: string; slug: string; locked: boolean; audience: Audience; mine: boolean; feedSlug: string };
  replies: PhoneReply[];
  total: number;
}

const att = (a: ForumAttachment) => ({ kind: a.kind, url: a.url, width: a.width, height: a.height, card: a.card });

/** A topic's replies (flat, children after their parent) with role rings and attachments. Null when the viewer may not read it. */
export async function loadReplies(threadId: string, page = 1): Promise<PhoneThreadReplies | null> {
  const viewer = await getForumViewer();
  const thread = await getForumThread(threadId, viewer);
  if (!thread) return null;
  const paged = await listReplies(threadId, { page, limit: 50, viewer });
  const flat: ForumReply[] = [];
  for (const r of paged.rows) {
    flat.push(r);
    if (r.childCount > 0) flat.push(...(await listReplyChildren(r.id, viewer).catch(() => [] as ForumReply[])));
  }
  const [atts, badges, meta] = await Promise.all([
    listForumAttachments(threadId).catch(() => [] as ForumAttachment[]),
    artistBadges(flat.map((r) => r.author.id)),
    db`SELECT visibility, min_role FROM threads WHERE id = ${threadId}`.then((r) => (r as unknown as Row[])[0]).catch(() => undefined),
  ]);
  const mine = (viewer.identityIds ?? (viewer.userId ? [viewer.userId] : [])).includes(thread.author.id);
  const byReply = new Map<string, PhoneReply["attachments"]>();
  for (const a of atts) if (a.replyId) byReply.set(a.replyId, [...(byReply.get(a.replyId) ?? []), att(a)]);
  return {
    viewer: { userId: viewer.userId, signedIn: Boolean(viewer.userId) },
    thread: {
      id: thread.id,
      slug: thread.slug,
      locked: thread.locked,
      audience: storageToAudience(String(meta?.visibility ?? thread.visibility), (meta?.min_role as string | null) ?? null),
      mine,
      feedSlug: thread.feed.slug,
    },
    replies: flat.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      author: { id: r.author.id, name: r.author.name, slug: r.author.slug, avatarUrl: r.author.avatarUrl },
      ring: r.authorRole === "owner" ? "owner" : r.authorRole === "guide" ? "guide" : badges[r.author.id] === "artist" ? "artist" : "guest",
      contentHtml: r.contentHtml,
      createdAt: new Date(r.createdAt).toISOString(),
      attachments: byReply.get(r.id) ?? [],
    })),
    total: paged.total,
  };
}

/** Topic-level attachments (the opening post's photos, videos). The link card is in threads.metadata.link. */
export async function topicAttachments(threadId: string): Promise<Array<{ kind: "image" | "video"; url: string; width: number | null; height: number | null }>> {
  const all = await listForumAttachments(threadId).catch(() => [] as ForumAttachment[]);
  return all.filter((a) => a.replyId === null && (a.kind === "image" || a.kind === "video")).map((a) => ({ kind: a.kind as "image" | "video", url: a.url, width: a.width, height: a.height }));
}

export async function replyAction(input: { threadId: string; text: string; parentId?: string | null; attachments?: ForumAttachmentInput[] }) {
  const viewer = await getForumViewer();
  return postReply(viewer, { threadId: input.threadId, text: input.text ?? "", parentId: input.parentId ?? null, ...(input.attachments?.length ? { attachments: input.attachments } : {}) });
}

export async function topicAction(input: {
  feedSlug: string;
  title: string;
  text: string;
  kind?: "post" | "idea" | "event";
  audience?: Audience;
  link?: string | null;
  attachments?: ForumAttachmentInput[];
}) {
  const viewer = await getForumViewer();
  const r = await createTopic(viewer, {
    orgId: siteConfig.orgId,
    feedSlug: input.feedSlug,
    title: input.title,
    text: input.text,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.audience ? { audience: input.audience } : {}),
    ...(input.link ? { link: input.link } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  });
  if (r.ok === false) return r;
  return { ok: true as const, id: r.threadId, slug: r.slug, href: forumHrefs.thread(r.threadId, r.slug) };
}

export async function audienceAction(threadId: string, audience: Audience) {
  const viewer = await getForumViewer();
  return setTopicAudience(viewer, threadId, audience);
}
