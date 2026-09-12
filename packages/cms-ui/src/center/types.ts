// ============================================================================
// /center — what the page renders.
//
// Structural twins of the shapes @elkdonis/services `loadCenter` returns.
// Declared here rather than imported so this package stays free of the data
// layer (the same posture as profile/ProfileView.tsx): anything that can
// produce these fields can render the page.
// ============================================================================

export interface CenterThread {
  id: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  title: string;
  slug: string;
  kind: string;
  section: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  pinned: boolean;
  shareToNetwork: boolean;
  visibility: string;
  rsvpCount: number;
  viewerAttending: boolean | null;
  carriedBy: string[];
  authorName: string | null;
  authorAvatar: string | null;
  authorSlug: string | null;
}

export interface CenterPerson {
  userId: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  slug: string | null;
  city: string | null;
  socialLinks: Array<{ label: string | null; url: string }>;
  orgProfile: { roleTitle: string | null; photoOverride: string | null; isPublic: boolean } | null;
}

export type CenterRole = "owner" | "guide" | "member" | "viewer";

export interface CenterOrg {
  orgId: string;
  orgSlug: string;
  orgName: string;
  tier: string;
  headline: string | null;
  avatarUrl: string | null;
  place: string | null;
  followerCount: number;
  viewerRole: CenterRole | null;
  profileUserId: string | null;
  nextEvent: CenterThread | null;
  upcomingCount: number;
}

export interface CenterOrgLink {
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: CenterRole;
  isCurrent: boolean;
  rsvpCount: number;
}

export interface CenterPromo {
  kind: "thread" | "artist" | "store";
  source: "org" | "network" | "fallback";
  title: string;
  blurb: string | null;
  imageUrl: string | null;
  until: string | null;
  thread: CenterThread | null;
  artistSlug: string | null;
  storeOrgId: string | null;
}

export interface CenterData {
  person: CenterPerson | null;
  org: CenterOrg | null;
  orgs: CenterOrgLink[];
  feed: CenterThread[];
  pinned: CenterThread[];
  featured: CenterThread | null;
  network: CenterThread[];
  promo: CenterPromo | null;
}

/**
 * The only thing hosts differ on. Every href is computed on the server and
 * handed to the client leaves as a string, so a host may resolve them
 * however it likes (its own routes, another org's domain, ArtDirect).
 */
export interface CenterLinks {
  /** A thread of THIS org, on this site. */
  threadHref(thread: CenterThread): string;
  /** A thread of another org — usually that org's own site. */
  networkThreadHref(thread: CenterThread): string;
  /** Where an org in the rail goes: its hub for member+, its home otherwise. Null hides the link. */
  orgHref(org: CenterOrgLink): string | null;
  /** The person's public page, when they have one. */
  profileHref: string | null;
  /** Where "edit" on the person's card goes. */
  editProfileHref: string;
  accountHref: string;
  notificationsHref: string | null;
  filesHref: string | null;
  forumHref: string | null;
  /** ArtDirect (or equivalent) page for a person slug. */
  artistHref(slug: string): string;
  marketplaceUrl: string | null;
  /** POST follows, DELETE unfollows. Null hides the follow control. */
  followEndpoint: string | null;
  loginHref: string;
  /** The org's home page — where the home-view card navigates. */
  homeUrl: string | null;
  /** What the home-view card shows, scaled, as a visual aid. Usually the same. Null hides the card. */
  homePreviewUrl: string | null;
  /** The org's public profile page — where the org card goes when it cannot open a surface. */
  orgProfileHref: string | null;
  /** Where the compose bar goes when no surface can open. Null hides the bar. */
  composeHref: string | null;
}
