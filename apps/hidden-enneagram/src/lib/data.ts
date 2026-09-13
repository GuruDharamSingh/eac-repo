import { db } from "@elkdonis/db";
import {
  listOrgProfiles,
  getOrgProfileBySlug,
  resolveTerms,
  type OrgProfile,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type { Guide, SiteSections, Thread } from "@/lib/types";

/**
 * Read layer for the public site.
 *
 * Two conventions carried from amrit-canada's equivalent:
 *
 *  - Every query is fail-soft: it logs and returns an empty result rather
 *    than throwing, so schema drift or a dead connection degrades one section
 *    of a page instead of 500-ing the site.
 *
 *  - Threads belong to a feed via `threads.section` = `org_feeds.slug`.
 *
 * What's different here is member gating. Reads take an `isMember` flag and
 * widen the visibility filter for members, so ORGANIZATION-visibility content
 * is genuinely unreachable to a signed-out visitor rather than merely
 * unlinked. Feed-level access (org_feeds.min_role) is enforced by the caller
 * via canViewFeed() before it ever asks for threads.
 */

const ORG = siteConfig.orgId;

// `body AS description` keeps the DB's naming out of components. Cover images
// ride in metadata — threads has no cover_image_url column (that lives on
// workshop_pages, which only services use here), and one nullable text field
// isn't worth a migration.
const THREAD_COLUMNS = db`
  t.id, t.title, t.slug, t.kind, t.section, t.status, t.visibility,
  t.body AS description, t.excerpt,
  COALESCE(t.metadata->>'coverImageUrl', wp.cover_image_url) AS cover_image_url,
  t.author_id, t.published_at, t.created_at, t.updated_at,
  u.display_name AS author_name,
  u.slug          AS author_slug,
  COALESCE(op.photo_override, u.avatar_url) AS author_photo
`;

// Author's global slug/avatar (users) plus this org's optional photo override
// (org_profiles) — see packages/services/src/profiles.ts. A guide need not be
// published here for their name/photo to show on a thread they authored.
const THREAD_JOINS = db`
  FROM threads t
  LEFT JOIN users u           ON u.id = t.author_id
  LEFT JOIN org_profiles op   ON op.user_id = t.author_id AND op.org_id = t.org_id
  LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
`;

interface ThreadRow {
  id: string;
  title: string;
  slug: string | null;
  kind: string;
  section: string | null;
  status: string;
  visibility: string;
  description: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  author_id: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  author_name: string | null;
  author_slug: string | null;
  author_photo: string | null;
}

function mapThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug ?? row.id,
    kind: row.kind,
    feedSlug: row.section,
    status: row.status,
    visibility: row.visibility,
    description: row.description,
    excerpt: row.excerpt,
    coverImageUrl: row.cover_image_url,
    authorId: row.author_id,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    authorPhoto: row.author_photo,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The visibility filter every public read shares.
 *
 * Members additionally see ORGANIZATION content. INVITE_ONLY is deliberately
 * excluded from both — it means "named people", which this site has no
 * mechanism for yet, so it stays invisible rather than leaking to all members.
 */
function visibilityFilter(isMember: boolean) {
  return isMember
    ? db`t.org_id = ${ORG} AND t.status = 'published' AND t.visibility IN ('PUBLIC', 'ORGANIZATION')`
    : db`t.org_id = ${ORG} AND t.status = 'published' AND t.visibility = 'PUBLIC'`;
}

export async function getThreadsForFeed(
  feedSlug: string,
  { isMember = false, limit = 50 }: { isMember?: boolean; limit?: number } = {}
): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${visibilityFilter(isMember)} AND t.section = ${feedSlug}
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error(`[hidden-enneagram] getThreadsForFeed(${feedSlug}):`, err);
    return [];
  }
}

/**
 * Fill in the definitions for any terms the body marks up.
 *
 * On the way OUT of the data layer rather than in each page: these two
 * getters are the only ways a single thread's body reaches a reader, so
 * putting it here means no render site has to remember it. Missing one just
 * means definitions silently stop showing.
 *
 * Server-side by necessity — the dictionary is the network wiki, which
 * requires a login, and this is what lets a public post carry a definition
 * out of it without exposing anything but the sentence.
 */
