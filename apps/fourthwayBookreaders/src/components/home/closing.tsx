import Link from "next/link";
import { CalendarDays, Clock, MapPin, Video } from "lucide-react";
import type { Quote } from "@elkdonis/services";
import { READING_GROUP_KIND, type Thread } from "@/lib/types";
import { threadHref } from "@/components/thread-card";
import { formatDuration, formatWhen } from "@/lib/format";
import { RsvpButton } from "@/components/rsvp-button";

/** A line from the book beside the circle you can join. */
export function Closing({
  quote,
  thread,
  attending,
  signedIn,
  going,
  talkBaseUrl,
}: {
  quote: Quote | null;
  thread: Thread | null;
  attending: number;
  signedIn: boolean;
  going: boolean;
  talkBaseUrl: string | null;
}) {
  const isGroup = thread?.kind === READING_GROUP_KIND;
  const when = formatWhen(thread?.nextOccurrenceAt ?? null);
  const dur = formatDuration(thread?.durationMinutes ?? null);
  const callUrl =
    thread?.meetingUrl ??
    thread?.videoLink ??
    (thread?.talkToken && talkBaseUrl ? `${talkBaseUrl}/call/${thread.talkToken}` : null);

  return (
    <div className="close">
      <div className="pullquote">
        {quote ? (
          <>
            <blockquote>{quote.body}</blockquote>
            <cite>
              {quote.attribution ?? "From the book"}
              {quote.source ? ` — ${quote.source}` : ""}
            </cite>
          </>
        ) : (
          <>
            <blockquote>
              A line from the book we&rsquo;re reading will sit here — chosen by
              the circle, changed by the day.
            </blockquote>
            <cite>Nothing chosen yet</cite>
          </>
        )}
      </div>

      <div className="attend">
        <div className="attend__head">{isGroup ? "The group now sitting" : "Coming up"}</div>
        <div className="attend__body">
          {thread ? (
            <>
              <h3 className="card__title">
                <Link href={threadHref(thread)} style={{ textDecoration: "none", color: "inherit" }}>
                  {thread.title}
                </Link>
              </h3>
              <div className="attend__when">
                {when && <span><CalendarDays size={13} aria-hidden /> {when}</span>}
                {dur && <span><Clock size={13} aria-hidden /> {dur}</span>}
                {thread.location && <span><MapPin size={13} aria-hidden /> {thread.location}</span>}
                {isGroup && thread.bookTitle && <span>{thread.bookTitle}{thread.currentPage ? ` — on page ${thread.currentPage}` : ""}</span>}
                {attending > 0 && <span>{attending} {isGroup ? (attending === 1 ? "reader" : "readers") : "attending"}</span>}
              </div>
              {callUrl && (
                <p style={{ margin: "0 0 12px" }}>
                  <a className="attend__link" href={callUrl} target="_blank" rel="noreferrer">
                    <Video size={13} aria-hidden /> Join the video call
                  </a>
                </p>
              )}
              <div className="card__actions">
                {thread.isRsvpEnabled ? (
                  <RsvpButton threadId={thread.id} signedIn={signedIn} going={going} joining={isGroup} />
                ) : (
                  <Link href={threadHref(thread)} className="btn btn--primary">Details</Link>
                )}
                <Link href={threadHref(thread)} className="btn">{isGroup ? "About the group" : "Simply attend"}</Link>
              </div>
            </>
          ) : (
            <div className="empty" style={{ border: 0, padding: 0, background: "none", textAlign: "left" }}>
              When a reading group is published it appears here with its time and a way in.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
