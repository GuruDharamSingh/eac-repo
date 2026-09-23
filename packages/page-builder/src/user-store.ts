import { db } from "@elkdonis/db";
import { validatePage } from "./validate";
import { isValidUserPageKey } from "./user-page-key";

export { isValidUserPageKey };

// ============================================================================
// Where a PERSON's page lives — migration 157's user_pages.
//
// The org-scoped store (./store.ts) cannot hold this: its key is per-org by
// construction, and a store panel is per-(PERSON, org) — the same artist's
// panel differs by which org is hosting it. `user_pages` adds the third axis
// rather than smuggling a user id into site_config's key, which would make
// every existing org-page reader also a place a user id could leak through.
//
// `key` is `store:1`, `store:2`, … — "multiple pages of one section" is
// multiple rows, same move migration 146 made for a person's galleries.
//
// ── Status is not optional here, unlike ./store.ts ─────────────────────────
//
// An org page publishes the moment its owner clicks Publish — it is their own
// page. A user page is being INSERTED into somebody else's layout, so it goes
// through the org's own moderation (migration 157's status column, reusing
// 156's vocabulary) rather than going live the instant its author is happy
// with it. This file stores whatever status it is given; DECIDING what that
// status should be is @elkdonis/services' `user-pages.ts` (org policy), kept
// out of this package the same way page-builder has never known an org's
// role rules.
// ============================================================================

export type UserPageStatus = "draft" | "pending" | "published" | "archived";

export interface UserPage {
  userId: string;
  orgId: string;
  key: string;
  data: unknown;
  status: UserPageStatus;
  updatedAt: string | null;
}

/** Refuse anything that would not survive being read back. Same cap as ./store.ts. */
const MAX_PAGE_BYTES = 512 * 1024;

/**
 * The document, for its OWNER — draft, pending or published, whatever it is.
 * An editor needs to see its own unpublished work; this is that read.
 */
export async function loadUserPage(
  userId: string,
  orgId: string,
  key: string,
  knownTypes?: Set<string>
): Promise<UserPage | null> {
  if (!isValidUserPageKey(key)) return null;
  try {
    const [row] = await db<Array<{ data: unknown; status: string; updated_at: string }>>`
      SELECT data, status, updated_at FROM user_pages
      WHERE user_id = ${userId} AND org_id = ${orgId} AND key = ${key}
      LIMIT 1
    `;
    if (!row) return null;

    const check = validatePage(row.data, knownTypes);
    for (const w of check.warnings) console.warn(`[user-pages] ${userId}/${orgId}/${key} ${w.path}: ${w.message}`);
    if (!check.ok) {
      console.error(
        `[user-pages] ${userId}/${orgId}/${key} is not renderable: ` +
          check.errors.map((e) => `${e.path || "(root)"} — ${e.message}`).join("; ")
      );
      return null;
    }

    return {
      userId,
      orgId,
      key,
      data: row.data,
      status: row.status as UserPageStatus,
      updatedAt: row.updated_at,
    };
  } catch (err) {
    console.error(`[user-pages] loadUserPage(${userId}, ${orgId}, ${key}):`, err);
    return null;
  }
}

/**
 * The document as the PUBLIC sees it: published only. Everything else —
 * still being designed, waiting on a guide, turned down — is invisible here
 * by construction, the same property migration 156 gives `threads`.
 */
export async function loadPublishedUserPage(
  userId: string,
  orgId: string,
  key: string,
  knownTypes?: Set<string>
): Promise<UserPage | null> {
  const page = await loadUserPage(userId, orgId, key, knownTypes);
  return page && page.status === "published" ? page : null;
}

/**
 * Save a draft. Never changes status — publishing is a decision made
 * elsewhere (@elkdonis/services' user-pages.ts), and a save made while
 * editing a PUBLISHED panel must not silently take it down or push a change
 * live; it lands back in review instead, via submitUserPage.
 */
export async function saveUserPage(
  userId: string,
  orgId: string,
  key: string,
  data: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!isValidUserPageKey(key)) {
    return { ok: false, error: "That page name is not usable." };
  }
  const check = validatePage(data);
  if (!check.ok) {
    console.error(`[user-pages] refusing to save ${userId}/${orgId}/${key}:`, check.errors);
    return { ok: false, error: "That page is not in a shape we can store." };
  }
  if (JSON.stringify(data).length > MAX_PAGE_BYTES) {
    return { ok: false, error: "That page is too large to save." };
  }
  try {
    await db`
      INSERT INTO user_pages (user_id, org_id, key, data, status, updated_at)
      VALUES (${userId}, ${orgId}, ${key}, ${db.json(data as never)}, 'draft', NOW())
      ON CONFLICT (user_id, org_id, key)
      DO UPDATE SET data = EXCLUDED.data,
                    -- A published panel that is edited again goes back to
                    -- draft: what is LIVE stays whatever it was (this row
                    -- update does not touch it — see the note above), but the
                    -- draft they are now editing must be resubmitted, not
                    -- silently swapped in for what a guide already approved.
                    status = CASE WHEN user_pages.status = 'published' THEN 'draft' ELSE user_pages.status END,
                    updated_at = NOW()
    `;
    return { ok: true };
  } catch (err) {
    console.error(`[user-pages] saveUserPage(${userId}, ${orgId}, ${key}):`, err);
    return { ok: false, error: "Could not save this page." };
  }
}

/** Every page this person has for this org, for their own editor's index. */
export async function listUserPages(
  userId: string,
  orgId: string
): Promise<Array<{ key: string; status: UserPageStatus; updatedAt: string }>> {
  try {
    const rows = await db<Array<{ key: string; status: string; updated_at: string }>>`
      SELECT key, status, updated_at FROM user_pages
      WHERE user_id = ${userId} AND org_id = ${orgId}
      ORDER BY key ASC
    `;
    return rows.map((r) => ({ key: r.key, status: r.status as UserPageStatus, updatedAt: r.updated_at }));
  } catch (err) {
    console.error(`[user-pages] listUserPages(${userId}, ${orgId}):`, err);
    return [];
  }
}
