import type { Area, Capability, Host, HostKey } from '../types';

// ifac member hub: documents, ideas, whiteboard, files, RSVP and meeting rota, profile sections, showcase,
// art piece, org chat, pipeline board, forum door, hub-card door. Round 2 (2026-11-16).

const V =
  '2026-11-16 read apps/ifac/src/app/api/{hub/documents,hub/ideas,hub/whiteboard,hub/files,hub/upload,hub/rsvp,hub/meeting/*,hub/profile-sections,showcase/size,chat/*,pipeline/*,forum}/route.ts, lib/{hub-auth,auth,chat-api,pipeline-api,showcase-actions}.ts, lib/cms/art-piece-actions.ts, app/hub/actions.ts, packages/pipeline/src/routes.ts';
const A = 'ifac';
const AREA = 'ifac.hub';
const k = (kind: 'sa' | 'api' | 'sql', p: string, s: string) => `${kind}:apps/ifac/src/${p}#${s}` as HostKey;
const api = (p: string, m: string) => k('api', `app/api/${p}/route.ts`, m);
const h = (key: HostKey, path: string, how: string, service: string[], note?: string, caseId?: string): Host => ({
  key,
  service,
  address: { app: A, path, how },
  ...(note ? { note } : {}),
  ...(caseId ? { case: caseId } : {}),
});
const twin = (key: HostKey, of: HostKey): Host => ({ key, note: `sql twin of ${of}` });
const cf = (text: string) => ({ text, status: 'draft' as const, wave: 6 });
const mk = (c: Omit<Capability, 'verified' | 'area'>): Capability => ({ area: AREA, verified: V, ...c });

const HUB_MEMBER = '(getHubViewer: owner, guide or member of ifac via hasOrgRole)';
const HUB_EDITOR = '(getHubViewer then viewer.canEdit = owner or guide)';
const API_MEMBER = '(getApiMember: owner, guide or member)';
const API_EDITOR = '(getApiEditor: owner or guide)';

// ---- pipeline (identical in hidden-enneagram) ----
const PIPE = (p: string, m: string) => api(`pipeline/${p}`, m);
const pipeDrift =
  'Byte-identical to the hidden-enneagram route (diffed all 16 files, identical bar org id). The routes are already a thin mount of packages/pipeline createPipelineApi; org scoping is enforced in services org-deck (OrgDeckScopeError), no board id crosses the wire.';
const pipeCanon = 'packages/pipeline createPipelineApi routes mounted once (already the shape); remove the per-app route files in favour of one catch-all mount.';
const pipeCard = (
  id: string,
  label: string,
  does: string,
  hosts: Host[],
  actors: Capability['actors'],
  risk: Capability['risk'],
  text: string,
  inputs: string,
  extra: Partial<Capability> = {},
) =>
  mk({
    id,
    label,
    does,
    class: 'person',
    actors,
    scope: 'org',
    hosts,
    entry: null,
    status: "the card exists with the saved value on the org's Nextcloud Deck board (org-deck read)",
    risk,
    confirm: cf(text),
    inputs,
    drift: pipeDrift,
    canonical: pipeCanon,
    ...extra,
  });
const PIPE_HOW = 'the pipeline board in the hub (packages/pipeline PipelineBoard / PipelineCardDialog, mounted by components/hub/HubSurfaces.tsx)';
const MEM = ['(withMember: getApiMember = owner, guide or member)'];
const EDT = ['(withEditor: getApiEditor = owner or guide)'];

