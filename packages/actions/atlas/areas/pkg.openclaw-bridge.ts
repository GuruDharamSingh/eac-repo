import type { Area, Capability, Host, HostKey } from '../types';

// packages/openclaw-bridge: the one write surface an external agent (OpenClaw) may use. 2026-11-16, round 3.
// Conventions: atlas/JOURNAL.md. An agent door: read carefully (post.ts, route.ts whole; the token side is in
// apps/admin lib/oidc.ts and api/oidc/token, mapped in apps.admin.ts: admin-oidc-token-exchange, admin-agent-post-door).
// The bridge creates a DRAFT thread through services createThread (not raw SQL); its one raw SQL write is the media bind.

const V = '2026-11-16 read packages/openclaw-bridge/src/{post,route,types}.ts; apps/admin lib/oidc.ts verifyDelegatedToken and api/agent/post/route.ts';
const sq = (fn: string): HostKey => `sql:packages/openclaw-bridge/src/post.ts#${fn}` as HostKey;
const hs = (key: HostKey, service: string[], how: string, note?: string): Host => ({ key, service, address: { app: 'admin', path: '/api/agent/post', how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-openclaw-bridge-media-attach',
    area: 'pkg.openclaw-bridge',
    label: 'Attach an agent’s files to the draft it created',
    does: 'After the agent’s draft post is created as the human the token speaks for, uploads up to four attachments (images or a PDF, 12 MB each) into the org’s Agent folder and binds each media row to the draft.',
    class: 'system',
    actors: ['system'],
    scope: 'org',
    hosts: [
      hs(sq('attachMedia'), ['@elkdonis/services#uploadOrgFile', '(raw UPDATE media)'], 'no screen: called by postForAgent behind POST /api/agent/post (OpenClaw relaying a verified email)', 'The draft itself is made by services createThread with status draft hard-coded (post.ts:117-139).'),
    ],
    status: "a threads row with status draft and metadata.agent.clientId exists, and the media rows are attached to it",
    risk: ['others'],
    drift: 'backs apps.admin.ts:admin-agent-post-door (the draft writer and the media bind share this package)',
    canonical: '@elkdonis/openclaw-bridge postForAgent',
    open: 'Read carefully. GOOD: status is hard-coded draft and is not a parameter (post.ts:117-126); authorisation is the same user_organizations lookup as the web UI, WITHOUT the global-admin bypass (:85-98); authorship is the human, so removing their role removes this path; HTML bodies pass sanitizeRichText, plain text passes textToHtml; org, section and role are checked before any write; an idempotency key replays the earlier result per user (:75-78, 241-275); every draft logs a post_created event with source openclaw. ' +
      'SECURITY: (1) route.ts:50-53 enforces the 20 MB cap only from the Content-Length header; a chunked request has no length and goes straight to req.json(), so the cap is skippable and there is no rate limit anywhere on the route. (2) post.ts:183-197 trusts the declared mimeType (a regex allow-list) and never sniffs the decoded bytes, and Buffer.from(content, "base64") never throws on bad input (the catch at :189 is dead), so garbage or mislabelled bytes are uploaded; four items times 12 MB are decoded in memory before the size check. (3) `item.filename` goes to uploadOrgFile unchanged (name handling is in that service, not read). (4) `source.channel`, `reference` and `verification` are stored unbounded in thread metadata and in the event: verification is the courier’s own claim ("DMARC verified") and is never re-checked here. (5) the draft is written with visibility PUBLIC (:127): safe only while status stays draft.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [];

export default { capabilities, ignored } satisfies Area;
