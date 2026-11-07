import type { ChannelData, ChannelLinks, ChannelViewId } from "./types";

// ============================================================================
// The left column: groups of items. An item either opens a view inside the
// console (`view`) or links out to an existing screen (`href`). An item with
// neither is drawn as "soon" when `soon` is set and hidden otherwise.
// ============================================================================

export type ChannelIcon =
  | "home"
  | "today"
  | "writing"
  | "video"
  | "post"
  | "artwork"
  | "series"
  | "meeting"
  | "recording"
  | "newsletter"
  | "comments"
  | "live"
  | "accounts"
  | "activity"
  | "pages"
  | "style"
  | "identity"
  | "people"
  | "center"
  | "store"
  | "directory";

export interface ChannelNavItem {
  id: string;
  label: string;
  icon: ChannelIcon;
  view?: ChannelViewId;
  href?: string | null;
  soon?: boolean;
  count?: number | null;
  /** Opens another site (drawn with an outward mark). */
  external?: boolean;
}

export interface ChannelNavGroup {
  id: string;
  label: string;
  items: ChannelNavItem[];
}

/** `?view=&org=` on the console's own base. `org` null = "Just me". */
export function channelHref(links: Pick<ChannelLinks, "console">, view: ChannelViewId, orgId: string | null): string {
  const q = new URLSearchParams();
  if (view !== "overview") q.set("view", view);
  if (orgId) q.set("org", orgId);
  const s = q.toString();
  return s ? `${links.console}?${s}` : links.console;
}

export function buildChannelNav(data: Pick<ChannelData, "links" | "org" | "artworks" | "posts" | "accounts" | "jobs" | "today">): ChannelNavGroup[] {
  const { links } = data;
  const orgId = data.org?.orgId ?? null;
  const v = (view: ChannelViewId) => channelHref(links, view, orgId);
  const failed = data.jobs.filter((j) => j.status === "failed").length;

  const groups: ChannelNavGroup[] = [
    {
      id: "content",
      label: "Content",
      items: [
        { id: "overview", label: "Overview", icon: "home", view: "overview", href: v("overview") },
        { id: "artwork", label: "Artwork", icon: "artwork", view: "artwork", href: v("artwork"), count: data.artworks.length || null },
        { id: "posts", label: "Posts", icon: "post", view: "posts", href: v("posts"), count: data.posts.length || null },
        { id: "writing", label: "Writing", icon: "writing", href: links.writing },
        { id: "video", label: "Video", icon: "video", href: links.video },
        { id: "recordings", label: "Recordings", icon: "recording", href: links.recordings },
        { id: "series", label: "Series", icon: "series", href: links.series, external: true },
        { id: "meeting", label: "Meetings", icon: "meeting", href: links.meeting },
      ],
    },
    {
      id: "audience",
      label: "Audience",
      items: [
        { id: "newsletter", label: "Newsletter", icon: "newsletter", href: links.newsletter },
        { id: "comments", label: "Comments", icon: "comments", soon: true },
        { id: "live", label: "Live", icon: "live", soon: true },
      ],
    },
    {
      id: "socials",
      label: "Socials",
      items: [
        { id: "accounts", label: "Accounts", icon: "accounts", view: "accounts", href: v("accounts"), count: data.accounts.length || null },
        { id: "activity", label: "Activity", icon: "activity", view: "activity", href: v("activity"), count: failed || null },
      ],
    },
    {
      id: "site",
      label: "Site",
      items: [
        { id: "pages", label: "Pages", icon: "pages", href: links.pages, external: true },
        { id: "site-style", label: "Site style", icon: "style", href: links.siteStyle, external: true },
        { id: "identity", label: "Identity and SEO", icon: "identity", href: links.identity, external: true },
        { id: "people", label: "People", icon: "people", href: links.people, external: true },
      ],
    },
    {
      id: "platform",
      label: "Platform",
      items: [
        { id: "center", label: "Center", icon: "center", href: links.center },
        { id: "store", label: "Store", icon: "store", href: links.store, external: true },
        { id: "directory", label: "Directory listing", icon: "directory", href: links.directory, external: true },
      ],
    },
  ];

  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.view || i.href || i.soon) }))
    .filter((g) => g.items.length > 0);
}
