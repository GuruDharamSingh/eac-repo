"use server";

import { db } from "@elkdonis/db";
import {
  canEditProfile,
  getProfile,
  getWritingPostById,
  getMetaPageTarget,
  getThreadsTarget,
  getInstagramLoginTarget,
  listConnections,
  startPublishJob,
  finishPublishJob,
} from "@elkdonis/services";
import { postImageToInstagram, postLinkToPage, postToThreads } from "@elkdonis/meta";
import { postImageWithInstagramLogin } from "@elkdonis/meta/instagram-login";
import type { StudioResult, StudioShare, StudioShareTarget } from "@elkdonis/studio";
import { getCurrentUser } from "@/lib/session";

/**
 * Studio "Post to": publish a piece to the person's own Facebook Page,
 * Instagram account or Threads profile (connections.ts providers meta and
 * threads, 2026-10-29). The author (or a global admin) may post; the targets
 * are the acting user's own connections, so nobody posts through another
 * person's account. Each post is appended to threads.metadata.shares.
 *
 * Meta fetches images from its own servers: the cover must be a public URL
 * (no Private/ segment) and, for Instagram, a JPEG.
 */

const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");

type TargetRef = { connectionId: string; kind: StudioShareTarget["kind"] | "iglogin"; pageId: string | null };

function parseTarget(id: string): TargetRef | null {
  const [connectionId, kind, pageId] = id.split(":");
  if (!/^[A-Za-z0-9_-]{21}$/.test(connectionId ?? "")) return null;
  if (kind !== "page" && kind !== "instagram" && kind !== "threads" && kind !== "iglogin") return null;
  if ((kind === "page" || kind === "instagram") && !pageId) return null;
  return { connectionId, kind, pageId: pageId ?? null };
}

export async function listShareTargets(): Promise<StudioShareTarget[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const out: StudioShareTarget[] = [];
  for (const c of await listConnections(user.id)) {
    if (c.status !== "connected") continue;
    if (c.provider === "meta") {
      if (c.targets.length === 0) {
        // Shown so the person learns the connection exists but carries no Page; never postable.
        out.push({ id: `${c.id}:none`, kind: "page", label: `${c.accountName ?? "Facebook"} (no Page chosen)`, disabledReason: "Reconnect and tick a Page in the Facebook dialog." });
      }
      for (const t of c.targets) {
        out.push({
          id: `${c.id}:page:${t.id}`,
          kind: "page",
          label: `${t.name} (Facebook Page)`,
          disabledReason: t.canPublish ? null : "Your role on this Page cannot post.",
        });
        if (t.instagramUserId) {
          out.push({
            id: `${c.id}:instagram:${t.id}`,
            kind: "instagram",
            label: `@${t.instagramUsername ?? t.instagramUserId} (Instagram)`,
            disabledReason: t.canPublish ? null : "Your role on this Page cannot post.",
          });
        }
      }
    } else if (c.provider === "instagram") {
      out.push({ id: `${c.id}:iglogin`, kind: "instagram", label: `${c.accountName ?? "Instagram"} (Instagram)` });
    } else if (c.provider === "threads") {
      out.push({ id: `${c.id}:threads`, kind: "threads", label: `${c.accountName ?? "Threads"} (Threads)` });
    }
  }
  return out;
}

