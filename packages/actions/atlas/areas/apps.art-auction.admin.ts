import type { Area, Capability, Host, HostKey } from '../types';

// art-auction, marketplace keepers and network admin: /admin (stores, applications, artworks, money, loft, pages),
// payouts, and the site's own content pages (welcome letter, About, landing hero, landing loft). 2026-11-16, agent G.
// Conventions: atlas/JOURNAL.md. Gates: requireAdmin = network admin; requireKeeper = admin or owner of the market
// org; canEditHome / canEditAbout = canCreateSeries on the market org (owner of the market org or admin).
// Left for agent E: lib/store-panel/actions.ts (puck user pages), lib/puck/actions.ts, api/galleries/[id]/items,
// orders/[id]/shipping-actions.ts.

const APP = 'art-auction';
const SRC = 'apps/art-auction/src/';
const V = '2026-11-16 read app/admin/**/actions.ts, lib/marketplace-auth.ts, lib/{home-hero,about-content,home-sections}.ts, app/{about,home}-actions, api/about/media, packages/commerce server/ledger.ts';
const sa = (p: string, fn: string): HostKey => `sa:${SRC}${p}#${fn}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const api = (p: string, m: string): HostKey => `api:${SRC}${p}#${m}` as HostKey;
const AD = 'app/admin/actions.ts';
const h = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const MONEY = 'the Money tab (app/admin/money/money-panels.tsx)';

