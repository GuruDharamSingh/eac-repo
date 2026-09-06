import { db } from "@elkdonis/db";

/**
 * Every org this person belongs to, in any role.
 *
 * Deliberately wider than `getEditableOrgsForUser` (owner/guide only): a plain
 * member is exactly who gets *asked* to accept an agreement, so the list of
 * "what have I been asked to agree to" has to include orgs they cannot edit.
 */
export async function getOrgsForUser(
  userId: string
): Promise<Array<{ id: string; name: string; slug: string }>> {
  try {
    return await db<Array<{ id: string; name: string; slug: string }>>`
      SELECT o.id, o.name, o.slug
      FROM user_organizations uo
      JOIN organizations o ON o.id = uo.org_id
      WHERE uo.user_id = ${userId}
      ORDER BY o.name ASC
    `;
  } catch {
    return [];
  }
}
