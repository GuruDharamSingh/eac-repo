import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, Clock, FileDown, Flag, MapPin, PlayCircle, Repeat, Video } from "lucide-react";
import { getAttendanceCount, getSessionNotes, getThreadBySlug, isGoing } from "@/lib/data";
import { GroupEditorPanel, SessionList } from "@/components/group-panels";
import { READING_GROUP_KIND } from "@/lib/types";
import { getViewer } from "@/lib/auth";
import { RsvpButton } from "@/components/rsvp-button";
import { formatDay, formatDuration, formatRecurrence, formatWhen } from "@/lib/format";

interface Props {
  params: Promise<{ feed: string; slug: string }>;
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { feed, slug } = await params;
  const thread = await getThreadBySlug(feed, slug);
  return { title: thread?.title ?? "Not found", description: thread?.excerpt ?? undefined };
}

export default async function ThreadPage({ params, searchParams }: Props) {
  const { feed, slug } = await params;
  const { error } = await searchParams;
  const [thread, viewer] = await Promise.all([getThreadBySlug(feed, slug), getViewer().catch(() => null)]);
  if (!thread) notFound();

  // One page for every kind; a reading group adds its book, its roster's
  // words ("join", "readers") and what its sittings have produced.
  const isGroup = thread.kind === READING_GROUP_KIND;
  const finished = Boolean(thread.endsOn && thread.endsOn.getTime() < Date.now());
  const [attending, going, notes] = await Promise.all([
    getAttendanceCount(thread.id),
    isGoing(thread.id, viewer?.userId ?? null),
    isGroup ? getSessionNotes(thread.id) : [],
  ]);
  const talkBase = process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;
  const callUrl =
    thread.meetingUrl ?? thread.videoLink ??
    (thread.talkToken && talkBase ? `${talkBase}/call/${thread.talkToken}` : null);
  const when = formatWhen(thread.nextOccurrenceAt);
  const dur = formatDuration(thread.durationMinutes);
  const rec = formatRecurrence(thread.recurrencePattern);

  return (
    <article className="column band">
      <p className="eyebrow"><Link href={`/${feed}`}>← {feed}</Link></p>
      <h1 style={{ fontSize: "1.9rem", marginTop: 6 }}>{thread.title}</h1>
      {thread.authorName && <p className="eyebrow" style={{ marginTop: 8 }}>{isGroup ? "kept" : "led"} by {thread.authorName}</p>}

      <div className="structure" data-has-media="true" style={{ marginTop: 24 }}>
        <div>
          {thread.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thread.coverImageUrl} alt="" style={{ width: "100%", borderRadius: 3, border: "1px solid var(--rule-strong)", marginBottom: 18 }} />
          )}
          {thread.description ? (
            // Sanitised in mapThread (src/lib/data.ts) — on read, because not every write path does.
            <div className="prose" dangerouslySetInnerHTML={{ __html: thread.description }} />
          ) : (
            <p style={{ color: "var(--ink-muted)" }}>No description yet.</p>
          )}
          {thread.documentUrl && (
            <a className="structure__doc" href={thread.documentUrl} target="_blank" rel="noreferrer">
              <FileDown size={14} aria-hidden /> The session&rsquo;s document
            </a>
          )}
        </div>

        <aside className="attend" style={{ alignSelf: "start" }}>
          <div className="attend__head">{isGroup ? (finished ? "This group has finished" : "The group") : "Attend"}</div>
          <div className="attend__body">
            <div className="attend__when" style={{ marginTop: 0 }}>
              {isGroup && thread.bookTitle && (
                <span><BookOpen size={13} aria-hidden /> {thread.bookTitle}{thread.bookAuthor ? ` — ${thread.bookAuthor}` : ""}</span>
              )}
              {isGroup && thread.currentPage != null && (
                <span><Flag size={13} aria-hidden /> on <Link href={`/books?page=${thread.currentPage}`}>page {thread.currentPage}</Link></span>
              )}
              {when && !finished && <span><CalendarDays size={13} aria-hidden /> {isGroup ? `next sitting: ${when}` : when}</span>}
              {dur && <span><Clock size={13} aria-hidden /> {dur}</span>}
              {rec && <span><Repeat size={13} aria-hidden /> {rec}</span>}
              {thread.location && <span><MapPin size={13} aria-hidden /> {thread.location}</span>}
              {thread.endsOn && <span>{finished ? "ran" : "runs"} until {formatDay(thread.endsOn)}</span>}
              {attending > 0 && <span>{attending} {isGroup ? (attending === 1 ? "reader" : "readers") : "attending"}</span>}
            </div>
            {callUrl && !finished && (
              <p style={{ margin: "0 0 12px" }}>
                <a className="attend__link" href={callUrl} target="_blank" rel="noreferrer">
                  <Video size={13} aria-hidden /> Join the video call
                </a>
              </p>
            )}
            {finished ? (
              <p className="eyebrow">Its sittings are below.</p>
            ) : thread.isRsvpEnabled ? (
              <RsvpButton threadId={thread.id} signedIn={Boolean(viewer)} going={going} returnTo={`/${feed}/${slug}`} joining={isGroup} />
            ) : (
              <p className="eyebrow">No RSVP needed — simply come.</p>
            )}
          </div>
        </aside>
      </div>

      {/* A session note: what it covered, and the recording if there is one. */}
      {!isGroup && (thread.pagesTo != null || thread.recordingUrl) && (
        <p className="card__meta" style={{ marginTop: 18 }}>
          {thread.pagesTo != null && <span><BookOpen size={13} aria-hidden /> {thread.pagesFrom != null ? `pages ${thread.pagesFrom}–${thread.pagesTo}` : `to page ${thread.pagesTo}`}</span>}
          {thread.recordingUrl && <span><PlayCircle size={13} aria-hidden /> <a href={thread.recordingUrl}>the recording</a></span>}
        </p>
      )}

      {isGroup && <SessionList notes={notes} />}
      {isGroup && viewer?.canEdit && <GroupEditorPanel group={thread} empty={error === "empty"} />}
    </article>
  );
}
