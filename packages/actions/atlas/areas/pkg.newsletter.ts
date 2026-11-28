import type { Area, Capability, Host, HostKey } from '../types';

// packages/newsletter: the saved letters (site_config rows), sending, and the unsubscribe write.
// 2026-11-16, round 3 curator (packages). The person-facing rows are the app newsletter routes
// (apps.hidden-enneagram.site, apps.ifac.email, apps.innergathering.hub); these are the shared writes behind them.

const SRC = 'packages/newsletter/src/';
const V = (files: string) => `2026-11-16 read packages/newsletter/src/${files}, apps/hidden-enneagram app/api/newsletter/[slug]/send/route.ts, app/unsubscribe/page.tsx`;
const sql = (fn: string): HostKey => `sql:${SRC}server.ts#${fn}` as HostKey;
const h = (fn: string, service: string[], note?: string): Host => ({ key: sql(fn), service, ...(note ? { note } : {}) });

const capabilities: Capability[] = [
  {
    id: 'pkg-newsletter-letter',
    where: {"mode": "place", "why": "Writing the letter in the email editor."},
    area: 'newsletter.letters',
    label: 'Save or delete a saved letter',
    does: 'Upserts a letter (title, editor project, html; sentAt and sentCount kept) as a site_config row keyed by slug and audience (the org list or one series), or deletes it.',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      h('saveNewsletter', ['newsletter#saveNewsletter'], 'No gate in the function: the route checks the editor, and for a series audience that the series belongs to the org ("the caller checks"). Read-merge-write; size cap.'),
      h('deleteNewsletter', ['newsletter#deleteNewsletter'], 'DELETE WHERE org_id AND key: org-scoped. Irreversible.'),
    ],
    status: 'a site_config row (org, newsletter key) carrying the letter',
    risk: ['emails', 'irreversible'],
    drift: 'backs apps.hidden-enneagram.site:he-newsletter-save (PUT) and he-newsletter-delete (DELETE); apps.hidden-enneagram.site:he-newsletter-save and he-newsletter-delete; apps.hidden-enneagram.site:he-newsletter-save.',
    canonical: 'packages/newsletter server.ts#saveNewsletter',
    open: 'SECURITY: `html` is stored and later sent to every recipient exactly as saved (only the unsubscribe footer is added); no sanitising here, so any script-like markup an editor pastes is mailed (email clients strip most, not all). Concurrent saves lose one (read then write). saveNewsletter merges sentAt/sentCount from the previous read, so a save that races a send can reset the sent record.',
    verified: V('server.ts'),
  },
  {
    id: 'pkg-newsletter-send',
    where: {"mode": "place", "why": "Sends to a whole list and cannot be taken back: looked over on its own page."},
    area: 'newsletter.send',
    label: 'Send a letter to the list (or three test addresses)',
    does: 'Renders the letter per recipient with an unsubscribe footer, emails every recipient (org contacts minus unsubscribed, or a series\' subscribers) one by one through sendEmail, and records sentAt and sentCount on the letter.',
    class: 'internal',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [h('sendNewsletter', ['newsletter#sendNewsletter', 'email#sendEmail'], 'No gate in the function (the route checks the editor). Refuses without SENDGRID_API_KEY and a secret for unsubscribe tokens. A test (testTo) sends to the named addresses and does not stamp the letter.')],
    status: 'site_config value.sentAt and sentCount on the letter; email_sends rows kind newsletter',
    risk: ['emails', 'irreversible'],
    drift: 'backs apps.hidden-enneagram.site:he-newsletter-send (POST), apps.hidden-enneagram.site:he-newsletter-send (POST), apps.hidden-enneagram.site:he-newsletter-send (POST).',
    canonical: 'packages/newsletter server.ts#sendNewsletter',
    open: 'SECURITY: (1) no send guard: sendNewsletter does not look at sentAt, take a lock or claim a row, and the hidden-enneagram route calls it with no sent check at all, so a double click, a retry or two tabs mails everyone twice (only ifac and innergathering have a `force` flag, which implies a guard in their routes; the package does not provide one). sentAt is stamped after the whole loop. (2) The send is one HTTP request that mails recipients serially, so a long list can outlive the request or a proxy timeout partway, with no resume; a partial send stamps sentCount but the next send goes to everyone again. (3) `force` skips the broken-link and placeholder check. (4) baseUrl, which builds the unsubscribe links, comes from NEXT_PUBLIC_APP_URL or the request Host header in the routes: with the variable unset a forged Host header changes where the unsubscribe link in real mail points (editor-only action). (5) Recipients are re-read at send time, so a suppression written by pkg-email-events-ingest between preview and send is honoured (good).',
    verified: V('server.ts'),
  },
  {
    id: 'pkg-newsletter-unsubscribe',
    area: 'newsletter.send',
    label: 'Unsubscribe an address from an org\'s letters',
    does: 'Sets contacts.status to unsubscribed for an address in one org, after the page verifies the HMAC token in the link.',
    class: 'internal',
    actors: ['visitor'],
    scope: 'org',
    hosts: [h('unsubscribeContact', ['newsletter#unsubscribeContact', 'newsletter#verifyUnsubscribeToken'], 'Called by the unsubscribe pages in hidden-enneagram and innergathering on render (GET), after verifyUnsubscribeToken(orgId, email, token). UPDATE only: it does not insert.')],
    status: 'contacts.status unsubscribed for (org, email)',
    risk: ['others'],
    drift: 'a visitor step from the link in a letter; reached by apps/hidden-enneagram app/unsubscribe/page.tsx and apps/innergathering app/unsubscribe/page.tsx (pages, not inventory hosts, so no app row exists). packages/series-site has its own series unsubscribe (series-mail.ts) and does not use this function. Not a rail step.',
    canonical: 'packages/newsletter server.ts#unsubscribeContact',
    open: 'SECURITY: (1) it is an UPDATE of existing rows only (compare suppressAddress, which upserts). For the org list that is enough, because listRecipients reads contacts. For the series audience, listRecipients reads accounts (thread_rsvps) and excludes anyone whose org CONTACT is unsubscribed, so an account with no contacts row cannot be suppressed through this function (series-site uses its own series unsubscribe link); the page tells the person "Unsubscribed" either way, by design, to avoid confirming list membership. (2) The write happens on GET render: mail security scanners and link previewers that follow the unsubscribe link will unsubscribe the recipient (no confirm click, a known pattern with one-click unsubscribe but without the RFC 8058 POST). (3) The token is an HMAC of "org:email" with no expiry, so a leaked link works for ever (acceptable for unsubscribe). (4) NEWSLETTER_SECRET falls back to INTER_APP_JWT_SECRET and then SILEX_SESSION_SECRET: tokens are only as secret as whichever is set.',
    verified: V('server.ts'),
  },
];

const area: Area = { capabilities, ignored: [] };
export default area;
