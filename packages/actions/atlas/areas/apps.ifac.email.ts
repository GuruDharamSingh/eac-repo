import type { Area, Capability, Host, HostKey } from '../types';

// ifac email suite (hub /manage email tab) and series mailings. Round 2 (2026-11-16).
// All gates are getApiEditor (owner or guide), the same as the arts-collective org email routes.

const V =
  '2026-11-16 read apps/ifac/src/app/api/hub/email/{[key],[key]/test,addresses,identity,messages/[id],reply}/route.ts, app/api/newsletter/series/[id]/[slug]/{route,send/route}.ts, app/manage/email/series/[id]/page.tsx, lib/auth.ts';
const A = 'ifac';
const AREA = 'ifac.email';
const k = (kind: 'sa' | 'api' | 'sql', p: string, s: string) => `${kind}:apps/ifac/src/${p}#${s}` as HostKey;
const api = (p: string, m: string) => k('api', `app/api/${p}/route.ts`, m);
const h = (key: HostKey, path: string, how: string, service: string[], note?: string, caseId?: string): Host => ({
  key,
  service,
  address: { app: A, path, how },
  ...(note ? { note } : {}),
  ...(caseId ? { case: caseId } : {}),
});
const cf = (text: string) => ({ text, status: 'draft' as const, wave: 6 });
const mk = (c: Omit<Capability, 'verified' | 'area'>): Capability => ({ area: AREA, verified: V, ...c });

const ED = '(getApiEditor: owner or guide)';
const EDITORS: Capability['actors'] = ['guide', 'owner'];
const EMAIL_SURFACE = 'the email surface (packages/cms-ui email/EmailSurface.tsx, TemplateWordsEditor.tsx; mounted at /manage/email and /hub/email/[key])';

const capabilities: Capability[] = [
  mk({
    id: 'ifac-inbox-reply-send',
    label: 'Reply to an inbox message',
    does: 'Sends a plain-text reply (escaped into a pre-wrap block) to the sender of an inbox message from ifac, logs the send and marks the message read.',
    class: 'person',
    actors: EDITORS,
    scope: 'org',
    hosts: [h(api('hub/email/reply', 'POST'), '/hub/email', `Reply box on an inbox message in ${EMAIL_SURFACE}`, [ED, '@elkdonis/email#getInboxMessage', '@elkdonis/email#sendEmail', '@elkdonis/email#recordSend', '@elkdonis/email#setInboxState'])],
    entry: null,
    status: 'email send log has a row to the original sender with status queued or sent',
    risk: ['emails', 'others'],
    confirm: cf('Send your reply to {person} ({email}) from {org}? They get the email now.'),
    inputs: 'messageId, subject, body',
    drift: 'No arts-collective reply route found in the atlas. The recipient is read from the stored message (not from the request); body is HTML-escaped (good).',
    canonical: 'services/email sendEmail + recordSend.',
    open: 'The reply goes to the From address of the stored inbound message; if inbound mail From is spoofable the reply can be pointed at a third party. Not verified.',
  }),
  // ---------------- series mailings ----------------
];

export default {
  capabilities,
  ignored: [
    {
      key: k('sa', 'app/manage/email/series/[id]/page.tsx', 'createMailing/createMailing'),
      why: 'writes nothing: inline server action that only redirects to the mailing editor with ?title=; the mailing is saved by the PUT route (he-newsletter-save)',
    },
  ],
} satisfies Area;
