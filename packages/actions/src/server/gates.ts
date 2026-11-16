/**
 * Readiness gates: read-only questions about one person's state (2026-11-16, lane rails; track nexus,
 * packages/actions/atlas/tracks). Each answers true / false from live rows, never writes, and says `unknown`
 * rather than throwing when a table or column is missing. The declarations (id, label, resolver) are in
 * atlas/tracks/gates.ts; a gate whose resolver is `gates:<fn>` names a function here.
 *
 * Later these become MCP resources: a person's state, read by an agent before it picks a track.
 */
import { db } from '@elkdonis/db';
import { ARTIST_SPACE_ORG_ID } from '@elkdonis/services';

export interface GateResult {
  met: boolean;
  /** True when the check could not be made (missing table or column, database error): `met` is false then. */
  unknown?: boolean;
}

async function ask(q: () => Promise<boolean>): Promise<GateResult> {
  try {
    return { met: await q() };
  } catch {
    return { met: false, unknown: true };
  }
}

/** The person has a profile photo (users.avatar_url). */
export function hasProfilePhoto(userId: string): Promise<GateResult> {
  return ask(async () => {
    const [r] = await db<Array<{ ok: boolean }>>`SELECT (avatar_url IS NOT NULL AND avatar_url <> '') AS ok FROM users WHERE id = ${userId}`;
    return !!r?.ok;
  });
}

/** Payouts are set up with Stripe (users.stripe_onboarded_at); the same read as the `payouts` registry check. */
export function payoutsConnected(userId: string): Promise<GateResult> {
  return ask(async () => {
    const [r] = await db<Array<{ ok: boolean }>>`SELECT (stripe_onboarded_at IS NOT NULL) AS ok FROM users WHERE id = ${userId}`;
    return !!r?.ok;
  });
}

/** The person has any role in the organisation (user_organizations). `org` is the organisation id. */
export function isOrgMember(userId: string, org: string): Promise<GateResult> {
  return ask(async () => {
    const rows = await db<Array<{ one: number }>>`SELECT 1 AS one FROM user_organizations WHERE user_id = ${userId} AND org_id = ${org} LIMIT 1`;
    return rows.length > 0;
  });
}

/** The person has a published piece of writing, or an artwork on sale or sold (the `studio` and `artwork` checks). */
export function hasPublishedWork(userId: string): Promise<GateResult> {
  return ask(async () => {
    const [w] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM threads WHERE kind = 'writing' AND status = 'published' AND author_id = ${userId}`;
    if (w?.n) return true;
    const [a] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM artwork WHERE artist_user_id = ${userId} AND status IN ('available', 'sold')`;
    return !!a?.n;
  });
}

/** The person has offered a service on their own page (the `service` check): any status. */
export function hasService(userId: string): Promise<GateResult> {
  return ask(async () => {
    const [r] = await db<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM threads WHERE kind = 'service' AND org_id = ${ARTIST_SPACE_ORG_ID} AND author_id = ${userId}`;
    return !!r?.n;
  });
}
