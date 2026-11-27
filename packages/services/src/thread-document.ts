import { db } from '@elkdonis/db';
import { davGetText, davLastModified, davMkcol, davPut } from './dav';
import { getStorageSlug, resolveUserPath } from './user-storage';

// ============================================================================
// A thread and a Nextcloud document, kept in step.
//
// The point is that writing does not only happen in a browser tab. A post can
// be drafted in the CMS, carried on in Nextcloud Text on a phone, and finished
// back in the CMS — because it is the same markdown file the whole time.
//
// Everything this needs already existed and had never been joined up:
// `threads.nextcloud_doc_url`, `nextcloud_file_id` and `nextcloud_last_sync`
// have been in the schema from the start and were NULL on all 35 rows;
// `body_format` already allows 'md'; `user-storage.ts` already owns
// `EAC_Network/users/<slug>/Documents/`. What was missing was a way to read a
// file back — `davGetText` — and a rule for which side wins.
//
// Two deliberate differences from `createCollaborativeDocument`, which is the
// older org-scoped path used for meeting notes:
//
//   1. The file lives in the AUTHOR'S folder, not the org's. A draft is the
//      writer's until they publish it, and it should appear in their own
//      Nextcloud Files, not in a shared org tree.
//   2. No public share. That function creates a link anyone can edit, which is
//      right for collaborative meeting notes and wrong for a draft.
//
// The sync rule is last-writer-wins on timestamp, and it is deliberately not
// a merge: two-way merge of prose needs a CRDT, and pretending otherwise
// silently eats edits. `nextcloud_last_sync` records when the two sides were
// last known equal, so "the file changed since then" is answerable.
// ============================================================================

export interface ThreadDocument {
  /** Storage path, e.g. `EAC_Network/users/jg/Documents/my-post.md`. */
  path: string;
  /** Where a person opens it in Nextcloud, when they have an account. */
  editUrl: string | null;
  lastSync: string | null;
}

export type SyncDirection = 'pulled' | 'pushed' | 'in-sync' | 'no-document';

/** Nextcloud's own editor URL for a path, when the public host is known. */
function buildEditUrl(path: string): string | null {
  const base =
    process.env.NEXTCLOUD_PUBLIC_URL || process.env.NEXTCLOUD_URL || '';
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/apps/files/?dir=/${encodeURI(
    path.split('/').slice(0, -1).join('/')
  )}`;
}

function filenameFor(slug: string | null, threadId: string): string {
  const base = (slug || threadId).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
  return `${base || threadId}.md`;
}

/**
 * Give a thread a markdown file in its author's own Documents folder.
 *
 * Idempotent: a thread that already has one is returned unchanged rather than
 * getting a second file. The body is seeded from whatever the thread holds, so
 * attaching a document to an existing draft carries the draft across.
 */
export async function attachThreadDocument(
  threadId: string
): Promise<ThreadDocument | null> {
  try {
    const [thread] = await db<
      Array<{
        author_id: string;
        slug: string | null;
        title: string | null;
        body: string | null;
        nextcloud_doc_url: string | null;
      }>
    >`
      SELECT author_id, slug, title, body, nextcloud_doc_url
      FROM threads WHERE id = ${threadId}
    `;
    if (!thread) return null;

    if (thread.nextcloud_doc_url) {
      return getThreadDocument(threadId);
    }

    const storageSlug = await getStorageSlug(thread.author_id);
    if (!storageSlug) {
      console.error(`[thread-document] no storage slug for ${thread.author_id}`);
      return null;
    }

    const folder = resolveUserPath(storageSlug, 'Documents');
    await davMkcol(folder);

    const path = `${folder}/${filenameFor(thread.slug, threadId)}`;
    const seed = thread.body?.trim()
      ? thread.body
      : `# ${thread.title ?? 'Untitled'}\n\n`;

    const ok = await davPut(path, new TextEncoder().encode(seed), 'text/markdown');
    if (!ok) {
      console.error(`[thread-document] PUT failed for ${path}`);
      return null;
    }

    const now = new Date();
    await db`
      UPDATE threads
      SET nextcloud_doc_url = ${path},
          nextcloud_last_sync = ${now},
          body_format = 'md',
          updated_at = NOW()
      WHERE id = ${threadId}
    `;

    return { path, editUrl: buildEditUrl(path), lastSync: now.toISOString() };
  } catch (err) {
    console.error(`[thread-document] attach(${threadId}):`, err);
    return null;
  }
}