const capabilities: Capability[] = [
  {
    id: 'store-application-approve', area: 'art-auction.admin', label: 'Approve a store application',
    does: 'A network admin approves an artist\'s store application so the store goes live.',
    class: 'admin', actors: ['admin'], scope: 'person',
    hosts: [h(sa('app/admin/applications/actions.ts', 'approveApplicationAction'), ['@elkdonis/commerce/server#approveStore'], '/admin/applications', 'the Approve button (app/admin/applications/application-actions.tsx)', 'Gate: requireAdmin.')],
    risk: ['public', 'emails'], drift: 'adminReactivateStore calls the same approveStore with the keeper gate.',
    open: 'Whether the applicant is emailed on approval was not traced.', verified: V,
  },
  {
    id: 'store-application-reject', area: 'art-auction.admin', label: 'Reject a store application',
    does: 'A network admin rejects a store application with a reason.',
    class: 'admin', actors: ['admin'], scope: 'person',
    hosts: [h(sa('app/admin/applications/actions.ts', 'rejectApplicationAction'), ['@elkdonis/commerce/server#rejectStore'], '/admin/applications', 'the Reject button (app/admin/applications/application-actions.tsx)', 'Gate: requireAdmin; a reason is required.')],
    risk: ['others', 'emails'], verified: V,
  },
  {
    id: 'store-pause', area: 'art-auction.admin', label: 'Pause or reactivate a store',
    does: 'A marketplace keeper pauses a store (its work leaves browse and it takes no new orders; nothing is deleted) or reactivates it.',
    class: 'admin', actors: ['admin', 'owner'], scope: 'org',
    hosts: [
      h(sa(AD, 'adminPauseStore'), ['@elkdonis/commerce/server#pauseStore'], '/admin/stores', 'the Pause button (app/admin/stores/page.tsx)', 'Gate: requireKeeper (admin or market owner).'),
      h(sa(AD, 'adminReactivateStore'), ['@elkdonis/commerce/server#approveStore'], '/admin/stores', 'the Reactivate button (app/admin/stores/page.tsx)', 'Gate: requireKeeper. Reuses approveStore.'),
    ],
    risk: ['public', 'others', 'money'],
    drift: 'Two hosts, one service pair; reactivate is approveStore, the same call as approving an application.',
    open: 'Pausing a store with a live auction lot: not traced whether the lot is closed or bids stay open. Keepers (any owner of the market org) can pause any store, a wider group than the money tabs.', verified: V,
  },
  {
    id: 'artwork-hide', area: 'art-auction.admin', label: 'Hide or show an artwork on the site',
    does: 'A marketplace keeper hides one artwork from the public site (reversible) or shows it again.',
    class: 'admin', actors: ['admin', 'owner'], scope: 'org',
    hosts: [
      h(sa(AD, 'adminHideArtworkAction'), ['@elkdonis/commerce/server#adminHideArtwork'], '/admin/artworks', 'the Hide button (app/admin/artworks/page.tsx)', 'Gate: requireKeeper.'),
      h(sa(AD, 'adminShowArtworkAction'), ['@elkdonis/commerce/server#adminShowArtwork'], '/admin/artworks', 'the Show button (app/admin/artworks/page.tsx)', 'Gate: requireKeeper.'),
    ],
    risk: ['public'], open: 'Hiding a piece that is a live auction lot: not traced.', verified: V,
  },
  {
    id: 'payout-record', area: 'art-auction.admin', label: 'Record a payout',
    does: 'A network admin records that money was sent to an artist, an organisation or a beneficiary (outside the app: an eTransfer or other). The payable balance falls by the amount; beneficiaries get a follow-up statement email.',
    class: 'admin', actors: ['admin'], scope: 'person',
    hosts: [
      h(sa(AD, 'adminRecordPayout'), ['@elkdonis/commerce/server#recordPayout', '@elkdonis/commerce/server#sendPaidProceedsStatements'], '/admin/money', `the Record payout form on ${MONEY}`, 'Gate: requireAdmin.'),
      h(sa('app/series/[slug]/manage/orders/actions.ts', 'recordArtistPayoutAction'), ['@elkdonis/commerce/server#recordPayout', '@elkdonis/commerce/server#isNetworkAdmin', '@elkdonis/commerce/server#canEditSeries'], '/series/{slug}/manage/money', 'the Record payout control in the series money tab (app/series/[slug]/manage/orders/orders-panel.tsx)', 'Gate: network admin AND series editor (admins are always editors).'),
    ],
    risk: ['money', 'irreversible', 'emails'],
    drift: 'Two hosts, one service. The series copy only pays artists (kind user), the admin copy also orgs and payees.',
    canonical: '@elkdonis/commerce/server#recordPayout',
    open:
      'CORRECTNESS: recordPayout reads the balance (getBalance) and then inserts the payout and ledger row in a separate transaction, with no lock between the check and the write. Two payouts submitted at once (double click, two admins) can both pass the "amount <= payable" check and overpay. Wrap the balance read in the same transaction with a row lock on the party. The amount comes from the client in major units, rounded and bounded only by that balance (a NaN is rejected by the > 0 check). It only records; no money moves, so the admin must have sent it by hand first. The series copy lets the caller name any artistUserId, not only artists of that series (bounded by balance).',
    verified: V,
  },
  {
    id: 'payout-hold-release', area: 'art-auction.admin', label: 'Release held money',
    does: 'A network admin releases a held ledger entry (money held until a seller finished payout setup or a condition cleared) so it becomes payable.',
    class: 'admin', actors: ['admin'], scope: 'person',
    hosts: [h(sa(AD, 'adminReleaseHold'), ['@elkdonis/commerce/server#releaseHold'], '/admin/money', `the Release button on ${MONEY}`, 'Gate: requireAdmin.')],
    risk: ['money'], drift: 'The arts-collective hub has the same step as release-hold (releaseHoldAction).', canonical: '@elkdonis/commerce/server#releaseHold',
    verified: V,
  },
  {
    id: 'marketplace-settings-save', area: 'art-auction.admin', label: 'Save marketplace money settings',
    does: 'A network admin sets the default commission rate, the soft-close minutes and the payment window, and may apply the commission to all stores.',
    class: 'admin', actors: ['admin'], scope: 'org',
    hosts: [h(sa(AD, 'adminSaveMarketplaceSettings'), ['@elkdonis/commerce/server#updateMarketplaceSettings'], '/admin/money', `the Settings form on ${MONEY}`, 'Gate: requireAdmin.')],
    risk: ['money'],
    open: 'The commission rate is Number()-cast from the client and range-checked only in the service (not read here; resolveCommissionPercent falls back to 5 when out of 0..100). applyToStores overwrites every store\'s own rate. The payment window setting is NOT used by buyNowLot or settleExpiredLots, which hard-code 72 h.',
    verified: V,
  },
  {
    id: 'payee-approve', area: 'art-auction.admin', label: 'Approve a beneficiary payee',
    does: 'A network admin approves a charity or beneficiary payee so listings can send money to it.',
    class: 'admin', actors: ['admin'], scope: 'org',
    hosts: [h(sa(AD, 'adminApprovePayee'), ['@elkdonis/commerce/server#approvePayee'], '/admin/money', `the Approve payee button on ${MONEY}`, 'Gate: requireAdmin.')],
    risk: ['money'], drift: 'Same as approve-payee in arts-collective.hub (approvePayeeAction).', canonical: '@elkdonis/commerce/server#approvePayee',
    verified: V,
  },
  // ---------------- site content ----------------
  {
    id: 'home-welcome-save', area: 'art-auction.site', label: 'Save the welcome letter',
    does: 'Saves the welcome letter shown above the landing hero.',
    class: 'person', actors: ['owner', 'admin'], scope: 'org',
    hosts: [
      h(sa('app/home-actions.ts', 'saveWelcomeAction'), ['(lib) saveWelcome'], '/', 'the Edit button on the welcome letter (components/home-welcome.tsx)', 'Gate: canEditHome (owner of the market org or admin).'),
      { key: sq('lib/home-sections.ts', 'saveValue'), note: 'raw upsert into site_config (key welcome)' },
    ],
    entry: null, status: "a site_config row (org market, key welcome) holds the new content", risk: ['public'],
    confirm: { text: 'Save the welcome letter? Everyone who opens the home page will see it.', status: 'draft', wave: 4 },
    drift: 'Bespoke to art-auction; the other org sites edit page content through puck / direct editing (agent E).',
    open: 'cleanWelcome sanitises content (not read); a site_config upsert has no version history.', verified: V,
  },
  {
    id: 'about-page-save', area: 'art-auction.site', label: 'Save the About page',
    does: 'Saves the whole About page (sections, text, media links).',
    class: 'person', actors: ['owner', 'admin'], scope: 'org',
    hosts: [
      h(sa('app/about/actions.ts', 'saveAboutAction'), ['(lib) saveAbout'], '/about', 'the Save button of the About editor (app/about/about-editor.tsx)', 'Gate: canEditAbout (owner of the market org or admin).'),
      { key: sq('lib/about-content.ts', 'saveAbout'), note: 'raw upsert of the About json' },
    ],
    entry: null, status: 'the About content row holds the new content', risk: ['public'],
    confirm: { text: 'Save the About page? Everyone who opens it will see the changes.', status: 'draft', wave: 4 },
    drift: 'Bespoke; see home-welcome-save.', verified: V,
  },
  {
    id: 'home-hero-save', area: 'art-auction.site', label: 'Choose the artists featured on the landing hero',
    does: 'Saves which stores the landing hero features. Site owners and admins can, and so can an editor of a series from its Features page.',
    class: 'person', actors: ['owner', 'admin', 'guide'], scope: 'org',
    hosts: [
      h(sa('app/admin/pages/hero-actions.ts', 'saveHeroAction'), ['(lib) saveHeroSettings', '@elkdonis/commerce/server#canEditSeries'], '/admin/pages', 'the Save button of the hero form (app/admin/pages/hero-form.tsx)', 'Gate: canEditHome, or canEditSeries for the series named in viaSeriesSlug.'),
      { key: sq('lib/home-hero.ts', 'saveHeroSettings'), note: 'raw upsert into site_config' },
    ],
    entry: null, status: 'the hero settings hold the chosen store ids', risk: ['public'],
    confirm: { text: 'Feature these artists on the landing page? Everyone who opens the home page will see them first.', status: 'draft', wave: 4 },
    drift: 'Close to featured-person capabilities in the org apps (agent E).',
    open: 'A series editor (even a contributor-level editor member) can change the whole site\'s landing hero by passing a series slug they edit; the store ids are not checked against the series. Wider than the stated "site owners" gate.', verified: V,
  },
  {
    id: 'landing-loft-save', area: 'art-auction.site', label: 'Save the landing loft',
    does: 'Saves the hanging and lighting of the 3D landing-page loft (the installation that is the landing scene).',
    class: 'person', actors: ['owner', 'admin'], scope: 'org',
    hosts: [
      h(sa('app/admin/loft/actions.ts', 'saveLandingLayoutAction'), ['(lib) saveInstallationLayout'], '/admin/loft', 'the autosave of the loft editor (app/admin/loft/landing-loft-editor.tsx)', 'Gate: getPagesEditor, and the id must be the landing installation.'),
      h(sa('app/admin/loft/actions.ts', 'saveLandingSceneAction'), ['(lib) saveInstallationScene'], '/admin/loft', 'the lighting controls of the loft editor (app/admin/loft/landing-loft-editor.tsx)', 'Same gate.'),
    ],
    entry: null, status: 'the landing installation holds the saved layout and scene (a draft, not yet public)', risk: ['none'],
    confirm: { text: 'Save your changes to the landing loft? Visitors do not see them until you put it on the landing page.', status: 'draft', wave: 4 },
    drift: 'Same lib functions as installation-layout-save and installation-scene-save with an org scope instead of a store scope.', verified: V,
  },
  {
    id: 'landing-loft-publish', area: 'art-auction.site', label: 'Put the loft on the landing page',
    does: 'Publishes a snapshot of the landing loft so visitors see it on the home page.',
    class: 'person', actors: ['owner', 'admin'], scope: 'org',
    hosts: [h(sa('app/admin/loft/actions.ts', 'publishLandingAction'), ['(lib) publishLanding'], '/admin/loft', 'the Put on the landing page button (app/admin/loft/landing-loft-editor.tsx)', 'Gate: getPagesEditor and landing installation id.')],
    entry: null, status: 'the landing snapshot has a new published time', risk: ['public'],
    confirm: { text: 'Put this loft on the landing page? Everyone who opens the home page will see it.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'landing-loft-revert', area: 'art-auction.site', label: 'Go back to the published landing loft',
    does: 'Resets the editor to what visitors currently see.',
    class: 'person', actors: ['owner', 'admin'], scope: 'org',
    hosts: [h(sa('app/admin/loft/actions.ts', 'revertLandingAction'), ['(lib) revertLanding'], '/admin/loft', 'the Go back button (app/admin/loft/landing-loft-editor.tsx)', 'Gate: getPagesEditor and landing installation id.')],
    entry: null, status: 'the working loft equals the published snapshot', risk: ['irreversible'],
    confirm: { text: 'Throw away your unpublished changes to the landing loft? You cannot get them back.', status: 'draft', wave: 4 },
    drift: 'Single copy.', verified: V,
  },
  {
    id: 'about-media-upload', area: 'art-auction.site', label: 'Upload About page media',
    does: 'Stores an image or video for the About page in the uploader\'s public media folder. Owners of the market org and admins only.',
    class: 'internal', actors: ['owner', 'admin'], scope: 'org',
    hosts: [h(api('app/api/about/media/route.ts', 'POST'), ['@elkdonis/services#uploadFile', '@elkdonis/utils#validateUploadBuffer'], '/api/about/media', 'no visible control: the About editor posts here (app/about/about-editor.tsx)', 'Gate: canEditAbout.')],
    risk: ['public'], drift: 'Same shape as series-media-upload and artwork-image-upload; stored without a Private segment, so public by design.', verified: V,
  },
];

export default { capabilities, ignored: [] } satisfies Area;
