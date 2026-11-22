// The Sites list: every organisation with pages or a draft, the development org always. No gate and no session in this
// file, so a check can run it on a transaction; the gated door is `listSites` in ./sites.ts.
import type { db } from "@elkdonis/db";
import { listDrafts, listPages } from "@elkdonis/page-builder/server";
import { DEV_ORG } from "./sites-pages-core";

export interface SitePageRow {
  slug: string;
  title: string;
  href: string;
  /** ISO time of the last change to the published page. */
  changedAt: string | null;
  draftWaiting: boolean;
}

export interface SiteRow {
  id: string;
  slug: string;
  name: string;
  pages: SitePageRow[];
  /** Drafts of pages that are not published yet. */
  newDrafts: string[];
}

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Every organisation that has built pages (or has a draft waiting), with its pages. The development organisation
 * is always listed, even with no page at all: it is where this app builds.
 * `sql` is the database, or a transaction (a check runs this inside one).
 */
export async function listSitesFrom(sql: typeof db): Promise<SiteRow[]> {
  const orgs = await sql<Array<{ id: string; slug: string; name: string }>>`
    SELECT o.id, o.slug, o.name FROM organizations o
    WHERE o.id = ${DEV_ORG}
       OR EXISTS (SELECT 1 FROM site_config c WHERE c.org_id = o.id AND (c.key LIKE 'puck:%' OR c.key LIKE 'puck-draft:%'))
    ORDER BY (o.id = ${DEV_ORG}) DESC, lower(o.name)
  `;
  const out: SiteRow[] = [];
  for (const o of orgs) {
    const [pages, drafts, titles] = await Promise.all([
      listPages(o.id),
      listDrafts(o.id, { tx: sql }),
      sql<Array<{ slug: string; title: string | null }>>`
        SELECT substr(key, 6) AS slug, value->'root'->'props'->>'title' AS title FROM site_config
        WHERE org_id = ${o.id} AND key LIKE 'puck:%'
      `,
    ]);
    const titleOf = new Map(titles.map((t) => [t.slug, t.title?.trim() || ""]));
    const waiting = new Set(drafts.map((d) => d.slug));
    const live = new Set(pages.map((p) => p.slug));
    out.push({
      id: o.id,
      slug: o.slug,
      name: o.name,
      pages: pages
        .map((p) => ({
          slug: p.slug,
          title: titleOf.get(p.slug) || p.slug.split("/").pop()!.replace(/-/g, " "),
          href: p.slug === "home" ? "/" : `/${p.slug}`,
          changedAt: iso(p.updatedAt),
          draftWaiting: waiting.has(p.slug),
        }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
      newDrafts: [...waiting].filter((s) => !live.has(s)).sort(),
    });
  }
  return out;
}

