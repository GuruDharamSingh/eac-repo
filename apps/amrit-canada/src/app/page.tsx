import Link from "next/link";
import { listOrgFeeds, listOrgEventsInRange } from "@elkdonis/services";
import { addMonths, startOfMonth } from "@elkdonis/utils";
import { Button } from "@/components/ui/button";
import { ThreadCard } from "@/components/thread-card";
import { GuideProfileCard } from "@/components/guide-profile-card";
import { CalendarFace } from "@elkdonis/cms-ui/hub";
import {
  getAttendanceCount,
  getCycleStatus,
  getGuideBySlug,
  getSiteSections,
  getUpcomingThreads,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export default async function HomePage() {
  const now = new Date();
  const calFrom = startOfMonth(now);

  const [feeds, sections, upcoming, calEvents, viewer, teacher] = await Promise.all([
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    getSiteSections(),
    getUpcomingThreads(20),
    listOrgEventsInRange(siteConfig.orgId, calFrom, addMonths(calFrom, 1)),
    getViewer().catch(() => null),
    getGuideBySlug("guru-dharam-singh").catch(() => null),
  ]);

  const feedNameMap = Object.fromEntries(feeds.map((f) => [f.slug, f.name]));

  const enriched = await Promise.all(
    upcoming.map(async (thread) => ({
      thread,
      cycleStatus: thread.scheduledAt ? await getCycleStatus(thread) : undefined,
      attendanceCount: thread.isRsvpEnabled ? await getAttendanceCount(thread) : undefined,
    }))
  );

  const about = sections.about;

  return (
    <>
      {/* Feed */}
      <section className="px-5 py-10 pb-16">
        <div className="mx-auto max-w-3xl">
          {/* Profile card */}
          <div className="card-natural mb-8 p-6">
            <h2 className="font-serif text-xl font-semibold text-[#36454f]">
              {siteConfig.orgName}
            </h2>
            <p className="mt-1 text-sm italic text-[#d16b47]">{siteConfig.tagline}</p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              {siteConfig.orgName} offers space and organizational support for the GTA&rsquo;s
              Sikh yoga community. Find ongoing events here involving multiple yoga and Sikh
              teachers, businesses, and communities.
            </p>
          </div>

          {enriched.length > 0 ? (
            <div className="space-y-4">
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
            <p className="text-muted-foreground">Nothing scheduled yet. Check back soon.</p>
          )}
        </div>
      </section>

      {/* Our Tradition */}
      {about && (
        <section className="border-t-2 border-[#e6b422]/30 py-16">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="text-center font-serif text-3xl">{about.title ?? "Our Tradition"}</h2>
            <hr className="saffron-divider mx-auto max-w-xs" />

            <div className="mt-8 grid gap-10 md:grid-cols-2">
              <div>
                {teacher && (
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
                )}
                <p className="mt-6 text-lg leading-relaxed">
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

              <div>
                <CalendarFace initialEvents={calEvents} canEdit={Boolean(viewer?.canEdit)} />
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
