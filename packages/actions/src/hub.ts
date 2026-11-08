// ============================================================================
// Hub card entries (2026-11-08): the writes the shared hub cards make
// (@elkdonis/hub; docs/open/hub-cards-handoff/PLAN.md §2). Client-safe data,
// registered in ACTION_CATALOGUE. Every one is `appOnly`: performed only from a
// host's own pages (a 'use server' action through performHubAction), never
// from the HTTP routes, the dock or an agent. Not course steps.
// Site Builder's entries (site-section-save, site-page-create) join in pass 4.
// ============================================================================
import type { ActionMeta } from './types';

const hub = (id: string, label: string, describe: string, performs: string): ActionMeta => ({
  id,
  label,
  describe,
  scope: 'org',
  area: 'org',
  derived: false,
  runnable: true,
  appOnly: true,
  performs,
});

export const HUB_ACTIONS: readonly ActionMeta[] = [
  hub(
    'org-person-role',
    'Change someone’s role',
    'Make a person a viewer, member or guide of the organisation.',
    'Owners only, never their own role, never an owner’s, never to owner (services setOrgPersonRole). Queues a shared-storage sync.',
  ),
  hub(
    'org-person-listed',
    'List or unlist someone',
    'Show or hide a person in the organisation’s public directory.',
    'Owners only for other people; anyone may unlist themselves (services setOrgPersonListed).',
  ),
  hub(
    'org-person-remove',
    'Remove someone',
    'Take a person out of the organisation. Their account stays.',
    'Owners only, never themselves or an owner. Unlists them and queues a storage sync that revokes access (services removeOrgPerson).',
  ),
  hub(
    'org-arrival-welcome',
    'Welcome an arrival',
    'Give a signed-in arrival from another network site a role here.',
    'Owners pick viewer, member or guide; guides welcome as viewer. They join unlisted; a storage sync is queued (services welcomeOrgArrival).',
  ),
  hub(
    'org-arrival-dismiss',
    'Dismiss an arrival',
    'Take someone off the arrivals queue without a role.',
    'Owners and guides. Needs migration 258 (services dismissOrgArrival).',
  ),
];

export const HUB_ACTION_IDS: readonly string[] = HUB_ACTIONS.map((m) => m.id);
