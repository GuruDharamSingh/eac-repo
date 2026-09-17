import { getPreviousMeetingOccurrence } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { forbidden, getHubViewer } from "@/lib/hub-auth";

/**
 * The gathering before this one, and what it produced.
 *
 * Paging back is one request per step rather than the hub loading a year of
 * history nobody will open — the same budget the rest of the hub keeps: the
 * page draws from what it already has, and depth is fetched when asked for.
 *
 * `before` is an ISO instant, not a page number, so the arrow works the same
 * whether the series is one recurring thread or a thread per week. The
 * service is org-scoped: a threadId belonging to another org simply has no
 * history here.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await getHubViewer();
  if (!viewer) return forbidden();

  const url = new URL(request.url);
  const threadId = (url.searchParams.get("threadId") ?? "").trim();
  const before = (url.searchParams.get("before") ?? "").trim();
  if (!threadId || !before) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  if (Number.isNaN(new Date(before).getTime())) {
    return Response.json({ error: "Bad date" }, { status: 400 });
  }

  const occurrence = await getPreviousMeetingOccurrence(siteConfig.orgId, {
    threadId,
    before,
  });

  // Null is the ordinary answer for a gathering's first week, not a failure.
  return Response.json({ occurrence: occurrence ?? null });
}
