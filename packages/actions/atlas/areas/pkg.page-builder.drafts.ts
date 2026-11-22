import type { Area, Capability, Host, HostKey } from '../types';

// packages/page-builder: page drafts (contract C3). 2026-11-21, closeout curator (added). Conventions: atlas/JOURNAL.md.
// A draft is one site_config row of the organisation, key `puck-draft:<slug>`, beside the live `puck:<slug>`; listPages
// matches `puck:%` only and no public route reads a draft. Three raw SQL writes. NONE authorises: every caller must,
// and each row names the callers it backs. Read: packages/page-builder/src/drafts.ts.

const SRC = 'packages/page-builder/src/drafts.ts';
const V = '2026-11-21 read packages/page-builder/src/drafts.ts and its two gated callers (apps/development lib/sites-actions.ts, packages/mcp src/server/draft-tools.ts)';
const sq = (fn: string): HostKey => `sql:${SRC}#${fn}` as HostKey;
const hs = (key: HostKey, service: string[], how: string, note?: string): Host => ({ key, service, address: { app: 'page-builder', path: 'packages/page-builder', how }, note });

const capabilities: Capability[] = [
  {
    id: 'pkg-page-builder-draft-save',
    area: 'pkg.page-builder',
    label: "Write a page's waiting draft",
    does: "Stores one draft of one page of an organisation (the Puck document, the live version it began from, who proposed it, the steps) in site_config under puck-draft:<slug>, after the same shape, size and rich-text checks as a live save. One draft per page: saving replaces it.",
    class: 'internal',
    actors: ['admin', 'system'],
    scope: 'org',
    hosts: [
      hs(sq('saveDraft'), ['@elkdonis/blocks#sanitizeRichValues', 'validatePage', '(raw INSERT or UPDATE site_config)'], "the draft saves of the development app's Sites tab and of an assistant's propose_page_patch and set_field", 'No authorisation inside; the caller checks. Compare-and-set: `expected` (the savedAt the caller loaded, or null for none) is one conditional statement, so a draft saved or removed since is not overwritten (code draft_changed).'),
    ],
    status: "the site_config row puck-draft:<slug> holds the draft data and its author",
    risk: ['none'],
    drift: 'backs development.sites:dev-site-draft-save, development.sites:dev-page-create and the assistant draft tools (packages/mcp, scope mcp:draft)',
    canonical: 'page-builder saveDraft (already the single writer)',
    open: "GOOD: nothing a draft holds reaches a public page until a person publishes it. The author (person or assistant) is stored with the draft, but a draft keeps no history: the next save replaces it.",
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'pkg-page-builder-draft-publish',
    area: 'pkg.page-builder',
    label: "Make a page's draft the live page",
    does: "Locks the live row, refuses when the live page changed since the draft began (the draft is kept), writes the draft as the live page after the caller's own cleaner, and deletes the draft.",
    class: 'internal',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      hs(sq('publishDraft'), ['(raw UPDATE or INSERT site_config puck:<slug>)', '(raw DELETE site_config puck-draft:<slug>)'], "the Publish button of the Sites tab's draft review", 'The caller must pass `{ clean }` (cleanBoxDoc(stripResolvedKeys(...))); it is required, not defaulted, because this package cannot import either. The gate (who may publish) is also the caller\'s.'),
    ],
    status: 'the site_config row puck:<slug> holds the draft data and the draft row is gone',
    risk: ['public'],
    drift: 'backs development.sites:dev-site-draft-publish (the only caller today)',
    canonical: 'page-builder publishDraft (already the single writer)',
    open: 'SECURITY (note): the function itself never checks who the person is; a second caller that forgets the gate, or passes a weaker cleaner, bypasses both. The assistant tools never call it: an assistant proposes, a person publishes.',
    verified: V,
    added: '2026-11-21',
  },
  {
    id: 'pkg-page-builder-draft-discard',
    area: 'pkg.page-builder',
    label: "Delete a page's waiting draft",
    does: 'Deletes the draft row of one page. The live page is not touched.',
    class: 'internal',
    actors: ['admin'],
    scope: 'org',
    hosts: [
      hs(sq('discardDraft'), ['(raw DELETE site_config puck-draft:<slug>)'], "Throw away on the Sites tab's draft review", 'No authorisation inside; the caller checks. Unconditional: no check that the draft is the one the caller saw.'),
    ],
    status: 'no site_config row puck-draft:<slug> for the org',
    risk: ['irreversible'],
    drift: 'backs development.sites:dev-site-draft-discard',
    canonical: 'page-builder discardDraft (already the single writer)',
    open: 'A draft is thrown away without a version check, so a draft saved a moment ago by someone else is lost with it.',
    verified: V,
    added: '2026-11-21',
  },
];

const ignored: Area['ignored'] = [];

const area: Area = { capabilities, ignored };
export default area;
