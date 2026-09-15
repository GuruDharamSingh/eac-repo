import { readOrgCalendarWindow } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * Events for a window, so the calendar surface can page between months
 * without a full page load.
 *
 * The window parsing, the span limit and the query are shared
 * (`readOrgCalendarWindow`) because three sites served this route with three
 * copies of them. What stays here is this app's gate, which is the security
 * boundary and belongs in the route it protects.
 *
 * The data comes from Postgres, not CalDAV: `threads` is the record and the
 * org's Nextcloud calendar is a projection of it. Reading back from the
 * mirror would be slower, lossier and circular.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

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