export async function sharePiece(postId: string, targetId: string): Promise<StudioResult<StudioShare>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in required." };
  const ref = parseTarget(targetId);
  if (!ref) return { ok: false, error: "Unknown target." };
  const post = await getWritingPostById(postId);
  if (!post) return { ok: false, error: "That piece no longer exists." };
  if (!(await canEditProfile(user.id, post.authorId))) return { ok: false, error: "Not authorized." };
  if (post.status !== "published") return { ok: false, error: "Publish the piece first." };

  // The connection must be the acting user's own.
  const connection = (await listConnections(user.id)).find((c) => c.id === ref.connectionId);
  if (!connection || connection.status !== "connected") return { ok: false, error: "That account is not connected." };

  const profile = await getProfile(post.authorId).catch(() => null);
  const link = profile?.slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${profile.slug}/writing/${post.slug}` : null;
  const imageUrl = post.seo?.imageUrl || post.coverImageUrl || null;
  const text = [post.title, post.lede].filter(Boolean).join("\n\n");
  const appSecret = process.env.META_APP_SECRET;
  // The ledger row (publish_jobs, 2026-11-01): who sent what where, and what came back.
  const jobId = await startPublishJob({
    requestedBy: user.id,
    orgId: post.orgId === "oad" ? null : post.orgId,
    sourceKind: "thread",
    sourceId: postId,
    provider: ref.kind === "threads" ? "threads" : ref.kind === "iglogin" ? "instagram" : "meta",
    targetId,
    targetLabel: "",
  });

  let share: StudioShare;
  try {
    if (ref.kind === "page") {
      if (!link) return { ok: false, error: "The piece has no public address yet (no directory slug)." };
      const t = await getMetaPageTarget(ref.connectionId, ref.pageId!);
      if (t.ok === false) return { ok: false, error: t.error };
      const r = await postLinkToPage({ pageId: t.pageId, accessToken: t.accessToken }, { message: text, link }, appSecret);
      share = { targetId, kind: "page", label: `${t.name} (Facebook Page)`, url: r.url, at: new Date().toISOString() };
    } else if (ref.kind === "instagram") {
      if (!imageUrl) return { ok: false, error: "Instagram needs a cover image (a public JPEG)." };
      const t = await getMetaPageTarget(ref.connectionId, ref.pageId!);
      if (t.ok === false) return { ok: false, error: t.error };
      if (!t.instagramUserId) return { ok: false, error: "No Instagram account is linked to that Page." };
      const caption = link ? `${text}\n\n${link}` : text;
      const r = await postImageToInstagram(
        { pageId: t.pageId, accessToken: t.accessToken, instagramUserId: t.instagramUserId },
        { imageUrl, caption },
        appSecret
      );
      share = { targetId, kind: "instagram", label: "Instagram", url: r.url, at: new Date().toISOString() };
    } else if (ref.kind === "iglogin") {
      if (!imageUrl) return { ok: false, error: "Instagram needs a cover image (a public JPEG)." };
      const t = await getInstagramLoginTarget(ref.connectionId);
      if (t.ok === false) return { ok: false, error: t.error };
      const r = await postImageWithInstagramLogin(t.userId, t.accessToken, { imageUrl, caption: link ? `${text}\n\n${link}` : text });
      share = { targetId, kind: "instagram", label: `${connection.accountName ?? "Instagram"} (Instagram)`, url: r.url || null, at: new Date().toISOString() };
    } else {
      const t = await getThreadsTarget(ref.connectionId);
      if (t.ok === false) return { ok: false, error: t.error };
      const r = await postToThreads(t.userId, t.accessToken, {
        text: link ? `${text}\n\n${link}` : text,
        imageUrl: imageUrl ?? undefined,
        linkAttachment: !imageUrl && link ? link : undefined,
      });
      share = { targetId, kind: "threads", label: `${connection.accountName ?? "Threads"} (Threads)`, url: r.url || null, at: new Date().toISOString() };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await finishPublishJob(jobId, { ok: false, error });
    return { ok: false, error };
  }
  await finishPublishJob(jobId, { ok: true, externalId: null, url: share.url });

  // Append, never assign: other features keep their own keys in metadata.
  await db`
    UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb)
      || jsonb_build_object('shares', COALESCE(metadata->'shares', '[]'::jsonb) || ${db.json([{ ...share }] as unknown as Parameters<typeof db.json>[0])})
    WHERE id = ${postId}
  `;
  return { ok: true, value: share };
}

/** The shares recorded on a piece, for the Studio's settings panel. */
export async function listPieceShares(postId: string): Promise<StudioShare[]> {
  const rows = await db<{ shares: StudioShare[] | null }[]>`
    SELECT metadata->'shares' AS shares FROM threads WHERE id = ${postId}
  `;
  return Array.isArray(rows[0]?.shares) ? rows[0]!.shares : [];
}
