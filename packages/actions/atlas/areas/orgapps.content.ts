import type { Area, Host, HostKey } from '../types';

// Personal content on org apps: member blog switch and profile sections (ifac, innergathering,
// artdirect), galleries (danamccool, ifac), the innergathering payout twins left over from blog-actions,
// and the read-only featured-person pickers (sunjay, elktours).

const V =
  '2026-11-16 read/diffed ifac/src/lib/cms/blog-actions.ts, innergathering/src/lib/cms/blog-actions.ts, ifac/src/lib/gallery-actions.ts, danamccool/src/lib/gallery-actions.ts (auth + ownedGallery + 10 of 17 bodies), sunjay vs elktours featured-person-actions.ts (diff), services canEditProfile; artdirect profile-editor-actions by key list only';
const sa = (p: string, s: string) => `sa:apps/${p}#${s}` as HostKey;
const sq = (p: string, s: string) => `sql:apps/${p}#${s}` as HostKey;
const BLOG = (a: string) => `${a}/src/lib/cms/blog-actions.ts`;
const IFG = 'ifac/src/lib/gallery-actions.ts';
const DMG = 'danamccool/src/lib/gallery-actions.ts';
const h = (key: HostKey, app: string, path: string, how: string, service: string[], note?: string): Host => ({ key, service, address: { app, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, note: `sql twin of ${of}` });

const IFAC_OWNER = ['(getServerSession; canEditProfile = the gallery owner or a global admin; owner read from the gallery row)'];
const DM_GATE = ['(getViewer().canEdit = owner or guide of danamccool; gallery must belong to the site owner user)'];

export default {
  capabilities: [
    {
      id: 'profile-blog-set',
      area: 'orgapps.content',
      label: 'Turn my blog on or off',
      does: 'Switches the Writing shelf on or off on the member\'s own page, and remembers whether it shows only pieces written here or everything they have written on the network.',
      class: 'person',
      actors: ['member', 'owner', 'guide'],
      scope: 'person',
      hosts: [
        h(sa(BLOG('ifac'), 'setBlogStateAction'), 'ifac', '/hub', 'Page sections card in the profile surface (hub); href goes to /artists|/dealers/<slug>/writing', ['(getHubViewer: any member)', '(raw UPDATE users.profile_sections jsonb merge)']),
        twin(sq(BLOG('ifac'), 'setBlogStateAction'), sa(BLOG('ifac'), 'setBlogStateAction')),
        h(sa(BLOG('innergathering'), 'setBlogStateAction'), 'innergathering', '/hub', 'Page sections panel in the profile surface; href /artists/<slug>/writing', ['(getApiMember: member or above)', '(raw UPDATE users.profile_sections jsonb merge)']),
        twin(sq(BLOG('innergathering'), 'setBlogStateAction'), sa(BLOG('innergathering'), 'setBlogStateAction')),
      ],
      entry: null,
      status: "users.profile_sections.blog is true for the person",
      risk: ['public'],
      confirm: {
        text: 'Show a Writing shelf with your pieces on your {org} page. Anyone can see it.',
        title: 'Show Writing shelf',
        status: 'approved',
        wave: 1,
      },
      inputs: 'enabled, scope (org | all)',
      drift:
        "Two near-identical copies, each a raw merged UPDATE on users.profile_sections (blog, blogScope). Differences: gate (ifac getHubViewer: a member; innergathering getApiMember: member); the written href (ifac chooses /dealers or /artists from org_profiles.tags, innergathering always /artists, wrong for any dealer). The scope value is still written but no longer read since 2026-09-26 (comment). Same concept is also toggled by profile-section-toggle (key blog) in other apps, so there are three routes to profile_sections.blog.",
      canonical: 'a services setProfileSection(userId, key, on) with an allow-list of keys (see profile-section-toggle in orgapps.people), one kit action; drop blogScope.',
      open: 'Is the blogScope setting dead now that the profile reads thread_orgs? If so stop writing it.',
      verified: V,
    },

    // ---- galleries -------------------------------------------------------
    {
      id: 'gallery-create',
      area: 'orgapps.content',
      label: 'Start a new gallery',
      does: 'Creates a gallery (a titled set of pictures) on the person\'s page. In danamccool it can also start a sub-gallery from some pictures of an existing gallery.',
      class: 'person',
      actors: ['person', 'owner', 'guide'],
      scope: 'person',
      hosts: [
        h(sa(IFG, 'createGalleryAction'), 'ifac', '/artists/{slug}', 'New gallery button in components/galleries-section.tsx', [...IFAC_OWNER, '@elkdonis/services#createUserGallery'], 'origin ifac, so it shows on IFAC'),
        h(sa(DMG, 'createGalleryAction'), 'danamccool', '/manage', 'new gallery in the galleries panel (components/hud/galleries-panel.tsx; path inferred)', [...DM_GATE, '@elkdonis/services#createUserGallery', '@elkdonis/services#updateUserGallery'], 'creates private, hidden on ifac, with folder Galleries/<slug>'),
        h(sa(DMG, 'createSubGalleryAction'), 'danamccool', '/manage', 'Make into a sub-gallery in the galleries panel', [...DM_GATE, '@elkdonis/services#createUserGallery', '@elkdonis/services#updateUserGallery'], 'also edits the parent gallery (cover opens the new one; optional move)'),
      ],
      entry: null,
      status: 'user_galleries row for the owner with that slug exists',
      risk: ['none'],
      confirm: {
        text: 'Create the gallery “{title}”. It starts private.',
        title: 'Create gallery',
        status: 'approved',
        wave: 1,
      },
      inputs: 'title, (danamccool) pagePath, or parent + chosen pictures',
      drift:
        "Same services createUserGallery, two shapes. ifac: actor is the profile owner or a global admin (canEditProfile) acting on profileUserId passed from the client, gallery starts as services default (public? not read) with origin ifac. danamccool: any owner or guide of the site acts on the SITE OWNER's galleries (getSiteOwnerUserId), so a guide edits the owner's personal galleries; starts private, hidden_on ifac, a storage folder. Different default visibility.",
      canonical: 'services createUserGallery behind one kit action taking {ownerResolver, origin, defaults}; ownership always read from the row.',
      open: 'danamccool: guides can create, edit, reorder and delete the site owner\'s personal galleries (canEdit = owner or guide). Intended?',
      verified: V,
    },
    {
      id: 'gallery-details-save',
      area: 'orgapps.content',
      label: "Change a gallery's title, description, page or privacy",
      does: "Edits a gallery's title and description, whether it is public, which page it is attached to, whether it also shows on IFAC, or its own look.",
      class: 'person',
      actors: ['person', 'owner', 'guide'],
      scope: 'person',
      hosts: [
        h(sa(IFG, 'saveGalleryFieldAction'), 'ifac', '/artists/{slug}/galleries/{gallery}', 'inline title and description in the live editor (components/gallery-editor.tsx)', [...IFAC_OWNER, '@elkdonis/services#updateUserGallery']),
        h(sa(IFG, 'setGalleryPublicAction'), 'ifac', '/artists/{slug}/galleries/{gallery}', 'Public switch in gallery-editor.tsx', [...IFAC_OWNER, '@elkdonis/services#updateUserGallery']),
        h(sa(IFG, 'saveGallerySettingsAction'), 'ifac', '/artists/{slug}/galleries/{gallery}', 'gallery look panel in gallery-editor.tsx', [...IFAC_OWNER, '@elkdonis/services#sanitizeThemeVars', '@elkdonis/services#updateUserGallery']),
        h(sa(DMG, 'updateGalleryAction'), 'danamccool', '/manage', 'gallery details in the galleries panel', [...DM_GATE, '@elkdonis/services#updateUserGallery'], 'also Show on IFAC and pagePath'),
      ],
      entry: null,
      status: 'user_galleries row has the saved title/description/is_public',
      risk: ['public'],
      confirm: {
        text: 'Make the gallery “{title}” {visibility}. Visitors to your page can see public galleries.',
        title: 'Set gallery visibility',
        status: 'approved',
        wave: 1,
      },
      inputs: 'galleryId, title|description|isPublic|settings|showOnIfac|pagePath',
      drift: 'ifac splits it into three actions (field, public, settings) with the owner-or-admin gate; danamccool has one action with owner-or-guide gate and extra fields (showOnIfac, pagePath). ifac settings go through sanitizeThemeVars; titles are length-capped in neither read copy (services decides). All call services updateUserGallery.',
      canonical: 'one kit action over services updateUserGallery with a patch object, gate by gallery ownership.',
      verified: V,
    },
    {
      id: 'gallery-items-save',
      area: 'orgapps.content',
      label: 'Change the pictures in a gallery',
      does: "Adds, removes, reorders, retitles or links the pictures of a gallery (including artworks from the catalogue in danamccool).",
      class: 'person',
      actors: ['person', 'owner', 'guide'],
      scope: 'person',
      hosts: [
        h(sa(IFG, 'saveGalleryItemsAction'), 'ifac', '/artists/{slug}/galleries/{gallery}', 'picture grid editor in components/gallery-editor.tsx', [...IFAC_OWNER, '@elkdonis/services#updateUserGallery'], 'item urls stored as sent (no /api/media/ check)'),
        h(sa(DMG, 'saveGalleryItemsAction'), 'danamccool', '/manage', 'picture arrangement in the galleries panel', [...DM_GATE, '@elkdonis/services#updateUserGallery']),
        h(sa(DMG, 'addArtworksAction'), 'danamccool', '/manage', 'Add artworks in the galleries panel', [...DM_GATE, '@elkdonis/services#updateUserGallery'], 'only the owner\'s artworks (catalogue query scoped by artist)'),
        h(sa(DMG, 'addPicturesAction'), 'danamccool', '/manage', 'Add pictures (upload / from storage)', [...DM_GATE, '@elkdonis/services#updateUserGallery'], 'only urls that start /api/media/'),
        h(sa(DMG, 'copyPicturesToGalleryAction'), 'danamccool', '/manage', 'Copy pictures into a sub-gallery', [...DM_GATE, '@elkdonis/services#updateUserGallery']),
        h(sa(DMG, 'removeGalleryPicturesAction'), 'danamccool', '/manage', 'Remove pictures from a gallery', [...DM_GATE, '@elkdonis/services#updateUserGallery']),
        h(sa(DMG, 'setGalleryItemOpensAction'), 'danamccool', '/manage', 'Open another gallery from a picture', [...DM_GATE, '@elkdonis/services#updateUserGallery']),
        h(sa(DMG, 'updateGalleryItemTextAction'), 'danamccool', '/manage', 'edit a picture\'s title, subtitle and link', [...DM_GATE, '@elkdonis/services#updateUserGallery', '@elkdonis/services#cleanGalleryLink']),
      ],
      entry: null,
      status: 'user_galleries.items holds the new list',
      risk: ['public'],
      confirm: {
        text: 'Save changes to the pictures in “{title}”. Visible to visitors if the gallery is public.',
        title: 'Save gallery pictures',
        status: 'approved',
        wave: 1,
      },
      inputs: 'galleryId, items | artworkIds | pictures | keys | opens | text patch',
      drift: "danamccool has eight fine-grained actions that each read the gallery, rewrite items and call updateUserGallery; ifac has one replace-all saveGalleryItemsAction. Image URL validation differs: danamccool addPictures requires /api/media/ and link text goes through cleanGalleryLink; ifac saves item urls as sent (so a public gallery can hot-link any URL). All routes end in services updateUserGallery.",
      canonical: 'one kit saveGalleryItems(galleryId, items) over services updateUserGallery with url validation inside services; the fine-grained operations become client-side helpers that compute the new list.',
      open: 'ifac gallery item urls are not validated (danamccool restricts to /api/media/): should services reject non-media urls?',
      verified: V,
    },
    {
      id: 'gallery-delete',
      area: 'orgapps.content',
      label: 'Delete a gallery',
      does: "Deletes a gallery. Its picture files and artworks stay in storage.",
      class: 'person',
      actors: ['person', 'owner', 'guide'],
      scope: 'person',
      hosts: [
        h(sa(IFG, 'deleteGalleryAction'), 'ifac', '/artists/{slug}/galleries/{gallery}', 'Delete in gallery-editor.tsx', [...IFAC_OWNER, '@elkdonis/services#deleteUserGallery']),
        h(sa(DMG, 'deleteGalleryAction'), 'danamccool', '/manage', 'Delete in the galleries panel', [...DM_GATE, '@elkdonis/services#deleteUserGallery']),
      ],
      entry: null,
      status: 'no user_galleries row for the id',
      risk: ['irreversible', 'public'],
      confirm: {
        text: 'Delete the gallery “{title}”. Pictures stay in your files; the page is removed. Cannot be undone.',
        title: 'Delete gallery',
        status: 'approved',
        wave: 1,
      },
      inputs: 'galleryId',
      drift: 'Same services deleteUserGallery; gate differs as in gallery-create (profile owner or global admin in ifac, owner or guide of the site in danamccool). Hard delete of the row in both (not read in services).',
      canonical: 'services deleteUserGallery behind the kit action.',
      verified: V,
    },
    {
      id: 'gallery-reorder',
      area: 'orgapps.content',
      label: 'Reorder my galleries',
      does: "Saves the order the person's galleries are listed in.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'person',
      hosts: [h(sa(DMG, 'reorderGalleriesAction'), 'danamccool', '/manage', 'drag to reorder in the galleries panel', [...DM_GATE, '@elkdonis/services#reorderUserGalleries'])],
      entry: null,
      status: 'user_galleries.sort_order follows the saved order',
      risk: ['public'],
      confirm: {
        text: 'Save this gallery order. Visitors see galleries in this order.',
        title: 'Reorder galleries',
        status: 'approved',
        wave: 1,
      },
      inputs: 'orderedIds',
      drift: 'Single copy (danamccool). ifac has no reorder.',
      canonical: 'services reorderUserGalleries.',
      verified: V,
    },
  ],
  ignored: [
    // featured-person pickers: sunjay and elktours (byte-identical but for two comments)
    ...(['sunjay', 'elktours'] as const).flatMap((a) =>
      ['personSourcesAction', 'personChoicesAction', 'personWhoAction', 'opensSourcesAction', 'opensChoicesAction', 'opensDrawAction'].map((s) => ({
        key: sa(`${a}/src/lib/featured-person-actions.ts`, s),
        why: 'read: the editor\'s "From what?" lists and a value\'s preview, gated by getApiEditor; no write (featured-person-actions is byte-identical in sunjay and elktours but for two dates in comments)',
      })),
    ),
    ...['gatheringChoicesAction', 'gatheringDrawAction', 'gatheringSourcesAction'].map((s) => ({ key: sa('sunjay/src/lib/puck/gathering-actions.ts', s), why: 'read: puck picker data for gatherings' })),
    ...['guideChoicesAction', 'guideDrawAction', 'guideSourcesAction'].map((s) => ({ key: sa('sunjay/src/lib/puck/profile-actions.ts', s), why: 'read: puck picker data for guides' })),
    ...['serviceChoicesAction', 'serviceDrawAction', 'serviceSourcesAction'].map((s) => ({ key: sa('sunjay/src/lib/puck/service-actions.ts', s), why: 'read: puck picker data for services' })),
    { key: sa(BLOG('ifac'), 'getBlogStateAction'), why: 'read: blog switch state' },
    { key: sa(BLOG('innergathering'), 'getBlogStateAction'), why: 'read: blog switch state' },
    { key: sa(BLOG('innergathering'), 'getStoreStateAction'), why: 'read: whether the member has a store' },
    { key: sa(BLOG('innergathering'), 'loadProfilePageAction'), why: 'read: profile popup data, sections plus payout and earnings state' },
    { key: sa(DMG, 'listGalleriesForHud'), why: 'read: galleries for the manager' },
    { key: sa(DMG, 'listCatalogueForHud'), why: 'read: catalogue for the manager' },
    { key: sa(DMG, 'getGalleryForHud'), why: 'read: one gallery for the manager' },
    { key: sa(DMG, 'galleryUploadTarget'), why: 'read: the slug uploads go to' },
    { key: sa(DMG, 'galleryForPageAction'), why: 'read: the gallery linked to a page (raw SELECT)' },
  ],
} satisfies Area;
