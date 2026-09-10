"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import {
  getPublishedArtifact,
  publishThreadStatic,
  type PublishedArtifact,
} from "@elkdonis/services";
import { requireUser } from "@/lib/session";
import { canEditOrgSite } from "@/lib/org";
import { getThreadOrgs } from "@/lib/org";
import { renderArticleDocument, type ArticleContext } from "@/lib/cms/article-render";

export type PublishResult =
  | { ok: true; artifact: PublishedArtifact }
  | { ok: false; error: string };

const KIND_LABEL: Record<string, string> = {
  post: "Essay",
  meeting: "Gathering",
  event: "Event",
  service: "Offering",
};

/** ~230 wpm. Omitted below two minutes rather than rounded up to "1 min". */
function readingLabel(html: string): string | null {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const minutes = Math.round(words / 230);
  return minutes >= 2 ? `${minutes} min` : null;
}

function dateLabel(value: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Publish a post as a static artifact.
 *
 * This is what makes publication an event rather than a flag. `published_at`
 * records that someone decided; this produces the thing they decided about —
 * the post rendered once through the `article` template and written to
 * Nextcloud. From then on that file is what a reader gets.
 *
 * Rendering goes through the TEMPLATE, not through `ArticleView`, because a
 * template is a thing an org can edit in the Silex editor and a React
 * component is not. The two agree by construction — same `--read-*` tokens,
 * same measurements — so this changes who owns the appearance, not what it
 * looks like.
 *
 * Republishing is deliberate and idempotent: it overwrites the artifact and
 * re-stamps `static_published_at`. Nothing republishes on its own, which is
 * the point — editing a post should not silently rewrite what a reader is
 * looking at.
 */
export async function publishArticleAction(threadId: string): Promise<PublishResult> {
  const user = await requireUser();

  const [thread] = await db<
    Array<{
      id: string;
      org_id: string;
      org_name: string;
      slug: string | null;
      kind: string;
      title: string;
      body: string | null;
      excerpt: string | null;
      published_at: Date | null;
      status: string;
      metadata: Record<string, unknown> | null;
      author_name: string | null;
    }>
  >`
    SELECT t.id, t.org_id, o.name AS org_name, t.slug, t.kind, t.title, t.body,
           t.excerpt, t.published_at, t.status, t.metadata,
           u.display_name AS author_name
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.id = ${threadId}
  `;

  if (!thread) return { ok: false, error: "Not found" };

  // Publishing an artifact is publishing the org's site, so it is the org's
  // editors — not only the author, who owns the draft FILE but not the site.
  if (!(await canEditOrgSite(user.id, thread.org_id))) {
    return { ok: false, error: "Not authorized" };
  }

  if (thread.status !== "published") {
    return { ok: false, error: "Publish it first, then it can be built." };
  }
  if (!thread.slug) {
    return { ok: false, error: "This post has no address yet." };
  }

  const orgs = await getThreadOrgs(thread.id);
  const body = thread.body ?? "";
  const cover =
    typeof thread.metadata?.coverImageUrl === "string"
      ? thread.metadata.coverImageUrl
      : null;

  const ctx: ArticleContext = {
    kind_label: KIND_LABEL[thread.kind] ?? "Writing",
    org_name: thread.org_name,
    title: thread.title,
    excerpt: thread.excerpt,
    body_html: body,
    author_name: thread.author_name,
    published_at_label: dateLabel(thread.published_at),
    reading_time_label: readingLabel(body),
    cover_image_url: cover,
    // Custody, from the rows: the org that published it plus any that have
    // taken it on. Neither holds a copy; the claim is the record.
    published_on_label: orgs.length ? orgs.map((o) => o.name).join(" · ") : null,
    record_url: `/${thread.slug}`,
    more_items_html: null,
  };

  const html = renderArticleDocument(ctx);
  const artifact = await publishThreadStatic(thread.id, html);

  if (!artifact) {
    return { ok: false, error: "Could not write the published file. Storage may be unavailable." };
  }

  revalidatePath(`/sites/${thread.org_id}`);
  return { ok: true, artifact };
}

/** Where the artifact is and whether the post has been edited since. */
export async function getArticleArtifactAction(threadId: string) {
  await requireUser();
  return getPublishedArtifact(threadId);
}
