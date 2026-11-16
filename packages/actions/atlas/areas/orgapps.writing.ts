import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.writing ----------------
  {
    id: 'writing-piece-start',
    area: 'orgapps.writing',
    label: 'Start a piece of writing',
    does: "Opens a new draft writing post owned by the signed-in person (or, on a one-artist site, the site's artist).",
    class: 'person',
    actors: [
      "person",
      "owner",
      "member",
      "guide"
    ],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/writing-actions.ts#startPieceAction',
        service: ['@elkdonis/services#createWritingPost', '@elkdonis/services#canEditProfile'],
        address: {
          app: 'ifac',
          path: '/artists/{slug}/writing',
          how: 'writing desk New piece (components/writing-views.tsx)',
        },
      },
      {
        key: 'sa:apps/artdirect/src/lib/writing-actions.ts#startPieceAction',
        service: ['@elkdonis/services#createWritingPost'],
        address: {
          app: 'artdirect',
          path: '/{slug}/writing',
          how: 'writing desk (components/oad/ManageSpace, app/[slug]/writing)',
        },
      },
      {
        key: 'sa:apps/artdirect/src/lib/writing-actions.ts#openNewPieceAction',
        service: ['@elkdonis/services#createWritingPost', '@elkdonis/services#getProfile'],
        address: {
          app: 'artdirect',
          path: '/{slug}/writing',
          how: 'writing desk (components/oad/ManageSpace, app/[slug]/writing) (create and redirect variant)',
        },
      },
      {
        key: 'sa:apps/danamccool/src/lib/writing-actions.ts#startPieceAction',
        service: ['@elkdonis/services#createWritingPost'],
        address: { app: 'danamccool', path: '/blog', how: 'blog desk (app/blog/page.tsx)' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/writing-actions.ts#startPieceAction',
        service: ['@elkdonis/services#createWritingPost', '@elkdonis/services#canEditProfile'],
        address: { app: 'innergathering', path: '/artists/{slug}/writing', how: 'writing desk' },
      },
      {
        key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#startPublishPiece',
        service: ['@elkdonis/services#ensureUniqueThreadSlug', '@elkdonis/services#getOrgFeed', '@elkdonis/db#db'],
        address: { app: 'hidden-enneagram', path: '/publish', how: 'Publish studio New piece' },
        note: 'raw INSERT in the action',
      },
      {
        key: 'sql:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#startPublishPiece',
        address: { app: 'hidden-enneagram', path: '/publish', how: 'sql twin of the above' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/studio-actions.ts#startStudioPiece",
        "service": [
          "createWritingPost"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/studio",
          "anchor": "writing-piece-start",
          "how": "The new piece control in the Studio shell (packages/studio StudioShell.tsx; wired in components/studio/StudioApp.tsx)."
        }
      },
    ],
    entry: "studio",
    status: 'a threads row kind article, status draft, author = viewer, exists',
    risk: ['none'],
    confirm: {
      text: 'Start a draft called “{title}”? Only you can see it until you publish.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'title, feed',
    drift: "Four apps wrap services createWritingPost (ifac, artdirect, danamccool, innergathering) with 'signed in' + canEditProfile(viewer, author) (author = self, or global admin); danamccool takes the author from getSiteOwnerUserId (only the owner, or an admin via canEditProfile, may write). hidden-enneagram does NOT use createWritingPost: its own copy inserts the thread with raw SQL after getApiEditor() (owner/guide only), uses its own slug and excerpt/sanitise path (@elkdonis/utils sanitizeRichText, essay renderer) so its stored rows may differ from the services path. artdirect has two start variants. Auth strengths differ by design: self for ifac/artdirect/inner, owner for dana, editor for HE.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was start-writing-piece): Third post-creation path next to createThreadAction (org compose) and registry org-publish (createThread). Writing uses createWritingPost.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
    canonical: 'services createWritingPost (+updateWritingPost) behind one shared desk action in the org-site kit; HE converts to it and drops raw SQL.',
    open: "Is hidden-enneagram's raw-SQL piece path intentionally different (essay rendering) or can it move onto services? (Justin/Ario) Security finding 2 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): the amrit-canada writing room gate is isAffiliate, so any follower can create, edit and publish (medium; high together with finding 3, org/join). Smallest fix: writer() uses viewer?.isMember.\narts-collective (start-writing-piece): Registry `studio` is status-only (\"a published piece\") and has no runner.",
    verified: '2026-11-16 read/diffed {amrit-canada,elktours,ifac,innergathering,sunjay}/lib/forms/{meeting,post}-actions.ts; {ifac,artdirect,danamccool,innergathering}/lib/writing-actions.ts; amrit-canada/lib/writing-room-actions.ts; hidden-enneagram/lib/studio/writing-actions.ts (keys and auth lines); services site-post-content.ts',
  },
  {
    id: 'writing-piece-save',
    area: 'orgapps.writing',
    label: 'Save changes to a piece of writing',
    does: 'Saves edits, publishing state and body of an existing writing post; the author, read from the row, is the only one (besides a global admin) who may change it.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/writing-actions.ts#savePieceAction',
        service: ['@elkdonis/services#updateWritingPost', '@elkdonis/services#canEditProfile'],
        address: { app: 'ifac', path: '/artists/{slug}/writing', how: 'writing desk Save / Publish' },
      },
      {
        key: 'sa:apps/artdirect/src/lib/writing-actions.ts#savePieceAction',
        service: ['@elkdonis/services#updateWritingPost'],
        address: {
          app: 'artdirect',
          path: '/{slug}/writing',
          how: 'writing desk (components/oad/ManageSpace, app/[slug]/writing)',
        },
      },
      {
        key: 'sa:apps/danamccool/src/lib/writing-actions.ts#savePieceAction',
        service: ['@elkdonis/services#updateWritingPost', '@elkdonis/services#getWritingPostById'],
        address: { app: 'danamccool', path: '/blog', how: 'blog desk (app/blog)' },
      },
      {
        key: 'sa:apps/amrit-canada/src/lib/writing-room-actions.ts#saveRoomPiece',
        service: ['@elkdonis/services#createWritingPost', '@elkdonis/services#updateWritingPost'],
        address: {
          app: 'amrit-canada',
          path: '/writing',
          how: 'Writing room (components/writing-room/writing-room.tsx)',
        },
        note: 'create-or-update in one',
      },
      {
        key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#savePublishPiece',
        service: ['@elkdonis/db#db', '@elkdonis/services#ensureUniqueThreadSlug', '@elkdonis/utils#sanitizeRichText'],
        address: { app: 'hidden-enneagram', path: '/publish', how: 'Publish studio Save' },
      },
      {
        key: 'sql:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#savePublishPiece',
        address: { app: 'hidden-enneagram', path: '/publish', how: 'sql twin of the above' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/studio-actions.ts#saveStudioPiece",
        "service": [
          "updateWritingPost",
          "listActingIdentities"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/studio",
          "anchor": "writing-piece-save",
          "how": "Autosave, and the Published / Drafts switch in packages/studio/src/writing/WritingEditor.tsx."
        },
        "note": "Gate: canEditProfile (author or acting identity)."
      },
    ],
    entry: "studio",
    status: 'the threads row has the new body and status; status published means visible on the writing page',
    risk: ['public'],
    confirm: {
      text: 'Save your changes to “{title}”? If it is published, readers see the new version.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'postId, patch (title, body, status, series)',
    drift: "Same three-line shape in ifac/artdirect/danamccool/innergathering-style desks (canEditProfile against the author read from the row); differences are only the revalidatePath set (ifac and inner revalidate /artists/<slug>/writing...; dana /blog,/hub; artdirect redirect-based). amrit-canada's writing room is gated on viewer.isAffiliate, i.e. ANY role in the org including a follower 'viewer', and revalidates /writing layout only when a status is passed. hidden-enneagram: getApiEditor (owner/guide) gate and raw SQL with its own sanitise.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was save-writing-piece): Publishing is a status field in a general patch here; the org side has publishDraftAction / thread-publish.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
    canonical: 'services updateWritingPost + canEditProfile behind one shared desk action.',
    open: "amrit-canada writing room lets any affiliate (even a follower) create and publish under the org: WEAKER than the owner/guide or author-only gates elsewhere. Intended? Security finding 2 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): the amrit-canada writing room gate is isAffiliate, so any follower can create, edit and publish (medium; high together with finding 3, org/join). Smallest fix: writer() uses viewer?.isMember.\narts-collective (save-writing-piece): Save and publish share one host. Do we want publish as its own entry so the dock can confirm only that?",
    verified: '2026-11-16 read/diffed {amrit-canada,elktours,ifac,innergathering,sunjay}/lib/forms/{meeting,post}-actions.ts; {ifac,artdirect,danamccool,innergathering}/lib/writing-actions.ts; amrit-canada/lib/writing-room-actions.ts; hidden-enneagram/lib/studio/writing-actions.ts (keys and auth lines); services site-post-content.ts',
  },
  {
    id: 'writing-piece-delete',
    area: 'orgapps.writing',
    label: 'Delete (archive) a piece of writing',
    does: 'Archives or deletes a writing post; services deleteWritingPost archives rather than removes.',
    class: 'person',
    actors: ['person', 'owner', 'guide'],
    scope: 'person',
    hosts: [
      {
        key: 'sa:apps/ifac/src/lib/writing-actions.ts#deletePieceAction',
        service: ['@elkdonis/services#deleteWritingPost'],
        address: { app: 'ifac', path: '/artists/{slug}/writing', how: 'writing desk Delete' },
      },
      {
        key: 'sa:apps/artdirect/src/lib/writing-actions.ts#deletePieceAction',
        service: ['@elkdonis/services#deleteWritingPost'],
        address: {
          app: 'artdirect',
          path: '/{slug}/writing',
          how: 'writing desk (components/oad/ManageSpace, app/[slug]/writing) Delete',
        },
      },
      {
        key: 'sa:apps/danamccool/src/lib/writing-actions.ts#deletePieceAction',
        service: ['@elkdonis/services#deleteWritingPost', '@elkdonis/services#getWritingPostById'],
        address: { app: 'danamccool', path: '/blog', how: 'blog desk (app/blog) Delete' },
      },
      {
        key: 'sa:apps/amrit-canada/src/lib/writing-room-actions.ts#deleteRoomPiece',
        service: ['@elkdonis/services#deleteWritingPost', '@elkdonis/services#getWritingPostById'],
        address: {
          app: 'amrit-canada',
          path: '/writing',
          how: 'Writing room (components/writing-room/writing-room.tsx) Delete',
        },
      },
      {
        key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#removePublishPiece',
        service: ['(local helper; no @elkdonis call resolved)'],
        address: { app: 'hidden-enneagram', path: '/publish', how: 'Publish studio Remove' },
      },
      {
        "key": "sa:apps/arts-collective/src/lib/studio-actions.ts#removeStudioPiece",
        "service": [
          "deleteWritingPost"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/studio",
          "anchor": "writing-piece-delete",
          "how": "The remove control on a piece in the Studio list (StudioShell / WritingEditor)."
        }
      },
    ],
    entry: null,
    status: 'the threads row status is archived (not listed)',
    risk: ['irreversible', 'public'],
    confirm: { text: 'Remove “{title}” from {org}’s writing? It will no longer be listed.', status: 'draft', wave: 3 },
    inputs: 'postId',
    drift: "Same author-from-row check in ifac/artdirect/danamccool; amrit uses the affiliate gate (see writing-piece-save open); HE uses getApiEditor.\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (ifac, arts-collective). Differences by app:\n- arts-collective (was delete-writing-piece): no drift recorded",
    canonical: 'services deleteWritingPost behind one shared desk action.',
    open: "Security finding 2 (docs/open/mcp-foundations/ATLAS_SECURITY_2026-11-16.md): the amrit-canada writing room gate is isAffiliate, so any follower can create, edit and publish (medium; high together with finding 3, org/join). Smallest fix: writer() uses viewer?.isMember.\narts-collective (delete-writing-piece): Hard delete or soft archive? Not checked in deleteWritingPost.",
    verified: '2026-11-16 read/diffed {amrit-canada,elktours,ifac,innergathering,sunjay}/lib/forms/{meeting,post}-actions.ts; {ifac,artdirect,danamccool,innergathering}/lib/writing-actions.ts; amrit-canada/lib/writing-room-actions.ts; hidden-enneagram/lib/studio/writing-actions.ts (keys and auth lines); services site-post-content.ts',
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#sitePostContextAction', why: 'read: post form context' },
  { key: 'sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#sitePostListAction', why: 'read: lists posts for the picker' },
  { key: 'sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#sitePostLoadAction', why: 'read: loads a post for the form' },
  { key: 'sa:apps/elktours/src/lib/forms/meeting-actions.ts#sitePostContextAction', why: 'read: post form context' },
  { key: 'sa:apps/elktours/src/lib/forms/meeting-actions.ts#sitePostListAction', why: 'read: lists posts for the picker' },
  { key: 'sa:apps/elktours/src/lib/forms/meeting-actions.ts#sitePostLoadAction', why: 'read: loads a post for the form' },
  { key: 'sa:apps/ifac/src/lib/forms/meeting-actions.ts#sitePostContextAction', why: 'read: post form context' },
  { key: 'sa:apps/ifac/src/lib/forms/meeting-actions.ts#sitePostListAction', why: 'read: lists posts for the picker' },
  { key: 'sa:apps/ifac/src/lib/forms/meeting-actions.ts#sitePostLoadAction', why: 'read: loads a post for the form' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#sitePostContextAction', why: 'read: post form context' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#sitePostListAction', why: 'read: lists posts for the picker' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#sitePostLoadAction', why: 'read: loads a post for the form' },
  { key: 'sa:apps/sunjay/src/lib/forms/post-actions.ts#sitePostContextAction', why: 'read: post form context' },
  { key: 'sa:apps/sunjay/src/lib/forms/post-actions.ts#sitePostListAction', why: 'read: lists posts for the picker' },
  { key: 'sa:apps/sunjay/src/lib/forms/post-actions.ts#sitePostLoadAction', why: 'read: loads a post for the form' },
  { key: 'sa:apps/ifac/src/lib/writing-actions.ts#loadPieceListingAction', why: 'read: current listings' },
  { key: 'sa:apps/artdirect/src/lib/writing-actions.ts#loadPieceListingAction', why: 'read: current listings' },
  { key: 'sa:apps/innergathering/src/lib/writing-actions.ts#loadPieceListingAction', why: 'read: current listings' },
  { key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#listPublishIdentities', why: 'read' },
  { key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#listPublishPieces', why: 'read' },
  { key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#listPublishSeries', why: 'read' },
  { key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#loadPublishPiece', why: 'read' },
  { key: 'sa:apps/hidden-enneagram/src/lib/studio/writing-actions.ts#searchPublishThreads', why: 'read: search' },
  { key: 'sa:apps/sunjay/src/lib/puck/writing-actions.ts#pieceChoicesAction', why: 'read: Puck chooser list' },
  { key: 'sa:apps/sunjay/src/lib/puck/writing-actions.ts#pieceDrawAction', why: 'read: Puck chooser draws a piece for display' },
  { key: 'sa:apps/sunjay/src/lib/puck/writing-actions.ts#pieceSourcesAction', why: 'read: Puck chooser sources' },
];

export default { capabilities, ignored } satisfies Area;
