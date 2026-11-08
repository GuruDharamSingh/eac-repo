// The review queue: one list of everything waiting for an owner's or guide's
// look, whatever it is. Three sources today, each decided by the service that
// owns it (packages/actions/src/server/review-runners.ts):
//   post     a member's post held for a look (organizations.member_posts_review)
//   panel    a member's store panel waiting to go up (member_store_panels)
//   listing  a post from another network site asking to show here (migration 261)
// Built as a section first: the Content card (@elkdonis/content PublishPopup)
// hosts it later; until then it is its own small card on a host's hub.

export type ReviewSource = 'post' | 'panel' | 'listing';

export interface ReviewItem {
  /** Stable within the queue: `${source}:${…}`. */
  key: string;
  source: ReviewSource;
  title: string;
  /** "Post", "Event", "Store panel"… */
  kindLabel: string;
  excerpt: string | null;
  by: string | null;
  /** listing: the post's home site. */
  from: string | null;
  at: string;
  /** What the decide entry needs. */
  ref: { threadId: string } | { userId: string; key: string };
}

export interface ReviewQueueData {
  org: { name: string };
  items: ReviewItem[];
  /** The two switches; null when this host doesn't offer that kind of submission. */
  switches: { posts: boolean | null; storePanels: boolean | null };
  can: { decide: boolean; switch: boolean };
}

/** The registry entries the queue calls (its host door's allow-list). */
export const REVIEW_ACTIONS = ['listing-approve', 'listing-decline', 'submission-review', 'review-switch'] as const;

export const SOURCE_LABEL: Record<ReviewSource, string> = {
  post: 'From a member',
  panel: 'Store panel',
  listing: 'From another site',
};
