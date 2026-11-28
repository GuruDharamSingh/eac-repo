/** The "Content" card's plain data. Types only: server and client files both import this. */

export type ContentCardRole = "owner" | "guide" | "member" | "viewer";

export interface ContentCardPiece {
  key: string;
  title: string;
  /** Library type word: event, writing, artwork, image ... */
  type: string;
  cover: string | null;
}

export interface ContentCardSource {
  /** `mine` or `org:<orgId>`: the keys the content-card routes know. */
  key: string;
  label: string;
  /** Open inside this folder the first time (the team folder opens in Media, as the old Files card did). */
  startPath?: string;
}

export interface ContentCardData {
  orgId: string;
  orgSlug: string;
  orgName: string;
  /** For wording only. What the viewer may do always comes from the session, at the routes. */
  role: ContentCardRole;
  canEdit: boolean;
  total: number;
  byType: Record<string, number>;
  latest: ContentCardPiece[];
  /** Folders the Files view may browse for this org (team folder when a member or above, and the person's own). */
  sources: ContentCardSource[];
  /** Where an upload may go for this viewer: always `mine`, plus the team folder for owners and guides. */
  uploadTo: Array<{ key: string; label: string }>;
  timeZone: string;
  siteUrl: string;
}
