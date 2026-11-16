import type { Area, Host, HostKey } from '../types';

// Direct-edit and Puck page saves in the org apps (lib/puck/*), plus the small per-app editors:
// innergathering page edits, ifac hub skin, ifac/artdirect profile-editor saves, sunjay event detail pages.
// Arts-collective's own puck/actions.ts is owned by other agents.

const V =
  '2026-11-16 read/diffed apps/{sunjay,elktours,hidden-enneagram,katie-the-potter,innergathering,danamccool,art-auction}/src/lib/puck/actions.ts; sunjay,elktours,innergathering puck/store.ts deletePage; elktours puck/mobile-actions.ts saveMobileDocAction; sunjay puck/event-actions.ts; innergathering page-edits{,-actions}.ts; ifac hub-skin-{actions,store}.ts; ifac vs artdirect profile-editor-actions.ts (diff); page-builder store.ts savePage';
const sa = (p: string, s: string) => `sa:apps/${p}#${s}` as HostKey;
const sq = (p: string, s: string) => `sql:apps/${p}#${s}` as HostKey;
const PA = (a: string) => `${a}/src/lib/puck/actions.ts`;
const h = (key: HostKey, app: string, path: string, how: string, service: string[], note?: string): Host => ({ key, service, address: { app, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, note: `sql twin of ${of}` });
const EDITOR = '(getApiEditor: signed in and canEdit = owner or guide)';
const SAVE = '@elkdonis/page-builder/server#savePage (validates the path, sanitises rich text, checks shape and size, writes site_config puck:<slug>)';

export default {
  capabilities: [
    {
      id: 'page-save',
      area: 'orgapps.editing',
      label: 'Publish a page from the visual editor',
      does: "Saves the page the person has been editing on the canvas (blocks, layout, words) so visitors see it at its address.",
      class: 'person',
      actors: [
      "owner",
      "guide",
      "member"
    ],
      scope: 'org',
      hosts: [
        h(sa(PA('sunjay'), 'savePageAction'), 'sunjay', '/studio/{slug}', 'Publish in the direct-edit canvas (lib/puck editor; /manage/builder lists pages)', [EDITOR, 'slugProblem (valid slug, not reserved, not a feed; templates allowed)', 'cleanBoxDoc(stripResolved)', SAVE], 'revalidates the whole layout when the slug is a template'),
        h(sa(PA('elktours'), 'savePageAction'), 'elktours', '/studio/{slug}', 'Publish in the direct-edit canvas', [EDITOR, 'slugProblem (valid, not reserved, not a feed)', 'cleanBoxDoc(stripResolvedKeys)', SAVE]),
        h(sa(PA('hidden-enneagram'), 'savePageAction'), 'hidden-enneagram', '/studio/{slug}', 'Publish in the direct-edit canvas', [EDITOR, '(isValidSlug and not ROUTE_SLUGS)', 'cleanBoxDoc(stripResolvedKeys)', SAVE]),
        h(sa(PA('katie-the-potter'), 'savePageAction'), 'katie-the-potter', '/studio/{slug}', 'Publish in the direct-edit canvas', [EDITOR, 'cleanBoxDoc(stripResolvedKeys)', SAVE], 'no slug check in the action (savePage still validates the path); revalidates /pieces/[slug] for the piece template'),
        h(sa(PA('innergathering'), 'savePageAction'), 'innergathering', '/p/{slug}', 'Publish in the direct-edit canvas', [EDITOR, 'cleanBoxDoc', SAVE], 'no stripResolved, no reserved-slug check; revalidates /p/<slug> only'),
        h(sa(PA('danamccool'), 'savePageAction'), 'danamccool', '/manage', 'Publish in the Puck editor', ['(getViewer().canEdit)', SAVE], 'no cleanBoxDoc, no stripResolved, no reserved-slug check: raw data to savePage'),
        h(sa(PA('art-auction'), 'savePageAction'), 'art-auction', '/pages/{slug}', 'Publish in the page editor', ['(getPagesEditor from lib/puck/auth)', 'slugProblem (valid, not reserved)', 'stripResolved', SAVE], 'a different gate (getPagesEditor) and no cleanBoxDoc'),
        {
          "key": "sa:apps/elktours/src/lib/experience-actions.ts#saveExperiencePageAction",
          "service": [
            "isExperiencePerson",
            "raw SQL UPDATE threads"
          ],
          "address": {
            "app": "elktours",
            "path": "/studio/experience/{id}",
            "how": "the Publish button of the layout studio for one experience (components/studio/layout-studio.tsx via publishExperiencePageAction)"
          }
        },
        {
          "key": "sql:apps/elktours/src/lib/experience-actions.ts#saveExperiencePageAction",
          "service": [
            "raw SQL"
          ],
          "note": "twin of sa:apps/elktours/src/lib/experience-actions.ts#saveExperiencePageAction"
        },
        {
          "key": "sa:apps/elktours/src/app/studio/actions.ts#publishExperiencePageAction",
          "service": [
            "readExperienceLayout",
            "saveExperiencePageAction"
          ],
          "address": {
            "app": "elktours",
            "path": "/studio/experience/{id}",
            "how": "the Publish button of the layout studio (components/studio/layout-studio.tsx)"
          },
          "note": "wrapper: requires getApiEditor, so only editors reach it from /studio today; the artist-allowed path is the inner action called directly"
        },
        {
          "key": "sa:apps/elktours/src/lib/puck/mobile-actions.ts#saveMobileDocAction",
          "service": [
            "(getApiEditor: signed in and canEdit = owner or guide)",
            "(isMobileKey)",
            "cleanBoxDoc(stripResolvedKeys)",
            "local savePage"
          ],
          "address": {
            "app": "elktours",
            "path": "/studio/m-{name}",
            "how": "Publish in the phone studio"
          }
        },
      ],
      entry: null,
      status: "site_config row puck:<slug> for the org holds the saved document (page-builder loadPage returns it)",
      risk: ['public'],
      confirm: { text: 'Publish your changes to the {slug} page on {org}? Visitors will see the new version straight away.', status: 'draft', wave: 1 },
      inputs: 'slug, document',
      drift:
        "Seven near-copies of a 10-30 line action over one shared store (page-builder savePage, which validates the path, sanitises rich text, validates shape and caps size, so every copy is protected at the store). They differ in: (1) the gate: getApiEditor in five (owner/guide), danamccool getViewer().canEdit (same set), art-auction getPagesEditor (its own rule, not read); (2) cleaning before save: cleanBoxDoc + stripResolvedKeys in elktours, HE, katie; cleanBoxDoc + stripResolved in sunjay; cleanBoxDoc only in innergathering; stripResolved only in art-auction; none in danamccool (so resolved/preview data can end up stored there); (3) slug rules: sunjay and elktours refuse reserved slugs and feed slugs, HE refuses ROUTE_SLUGS, art-auction reserved, katie, innergathering and danamccool accept any valid path (a page could shadow a name the site's routes own, though Next routes usually win); (4) revalidatePath: each its own (/ , /<slug>, /p/<slug>, layout for templates). Arts-collective equivalent: see apps/arts-collective keys.\nMerged 2026-11-16 (consolidation 2): 3 rows, 2 apps (sunjay, elktours). Differences by app:\n- elktours (was elktours-experience-page-save): Puck page save for tours goes through savePage in publishTourLayoutAction; experiences write metadata.page directly.\n- elktours (was mobile-page-save): Single copy (elktours); same shape as page-save restricted to isMobileKey; revalidates the mapped path.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
      canonical:
        'one shared action in the planned org-site kit: gate getApiEditor, services/page-builder savePageContent that does cleanBoxDoc + stripResolved(config RESOLVED_KEYS) + reserved-slug and feed check (hooks per app), then savePage and revalidate by a per-app route map.',
      open: "danamccool, innergathering and katie skip the reserved-slug check and (danamccool) the cleaning step; art-auction uses its own editor gate. Is any of that deliberate?\nelktours (elktours-experience-page-save): The action layer allows a linked artist to write the layout (lib/experience-actions.ts:190) while the studio wrapper is editor-only (app/studio/actions.ts:47); size is capped at 1 MB. Layout JSON is passed through readExperienceLayout in the wrapper only, so a direct caller of the inner action stores the Puck data as sent (structure checked, blocks not).",
      verified: V,
    },
    {
      id: 'landing-save',
      area: 'orgapps.editing',
      label: 'Publish the home page tree',
      does: 'Saves the home page as a designed tree from the canvas, instead of the version written in code.',
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        h(sa(PA('sunjay'), 'saveLandingAction'), 'sunjay', '/?edit', 'Publish on the home page in direct-edit', [EDITOR, 'cleanBoxDoc(stripResolved)', 'local savePage']),
        h(sa(PA('elktours'), 'saveLandingAction'), 'elktours', '/?edit', 'Publish on the home page in direct-edit', [EDITOR, 'cleanBoxDoc(stripResolvedKeys)', 'local savePage']),
      ],
      entry: null,
      status: "site_config puck:<landing slug> holds the tree",
      risk: ['public'],
      confirm: { text: "Publish your changes to {org}'s home page? Visitors will see them straight away.", status: 'draft', wave: 1 },
      inputs: 'document',
      drift: 'Same as page-save with a fixed slug. sunjay revalidates "/", elktours does not revalidate at all (the home page may stay stale until its cache expires).',
      canonical: 'the page-save kit action with slug = LANDING_SLUG.',
      open: 'elktours saveLandingAction has no revalidatePath: is the home page uncached?',
      verified: V,
    },
    {
      id: 'landing-restore',
      area: 'orgapps.editing',
      label: 'Put the home page back as it was written in code',
      does: 'Deletes the saved home page tree so the site shows the original code-written home page again.',
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        ...(['sunjay', 'elktours', 'innergathering'] as const).flatMap((a) => [
          h(sa(PA(a), 'restoreLandingAction'), a, '/?edit', 'Restore original in the direct-edit menu', [EDITOR, 'local deletePage']),
          h(sq(`${a}/src/lib/puck/store.ts`, 'deletePage'), a, '/?edit', 'deletePage in lib/puck/store.ts', ['@elkdonis/db#withOrg', '(raw DELETE site_config puck:<slug>)'], 'called by restoreLandingAction'),
        ]),
      ],
      entry: null,
      status: 'no site_config puck:<landing slug> row',
      risk: ['irreversible', 'public'],
      confirm: { text: "Throw away your designed home page for {org} and show the original again? Your design cannot be brought back.", status: 'draft', wave: 1 },
      drift: "Three copies. sunjay revalidates '/', elktours and innergathering do not. No history is kept of the deleted tree in any of them, so Restore is a hard delete of the person's design.",
      canonical: 'page-builder deletePage(orgId, slug) plus a one-step undo (keep the last version), behind a kit action.',
      open: 'Should Restore keep a copy so it can be undone?',
      verified: V,
    },
    {
      id: 'page-edits-save',
      area: 'orgapps.editing',
      label: 'Save edits to the home page text',
      does: "Saves the patches (changed text and images) laid over the home page's fixed layout.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        h(sa('innergathering/src/lib/page-edits-actions.ts', 'savePageEditsAction'), 'innergathering', '/?edit', 'Save in the page-edits direct editor', ['(getViewer().canEdit)', '(page allow-list: home only)', '@elkdonis/direct-edit/block#cleanPatches', 'local savePageEdits']),
        h(sq('innergathering/src/lib/page-edits.ts', 'savePageEdits'), 'innergathering', '/?edit', 'page-edits.ts', ['@elkdonis/db#withOrg', '(raw INSERT site_config ON CONFLICT)'], 'called by savePageEditsAction'),
      ],
      entry: null,
      status: 'site_config page-edits row holds the patches',
      risk: ['public'],
      confirm: { text: "Save your changes to the wording on {org}'s home page? Visitors will see them.", status: 'draft', wave: 1 },
      inputs: 'page, patches',
      drift: 'Single copy (innergathering), a lighter alternative to full Puck pages (patches over fixed layout). Does not revalidate (read); the sibling actions do.',
      canonical: 'fold into page-save: one document model per site.',
      open: 'Two editing models in one app (Puck pages and patches): which survives?',
      verified: V,
    },
    {
      id: 'hub-skin-save',
      area: 'orgapps.editing',
      label: "Change the hub's look",
      does: "Chooses the visual skin of the members' hub.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        h(sa('ifac/src/lib/hub-skin-actions.ts', 'saveHubSkinAction'), 'ifac', '/manage/appearance', 'skin picker on the appearance page', ['(getHubViewer then canEdit)', 'local setHubSkin']),
        h(sq('ifac/src/lib/hub-skin-store.ts', 'setHubSkin'), 'ifac', '/manage/appearance', 'hub-skin-store.ts', ['(raw INSERT site_config hub-skin ON CONFLICT)'], 'validates skin against isHubSkin'),
      ],
      entry: null,
      status: 'site_config hub-skin value equals the chosen skin',
      risk: ['public'],
      confirm: { text: "Change the look of {org}'s hub to {skin}? Everyone who uses the hub will see it.", status: 'draft', wave: 1 },
      inputs: 'skin',
      drift: 'Single copy (ifac). Overlaps site-style-save conceptually (look of the public site vs the hub).',
      canonical: 'a hub section of the site-style kit action (services saveSiteTheme for the hub).',
      verified: V,
    },
    {
      id: 'profile-field-save',
      area: 'orgapps.editing',
      label: 'Edit my bio or photo on my page',
      does: "Saves the bio text or profile photo of an artist page from the live editor.",
      class: 'person',
      actors: ['person', 'owner'],
      scope: 'person',
      hosts: [
        h(sa('ifac/src/lib/profile-editor-actions.ts', 'saveProfileFieldAction'), 'ifac', '/artists/{slug}', 'bio in the profile editor panel (components/profile-editor-panel.tsx)', ['(getServerSession; canEditProfile = the person or a global admin)', '@elkdonis/services#updateProfile']),
        h(sa('ifac/src/lib/profile-editor-actions.ts', 'saveAvatarAction'), 'ifac', '/artists/{slug}', 'photo in profile-editor-panel.tsx', ['(canEditProfile)', '@elkdonis/services#updateProfile'], 'avatarUrl stored as sent'),
        h(sa('artdirect/src/lib/profile-editor-actions.ts', 'saveProfileFieldAction'), 'artdirect', '/{slug}', 'bio in components/oad/ProfileEditorPanel.tsx', ['(getCurrentUser; canEditProfile)', '@elkdonis/services#updateProfile']),
        h(sa('artdirect/src/lib/profile-editor-actions.ts', 'saveAvatarAction'), 'artdirect', '/{slug}', 'photo in ProfileEditorPanel.tsx', ['(canEditProfile)', '@elkdonis/services#updateProfile'], 'avatarUrl stored as sent'),
      ],
      entry: null,
      status: 'users.bio / avatar_url hold the new value',
      risk: ['public'],
      confirm: { text: 'Update your {what} on your public page? Anyone can see it.', status: 'draft', wave: 1 },
      inputs: 'profileUserId, field | avatarUrl',
      drift: "ifac and artdirect are a copy with the session lookup (getServerSession vs getCurrentUser) and revalidate paths (/artists|/dealers/<slug> vs /<slug>) swapped. Gate in both: canEditProfile (the person or a global admin), so an org owner cannot edit a member's profile here. avatarUrl is stored unvalidated (as in edit-my-profile).",
      canonical: 'services updateProfile with url validation inside, behind the edit-my-profile kit action; ownership by canEditProfile.',
      verified: V,
    },
    {
      id: 'profile-portfolio-save',
      area: 'orgapps.editing',
      label: 'Arrange the pictures on my page',
      does: "Saves the picture wall (portfolio) on an artist's page.",
      class: 'person',
      actors: ['person', 'owner'],
      scope: 'person',
      hosts: [
        h(sa('ifac/src/lib/profile-editor-actions.ts', 'saveGalleryAction'), 'ifac', '/artists/{slug}', 'components/gallery-panel.tsx', ['(canEditProfile)', '@elkdonis/services#setOrgPortfolio'], "per-org portfolio; refuses anyone not on IFAC's roster"),
        h(sa('artdirect/src/lib/profile-editor-actions.ts', 'saveGalleryAction'), 'artdirect', '/{slug}', 'components/oad/GalleryPanel.tsx', ['(canEditProfile)', '@elkdonis/services#updateProfile'], 'global portfolio on the user row'),
      ],
      entry: null,
      status: "the person's portfolio (org_profiles or users) holds the items",
      risk: ['public'],
      confirm: { text: 'Save this arrangement of pictures on your page? Visitors will see it.', status: 'draft', wave: 1 },
      inputs: 'profileUserId, items',
      drift: 'Different stores: ifac writes the per-org portfolio (setOrgPortfolio) and requires roster membership; artdirect writes the global users portfolio via updateProfile. Item urls stored as sent in both.',
      canonical: 'setOrgPortfolio (per org) behind one kit action; the global portfolio is the fallback when an org has none.',
      verified: V,
    },
    {
      id: 'gathering-detail-page-set',
      area: 'orgapps.editing',
      label: 'Turn the designed page on for a gathering',
      does: "Switches a gathering's designed detail page on or off, and makes its Talk room when it is turned on.",
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [
        h(sa('sunjay/src/lib/puck/event-actions.ts', 'setDetailPageAction'), 'sunjay', '/{feed}/{slug}', 'Detail page toggle in the gathering editor', [EDITOR, '(raw UPDATE threads metadata detailPage)', 'ensureRoom']),
        twin(sq('sunjay/src/lib/puck/event-actions.ts', 'setDetailPageAction'), sa('sunjay/src/lib/puck/event-actions.ts', 'setDetailPageAction')),
        h(sq('sunjay/src/lib/puck/event-actions.ts', 'ensureRoom'), 'sunjay', '/{feed}/{slug}', 'Talk room made when the page is switched on', ['@elkdonis/services#createTalkRoom', '(raw UPDATE threads nextcloud_talk_token)'], 'also called by createEventRoomAction'),
      ],
      entry: null,
      status: 'threads.metadata.detailPage is true; nextcloud_talk_token set',
      risk: ['public'],
      confirm: { text: 'Give “{title}” its own designed page? Visitors will see it, and a Talk room is made if none exists.', status: 'draft', wave: 1 },
      inputs: 'threadId, on',
      drift: 'Single copy (sunjay). The Talk room creation duplicates provisionNextcloud in lib/cms/actions.ts (same createTalkRoom call, same moderator promotion) and ifac attachRooms.',
      canonical: 'services ensureThreadTalkRoom(threadId) used by all three.',
      verified: V,
    },
    {
      id: 'gathering-talk-room-create',
      area: 'orgapps.editing',
      label: 'Create a Talk room for a gathering',
      does: 'Makes a Nextcloud Talk room for a gathering that has none.',
      class: 'person',
      actors: ['owner', 'guide'],
      scope: 'org',
      hosts: [h(sa('sunjay/src/lib/puck/event-actions.ts', 'createEventRoomAction'), 'sunjay', '/{feed}/{slug}', 'Create room button in the gathering editor', [EDITOR, 'ensureRoom', '@elkdonis/services#createTalkRoom'])],
      entry: null,
      status: 'threads.nextcloud_talk_token set for the id',
      risk: ['public'],
      confirm: { text: 'Create a Talk room for “{title}”? Anyone with the link can join.', status: 'draft', wave: 1 },
      inputs: 'threadId',
      drift: 'Single copy; public Talk room (type 3, listed), same as the cms provisionNextcloud.',
      canonical: 'services ensureThreadTalkRoom.',
      verified: V,
    },
  ],
  ignored: [
    { key: sa(PA('sunjay'), 'slugProblem'), why: 'read: returns the reason a slug is not allowed' },
    { key: sa(PA('elktours'), 'slugProblem'), why: 'read: returns the reason a slug is not allowed' },
    { key: sa(PA('art-auction'), 'slugProblem'), why: 'read: returns the reason a slug is not allowed' },
    { key: sa(PA('sunjay'), 'checkNewPageAction'), why: 'read: checks a new page name; the page is saved only by savePageAction' },
    { key: sa(PA('elktours'), 'checkNewPageAction'), why: 'read: checks a new page name' },
    { key: sa(PA('art-auction'), 'checkNewPageAction'), why: 'read: checks a new page name' },
    ...['mobileContentAction', 'mobileDiscoverAction', 'mobileExpSampleAction', 'mobileTourSampleAction', 'mobileToursAction'].map((s) => ({ key: sa('elktours/src/lib/puck/mobile-actions.ts', s), why: 'read: editor copy of a phone resolver (public data)' })),
    ...['mobileFeedAction', 'mobilePlacesAction', 'placePhotosAction', 'placeSheetAction', 'postSheetAction'].map((s) => ({ key: sa('elktours/src/lib/puck/mobile-overlay-actions.ts', s), why: 'read: phone overlay data for the editor and page (public data)' })),
  ],
} satisfies Area;
