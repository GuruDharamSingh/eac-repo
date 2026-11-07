import type { ChannelData, ChannelLinks, ChannelViewId } from "./types";

// ============================================================================
// The left column: groups of items. An item either opens a view inside the
// console (`view`) or links out to an existing screen (`href` only). An item
// with neither is drawn as "Soon" when `soon` is set and dropped otherwise.
// Labels and grouping: docs/open/CHANNEL_CONSOLE_DESIGN_2026-11-07.md §3.
// ============================================================================

/** Ids of the shell's SVG sprite (`ch-i-<id>`). */
export type ChannelIcon =
  | "overview"
  | "post"
  | "artwork"
  | "writing"
  | "video"
  | "recording"
  | "meeting"
  | "series"
  | "newsletter"
  | "comments"
  | "live"
  | "accounts"
  | "activity"
  | "pages"
  | "style"
  | "details"
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
  /** The count is a problem (failed sends): drawn in the danger colour. */
  alert?: boolean;
  /** The view on screen now (aria-current). Set by the shell. */
  current?: boolean;
}

export interface ChannelNavGroup {
  id: string;
  label: string;
  /** Open on first render (also forced open when it holds the current view). */
  open: boolean;
  items: ChannelNavItem[];
}

/** `?view=&org=` on the console's own base. `orgId` null = "Just me". */
export function channelHref(links: Pick<ChannelLinks, "console">, view: ChannelViewId, orgId: string | null, extra?: Record<string, string>): string {
  const q = new URLSearchParams();
  if (view !== "overview") q.set("view", view);
  if (orgId) q.set("org", orgId);
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v);
  const s = q.toString();
  return s ? `${links.console}?${s}` : links.console;
}

const DAY = 86_400_000;

/** Failed sends in the last 30 days. */
export function recentFailures(jobs: ChannelData["jobs"], now = Date.now()): number {
  return jobs.filter((j) => j.status === "failed" && now - Date.parse(j.createdAt) < 30 * DAY).length;
}

export function buildChannelNav(data: Pick<ChannelData, "links" | "org" | "view" | "artworks" | "posts" | "accounts" | "jobs">): ChannelNavGroup[] {
  const { links } = data;
  const orgId = data.org?.orgId ?? null;
  const v = (view: ChannelViewId) => channelHref(links, view, orgId);
  const failed = recentFailures(data.jobs);

  const groups: ChannelNavGroup[] = [
    {
      id: "content",
      label: "Content",
      open: true,
      items: [
        { id: "overview", label: "Overview", icon: "overview", view: "overview", href: v("overview") },
        { id: "posts", label: "Posts", icon: "post", view: "posts", href: v("posts"), count: data.posts.length || null },
        { id: "artwork", label: "Artwork", icon: "artwork", view: "artwork", href: v("artwork"), count: data.artworks.length || null },
        { id: "writing", label: "Writing", icon: "writing", href: links.writing },
        { id: "video", label: "Video", icon: "video", href: links.video },
        { id: "recordings", label: "Recordings", icon: "recording", href: links.recordings },
        { id: "meetings", label: "Meetings", icon: "meeting", href: links.meeting },
        { id: "series", label: "Series", icon: "series", href: links.series },
      ],
    },
    {
      id: "audience",
      label: "Audience",
      open: true,
      items: [
        { id: "newsletter", label: "Newsletter", icon: "newsletter", href: links.newsletter },
        { id: "comments", label: "Comments", icon: "comments", soon: true },
        { id: "live", label: "Live", icon: "live", soon: true },
      ],
    },
    {
      id: "social",
      label: "Social media",
      open: true,
      items: [
        { id: "accounts", label: "Accounts", icon: "accounts", view: "accounts", href: v("accounts"), count: data.accounts.length || null },
        { id: "activity", label: "Activity", icon: "activity", view: "activity", href: v("activity"), count: failed || null, alert: failed > 0 },
      ],
    },
    {
      id: "site",
      label: "Site",
      open: true,
      items: [
        { id: "pages", label: "Pages", icon: "pages", href: links.pages },
        { id: "site-style", label: "Site style", icon: "style", href: links.siteStyle },
        { id: "details", label: "Details", icon: "details", href: links.identity },
        { id: "people", label: "People", icon: "people", href: links.people },
      ],
    },
    {
      id: "network",
      label: "Network",
      open: false,
      items: [
        { id: "store", label: "Store", icon: "store", href: links.store },
        { id: "directory", label: "Directory listing", icon: "directory", href: links.directory },
        { id: "center", label: "Center", icon: "center", href: links.center },
      ],
    },
  ];

  return groups
    .map((g) => {
      const items = g.items.filter((i) => i.view || i.href || i.soon);
      return { ...g, items, open: g.open || items.some((i) => i.view === data.view) };
    })
    .filter((g) => g.items.length > 0);
}
