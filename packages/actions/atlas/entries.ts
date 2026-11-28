// Entry-level registry data (2026-11-16, docs/open/mcp-foundations/DOCK_LOOP_SLICE1_2026-11-16.md §2).
//
// One object per registry entry id: where its control lives, what it risks, who may do it, and which atlas
// row supplies its confirm wording. The atlas rows carry the wording and its approval status (Justin answers
// in the wave reports); `confirmFrom` copies text, status and wave from the named row at emit time, so an
// approval needs no second edit. scripts/atlas-emit.mts turns this into src/registry-data.ts (client-safe);
// check:registry fails when that file is stale. src/ never imports atlas/.
import type { ActionAddress, ActionRisk, ActionRole } from '../src/types';

export interface EntryData {
  address?: ActionAddress;
  risk: readonly ActionRisk[];
  roles: readonly ActionRole[];
  /** '<area file name without .ts>:<capability id>' */
  confirmFrom?: string;
}

const hub = (path: string, surface: string | undefined, anchor: string | undefined, how: string): ActionAddress => ({ host: 'hub', path, ...(surface ? { surface } : {}), ...(anchor ? { anchor } : {}), how });

export const ENTRIES: Record<string, EntryData> = {
  profile: { address: hub('/hub/network', 'profile:edit', 'profile', 'Save in the profile card'), risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:edit-my-profile' },
  'gain-space': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.learn:take-your-space' },
  listing: { address: hub('/hub/network', 'profile:details', 'listing', 'Save details, or the Network directory switch under Where you show'), risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:set-where-i-show' },
  studio: { address: hub('/studio', undefined, 'studio', 'Publish in the Studio'), risk: ['public'], roles: ['person'], confirmFrom: 'orgapps.writing:writing-piece-save' },
  'show-on': { address: hub('/hub/network', 'profile:show', 'show-on', 'The Show on list under Where you show'), risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:choose-sites-for-post' },
  cloud: { address: { host: 'app', app: 'nextcloud', external: true, how: 'Sign in with Elkdonis in the cloud window' }, risk: [], roles: ['person'] },
  service: { address: hub('/hub/network', 'journey:profile', 'service', 'Offer a service under Offer and get paid'), risk: ['public', 'money'], roles: ['person'], confirmFrom: 'orgapps.money:own-service-save' },
  store: { address: hub('/hub/network', 'journey:auction', 'store', 'Open your store, step 2 of Sell your art'), risk: ['public', 'money'], roles: ['person'], confirmFrom: 'orgapps.journeys:auction-store-publish' },
  // `market`: where the same control lives on market.arts-collective.com, used by the dock there (2026-11-24).
  artwork: {
    address: { ...hub('/hub/network', 'artwork', 'artwork', 'Publish all in the artwork queue'), market: { path: '/studio', anchor: 'artwork', how: 'The New artwork button at the top of My art' } },
    risk: ['public', 'money'], roles: ['person'], confirmFrom: 'orgapps.artwork:artwork-draft-save',
  },
  payouts: {
    address: { ...hub('/hub/network', 'journey:auction', 'payouts', 'Connect Stripe, step 3 of Sell your art'), market: { path: '/studio/payouts', anchor: 'payouts', how: 'Connect with Stripe on the Payouts page' } },
    risk: ['money'], roles: ['person'], confirmFrom: 'orgapps.money:payout-stripe-start',
  },
  // The market's store course, done in the dock (2026-11-24).
  'store-front': { address: { host: 'app', app: 'art-auction', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'apps.art-auction.dock:store-front' },
  'ship-from': { address: { host: 'app', app: 'art-auction', dock: true, how: 'Done in the dock' }, risk: [], roles: ['person'], confirmFrom: 'apps.art-auction.dock:ship-from' },
  // Dock forms, first batch (2026-11-27, rails desk lane A): done in the dock, wording drafts in reports/wording-wave-02.md.
  'pen-name': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:create-pen-name' },
  'writing-start': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: [], roles: ['person'], confirmFrom: 'orgapps.writing:writing-piece-start' },
  // Registry data for two entries the rails courses name (2026-11-27): the dock takes the person there.
  'org-publish': { address: hub('/hub/organization?org={org}', undefined, 'org-offering', 'Publish in the composer: a post, an event or a meeting'), risk: [], roles: ['owner', 'guide'] },
  'channel-connect': { address: hub('/channel/outlets', undefined, undefined, 'Connect an account on the Outlets page'), risk: [], roles: ['person'] },
  // Wiring wave 1 (2026-11-27, lane F): done in the dock, wording drafts in reports/wording-wave-03.md.
  'profile-photo': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:upload-profile-photo' },
  'profile-sections': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'orgapps.people:profile-section-toggle' },
  'pen-name-retire': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:retire-pen-name' },
  'pen-name-restore': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:restore-pen-name' },
  'post-anywhere': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['public'], roles: ['person'], confirmFrom: 'arts-collective.hub:post-to-a-site' },
  org: { address: hub('/hub/network', 'journey:site', 'org', 'Create in the Create a collective dialog'), risk: ['public'], roles: ['person'] },
  'org-details': { address: hub('/hub/network', 'journey:org:{org}', 'org-details', 'Save in the organisation details'), risk: ['public'], roles: ['owner', 'guide'], confirmFrom: 'arts-collective.hub:save-org-identity' },
  'org-offering': { address: hub('/hub/organization?org={org}', undefined, 'org-offering', 'Publish in the composer'), risk: ['public'], roles: ['owner', 'guide'] },
  'org-people': { address: hub('/hub/network', 'journey:org:{org}', 'org-people', 'The People tab of the organisation dialog'), risk: ['others'], roles: ['owner', 'guide'] },
  'org-email': { address: { host: 'hub', dock: true, how: 'Done in the dock' }, risk: ['emails'], roles: ['owner', 'guide'], confirmFrom: 'arts-collective.hub:save-org-email-identity' },
  'org-site': { address: { host: 'hub', path: '/hub/admin', how: 'The collective confirms the address' }, risk: ['public'], roles: ['admin'] },
};
