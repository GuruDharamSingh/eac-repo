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

  // Site Builder (2026-11-08). The host passes its SiteBuilderAdapter through performHubAction.
  hub(
    'site-section-save',
    'Save a page’s copy',
    'Fill in the copy slots of one of the site’s fixed-layout pages.',
    'Merges the named fields into org_site_sections (an empty field falls back to the layout default).',
  ),
  hub(
    'site-page-create',
    'Add a page',
    'A new page built in the visual editor, blank, from a starter, a copy or a saved template.',
    'Refuses taken or reserved addresses; the document goes through the host’s save pipeline (sanitised).',
  ),
  hub(
    'site-page-meta-save',
    'Save page notes and settings',
    'Notes for the next editor, the title and the link preview text of one page.',
    'Hub-only notes; needs migration 256.',
  ),
  hub(
    'site-template-save',
    'Save a page as a template',
    'Keep a page’s blocks, layout and words as a starting point for new pages.',
    'A sanitised snapshot; pages made from it get their own copy. Needs migration 257.',
  ),
  hub(
    'site-identity-save',
    'Save the identity card',
    'The organisation’s name, short line, place and kinds, as the network shows them.',
    'Writes the org identity row (owners and guides); kinds need migration 260.',
  ),
  hub(
    'site-theme-exception-remove',
    'Remove a page’s colour exception',
    'Let one page follow the site theme again.',
    'Deletes that page’s site_themes row; never the site default.',
  ),
];

export const HUB_ACTION_IDS: readonly string[] = HUB_ACTIONS.map((m) => m.id);