async function withTerms(thread: Thread | null): Promise<Thread | null> {
  if (!thread?.description?.includes("data-term")) return thread;
  try {
    const { html } = await resolveTerms(thread.description, "/wiki");
    return { ...thread, description: html };
  } catch (err) {
    // A dictionary that is down must not take the article with it.
    console.error("[hidden-enneagram] resolveTerms:", err);
    return thread;
  }
}

export async function getThreadBySlug(
  feedSlug: string,
  slug: string,
  { isMember = false }: { isMember?: boolean } = {}
): Promise<Thread | null> {
  try {
    const [row] = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${visibilityFilter(isMember)}
        AND t.section = ${feedSlug}
        AND (t.slug = ${slug} OR t.id = ${slug})
      LIMIT 1
    `;
    return row ? await withTerms(mapThread(row)) : null;
  } catch (err) {
    console.error(`[hidden-enneagram] getThreadBySlug(${feedSlug}/${slug}):`, err);
    return null;
  }
}

/** Any thread in this org by id, regardless of status — for editors. */
export async function getThreadById(id: string): Promise<Thread | null> {
  try {
    const [row] = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE t.org_id = ${ORG} AND t.id = ${id}
      LIMIT 1
    `;
    return row ? await withTerms(mapThread(row)) : null;
  } catch (err) {
    console.error(`[hidden-enneagram] getThreadById(${id}):`, err);
    return null;
  }
}

/** Everything in the org, published or not — the /manage dashboard list. */
export async function getAllThreadsForOrg(limit = 200): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE t.org_id = ${ORG}
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error("[hidden-enneagram] getAllThreadsForOrg:", err);
    return [];
  }
}

/** Latest published writing, for the landing page. */
export async function getRecentThreads(
  { isMember = false, limit = 3 }: { isMember?: boolean; limit?: number } = {}
): Promise<Thread[]> {
  try {
    const rows = await db<ThreadRow[]>`
      SELECT ${THREAD_COLUMNS} ${THREAD_JOINS}
      WHERE ${visibilityFilter(isMember)} AND t.kind = 'post'
      ORDER BY COALESCE(t.published_at, t.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map(mapThread);
  } catch (err) {
    console.error("[hidden-enneagram] getRecentThreads:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Guides / teachers
// ---------------------------------------------------------------------------


function mapGuide(op: OrgProfile): Guide {
  return {
    userId: op.userId,
    slug: op.slug ?? op.userId,
    displayName: op.displayName,
    roleTitle: op.roleTitle,
    bio: op.bio,
    photoUrl: op.avatarUrl,
    city: op.city,
    socialLinks: op.socialLinks as Guide["socialLinks"],
    sortOrder: op.sortOrder,
  };
}

/**
 * The public roster. is_public is opt-in (migration 073) because member
 * signup auto-creates an is_stub profile for everyone.
 */
export async function getGuides(): Promise<Guide[]> {
  const rows = await listOrgProfiles(ORG, { onlyPublic: true });
  return rows.map(mapGuide);
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const row = await getOrgProfileBySlug(ORG, slug);
  return row ? mapGuide(row) : null;
}

// ---------------------------------------------------------------------------
// Editable page copy
// ---------------------------------------------------------------------------

/**
 * Site copy from org_site_sections, following the IFAC precedent (migration
 * 041) and amrit-canada's use of it. Returns a plain map so a caller can read
 * `sections.about?.title` without a null dance per field.
 */
export async function getSiteSections(): Promise<SiteSections> {
  try {
    const rows = await db<{ section_key: string; content: unknown }[]>`
      SELECT section_key, content FROM org_site_sections WHERE org_id = ${ORG}
    `;
    const out: SiteSections = {};
    for (const row of rows) {
      if (row.content && typeof row.content === "object") {
        out[row.section_key] = row.content as Record<string, string>;
      }
    }
    return out;
  } catch (err) {
    console.error("[hidden-enneagram] getSiteSections:", err);
    return {};
  }
}
