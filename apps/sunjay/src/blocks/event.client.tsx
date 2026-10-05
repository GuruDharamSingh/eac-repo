"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { RichText } from "@elkdonis/blocks";
import { RsvpPanel } from "@/components/rsvp-panel";
import { AttendeeList } from "@/components/attendee-list";
import { createEventRoomAction } from "@/lib/puck/event-actions";
import { formatDuration, formatRecurrence, formatShortDate, formatTime } from "@/lib/format";
import { toDate } from "./shared";
import type { WireEvent } from "./event-sample";

// ============================================================================
// The browser halves of the event blocks.
//
// Every block draws `event`, the one thread the page is about, which a
// resolver fills (lib/puck/data-event.ts). With no event they say so quietly
// instead of drawing a hole: on a published page that means "nothing
// scheduled", and the editor's resolver substitutes example data first.
// ============================================================================

const Empty = ({ label }: { label: string }) => (
  <p className="card-natural p-6 text-sm text-muted-foreground">{label}</p>
);

// ── header ──────────────────────────────────────────────────────────────────

export function EventHeaderView({
  event,
  showCover = true,
  showFacts = true,
  showCrumb = true,
}: {
  event?: WireEvent | null;
  showCover?: boolean;
  showFacts?: boolean;
  showCrumb?: boolean;
}) {
  if (!event) return <Empty label="No gathering is scheduled yet." />;
  const when = toDate(event.scheduledAt);
  const recurrence = formatRecurrence(event.recurrencePattern);
  const duration = formatDuration(event.durationMinutes);
  const where = event.isOnline || event.hasRoom ? "Online" : event.location;
  const kicker = [event.kind === "meeting" ? "Gathering" : event.kind, recurrence].filter(Boolean).join(" · ");

  const facts: Array<[string, string]> = [];
  if (when) {
    facts.push(["Next", `${formatShortDate(when)} · ${formatTime(when)} Toronto`]);
  }
  if (duration) facts.push(["Length", duration]);
  if (where) facts.push(["Where", where]);
  if (event.authorName) facts.push(["Host", event.authorName]);

  return (
    <header className="grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-end">
      <div>
        {showCrumb && event.feedSlug ? (
          <Link
            href={`/${event.feedSlug}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← {event.feedName ?? event.feedSlug}
          </Link>
        ) : null}
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[hsl(var(--primary))]">{kicker}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{event.title}</h1>
        {event.cancelled ? (
          <p className="mt-3 inline-block border border-destructive/60 px-3 py-1 text-sm text-destructive">
            This one is cancelled
          </p>
        ) : null}
        {event.excerpt ? <p className="mt-4 max-w-2xl text-lg leading-relaxed">{event.excerpt}</p> : null}
        {showFacts && facts.length > 0 ? (
          <dl className="mt-6 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
                <dd className="mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {showCover && event.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImageUrl} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : null}
    </header>
  );
}

// ── about ───────────────────────────────────────────────────────────────────

export function EventAboutView({ event, heading = "About this gathering" }: { event?: WireEvent | null; heading?: string }) {
  if (!event) return null;
  return (
    <section>
      {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
      {heading ? <hr className="saffron-divider max-w-[12rem]" /> : null}
      <RichText body={event.descriptionHtml} className="max-w-3xl leading-relaxed [&_p]:mb-4" />
    </section>
  );
}

// ── Talk room ───────────────────────────────────────────────────────────────

const ALLOW = "camera; microphone; display-capture; fullscreen; autoplay; clipboard-write";

/**
 * The gathering's Talk room, in the page.
 *
 * The same iframe the reading circles use (fourthwayBookreaders
 * circle-client.tsx) with innergathering's room controls (OfferingCall.tsx):
 * join, full screen, new tab. The new-tab link is always offered, because a
 * frame can be refused (Nextcloud must list this site in the `eac_embed`
 * frame-ancestors setting, docs/reference/nextcloud.md) and a browser may
 * block the room's cookies in a frame.
 */
export function TalkRoomView({
  event,
  heading = "The room",
  height = 520,
  startOpen = false,
  note = "",
}: {
  event?: WireEvent | null;
  heading?: string;
  height?: number;
  startOpen?: boolean;
  note?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(startOpen);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);

  if (!event) return <Empty label="The room appears here once a gathering is scheduled." />;

  const shell = (children: React.ReactNode) => (
    <section className="card-natural p-6">
      {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
      {children}
    </section>
  );

  if (!event.talkUrl) {
    if (event.canCreateRoom) {
      return shell(
        <>
          <p className="mt-2 text-sm text-muted-foreground">This gathering has no Talk room yet.</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await createEventRoomAction(event.id);
              setBusy(false);
              if ("error" in res) setError(res.error);
              else router.refresh();
            }}
            className="mt-4 border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/25 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create the Talk room"}
          </button>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </>
      );
    }
    if (event.hasRoom) {
      // A room exists but this viewer may not have it.
      return shell(
        <p className="mt-2 text-sm text-muted-foreground">
          The room opens once you join the group.{" "}
          {!event.signedIn ? (
            <Link href="/login" className="underline underline-offset-2">
              Sign in
            </Link>
          ) : null}
        </p>
      );
    }
    return shell(<p className="mt-2 text-sm text-muted-foreground">The room will be here before we meet.</p>);
  }

  return shell(
    <>
      {note ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{note}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/15 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/25"
        >
          {open ? "Leave the room view" : "Join the room"}
        </button>
        {open ? (
          <button
            type="button"
            onClick={() => void frame.current?.requestFullscreen?.().catch(() => undefined)}
            className="border border-input bg-background px-4 py-2 text-sm hover:border-[hsl(var(--primary))]"
          >
            Full screen
          </button>
        ) : null}
        <a
          href={event.talkUrl}
          target="_blank"
          rel="noreferrer"
          className="border border-input bg-background px-4 py-2 text-sm hover:border-[hsl(var(--primary))]"
        >
          Open in a new tab
        </a>
      </div>
      {open ? (
        <iframe
          ref={frame}
          src={event.talkUrl}
          title={`${event.title} — Talk room`}
          allow={ALLOW}
          allowFullScreen
          style={{ height }}
          className="mt-4 w-full border border-border bg-background"
        />
      ) : null}
    </>
  );
}

// ── RSVP and who is coming ──────────────────────────────────────────────────

export function EventRsvpView({ event, showAttendees = true }: { event?: WireEvent | null; showAttendees?: boolean }) {
  if (!event || !event.isRsvpEnabled) return null;
  return (
    <div>
      <RsvpPanel
        threadId={event.id}
        title={event.title}
        signedIn={event.signedIn}
        alreadyAttending={event.alreadyAttending}
        attendanceCount={event.attendanceCount}
        attendeeLimit={event.attendeeLimit}
        cancelled={event.cancelled}
      />
      {showAttendees ? (
        <AttendeeList
          attendees={event.attendees.map((a) => ({
            ...a,
            guideSlug: null,
            respondedAt: new Date(0),
          }))}
          total={event.attendanceCount}
          visible={event.isMember}
        />
      ) : null}
    </div>
  );
}

// ── materials ───────────────────────────────────────────────────────────────

export function EventMaterialsView({ event, heading = "Materials" }: { event?: WireEvent | null; heading?: string }) {
  if (!event || event.materials.length === 0) return null;
  return (
    <section>
      {heading ? <h2 className="font-serif text-2xl">{heading}</h2> : null}
      {heading ? <hr className="saffron-divider max-w-[12rem]" /> : null}
      <ul className="space-y-2">
        {event.materials.map((m) => (
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
                <span className="text-xs text-muted-foreground">({Math.max(1, Math.round(m.size / 1024))} KB)</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

