import { notFound, redirect } from "next/navigation";
import { db } from "@elkdonis/db";
import { nextOccurrence } from "@elkdonis/utils";
import { ThemeStyle } from "@elkdonis/live-editor/theme";
import { siteConfig } from "@/config/site";
import { getSiteContent } from "@/lib/data";
import { getHubViewer } from "@/lib/hub-auth";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { RsvpPanel } from "@/components/hub/RsvpPanel";

/**
 * A meeting or event, in full.
 *
 * IFAC had no detail page of any kind — every card in the app pointed either
 * at the public homepage or at nothing. The two existing detail pages in the
 * network are both unusable here: inner-gathering's is Mantine, and
 * amrit-canada's is Tailwind/shadcn against a different data shape. This is
 * modelled on amrit-canada's structure (back link, cover, facts list, join,
 * RSVP, attendees) in IFAC's own dependency-free CSS.
 *
 * Members-only, because a thread's attendee list is not public even when the
 * thread itself is.
 */
export const dynamic = "force-dynamic";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const viewer = await getHubViewer();
  const { slug } = await params;
  if (!viewer) redirect(`/login?redirect=/hub/meetings/${slug}`);

  const [thread] = await db<
    Array<{
      id: string;
      title: string;
      body: string | null;
      location: string | null;
      format: string | null;
      scheduled_at: string | null;
      duration_minutes: number | null;
      meeting_url: string | null;
      nextcloud_talk_token: string | null;
      recurrence_pattern: string | null;
      attendee_limit: number | null;
      is_rsvp_enabled: boolean;
      cover_image_url: string | null;
      author_name: string | null;
      author_slug: string | null;
    }>
  >`
    SELECT t.id, t.title, t.body, t.location, t.format, t.scheduled_at,
           t.duration_minutes, t.meeting_url, t.nextcloud_talk_token,
           t.recurrence_pattern, t.attendee_limit, t.is_rsvp_enabled,
           t.metadata->>'coverImageUrl' AS cover_image_url,
           u.display_name AS author_name, u.slug AS author_slug
    FROM threads t
    LEFT JOIN users u ON u.id = t.author_id
    WHERE t.org_id = ${siteConfig.orgId}
      AND t.slug = ${slug}
      AND t.status = 'published'
  `;
  if (!thread) notFound();

  const attendees = await db<
    Array<{ display_name: string | null; slug: string | null; avatar_url: string | null }>
  >`
    SELECT u.display_name, u.slug, u.avatar_url
    FROM thread_rsvps r
    JOIN users u ON u.id = r.user_id
    WHERE r.thread_id = ${thread.id} AND r.status = 'yes'
    ORDER BY u.display_name NULLS LAST
    LIMIT 60
  `;

  const [mine] = await db<Array<{ status: string }>>`
    SELECT status FROM thread_rsvps
    WHERE thread_id = ${thread.id} AND user_id = ${viewer.userId}
  `;

  const content = await getSiteContent();
  const when = thread.scheduled_at
    ? nextOccurrence(
        new Date(thread.scheduled_at),
        thread.recurrence_pattern,
        thread.duration_minutes
      ).toISOString()
    : null;

  const talkBase =
    process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? process.env.NEXTCLOUD_PUBLIC_URL ?? null;
  const joinUrl =
    thread.meeting_url ??
    (thread.nextcloud_talk_token && talkBase
      ? `${talkBase.replace(/\/$/, "")}/call/${thread.nextcloud_talk_token}`
      : null);

  return (
    <div className="site-shell">
      <ThemeStyle orgId={siteConfig.orgId} pageKey="hub" userId={viewer.userId} />
      <SiteHeader />

      <main className="hub">
        <div className="hub-welcome">
          <div>
            <p className="kicker">{siteConfig.shortName}</p>
            <h1>{thread.title}</h1>
          </div>
          <a className="hub-btn" href="/hub">
            &larr; Back to the hub
          </a>
        </div>

        <section className="hub-wide hub-compose">
          {thread.cover_image_url && (
            <img className="hub-panel-cover" src={thread.cover_image_url} alt="" />
          )}

          <dl className="hub-facts">
            <dt>When</dt>
            <dd>
              {when
                ? new Date(when).toLocaleString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "To be announced"}
            </dd>
            {thread.duration_minutes && (
              <>
                <dt>Runs</dt>
                <dd>{thread.duration_minutes} minutes</dd>
              </>
            )}
            {thread.recurrence_pattern && (
              <>
                <dt>Repeats</dt>
                <dd>{thread.recurrence_pattern.toLowerCase()}</dd>
              </>
            )}
            {thread.location && (
              <>
                <dt>Where</dt>
                <dd>{thread.location}</dd>
              </>
            )}
            {thread.author_name && (
              <>
                <dt>Posted by</dt>
                <dd>
                  {thread.author_slug ? (
                    <a href={`/artists/${thread.author_slug}`}>{thread.author_name}</a>
                  ) : (
                    thread.author_name
                  )}
                </dd>
              </>
            )}
          </dl>

          {thread.body && (
            <div className="hub-panel">
              {thread.body.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          )}

          <div className="hub-panel-actions">
            {joinUrl && (
              <a
                className="hub-btn hub-btn--primary"
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
              >
                Join the meeting
              </a>
            )}
          </div>

          {thread.is_rsvp_enabled && (
            <RsvpPanel
              threadId={thread.id}
              initialStatus={mine?.status ?? null}
              confirmed={attendees.length}
              attendeeLimit={thread.attendee_limit}
            />
          )}

          {attendees.length > 0 && (
            <>
              <h4 className="hub-panel-subhead">Coming</h4>
              <ul className="hub-list">
                {attendees.map((person) => (
                  <li key={person.slug ?? person.display_name} className="hub-list-row">
                    <p className="hub-list-title">
                      {person.slug ? (
                        <a href={`/artists/${person.slug}`}>
                          {person.display_name ?? person.slug}
                        </a>
                      ) : (
                        (person.display_name ?? "A member")
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>

      <SiteFooter content={content.footer} />
    </div>
  );
}
