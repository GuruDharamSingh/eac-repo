import type { Area, Capability, Host, HostKey } from '../types';

// packages/series-site: the shared series-site kit mounted by apps/sunjay and apps/ifac (reminder tick, org media upload).
// 2026-11-16, round 3 curator (packages). Both hosts are sql writes inside package code the apps mount:
//  - reminders: createSeriesReminders(site).runReminderTick, started from each app's instrumentation.ts (sunjay
//    instrumentation.ts:19-21 and ifac lib/reminders.ts);
//  - mediaUploadRoutes(site).POST, re-exported by apps/sunjay and apps/ifac `app/api/media/upload/route.ts`. Those
//    one-line route files are not inventory hosts, so this sql key is the only trace of the route.

const SRC = 'packages/series-site/src/';
const V = (files: string) => `2026-11-16 read packages/series-site/src/${files}, apps/{sunjay,ifac} instrumentation.ts and api/media/upload/route.ts`;
const sql = (file: string, fn: string): HostKey => `sql:${SRC}${file}#${fn}` as HostKey;
const h = (file: string, fn: string, service: string[], note?: string): Host => ({ key: sql(file, fn), service, ...(note ? { note } : {}) });

const capabilities: Capability[] = [
  {
    id: 'pkg-series-site-reminders',
    area: 'series-site.reminders',
    label: 'Send the series\' due attendee and subscriber reminders',
    does: 'On a timer, finds series sessions whose reminder window has opened, claims a thread_reminder_sends ledger row (once per thread, occurrence and kind), then emails everyone who said yes (the day-before and soon letters) or the series\' subscribers (the next week\'s letter).',
    class: 'system',
    actors: ['system'],
    scope: 'series',
    hosts: [
      h('lib/reminders.ts', 'runAttendeeReminders', ['email#sendReminderEmail', '(raw INSERT thread_reminder_sends, UPDATE recipients)'], 'Claim is INSERT ... ON CONFLICT DO NOTHING RETURNING before any send.'),
      h('lib/reminders.ts', 'runSubscriberReminders', ['email#sendReminderEmail', 'services#getMeetingSeries', 'services#listSeriesSubscribers', '(raw INSERT thread_reminder_sends, UPDATE recipients)'], 'Same claim, kind subscribers, per week.'),
    ],
    status: 'thread_reminder_sends has a row for (thread, occurrence, kind) with recipients',
    risk: ['emails'],
    drift: 'mounted by apps/sunjay (instrumentation.ts runs createSeriesReminders next to its own runReminderTick, apps.sunjay.audience:sunjay-reminders-send) and apps/ifac (lib/reminders.ts is createSeriesReminders). Host reminders (runHostReminders) claim through services claimHostReminder, not raw SQL here. Related: apps.sunjay.audience:sunjay-reminder-set (the window).',
    canonical: 'packages/series-site lib/reminders.ts#createSeriesReminders (one shared tick)',
    open: 'GOOD: the claim is atomic, so several instances or a restart cannot double-send. SECURITY (reliability): the claim is written BEFORE the sends, so a crash or an email outage after the claim and before the update leaves recipients 0 and the letter is never retried (same as sunjay-reminders-send); a failed send to one attendee is caught per recipient and does not stop the others (good), but is not retried. Subscribers are mailed only through the series unsubscribe link in each letter (reminderSettingsUrl), not through contacts, so an org-list suppression (pkg-email-events-ingest) is not consulted by this path: not verified whether sendReminderEmail itself checks contacts.status. The attendee letter\'s join link goes to every yes RSVP; the subscriber letter withholds it until the person said yes (by design).',
    verified: V('lib/reminders.ts'),
  },
  {
    id: 'pkg-series-site-media-upload',
    area: 'series-site.media',
    label: 'Upload a file into the organisation\'s media folder',
    does: 'An owner or guide, or the member who hosts a given week, uploads an image, audio, video or document (25 to 500 MB by type) into the org\'s Nextcloud media tree and records a media row so the library picker offers it.',
    class: 'internal',
    actors: ['owner', 'guide', 'member'],
    scope: 'org',
    hosts: [{
      key: sql('routes/mediaUpload.ts', 'POST'),
      service: ['services#uploadFile', 'services#isOccurrenceHost', 'utils#validateUploadBuffer', '(raw INSERT media)'],
      address: { app: 'sunjay', path: '/api/media/upload', how: 'the media picker of the compose surface and the week page\'s in-place editor, posting to /api/media/upload (apps/sunjay and apps/ifac app/api/media/upload/route.ts re-export mediaUploadRoutes(site).POST)' },
      note: 'The sql twin stands for the whole route (the api: host is not inventoried because the app route file only re-exports). Same route in apps/ifac.',
    }],
    status: 'a media row for the org with the url and nextcloud_path',
    risk: ['public'],
    drift: 'same family as apps.sunjay.audience:sunjay-media-upload and the other org upload routes (internal, each with its own policy); this one is the series-site copy used by sunjay and ifac, and adds the week-host path (a member who hosts the occurrence may upload).',
    canonical: 'one upload route in services with a per-app policy object (types, sizes, who)',
    open: 'GOOD: the real bytes are classified (validateUploadBuffer refuses SVG, which passes the client MIME test), size caps per type, and the host path re-reads meeting_hosts rather than trusting the client. SECURITY: (1) `visibility` is whitelisted to PUBLIC, ORGANIZATION or INVITE_ONLY, but the stored media row has no visibility column here (the path carries it), so a later library read can list a private file by org alone: not checked in the picker. (2) A week host (a plain member) can upload public files into the org\'s media tree for that week and only the thread and host are checked, not a per-user quota. (3) The media row insert failing is swallowed (the file exists in Nextcloud but is invisible to the library and cannot be cleaned up by it). (4) ifac and sunjay both mount it, so the app column of the address names sunjay only.',
    verified: V('routes/mediaUpload.ts'),
  },
];

const area: Area = { capabilities, ignored: [] };
export default area;
