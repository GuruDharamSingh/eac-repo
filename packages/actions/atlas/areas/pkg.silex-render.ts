import type { Area, Capability, HostKey } from '../types';

// packages/silex-render: legacy Silex site renderer; its one write is the shared org contact handler.
// 2026-11-16, round 3. Conventions: atlas/JOURNAL.md. Legacy editor; still used for email making (Justin, 2026-11-16).
// The only mounting found is apps/arts-collective/src/app/api/org/[slug]/contact/route.ts.

const V = '2026-11-16 read packages/silex-render/src/contact.ts; grep for handleOrgContact (one mount, arts-collective api/org/[slug]/contact)';

const capabilities: Capability[] = [
  {
    id: 'pkg-silex-render-org-contact',
    area: 'pkg.silex-render',
    label: 'Store and mail a contact message for an organisation',
    does: 'The shared handler behind POST /api/org/[slug]/contact: looks the organisation up by slug, stores the message as a contact (source silex-site) and emails the organisation’s owner. Legacy Silex package; still used for email making.',
    class: 'internal',
    actors: ['visitor'],
    scope: 'org',
    hosts: [
      {
        key: 'sql:packages/silex-render/src/contact.ts#handleOrgContact' as HostKey,
        service: ['(raw INSERT contacts)', '@elkdonis/email#sendContactNotification'],
        address: { app: 'arts-collective', path: '/api/org/{slug}/contact', how: 'the contact form of an organisation’s page on the network host; the route is a one-line mount of this handler' },
        note: 'Public.',
      },
    ],
    status: 'a contacts row for the organisation with source silex-site exists',
    risk: ['emails'],
    drift: 'backs arts-collective.hub:send-org-contact-message (the route that mounts it). hidden-enneagram send-org-contact-message is a separate copy of the same idea.',
    canonical: 'one shared contact handler pinned to the site org (the danamccool shape, arts-collective.hub:send-org-contact-message)',
    open: 'SECURITY: contact.ts:29-115 serves ANY organisation slug named in the URL, is public, has no rate limit or honeypot, caps nothing (name, subject and message are unbounded), and emails that organisation’s owner (fallback EAC_OWNER_EMAIL, then info@elkdonis-arts.org) with the visitor-typed name and address: a free spam relay to any org owner on the network, and the contacts insert failure is swallowed (:84-86) while the mail still goes. The network host being multi-org makes the any-slug lookup intended; the missing limits are not.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
