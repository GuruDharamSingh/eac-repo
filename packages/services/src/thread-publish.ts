import { db } from '@elkdonis/db';
import { davGetText, davMkcol, davPut } from './dav';

// ============================================================================
// Publishing a thread as a static artifact.
//
// `published_at` says someone decided a piece was ready; it produces nothing.
// This produces the thing. At publish the article is rendered once and written
// to Nextcloud, and from then on that file is what a reader gets — the same
// model Silex has used on this platform since June
// (`organizations.silex_published_path` + packages/silex-render).
//
// Three things follow from it, and they are the reason to bother:
//
//   * Reading stops touching the database.
//   * What was published is FIXED. Editing the thread afterwards does not
//     silently rewrite what a reader is looking at; republishing is a
//     deliberate act, and `static_published_at` says when it last happened.
//   * The artifact is a file. It can be backed up, mirrored, or handed to
//     someone whose site this platform no longer runs.
//
// The artifact lives at the NETWORK level, not inside an org's tree:
//
//     EAC_Network/_published/<org>/<slug>/index.html
//
// A piece cross-posted through `thread_orgs` belongs to several orgs and none
// of their folders is the right home for it. The network is the publisher of
// record; custody stays in the rows (threads.author_id + thread_orgs), not in
// which directory holds the bytes.
//
// This module writes and reads the artifact. It does not render it — rendering
// is the caller's, because the HTML comes from the app's own template layer
// (@elkdonis/cms-bindings for a bound template, or ArticleView's markup), and
// a service that rendered would have to know about both.
// ============================================================================

const ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || 'EAC_Network';
const PUBLISHED = '_published';

export interface PublishedArtifact {
  /** Storage-relative path to the file. */
  path: string;
  publishedAt: string;
}

/** Where a thread's artifact goes. One slug per org, so a rename republishes. */
export function artifactPath(orgId: string, slug: string): string {
  const safeOrg = orgId.replace(/[^a-zA-Z0-9._-]/g, '-');
  const safeSlug = slug.replace(/[^a-zA-Z0-9._-]/g, '-');
  return `${ROOT}/${PUBLISHED}/${safeOrg}/${safeSlug}/index.html`;
}

/**
 * Write the rendered HTML and record it on the thread.
 *
 * `html` must already be sanitized. This deliberately does not sanitize: the
 * allowlist lives in @elkdonis/utils and belongs to whoever assembled the
 * document, and a function that quietly cleaned its input would make it easy
 * to forget on a path that assembles HTML some other way.
 */
export async function publishThreadStatic(
  threadId: string,
  html: string
): Promise<PublishedArtifact | null> {
  try {
    const [thread] = await db<
      Array<{ org_id: string; slug: string | null; status: string }>
    >`
      SELECT org_id, slug, status FROM threads WHERE id = ${threadId}
    `;
    if (!thread?.slug) return null;

    // Publishing a draft would put a file on disk that the thread's own status
    // says nobody should be reading.
    if (thread.status !== 'published') {
      console.error(`[thread-publish] ${threadId} is ${thread.status}, not published`);
      return null;
    }

    const path = artifactPath(thread.org_id, thread.slug);

    // MKCOL is not recursive, so each level has to exist before the next.
    const dirs = path.split('/').slice(0, -1);
    for (let i = 1; i <= dirs.length; i += 1) {
      await davMkcol(dirs.slice(0, i).join('/'));
    }

    const ok = await davPut(path, new TextEncoder().encode(html), 'text/html; charset=utf-8');
    if (!ok) {
      console.error(`[thread-publish] PUT failed for ${path}`);
      return null;
    }

    const now = new Date();
    await db`
      UPDATE threads
      SET static_path = ${path}, static_published_at = ${now}
      WHERE id = ${threadId}
    `;

    return { path, publishedAt: now.toISOString() };
  } catch (err) {
    console.error(`[thread-publish] publish(${threadId}):`, err);
    return null;
  }
}

/**
 * The published artifact, if there is one and it is not stale.
 *
 * Stale means the thread has been edited since it was last published. The
 * artifact is still returned — what was published is what a reader should see
 * until someone republishes — but `stale` lets a hub show "edited since you
 * published this" rather than leaving an author guessing.
 */
export async function getPublishedArtifact(
  threadId: string
): Promise<(PublishedArtifact & { stale: boolean }) | null> {
  try {
    const [row] = await db<
      Array<{
        static_path: string | null;
        static_published_at: Date | null;
        updated_at: Date | null;
      }>
    >`
      SELECT static_path, static_published_at, updated_at
      FROM threads WHERE id = ${threadId}
    `;
    if (!row?.static_path || !row.static_published_at) return null;

    return {
      path: row.static_path,
      publishedAt: row.static_published_at.toISOString(),
      stale: Boolean(
        row.updated_at && row.updated_at.getTime() > row.static_published_at.getTime() + 1000
      ),
    };
  } catch (err) {
    console.error(`[thread-publish] get(${threadId}):`, err);
    return null;
  }
}

/**
 * Read a published artifact back.
 *
 * Null when there is none, which is the signal to fall back to rendering from
 * the database — so nothing breaks before anything has been published, and no
 * backfill is needed.
 */
export async function readPublishedArtifact(threadId: string): Promise<string | null> {
  const artifact = await getPublishedArtifact(threadId);
  if (!artifact) return null;
  return davGetText(artifact.path);
}

/**
 * Threads whose artifact is behind the thread. What a hub lists under
 * "published, then edited" so an author can see what is out of date.
 */
export async function listStaleArtifacts(
  orgId: string,
  limit = 50
): Promise<Array<{ id: string; title: string; slug: string; publishedAt: string }>> {
  try {
    const rows = await db<
      Array<{ id: string; title: string; slug: string; static_published_at: Date }>
    >`
      SELECT id, title, slug, static_published_at
      FROM threads
      WHERE org_id = ${orgId}
        AND static_path IS NOT NULL
        AND updated_at > static_published_at + INTERVAL '1 second'
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      publishedAt: r.static_published_at.toISOString(),
    }));
  } catch (err) {
    console.error(`[thread-publish] listStale(${orgId}):`, err);
    return [];
  }
}
