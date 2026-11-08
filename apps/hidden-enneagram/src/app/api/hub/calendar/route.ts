import { readOrgCalendarWindow } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { getApiMember } from "@/lib/auth";

/**
 * Events for a window, so the calendar dialog can page between months without
 * reloading the hub.
 *
 * The window parsing, the span limit and the query are shared
 * (`readOrgCalendarWindow`) because three sites served this route with three
 * copies of them. What stays here is this app's gate, which is the security
 * boundary and belongs in the route it protects.
 *
 * Reads Postgres, not CalDAV. `threads` is the record and the org's Nextcloud
 * calendar is a projection of it (see packages/services/src/org-calendar.ts) —
 * reading back from the mirror would be slower, lossier and circular. It would
 * also not work: `getCalendarEvents` in @elkdonis/nextcloud is a stub that has
 * always returned [].
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getApiMember();
  if (!viewer) {
    return Response.json({ error: "Members only" }, { status: 403 });
  }

  const result = await readOrgCalendarWindow(
    siteConfig.orgId,
    new URL(request.url).searchParams
  );
  // `=== false`, not `!result.ok`: this union does not narrow through the
  // negation in this repo's TS config.
  if (result.ok === false) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({
    from: result.from.toISOString(),
    to: result.to.toISOString(),
    events: result.events,
  });
}
