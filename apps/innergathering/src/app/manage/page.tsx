import Link from "next/link";
import { Plus } from "lucide-react";
import { getStandingMeetingId, listOrgFeeds } from "@elkdonis/services";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentRowActions } from "@/components/manage/content-row-actions";
import { getAllThreadsForOrg, getAttendanceCount, getCycleStatus } from "@/lib/data";
import { formatShortDate, formatTime } from "@/lib/format";
import { siteConfig } from "@/config/site";

/**
 * The editorial dashboard.
 *
 * Scoped by ORG, not by author — inner-gathering's equivalent (/offerings)
 * shows only what you personally wrote, which is right for a shared feed but
 * wrong for a site with an owner: the person running Amrit Canada needs to see
 * everything on it, including what a guide posted.
 */
export default async function ManageDashboard() {
  const [threads, feeds, standingId] = await Promise.all([
    getAllThreadsForOrg(),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }),
    // Which row is flagged to lead the hub, so its menu offers to unflag it.
    getStandingMeetingId(siteConfig.orgId),
  ]);

  const feedNames = new Map(feeds.map((f) => [f.slug, f.name]));

  const rows = await Promise.all(
    threads.map(async (thread) => ({
      thread,
      attendance: thread.isRsvpEnabled ? await getAttendanceCount(thread) : null,
      cycleStatus:
        thread.recurrencePattern && thread.recurrencePattern !== "NONE" && thread.scheduledAt
          ? await getCycleStatus(thread)
          : null,
    }))
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Content</h2>
        <Button asChild size="sm">
          <Link href="/manage/content/new">
            <Plus className="size-4" aria-hidden />
            New
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          Nothing here yet.{" "}
          <Link href="/manage/content/new" className="underline underline-offset-4">
            Post the first thing
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Page</th>
                <th className="pb-2 font-medium">When</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">RSVPs</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(({ thread, attendance, cycleStatus }) => (
                <tr key={thread.id} className="align-top">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/manage/content/${thread.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {thread.title}
                    </Link>
                    <span className="ml-2 text-xs capitalize text-muted-foreground">
                      {thread.kind}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {thread.feedSlug ? (feedNames.get(thread.feedSlug) ?? thread.feedSlug) : "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {thread.nextOccurrenceAt ? (
                      <>
                        {formatShortDate(thread.nextOccurrenceAt)}
                        <span className="block text-xs">
                          {formatTime(thread.nextOccurrenceAt)}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant={thread.status === "published" ? "secondary" : "outline"}>
                      {thread.status}
                    </Badge>
                    {cycleStatus && (
                      <Badge
                        variant={cycleStatus === "cancelled" ? "destructive" : "outline"}
                        className="ml-1"
                      >
                        {cycleStatus}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {attendance === null ? "—" : attendance}
                  </td>
                  <td className="py-3">
                    <ContentRowActions
                      threadId={thread.id}
                      status={thread.status}
                      feedSlug={thread.feedSlug}
                      slug={thread.slug}
                      isRecurring={Boolean(
                        thread.recurrencePattern && thread.recurrencePattern !== "NONE"
                      )}
                      hasRsvps={Boolean(attendance && attendance > 0)}
                      isDated={Boolean(thread.scheduledAt)}
                      isStanding={thread.id === standingId}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
