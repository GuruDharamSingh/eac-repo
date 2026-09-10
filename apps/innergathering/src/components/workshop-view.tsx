import Link from "next/link";
import type { WorkshopOffering, WorkshopSession } from "@elkdonis/services";
import { formatDate, formatDuration, formatTime } from "@/lib/format";

/**
 * A workshop, presented as inner-gathering presented it — and the lesson for
 * what the workshop CMS needs, made explicit in the markup:
 *
 *   BANNER   full-bleed across the top; the one image that needs cropping,
 *            so it carries a focal point (banner_focal_y, 0–100) that decides
 *            which band of it survives at any width.
 *   HERO     the main media below the meta strip — an image or a video shown
 *            whole, never cropped — with optional text laid over its foot.
 *   COVER    the listing image (a face's preview); when there is no banner
 *            it stands in for it.
 *   SESSION  each session can carry its own image (shown whole) and its own
 *            background colour, so a series reads as chapters — and its own
 *            files and links, each marked open or participants-only.
 *   COLOUR   the page's own background colour, set by the author.
 *
 * The page is also the workspace. Nothing moves to another URL when someone
 * joins: the same page shows more — the materials folder, the participants'
 * resources on each session, the room — because `enrolled` is true. That is
 * the surface principle applied to a workshop: the face and the depth are
 * one thing at two sizes.
 *
 * Server-renderable; RSVP and edit controls are the host's, passed as
 * `actions` / `aside` / `materials` from the page.
 */
