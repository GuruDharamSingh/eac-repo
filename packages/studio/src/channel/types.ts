// ============================================================================
// Channel console: the data a host hands the console. Pure types, no data
// layer: the host (arts-collective /studio/channel today) loads these and
// passes them in, as PostKind's host does (docs/open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md).
// ============================================================================

/** Views drawn inside the console. Every other left-column item links out. */
export type ChannelViewId = "overview" | "artwork" | "posts" | "accounts" | "activity";

export const CHANNEL_VIEWS: ChannelViewId[] = ["overview", "artwork", "posts", "accounts", "activity"];

export interface ChannelOrg {
  orgId: string;
  name: string;
  slug: string;
}

export interface ChannelViewer {
  userId: string;
  email: string;
  name: string | null;
}

export interface ChannelArtwork {
  id: string;
  title: string;
  /** draft | available | reserved | sold | … (commerce ArtworkStatus). */
  status: string;
  priceLabel: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  /** The piece's public page (the org's own site when it has one, else the market). */
  href: string | null;
  /** Posts in this channel whose link is this piece's page. */
  postCount: number;
  lastPostedAt: string | null;
}

export interface ChannelShare {
  label: string;
  kind: string;
  url: string | null;
  at: string;
}

export interface ChannelPost {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  link: string | null;
  shares: ChannelShare[];
  updatedAt: string;
  /** Opens the post in the Studio's Post kind. */
  editHref: string;
}

export interface ChannelAccountTarget {
  id: string;
  name: string;
  instagramUsername: string | null;
  canPublish: boolean;
  /** This Page / account is set as one of the acting org's channels. */
  isOrgChannel: boolean;
}

export interface ChannelAccount {
  id: string;
  provider: "youtube" | "meta" | "threads" | "instagram";
  label: string;
  accountName: string | null;
  accountUrl: string | null;
  status: "pending" | "connected" | "error";
  error: string | null;
  connectedAt: string | null;
  targets: ChannelAccountTarget[];
  /** For threads / instagram / youtube accounts without Pages: set as an org channel. */
  isOrgChannel: boolean;
}

export interface ChannelJob {
  id: number;
  provider: string;
  targetLabel: string;
  status: string;
  externalUrl: string | null;
  error: string | null;
  createdAt: string;
  sourceKind: string;
  sourceId: string;
  /** The post or piece title when the host could resolve it. */
  sourceTitle: string | null;
  sourceHref: string | null;
}

/**
 * Where each left-column item goes. Null hides the item, except where the
 * nav marks it "soon". Hosts build these from their own routes.
 */
export interface ChannelLinks {
  /** Base of the console itself, e.g. "/studio/channel". View and org are added as query params. */
  console: string;
  writing: string | null;
  video: string | null;
  post: string | null;
  meeting: string | null;
  series: string | null;
  recordings: string | null;
  newsletter: string | null;
  pages: string | null;
  siteStyle: string | null;
  identity: string | null;
  people: string | null;
  center: string | null;
  store: string | null;
  directory: string | null;
  /** Where accounts are connected and channels set (the Center's Connections tab). */
  connections: string | null;
  /** The org's public site, for "View site". */
  site: string | null;
}

export interface ChannelData {
  viewer: ChannelViewer;
  /** Null = "Just me" (the person's own channel). */
  org: ChannelOrg | null;
  /** Orgs the person can act for (owner or guide). */
  orgs: ChannelOrg[];
  view: ChannelViewId;
  /** The view's filter (`?filter=`): Artwork all | unposted | posted; Activity all | failed | sent. */
  filter: string | null;
  links: ChannelLinks;
  artworks: ChannelArtwork[];
  posts: ChannelPost[];
  accounts: ChannelAccount[];
  jobs: ChannelJob[];
  /** Today's routine step from the LMS, if the host knows one. */
  today: { label: string; href: string } | null;
  /** A one-off notice (e.g. after "Post this" failed). */
  notice: string | null;
}

/** Server action the host passes for "Post this" on an artwork. Takes a form with `artworkId` and `orgId`. */
export type ChannelPostArtworkAction = (form: FormData) => Promise<void>;
