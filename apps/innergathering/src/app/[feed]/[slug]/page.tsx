import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import {
  getGathering,
  getOrgFeed,
  getProfile,
  getWorkshopOffering,
  isEnrolledInWorkshop,
  listWorkshopMaterials,
} from "@elkdonis/services";
import { WorkshopView } from "@/components/workshop-view";
import { WorkshopMaterials } from "@/components/workshop-materials";
import { ArticleView } from "@elkdonis/cms-ui/article";
import {
  SurfacePage,
  buildIcs,
  icsDataUrl,
  threadViewParts,
  type SurfaceAction,
} from "@elkdonis/cms-ui/surface";
import { toSurfaceThread } from "@/lib/surface-thread";
import { CycleBadge } from "@/components/cycle-badge";
import { RsvpPanel } from "@/components/rsvp-panel";
import { ShareButton } from "@/components/share-button";
import { AttendeeList } from "@/components/attendee-list";
import { EditThreadButton } from "@/components/edit-thread-button";
import {
  getAttendanceCount,
  getCycleStatus,
  getThreadBySlug,
  getThreadMaterials,
  getThreadRsvpForUser,
  listAttendees,
} from "@/lib/data";
import { getViewer } from "@/lib/auth";
import { toPlainText } from "@/lib/format";
import { hexToHslTriplet } from "@/lib/color";
import { siteConfig } from "@/config/site";
import { termHref, threadHref } from "@/lib/gather";

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

