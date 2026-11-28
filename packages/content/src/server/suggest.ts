// ============================================================================
// @elkdonis/content/server: suggestContent (Content Cornerstone, 2026-11-26).
//
// Type-ahead for the search box: up to `limit` per group of pieces, people and orgs.
//
//   pieces  content_index titles (prefix, substring, trigram) under the one rights
//           predicate (access.ts contentReadSql, no scope: what this viewer may read).
//           Files never appear (CONTRACT s14). An empty q returns recent pieces.
//   people  only people the directory lists: users.slug set, directory_listed, entity_type
//           'person' (the rule of forum-people.ts listMembers and ArtDirect). A pseudonym is
//           a users row of its own and shows as itself; identity_control (who is behind it)
//           is never read here. Name, avatar and a public profile href only: never email.
//   orgs    public orgs only: join_policy <> 'private' and subdomain_confirmed (the rule of
//           artist-space.ts listAffiliationOrgs), never the personal org `oad`.
//
// People and orgs come back for a non-empty q only. No trigram index on users or
// organizations: both tables hold on the order of 100 rows, a sequential scan is cheaper.
// ============================================================================

import { db } from "@elkdonis/db";
import { drainContentQueue, listOrgHomes } from "@elkdonis/services";
import { ARTDIRECT_URL, type ContentHost } from "../host";
import { contentReadSql, resolveRights, type ContentRights, type ContentViewer } from "./access";
import { orgUrlOf } from "./hydrate";

export interface SuggestPiece { key: string; title: string; type: string; cover: string | null }
export interface SuggestPerson { id: string; name: string; avatar: string | null; href: string }
export interface SuggestOrg { id: string; name: string; logo: string | null; href: string | null }
export interface ContentSuggestions { pieces: SuggestPiece[]; people: SuggestPerson[]; orgs: SuggestOrg[] }

export const SUGGEST_Q_MAX = 100;

const likeEscape = (s: string) => s.replace(/[\%_]/g, (c) => `\${c}`);

export async function suggestContent(
  viewer: ContentViewer | null,
  q: string,
  host: ContentHost,
  opts: { limit?: number; /** Tests: skip resolveRights and use these (synthetic) rights. */ rights?: ContentRights; noDrain?: boolean; /** Tests: run the reads on this client (a transaction holding fixtures). */ client?: typeof db } = {}
): Promise<ContentSuggestions> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 5) || 5, 1), 10);
  const text = (q ?? "").trim().slice(0, SUGGEST_Q_MAX);
  if (!opts.noDrain) await drainContentQueue({ limit: 25 }).catch(() => undefined);
  const sql = opts.client ?? db;
  const rights = opts.rights ?? (viewer ? await resolveRights(viewer) : null);

  const piecesP = (async (): Promise<SuggestPiece[]> => {
    const readSql = contentReadSql(rights, null, host);
    const nameSql = text
      ? db`AND (ci.title ILIKE ${likeEscape(text) + "%"} OR ci.title ILIKE ${"%" + likeEscape(text) + "%"} OR ci.title % ${text})`
      : db``;
    const orderSql = text
      ? db`(ci.title ILIKE ${likeEscape(text) + "%"}) DESC, similarity(ci.title, ${text}) DESC, ci.sort_at DESC, ci.key COLLATE "C" DESC`
      : db`ci.sort_at DESC, ci.key COLLATE "C" DESC`;
    const rows = await sql<Array<{ key: string; title: string; type: string; cover: string | null }>>`
      SELECT ci.key, ci.title, ci.type, ci.cover
      FROM content_index ci
      WHERE ci.store <> 'file' AND ci.status IN ('published', 'draft') AND ${readSql} AND ci.title <> '' ${nameSql}
      ORDER BY ${orderSql}
      LIMIT ${limit}`;
    return rows.map((r) => ({ key: r.key, title: r.title, type: r.type, cover: r.cover }));
  })();

  const peopleP = (async (): Promise<SuggestPerson[]> => {
    if (!text) return [];
    const rows = await sql<Array<{ id: string; name: string; avatar: string | null; slug: string }>>`
      SELECT u.id::text AS id, u.display_name AS name, u.avatar_url AS avatar, u.slug
      FROM users u
      WHERE u.slug IS NOT NULL AND u.directory_listed AND u.entity_type = 'person' AND u.display_name IS NOT NULL
        AND (u.display_name ILIKE ${"%" + likeEscape(text) + "%"} OR u.slug ILIKE ${likeEscape(text) + "%"})
      ORDER BY (u.display_name ILIKE ${likeEscape(text) + "%"}) DESC, u.display_name ASC
      LIMIT ${limit}`;
    return rows.map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, href: `${ARTDIRECT_URL}/${r.slug}` }));
  })();

  const orgsP = (async (): Promise<SuggestOrg[]> => {
    if (!text) return [];
    const [rows, homes] = await Promise.all([
      sql<Array<{ id: string; name: string; logo: string | null }>>`
        SELECT o.id, o.name, pu.avatar_url AS logo
        FROM organizations o LEFT JOIN users pu ON pu.id = o.profile_user_id
        WHERE o.join_policy <> 'private' AND o.subdomain_confirmed AND o.id <> 'oad'
          AND (o.name ILIKE ${"%" + likeEscape(text) + "%"} OR o.slug ILIKE ${likeEscape(text) + "%"})
        ORDER BY (o.name ILIKE ${likeEscape(text) + "%"}) DESC, o.name ASC
        LIMIT ${limit}`,
      listOrgHomes(),
    ]);
    return rows.map((r) => ({ id: r.id, name: r.name, logo: r.logo, href: host.urls.siteHome(r.id) ?? orgUrlOf(homes.find((h) => h.orgId === r.id)) }));
  })();

  const [pieces, people, orgs] = await Promise.all([piecesP, peopleP, orgsP]);
  return { pieces, people, orgs };
}
