// Member Management: the data the face, pop-up and detail page draw.
// README "State management" + PLAN §2. Serializable (server loader → client).
// Every permission is decided on the server and arrives here as `can`.

import type { HubRole } from '../contract';

export type StorageStatus = 'synced' | 'pending' | 'none';
export type StorageAccess = 'full' | 'edit' | 'view' | 'none';

export interface Member {
  id: string;
  name: string;
  /** "@ana" or the email local part when there's no handle. */
  handle: string;
  initials: string;
  role: HubRole;
  listed: boolean;
  /** null when the org has no shared storage (no nextcloud_access grant) or the viewer may not see it. */
  storage: StorageStatus | null;
  joinedAt: string | null;
  /** null = unknown (no last-seen source yet; PLAN §2). */
  lastSeenAt: string | null;
  arrivedFrom: string | null;
  isYou: boolean;
  /** Server-decided. `roles` = the roles the viewer may set; empty = read-only chip. */
  can: {
    roles: HubRole[];
    /** Shown as the chip tooltip when `roles` is empty. One of the README's three reasons. */
    reason: string | null;
    list: boolean;
    remove: boolean;
  };
}

export interface Arrival {
  /** network_arrivals.id */
  id: string;
  userId: string;
  name: string;
  handle: string;
  initials: string;
  fromSite: string;
  arrivedAt: string;
}

export interface MembersCan {
  /** Owners: guide/member/viewer; guides: viewer only (README roles table). */
  welcomeAs: HubRole[];
  dismiss: boolean;
  seeVisitors: boolean;
  seeStorage: boolean;
  /** The disabled Invite hook ("Coming with the roster service"). Always false today. */
  invite: false;
}

export interface MembersFaceData {
  org: { name: string; mark: string };
  viewer: { name: string; initials: string; role: HubRole; roleLabel: string };
  counts: Record<HubRole, number>;
  total: number;
  /** Small org (2–5) and solo layouts draw people instead of counts. */
  people: Member[];
  /** Pop-up "Recently active": up to 5, excluding the viewer. */
  recent: Member[];
  arrivals: Arrival[];
  arrivalsWaiting: number;
  visitorsWeek: number | null;
  syncsInFlight: number | null;
  can: MembersCan;
}

export type VisitorRange = '7d' | '30d' | '90d';

export interface VisitorsData {
  range: VisitorRange;
  total: number;
  /** "+12% on the previous week"; null when there's no previous period. */
  changeLabel: string | null;
  bars: Array<{ label: string; n: number }>;
  topPages: Array<{ path: string; n: number }>;
  /** Network sites first (one entry per site), then Search, Direct, Social, Other. */
  sources: Array<{ label: string; group: 'network' | 'search' | 'direct' | 'social' | 'other'; n: number }>;
}

export interface MembersDetailData extends MembersFaceData {
  /** All people (the face's `people` may be trimmed). */
  people: Member[];
  visitors: VisitorsData | null;
}

export const ROLE_LABEL: Record<HubRole, string> = {
  owner: 'Owner',
  guide: 'Guide',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_PLURAL: Record<HubRole, string> = {
  owner: 'Owners',
  guide: 'Guides',
  member: 'Members',
  viewer: 'Viewers',
};

/** Storage access follows role (README roles table). */
export const ROLE_STORAGE: Record<HubRole, StorageAccess> = {
  owner: 'full',
  guide: 'edit',
  member: 'view',
  viewer: 'none',
};

/** The README's read-only chip reasons, verbatim. */
export const CHIP_REASON = {
  self: 'You can’t change your own role.',
  owner: 'An owner’s role can’t be changed.',
  notOwner: 'Only owners change roles.',
} as const;

/**
 * The registry entries the Members card calls: the host door's allow-list.
 * Plain data here (not on the client card object) so a host's "use server"
 * action can read it.
 */
export const MEMBERS_ACTIONS = [
  "org-person-role",
  "org-person-listed",
  "org-person-remove",
  "org-arrival-welcome",
  "org-arrival-dismiss",
] as const;
