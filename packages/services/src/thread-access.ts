import { db } from '@elkdonis/db';
import { RANK_OF, type ThreadRole } from './thread-audience';

// The SQL half of the audience rules (see thread-audience.ts for the model and
// migration 188 for the column). Server only: it imports the database client.
export * from './thread-audience';

/**
 * SQL fragment over alias `t`: threads with a minimum role that this viewer's
 * roles satisfy. OR it into an existing visibility predicate. `roles` maps
 * org id → role (ForumViewer.roles).
 */
export function restrictedReadSql(roles: Record<string, string>) {
  const orgsAtLeast = (min: ThreadRole) =>
    Object.entries(roles).filter(([, r]) => RANK_OF[r as ThreadRole] >= RANK_OF[min]).map(([org]) => org);
  return db`(
    t.visibility = 'INVITE_ONLY' AND (
      (t.min_role = 'viewer' AND t.org_id = ANY(${orgsAtLeast('viewer')}))
      OR (t.min_role = 'member' AND t.org_id = ANY(${orgsAtLeast('member')}))
      OR (t.min_role = 'guide' AND t.org_id = ANY(${orgsAtLeast('guide')}))
      OR (t.min_role = 'owner' AND t.org_id = ANY(${orgsAtLeast('owner')}))
    )
  )`;
}
