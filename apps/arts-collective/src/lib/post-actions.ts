"use server";

import {
  archiveSocialPost,
  createSocialPost,
  getSocialPost,
  listListableOrgs,
  listSocialPosts,
  recordSocialShare,
  updateSocialPost,
  listConnections,
  getMetaPageTarget,
  getThreadsTarget,
  getInstagramLoginTarget,
  createPostAnywhere,
  listPostTargets,
  isOrgChannel,
  startPublishJob,
  finishPublishJob,
  PERSONAL_ORG_ID as BLOG_ORG_ID,
  type SocialPost,
} from "@elkdonis/services";
import { db } from "@elkdonis/db";
import { postImageToInstagram, postToPage, postToThreads } from "@elkdonis/meta";
import { postImageWithInstagramLogin } from "@elkdonis/meta/instagram-login";
import type { StudioResult, StudioShare } from "@elkdonis/studio";
import type { SocialPostPatchView, SocialPostView } from "@elkdonis/studio/post";
import { getCurrentUser } from "@/lib/session";

/**
 * The Studio's Post kind (2026-10-31): a post written for Facebook,
 * Instagram and Threads, posted through the person's own connections
 * (share-actions.ts does the same for a published piece). Every action
 * re-reads the row by id for the acting user; the services scope by owner.
 *
 * Meta fetches pictures by URL, so each image path is made absolute on the
 * network host; the services only accept public /api/media paths.
 *
 * A social post that goes out also becomes a thread on the network (dev,
 * 2026-10-31): the first successful post mirrors it through
 * createPostAnywhere, to the person's blog for "Just me" or to the acting
 * org's first feed they may post in. The thread remembers the social post in
 * metadata.socialPostId, so a second platform does not make a second thread.
 */

const PERSONAL_ORG_ID = "oad";
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const ORIGIN = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;
const LIMITS = { facebook: 63_206, instagram: 2_200, threads: 500 } as const;

const toView = (p: SocialPost): SocialPostView => ({
  id: p.id,
  orgId: p.orgId,
  title: p.title,
  body: p.body,
  link: p.link,
  images: p.images,
  variants: p.variants,
  shares: p.shares,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

async function viewerId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function listSocialPostsAction(orgId: string): Promise<SocialPostView[]> {
  const viewer = await viewerId();
  if (!viewer) return [];
  return (await listSocialPosts(viewer, orgId).catch(() => [])).map(toView);
}

export async function createSocialPostAction(orgId: string): Promise<StudioResult<SocialPostView>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  const target = orgId && orgId !== PERSONAL_ORG_ID ? orgId : PERSONAL_ORG_ID;
  if (target !== PERSONAL_ORG_ID) {
    const allowed = (await listListableOrgs(viewer)).some((o) => o.orgId === target);
    if (!allowed) return { ok: false, error: "You are not a member of that organisation." };
  }
  try {
    return { ok: true, value: toView(await createSocialPost(viewer, target)) };
  } catch (err) {
    console.error("[posts] create:", err);
    return { ok: false, error: "Could not start a post (is migration 219 applied?)." };
  }
}

export async function saveSocialPostAction(id: string, patch: SocialPostPatchView): Promise<StudioResult<SocialPostView>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  const saved = await updateSocialPost(viewer, id, patch).catch(() => null);
  if (!saved) return { ok: false, error: "That post no longer exists." };
  return { ok: true, value: toView(saved) };
}

export async function archiveSocialPostAction(id: string): Promise<StudioResult> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  return (await archiveSocialPost(viewer, id)) ? { ok: true } : { ok: false, error: "That post no longer exists." };
}

type TargetRef = { connectionId: string; kind: "page" | "instagram" | "threads" | "iglogin"; pageId: string | null };
function parseTarget(id: string): TargetRef | null {
  const [connectionId, kind, pageId] = id.split(":");
  if (!/^[A-Za-z0-9_-]{21}$/.test(connectionId ?? "")) return null;
  if (kind !== "page" && kind !== "instagram" && kind !== "threads" && kind !== "iglogin") return null;
  if ((kind === "page" || kind === "instagram") && !pageId) return null;
  return { connectionId, kind, pageId: pageId ?? null };
}

