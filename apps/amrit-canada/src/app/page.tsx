import Link from "next/link";
import { listOrgFeeds, listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { Button } from "@/components/ui/button";
import { ThreadCard } from "@/components/thread-card";
import { HeroBanner } from "@/components/hero-banner";
import { CalendarFace } from "@/components/hub/CalendarFace";
import {
  getAttendanceCount,
  getCycleStatus,
  getSiteSections,
  getUpcomingThreads,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export default async function HomePage() {
  const now = new Date();
  const calFrom = startOfMonth(now);

  const [feeds, sections, upcoming, calEvents, viewer] = await Promise.all([
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    getSiteSections(),
    getUpcomingThreads(20),
    listOrgEventsInRange(siteConfig.orgId, calFrom, addMonths(calFrom, 1)),
    getViewer().catch(() => null),
  ]);

  const feedNameMap = Object.fromEntries(feeds.map((f) => [f.slug, f.name]));

  const enriched = await Promise.all(
    upcoming.map(async (thread) => ({
      thread,
      cycleStatus: thread.scheduledAt ? await getCycleStatus(thread) : undefined,
      attendanceCount: thread.isRsvpEnabled ? await getAttendanceCount(thread) : undefined,
    }))
  );

  const hero = sections.hero;
  const about = sections.about;

  return (
    <>
      <HeroBanner />

      {/* Intro */}
      <section className="mx-auto max-w-4xl px-5 py-14 text-center">
        <h1 className="font-serif text-[clamp(1.8rem,5vw,2.6rem)] leading-tight">
          {hero?.title ?? siteConfig.orgName}
        </h1>
        <p className="mt-3 text-lg italic text-[#d16b47]">
          {hero?.subtitle ?? siteConfig.tagline}
        </p>
        {hero?.body && (
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed">{hero.body}</p>
        )}
        {hero?.note && (
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{hero.note}</p>
        )}
      </section>

      {/* Feed + calendar */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-8 md:grid-cols-[1fr_280px]">
          {/* Unified feed */}
          <div>
            <h2 className="font-serif text-2xl">What&rsquo;s Happening</h2>
            <hr className="saffron-divider max-w-xs" />

            {enriched.length > 0 ? (
              <div className="mt-6 space-y-4">
                {enriched.map(({ thread, cycleStatus, attendanceCount }) => (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    cycleStatus={cycleStatus}
                    attendanceCount={attendanceCount}
                    feedName={thread.feedSlug ? feedNameMap[thread.feedSlug] : undefined}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-6 text-muted-foreground">Nothing scheduled yet. Check back soon.</p>
            )}
          </div>

          {/* Calendar card */}
          <aside className="hidden md:block">
            <CalendarFace
              initialEvents={calEvents}
              canEdit={Boolean(viewer?.canEdit)}
            />
          </aside>
        </div>
      </section>

      {/* Our Tradition */}
      {about && (
        <section className="border-t-2 border-[#e6b422]/30 py-16">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center font-serif text-3xl">{about.title ?? "Our Tradition"}</h2>
            <hr className="saffron-divider mx-auto max-w-xs" />

            <div className="mt-8 grid items-center gap-10 md:grid-cols-2">
              {about.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={about.imageUrl}
                  alt={about.imageAlt ?? ""}
                  className="w-full rounded-2xl border-4 border-[#f4c430] object-cover shadow-[0_12px_32px_rgba(244,196,48,0.3)]"
                />
              )}
              <div>
                <p className="text-lg leading-relaxed">
                  {about.linkUrl ? (
                    <>
                      <strong>Guru Fatha Singh Ji</strong>{" "}
                      <a
                        href={about.linkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#d16b47] underline underline-offset-2"
                      >
                        ({about.linkLabel ?? "see his website here"})
                      </a>{" "}
                      {about.body?.replace(/^Guru Fatha Singh Ji\s*/, "")}
                    </>
                  ) : (
                    about.body
                  )}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-6">
                  <Link href="/about">Meet the teachers</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
