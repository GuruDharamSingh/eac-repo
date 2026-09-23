import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getThreadMaterials } from "@/lib/data";
import {
  MEETING_EMAIL_TEMPLATE_KEY,
  getEmailTemplateSettingsForThread,
} from "@/lib/email-template-settings";

// No emblem unless this site is given one. Amrit's copy of this file
// hardcoded a gold khanda — a Sikh religious emblem, and nothing this
// site has any business putting on its mail. `emblemUrl` is optional in
// EmailShell and guarded at the render site, so undefined simply omits it.
const EMBLEM_URL = process.env.SUNJAY_EMAIL_EMBLEM_URL || undefined;

// ============================================================================
// Reminder tick — invoked periodically from instrumentation.ts.
//
// Ported from apps/inner-gathering/src/lib/reminders.ts with two changes:
// scoped to this org only (org_id filter), and NULL genuinely means "off"
// (no COALESCE default) so the Make tab's toggle means something. Finds
// published meetings/events/workshops whose scheduled_at falls within the
// next reminder_minutes_before window and which haven't had a reminder for
// that occurrence yet, claims the ledger row (INSERT ... ON CONFLICT DO
// NOTHING -> single winner across overlapping ticks), and emails everyone
// with an RSVP 'yes'. v1 handles the primary scheduled_at only — recurring
// occurrences beyond the first are a follow-up.
// ============================================================================

export async function runReminderTick(appOrigin: string): Promise<void> {
  const due = await db`
    SELECT t.id, t.title, t.slug, t.section, t.scheduled_at, t.location,
           t.meeting_url, t.video_link, t.nextcloud_talk_token,
           t.reminder_minutes_before
    FROM threads t
    WHERE t.org_id = ${siteConfig.orgId}
      AND t.kind IN ('meeting', 'event', 'workshop')
      AND t.status = 'published'
      AND t.is_rsvp_enabled = true
      AND t.scheduled_at IS NOT NULL
      AND t.scheduled_at > NOW()
      AND t.reminder_minutes_before IS NOT NULL
      AND t.scheduled_at <= NOW() + (t.reminder_minutes_before * INTERVAL '1 minute')
      AND NOT EXISTS (
        SELECT 1 FROM thread_reminder_sends s
        WHERE s.thread_id = t.id AND s.occurrence_at = t.scheduled_at
      )
    LIMIT 20
  `;

  for (const thread of due) {
    // Claim the send — only one tick wins.
    const claimed = await db`
      INSERT INTO thread_reminder_sends (thread_id, occurrence_at, recipients)
      VALUES (${thread.id}, ${thread.scheduled_at}, 0)
      ON CONFLICT DO NOTHING
      RETURNING thread_id
    `;
    if (claimed.length === 0) continue;

    try {
      const attendees = await db`
        SELECT u.email, COALESCE(u.display_name, u.email) AS name
        FROM thread_rsvps r
        JOIN users u ON u.id = r.user_id
        WHERE r.thread_id = ${thread.id} AND r.status = 'yes'
          AND u.email IS NOT NULL

        UNION

        SELECT g.email, g.name AS name
        FROM guest_submissions g
        WHERE g.thread_id = ${thread.id} AND g.kind = 'rsvp'
          AND g.email IS NOT NULL
      `;
      if (attendees.length === 0) continue;

      const settings = await getEmailTemplateSettingsForThread(
        siteConfig.orgId,
        MEETING_EMAIL_TEMPLATE_KEY,
        thread.id as string
      ).catch(() => null);
      const config = settings?.config ?? {};

      const materials = await getThreadMaterials(thread.id as string).catch(() => []);
      const selectedMaterials = config.materialIds?.length
        ? materials.filter((m) => config.materialIds!.includes(m.id))
        : materials;
      const links = [
        ...selectedMaterials.map((m) => ({ label: m.filename, url: m.url })),
        ...(config.links ?? []),
      ];

      const talkJoinUrl = thread.nextcloud_talk_token
        ? `${appOrigin}/api/talk/join?token=${thread.nextcloud_talk_token}`
        : undefined;
      const rsvpUrl = thread.section
        ? `${appOrigin}/${thread.section}/${thread.slug}`
        : appOrigin;

      const { sendReminderEmail } = await import("@elkdonis/email");
      let sent = 0;
      for (const attendee of attendees) {
        try {
          await sendReminderEmail(attendee.email as string, {
            guestName: attendee.name as string,
            meetingTitle: thread.title as string,
            scheduledAt: String(thread.scheduled_at),
            location: thread.location ? String(thread.location) : undefined,
            meetingUrl: (thread.video_link ?? thread.meeting_url)
              ? String(thread.video_link ?? thread.meeting_url)
              : undefined,
            talkJoinUrl,
            orgId: siteConfig.orgId,
            orgName: siteConfig.orgName,
            rsvpUrl,
            rsvpCount: attendees.length,
            emblemUrl: EMBLEM_URL,
            emblemAlt: "Khanda",
            bodyText: config.bodyText,
            links,
            media: config.media,
          });
          sent++;
        } catch (sendErr) {
          console.error(`[sunjay] reminders: send to ${attendee.email} failed:`, sendErr);
        }
      }

      await db`
        UPDATE thread_reminder_sends SET recipients = ${sent}
        WHERE thread_id = ${thread.id} AND occurrence_at = ${thread.scheduled_at}
      `;
      console.log(`[sunjay] reminders: ${thread.id} "${thread.title}": sent ${sent}/${attendees.length}`);
    } catch (err) {
      console.error(`[sunjay] reminders: tick failed for ${thread.id}:`, err);
    }
  }
}
