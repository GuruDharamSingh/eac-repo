// Shared by test.mts and serve.mts: a handler over the real database with keys and
// audit rows kept in memory (the key table is a parked migration, and action_events
// is append-only, so tests write nothing). The LMS readers are the real ones; the
// Channel reader is arts-collective's (Next-only), so the board reads "cannot read".
import { mcpHandler, memoryAudit, memoryGrantStore, newKey, type McpGrant } from '../src/server/index';
// Relative: packages/mcp does not depend on the LMS; the host passes it in.
import { getActiveEnrolment, getCourseBySlug, getLearnerOutline, listMyEnrolments, stepTask } from '../../lms/src/index';

export const PUBLIC_ORIGIN = 'https://arts-collective.com';
/** Justin (justin.gillisb@gmail.com): owner of tara, sunjay, ifac…; not in katie-the-potter. */
export const USER = 'fbf699b9-c708-440a-9abd-40f8953978e5';

const grant = (id: string, orgScope: string, scopes: McpGrant['scopes'] = ['mcp:read'], expiresAt: Date | null = null): McpGrant => ({
  id, userId: USER, email: 'justin.gillisb@gmail.com', clientId: 'personal', label: `test ${id}`, orgScope, scopes, expiresAt,
});

export function harness(extraHosts: string[] = []) {
  const keys = {
    all: newKey(),
    tara: newKey(),
    foreign: newKey(), // bound to an org Justin does not run
    noread: newKey(),
    expired: newKey(),
  };
  const grants = memoryGrantStore([
    [keys.all, grant('00000000-0000-4000-8000-000000000001', '*')],
    [keys.tara, grant('00000000-0000-4000-8000-000000000002', 'tara')],
    [keys.foreign, grant('00000000-0000-4000-8000-000000000003', 'katie-the-potter')],
    [keys.noread, grant('00000000-0000-4000-8000-000000000004', '*', [])],
    [keys.expired, grant('00000000-0000-4000-8000-000000000005', '*', ['mcp:read'], new Date(Date.now() - 1000))],
  ]);
  const audit = memoryAudit();
  const handle = mcpHandler({
    publicOrigin: PUBLIC_ORIGIN,
    extraHosts,
    links: { hub: '', artdirect: 'https://artdirect.arts-collective.com', networkHost: 'arts-collective.com' },
    linkHosts: ['elkdonis-arts.org'],
    lms: { getCourseBySlug, getActiveEnrolment, listMyEnrolments, getLearnerOutline, stepTask } as never,
    grants,
    audit,
    enabled: true,
  });
  return { handle, keys, audit };
}
