import { getEventsInRange } from "@/lib/hub-data";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Events for a window, so the calendar tile can page between months without a
 * full page load.
 *
 * The data comes from Postgres, not from CalDAV. `getCalendarEvents` in
 * packages/nextcloud is a stub that returns [] and always has been, but more
 * importantly the direction is deliberate: `threads` is the record and the
 * Nextcloud calendar is a projection of it (see packages/services/org-calendar.ts).
 * Reading back from the mirror would be slower, lossier and circular.
 */
export const dynamic = "force-dynamic";

/** Refuse to page arbitrarily far — one query should be one screen of dates. */
const MAX_SPAN_DAYS = 92;

export async function GET(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  const params = new URL(request.url).searchParams;
  const from = parseDate(params.get("from")) ?? startOfMonth(new Date());
  const to = parseDate(params.get("to")) ?? addMonths(from, 1);

  if (to <= from) {
    return Response.json({ error: "Empty range" }, { status: 400 });
  }
  const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
  if (spanDays > MAX_SPAN_DAYS) {
    return Response.json({ error: "Range too wide" }, { status: 400 });
  }

  return Response.json({
    from: from.toISOString(),
    to: to.toISOString(),
    events: await getEventsInRange(from, to),
  });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}
