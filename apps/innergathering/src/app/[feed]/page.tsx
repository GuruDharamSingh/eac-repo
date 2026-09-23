import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getOrgFeed } from "@elkdonis/services";
import { ThreadCard } from "@/components/thread-card";
import { FeedBanner } from "@/components/feed-banner";
import {
  getAttendanceCount,
  getCycleStatus,
  getSiteSections,
  getThreadsForFeed,
  listOrgWriting,
} from "@/lib/data";
import { WritingShelf } from "@elkdonis/cms-ui/writing";
import { hexToHslTriplet } from "@/lib/color";
import { siteConfig } from "@/config/site";

/**
 * Every section of the site is this one route.
 *
 * Before the rebuild /sadhana, /yoga and /gurdwara were three line-for-line
 * duplicate files. Feed identity, accent, presenter and pull-quote now come
 * from the database, so adding a fourth section is a row.
 */

interface FeedPageProps {
  params: Promise<{ feed: string }>;
}

export async function generateMetadata({ params }: FeedPageProps): Promise<Metadata> {
  const { feed: slug } = await params;
  const feed = await getOrgFeed(siteConfig.orgId, slug);
  if (!feed) return {};
  return {
    title: feed.name,
    description: feed.tagline ?? feed.description ?? undefined,
  };
}

export default async function FeedPage({ params }: FeedPageProps) {
  const { feed: slug } = await params;
  const [feed, sections] = await Promise.all([
    getOrgFeed(siteConfig.orgId, slug),
    getSiteSections(),
  ]);

  // A private feed 404s for the public rather than 403-ing: an unpublished
  // section shouldn't confirm its own existence.
  if (!feed || !feed.isPublic) notFound();

  const threads = await getThreadsForFeed(feed.slug);

  // The blog feed leads with the members' own writing.
  //
  // It is the one section whose subject is people writing, and the shelf is
  // how writing is read everywhere else in the network — on a profile, in the
  // reading room. Putting the threads first would have made the page's own
  // name a heading over somebody else's content. The feed's posts still
  // follow, under their own heading.
  const writing = feed.slug === "blog" ? await listOrgWriting(7) : [];

  const enriched = await Promise.all(
    threads.map(async (thread) => ({
      thread,
      cycleStatus:
        thread.scheduledAt && thread.recurrencePattern && thread.recurrencePattern !== "NONE"
          ? await getCycleStatus(thread)
          : undefined,
      attendanceCount: thread.isRsvpEnabled ? await getAttendanceCount(thread) : undefined,
    }))
  );

  const accent = hexToHslTriplet(feed.accent);
  // Each section's pull-quote, carried over from the original pages.
  const quote = sections[`quote_${feed.slug.replace(/-/g, "_")}`]?.body;

  return (
    <div
      style={
        accent
          ? ({
              ["--feed" as string]: `hsl(${accent})`,
              ["--feed-glow" as string]: `hsl(${accent} / 0.3)`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <FeedBanner
        eyebrow={feed.presenter ? `Presented by ${feed.presenter}` : null}
        title={feed.name}
        subtitle={feed.tagline}
        accent={accent}
      />

      <div className="mx-auto max-w-5xl px-5 py-12">
        {feed.description && (
          <p className="max-w-3xl text-lg leading-relaxed">{feed.description}</p>
        )}

        {writing.length > 0 && (
          <div className="mt-10">
            <WritingShelf
              items={writing.map((piece) => ({
                id: piece.id,
                slug: piece.slug,
                title: piece.title,
                lede: piece.lede,
                coverImageUrl: piece.coverImageUrl,
                publishedAt: piece.publishedAt,
                authorName: piece.authorName,
                // Each piece lives on its author's page, so the row carries
                // its own link rather than deriving one from a shared base.
                href: piece.href,
              }))}
              basePath="/artists"
              heading="From the members"
              kicker={null}
            />
          </div>
        )}

        {enriched.length === 0 ? (
          <p className="card-natural mt-10 p-10 text-center italic text-muted-foreground">
            Nothing scheduled here yet. Check back soon.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2" aria-label={feed.name}>
            {enriched.map(({ thread, cycleStatus, attendanceCount }) => (
              <ThreadCard
                feedName={feed.name}
                key={thread.id}
                thread={thread}
                cycleStatus={cycleStatus}
                attendanceCount={attendanceCount}
              />
            ))}
          </div>
        )}

        {quote && (
          <>
            <hr className="saffron-divider mt-14" />
            <blockquote className="amrit-quote">{quote}</blockquote>
          </>
        )}
      </div>
    </div>
  );
}
