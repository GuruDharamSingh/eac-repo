import type { RangeKey, SourceKind } from './index';

export type Scope = { orgId: string } | { network: true };

export interface Totals {
  pageviews: number;
  /** Unique visitors per day, summed over the range (visitor ids rotate daily). */
  visitors: number;
  visits: number;
  /** 0–1: visits with a single page view. */
  bounceRate: number;
  avgDurationSec: number;
  /** Distinct signed-in people. */
  members: number;
}

export interface DailyPoint {
  day: string;
  pageviews: number;
  visitors: number;
}

export interface PageRow {
  path: string;
  threadId: string | null;
  title: string | null;
  views: number;
  visitors: number;
  avgDurationSec: number;
}

export interface SourceRow {
  kind: SourceKind;
  referrerHost: string | null;
  visits: number;
}

export interface CampaignRow {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  visits: number;
}

export interface GeoRow {
  country: string;
  region: string | null;
  visitors: number;
}

export interface BreakdownRow {
  label: string;
  visitors: number;
}

export interface EventRow {
  name: string;
  count: number;
  visitors: number;
}

export interface SiteRow {
  host: string;
  orgId: string | null;
  orgName: string | null;
  pageviews: number;
  visitors: number;
}

export interface PersonRow {
  userId: string;
  name: string;
  visits: number;
  pageviews: number;
  firstSeen: string;
  lastSeen: string;
}

export interface DashboardData {
  range: RangeKey;
  from: string;
  to: string;
  timeZone: string;
  scope: Scope;
  /** Distinct visitors in the last five minutes. */
  liveVisitors: number;
  totals: Totals;
  previous: Totals;
  daily: DailyPoint[];
  hours: Array<{ hour: number; pageviews: number }>;
  weekdays: Array<{ dow: number; pageviews: number }>;
  pages: PageRow[];
  entryPages: PageRow[];
  sources: SourceRow[];
  campaigns: CampaignRow[];
  countries: GeoRow[];
  regions: GeoRow[];
  devices: BreakdownRow[];
  browsers: BreakdownRow[];
  systems: BreakdownRow[];
  events: EventRow[];
  sites: SiteRow[];
  /** Page views that carry no path (private threads and private orgs). */
  privateViews: number;
  /** Signed-in people who visited, newest first. Null when the viewer may not see people. */
  people: PersonRow[] | null;
}
