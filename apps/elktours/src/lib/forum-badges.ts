// Role badges for the forum (opt-in hook ForumConnectors.roleBadges, packages/forum-ui). Server only.
// An artist is a person linked as `artist` to an experience of this org (experience_people), whatever their org role.
import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

/** For the given user ids, { [userId]: "artist" } for those who are an artist on an elktours experience (not archived). */
export async function artistBadges(userIds: string[]): Promise<Record<string, "artist">> {
  const ids = [...new Set(userIds.filter((u) => /^[0-9a-f-]{36}$/i.test(u)))];
  if (!ids.length) return {};
  try {
    const rows = (await db`
      SELECT DISTINCT ep.user_id FROM experience_people ep
      JOIN threads t ON t.id = ep.thread_id AND t.org_id = ${siteConfig.orgId} AND t.kind = 'experience' AND t.status IN ('published','pending','draft')
      WHERE ep.role = 'artist' AND ep.user_id = ANY(${ids}::uuid[])
    `) as unknown as Array<{ user_id: string }>;
    return Object.fromEntries(rows.map((r) => [r.user_id, "artist" as const]));
  } catch (err) {
    console.error("[elktours] artistBadges:", err);
    return {};
  }
}
