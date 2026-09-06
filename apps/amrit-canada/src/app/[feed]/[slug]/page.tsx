import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CalendarDays,
  Clock,
  Download,
  FileText,
  MapPin,
  MessagesSquare,
  Repeat,
  Video,
} from "lucide-react";
import { getOrgFeed } from "@elkdonis/services";
import { Badge } from "@/components/ui/badge";
import { CycleBadge } from "@/components/cycle-badge";
import { RsvpPanel } from "@/components/rsvp-panel";
import { ShareButton } from "@/components/share-button";
import { AttendeeList } from "@/components/attendee-list";
import {
  getAttendanceCount,
  getCycleStatus,
  getThreadBySlug,
  getThreadMaterials,
  getThreadRsvpForUser,
  listAttendees,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import {
  formatDate,
  formatDuration,
  formatRecurrence,
  formatTime,
  toPlainText,
} from "@/lib/format";
import { hexToHslTriplet } from "@/lib/color";
import { siteConfig } from "@/config/site";

interface ThreadPageProps {
  params: Promise<{ feed: string; slug: string }>;
}

export async function generateMetadata({ params }: ThreadPageProps): Promise<Metadata> {
  const { feed, slug } = await params;
  const thread = await getThreadBySlug(feed, slug);
  if (!thread) return {};

  const description = thread.excerpt ?? toPlainText(thread.description, 160);

  // OpenGraph matters here: the share link is how a gathering actually
  // spreads — pasted into a group chat, not found through search.
  return {
    title: thread.title,
    description,
    openGraph: {
      title: thread.title,
      description,
      type: "article",
      images: thread.coverImageUrl ? [thread.coverImageUrl] : undefined,
    },
  };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { feed: feedSlug, slug } = await params;

  const [thread, feed, viewer] = await Promise.all([
    getThreadBySlug(feedSlug, slug),
    getOrgFeed(siteConfig.orgId, feedSlug),
    getViewer(),
  ]);

  if (!thread || !feed) notFound();

  const isRecurring = Boolean(
    thread.recurrencePattern && thread.recurrencePattern !== "NONE"
  );

  const [cycleStatus, attendanceCount, myRsvp, attendees, materials] = await Promise.all([
    thread.scheduledAt ? getCycleStatus(thread) : Promise.resolve("pending" as const),
    thread.isRsvpEnabled ? getAttendanceCount(thread) : Promise.resolve(0),
    viewer ? getThreadRsvpForUser(thread, viewer.userId) : Promise.resolve(false),
    // Attendee names are member-only: showing who's coming is the point, but
    // publishing a roster of everyone who attends 4am worship to the open web
    // is not the same thing.
    viewer?.isMember ? listAttendees(thread) : Promise.resolve([]),
    getThreadMaterials(thread.id),
  ]);

  const when = thread.nextOccurrenceAt;
  const accent = hexToHslTriplet(feed.accent);
  const duration = formatDuration(thread.durationMinutes);
  const recurrence = formatRecurrence(thread.recurrencePattern);

  // Public Talk rooms (type 3) are joinable by link without an account, which
  // is what most attendees here have. Uses the browser-facing Nextcloud URL.
  const nextcloudPublicUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL;
  const talkUrl =
    thread.talkToken && nextcloudPublicUrl
      ? `${nextcloudPublicUrl.replace(/\/$/, "")}/call/${thread.talkToken}`
      : null;

  return (
    <article
      className="mx-auto max-w-3xl px-5 py-10"
      style={accent ? ({ ["--feed" as string]: `hsl(${accent})` } as React.CSSProperties) : undefined}
    >
      <Link
        href={`/${feed.slug}`}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← {feed.name}
      </Link>

      {thread.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.coverImageUrl}
          alt=""
          className="mt-5 aspect-[2/1] w-full rounded-2xl border-4 border-[#f4c430] object-cover shadow-[0_8px_28px_rgba(244,196,48,0.25)]"
        />
      )}

      <h1 className="mt-6 font-serif text-[clamp(1.9rem,5vw,2.8rem)] leading-tight">
        {thread.title}
      </h1>

      {thread.authorName && (
        <p className="mt-2 text-sm italic text-[hsl(var(--terracotta-deep))]">
          with{" "}
          {thread.authorSlug ? (
            <Link href={`/about/${thread.authorSlug}`} className="underline underline-offset-2">
              {thread.authorName}
            </Link>
          ) : (
            thread.authorName
          )}
        </p>
      )}

      {isRecurring && thread.scheduledAt && (
        <div className="mt-5">
          <CycleBadge status={cycleStatus} />
        </div>
      )}

      {(when || thread.location) && (
        <dl className="card-natural mt-6 grid gap-3 p-6 text-sm">
          {when && (
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="font-medium">{formatDate(when)}</dd>
              </div>
            </div>
          )}
          {when && (
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <dt className="sr-only">Time</dt>
                <dd>
                  {formatTime(when)}
                  {duration ? ` · ${duration}` : ""}{" "}
                  <span className="text-muted-foreground">(Toronto time)</span>
                </dd>
              </div>
            </div>
          )}
          {recurrence && (
            <div className="flex items-start gap-3">
              <Repeat className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <dd>{recurrence}</dd>
            </div>
          )}
          {thread.location && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <dd>{thread.location}</dd>
            </div>
          )}
          {thread.isOnline && thread.meetingUrl && (
            <div className="flex items-start gap-3">
              <Video className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <dd>
                <a
                  href={thread.meetingUrl}
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  Join online
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}

      {thread.description && (
        <div
          className="prose-amrit mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: thread.description }}
        />
      )}

      {thread.videoLink && (
        <p className="mt-6">
          <a
            href={thread.videoLink}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Watch the recording
          </a>
        </p>
      )}

      {materials.length > 0 && (
        <section className="card-natural mt-8 p-6">
          <h2 className="font-serif text-lg">Materials</h2>
          <ul className="mt-3 space-y-2">
            {materials.map((m) => (
              <li key={m.id}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm underline underline-offset-2"
                >
                  <Download className="size-4 shrink-0" aria-hidden />
                  {m.filename}
                  {m.size ? (
                    <span className="text-xs text-muted-foreground">
                      ({Math.max(1, Math.round(m.size / 1024))} KB)
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(thread.documentUrl || thread.talkToken) && (
        <div className="card-natural mt-8 space-y-3 p-6">
          <h2 className="font-serif text-lg">Together</h2>
          {thread.documentUrl && (
            <p className="flex items-start gap-3 text-sm">
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <a
                href={thread.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Open the shared document
              </a>
            </p>
          )}
          {thread.talkToken && talkUrl && (
            <p className="flex items-start gap-3 text-sm">
              <MessagesSquare
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span>
                <a
                  href={talkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Join the Talk room
                </a>{" "}
                <span className="text-muted-foreground">— no account needed.</span>
              </span>
            </p>
          )}
        </div>
      )}

      <hr className="saffron-divider" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="outline" className="capitalize">
          {thread.kind}
        </Badge>
        <ShareButton title={thread.title} />
      </div>

      {thread.isRsvpEnabled && (
        <>
          <RsvpPanel
            threadId={thread.id}
            title={thread.title}
            signedIn={Boolean(viewer)}
            alreadyAttending={myRsvp}
            attendanceCount={attendanceCount}
            attendeeLimit={thread.attendeeLimit}
            cancelled={cycleStatus === "cancelled"}
          />
          <AttendeeList
            attendees={attendees}
            total={attendanceCount}
            visible={Boolean(viewer?.isMember)}
          />
        </>
      )}
    </article>
  );
}
