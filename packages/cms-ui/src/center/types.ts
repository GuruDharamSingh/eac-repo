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
  /** Who owns the org, for the org card. Optional so older hosts still type-check. */
  owners?: Array<{ userId: string; displayName: string; slug: string | null; avatarUrl: string | null }>;
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
  /** `link` is a hand-written placement from the org's manage area. */
  kind: "thread" | "artist" | "store" | "link";
  source: "org" | "network";
  title: string;
  blurb: string | null;
  imageUrl: string | null;
  until: string | null;
  /** `link` only: where the card goes; null for a notice that goes nowhere. */
  href: string | null;
  thread: CenterThread | null;
  artistSlug: string | null;
  storeOrgId: string | null;
}

/**
 * Where the person stands on the auction errand, and whether they can be
 * paid. Structural twin of @elkdonis/commerce's `AuctionJourney` (and of the
 * surface system's SurfaceAuctionJourney); a host that has commerce passes
 * `loadAuctionJourney(userId)` straight through, one that does not passes
 * nothing and the `you` and `journeys` sections draw what they can.
 */
export interface CenterJourney {
  store: {
    state: "none" | "pending" | "active" | "paused" | "rejected";
    id: string | null;
    handle: string | null;
    commissionPercent: number | null;
  };
  artworks: { published: number; sold: number; drafts: number };
  payouts: { state: "none" | "pending" | "ready"; country: string | null; available: boolean };
  canClaimStore: boolean;
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
  /** A person's store on the marketplace, by its handle (their slug). Absent hides the link. */
  storeHref?: (handle: string) => string | null;
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
  /**
   * "Gain your space": where a person who is not yet an artist of the
   * collective starts (the network's artist onboarding). The host decides
   * who sees it and passes null otherwise; absent or null hides it.
   */
  gainSpaceHref?: string | null;
  /**
   * The Studio on the network hub, where the person manages everything they
   * have made (docs/open/STUDIO_BRIEF_2026-09-27.md). Usually
   * `<network>/studio?org=<org_id>`. Absent or null hides it.
   */
  studioHref?: string | null;
}
