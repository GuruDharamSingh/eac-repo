import type { Area, Capability } from '../types';

const capabilities: Capability[] = [
  // ---------------- orgapps.meetings ----------------
  {
    id: 'meeting-save',
    area: 'orgapps.meetings',
    label: 'Save a meeting or event',
    does: "Creates or updates a meeting or event on the org's calendar (draft or published) from the shared compose pop-up. Events are meetings with kind 'event'.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction',
        service: ['@elkdonis/services#saveMeetingContent', '@elkdonis/site-forms/server#siteOrg'],
        address: {
          app: 'sunjay',
          path: '/hub?surface=compose:meeting',
          how: 'compose:meeting pop-up, Save / Publish button (components/hub/HubSurfaces via lib/forms/site.tsx)',
        },
      },
      {
        key: 'sa:apps/sunjay/src/lib/forms/event-actions.ts#siteEventSaveAction',
        service: ['(delegates to siteMeetingSaveAction with kind:"event")'],
        address: { app: 'sunjay', path: '/hub?surface=compose:event', how: 'compose:event pop-up' },
        note: 'wrapper only: forces kind event, then the meeting action',
      },
      {
        key: 'sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction',
        service: ['@elkdonis/services#saveMeetingContent', '@elkdonis/site-forms/server#siteOrg'],
        address: { app: 'amrit-canada', path: '/hub?surface=compose:meeting', how: 'compose:meeting pop-up' },
      },
      {
        key: 'sa:apps/elktours/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction',
        service: ['@elkdonis/services#saveMeetingContent', '@elkdonis/site-forms/server#siteOrg'],
        address: { app: 'elktours', path: '/hub?surface=compose:meeting', how: 'compose:meeting pop-up' },
      },
      {
        key: 'sa:apps/ifac/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction',
        service: ['@elkdonis/services#saveMeetingContent', '@elkdonis/site-forms/server#siteOrg'],
        address: { app: 'ifac', path: '/hub/compose', how: 'compose:meeting|event pop-up and /hub/compose page' },
      },
      {
        key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteMeetingSaveAction',
        service: ['@elkdonis/services#saveMeetingContent', '@elkdonis/site-forms/server#siteOrg'],
        address: { app: 'innergathering', path: '/hub?surface=compose:meeting', how: 'compose:meeting pop-up' },
        note: 'also forwards input.metadata (showCycleBadge) as sent',
      },
      {
        "key": "sa:apps/arts-collective/src/lib/meeting-actions.ts#saveMeetingAction",
        "service": [
          "saveMeetingContent"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/studio/make",
          "anchor": "meeting-save",
          "how": "The Meeting kind in the Studio create canvas (packages/studio/src/meeting; wired in StudioApp.tsx)."
        }
      },
    ],
    entry: "org-publish",
    status: 'a threads row of kind meeting|event exists for the org with the given slug and status published (meeting-content load)',
    risk: ['public', 'emails'],
    confirm: {
      text: 'Save the {kind} “{title}” on {org}’s calendar for {when}? If it is published, visitors can see it, and people on the list may get an email.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'title, when, place/online, feed, audience, hosts, talk room, document',
    drift: "Four-way near-copy. sunjay, amrit-canada, elktours are byte-identical in logic (amrit and elktours differ only in one comment line). ifac differs: viewer comes from getHubViewer (member-or-above, role checked by hasOrgRole) instead of getViewer; context action forces canShareToNetwork false; the href is /hub/meetings/<slug> not /<feed>/<slug>; revalidatePath is /hub, /, /hub/meetings/<slug> only (others: /, /hub, /manage, /<section>, /<section>/<slug>). innergathering adds input.metadata passthrough and a workshop family. The ACTION-layer gate in every copy is only 'signed in' (and, in ifac, 'member'); the real owner-or-guide rule lives in services saveMeetingContent / meetingComposeContext, so the services function is the only auth boundary. sunjay's siteMeetingSaveAction does not call siteMeetingLoadAction first, so an edit by id relies wholly on services checking authorship and org. Arts-collective equivalent: see apps/arts-collective keys (other agents).\nMerged 2026-11-16 (consolidation 2): 2 rows, 2 apps (sunjay, arts-collective). Differences by app:\n- arts-collective (was save-meeting): meeting-actions.ts is copied in six apps; the org-publish entry has a \"meeting\" kind option but only saves a plain draft post.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
    canonical: "services saveMeetingContent behind one shared 'use server' action in the planned org-site kit (packages/org-site) taking {siteConfig, viewerResolver, hrefFor(record), revalidate(record)} so only the route templates are per-app.",
    open: "WEAKER AT ACTION LAYER (not exploitable if services checks): every copy only requires a session before calling saveMeetingContent; confirm services saveMeetingContent itself rejects non-owner/guide and cross-org ids (read meeting-content.ts around line 572). ifac revalidates fewer paths so public pages may lag.\narts-collective (save-meeting): Registry org-publish kind=meeting is not what this does (full meeting record).",
    verified: '2026-11-16 read/diffed apps/{sunjay,amrit-canada,elktours,ifac,innergathering}/src/lib/forms/{meeting,series,event}-actions.ts, services meeting-content.ts, apps/*/src/lib/auth.ts, ifac hub-auth.ts',
  },
  {
    id: 'org-series-create',
    area: 'orgapps.meetings',
    label: 'Start a new series',
    does: 'Creates a recurring series of sessions for the org through the shared series form; the person then edits it in the planner.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'series',
    hosts: [
      {
        key: 'sa:apps/sunjay/src/lib/forms/series-actions.ts#siteSeriesCreateAction',
        service: ['@elkdonis/services#createSiteSeries', '@elkdonis/site-forms/server#siteOrg'],
        address: { app: 'sunjay', path: '/hub/series', how: 'series pop-up Create button; then opens plannerHref' },
      },
      {
        key: 'sa:apps/ifac/src/lib/forms/series-actions.ts#siteSeriesCreateAction',
        service: ['@elkdonis/services#createSiteSeries', '@elkdonis/site-forms/server#siteOrg'],
        address: { app: 'ifac', path: '/hub/series', how: 'series pop-up Create button' },
      },
    ],
    entry: null,
    status: 'a series row for the org with the given title exists (planner lists it)',
    risk: ['public'],
    confirm: {
      text: 'Start a new series called “{title}” for {org}? It shows on the calendar as sessions are added.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'title, lede, schedule, zones',
    drift: 'Near-identical. Both check siteOrg and viewer.canEdit (sunjay via getViewer().canEdit; ifac via getHubViewer, which is member-gated first, then canEdit = owner or guide). Differences: the extra display zones (sunjay [siteConfig.timeZone]; ifac hard-coded ALSO_ZONES Los_Angeles/New_York/Paris), and revalidatePath (sunjay /hub,/hub/series,/manage; ifac adds /). Auth is equally strong in both (explicit canEdit).',
    canonical: 'services createSiteSeries behind the shared org-site kit action; zones from siteConfig.',
    verified: '2026-11-16 read/diffed apps/{sunjay,amrit-canada,elktours,ifac,innergathering}/src/lib/forms/{meeting,series,event}-actions.ts, services meeting-content.ts, apps/*/src/lib/auth.ts, ifac hub-auth.ts',
  },
  {
    id: 'workshop-save',
    area: 'orgapps.meetings',
    label: 'Save a workshop offering',
    does: 'Creates or updates a workshop offering (a thread of kind workshop) through the shared workshop form, and shares its materials folder with the author.',
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      {
        key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteWorkshopSaveAction',
        service: [
          '@elkdonis/services#upsertWorkshopOffering',
          '@elkdonis/services#ensureWorkshopMaterialsFolder',
          '@elkdonis/services#workshopInputFromAnswers',
          '@elkdonis/db#db (autosave status read)',
        ],
        address: { app: 'innergathering', path: '/hub?surface=compose:workshop', how: 'compose:workshop pop-up' },
        note: 'only host; autosave guard is an inline SELECT on threads',
      },
      {
        "key": "sa:apps/arts-collective/src/lib/cms/actions.ts#saveWorkshopAction",
        "service": [
          "upsertWorkshopOffering",
          "ensureWorkshopMaterialsFolder"
        ],
        "address": {
          "app": "arts-collective",
          "path": "/hub/workshops/{org}/guided",
          "anchor": "workshop-save",
          "how": "The final Save step of components/hub/GuidedWorkshopWizard.tsx, or Save in components/hub/WorkshopForm.tsx (/hub/workshops/{org}/new)."
        }
      },
      {
        "key": "sa:apps/innergathering/src/lib/cms/workshop-actions.ts#saveWorkshopAction",
        "service": [
          "@elkdonis/services#upsertWorkshopOffering",
          "@elkdonis/services#ensureWorkshopMaterialsFolder"
        ],
        "address": {
          "app": "innergathering",
          "path": "/hub?surface=compose:workshop",
          "how": "the Save / Publish button of the workshop compose pop-up (components/hub/HubSurfaces.tsx, compose-workspace.tsx)"
        }
      },
    ],
    entry: null,
    status: "a threads row kind='workshop' for the org exists with the slug and status published",
    risk: ['public'],
    confirm: {
      text: 'Save the workshop “{title}” on {org}’s site? If it is published, visitors can see it.',
      status: 'draft',
      wave: 3,
    },
    inputs: 'workshop answers (title, dates, price, section)',
    drift: "Single copy (innergathering only), but the only one that checks canEdit in the action itself and does a raw SELECT in the action for the autosave guard; the other meeting actions leave that to services. Its autosave guard is hand-written here rather than in services.\nMerged 2026-11-16 (consolidation 2): 3 rows, 2 apps (innergathering, arts-collective). Differences by app:\n- arts-collective (was save-workshop): no drift recorded\n- innergathering (was ig-workshop-save): also revalidates /, the section, the piece and /hub; same service call.\nDirection (Justin, 2026-11-16): copy-per-page forms are giving way to inline on-page editing (the house editor). The canonical should be the house-editor / hub path, not a per-app /manage form.",
    canonical: 'services upsertWorkshopOffering plus the autosave guard moved into services (as meeting and post already do).',
    verified: '2026-11-16 read/diffed apps/{sunjay,amrit-canada,elktours,ifac,innergathering}/src/lib/forms/{meeting,series,event}-actions.ts, services meeting-content.ts, apps/*/src/lib/auth.ts, ifac hub-auth.ts',
    open: "arts-collective (save-workshop): On edit it returns a warning that enrolled attendees should be told; nothing sends. Should the confirm warn?",
  },
];

