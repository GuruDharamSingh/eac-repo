import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listOrgFeeds } from "@elkdonis/services";
import { Button } from "@/components/ui/button";
import { CycleBadge } from "@/components/cycle-badge";
import { ThreadCard } from "@/components/thread-card";
import { HeroBanner } from "@/components/hero-banner";
import { getAttendanceCount, getCycleStatus, getNextInFeed, getSiteSections } from "@/lib/data";
import { hexToHslTriplet } from "@/lib/color";
import { formatDate, formatTime } from "@/lib/format";
import { siteConfig } from "@/config/site";

export default async function HomePage() {
  const [feeds, sections] = await Promise.all([
    listOrgFeeds(siteConfig.orgId).catch(() => []),
    getSiteSections(),
  ]);

  // One preview per feed. The first (Amrit Vela) leads, because "is sadhana
  // on?" is the question most visitors arrive with.
  const previews = await Promise.all(
    feeds.map(async (feed) => {
      const thread = await getNextInFeed(feed.slug);
      return {
        feed,
        thread,
        cycleStatus: thread?.scheduledAt ? await getCycleStatus(thread) : undefined,
        attendanceCount: thread?.isRsvpEnabled ? await getAttendanceCount(thread) : undefined,
      };
    })
  );

  const lead = previews[0];
  const hero = sections.hero;
  const about = sections.about;

  return (
    <>
      <HeroBanner />

      {/* Intro — the site's own words, editable from /manage/pages. */}
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

        {lead?.thread && (
          <div className="card-natural mx-auto mt-10 max-w-2xl p-6 text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Next {lead.feed.name}
            </p>
            <h2 className="mt-2 font-serif text-2xl">
              <Link
                href={`/${lead.feed.slug}/${lead.thread.slug}`}
                className="underline-offset-4 hover:underline"
              >
                {lead.thread.title}
              </Link>
            </h2>
            {lead.thread.nextOccurrenceAt && (
              <p className="mt-2 text-sm">
                {formatDate(lead.thread.nextOccurrenceAt)} at{" "}
                {formatTime(lead.thread.nextOccurrenceAt)}
                <span className="text-muted-foreground"> · Toronto time</span>
              </p>
            )}
            {lead.cycleStatus && (
              <div className="mt-4">
                <CycleBadge status={lead.cycleStatus} />
              </div>
            )}
            {typeof lead.attendanceCount === "number" && lead.attendanceCount > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {lead.attendanceCount}{" "}
                {lead.attendanceCount === 1 ? "person is" : "people are"} coming.
              </p>
            )}
            <Button asChild size="sm" className="mt-5">
              <Link href={`/${lead.feed.slug}/${lead.thread.slug}`}>
                Details and RSVP <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </section>

      {/* Our Practices — the dark portal tiles, one per feed from org_feeds. */}
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="text-center font-serif text-3xl">Our Practices</h2>
        <hr className="saffron-divider mx-auto max-w-xs" />

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {feeds.map((feed) => {
            const accent = hexToHslTriplet(feed.accent);
            const accentColor = accent ? `hsl(${accent})` : "#f4c430";
            return (
              <Link
                key={feed.slug}
                href={`/${feed.slug}`}
                className="portal-tile group flex flex-col rounded-2xl border-2 p-7 text-center"
                style={
                  {
                    // Dark tile tinted with the feed's own colour, replacing the
                    // three hardcoded gradients the original had.
                    background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 12%, #1a1a1a) 0%, color-mix(in srgb, ${accentColor} 22%, #2c3e50) 100%)`,
                    borderColor: `color-mix(in srgb, ${accentColor} 50%, transparent)`,
                    ["--feed-glow" as string]: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
                  } as React.CSSProperties
                }
              >
                <h3
                  className="font-serif text-2xl font-bold tracking-wide"
                  style={{ color: accentColor, textShadow: "1px 1px 6px rgba(0,0,0,0.5)" }}
                >
                  {feed.name}
                </h3>
                {feed.tagline && (
                  <p className="mt-3 text-sm leading-relaxed text-[#fdf5e6]/85">
                    {feed.tagline}
                  </p>
                )}
                <span
                  className="mt-auto pt-6 text-sm underline-offset-4 group-hover:underline"
                  style={{ color: accentColor }}
                >
                  View schedule →
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* What's next elsewhere — the lead is already shown above. */}
      {previews.slice(1).some((p) => p.thread) && (
        <section className="mx-auto max-w-5xl px-5 pb-16">
          <h2 className="font-serif text-2xl">Coming up</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {previews.slice(1).map(
              ({ thread, cycleStatus, attendanceCount }) =>
                thread && (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    cycleStatus={cycleStatus}
                    attendanceCount={attendanceCount}
                  />
                )
            )}
          </div>
        </section>
      )}

      {/* Our Tradition — Guru Fatha Singh's lineage and the handover in 2023. */}
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
