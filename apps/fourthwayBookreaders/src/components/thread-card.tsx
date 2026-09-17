import Link from "next/link";
import { BookOpen, CalendarDays, Clock, MapPin, Repeat, Video } from "lucide-react";
import { READING_GROUP_KIND, type Thread } from "@/lib/types";
import { formatDuration, formatRecurrence, formatWhen, textOf } from "@/lib/format";

export function threadHref(t: Thread): string {
  return `/${t.feedSlug ?? "groups"}/${t.slug}`;
}

/** A gathering, as a card. Used in the left column and on the feed pages. */
export function ThreadCard({ thread, attending }: { thread: Thread; attending?: number }) {
  const when = formatWhen(thread.nextOccurrenceAt);
  const dur = formatDuration(thread.durationMinutes);
  const rec = formatRecurrence(thread.recurrencePattern);
  const isGroup = thread.kind === READING_GROUP_KIND;
  return (
    <article className="card">
      <p className="eyebrow">{isGroup ? "Reading group" : thread.kind}</p>
      <h3 className="card__title">
        <Link href={threadHref(thread)} style={{ textDecoration: "none", color: "inherit" }}>
          {thread.title}
        </Link>
      </h3>
      <div className="card__meta">
        {isGroup && thread.bookTitle && (
          <span><BookOpen size={13} aria-hidden /> {thread.bookTitle}{thread.currentPage ? `, p. ${thread.currentPage}` : ""}</span>
        )}
        {when && <span><CalendarDays size={13} aria-hidden /> {isGroup ? `next: ${when}` : when}</span>}
        {dur && <span><Clock size={13} aria-hidden /> {dur}</span>}
        {rec && <span><Repeat size={13} aria-hidden /> {rec}</span>}
        {thread.location && <span><MapPin size={13} aria-hidden /> {thread.location}</span>}
        {thread.isOnline && <span><Video size={13} aria-hidden /> online</span>}
        {typeof attending === "number" && attending > 0 && <span>{attending} {isGroup ? (attending === 1 ? "reader" : "readers") : "attending"}</span>}
      </div>
      <p className="card__body">{thread.excerpt ?? textOf(thread.description)}</p>
      <div className="card__actions">
        <Link href={threadHref(thread)} className="btn btn--primary">
          {isGroup ? "See the group" : thread.isRsvpEnabled ? "RSVP" : "Details"}
        </Link>
        {thread.authorName && (
          <span className="eyebrow" style={{ alignSelf: "center" }}>led by {thread.authorName}</span>
        )}
      </div>
    </article>
  );
}
