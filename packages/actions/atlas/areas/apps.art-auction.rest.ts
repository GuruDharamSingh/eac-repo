import type { Area, Capability, Host, HostKey } from '../types';

// art-auction, the last three hosts left for the page-editing families (round 3, 2026-11-16; agent G left them for E).
// Conventions: atlas/JOURNAL.md. Ids are `market-` (the app’s own prefix; ids are unique across files).

const APP = 'art-auction';
const SRC = 'apps/art-auction/src/';
const V = '2026-11-16 read apps/art-auction/src/{lib/store-panel/actions.ts,app/api/galleries/[id]/items/route.ts,app/panel/[orgSlug]/page.tsx,components/panel/panel-editor.tsx}, packages/page-builder user-store.ts and user-page-key.ts, services user-pages.ts (submitUserPage) and galleries.ts (updateOwnGalleryItems, updateUserGallery)';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });

const capabilities: Capability[] = [
  {
    id: 'market-store-panel-save',
    area: 'art-auction.panels',
    label: 'Save a store panel draft',
    does: 'A signed-in person saves the Puck design of their own store panel for one organisation (page key store:1, store:2 ...). It is always a draft: saving never puts anything live, and a saved edit of a published panel returns it to draft.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      h(sa('lib/store-panel/actions.ts', 'saveStorePanel'), ['@elkdonis/page-builder/server#saveUserPage'], '/panel/{org}', 'the Publish button of the Puck header in components/panel/panel-editor.tsx (onPublish, line 129)', 'Gate: signed in (getCurrentUserId). The row is keyed to the viewer, never to an id from input.'),
    ],
    entry: null,
    status: "a user_pages row for (user, org, key) holds the saved data with status draft",
    risk: ['none'],
    confirm: { text: 'Save your draft of the store panel for {org}? It does not go live until you submit it and {org} approves it.', status: 'draft', wave: 6 },
    inputs: 'orgId, key, Puck data',
    drift: 'Same page-builder writer (saveUserPage) as the ArtDirect person pages (artdirect-person-page-draft-save) and the IFAC store panels; this is the art-auction copy of the editor page.',
    canonical: 'page-builder saveUserPage',
    open: 'SECURITY (check): saveStorePanel and submitStorePanel take orgId from the caller and never check that the person belongs to that organisation or that it hosts panels at SAVE time (app/panel/[orgSlug]/page.tsx has no membership check either; its comment says the editor is deliberately open). saveUserPage (user-store.ts:110-149) validates the key (isValidUserPageKey), sanitises rich text, validates the page shape and caps size at 512 KB, so a stranger can store drafts keyed to themselves for any org id that exists. Whether that is intended depends on the org review queue (see market-store-panel-submit).',
    verified: V,
  },
  {
    id: 'market-store-panel-submit',
    area: 'art-auction.panels',
    label: 'Submit a store panel for review',
    does: 'The person asks the organisation to look at their saved panel; it moves from draft to pending and appears in the organisation’s review queue. Works only when the organisation hosts designed store panels.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      h(sa('lib/store-panel/actions.ts', 'submitStorePanel'), ['@elkdonis/services#orgHostsStorePanels', '@elkdonis/services#submitUserPage'], '/panel/{org}', 'the Submit for review button of the panel side box (components/panel/panel-editor.tsx, line 112)', 'Gate: signed in; orgHostsStorePanels(orgId) true; the UPDATE is by (user, org, key) and only from draft or archived.'),
    ],
    entry: null,
    status: "the user_pages row for (user, org, key) has status pending",
    risk: ['public', 'others'],
    confirm: { text: 'Send your store panel to {org} for review? Their guides will look at it before it appears on their site.', status: 'draft', wave: 6 },
    inputs: 'orgId, key',
    drift: 'Same as the IFAC and arts-collective submission flow (arts-collective.hub:decide-submission is the reviewing half).',
    canonical: 'services submitUserPage',
    open: 'SECURITY (check): neither this action nor submitUserPage (user-pages.ts:96-115) checks that the submitter is a member of the organisation, so any signed-in account can put a draft in the review queue of any organisation that has switched member_store_panels on; the guides approve it by clicking, with the person’s display name and avatar shown (listPendingUserPages). Review is the only control, and a page contains only Puck blocks (validated and sanitised), not scripts. Decide whether non-members may submit.',
    verified: V,
  },
  {
    id: 'market-gallery-items-save',
    area: 'art-auction.panels',
    label: 'Save the layout of your own gallery',
    does: 'A signed-in person reorders, resizes or edits the items of one of their own galleries from the gallery grid block, which posts to this fixed route.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      h(api('app/api/galleries/[id]/items/route.ts', 'PATCH'), ['@elkdonis/services#updateOwnGalleryItems'], '/{page with a gallery grid block}', 'the drag and resize controls of the gallery-grid block (packages/blocks/src/blocks/gallery-grid.client.tsx, fetch to /api/galleries/{id}/items)', 'Gate: signed in; updateOwnGalleryItems compares gallery.userId with the viewer (galleries.ts:462-471).'),
    ],
    entry: null,
    status: 'user_galleries.items for the gallery equals the sent layout and updated_at moved',
    risk: ['public'],
    confirm: { text: 'Save the new arrangement of your gallery “{title}”? Visitors see it at once if the gallery is public.', status: 'draft', wave: 6 },
    inputs: 'gallery id, items [{url, caption, size ...}]',
    drift: 'The gallery items writer is also reached from each org site’s gallery actions (orgapps.cms gallery rows, ifac saveGalleryAction); every app offering the block mounts this same fixed route.',
    canonical: 'services updateOwnGalleryItems',
    open: 'The owner check is right and runs before the write. Item urls and fields go through asGalleryItems (not read in this round); asGalleryItems (galleries.ts:122-150) keeps at most MAX_ITEMS items and refuses any url that is not a platform-relative path (absolute and protocol-relative urls are dropped), so the stored-url concern raised for the ifac and artdirect copies does not apply here. A malformed body answers 400, any refusal answers 403 (including a missing gallery).',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
