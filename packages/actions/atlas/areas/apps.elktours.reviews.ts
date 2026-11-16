import type { Area, Capability, Host, HostKey } from '../types';

// elktours reviews (org_reviews): places, tours and experiences. 2026-11-16, round 2 curator (elktours).
// Rule in code (lib/review-actions.ts:19): any signed-in person with a user_organizations row for the org (followers
// included, Viewer.isAffiliate) may review; one review per person per target; owners and guides hide or show.

const APP = 'elktours';
const SRC = 'apps/elktours/src/';
const F = 'lib/review-actions.ts';
const V = '2026-11-16 read lib/review-actions.ts, lib/auth.ts, components/reviews/reviews-section.tsx (imports)';
const sa = (fn: string): HostKey => `sa:${SRC}${F}#${fn}` as HostKey;
const sq = (fn: string): HostKey => `sql:${SRC}${F}#${fn}` as HostKey;
const host = (key: HostKey, service: string[], path: string, how: string, note?: string): Host => ({ key, service, address: { app: APP, path, how }, note });
const twin = (key: HostKey, of: HostKey): Host => ({ key, service: ['raw SQL'], note: `twin of ${of}` });

const SEC = 'components/reviews/reviews-section.tsx';

const capabilities: Capability[] = [
  {
    id: 'elktours-review-save',
    area: 'elktours.reviews',
    label: 'Write or change your review',
    does: 'A follower, member or editor rates (1 to 5 stars, optional) and writes up to 4000 characters about a place, tour or experience. One review per person per target; saving again replaces it. Tours and experiences must be public.',
    class: 'person',
    actors: ['person'],
    scope: 'org',
    hosts: [
      host(sa('saveReviewAction'), ['raw SQL INSERT ... ON CONFLICT org_reviews'], '/tours/{slug}', "the 'Your review' form on tour, experience and place pages (" + SEC + ')'),
      twin(sq('saveReviewAction'), sa('saveReviewAction')),
    ],
    entry: null,
    status: 'an org_reviews row for the person, org and target exists with the rating or body',
    risk: ['public'],
    confirm: { text: 'Post your review of “{title}”? Everyone can read it, and you can change or delete it later.', status: 'draft', wave: 6 },
    inputs: 'target type and id, rating, body',
    drift: 'Single review table. The rule (followers may review) is stated in this file only.',
    open: 'Good: org_id is set from siteConfig, body is tag-stripped with a regex (rendered as text per the component, not re-checked), rating 1 to 5, target must exist (targetExists). No rate limit, but one row per person and target caps volume.',
    verified: V,
  },
  {
    id: 'elktours-review-delete-own',
    area: 'elktours.reviews',
    label: 'Delete your review',
    does: 'The author deletes their own review.',
    class: 'person',
    actors: ['person'],
    scope: 'person',
    hosts: [
      host(sa('deleteOwnReviewAction'), ['raw SQL DELETE org_reviews'], '/tours/{slug}', 'the Delete control on your own review (' + SEC + ')'),
      twin(sq('deleteOwnReviewAction'), sa('deleteOwnReviewAction')),
    ],
    entry: null,
    status: 'no org_reviews row for the id',
    risk: ['irreversible'],
    confirm: { text: 'Delete your review of “{title}”? This cannot be undone.', status: 'draft', wave: 6 },
    inputs: 'review id',
    drift: 'None: single copy.',
    open: 'Good: DELETE is WHERE id AND org_id AND user_id = viewer.',
    verified: V,
  },
  {
    id: 'elktours-review-hide',
    area: 'elktours.reviews',
    label: 'Hide or show a review',
    does: "An owner or guide hides a review from the public (with a reason) or shows it again. The author still sees their own hidden review.",
    class: 'person',
    actors: ['owner', 'guide'],
    scope: 'org',
    hosts: [
      host(sa('setReviewHiddenAction'), ['raw SQL UPDATE org_reviews'], '/tours/{slug}', 'the Hide / Show control on a review, visible to editors (' + SEC + ')'),
      twin(sq('setReviewHiddenAction'), sa('setReviewHiddenAction')),
    ],
    entry: null,
    status: 'org_reviews.status is hidden or visible for the id',
    risk: ['others', 'public'],
    confirm: { text: 'Make {person}’s review {state}? The author can still see it.', status: 'draft', wave: 6 },
    inputs: 'review id, hidden flag, reason',
    drift: 'None: single copy.',
    open: 'Org filtered; any guide moderates reviews of any tour (no ownership check, fits a site-wide moderation role). The author is not told.',
    verified: V,
  },
];

const ignored: Area['ignored'] = [
  { key: sa('listReviewsAction'), why: 'read exposed as a server action (public list)' },
];

const area: Area = { capabilities, ignored };
export default area;
