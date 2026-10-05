import { NextResponse } from "next/server";
import { loadBids, loadLots, loadStats, type LotScope } from "@/lib/auction-data";
import type { LiveParts } from "@/blocks/auction-types";

/**
 * What the page blocks poll: lots, bids and stats, in one request.
 *
 * Public, because the data is: active stores' lots, anonymous paddle numbers
 * and totals (see lib/auction-data.ts). `parts` picks what to compute
 * (`lots,bids,stats`), so a block asks for only what it draws. The answer is
 * kept for three seconds per query, so a crowd of open pages is one database
 * read, not one each. `now` is the server's clock: the blocks measure their
 * countdowns against it, so a wrong device clock does not mislead a bidder.
 */
export const dynamic = "force-dynamic";

const TTL_MS = 3000;
const cache = new Map<string, { at: number; body: LiveParts }>();

const SCOPES: LotScope[] = ["open", "closing", "closed", "all"];
const clean = (v: string | null, max = 60) => (v && /^[\w -]{1,60}$/.test(v) ? v.slice(0, max) : undefined);

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const parts = new Set((q.get("parts") ?? "lots").split(",").filter((p) => ["lots", "bids", "stats"].includes(p)));
  const event = clean(q.get("event"));
  const scope = SCOPES.find((s) => s === q.get("scope")) ?? "open";
  const limit = Number(q.get("limit")) || undefined;
  const bidsLimit = Number(q.get("bidsLimit")) || undefined;

  const key = JSON.stringify([[...parts].sort(), event, scope, limit, bidsLimit]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.body, { headers: { "Cache-Control": "no-store" } });
  }

  const [lots, bids, stats] = await Promise.all([
    parts.has("lots") ? loadLots({ event, scope, limit }) : undefined,
    parts.has("bids") ? loadBids({ event, limit: bidsLimit }) : undefined,
    parts.has("stats") ? loadStats({ event }) : undefined,
  ]);
  const body: LiveParts = { now: new Date().toISOString(), ...(lots && { lots }), ...(bids && { bids }), ...(stats && { stats }) };
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 200) cache.clear();
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
