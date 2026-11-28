import type { Area, Capability, Host, HostKey } from '../types';

// elktours "Sync to Google Calendar": a person's runs written into a calendar of their own at Google.
// 2026-11-26, claude (added). Migration 295 (google_calendar_links; unapplied at the time of writing).
// Read: packages/services/src/google-calendar.ts, apps/elktours/src/lib/google-calendar-actions.ts,
// lib/google-calendar.ts, app/api/google-calendar/callback/route.ts, instrumentation.ts (one-minute pass).
//
// Gate: requireOrgEditor / getApiEditor; each editor manages only their own row. "Every run" is for owners,
// checked in the action and again when the events are listed. The pass runs as the system for every connected row.
// The writes are in a shared package, which the inventory does not list as SQL hosts; the callback is a GET route.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const V = '2026-11-26 read the files named above; engine probed against elkdonis_scratch with a stand-in for Google (29 checks); migration dry run rolled back on elkdonis_dev; not run against Google';
const sa = (fn: string): HostKey => `sa:${SRC}lib/google-calendar-actions.ts#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string): Host => ({ key, service, address: { app: APP, path, how } });

const capabilities: Capability[] = [
  {
    id: 'elktours-google-calendar-connect',
    area: 'elktours.google-calendar',
    label: 'Connect Google Calendar to the tour schedule',
    does: "Sends the person to Google to allow the site to make a calendar in their account. On return the site keeps a sealed refresh token and writes their upcoming runs into that calendar: tour, time, places taken, meeting point, a link to the office. No guest names or contact details. The site can touch no other calendar.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('connectGoogleCalendar'), ['requireOrgEditor', 'beginCalendarAuth: INSERT google_calendar_links (nonce)', 'then app/api/google-calendar/callback GET -> completeCalendarAuth, syncCalendarLink'], '/hub', "the 'Sync to Google Calendar' button on the Tours offered card (components/hub/calendar-sync.tsx)"),
    ],
    entry: null,
    status: 'google_calendar_links has a connected row for the person and org',
    risk: ['public'],
    confirm: { text: 'Connect your Google Calendar? Your tour runs, with how many places are taken, are copied to Google.', status: 'draft' },
    inputs: 'which runs (mine, or every run for an owner)',
    drift: 'None: single copy.',
    canonical: '@elkdonis/services/google-calendar',
    open: 'Needs migration 295 applied, the Calendar API on, the calendar.app.created scope and the redirect URI on the Google client, and an elktours rebuild with the new environment. An app in Testing status at Google loses the grant after 7 days.',
    verified: V,
    added: '2026-11-26',
  },
  {
    id: 'elktours-google-calendar-sync',
    area: 'elktours.google-calendar',
    label: 'Write the schedule into connected Google Calendars',
    does: "Makes each connected calendar match the person's upcoming runs: adds, rewrites and removes the events the site made. Past events and events the person added are left alone. Runs every minute (Google is called only when the schedule changed, or six-hourly), on 'Sync now', and when the choice of runs changes.",
    class: 'person',
    actors: ['owner', 'guide', 'system'],
    scope: 'org',
    hosts: [
      host(sa('syncGoogleCalendarNow'), ['requireOrgEditor', 'syncCalendarLink (force)'], '/hub', "the 'Sync now' button"),
      host(sa('chooseGoogleCalendarRuns'), ['requireOrgEditor', 'setCalendarWhich', 'syncCalendarLink (force)'], '/hub', "an owner's Runs choice (Mine / Every run)"),
    ],
    entry: null,
    status: 'google_calendar_links.last_synced_at is recent and error is null',
    risk: ['public'],
    confirm: { text: 'Update your Google Calendar from the tour schedule now?', status: 'draft' },
    inputs: 'none, or which runs',
    drift: 'None: single copy.',
    canonical: '@elkdonis/services/google-calendar',
    open: 'One way: nothing changed in Google comes back to the site. An event the person deletes in Google is restored at the next full pass.',
    verified: V,
    added: '2026-11-26',
  },
  {
    id: 'elktours-google-calendar-disconnect',
    area: 'elktours.google-calendar',
    label: 'Disconnect Google Calendar',
    does: "Removes the calendar the site made in the person's Google account, withdraws the grant (unless another connection of theirs uses the same Google client) and deletes the stored token.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('disconnectGoogleCalendar'), ['requireOrgEditor', 'disconnectCalendar: DELETE google_calendar_links'], '/hub', "the Disconnect button"),
    ],
    entry: null,
    status: 'no google_calendar_links row for the person and org',
    risk: ['irreversible'],
    confirm: { text: 'Disconnect Google Calendar? The “Elkdonis tours” calendar is removed from your Google account.', status: 'draft' },
    inputs: 'none',
    drift: 'None: single copy.',
    verified: V,
    added: '2026-11-26',
  },
];

const ignored: Area['ignored'] = [];

const area: Area = { capabilities, ignored };
export default area;
