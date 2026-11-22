"use server";
// Feed writes (design screen 39 and the office queue). Reads live in lib/feed.ts: a "use server" file
// exposes every export as a public endpoint, so only the two actions are here.

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { createThread, reviewThread, statusForNewThread } from "@elkdonis/services";
import { unfurl, assertPublicUrl } from "@elkdonis/utils/unfurl";
import { getViewer, requireOrgEditor } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings";
import { FEED_SECTION, type FeedLink } from "@/lib/feed";
import { siteConfig } from "@/config/site";
import type { Result } from "@/lib/catalogue-types";

const ORG = siteConfig.orgId;
type Row = Record<string, unknown>;

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

/**
 * Guides (and owners) share a post or a link. A guide's post is 'pending' until the office confirms;
 * an owner's publishes at once. Followers and members cannot post here.
 */
export async function submitFeedPostAction(input: { title: string; body: string; link?: string | null }): Promise<Result<{ id: string; status: "pending" | "published" }>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to share a post." };
  if (!viewer.canEdit) return { ok: false, error: "Only guides and the office can share to the feed." };
  const title = (input.title ?? "").trim().replace(/\s+/g, " ");
  const body = (input.body ?? "").trim();
  if (title.length < 2) return { ok: false, error: "Give it a title." };
  if (title.length > 200) return { ok: false, error: "That title is too long." };
  if (!body) return { ok: false, error: "Write something first." };

  let link: FeedLink | null = null;
  const rawUrl = (input.link ?? "").trim();
  if (rawUrl) {
    if (!rawUrl.includes(".")) return { ok: false, error: "That does not look like a web address." };
    try {
      await assertPublicUrl(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "That link cannot be used." };
    }
    const full = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    const card = await unfurl(full, { userAgent: LINK_UA });
    link = { url: card.url, host: hostOf(card.url), title: card.title, description: card.description, imageUrl: card.imageUrl, siteName: card.siteName };
  }

  const hold = (await getSiteSettings()).holdGuidePosts;
  const status = await statusForNewThread(viewer.userId, ORG, "published", hold ? { holdRoles: ["guide"] } : undefined);
  const paragraphs = body.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`).join("");
  const thread = await createThread({
    kind: "post",
    title,
    orgId: ORG,
    authorId: viewer.userId,
    body: paragraphs,
    status: status === "draft" ? "draft" : status,
    visibility: "PUBLIC",
    section: FEED_SECTION,
    metadata: link ? { link } : {},
  });
  revalidatePath("/feed");
  return { ok: true, id: thread.id, status: status === "pending" ? "pending" : "published" };
}

const LINK_UA = "ElkdonisExperiencesLinkPreview/1.0";

/** The office clears the queue: owners only. */
export async function reviewFeedPostAction(id: string, decision: "approve" | "decline"): Promise<Result<{ status: string }>> {
  const editor = await requireOrgEditor("/manage");
  if (editor.role !== "owner") return { ok: false, error: "Only the office confirms posts." };
  const [t] = (await db`SELECT id FROM threads WHERE id = ${id} AND org_id = ${ORG} AND section = ${FEED_SECTION} AND kind = 'post'`) as unknown as Row[];
  if (!t) return { ok: false, error: "No such post." };
  const res = await reviewThread(editor.userId, id, decision === "approve" ? "approve" : "reject", { approverRoles: ["owner"] });
  if (res.ok === false) return { ok: false, error: res.error };
  revalidatePath("/feed");
  return { ok: true, status: res.status };
}