/** The feed's accent, as an inline custom property. Null when unset. */
function accentStyle(hex: string | null | undefined): React.CSSProperties | undefined {
  const accent = hexToHslTriplet(hex);
  return accent
    ? ({ ["--feed" as string]: `hsl(${accent})` } as React.CSSProperties)
    : undefined;
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { feed: feedSlug, slug } = await params;

  const [thread, feed, viewer] = await Promise.all([
    getThreadBySlug(feedSlug, slug),
    getOrgFeed(siteConfig.orgId, feedSlug),
    getViewer(),
  ]);

  if (!thread || !feed) notFound();

  // Writing reads; gatherings are attended. Same route, two presentations —
  // a post rendered through the meeting page gets a date table, an RSVP panel
  // and a "Together" card it has no use for, and none of the reading
  // treatment it does. The kind decides which surface, not the route.
  if (thread.kind === "post") {
    return (
      <div
        className="mx-auto max-w-3xl px-5 py-10"
        style={accentStyle(feed.accent)}
      >
        <Link
          href={`/${feed.slug}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {feed.name}
        </Link>

        <ArticleView
          title={thread.title}
          lede={thread.excerpt}
          bodyHtml={thread.description ?? ""}
          authorName={thread.authorName}
          publishedAt={thread.publishedAt}
          kindLabel="Writing"
          org={{ name: feed.name, href: `/${feed.slug}` }}
          coverImageUrl={thread.coverImageUrl}
        >
          <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
            {viewer?.canEdit && <EditThreadButton threadId={thread.id} kind={thread.kind} />}
            <ShareButton title={thread.title} />
          </div>
        </ArticleView>
      </div>
    );
  }

  // A workshop has its own presentation: banner with a focal point, hero
  // media, sessions, colour. Same route, same RSVP underneath.
  if (thread.kind === "workshop") {
    const [offering, attendance, myRsvp, cycle] = await Promise.all([
      getWorkshopOffering(siteConfig.orgId, thread.slug),
      getAttendanceCount(thread),
      viewer ? getThreadRsvpForUser(thread, viewer.userId) : Promise.resolve(false),
      getCycleStatus(thread),
    ]);
    if (!offering) notFound();

    // Who gets the workspace: the author, anyone enrolled (an RSVP this
    // cycle, or a paid join), or someone who runs the org. The same rule the
    // media proxy applies to the folder, so the page never lists a file the
    // link would then refuse.
    const runsIt = Boolean(viewer && (viewer.canEdit || offering.authorId === viewer.userId));
    const enrolled =
      runsIt || (viewer ? myRsvp || (await isEnrolledInWorkshop(thread.id, viewer.userId)) : false);

    const [author, materials, attendees] = await Promise.all([
      offering.authorId ? getProfile(offering.authorId).catch(() => null) : Promise.resolve(null),
      // Listed with the service account either way; a visitor sees a count.
      listWorkshopMaterials(siteConfig.orgId, thread.id),
      viewer?.isMember ? listAttendees(thread) : Promise.resolve([]),
    ]);
    const talkUrl =
      offering.nextcloudTalkToken && process.env.NEXT_PUBLIC_NEXTCLOUD_URL
        ? `${process.env.NEXT_PUBLIC_NEXTCLOUD_URL.replace(/\/$/, "")}/call/${offering.nextcloudTalkToken}`
        : null;
    return (
      <WorkshopView
        workshop={offering}
        guide={author ? { name: author.displayName, photo: author.avatarUrl ?? null, slug: author.slug ?? null } : null}
        attendeeCount={attendance}
        enrolled={enrolled}
        materials={
          <WorkshopMaterials
            threadId={thread.id}
            materials={enrolled ? materials : materials.map((m) => ({ ...m, name: "", url: "" }))}
            access={enrolled ? "open" : "locked"}
            canEdit={runsIt}
          />
        }
        actions={
          <>
            {viewer?.canEdit && <EditThreadButton threadId={thread.id} kind={thread.kind} />}
            {talkUrl && (
              <a className="eac-btn" href={talkUrl} target="_blank" rel="noreferrer">Talk room</a>
            )}
            <ShareButton title={thread.title} />
          </>
        }
        aside={
          <>
            {thread.isRsvpEnabled && (
              <RsvpPanel
                threadId={thread.id}
                title={thread.title}
                signedIn={Boolean(viewer)}
                alreadyAttending={myRsvp}
                attendanceCount={attendance}
                attendeeLimit={thread.attendeeLimit}
                cancelled={cycle === "cancelled"}
              />
            )}
            {viewer?.isMember && attendance > 0 && (
              <AttendeeList attendees={attendees} total={attendance} visible />
            )}
          </>
        }
      />
    );
  }

  const isRecurring = Boolean(
    thread.recurrencePattern && thread.recurrencePattern !== "NONE"
  );

  const [cycleStatus, attendanceCount, myRsvp, attendees, materials, gathering] = await Promise.all([
    thread.scheduledAt ? getCycleStatus(thread) : Promise.resolve("pending" as const),
    thread.isRsvpEnabled ? getAttendanceCount(thread) : Promise.resolve(0),
    viewer ? getThreadRsvpForUser(thread, viewer.userId) : Promise.resolve(false),
    // Attendee names are member-only: showing who's coming is the point, but
    // publishing a roster of everyone who attends 4am worship to the open web
    // is not the same thing.
    viewer?.isMember ? listAttendees(thread) : Promise.resolve([]),
    getThreadMaterials(thread.id),
    // What the occasion holds — the document written here, the terms defined
    // out of it, the discussion it started. `isMember` gates the living
    // document's URL and nothing else does: that share is public and writable,
    // so the thread's own visibility is the wrong question.
    getGathering(thread.id, {
      viewerUserId: viewer?.userId ?? null,
      isMember: Boolean(viewer?.isMember),
      orgId: siteConfig.orgId,
      hrefFor: threadHref,
      termHref,
      // Files dropped into the thread's folder list beside the edges.
      withFolder: true,
    }),
  ]);

  const when = thread.nextOccurrenceAt;
  const accent = hexToHslTriplet(feed.accent);

  // Public Talk rooms (type 3) are joinable by link without an account, which
  // is what most attendees here have. Uses the browser-facing Nextcloud URL.
  const nextcloudPublicUrl = process.env.NEXT_PUBLIC_NEXTCLOUD_URL;
  const talkUrl =
    thread.talkToken && nextcloudPublicUrl
      ? `${nextcloudPublicUrl.replace(/\/$/, "")}/call/${thread.talkToken}`
      : null;

  // The page IS the surface at page size: same masthead, facts rail and foot
  // as the popup a feed card opens, so "Open page" is a continuation. The
  // guest RSVP form and the attendee list sit beneath it — they are this
  // site's own, and the popup links here for them.
  const surfaceThread = toSurfaceThread(thread, {
    feed: { slug: feed.slug, name: feed.name },
    rsvpCount: attendanceCount,
    viewerAttending: viewer ? myRsvp : null,
    cycleStatus,
    ...gathering,
  });
  const parts = threadViewParts(surfaceThread, { timeZone: "America/Toronto" });
  const ics = when ? buildIcs(surfaceThread) : null;

  const actions: SurfaceAction[] = [];
  if (ics) {
    actions.push({
      label: "Add to my calendar",
      quiet: true,
      href: icsDataUrl(ics),
      download: `${thread.slug}.ics`,
    });
  }
  if (thread.talkToken && talkUrl) {
    actions.push({ label: "Join the Talk room", href: talkUrl, external: true });
  }
  if (thread.isOnline && thread.meetingUrl) {
    actions.push({ label: "Join online", href: thread.meetingUrl, external: true, primary: true });
  }

  return (
    <div
      className="mx-auto max-w-5xl px-5 py-10"
      style={accent ? ({ ["--feed" as string]: `hsl(${accent})` } as React.CSSProperties) : undefined}
    >
      <SurfacePage
        kind={thread.kind}
        title={thread.title}
        kicker={parts.kicker}
        crumb={<Link href={`/${feed.slug}`}>← {feed.name}</Link>}
        rail={parts.rail}
        actions={actions}
        status={
          isRecurring && thread.scheduledAt ? (
            <CycleBadge status={cycleStatus} />
          ) : thread.isRsvpEnabled && attendanceCount > 0 ? (
            `${attendanceCount} coming`
          ) : null
        }
        footExtra={
          <>
            {viewer?.canEdit && <EditThreadButton threadId={thread.id} kind={thread.kind} />}
            <ShareButton title={thread.title} />
          </>
        }
      >
        {parts.main}

        {materials.length > 0 && (
          <section className="eac-surface-section" style={{ marginTop: 24 }}>
            <h3>Materials</h3>
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
      </SurfacePage>

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
    </div>
  );
}
