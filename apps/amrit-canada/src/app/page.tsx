import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listOrgFeeds, listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { ThreadCard } from "@/components/thread-card";
import { GuideProfileCard } from "@/components/guide-profile-card";
import { CalendarFace } from "@elkdonis/cms-ui/hub";
import {
  getAttendanceCount,
  getCycleStatus,
  getGuideBySlug,
  getGuides,
  getPinnedThreads,
  getUpcomingThreads,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { formatShortDate, formatTime, toPlainText } from "@/lib/format";
import { SITE_VIEW_COOKIE } from "@/lib/writing-room";
import type { Thread } from "@/lib/types";

/** Collapsed rows shown before the rest fold into "N more". */
const OPEN_ROWS = 2;

/**
 * Landing page, 2026-09-26 layout: pinned content, a couple of collapsed
 * rows, the "upward spirits" line, the teachers, then Guru Dharam's section.
 * The org blurb and the "Our Tradition" block were removed; /about stays.
 */
export default async function HomePage() {
  const viewer = await getViewer().catch(() => null);

  // The two writers land in the writing room. Leaving it through "View site"
  // sets a session cookie, so the landing page is reachable for the rest of
  // the browser session.
  if (
    viewer &&
    (siteConfig.writingRoomEmails as readonly string[]).includes(viewer.email.toLowerCase()) &&
    !(await cookies()).get(SITE_VIEW_COOKIE)
  ) {
    redirect("/write");
  }

  const now = new Date();
  const calFrom = startOfMonth(now);

  const [feeds, pinned, upcoming, guides, calEvents, teacher] = await Promise.all([
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    getPinnedThreads(3),
    getUpcomingThreads(20),
    getGuides().catch(() => []),
    listOrgEventsInRange(siteConfig.orgId, calFrom, addMonths(calFrom, 1)),
    getGuideBySlug("guru-dharam-singh").catch(() => null),
  ]);

  const feedNameMap = Object.fromEntries(feeds.map((f) => [f.slug, f.name]));

  // With nothing pinned, the next upcoming item takes the lead slot so the
  // page does not open on a row of collapsed titles.
  const pinnedIds = new Set(pinned.map((t) => t.id));
  const rest = upcoming.filter((t) => !pinnedIds.has(t.id));
  const lead = pinned.length > 0 ? pinned : rest.slice(0, 1);
  const rows = pinned.length > 0 ? rest : rest.slice(1);

  const leadEnriched = await Promise.all(
    lead.map(async (thread) => ({
      thread,
      cycleStatus: thread.scheduledAt ? await getCycleStatus(thread) : undefined,
      attendanceCount: thread.isRsvpEnabled ? await getAttendanceCount(thread) : undefined,
    }))
  );

  const openRows = rows.slice(0, OPEN_ROWS);
  const moreRows = rows.slice(OPEN_ROWS);

  return (
    <>
      {/* Pinned */}
      <section className="px-5 pt-10">
        <div className="mx-auto max-w-3xl space-y-4">
          {leadEnriched.map(({ thread, cycleStatus, attendanceCount }) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              cycleStatus={cycleStatus}
              attendanceCount={attendanceCount}
              feedName={thread.feedSlug ? feedNameMap[thread.feedSlug] : undefined}
            />
          ))}
          {leadEnriched.length === 0 && (
            <p className="text-muted-foreground">Nothing scheduled yet. Check back soon.</p>
          )}
          {viewer?.canEdit && pinned.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nothing is pinned. Pin an item from{" "}
              <Link href="/manage" className="underline underline-offset-2">
                Manage
              </Link>{" "}
              to put it here.
            </p>
          )}
        </div>
      </section>

      {/* Collapsed rows */}
      {rows.length > 0 && (
        <section className="px-5 pt-6">
          <div className="mx-auto max-w-3xl border-t border-foreground/25">
            {openRows.map((thread) => (
              <CollapsedRow key={thread.id} thread={thread} feedName={feedNameMap[thread.feedSlug ?? ""]} />
            ))}
            {moreRows.length > 0 && (
              <details className="group border-b border-foreground/25">
                <summary className="cursor-pointer list-none py-3 text-sm text-muted-foreground hover:text-foreground">
                  <span className="group-open:hidden">{moreRows.length} more</span>
                  <span className="hidden group-open:inline">Fewer</span>
                </summary>
                <div className="border-t border-foreground/15">
                  {moreRows.map((thread) => (
                    <CollapsedRow
                      key={thread.id}
                      thread={thread}
                      feedName={feedNameMap[thread.feedSlug ?? ""]}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>
      )}

      {/* Subheader */}
      <section className="px-5 pt-20 pb-10">
        <div className="mx-auto max-w-3xl border-y border-foreground/80 py-8 text-center">
          <h2 className="font-serif text-3xl tracking-wide sm:text-4xl">
            We are creating upward spirits
          </h2>
        </div>
      </section>

      {/* Teachers */}
      {guides.length > 0 && (
        <section className="px-5 pb-16">
          <div className="mx-auto max-w-5xl">
            <h3 className="font-serif text-xl">Teachers</h3>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <li key={guide.userId} className="card-natural flex flex-col">
                  {guide.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={guide.photoUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <span
                      aria-hidden
                      className="flex aspect-[4/3] w-full items-center justify-center bg-muted font-serif text-4xl"
                    >
                      {guide.displayName.charAt(0)}
                    </span>
                  )}
                  <div className="flex flex-1 flex-col border-t border-foreground/20 p-5">
                    <h4 className="font-serif text-lg">
                      <Link href={`/about/${guide.slug}`} className="underline-offset-4 hover:underline">
                        {guide.displayName}
                      </Link>
                    </h4>
                    {guide.roleTitle && (
                      <p className="mt-1 text-sm text-muted-foreground">{guide.roleTitle}</p>
                    )}
                    {guide.bio && (
                      <p className="mt-3 text-sm leading-relaxed">{toPlainText(guide.bio, 160)}</p>
                    )}
                    <Link
                      href={`/about/${guide.slug}`}
                      className="mt-auto pt-4 text-sm underline underline-offset-4"
                    >
                      Read more
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Guru Dharam */}
      {teacher && (
        <section className="border-t border-foreground/25 px-5 py-16">
          <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2">
            <GuideProfileCard
              name={teacher.displayName}
              title={teacher.roleTitle}
              imageUrl={teacher.photoUrl}
              bio={teacher.bio}
              milestones={[
                {
                  year: "2023",
                  title: "Began leading the monthly Amrit Vela gathering",
                  description: "Continuing the practice begun by Guru Fatha Singh Ji.",
                },
              ]}
              contactHref="/amrit-vela"
              contactLabel="See upcoming sessions"
            />
            <div>
              <CalendarFace initialEvents={calEvents} canEdit={Boolean(viewer?.canEdit)} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/** One line per item; opens in place to the excerpt and a link. No JS. */
function CollapsedRow({ thread, feedName }: { thread: Thread; feedName?: string }) {
  const when = thread.nextOccurrenceAt;
  const preview = thread.excerpt ?? toPlainText(thread.description, 240);
  return (
    <details className="group border-b border-foreground/25">
      <summary className="flex cursor-pointer list-none items-baseline gap-4 py-3">
        <span className="w-28 shrink-0 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {when ? formatShortDate(when) : (feedName ?? "")}
        </span>
        <span className="min-w-0 flex-1 truncate font-serif text-base">{thread.title}</span>
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="pb-4 text-sm leading-relaxed sm:pl-32">
        {when && (
          <p className="text-muted-foreground">
            {formatTime(when)}
            {feedName ? ` · ${feedName}` : ""}
          </p>
        )}
        {preview && <p className="mt-1">{preview}</p>}
        <Link
          href={`/${thread.feedSlug}/${thread.slug}`}
          className="mt-2 inline-block underline underline-offset-4"
        >
          Open
        </Link>
      </div>
    </details>
  );
}
