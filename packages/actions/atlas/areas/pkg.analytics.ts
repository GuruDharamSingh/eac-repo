import type { Area, Capability, HostKey } from '../types';

// packages/analytics: the first-party page-view collector. 2026-11-16, round 3. Conventions: atlas/JOURNAL.md.

const V = '2026-11-16 read packages/analytics/src/collect.ts (recordCollect, helpers)';

const capabilities: Capability[] = [
  {
    id: 'pkg-analytics-record-collect',
    area: 'pkg.analytics',
    label: 'Record a page view, event or time on page',
    does: 'The shared analytics collector: ignores bots, builds a daily visitor hash from the IP, agent and host, and writes one analytics_events row (page, source, geography, session) or raises a visit duration. A thread’s views are credited to its own organisation.',
    class: 'system',
    actors: ['visitor'],
    scope: 'org',
    hosts: [
      {
        key: 'sql:packages/analytics/src/collect.ts#recordCollect' as HostKey,
        service: ['(raw INSERT analytics_events)', '(raw UPDATE analytics_events duration)'],
        address: { app: 'network', path: '/api/pulse', how: 'the pulse beacon script of every site; no control' },
      },
    ],
    status: 'an analytics_events row exists for the visitor hash and path',
    risk: ['none'],
    drift: 'backs arts-collective.network:collect-page-pulse and the pulse copies (collect-page-pulse, collect-page-pulse, collect-page-pulse)',
    canonical: 'packages/analytics createCollectHandler (already shared)',
    open: 'Read: path, event name, props and UTM are cleaned and length-capped (collect.ts:106-135); a time-on-page update needs the same visitor id and is limited to a day and 30 minutes; paths under the app’s ignored prefixes are dropped. SECURITY (minor): the payload can name any thread id (up to 21 characters), and the view is then credited to that thread’s organisation (collect.ts:~172-182), so anyone can inflate or skew another organisation’s page counts; the handler has no rate limit of its own (the visitor hash is the only identity). The IP comes from the request.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
