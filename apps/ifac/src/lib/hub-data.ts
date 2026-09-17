import { db } from "@elkdonis/db";
import { countUserGalleries } from "@elkdonis/services";
import { getOrgFolderPath } from "@elkdonis/nextcloud";
import { siteConfig } from "@/config/site";

/**
 * Reads behind the hub tiles.
 *
 * The design constraint the hub is built around: every tile shows real
 * information on first paint, and the modal behind it is where the detail and
 * the write actions live. So each function here is deliberately narrow and
 * cheap — a card query returns the three or four fields a tile draws, never a
 * whole record set the modal might later want. The modal fetches its own data
 * on open, through the /api/hub/* routes.
 *
 * Every read is fail-soft (try/catch → empty), matching the rest of
 * apps/ifac/src/lib/data.ts. A hub tile that throws takes the whole page down;
 * one that renders empty is legible and recoverable.
 */

const ORG = siteConfig.orgId;

/**
 * Events, the weekly meeting and the calendar query used to be defined here —
 * `HubEvent`, `EVENT_COLUMNS`, `mapEvent`, `getWeeklyMeeting` and
 * `getEventsInRange`. All five were this app's own second implementation of
 * things the rest of the network already shared: `listOrgEventsInRange` and
 * `OrgCalendarEvent` in @elkdonis/services (a superset of `HubEvent`), and
 * `getStandingMeeting` for "the weekly meeting" — which resolves an editor's
 * flag before guessing from a section name, and reports which it used.
 *
 * The hub page and api/hub/calendar now read those directly.
 */

/**
 * Ideas and living documents used to be defined here — `listIdeas`,
 * `listLivingDocuments` and their types. They were the only real
 * implementations in the repo, so they were lifted into
 * `@elkdonis/services` (org-ideas.ts, org-documents.ts) where the two
 * template apps can use them too, and the hub page imports them from there.
 */

/**
 * The org's storage root.
 *
 * Derived, never read from `organizations.nextcloud_folder_path` — that column
 * is empty for ifac (the org was seeded by migrations 041/053, which predate
 * it, and only the admin app's setup-folders route ever backfills it) while
 * the folder itself demonstrably exists on Nextcloud. Deriving is correct for
 * every org; reading would make ifac a special case.
 */
export function orgStorageRoot(): string {
  return getOrgFolderPath(ORG);
}

export type ProfileSummary = {
  slug: string | null;
  displayName: string;
  avatarUrl: string | null;
  headline: string | null;
  roleTitle: string | null;
  bioLength: number;
  galleryCount: number;
  galleriesCount: number;
  /**
   * Which directory this person is listed in, so a link to their page goes to
   * the right one. The hub used to hardcode /artists/<slug>, which is a 404
   * for every dealer on the site.
   */
  kind: "artist" | "dealer";
};

/**
 * The signed-in member's identity and page stats, as the "Page sections"
 * tile shows them.
 *
 * Unread messages and upcoming RSVPs used to be a second copy of this exact
 * query, kept here alongside it — the same two subqueries `getViewerAlerts`
 * in @elkdonis/services already runs (that one also counts notifications,
 * which this one never did). The hub page now calls `getViewerAlerts`
 * directly for the shared identity face; this function is left with only the
 * facts that are genuinely this app's own: the ArtDirect-style portfolio and
 * gallery counts nothing else in the network has a column for.
 */
export async function getProfileSummary(
  userId: string
): Promise<ProfileSummary | null> {
  try {
    const [row] = await db<
      Array<{
        slug: string | null;
        display_name: string | null;
        avatar_url: string | null;
        headline: string | null;
        bio: string | null;
        portfolio: unknown;
        role_title: string | null;
        tags: string[] | null;
      }>
    >`
      SELECT u.slug, u.display_name, u.avatar_url, u.headline, u.bio,
             u.portfolio, op.role_title, op.tags
      FROM users u
      LEFT JOIN org_profiles op
        ON op.user_id = u.id AND op.org_id = ${ORG}
      WHERE u.id = ${userId}
    `;
    if (!row) return null;

    const portfolio = Array.isArray(row.portfolio) ? row.portfolio : [];
    return {
      slug: row.slug,
      displayName: row.display_name || "Your profile",
      avatarUrl: row.avatar_url,
      headline: row.headline,
      roleTitle: row.role_title,
      bioLength: (row.bio ?? "").trim().length,
      galleryCount: portfolio.length,
      galleriesCount: await countUserGalleries(userId),
      kind: (row.tags ?? []).includes("dealer") ? "dealer" : "artist",
    };
  } catch (error) {
    console.error("[ifac] getProfileSummary error:", error);
    return null;
  }
}