const ignored: Area['ignored'] = [
  { key: 'sa:apps/sunjay/src/lib/forms/meeting-actions.ts#siteMeetingContextAction', why: 'read: builds the compose form context, writes nothing' },
  { key: 'sa:apps/sunjay/src/lib/forms/meeting-actions.ts#siteMeetingLoadAction', why: 'read: loads a meeting for the form' },
  { key: 'sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#siteMeetingContextAction', why: 'read: builds the compose form context, writes nothing' },
  { key: 'sa:apps/amrit-canada/src/lib/forms/meeting-actions.ts#siteMeetingLoadAction', why: 'read: loads a meeting for the form' },
  { key: 'sa:apps/elktours/src/lib/forms/meeting-actions.ts#siteMeetingContextAction', why: 'read: builds the compose form context, writes nothing' },
  { key: 'sa:apps/elktours/src/lib/forms/meeting-actions.ts#siteMeetingLoadAction', why: 'read: loads a meeting for the form' },
  { key: 'sa:apps/ifac/src/lib/forms/meeting-actions.ts#siteMeetingContextAction', why: 'read: builds the compose form context, writes nothing' },
  { key: 'sa:apps/ifac/src/lib/forms/meeting-actions.ts#siteMeetingLoadAction', why: 'read: loads a meeting for the form' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteMeetingContextAction', why: 'read: builds the compose form context, writes nothing' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteMeetingLoadAction', why: 'read: loads a meeting for the form' },
  { key: 'sa:apps/sunjay/src/lib/forms/event-actions.ts#siteEventContextAction', why: 'read: delegates to siteMeetingContextAction' },
  { key: 'sa:apps/sunjay/src/lib/forms/event-actions.ts#siteEventLoadAction', why: 'read: delegates to siteMeetingLoadAction' },
  { key: 'sa:apps/sunjay/src/lib/forms/series-actions.ts#siteSeriesContextAction', why: 'read: can this viewer start a series' },
  { key: 'sa:apps/ifac/src/lib/forms/series-actions.ts#siteSeriesContextAction', why: 'read: can this viewer start a series' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteWorkshopContextAction', why: 'read: workshop form context' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteWorkshopListAction', why: 'read: lists workshops (raw SELECT)' },
  { key: 'sa:apps/innergathering/src/lib/forms/meeting-actions.ts#siteWorkshopLoadAction', why: 'read: loads a workshop for the form' },
];

export default { capabilities, ignored } satisfies Area;
