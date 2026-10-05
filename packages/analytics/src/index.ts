// Client-safe surface: types and constants shared by the beacon, collector,
// queries and dashboard. Nothing here touches the database.

export const COLLECT_PATH = '/api/pulse';

/** A visit ends after this long without a page view. */
export const SESSION_GAP_MINUTES = 30;

export type SourceKind = 'direct' | 'search' | 'social' | 'email' | 'network' | 'referral';

/** Wire format the beacon posts to the collector. */
export interface CollectPayload {
  /** `pageview` on arrival, `leave` when the page is left, `event` for a named action. */
  type: 'pageview' | 'leave' | 'event';
  /** Client-generated UUID of the page view; `leave` refers back to it. */
  id: string;
  path: string;
  referrer?: string;
  /** location.search, read only for utm_* parameters. */
  search?: string;
  /** Thread id from <AnalyticsThread>, when the page is a post. */
  thread?: string;
  name?: string;
  props?: Record<string, string | number | boolean | null>;
  /** Visible time on the page in ms (`leave`). */
  duration?: number;
}

export type RangeKey = '7d' | '30d' | '90d' | '365d';

export const RANGES: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '365d', label: '12 months', days: 365 },
];

export function parseRangeKey(value: string | string[] | undefined): RangeKey {
  const v = Array.isArray(value) ? value[0] : value;
  return RANGES.some((r) => r.key === v) ? (v as RangeKey) : '30d';
}

export type {
  DashboardData,
  Totals,
  DailyPoint,
  PageRow,
  SourceRow,
  CampaignRow,
  GeoRow,
  BreakdownRow,
  EventRow,
  SiteRow,
  PersonRow,
  Scope,
} from './types';
