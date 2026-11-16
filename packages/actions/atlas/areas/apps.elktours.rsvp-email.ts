import type { Area, Capability, Host, HostKey } from '../types';

// elktours RSVPs (guest and member), recurring-event cycle confirmation, event email (template, reminder window, manual
// blast) and the services inquiry. 2026-11-16, round 2 curator (elktours). All are copies of routes that live in
// several org apps (inner-gathering is the original); copies in other apps are mapped by their own curators.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const V = '2026-11-16 read app/api/{rsvp,inquiry}/route.ts, app/api/threads/[id]/{rsvp,cycle,reminder,email-settings,trigger-email}/route.ts, lib/email-template-settings.ts, lib/auth.ts, components/{rsvp-panel,inquiry-form}.tsx, components/hub/EmailSurface.tsx and manage/content-row-actions.tsx (callers by grep)';
const api = (p: string, m: string): HostKey => `api:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const sq = (p: string, fn: string): HostKey => `sql:${SRC}${p}#${fn}` as HostKey;
const sqr = (p: string, m: string): HostKey => `sql:${SRC}app/api/${p}/route.ts#${m}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const EMAIL_SURFACE = 'components/hub/EmailSurface.tsx';

const capabilities: Capability[] = [
];

const ignored: Area['ignored'] = [
  { key: sq('lib/email-template-settings.ts', 'deleteEmailTemplateSettings'), why: 'dead: no caller in the repo (the "revert to org default" control was never wired)' },
];

const area: Area = { capabilities, ignored };
export default area;
