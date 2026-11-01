import { db } from "@elkdonis/db";
import type { Row } from "./map-order";
import { settleExpiredLots, type SettleResult } from "./auctions";
import { releaseExpiredOrders } from "./orders";

// ============================================================================
// The auction clock (ORG_STORE_BRIEF R4, R5). Until 2026-10-18 lots opened on
// the first bid and closed when someone loaded a page. The worker
// (packages/commerce/scripts/auction-clock.mts, compose service
// `auction-clock`) calls `tickAuctionClock` every 30 s so lots open and
// close on time whether or not anyone is looking.
//
// Each tick:
//   1. schedules series lots: start at the series' silent_opens_at, close at
//      live_at (single) or live_at + lot_number × stagger_seconds (staggered),
//      unless a lot carries closes_at_override;
//   2. opens scheduled lots whose start has passed;
//   3. settles lots whose end has passed (orders for winners);
//   4. releases orders whose payment window has passed, which puts the
//      piece back on sale and the lot to `passed`.
//
// Every step is idempotent and safe to run from several places at once: the
// settle step locks rows, the others are plain conditional updates.
// ============================================================================

export interface ClockTick {
  scheduled: number;
  opened: number;
  settled: SettleResult;
  released: number;
}

/** Put series lots on the series' clock. Returns how many rows changed. */
export async function applySeriesSchedule(seriesId?: string): Promise<number> {
  const rows = (await db`
    UPDATE auction_lot al
    SET start_at = COALESCE(s.silent_opens_at, al.start_at),
        end_at = COALESCE(
          al.closes_at_override,
          CASE WHEN s.close_mode = 'staggered' AND al.lot_number IS NOT NULL
               THEN s.live_at + make_interval(secs => al.lot_number * s.stagger_seconds)
               ELSE s.live_at END,
          al.end_at)
    FROM auction_series s
    WHERE s.id = al.series_id
      AND al.status IN ('scheduled', 'live')
      AND s.status <> 'closed'
      AND s.live_at IS NOT NULL
      ${seriesId ? db`AND s.id = ${seriesId}` : db``}
      AND (al.start_at IS DISTINCT FROM COALESCE(s.silent_opens_at, al.start_at)
           OR al.end_at IS DISTINCT FROM COALESCE(
             al.closes_at_override,
             CASE WHEN s.close_mode = 'staggered' AND al.lot_number IS NOT NULL
                  THEN s.live_at + make_interval(secs => al.lot_number * s.stagger_seconds)
                  ELSE s.live_at END,
             al.end_at))
    RETURNING al.id
  `) as unknown as Row[];
  return rows.length;
}

/** Scheduled lots whose start has passed go live. */
export async function openScheduledLots(): Promise<number> {
  const rows = (await db`
    UPDATE auction_lot SET status = 'live'
    WHERE status = 'scheduled' AND start_at <= NOW() AND end_at > NOW()
    RETURNING id
  `) as unknown as Row[];
  return rows.length;
}

export async function tickAuctionClock(opts: { payUrlBase?: string | null } = {}): Promise<ClockTick> {
  const scheduled = await applySeriesSchedule().catch((err) => {
    console.error("[auction-clock] applySeriesSchedule:", err);
    return 0;
  });
  const opened = await openScheduledLots().catch((err) => {
    console.error("[auction-clock] openScheduledLots:", err);
    return 0;
  });
  const settled = await settleExpiredLots({ limit: 100, payUrlBase: opts.payUrlBase ?? null }).catch((err) => {
    console.error("[auction-clock] settleExpiredLots:", err);
    return { sold: 0, passed: 0, orderIds: [] } as SettleResult;
  });
  const released = await releaseExpiredOrders({ limit: 100 }).catch((err) => {
    console.error("[auction-clock] releaseExpiredOrders:", err);
    return 0;
  });
  return { scheduled, opened, settled, released };
}
