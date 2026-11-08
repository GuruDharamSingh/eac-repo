import 'server-only';

// The review queue's loader: posts from other sites asking to show here
// (thread-listing), members' posts held for a look (moderation) and store
// panels waiting (user-pages), merged oldest-last into one list.

import {
  canModerateOrg,
  listPendingListings,
  listPendingThreads,
  listPendingUserPages,
  orgHostsStorePanels,
  orgRequiresReview,
} from '@elkdonis/services';
import { defineHubCardServer, type HubSite, type HubViewer } from '../contract';
import type { ReviewItem, ReviewQueueData } from '../review/model';

const KIND: Record<string, string> = { post: 'Post', writing: 'Writing', event: 'Event', meeting: 'Gathering', service: 'Service', article: 'Article' };
const kindLabel = (k: string) => KIND[k] ?? k.charAt(0).toUpperCase() + k.slice(1);

export interface ReviewLoadOptions {
  /** Store panels are an ifac feature today; hosts without them leave this off. */
  storePanels?: boolean;
}

async function load(site: HubSite, viewer: HubViewer, opts: ReviewLoadOptions = {}): Promise<ReviewQueueData> {
  const decide = await canModerateOrg(viewer.userId, site.orgId);
  const [listings, posts, panels, postsHeld, panelsOn] = await Promise.all([
    listPendingListings(site.orgId),
    listPendingThreads(site.orgId),
    opts.storePanels ? listPendingUserPages(site.orgId) : Promise.resolve([]),
    orgRequiresReview(site.orgId),
    opts.storePanels ? orgHostsStorePanels(site.orgId) : Promise.resolve(null),
  ]);
  const items: ReviewItem[] = [
    ...listings.map<ReviewItem>((l) => ({
      key: `listing:${l.threadId}`,
      source: 'listing',
      title: l.title,
      kindLabel: kindLabel(l.kind),
      excerpt: l.excerpt,
      by: l.authorName,
      from: l.homeOrgName,
      at: l.addedAt,
      ref: { threadId: l.threadId },
    })),
    ...posts.map<ReviewItem>((p) => ({
      key: `post:${p.id}`,
      source: 'post',
      title: p.title,
      kindLabel: kindLabel(p.kind),
      excerpt: p.excerpt,
      by: p.authorName,
      from: null,
      at: p.createdAt,
      ref: { threadId: p.id },
    })),
    ...panels.map<ReviewItem>((p) => ({
      key: `panel:${p.userId}:${p.key}`,
      source: 'panel',
      title: `${p.authorName ?? 'A member'}’s store panel`,
      kindLabel: 'Store panel',
      excerpt: null,
      by: p.authorName,
      from: null,
      at: p.createdAt,
      ref: { userId: p.userId, key: p.key },
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    org: { name: site.name },
    items,
    switches: { posts: postsHeld, storePanels: panelsOn },
    can: { decide, switch: decide },
  };
}

export const reviewServer = defineHubCardServer<ReviewQueueData, ReviewQueueData>({
  id: 'review',
  load: (site, viewer) => load(site, viewer),
  loadDetail: (site, viewer) => load(site, viewer),
});

/** For a host with store panels (ifac): the same loader with panels on. */
export const loadReviewQueue = load;
