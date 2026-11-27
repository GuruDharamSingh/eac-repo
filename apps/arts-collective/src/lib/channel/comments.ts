"use server";

/**
 * Channel → Comments (2026-11-24): fetch the comments on the person's own
 * Facebook Page and Instagram posts, and reply to one as that Page or
 * account. Only posts sent through the person's own connections are listed
 * (listChannelCommentPosts), because a reply goes out with that token.
 *
 * Permissions each route needs are listed in @elkdonis/meta/comments. A
 * missing permission comes back from Graph as an error and is shown on the
 * post, not thrown.
 */

import { revalidatePath } from "next/cache";
import {
  getChannelComment,
  getChannelCommentPost,
  getInstagramLoginTarget,
  getMetaPageTarget,
  listChannelCommentPosts,
  listUserMemberships,
  recordExternalComment,
  storeFetchedComments,
  type ChannelCommentPost,
} from "@elkdonis/services";
import {
  GraphError,
  listInstagramComments,
  listInstagramLoginComments,
  listPagePostComments,
  replyToInstagramComment,
  replyToInstagramLoginComment,
  replyToPageComment,
  type CommentPage,
} from "@elkdonis/meta";
import { getCurrentUser } from "@/lib/session";

export type CommentsResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Fetch again only when the last fetch is older than this. */
const FRESH_MS = 60_000;
/** Posts fetched per refresh, newest first. */
const MAX_POSTS = 20;
/** Stop starting new fetches after this long; the rest wait for the next refresh. */
const BUDGET_MS = 20_000;

const MANAGER = new Set(["owner", "guide"]);

async function viewer(scopeOrg: string | null): Promise<{ userId: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in first." };
  if (scopeOrg) {
    const memberships = await listUserMemberships(user.id);
    if (!memberships.some((m) => m.orgId === scopeOrg && MANAGER.has(m.role))) return { error: "You do not run that org's channel." };
  }
  return { userId: user.id };
}

/** Plain words for the errors people will meet, with the permission named. */
function explain(err: unknown, post: Pick<ChannelCommentPost, "route">, action: "read" | "reply"): string {
  const code = err instanceof GraphError ? err.code : Number(/\(code (\d+)\)/.exec(err instanceof Error ? err.message : "")?.[1] ?? NaN);
  const raw = err instanceof Error ? err.message : String(err);
  const permission = code === 10 || (code !== undefined && code >= 200 && code < 300);
  if (permission) {
    if (post.route === "page") {
      return action === "read"
        ? "Facebook has not allowed this app to read comments on the Page yet (pages_read_user_content). Reconnect with comments allowed."
        : "Facebook has not allowed this app to reply as the Page yet (pages_manage_engagement). Reconnect with comments allowed.";
    }
    return post.route === "iglogin"
      ? "Instagram has not allowed this app to manage comments yet (instagram_business_manage_comments). Reconnect with comments allowed."
      : "Instagram has not allowed this app to manage comments yet (instagram_manage_comments). Reconnect with comments allowed.";
  }
  if (err instanceof GraphError && err.isAuthProblem) return "The connection's sign-in has expired. Reconnect it on Outlets.";
  // Code 100 subcode 33 means either a deleted post or a missing permission;
  // Graph does not say which (2026-11-25: job 8's post, deleted on the Page).
  if (err instanceof GraphError && err.code === 100 && err.subcode === 33) {
    const where = post.route === "page" ? "Facebook" : "Instagram";
    return `${where} cannot find this post. It may have been deleted on ${where}, or comments are not allowed for this connection yet.`;
  }
  return raw.length < 200 ? raw : `${raw.slice(0, 200)}…`;
}

interface Access {
  token: string;
  selfIds: string[];
  platform: "facebook" | "instagram";
  appSecret?: string;
}

async function accessFor(post: ChannelCommentPost): Promise<Access | { error: string }> {
  const appSecret = process.env.META_APP_SECRET || undefined;
  if (post.route === "iglogin") {
    const t = await getInstagramLoginTarget(post.connectionId);
    if (t.ok === false) return { error: t.error };
    return { token: t.accessToken, selfIds: [t.userId], platform: "instagram" };
  }
  const t = await getMetaPageTarget(post.connectionId, post.pageId ?? "");
  if (t.ok === false) return { error: t.error };
  return post.route === "page"
    ? { token: t.accessToken, selfIds: [t.pageId], platform: "facebook", appSecret }
    : { token: t.accessToken, selfIds: t.instagramUserId ? [t.instagramUserId] : [], platform: "instagram", appSecret };
}

async function fetchComments(post: ChannelCommentPost, a: Access): Promise<CommentPage> {
  if (post.route === "page") return listPagePostComments(post.externalId, a.token, a.appSecret);
  if (post.route === "instagram") return listInstagramComments(post.externalId, a.token, a.appSecret);
  return listInstagramLoginComments(post.externalId, a.token);
}

