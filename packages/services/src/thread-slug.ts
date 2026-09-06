import { db } from '@elkdonis/db';
import { slugify, isReservedSlug } from '@elkdonis/utils';

/**
 * Slug allocation for threads.
 *
 * `threads` carries UNIQUE (org_id, slug), so a second post titled "Welcome"
 * in the same org is a constraint violation — which surfaces to the author as
 * an unexplained 500 rather than "that title is taken". Every write path
 * therefore has to allocate through here rather than calling slugify directly.
 *
 * This was previously duplicated byte-for-byte in workshop-offerings.ts and
 * service-offerings.ts, and simply absent from both post creators.
 */

/**
 * A slug derived from `base` that no other thread in this org holds.
 *
 * Appends -2, -3, … until free. `excludeId` lets an update keep its own slug
 * instead of bumping itself on every save.
 *
 * A reserved word counts as taken: an org site serves its threads at
 * `<slug>.arts-collective.com/<thread-slug>`, where `offering`, `profile` and
 * `community` are the site's own pages. Next resolves those static routes
 * before the `[contentSlug]` catch-all, so a thread that claimed one would be
 * silently unreachable — a 404 with no error at write time.
 */
export async function ensureUniqueThreadSlug(
  orgId: string,
  base: string,
  excludeId?: string
): Promise<string> {
  const root = slugify(base) || 'untitled';
  let candidate = root;
  let n = 1;

  // Bounded rather than while(true): a pathological org shouldn't be able to
  // hold the connection open indefinitely.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (isReservedSlug(candidate)) {
      n += 1;
      candidate = `${root}-${n}`;
      continue;
    }
    const rows = excludeId
      ? await db<Array<{ id: string }>>`
          SELECT id FROM threads
          WHERE org_id = ${orgId} AND slug = ${candidate} AND id <> ${excludeId}
          LIMIT 1
        `
      : await db<Array<{ id: string }>>`
          SELECT id FROM threads
          WHERE org_id = ${orgId} AND slug = ${candidate}
          LIMIT 1
        `;

    if (!rows[0]) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }

  // Exhausted the polite options — fall back to something certainly free.
  return `${root}-${Date.now()}`;
}
