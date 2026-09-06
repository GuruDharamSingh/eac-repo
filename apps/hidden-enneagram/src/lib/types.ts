/**
 * View-model types for the site.
 *
 * Local rather than from @elkdonis/types for the same reason amrit-canada and
 * arts-collective keep theirs local: that package still models the
 * pre-migration-030 Post/Meeting shapes, so mapping from `threads` in
 * lib/data.ts and typing the result here is the honest option.
 */

export interface Thread {
  id: string;
  title: string;
  slug: string;
  /** post | service (this site publishes those two) */
  kind: string;
  /** org_feeds.slug this belongs to, or null if unfiled. */
  feedSlug: string | null;
  status: string;
  visibility: string;
  /** threads.body — rich text HTML from Tiptap. */
  description: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  authorId: string | null;
  authorName: string | null;
  authorSlug: string | null;
  authorPhoto: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Guide {
  userId: string;
  slug: string;
  displayName: string;
  roleTitle: string | null;
  bio: string | null;
  photoUrl: string | null;
  city: string | null;
  socialLinks: { label?: string; url: string }[];
  sortOrder: number;
}

export type SiteSections = Record<string, Record<string, string>>;