/** Escape for the figures appended to the mirrored thread's body. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function mirrorToThread(userId: string, post: SocialPost): Promise<void> {
  const existing = await db<{ id: string }[]>`
    SELECT id FROM threads WHERE metadata->>'socialPostId' = ${post.id} AND status <> 'archived' LIMIT 1
  `;
  if (existing[0]) return;
  const targets = await listPostTargets(userId, { blogOrgId: BLOG_ORG_ID });
  const feed = post.orgId !== BLOG_ORG_ID ? targets.find((t) => t.kind === "feed" && t.orgId === post.orgId) : undefined;
  const target = feed?.value ?? "blog";
  const text = post.body.trim() || post.title.trim() || "A picture";
  const title = (post.title.trim() || text.split("\n")[0]!.slice(0, 80)).slice(0, 200);
  const result = await createPostAnywhere(userId, {
    target,
    title,
    text: post.link ? `${text}\n\n${post.link}` : text,
    blogOrgId: BLOG_ORG_ID,
  });
  if (result.ok === false) {
    console.warn("[posts] mirror:", result.error);
    return;
  }
  const figures = post.images.map((i) => `<figure><img src="${esc(i.url)}" alt="${esc(i.alt ?? "")}"></figure>`).join("");
  const cover = post.images[0]?.url ?? null;
  // Merge, never assign: the writer above put its own keys in metadata.
  await db`
    UPDATE threads SET
      metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ socialPostId: post.id, ...(cover ? { coverImageUrl: cover } : {}) } as Parameters<typeof db.json>[0])},
      body = COALESCE(body, '') || ${figures}
    WHERE id = ${result.threadId}
  `;
}

const absolute = (url: string) => (url.startsWith("/") ? `${ORIGIN}${url}` : url);
const isJpeg = (url: string) => /\.jpe?g($|\?)/i.test(url);

export async function publishSocialPost(postId: string, targetId: string): Promise<StudioResult<StudioShare>> {
  const viewer = await viewerId();
  if (!viewer) return { ok: false, error: "Sign in required." };
  const ref = parseTarget(targetId);
  if (!ref) return { ok: false, error: "Unknown target." };
  const post = await getSocialPost(viewer, postId);
  if (!post) return { ok: false, error: "That post no longer exists." };
  const connection = (await listConnections(viewer)).find((c) => c.id === ref.connectionId);
  if (!connection || connection.status !== "connected") return { ok: false, error: "That account is not connected." };

  const platform = ref.kind === "page" ? "facebook" : ref.kind === "threads" ? "threads" : "instagram";
  const text = (post.variants[platform]?.text?.trim() ? post.variants[platform]!.text! : post.body).trim();
  const images = post.images.map((i) => absolute(i.url));
  if (!text && images.length === 0) return { ok: false, error: "Write something or add a picture first." };
  if (text.length > LIMITS[platform]) return { ok: false, error: `${platform} takes ${LIMITS[platform]} characters.` };
  const appSecret = process.env.META_APP_SECRET;
  const at = new Date().toISOString();

  // Filed under an org: only to that org's own channel, through this member's
  // own connection (org_channels, 2026-11-01). No token changes hands.
  if (post.orgId !== BLOG_ORG_ID) {
    const external =
      ref.kind === "page" || ref.kind === "instagram" ? ref.pageId! : connection.accountId ?? "";
    const provider = ref.kind === "page" || ref.kind === "instagram" ? "meta" : ref.kind === "iglogin" ? "instagram" : "threads";
    if (!(await isOrgChannel(post.orgId, provider, external))) {
      return { ok: false, error: "This post is filed under an organisation, and that account is not one of its channels. An owner or guide sets channels under Connections; or file the post under Just me." };
    }
  }
  const jobId = await startPublishJob({
    requestedBy: viewer,
    orgId: post.orgId === BLOG_ORG_ID ? null : post.orgId,
    sourceKind: "social_post",
    sourceId: postId,
    provider: ref.kind === "threads" ? "threads" : ref.kind === "iglogin" ? "instagram" : "meta",
    targetId,
    targetLabel: "",
  });

  let share: StudioShare;
  try {
    if (ref.kind === "page") {
      const t = await getMetaPageTarget(ref.connectionId, ref.pageId!);
      if (t.ok === false) return { ok: false, error: t.error };
      const r = await postToPage({ pageId: t.pageId, accessToken: t.accessToken }, { message: text, link: post.link, imageUrls: images }, appSecret);
      share = { targetId, kind: "page", label: `${t.name} (Facebook Page)`, url: r.url, at };
    } else if (ref.kind === "instagram" || ref.kind === "iglogin") {
      if (images.length === 0) return { ok: false, error: "Instagram needs a picture." };
      if (!isJpeg(images[0]!)) return { ok: false, error: "Instagram takes JPEG pictures only; make the first picture a JPEG." };
      const caption = post.link ? `${text}\n\n${post.link}` : text;
      if (ref.kind === "instagram") {
        const t = await getMetaPageTarget(ref.connectionId, ref.pageId!);
        if (t.ok === false) return { ok: false, error: t.error };
        if (!t.instagramUserId) return { ok: false, error: "No Instagram account is linked to that Page." };
        const r = await postImageToInstagram({ pageId: t.pageId, accessToken: t.accessToken, instagramUserId: t.instagramUserId }, { imageUrl: images[0]!, caption }, appSecret);
        share = { targetId, kind: "instagram", label: "Instagram", url: r.url, at };
      } else {
        const t = await getInstagramLoginTarget(ref.connectionId);
        if (t.ok === false) return { ok: false, error: t.error };
        const r = await postImageWithInstagramLogin(t.userId, t.accessToken, { imageUrl: images[0]!, caption });
        share = { targetId, kind: "instagram", label: `${connection.accountName ?? "Instagram"} (Instagram)`, url: r.url || null, at };
      }
    } else {
      const t = await getThreadsTarget(ref.connectionId);
      if (t.ok === false) return { ok: false, error: t.error };
      const r = await postToThreads(t.userId, t.accessToken, {
        text: images.length === 0 && post.link ? `${text}\n\n${post.link}`.slice(0, LIMITS.threads) : text,
        imageUrl: images[0],
        linkAttachment: images.length === 0 && post.link ? post.link : undefined,
      });
      share = { targetId, kind: "threads", label: `${connection.accountName ?? "Threads"} (Threads)`, url: r.url || null, at };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await finishPublishJob(jobId, { ok: false, error });
    return { ok: false, error };
  }
  await finishPublishJob(jobId, { ok: true, externalId: null, url: share.url });
  await recordSocialShare(viewer, postId, share);
  // On the network too; a failure here is logged, the outside post stands.
  await mirrorToThread(viewer, post).catch((err) => console.error("[posts] mirror:", err));
  return { ok: true, value: share };
}
