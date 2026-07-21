import { db } from "@elkdonis/db";
import {
  EMAIL_TEMPLATE_ORG_ID,
  getEmailTemplateSettingsForThread,
} from "@/lib/email-template-settings";

export const REMINDER_TEMPLATE_KEY = "reminder";

// ============================================================================
// Reminder tick — invoked periodically from instrumentation.ts.
//
// Finds published meetings/events/workshops whose scheduled_at falls within
// the next `reminder_minutes_before` window and which haven't had a reminder
// for that occurrence yet, claims the ledger row (INSERT … ON CONFLICT DO
// NOTHING → single winner across overlapping ticks), and emails everyone
// with an RSVP 'yes'. v1 handles the primary scheduled_at only — recurring
// occurrences beyond the first are a follow-up.
// ============================================================================

export async function runReminderTick(appOrigin: string): Promise<void> {
  const due = await db`
    SELECT t.id, t.title, t.org_id, t.scheduled_at, t.location,
           t.meeting_url, t.video_link, t.nextcloud_talk_token,
           t.reminder_minutes_before,
           o.name AS org_name
    FROM threads t
    JOIN organizations o ON o.id = t.org_id
    WHERE t.kind IN ('meeting', 'event', 'workshop')
      AND t.status = 'published'
      AND t.is_rsvp_enabled = true
      AND t.scheduled_at IS NOT NULL
      AND t.scheduled_at > NOW()
      AND t.scheduled_at <= NOW() + (COALESCE(t.reminder_minutes_before, 60) * INTERVAL '1 minute')
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
      `;
      if (attendees.length === 0) continue;

      const settings = await getEmailTemplateSettingsForThread(
        (thread.org_id as string) || EMAIL_TEMPLATE_ORG_ID,
        REMINDER_TEMPLATE_KEY,
        thread.id
      ).catch(() => null);

      const talkJoinUrl = thread.nextcloud_talk_token
        ? `${appOrigin}/api/talk/join?token=${thread.nextcloud_talk_token}`
        : undefined;

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
            orgName: thread.org_name as string,
            ...(settings?.config ?? {}),
          });
          sent++;
        } catch (sendErr) {
          console.error(`[reminders] send to ${attendee.email} failed:`, sendErr);
        }
      }

      await db`
        UPDATE thread_reminder_sends SET recipients = ${sent}
        WHERE thread_id = ${thread.id} AND occurrence_at = ${thread.scheduled_at}
      `;
      console.log(`[reminders] ${thread.id} "${thread.title}": sent ${sent}/${attendees.length}`);
    } catch (err) {
      console.error(`[reminders] tick failed for ${thread.id}:`, err);
    }
  }
}