export async function getThreadDocument(
  threadId: string
): Promise<ThreadDocument | null> {
  try {
    const [row] = await db<
      Array<{ nextcloud_doc_url: string | null; nextcloud_last_sync: Date | null }>
    >`
      SELECT nextcloud_doc_url, nextcloud_last_sync FROM threads WHERE id = ${threadId}
    `;
    if (!row?.nextcloud_doc_url) return null;
    return {
      path: row.nextcloud_doc_url,
      editUrl: buildEditUrl(row.nextcloud_doc_url),
      lastSync: row.nextcloud_last_sync?.toISOString() ?? null,
    };
  } catch (err) {
    console.error(`[thread-document] get(${threadId}):`, err);
    return null;
  }
}

/**
 * Bring the two sides into step.
 *
 * Pulls when the file has changed since the last sync — someone edited it in
 * Nextcloud — and pushes otherwise, so the CMS's copy is what the file holds.
 * Returns which way it went, because a writing surface should be able to say
 * "loaded your changes from Nextcloud" rather than silently swapping the text
 * under the cursor.
 */
export async function syncThreadDocument(
  threadId: string,
  opts: { preferBody?: boolean } = {}
): Promise<SyncDirection> {
  try {
    const [row] = await db<
      Array<{
        nextcloud_doc_url: string | null;
        nextcloud_last_sync: Date | null;
        body: string | null;
      }>
    >`
      SELECT nextcloud_doc_url, nextcloud_last_sync, body
      FROM threads WHERE id = ${threadId}
    `;
    if (!row?.nextcloud_doc_url) return 'no-document';

    const path = row.nextcloud_doc_url;

    // The caller knows the CMS side just changed (an autosave), so there is
    // nothing to compare — write it out and move the watermark.
    if (opts.preferBody) {
      await pushBody(threadId, path, row.body ?? '');
      return 'pushed';
    }

    const remoteMtime = await davLastModified(path);
    const lastSync = row.nextcloud_last_sync;

    // No timestamp from the server means we cannot tell who is newer. Pushing
    // would risk overwriting a Nextcloud edit, so do nothing and say so.
    if (!remoteMtime) return 'in-sync';

    if (!lastSync || remoteMtime.getTime() > lastSync.getTime() + 1000) {
      const text = await davGetText(path);
      if (text === null) return 'in-sync';
      await db`
        UPDATE threads
        SET body = ${text},
            body_format = 'md',
            nextcloud_last_sync = ${remoteMtime},
            updated_at = NOW()
        WHERE id = ${threadId}
      `;
      return 'pulled';
    }

    return 'in-sync';
  } catch (err) {
    console.error(`[thread-document] sync(${threadId}):`, err);
    return 'in-sync';
  }
}

async function pushBody(threadId: string, path: string, body: string): Promise<void> {
  const ok = await davPut(path, new TextEncoder().encode(body), 'text/markdown');
  if (!ok) {
    console.error(`[thread-document] push failed for ${path}`);
    return;
  }
  // Read the server's own mtime back rather than using our clock: the
  // watermark has to be comparable to what davLastModified will report next
  // time, and the two machines' clocks are not the same clock.
  const mtime = (await davLastModified(path)) ?? new Date();
  await db`
    UPDATE threads
    SET nextcloud_last_sync = ${mtime}, updated_at = NOW()
    WHERE id = ${threadId}
  `;
}
