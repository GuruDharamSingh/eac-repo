import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/**
 * The group's people, for /artists.
 *
 * A member's profile is the NETWORK's profile — `users` plus `org_profiles`,
 * the same row ArtDirect and IFAC render — not a copy kept here. What this
 * file decides is only WHO belongs on this site's roster: membership of this
 * org, which is the one fact the network profile cannot answer.
 */

export interface MemberCard {
  userId: string;
  slug: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  role: string;
}

export async function listMembers(): Promise<MemberCard[]> {
  try {
    const rows = await db<
      Array<{
        id: string;
        slug: string | null;
        display_name: string | null;
        email: string | null;
        avatar_url: string | null;
        role_title: string | null;
        role: string;
      }>
    >`
      -- role_title, NOT headline: org_profiles has no such column, and a
      -- query naming one compiles in TypeScript and fails at RUNTIME, which
      -- the catch below then turns into a silently empty roster.
      SELECT u.id, u.slug, u.display_name, u.email, u.avatar_url,
             op.role_title, uo.role
      FROM user_organizations uo
      JOIN users u ON u.id = uo.user_id
      LEFT JOIN org_profiles op
        ON op.user_id = u.id AND op.org_id = ${siteConfig.orgId}
      WHERE uo.org_id = ${siteConfig.orgId}
        AND uo.role IN ('owner', 'guide', 'member')
        AND u.slug IS NOT NULL
        -- An account with no display name is almost always a signup that
        -- never finished; a roster of blank cards helps nobody.
        AND COALESCE(NULLIF(TRIM(u.display_name), ''), NULL) IS NOT NULL
      ORDER BY CASE uo.role WHEN 'owner' THEN 0 WHEN 'guide' THEN 1 ELSE 2 END,
               u.display_name
    `;
    return rows.map((r) => ({
      userId: r.id,
      slug: r.slug as string,
      displayName: r.display_name?.trim() || r.email || "Someone",
      headline: r.role_title,
      avatarUrl: r.avatar_url,
      role: r.role,
    }));
  } catch (error) {
    console.error("[innergathering] listMembers:", error);
    return [];
  }
}

/** Is this person on this site's roster? The gate for /artists/<slug>. */
export async function isMember(userId: string): Promise<boolean> {
  try {
    const [row] = await db<Array<{ role: string }>>`
      SELECT role FROM user_organizations
      WHERE user_id = ${userId} AND org_id = ${siteConfig.orgId}
    `;
    return Boolean(row && ["owner", "guide", "member"].includes(row.role));
  } catch {
    return false;
  }
}

/** Whether this person switched an optional section on, from their hub. */
export async function hasProfileSection(userId: string, key: string): Promise<boolean> {
  try {
    const [row] = await db<Array<{ on: boolean }>>`
      SELECT COALESCE((profile_sections->>${key})::boolean, false) AS on
      FROM users WHERE id = ${userId}
    `;
    return Boolean(row?.on);
  } catch (error) {
    // Fail soft: a page missing an optional section is fine, a page that 500s
    // because of one is not.
    console.error("[innergathering] hasProfileSection:", error);
    return false;
  }
}