export interface RefreshOutcome {
  checked: number;
  stored: number;
  removed: number;
  /** jobId → why its comments could not be read. */
  errors: Record<number, string>;
}

/**
 * Fetch comments for the newest posts whose last fetch is older than a
 * minute (or all of them with `force`). Safe to call on every page open.
 */
export async function refreshChannelCommentsAction(scopeOrg: string | null, force = false): Promise<CommentsResult<{ outcome: RefreshOutcome }>> {
  try {
    const v = await viewer(scopeOrg);
    if ("error" in v) return { ok: false, error: v.error };
    const posts = await listChannelCommentPosts(v.userId, { orgId: scopeOrg, limit: MAX_POSTS });
    const outcome: RefreshOutcome = { checked: 0, stored: 0, removed: 0, errors: {} };
    const started = Date.now();
    for (const post of posts) {
      if (Date.now() - started > BUDGET_MS) break;
      if (!force && post.syncedAt && Date.now() - Date.parse(post.syncedAt) < FRESH_MS) continue;
      const a = await accessFor(post);
      if ("error" in a) {
        outcome.errors[post.jobId] = a.error;
        continue;
      }
      try {
        const page = await fetchComments(post, a);
        const r = await storeFetchedComments({
          jobId: post.jobId,
          threadId: post.threadId,
          platform: a.platform,
          externalPostId: post.externalId,
          selfIds: a.selfIds,
          complete: page.complete,
          comments: page.comments,
        });
        outcome.checked += 1;
        outcome.stored += r.stored;
        outcome.removed += r.removed;
      } catch (err) {
        outcome.errors[post.jobId] = explain(err, post, "read");
      }
    }
    if (outcome.checked > 0) revalidatePath("/channel/comments");
    return { ok: true, outcome };
  } catch (err) {
    console.error("[channel comments] refresh:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Comments could not be fetched." };
  }
}

/**
 * Reply under a comment, as the Page (Facebook) or the account (Instagram).
 * Instagram and Facebook nest one level, so a reply to a reply goes under
 * the top comment of that conversation.
 */
export async function replyToChannelCommentAction(commentId: number, message: string): Promise<CommentsResult<{ replyId: string }>> {
  try {
    const text = String(message ?? "").trim();
    if (!text) return { ok: false, error: "Write a reply first." };
    if (text.length > 2000) return { ok: false, error: "Replies are limited to 2,000 characters." };
    const v = await viewer(null);
    if ("error" in v) return { ok: false, error: v.error };
    const found = await getChannelComment(v.userId, Number(commentId));
    if (!found) return { ok: false, error: "That comment is not on one of your posts." };
    const { post, comment } = found;
    const a = await accessFor(post);
    if ("error" in a) return { ok: false, error: a.error };
    const under = comment.parentExternalId ?? comment.externalId;
    let replyId: string;
    try {
      replyId =
        post.route === "page"
          ? await replyToPageComment(under, text, a.token, a.appSecret)
          : post.route === "instagram"
            ? await replyToInstagramComment(under, text, a.token, a.appSecret)
            : await replyToInstagramLoginComment(under, text, a.token);
    } catch (err) {
      return { ok: false, error: explain(err, post, "reply") };
    }
    await recordExternalComment({
      threadId: post.threadId,
      publishJobId: post.jobId,
      fromSelf: true,
      platform: a.platform,
      externalId: replyId,
      externalPostId: post.externalId,
      parentExternalId: under,
      authorName: "You",
      authorExternalId: a.selfIds[0] ?? null,
      message: text,
      url: a.platform === "facebook" ? `https://www.facebook.com/${replyId}` : null,
      commentedAt: new Date(),
    });
    revalidatePath("/channel/comments");
    return { ok: true, replyId };
  } catch (err) {
    console.error("[channel comments] reply:", err instanceof Error ? err.message : err);
    return { ok: false, error: "The reply did not go out." };
  }
}

/** One post's comments fetched now, regardless of the last fetch. */
export async function refreshOnePostAction(jobId: number): Promise<CommentsResult> {
  const v = await viewer(null);
  if ("error" in v) return { ok: false, error: v.error };
  const post = await getChannelCommentPost(v.userId, Number(jobId));
  if (!post) return { ok: false, error: "Not one of your posts." };
  const a = await accessFor(post);
  if ("error" in a) return { ok: false, error: a.error };
  try {
    const page = await fetchComments(post, a);
    await storeFetchedComments({ jobId: post.jobId, threadId: post.threadId, platform: a.platform, externalPostId: post.externalId, selfIds: a.selfIds, complete: page.complete, comments: page.comments });
    revalidatePath("/channel/comments");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: explain(err, post, "read") };
  }
}