const capabilities: Capability[] = [
  // ---------------- documents, ideas, whiteboard ----------------
  mk({
    id: 'ifac-document-delete',
    label: 'Remove a shared document',
    does: "Removes a document from the organisation's shared list and Nextcloud.",
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(api('hub/documents', 'DELETE'), '/hub/documents', 'remove button on a document row (app/hub/documents/page.tsx)', [HUB_EDITOR, '@elkdonis/services#deleteOrgDocument'])],
    entry: null,
    status: 'listOrgDocuments(ifac) no longer contains the document',
    risk: ['irreversible', 'others'],
    confirm: cf('Remove “{title}” for everyone at {org}? This cannot be undone.'),
    inputs: 'documentId (query)',
    drift: 'Only ifac has a DELETE; hidden-enneagram has no remove route.',
    canonical: 'services deleteOrgDocument behind the shared hub documents mount.',
  }),
  // ---------------- files ----------------
  mk({
    id: 'ifac-files-folder-create',
    label: "Make a folder in the organisation's drive",
    does: "Creates a folder in the organisation's shared Nextcloud drive.",
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(api('hub/files', 'POST'), '/hub/files', 'New folder in the files card (components/hub/FilesCard.tsx)', [HUB_EDITOR, '@elkdonis/services#createOrgFolder'], 'one POST switches on payload.action', 'createFolder')],
    entry: null,
    status: 'listOrgFiles(ifac, parent) shows the folder',
    risk: ['others'],
    confirm: cf('Make the folder “{name}” in the {org} drive? The team can see it.'),
    inputs: 'path',
    drift: 'Same capability as arts-collective create-folder/upload-org-file family at api/org/[slug]/files (owner or guide via canEditOrgSite). Path is typed by the person; services resolveOrgPath is relied on to confine it.',
    canonical: 'services createOrgFolder/deleteOrgFile behind one org-files route.',
  }),
  mk({
    id: 'ifac-files-delete',
    label: "Delete a file from the organisation's drive",
    does: "Deletes a file or folder from the organisation's shared Nextcloud drive.",
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(api('hub/files', 'POST'), '/hub/files', 'delete on a file row in the files card (components/hub/FilesCard.tsx)', [HUB_EDITOR, '@elkdonis/services#deleteOrgFile'], 'same POST as folder create', 'delete')],
    entry: null,
    status: 'listOrgFiles(ifac, parent) no longer lists the path',
    risk: ['irreversible', 'others'],
    confirm: cf('Delete “{file}” from the {org} drive? This cannot be undone.'),
    inputs: 'path',
    drift: 'Same capability as arts-collective delete-org-file (api/org/[slug]/files); role gate matches (owner or guide).',
    canonical: 'services deleteOrgFile behind one org-files route.',
  }),
  mk({
    id: 'ifac-file-upload',
    label: "Upload a file to the organisation's drive",
    does: "Puts a file (image, audio, video or document) into the organisation's shared drive, into a folder the person names or Media/<type> by default.",
    class: 'person',
    actors: ['member', 'guide', 'owner'],
    scope: 'org',
    hosts: [h(api('hub/upload', 'POST'), '/hub/files', 'Upload in the files card (components/hub/FilesCard.tsx)', [HUB_MEMBER, '@elkdonis/services#folderForMime', '@elkdonis/services#uploadOrgFile'])],
    entry: null,
    status: 'a media row for ifac with the uploaded path exists; the file is listed by listOrgFiles',
    risk: ['others'],
    confirm: cf('Upload “{file}” to the {org} drive? The team can see and open it.'),
    inputs: 'file, path (optional folder)',
    drift: "Weaker than its siblings: folder create and delete in the same card need owner or guide, but upload here accepts any member and any typed folder path. arts-collective upload-org-file is owner or guide. Bytes are not sniffed (ifac api/upload and hidden-enneagram api/upload call validateUploadBuffer); the client MIME is stored.",
    canonical: 'services uploadOrgFile behind the org-files route with one role gate and validateUploadBuffer inside the service.',
    open: 'SECURITY: apps/ifac/src/app/api/hub/upload/route.ts:53-66 any member can write to any folder of the org drive (path = form field) and the client-declared MIME is trusted (no validateUploadBuffer; services org-storage.ts:78 does not sniff either). Compare hub/files POST line 59 (editor only).',
  }),
  // ---------------- RSVP and meeting ----------------
  // ---------------- profile, showcase, art ----------------
  mk({
    id: 'ifac-showcase-pin',
    label: 'Pin or unpin a post on the showcase',
    does: 'Sets a post pinned (or not) so it leads the showcase and forum pages.',
    class: 'person',
    actors: ['guide', 'owner'],
    scope: 'thread',
    hosts: [
      h(k('sa', 'lib/showcase-actions.ts', 'setThreadPinnedAction'), '/showcase', 'pin button on a showcase card (components/showcase-grid.tsx)', [HUB_EDITOR, '(raw UPDATE threads SET pinned ... WHERE id AND org_id)']),
      twin(k('sql', 'lib/showcase-actions.ts', 'setThreadPinnedAction'), k('sa', 'lib/showcase-actions.ts', 'setThreadPinnedAction')),
    ],
    entry: null,
    status: 'threads.pinned is true for the thread (org-scoped)',
    risk: ['public'],
    confirm: cf('{state} “{title}” on the {org} showcase? Visitors see the change at once.'),
    inputs: 'threadId, pinned',
    drift: 'ifac only. Org-filtered update (good).',
    canonical: 'services setThreadPinned if other sites get a showcase.',
  }),
  mk({
    id: 'ifac-showcase-size-set',
    label: 'Choose my card size on the showcase',
    does: "Saves the person's preferred card size for their pieces on the showcase.",
    class: 'person',
    actors: ['person', 'member', 'guide', 'owner'],
    scope: 'person',
    hosts: [h(api('showcase/size', 'POST'), '/showcase', 'size switch on the showcase feed (components/showcase/ShowcaseFeed.tsx)', ['(getViewer: any signed-in person; services setShowcaseCardSize decides)', '@elkdonis/services#setShowcaseCardSize'])],
    entry: null,
    status: 'setShowcaseCardSize result for the person in ifac',
    risk: ['none'],
    confirm: cf('Make your cards {state} on the {org} showcase?'),
    inputs: 'size',
    drift: 'Action layer only requires a signed-in person; the role rule (403 text suggests one) lives in services and was not read.',
    canonical: 'services setShowcaseCardSize.',
    open: 'Not read: where setShowcaseCardSize enforces who may set it (route returns 403 on r.ok === false).',
  }),
  // ---------------- chat, pipeline, forum, hub door ----------------
  mk({
    id: 'ifac-hub-card-door',
    label: 'Hub card actions (door)',
    does: "Server action behind the hub's Members and Review cards: runs one allow-listed registry action (change role, list or unlist person, remove person, welcome or dismiss arrival, approve or decline a post from another site, decide a submission, switch review) as the signed-in person.",
    class: 'internal',
    actors: ['guide', 'owner'],
    scope: 'org',
    hosts: [h(k('sa', 'app/hub/actions.ts', 'runHubAction'), '/hub', 'Members and Review cards (components/hub/hub-card-host.tsx)', ['@elkdonis/actions/server#performHubAction (allow-list MEMBERS_ACTIONS + REVIEW_ACTIONS)', '@elkdonis/auth-server#getServerSession'])],
    status: 'depends on the entry run (org-person-role, listing-approve, submission-review, ...)',
    risk: ['others', 'public'],
    drift: 'Copy of arts-collective sites/[slug]/hub/actions.ts runTenantHubAction, which round 1 split into 9 person rows with Host.case. This door passes the same ids through performHubAction with the allow-list and a hubSite; gates live in the registry runners.',
    canonical: 'one shared hub door (packages/hub) taking the site and allow-list; claim each registry entry once with case.',
    open: 'Lead: at merge, add this host to arts-collective.hub org-person-role-set / org-person-listed-set / remove-person-from-org / welcome-arrival / dismiss-arrival / approve-post-from-other-site / decline-post-from-other-site / decide-submission / switch-submission-review as a second host per case. I did not edit those files.',
  }),
];

export default {
  capabilities,
  ignored: [
    { key: k('sa', 'lib/cms/art-piece-actions.ts', 'canListArtPieceAction'), why: 'read exposed as a server action: tells the composer whether the viewer has a store, writes nothing' },
  ],
} satisfies Area;
