import type { Area, Capability, Host, HostKey } from '../types';

// elktours Pipeline: the org's own Nextcloud Deck board, shown at /hub/pipeline (packages/pipeline PipelineBoard).
// 2026-11-16, round 2 curator (elktours). Every route runs through lib/pipeline-api.ts: createPipelineApi binds the
// org, getApiMember (owner, guide or member) for card work and getApiEditor (owner or guide) for lists, deletions and
// moderation. The board is never named by the client: it is resolved from the org, and an id that is not on that
// board is refused (OrgDeckScopeError becomes a 404, per the route comments; the check itself is in
// @elkdonis/pipeline, not re-read here). Writes go to Nextcloud Deck under a service account, not to the database.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const V = '2026-11-16 read app/api/pipeline/**/route.ts (writes), lib/pipeline-api.ts, lib/auth.ts, app/hub/pipeline/page.tsx; packages/pipeline components named by grep (not read)';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/pipeline/${p}/route.ts#${m}` as HostKey;
const BOARD = 'packages/pipeline/src/components/PipelineBoard.tsx';
const DIALOG = 'packages/pipeline/src/components/PipelineCardDialog.tsx';

const one = (key: HostKey, service: string[], how: string, note?: string): Host => ({ key, service, address: { app: APP, path: '/hub/pipeline', how }, note });

type Row = {
  id: string;
  label: string;
  does: string;
  host: Host;
  actors: Capability['actors'];
  risk: Capability['risk'];
  text: string;
  status: string;
  open?: string;
  internal?: boolean;
  inputs: string;
};

const MEMBER: Capability['actors'] = ['owner', 'guide', 'member'];
const EDITOR: Capability['actors'] = ['owner', 'guide'];
const DRIFT = 'Same pipeline routes and package are mounted in the other org apps that show a Deck board; ids and rules are shared in @elkdonis/pipeline.';
const CANON = '@elkdonis/pipeline/routes#createPipelineApi (already shared); keep the per-app files as one-line mounts';

const rows: Row[] = [
];

const capabilities: Capability[] = rows.map((r) => ({
  id: r.id,
  area: 'elktours.pipeline',
  label: r.label,
  does: r.does,
  class: r.internal ? ('internal' as const) : ('person' as const),
  actors: r.actors,
  scope: 'org' as const,
  hosts: [r.host],
  ...(r.internal ? {} : { entry: null, confirm: { text: r.text, status: 'draft' as const, wave: 6 } }),
  status: r.status,
  risk: r.risk,
  inputs: r.inputs,
  drift: DRIFT,
  canonical: CANON,
  ...(r.open ? { open: r.open } : {}),
  verified: V,
}));

const area: Area = { capabilities, ignored: [] };
export default area;