export function WorkshopView({
  workshop,
  guide,
  attendeeCount,
  enrolled,
  actions,
  materials,
  aside,
}: {
  workshop: WorkshopOffering;
  guide: { name: string | null; photo: string | null; slug: string | null } | null;
  attendeeCount: number;
  /** The viewer is in the workshop (or runs it): participants-only things show. */
  enrolled?: boolean;
  /** The buttons in the meta strip — Join, Edit, Talk room. */
  actions?: React.ReactNode;
  /** The materials folder, rendered by the host between sessions and gallery. */
  materials?: React.ReactNode;
  /** Rendered after the sessions — the RSVP panel and attendee list. */
  aside?: React.ReactNode;
}) {
  const bannerUrl = workshop.bannerImageUrl || workshop.coverImageUrl;
  const sessions = [...workshop.sessions].sort((a, b) => a.sessionNumber - b.sessionNumber);
  const deadlinePassed = workshop.rsvpDeadline ? new Date(workshop.rsvpDeadline) < new Date() : false;
  const atCapacity = workshop.attendeeLimit !== null && attendeeCount >= workshop.attendeeLimit;

  return (
    <article className="ws" style={{ background: workshop.backgroundColor || undefined }}>
      {bannerUrl && (
        <div className="ws-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bannerUrl} alt="" style={{ objectPosition: `center ${workshop.bannerFocalY ?? 50}%` }} />
          <div className="ws-banner-text">
            {workshop.discipline && <p className="ws-eyebrow">{workshop.discipline}</p>}
            <h1>{workshop.title}</h1>
            {workshop.subtitle && <p className="ws-subtitle">{workshop.subtitle}</p>}
          </div>
        </div>
      )}

      <div className="ws-body">
        <Link href={`/${workshop.section ?? "offerings"}`} className="ig-kicker" style={{ textDecoration: "none" }}>← Offerings</Link>

        {!bannerUrl && (
          <header style={{ marginTop: "1rem" }}>
            {workshop.discipline && <p className="ws-eyebrow">{workshop.discipline}</p>}
            <h1 className="ws-title">{workshop.title}</h1>
            {workshop.subtitle && <p className="ws-subtitle">{workshop.subtitle}</p>}
          </header>
        )}

        {/* ── Meta strip ── */}
        <div className="ws-meta">
          <div className="ws-meta-facts">
            {guide && (
              <span className="ws-guide">
                {guide.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guide.photo} alt="" />
                ) : (
                  <span className="ws-guide-initial">{(guide.name ?? "G").charAt(0)}</span>
                )}
                {guide.slug ? <Link href={`/about/${guide.slug}`}>{guide.name}</Link> : <span>{guide.name}</span>}
              </span>
            )}
            {workshop.price !== null && (
              <span className="ws-chip ws-chip--price">{workshop.price === 0 ? "Free" : `$${workshop.price}${workshop.priceMember !== null && workshop.priceMember !== workshop.price ? ` · members $${workshop.priceMember}` : ""}`}</span>
            )}
            {sessions.length > 0 && <span className="ws-chip">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span>}
            {workshop.level && <span className="ws-chip">{LEVELS[workshop.level] ?? workshop.level}</span>}
            <span className="ws-chip">{attendeeCount}{workshop.attendeeLimit ? ` / ${workshop.attendeeLimit}` : ""} enrolled</span>
            {deadlinePassed && <span className="ws-chip ws-chip--warn">RSVP closed</span>}
            {atCapacity && !deadlinePassed && <span className="ws-chip ws-chip--warn">Workshop full</span>}
          </div>
          {actions && <div className="ws-meta-actions">{actions}</div>}
        </div>

        {/* ── Hero media ── */}
        {workshop.heroMediaUrl && (
          <div className="ws-hero">
            {workshop.heroMediaType === "video" ? (
              <video src={workshop.heroMediaUrl} controls />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={workshop.heroMediaUrl} alt={workshop.title} />
            )}
            {workshop.heroText && (
              <div className="ws-hero-text">
                <h2>{workshop.heroText}</h2>
              </div>
            )}
          </div>
        )}

        {/* ── Description ── */}
        {workshop.descriptionShort && <p className="ig-lead">{workshop.descriptionShort}</p>}
        {workshop.body && <div className="prose-amrit" dangerouslySetInnerHTML={{ __html: workshop.body }} />}

        {(workshop.location || workshop.locationAddress || workshop.recurrenceLabel || workshop.accessibilityNotes) && (
          <dl className="eac-facts ws-facts">
            {workshop.scheduledAt && (<><dt>Starts</dt><dd>{formatDate(workshop.scheduledAt)} · {formatTime(workshop.scheduledAt)}</dd></>)}
            {workshop.recurrenceLabel && (<><dt>Rhythm</dt><dd>{workshop.recurrenceLabel}</dd></>)}
            {(workshop.location || workshop.locationAddress) && (<><dt>Where</dt><dd>{[workshop.location, workshop.locationAddress].filter(Boolean).join(" · ")}</dd></>)}
            {workshop.accessibilityNotes && (<><dt>Access</dt><dd>{workshop.accessibilityNotes}</dd></>)}
          </dl>
        )}

        {/* ── Sessions ── */}
        {sessions.length > 0 && (
          <section className="ws-sessions" aria-label="Sessions">
            <h2 className="ig-h2">Sessions</h2>
            <ol className="ws-session-list">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} enrolled={Boolean(enrolled)} />
              ))}
            </ol>
          </section>
        )}

        {materials}

        {workshop.galleryImageUrls.length > 0 && (
          <section className="ws-gallery" aria-label="Gallery">
            {workshop.galleryImageUrls.map((g, i) => (
              <figure key={`${g.url}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.alt ?? ""} loading="lazy" />
                {g.caption && <figcaption>{g.caption}</figcaption>}
              </figure>
            ))}
          </section>
        )}

        {aside}
      </div>
    </article>
  );
}

const RESOURCE_KINDS: Record<string, string> = {
  link: "link",
  pdf: "PDF",
  video: "video",
  audio: "audio",
  doc: "document",
  other: "file",
};

const LEVELS: Record<string, string> = {
  all_levels: "All levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function SessionCard({ session, enrolled }: { session: WorkshopSession; enrolled: boolean }) {
  const when = session.scheduledAt;
  const visible = session.resources.filter((r) => r.isPublic || enrolled);
  const held = session.resources.length - visible.length;
  return (
    <li className="ws-session" style={{ background: session.backgroundColor || undefined }}>
      <span className="ws-session-num">{String(session.sessionNumber).padStart(2, "0")}</span>
      <div className="ws-session-body">
        <h3>{session.title || `Session ${session.sessionNumber}`}</h3>
        <p className="ws-session-meta">
          {[
            when && `${formatDate(when)} · ${formatTime(when)}`,
            formatDuration(session.durationMinutes),
            session.isOnline ? "Online" : session.location || null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {session.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ws-session-media" src={session.mediaUrl} alt="" loading="lazy" />
        )}
        {session.description && <p className="ws-session-desc">{session.description}</p>}
        {session.videoUrl && (
          <p><a href={session.videoUrl} target="_blank" rel="noreferrer" className="eac-btn">Watch the recording</a></p>
        )}
        {session.videoConferenceUrl && !session.videoUrl && (
          <p><a href={session.videoConferenceUrl} target="_blank" rel="noreferrer" className="eac-btn">Join online</a></p>
        )}
        {visible.length > 0 && (
          <ul className="ws-resources">
            {visible.map((r) => (
              <li key={r.id}>
                <a href={r.url} target="_blank" rel="noreferrer">{r.title || r.url}</a>
                <span> · {RESOURCE_KINDS[r.type] ?? r.type}{!r.isPublic ? " · participants" : ""}</span>
                {r.description && <p className="ws-resource-desc">{r.description}</p>}
              </li>
            ))}
          </ul>
        )}
        {held > 0 && (
          <p className="ws-resources-held">
            {held === 1 ? "One more file" : `${held} more files`} for participants.
          </p>
        )}
      </div>
    </li>
  );
}
