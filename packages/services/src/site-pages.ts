import { db } from "@elkdonis/db";

// ============================================================================
// The pages of a Puck site (`site_config` rows keyed `puck:<slug>`), for an
// editor's page list and the canvas page switcher. Pure read; no auth. The
// caller decides who may see it.
//
// A page's title is its root `title` prop, else the last part of its address
// with dashes as spaces. Optionally each page carries the gallery a user keeps
// for it (`user_galleries.page_path = slug`), for sites whose pages double as
// galleries.
// ============================================================================

export interface SitePage {
  /** Stored key without the `puck:` prefix, which is also its address. */
  slug: string;
  title: string;
  href: string;
  updatedAt: string;
  /** Present (possibly null) only when `galleriesOfUserId` was given. */
  gallery?: { id: string; title: string; itemCount: number } | null;
}

export async function listSitePages(orgId: string, opts: { galleriesOfUserId?: string } = {}): Promise<SitePage[]> {
  const owner = opts.galleriesOfUserId ?? null;
  const rows = await db<
    Array<{ slug: string; title: string | null; updated_at: string; g_id: string | null; g_title: string | null; g_n: number | null }>
  >`
    SELECT substr(c.key, 6) AS slug,
           c.value->'root'->'props'->>'title' AS title,
           c.updated_at,
           g.id AS g_id, g.title AS g_title, jsonb_array_length(g.items) AS g_n
    FROM site_config c
    LEFT JOIN user_galleries g
      ON ${owner}::text IS NOT NULL AND g.user_id = ${owner} AND g.page_path = substr(c.key, 6)
    WHERE c.org_id = ${orgId} AND c.key LIKE 'puck:%'
    ORDER BY substr(c.key, 6)
  `;
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title?.trim() || r.slug.split("/").pop()!.replace(/-/g, " "),
    href: r.slug === "home" ? "/" : `/${r.slug}`,
    updatedAt: String(r.updated_at),
    ...(opts.galleriesOfUserId ? { gallery: r.g_id ? { id: r.g_id, title: r.g_title ?? "", itemCount: Number(r.g_n) || 0 } : null } : {}),
  }));
}
