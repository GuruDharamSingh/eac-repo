import { listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * Events for a window, so the calendar dialog can page between months without
 * reloading the hub.
 *
 * Reads Postgres, not CalDAV. `threads` is the record and the org's Nextcloud
 * calendar is a projection of it (see packages/services/src/org-calendar.ts) —
 * reading back from the mirror would be slower, lossier and circular. It would
 * also not work: `getCalendarEvents` in @elkdonis/nextcloud is a stub that has
 * always returned [].
 */
export const dynamic = "force-dynamic";

/** One query should be one screen of dates, not an unbounded scan. */
const MAX_SPAN_DAYS = 92;

export async function GET(request: Request) {
  const viewer = await getApiMember();
  if (!viewer) {
    return Response.json({ error: "Members only" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const from = parseDate(params.get("from")) ?? startOfMonth(new Date());
  const to = parseDate(params.get("to")) ?? addMonths(from, 1);

  if (to <= from) {
    return Response.json({ error: "Empty range" }, { status: 400 });
  }
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_SPAN_DAYS) {
    return Response.json({ error: "Range too wide" }, { status: 400 });
  }

  return Response.json({
    from: from.toISOString(),
    to: to.toISOString(),
    events: await listOrgEventsInRange(siteConfig.orgId, from, to),
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
