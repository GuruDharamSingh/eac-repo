import type { ComponentType, ReactNode } from "react";
import type { ForumViewer } from "@elkdonis/services";

/** What the shared series pages ask of a viewer: `getViewer` in each app's `lib/auth.ts`. */
export interface SeriesViewer {
  userId: string;
  email: string;
  role: string | null;
  canEdit: boolean;
  isMember: boolean;
}

export type SeriesNavKey = "series";

export interface SeriesSite {
  orgId: string;
  orgName: string;
  shortName: string;
  /** Host name without scheme: links in mail and on the `.ics`. */
  domain: string;
  tagline: string;
  /** Who sees the join link and materials, for the gate's words: "IFAC members and followers". */
  audience: string;
  /** How an online session is described: "Online · free". */
  onlineLabel: string;
  /** Zones new series print their times in. */
  alsoZones: string[];
  /** Receives a week's answers while nobody hosts it. */
  ownerEmail: string;
  /** Drawn for a series with no cover. */
  blankMark?: { src: string; alt: string } | null;
  /** The rota panel on a series' page. Off for a series run by one person. */
  showRota?: boolean;
  /** A host's public page on this site. */
  hostHref: (host: { slug: string; tags: string[] }) => string | null;
  /** The longer profile a session page shows for its host, from the host's slug. */
  getHostProfile?: (slug: string) => Promise<{ role?: string | null; bio?: string[] | null } | undefined>;
  getViewer: () => Promise<SeriesViewer | null>;
  getForumViewer: () => Promise<ForumViewer>;
  chrome: {
    Shell: ComponentType<{ children: ReactNode }>;
    Header: ComponentType<{ active?: SeriesNavKey; seriesHref?: string | null; seriesLabel?: string | null }>;
    Footer: ComponentType<{ seriesHref?: string | null; seriesLabel?: string | null }>;
  };
}

/** Route gate: member and up. */
export async function apiMember(site: SeriesSite): Promise<SeriesViewer | null> {
  const viewer = await site.getViewer();
  return viewer?.isMember ? viewer : null;
}

/** Route gate: owner or guide. */
export async function apiEditor(site: SeriesSite): Promise<SeriesViewer | null> {
  const viewer = await site.getViewer();
  return viewer?.canEdit ? viewer : null;
}
