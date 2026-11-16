import type { Area, Capability, Host, HostKey } from '../types';

// elktours steward actions for network business listings ("shells") at catalogue places.
// 2026-11-16, round 2 curator (elktours). Services live in packages/services/src/businesses (not re-read here).

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const F = 'lib/business-actions.ts';
const V = '2026-11-16 read lib/business-actions.ts, lib/auth.ts, components/places/place-business-panel.tsx and components/manage/businesses-steward.tsx imports';
const sa = (fn: string): HostKey => `sa:${SRC}${F}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });

const PANEL = 'components/places/place-business-panel.tsx';
const STEW = 'components/manage/businesses-steward.tsx';

const capabilities: Capability[] = [
  {
    id: 'elktours-business-create-from-place',
    area: 'elktours.businesses',
    label: 'List a business from a place',
    does: "Creates a business listing (a shell account owned by this org as steward) prefilled from the place (name, kind, map point, address, confirmed website) and links it as the place's primary business. Returns the existing listing when one matches.",
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa('createBusinessFromPlaceAction'), ['@elkdonis/services/businesses#createBusinessShell', '@elkdonis/services/businesses#linkPlaceBusiness'], '/manage/places/{id}', "the 'Create a business listing' button in the Business at this place panel (" + PANEL + ')'),
    ],
    entry: null,
    status: 'a business_listings row with steward_org_id elktours exists and a place link marks it primary',
    risk: ['public', 'others'],
    confirm: { text: 'List “{name}” as a business on the network, run by {org}? Its details come from the place and will be visible to the public.', status: 'draft', wave: 6 },
    inputs: 'place id, optional name and category',
    drift: 'Single implementation. Shells are seeded by scripts/seed-business-shells-2026-11-04.mts as well.',
    canonical: '@elkdonis/services/businesses#createBusinessShell',
    open: 'Owner-only (viewer.role check at lib/business-actions.ts:72). Creates a network user account for a business that has not consented; confirm this is intended and how a business later claims it.',
    verified: V,
  },
  {
    id: 'elktours-business-link-place',
    area: 'elktours.businesses',
    label: 'Link a business to a place',
    does: 'Links an existing business listing to a catalogue place, as operator or another relation, optionally as the primary one.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('linkPlaceBusinessAction'), ['@elkdonis/services/businesses#linkPlaceBusiness'], '/manage/places/{id}', 'the link control of the Business at this place panel (' + PANEL + ')'),
    ],
    entry: null,
    status: 'a place-business link row exists for the place and business',
    risk: ['public'],
    confirm: { text: 'Link {name} to “{title}”? The business will show on the place page.', status: 'draft', wave: 6 },
    inputs: 'place id, business user id, relation, primary flag',
    drift: 'None: single copy.',
    open: "SECURITY: the file header says writes need an elktours owner, but this action only requires requireOrgEditor (owner or guide) and does no canStewardBusiness check (lib/business-actions.ts:107-116; requireOwner at :38 is just requireOrgEditor). Any guide can link any business user id to a place; whether linkPlaceBusiness checks the steward was not read.",
    verified: V,
  },
  {
    id: 'elktours-business-unlink-place',
    area: 'elktours.businesses',
    label: 'Unlink a business from a place',
    does: "Removes a business from a place, keeping the link as 'former' by default.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('unlinkPlaceBusinessAction'), ['@elkdonis/services/businesses#unlinkPlaceBusiness'], '/manage/places/{id}', 'the unlink control of the Business at this place panel (' + PANEL + ')'),
    ],
    entry: null,
    status: 'the place-business link is gone or marked former',
    risk: ['public'],
    confirm: { text: 'Unlink {name} from “{title}”? It stays on file as a former link.', status: 'draft', wave: 6 },
    inputs: 'place id, business user id, keep-as-former flag',
    drift: 'None: single copy.',
    open: 'SECURITY: same gap as elktours-business-link-place: requireOrgEditor only, no canStewardBusiness (lib/business-actions.ts:119-124).',
    verified: V,
  },
  {
    id: 'elktours-business-facts-save',
    area: 'elktours.businesses',
    label: "Edit a business listing's details",
    does: "Edits a stewarded business listing's facts (name, address, website, category and the source of each fact). Only the steward org's owners.",
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa('updateBusinessFactsAction'), ['@elkdonis/services/businesses#canStewardBusiness', '@elkdonis/services/businesses#updateBusinessFacts'], '/manage/places/{id}', 'the edit form of the Business at this place panel (' + PANEL + ')'),
    ],
    entry: null,
    status: 'the business_listings row carries the new facts and a steward fact source',
    risk: ['public'],
    confirm: { text: 'Save the details of {name}? They show on the public business page.', status: 'draft', wave: 6 },
    inputs: 'business user id, facts patch',
    drift: 'None: single copy.',
    verified: V,
  },
  {
    id: 'elktours-business-remove',
    area: 'elktours.businesses',
    label: 'Remove a business listing',
    does: 'Tombstones a stewarded business listing immediately with a reason. The steward can restore it.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa('removeBusinessAction'), ['@elkdonis/services/businesses#canStewardBusiness', '@elkdonis/services/businesses#removeBusiness'], '/manage/businesses', 'the Remove control on a listing in the steward queue (' + STEW + ')'),
    ],
    entry: null,
    status: 'the business listing is tombstoned (removed) with the reason',
    risk: ['public'],
    confirm: { text: 'Remove the listing for {name}? It disappears from the network until you restore it.', status: 'draft', wave: 6 },
    inputs: 'business user id, reason',
    drift: 'None: single copy.',
    verified: V,
  },
  {
    id: 'elktours-business-restore',
    area: 'elktours.businesses',
    label: 'Restore a business listing',
    does: 'Brings back a removed listing that this org stewards.',
    class: 'person',
    actors: ['owner'],
    scope: 'org',
    hosts: [
      host(sa('restoreBusinessAction'), ['@elkdonis/services/businesses#canStewardBusiness', '@elkdonis/services/businesses#restoreBusiness'], '/manage/businesses', 'the Restore control on a removed listing (' + STEW + ')'),
    ],
    entry: null,
    status: 'the business listing is no longer tombstoned',
    risk: ['public'],
    confirm: { text: 'Restore the listing for {name}? It becomes visible on the network again.', status: 'draft', wave: 6 },
    inputs: 'business user id',
    drift: 'None: single copy.',
    verified: V,
  },
  {
    id: 'elktours-business-claim-decide',
    area: 'elktours.businesses',
    label: "Decide a business's ownership claim",
    does: "Approves or rejects someone's claim to a business listing. Owners decide in-person claims on their own shells; any other claim needs a platform admin.",
    class: 'person',
    actors: ['owner', 'admin'],
    scope: 'other',
    hosts: [
      host(sa('decideBusinessClaimAction'), ['@elkdonis/services/businesses#canDecideBusinessClaim', '@elkdonis/services/businesses#decideBusinessClaim'], '/manage/businesses', 'the Approve and Reject buttons on a claim in the steward queue (' + STEW + ')'),
    ],
    entry: null,
    status: 'the business_claims row has status approved or rejected',
    risk: ['others', 'public'],
    confirm: { text: 'Approve {person}’s claim to {name}? They will take over the listing. This is hard to reverse.', status: 'draft', wave: 6 },
    inputs: 'claim id, decision, reason',
    drift: 'None: single copy.',
    open: 'Whether the claimant is emailed on decision was not traced (inside services decideBusinessClaim). The role rule lives in services canDecideBusinessClaim; not re-read.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa('getBusinessAction'), why: 'read exposed as a server action' },
  { key: sa('listBusinessClaimsAction'), why: 'read exposed as a server action' },
  { key: sa('listStewardBusinessesAction'), why: 'read exposed as a server action' },
  { key: sa('pendingBusinessClaimsCountAction'), why: 'read: count for the manage nav badge' },
];

const area: Area = { capabilities, ignored };
export default area;
