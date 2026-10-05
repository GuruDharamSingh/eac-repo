"use client";

import * as React from "react";
import Link from "next/link";
import { RsvpPanel } from "@/components/rsvp-panel";
import {
  formatDuration,
  formatRecurrence,
  formatShortDate,
  formatTime,
  toPlainText,
} from "@/lib/format";
import { toDate } from "./shared";
import type { WireEvent } from "./event-sample";
import "./offering-card.css";

// ============================================================================
// The "Current Offerings" lead card (ported from innergathering's
// OfferingsBand / OfferingCall): cover, kicker, title, blurb, facts, buttons,
// and a right-hand column that holds the RSVP, or the Talk room while it is
// open ("Join the room"). Reads one `event`, filled by a resolver.
// ============================================================================

const ALLOW = "camera; microphone; display-capture; fullscreen; autoplay; clipboard-write";

/** Escape a value for an iCalendar TEXT field. */
function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** A single-event .ics as a data: URL; null when there is no start time. */
function buildIcsDataUrl(event: WireEvent, when: Date | null, blurb: string): string | null {
  if (!when) return null;
  const end = new Date(when.getTime() + (event.durationMinutes || 60) * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Para Theater//Offering//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@paratheater`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(when)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(event.title)}`,
  ];
  if (blurb) lines.push(`DESCRIPTION:${icsText(blurb)}`);
  const place = event.talkUrl || event.meetingUrl || event.location;
  if (place) lines.push(`LOCATION:${icsText(place)}`);
  const rule: Record<string, string> = { DAILY: "DAILY", WEEKLY: "WEEKLY", MONTHLY: "MONTHLY" };
  const freq = event.recurrencePattern ? rule[event.recurrencePattern.toUpperCase()] : undefined;
  if (freq) lines.push(`RRULE:FREQ=${freq}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/**
 * A one- or two-sentence blurb. Composer text often opens by repeating the
 * title, which reads as a stutter on a card, so a leading or repeated title
 * is dropped.
 */
function summary(event: WireEvent): string {
  let text = toPlainText(event.descriptionHtml || event.excerpt, 1200).replace(/…$/, "");
  const title = event.title.trim().toLowerCase();
  if (title && text.toLowerCase().startsWith(title)) text = text.slice(title.length).trim();
  const again = title ? text.toLowerCase().indexOf(title) : -1;
  if (again > 0) text = text.slice(0, again).trim();
  if (text.length <= 240) return text;
  const cut = text.slice(0, 240);
  const stop = cut.lastIndexOf(". ");
  return stop > 80 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function variant(src: string, width: number): string {
  return src.startsWith("/api/media/") ? `${src}?w=${width}` : src;
}

/** "11:00 p.m. your time" for a visitor outside Toronto; set after mount only. */
function LocalTime({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState<string | null>(null);
  React.useEffect(() => {
    const source = "America/Toronto";
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || zone === source) return;
    const at = new Date(iso);
    const fmt = (tz: string) =>
      at.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: tz });
    if (fmt(zone) === fmt(source)) return;
    setLabel(`${fmt(zone)} your time`);
  }, [iso]);
  return label ? <span className="pt-offer-localtime">{label}</span> : null;
}

export function OfferingCardView({
  event,
  eyebrow = "Open to everyone",
  heading = "Current Offerings",
  showCall = true,
  showRsvp = true,
  showCalendar = true,
}: {
  event?: WireEvent | null;
  eyebrow?: string;
  heading?: string;
  showCall?: boolean;
  showRsvp?: boolean;
  showCalendar?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const frame = React.useRef<HTMLIFrameElement>(null);
  const headingId = React.useId();

  const showHeader = Boolean(heading && heading.trim());

  const header = showHeader ? (
    <header className="pt-offer-header">
      {eyebrow ? <p className="pt-offer-eyebrow">{eyebrow}</p> : null}
      <h2 id={headingId} className="pt-offer-heading">
        {heading}
      </h2>
    </header>
  ) : null;

  if (!event) {
    return (
      <section className="pt-offer-section" aria-labelledby={showHeader ? headingId : undefined}>
        {header}
        <p className="pt-offer-empty">Nothing is scheduled yet.</p>
      </section>
    );
  }

  const when = toDate(event.scheduledAt);
  const href = event.feedSlug ? `/${event.feedSlug}/${event.slug}` : null;
  const recurrence = formatRecurrence(event.recurrencePattern);
  const duration = formatDuration(event.durationMinutes);
  const talkUrl = showCall ? event.talkUrl : null;
  const online = event.isOnline || Boolean(event.talkUrl);
  const blurb = summary(event);
  const ics = showCalendar ? buildIcsDataUrl(event, when, blurb) : null;
  const calling = Boolean(talkUrl) && open;
  const kicker = [recurrence, online ? "Online" : event.location].filter(Boolean).join(" · ");

  const goFull = () => {
    const el = frame.current;
    if (el?.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
  };

  const title = href ? <Link href={href}>{event.title}</Link> : event.title;

  const rsvp =
    showRsvp && event.isRsvpEnabled ? (
      <div className="pt-offer-rsvp">
        <RsvpPanel
          threadId={event.id}
          title={event.title}
          signedIn={event.signedIn}
          alreadyAttending={event.alreadyAttending}
          attendanceCount={event.attendanceCount}
          attendeeLimit={event.attendeeLimit}
          cancelled={event.cancelled}
        />
      </div>
    ) : null;

  return (
    <section className="pt-offer-section" aria-labelledby={showHeader ? headingId : undefined}>
      {header}
      <article className={`pt-offer-card${calling ? " pt-offer-card--call" : ""}`} data-thread={event.id}>
        {event.coverImageUrl && !calling ? (
          <div className="pt-offer-media" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={variant(event.coverImageUrl, 1024)}
              srcSet={`${variant(event.coverImageUrl, 512)} 512w, ${variant(event.coverImageUrl, 1024)} 1024w`}
              sizes="(max-width: 900px) 92vw, 440px"
              alt=""
              loading="lazy"
            />
          </div>
        ) : null}

        <div className="pt-offer-body">
          {kicker ? <p className="pt-offer-kicker">{kicker}</p> : null}
          <h3 className="pt-offer-title">{title}</h3>
          {blurb ? <p className="pt-offer-blurb">{blurb}</p> : null}

          {when ? (
            <dl className="pt-offer-facts">
              <div>
                <dt>Time</dt>
                <dd>
                  {formatTime(when)} Toronto
                  <LocalTime iso={when.toISOString()} />
                </dd>
              </div>
              <div>
                <dt>Next</dt>
                <dd>{formatShortDate(when)}</dd>
              </div>
              {duration ? (
                <div>
                  <dt>Length</dt>
                  <dd>{duration}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="pt-offer-actions">
            {talkUrl ? (
              <button
                type="button"
                className="pt-offer-btn pt-offer-btn--primary"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? "Leave the room view" : "Join the room"}
              </button>
            ) : null}
            {ics ? (
              <a className="pt-offer-btn" href={ics} download={`${event.slug}.ics`}>
                Add to calendar
              </a>
            ) : null}
            {href ? (
              <Link className="pt-offer-link" href={href}>
                Details →
              </Link>
            ) : null}
          </div>
        </div>

        {calling && talkUrl ? (
          <div className="pt-offer-call">
            <div className="pt-offer-call-bar">
              <span>{event.title}</span>
              <span className="pt-offer-call-tools">
                <button type="button" onClick={goFull}>
                  Full screen
                </button>
                <a href={talkUrl} target="_blank" rel="noreferrer">
                  New tab
                </a>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close the call">
                  Close
                </button>
              </span>
            </div>
            <iframe
              ref={frame}
              src={talkUrl}
              title={`${event.title} — Talk room`}
              allow={ALLOW}
              allowFullScreen
            />
          </div>
        ) : (
          rsvp
        )}
      </article>
    </section>
  );
}
