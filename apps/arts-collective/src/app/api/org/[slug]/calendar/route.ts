import { db } from "@elkdonis/db";
import { readOrgCalendarWindow, getOrgRole } from "@elkdonis/services";
import { requireUser } from "@/lib/session";

/**
 * One org's events for a window, so the console's calendar can page between
 * months without reloading the page.
 *
 * Org-scoped by URL because unlike the single-tenant template apps this
 * console serves whichever org the switcher selected — the org cannot come
 * from a `siteConfig` constant.
 *
 * Reads Postgres, not CalDAV: `threads` is the record and the org's Nextcloud
 * calendar is a projection of it, so reading back from the mirror would be
 * slower, lossier and circular.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const user = await requireUser();

  const rows = await db<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  const orgId = rows[0]?.id;
  if (!orgId) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await getOrgRole(user.id, orgId))) {
    return Response.json({ error: "Members only" }, { status: 403 });
  }

  const result = await readOrgCalendarWindow(
    orgId,
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
