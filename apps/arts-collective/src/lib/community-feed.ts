import { db } from "@elkdonis/db";

export type CommunityFeedItem = {
  id: string;
  title: string;
  kind: string;
  excerpt: string | null;
  orgSlug: string;
  orgName: string;
  publishedAt: string | null;
  scheduledAt: string | null;
};

export async function getCommunityFeed(
  limit: number = 12
): Promise<CommunityFeedItem[]> {
  try {
    const rows = await db<
      {
        id: string;
        title: string;
        kind: string;
        excerpt: string | null;
        org_slug: string;
        org_name: string;
        published_at: string | null;
        scheduled_at: string | null;
      }[]
    >`
      SELECT t.id, t.title, t.kind, t.excerpt,
             o.slug AS org_slug, o.name AS org_name,
             t.published_at, t.scheduled_at
      FROM threads t
      JOIN organizations o ON o.id = t.org_id
      WHERE t.status = 'published'
        AND t.visibility = 'PUBLIC'
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      excerpt: r.excerpt,
      orgSlug: r.org_slug,
      orgName: r.org_name,
      publishedAt: r.published_at,
      scheduledAt: r.scheduled_at,
    }));
  } catch {
    return [];
  }
}
