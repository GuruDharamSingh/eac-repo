import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * Where a thread lives now, given the id an old URL carried.
 *
 * apps/inner-gathering addressed content by id — /meetings/<id>, /posts/<id>,
 * /workshops/<id> — while this app addresses it by feed and slug. The ids did
 * not change (same rows, same database), so the old links are all resolvable;
 * they just need one lookup to answer.
 *
 * Scoped to this org: an id from another org's site is not ours to redirect to,
 * and pretending otherwise would send a visitor to a 404 on a page that does
 * exist somewhere else.
 */
export async function threadPathById(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const [row] = await db<{ section: string | null; slug: string }[]>`
      SELECT section, slug
      FROM threads
      WHERE id = ${id} AND org_id = ${siteConfig.orgId}
      LIMIT 1
    `;
    if (!row?.slug) return null;
    // Matches how the rest of the app builds thread links.
    return `/${row.section ?? "offerings"}/${row.slug}`;
  } catch (err) {
    console.error("[innergathering] legacy threadPathById:", err);
    return null;
  }
}

/**
 * Where a person's page lives now, given the user id an old URL carried.
 *
 * The old site addressed people by user id (/profile/<userId>); this one uses
 * the profile slug, which is the same shape the rest of the network settled on
 * in the profile unification. Only public profiles resolve — a private one
 * redirecting to a page that then refuses to load is worse than a 404.
 */
export async function profilePathByUserId(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    const [row] = await db<{ slug: string | null }[]>`
      SELECT u.slug
      FROM org_profiles op
      JOIN users u ON u.id = op.user_id
      WHERE op.user_id = ${userId} AND op.org_id = ${siteConfig.orgId} AND op.is_public
      LIMIT 1
    `;
    return row?.slug ? `/about/${row.slug}` : null;
  } catch (err) {
    console.error("[innergathering] legacy profilePathByUserId:", err);
    return null;
  }
}
