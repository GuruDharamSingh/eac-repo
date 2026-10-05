import Link from "next/link";
import { buildIcs, icsDataUrl } from "@elkdonis/cms-ui/surface";
import { RsvpPanel } from "@/components/rsvp-panel";
import { LocalTime } from "@/components/landing/LocalTime";
import { CallSlot, JoinRoomButton, OfferingCallProvider } from "@/components/landing/OfferingCall";
import { toSurfaceThread } from "@/lib/surface-thread";
import {
  formatDuration,
  formatRecurrence,
  formatShortDate,
  formatTime,
  toPlainText,
} from "@/lib/format";
import type { Thread, ThreadCycleStatus } from "@/lib/types";

export interface OfferingItem {
  thread: Thread;
  cycleStatus: ThreadCycleStatus | null;
  attendanceCount: number;
  attending: boolean;
}

/**
 * The public offerings, first thing under the header.
 *
 * The landing page used to mention them only in a small "Standing gatherings"
 * list beside the Web Portal copy. A visitor who came for the daily meeting
 * now finds when it is, how to get in, and a way to say they are coming,
 * without leaving the front page. The first offering is shown in full with
 * its RSVP; any others follow as compact rows.
 */
export function OfferingsBand({
  items,
  signedIn,
  nextcloudUrl,
}: {
  items: OfferingItem[];
  signedIn: boolean;
  nextcloudUrl: string | null;
}) {
  if (items.length === 0) return null;
  const [lead, ...rest] = items;

  return (
    <section id="offerings" className="ig-offer-section" aria-labelledby="ig-offer-heading">
      <div className="ig-offer-inner">
        <header className="ig-offer-header">
          <p className="ig-offer-eyebrow">Open to everyone</p>
          <h2 id="ig-offer-heading" className="ig-offer-heading">Current Offerings</h2>
        </header>

        <LeadOffering item={lead} signedIn={signedIn} nextcloudUrl={nextcloudUrl} />

        {rest.length > 0 && (
          <ul className="ig-offer-more">
            {rest.map(({ thread }) => {
              const when = thread.nextOccurrenceAt;
              return (
                <li key={thread.id}>
                  <Link href={`/${thread.feedSlug}/${thread.slug}`} className="ig-offer-more-row">
                    <span className="ig-offer-more-title">{thread.title}</span>
                    <span className="ig-offer-more-meta">
                      {[
                        when && `${formatShortDate(when)} · ${formatTime(when)}`,
                        formatRecurrence(thread.recurrencePattern),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="ig-offer-all">
          <Link href="/offerings">All offerings →</Link>
        </p>
      </div>
    </section>
  );
}

function LeadOffering({
  item,
  signedIn,
  nextcloudUrl,
}: {
  item: OfferingItem;
  signedIn: boolean;
  nextcloudUrl: string | null;
}) {
  const { thread, cycleStatus, attendanceCount, attending } = item;
  const href = `/${thread.feedSlug}/${thread.slug}`;
  const when = thread.nextOccurrenceAt;
  const recurrence = formatRecurrence(thread.recurrencePattern);
  const duration = formatDuration(thread.durationMinutes);
  const talkUrl =
    thread.talkToken && nextcloudUrl ? `${nextcloudUrl.replace(/\/$/, "")}/call/${thread.talkToken}` : null;
  const online = thread.isOnline || Boolean(talkUrl);
  const blurb = summary(thread);
  const ics = when
    ? buildIcs(
        toSurfaceThread(thread, {
          feed: { slug: thread.feedSlug, name: "Offerings" },
          rsvpCount: attendanceCount,
          viewerAttending: signedIn ? attending : null,
          cycleStatus,
        })
      )
    : null;

  const rsvp = thread.isRsvpEnabled ? (
    <div className="ig-offer-rsvp">
      <RsvpPanel
        className="ig-offer-rsvp-panel"
        threadId={thread.id}
        title={thread.title}
        signedIn={signedIn}
        alreadyAttending={attending}
        attendanceCount={attendanceCount}
        attendeeLimit={thread.attendeeLimit}
        cancelled={cycleStatus === "cancelled"}
      />
    </div>
  ) : null;

  return (
    <article className="ig-offer-card" data-thread={thread.id}>
      <OfferingCallProvider>
      {thread.coverImageUrl && (
        <Link href={href} className="ig-offer-media" tabIndex={-1} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={variant(thread.coverImageUrl, 1024)}
            srcSet={`${variant(thread.coverImageUrl, 512)} 512w, ${variant(thread.coverImageUrl, 1024)} 1024w`}
            sizes="(max-width: 900px) 92vw, 440px"
            alt=""
            loading="lazy"
          />
        </Link>
      )}

      <div className="ig-offer-body">
        <p className="ig-offer-kicker">{[recurrence, online ? "Online" : thread.location].filter(Boolean).join(" · ")}</p>
        <h3 className="ig-offer-title">
          <Link href={href}>{thread.title}</Link>
        </h3>
        {blurb && <p className="ig-offer-blurb">{blurb}</p>}

        {when && (
          <dl className="ig-offer-facts">
            <div>
              <dt>Time</dt>
              <dd>
                {formatTime(when)} Toronto
                <LocalTime iso={new Date(when).toISOString()} />
              </dd>
            </div>
            <div>
              <dt>Next</dt>
              <dd>{formatShortDate(when)}</dd>
            </div>
            {duration && (
              <div>
                <dt>Length</dt>
                <dd>{duration}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="ig-offer-actions">
          {/* Opens the call beside this, in place of the RSVP (OfferingCall.tsx). */}
          {talkUrl && <JoinRoomButton className="ig-offer-btn ig-offer-btn--primary" />}
          {ics && (
            <a className="ig-offer-btn" href={icsDataUrl(ics)} download={`${thread.slug}.ics`}>
              Add to calendar
            </a>
          )}
          <Link className="ig-offer-link" href={href}>
            Details →
          </Link>
        </div>
      </div>

      {talkUrl ? (
        <CallSlot talkUrl={talkUrl} title={thread.title}>{rsvp}</CallSlot>
      ) : (
        rsvp
      )}
      </OfferingCallProvider>
    </article>
  );
}

/**
 * A one- or two-sentence blurb. Excerpts written by the composer often open
 * by repeating the title (the body's first line is the title again), which
 * reads as a stutter on a card, so a leading or repeated title is dropped.
 */
function summary(thread: Thread): string {
  // The body rather than the stored excerpt: the excerpt is cut at a fixed
  // length, often mid-way through the repeated title.
  let text = toPlainText(thread.description ?? thread.excerpt, 1200).replace(/…$/, "");
  const title = thread.title.trim().toLowerCase();
  if (title && text.toLowerCase().startsWith(title)) text = text.slice(title.length).trim();
  const again = title ? text.toLowerCase().indexOf(title) : -1;
  if (again > 0) text = text.slice(0, again).trim();
  if (text.length <= 240) return text;
  // Otherwise end on a sentence if one closes in time, else on a word.
  const cut = text.slice(0, 240);
  const stop = cut.lastIndexOf(". ");
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function variant(src: string, width: number): string {
  return src.startsWith("/api/media/") ? `${src}?w=${width}` : src;
}
