// ============================================================================
// Agent exposure (2026-11-08): what an agent door — the platform MCP
// (packages/mcp, arts-collective /api/mcp), later the dock assistant — may do
// with each registry entry. Client-safe data, applied to ACTION_CATALOGUE by
// `withAgent`. docs/open/mcp-foundations/PLAN.md §2.4 and NOTES/02.
//
// Default deny: an entry missing here is invisible to agents, so a new entry
// stays invisible until someone adds it on purpose.
//   read   its status (actionStatus) is an agent read
//   draft  its runner is an agent tool as well: it writes drafts and additions
//          only (nothing sends, publishes, schedules, charges or overwrites)
// Never set on an `appOnly` entry: `withAgent` drops it and check:registry
// fails on it. 'read' needs a status check (derived); 'draft' needs a runner.
// ============================================================================
import type { ActionMeta } from './types';

export const AGENT_EXPOSURE: Readonly<Record<string, 'read' | 'draft'>> = {
  // Person: status only. Their runners overwrite text or change what is public.
  profile: 'read',
  'gain-space': 'read',
  listing: 'read',
  studio: 'read',
  'show-on': 'read',
  cloud: 'read',
  service: 'read',
  store: 'read',
  artwork: 'read',
  payouts: 'read',
  org: 'read',
  // Org: status only, except org-publish (a draft post).
  'org-details': 'read',
  'org-offering': 'read',
  'org-people': 'read',
  'org-email': 'read',
  'org-site': 'read',
  'org-publish': 'draft',
  // Posts: publishing stays with the site (status only).
  'thread-publish': 'read',
  // The Akhand Path day (routine steps).
  'paath-read': 'read',
  'paath-record': 'read',
  'paath-note': 'read',
  'paath-publish': 'read',
  // Channel: setup status, the board, and its plan-only moves.
  'channel-connect': 'read',
  'channel-org-channel': 'read',
  'channel-first-post': 'read',
  'channel-next': 'read',
  'channel-suggestion-accept': 'draft',
  'channel-slot-fill': 'draft',
  // From an agent door only op 'add' (ticks stay with the app and the dock); the agent door enforces it.
  'channel-plan-step': 'draft',
};

/** The entry with its agent exposure applied. An `appOnly` entry never gets one. */
export function withAgent(meta: ActionMeta): ActionMeta {
  const agent = AGENT_EXPOSURE[meta.id];
  if (agent && !meta.appOnly) return { ...meta, agent };
  if (meta.agent === undefined) return meta;
  const rest = { ...meta };
  delete rest.agent;
  return rest;
}
