import type { Area, Capability, Host, HostKey } from '../types';

// elktours member and network routes: sign-up, the Center (profile, photo, follow, layout, quotes), General Chat, the
// forum dispatcher and phone forum routes, the group's documents, ideas and whiteboard, uploads, analytics pulse.
// 2026-11-16, round 2 curator (elktours). Roles (lib/auth.ts): getViewer, getApiMember = owner, guide or member (a
// follower with the viewer role is NOT a member), getApiEditor = owner or guide.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const V = '2026-11-16 read app/api/{auth/signup,center/*,chat/*,forum/[action],hub/{documents,ideas,whiteboard,forum/*}},pulse,upload,upload/forum}/route.ts, lib/auth.ts, lib/forum-data.ts, lib/forum.ts, lib/chat-api.ts, packages/forum-ui/src/actions.ts (cases), cms-ui hub/connectors.ts (callers)';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const sqr = (p: string, m: string): HostKey => `sql:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string, kase?: string): Host => ({ key, service, address: { app: APP, path, how }, note, ...(kase ? { case: kase } : {}) });
const caseHost = (kase: string, service: string[], how: string, note?: string): Host => host(api('forum/[action]', 'POST'), service, '/forum', how, note, kase);
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const FORUM = 'packages/forum-ui (board and topic pages)';
const FORUM_SVC = '@elkdonis/forum-ui#handleForumAction';

const capabilities: Capability[] = [
  // ---------------- account and center ----------------
  // ---------------- chat ----------------
  // ---------------- forum ----------------
  {
    id: 'elktours-forum-topic-audience',
    area: 'elktours.hub-api',
    label: 'Change who can read a topic',
    does: 'The author (or a moderator) changes a topic\'s audience between everyone, followers and just the author.',
    class: 'person',
    actors: ['person'],
    scope: 'thread',
    hosts: [
      host(api('hub/forum/audience', 'POST'), ['@/lib/forum-data#audienceAction', 'setTopicAudience'], '/hub', 'the audience control on a topic in the phone forum (components/mobile/forum-phone.tsx)'),
    ],
    entry: null,
    status: "the topic's visibility equals the chosen audience",
    risk: ['public'],
    confirm: { text: 'Let {state} read “{title}”? The change takes effect at once.', status: 'draft', wave: 6 },
    inputs: 'thread id, audience',
    drift: 'None: single copy.',
    open: 'No auth in the route; setTopicAudience checks the author or moderator (not re-read here).',
    verified: V,
  },
  {
    id: 'elktours-forum-prefs',
    area: 'elktours.hub-api',
    label: 'Choose how the forum looks',
    does: 'Sets the reader preferences (theme, light or dark, text size, board or cards) as cookies. Works signed out.',
    class: 'internal',
    actors: ['visitor'],
    scope: 'person',
    hosts: [
      caseHost('set-theme', [FORUM_SVC], 'the forum display settings (' + FORUM + ')', 'writes cookies only'),
    ],
    status: 'forum_theme / forum_mode / forum_size / forum_layout cookies are set',
    risk: ['none'],
    inputs: 'theme, mode, size, layout',
    drift: 'None.',
    verified: V,
  },
  // ---------------- group documents, ideas, whiteboard ----------------
  // ---------------- uploads ----------------
  {
    id: 'elktours-upload-media',
    area: 'elktours.hub-api',
    label: 'Upload a file for the site',
    does: "An editor uploads an image (25 MB), audio (150 MB), video (500 MB) or document (50 MB) into the org's Nextcloud Media folders, public or members only, and gets a /api/media address. The bytes are checked, not only the MIME string.",
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(api('upload', 'POST'), ['@elkdonis/services#uploadFile', '@elkdonis/utils#validateUploadBuffer', 'raw SQL INSERT media'], '/manage', 'the file choosers in the composer and the media field (components/manage/media-field.tsx, materials-field.tsx, asset-panel.tsx)'),
    ],
    status: 'a media row for the org exists with the stored path and a file in Nextcloud',
    risk: ['public'],
    inputs: 'file, visibility, title',
    drift: 'Close to the inner-gathering route; /api/upload/forum is a narrower copy for followers.',
    canonical: 'one shared upload route in services with a policy per role',
    open: 'Good: editors only, validateUploadBuffer on the bytes (SVG refused), caps per kind. The media row insert is in a try that returns 500 AFTER the file was uploaded, so a DB failure leaves an orphan file. visibility is taken from the form field as sent (editors only).',
    verified: V,
  },
  {
    id: 'elktours-upload-forum-media',
    area: 'elktours.hub-api',
    label: 'Add a photo or video to a forum post',
    does: 'A follower or member adds a photo (15 MB) or video (100 MB) to a topic, reply or feed post. Photos have their location data removed. Followers-only and author-only posts are stored privately. Limited to 20 uploads per 10 minutes per person.',
    class: 'internal',
    actors: ['person'],
    scope: 'person',
    hosts: [
      host(api('upload/forum', 'POST'), ['@elkdonis/services#uploadFile', '@elkdonis/utils#validateUploadBuffer', '@/lib/assets#stripImageMetadata', 'raw SQL INSERT media'], '/forum', 'the attach buttons of the topic and reply forms (packages/forum-ui attach.tsx)'),
      twin(sqr('upload/forum', 'POST'), api('upload/forum', 'POST')),
    ],
    status: 'a media row for the org exists with the stored path',
    risk: ['public'],
    inputs: 'file, audience',
    drift: 'Narrower sibling of elktours-upload-media.',
    canonical: 'one shared upload route in services with a policy per role',
    open: 'SECURITY: the rate limit is an in-memory Map per server process (app/api/upload/forum/route.ts:27-37): it resets on every restart and does not hold across more than one instance, and old entries are never pruned. A follower can store up to 100 MB videos (only byte-sniffed, not re-encoded) 20 times per window. Good: images are EXIF-stripped and re-encoded; private audiences go to the Private tree; DB insert failure is swallowed (file kept without a row).',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

const area: Area = { capabilities, ignored };
export default area;
