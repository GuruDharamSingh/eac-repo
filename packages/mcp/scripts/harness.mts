// Shared by test.mts and serve.mts: a handler over the real database with keys and
// audit rows kept in memory (the key table is a parked migration, and action_events
// is append-only, so tests write nothing). The LMS readers are the real ones; the
// Channel reader is arts-collective's (Next-only), so the board reads "cannot read".
//
// The draft tools (2026-11-20, lane ASSIST) get a host-provided writer, as the page reader is host-provided:
// here the real drafts functions and the real step door, both over a transaction the test can set
// (`useTx`), so a test that proposes a change leaves no row (it rolls back). With no transaction set the writer
// is the pool's, which is what serve.mts wants.
import './react-shim.mjs';
import { mcpHandler, memoryAudit, memoryGrantStore, newKey, type McpGrant } from '../src/server/index';
import type { McpDrafts } from '../src/server/types';
// Relative: packages/mcp does not depend on the LMS; the host passes it in.
import { getActiveEnrolment, getCourseBySlug, getLearnerOutline, listMyEnrolments, stepTask } from '../../lms/src/index';
// The page store is the host's too (arts-collective passes the same two readers from @elkdonis/page-builder/server).
import { loadPageWithVersion } from '../../page-builder/src/store';
import { loadDraft, saveDraft } from '../../page-builder/src/drafts';
import { validatePage } from '../../page-builder/src/validate';
import { db } from '@elkdonis/db';
import { applySteps } from '../../house-editor/src/steps/index';

export const PUBLIC_ORIGIN = 'https://arts-collective.com';
/** Justin (justin.gillisb@gmail.com): owner of tara, sunjay, ifac…; not in katie-the-potter. */
export const USER = 'fbf699b9-c708-440a-9abd-40f8953978e5';

const grant = (id: string, orgScope: string, scopes: McpGrant['scopes'] = ['mcp:read'], expiresAt: Date | null = null): McpGrant => ({
  id, userId: USER, email: 'justin.gillisb@gmail.com', clientId: 'personal', label: `test ${id}`, orgScope, scopes, expiresAt,
});

type Sql = typeof db;
let tx: Sql | null = null;
/** Run the writer and the page reader on this transaction (or, with null, on the pool). */
/** A test hook: runs just before the writer saves (to make someone else save first). */
let beforeSave: (() => Promise<void>) | null = null;
export const onBeforeSave = (f: (() => Promise<void>) | null) => {
  beforeSave = f;
};
export const useTx = (t: Sql | null) => {
  tx = t;
};

/** The page reader: the host's, except that inside a test transaction it reads that transaction (so a fixture page made there is seen). */
const pages = {
  async loadPageWithVersion(orgId: string, slug: string) {
    if (!tx) return loadPageWithVersion(orgId, slug);
    const [row] = await tx<Array<{ value: unknown; version: string }>>`SELECT value, updated_at::text AS version FROM site_config WHERE org_id = ${orgId} AND key = ${'puck:' + slug} LIMIT 1`;
    return row && validatePage(row.value).ok ? { data: row.value, updatedAt: row.version } : null;
  },
};

const drafts: McpDrafts = {
  applySteps: (_orgId, doc, steps, contracts) => applySteps(doc as never, steps, { contracts: contracts as never, allowUnknownTypes: true }) as never,
  loadDraft: (orgId, slug) => loadDraft(orgId, slug, tx ? { tx } : {}),
  saveDraft: async (orgId, slug, draft) => {
    if (beforeSave) await beforeSave();
    return saveDraft(orgId, slug, draft as never, tx ? { tx } : {});
  },
};

export function harness(extraHosts: string[] = []) {
  const keys = {
    all: newKey(),
    tara: newKey(),
    foreign: newKey(), // bound to an org Justin does not run
    noread: newKey(),
    expired: newKey(),
    all2: newKey(),
    sunjay: newKey(), // bound to sunjay: has no home page
    heng: newKey(), // bound to hidden-enneagram: has a home page
    // Draft keys (mcp:read + mcp:draft). `all`, `all2`, `tara`... above are read-only: the draft tools refuse them.
    draft: newKey(),
    draft2: newKey(),
    draftSunjay: newKey(),
    draftTara: newKey(),
    draftLimit: newKey(),
    draftOnly: newKey(), // mcp:draft without mcp:read
  };
  const both: McpGrant['scopes'] = ['mcp:read', 'mcp:draft'];
  const grants = memoryGrantStore([
    [keys.all, grant('00000000-0000-4000-8000-000000000001', '*')],
    [keys.tara, grant('00000000-0000-4000-8000-000000000002', 'tara')],
    [keys.foreign, grant('00000000-0000-4000-8000-000000000003', 'katie-the-potter')],
    [keys.noread, grant('00000000-0000-4000-8000-000000000004', '*', [])],
    [keys.expired, grant('00000000-0000-4000-8000-000000000005', '*', ['mcp:read'], new Date(Date.now() - 1000))],
    [keys.all2, grant('00000000-0000-4000-8000-000000000008', '*')],
    [keys.sunjay, grant('00000000-0000-4000-8000-000000000006', 'sunjay')],
    [keys.heng, grant('00000000-0000-4000-8000-000000000007', 'hidden-enneagram')],
    [keys.draft, grant('00000000-0000-4000-8000-000000000011', '*', both)],
    [keys.draft2, grant('00000000-0000-4000-8000-000000000012', '*', both)],
    [keys.draftSunjay, grant('00000000-0000-4000-8000-000000000013', 'sunjay', both)],
    [keys.draftTara, grant('00000000-0000-4000-8000-000000000014', 'tara', both)],
    [keys.draftLimit, grant('00000000-0000-4000-8000-000000000015', '*', both)],
    [keys.draftOnly, grant('00000000-0000-4000-8000-000000000016', '*', ['mcp:draft'])],
  ]);
  const audit = memoryAudit();
  const handle = mcpHandler({
    publicOrigin: PUBLIC_ORIGIN,
    extraHosts,
    links: { hub: '', artdirect: 'https://artdirect.arts-collective.com', networkHost: 'arts-collective.com' },
    linkHosts: ['elkdonis-arts.org'],
    lms: { getCourseBySlug, getActiveEnrolment, listMyEnrolments, getLearnerOutline, stepTask } as never,
    pages,
    drafts,
    grants,
    audit,
    enabled: true,
  });
  return { handle, keys, audit };
}
