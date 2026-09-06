import Link from "next/link";
import { CalendarDays, Clock, MapPin, Repeat, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CycleBadge } from "@/components/cycle-badge";
import {
  formatDuration,
  formatRecurrence,
  formatShortDate,
  formatTime,
  toPlainText,
} from "@/lib/format";
import type { Thread, ThreadCycleStatus } from "@/lib/types";

interface ThreadCardProps {
  thread: Thread;
  /** Only meaningful for dated, recurring items — omitted for posts. */
  cycleStatus?: ThreadCycleStatus;
  attendanceCount?: number;
}

export function ThreadCard({ thread, cycleStatus, attendanceCount }: ThreadCardProps) {
  const href = `/${thread.feedSlug}/${thread.slug}`;
  const when = thread.nextOccurrenceAt;
  const recurrence = formatRecurrence(thread.recurrencePattern);
  const duration = formatDuration(thread.durationMinutes);
  const preview = thread.excerpt ?? toPlainText(thread.description, 180);

  // .card-natural is the original saffron-bordered card with the warm glow and
  // hover lift — kept rather than redrawn with shadcn defaults.
  return (
    <article className="card-natural overflow-hidden">
      {thread.coverImageUrl && (
        // Nextcloud-proxied URLs aren't in an images allowlist, so a plain img
        // avoids next/image's remote-pattern config for user-uploaded media.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thread.coverImageUrl}
          alt=""
          className="h-44 w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          {when && (
            <Badge variant="secondary" className="gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {formatShortDate(when)}
            </Badge>
          )}
          {when && (
            <Badge variant="outline" className="gap-1">
              <Clock className="size-3.5" aria-hidden />
              {formatTime(when)}
              {duration ? ` · ${duration}` : ""}
            </Badge>
          )}
          {recurrence && (
            <Badge variant="outline" className="gap-1">
              <Repeat className="size-3.5" aria-hidden />
              {recurrence}
            </Badge>
          )}
        </div>

        <h3 className="mt-3 font-serif text-xl">
          <Link href={href} className="hover:underline underline-offset-4">
            {thread.title}
          </Link>
        </h3>

        {preview && <p className="mt-2 text-sm text-muted-foreground">{preview}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {thread.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {thread.location}
            </span>
          )}
          {thread.isOnline && thread.meetingUrl && (
            <span className="inline-flex items-center gap-1.5">
              <Video className="size-4" aria-hidden />
              Online
            </span>
          )}
          {typeof attendanceCount === "number" && attendanceCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {attendanceCount} coming
            </span>
          )}
          {thread.authorName && (
            <span>
              with{" "}
              {thread.authorSlug ? (
                <Link href={`/about/${thread.authorSlug}`} className="underline underline-offset-2">
                  {thread.authorName}
                </Link>
              ) : (
                thread.authorName
              )}
            </span>
          )}
        </div>

        {cycleStatus && (
          <div className="mt-4">
            <CycleBadge status={cycleStatus} />
          </div>
        )}
      </div>
    </article>
  );
}
