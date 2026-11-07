import {
  claimAttendeeReminder,
  claimHostReminder,
  listAttendeeReminderRecipients,
  listAttendeeRemindersDue,
  listHostRemindersDue,
  recordAttendeeReminderSent,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * Remind the people coming: members who said yes and guests who ticked the
 * reminder box, once, for the next occurrence after they answered. The rule and
 * its exclusions are in services/attendee-reminders.ts.
 *
 * A guest gets the join link only on a PUBLIC thread, where the page already
 * shows it to anyone. The guest form does not check visibility, so a guest can
 * hold an RSVP on an ORGANIZATION meeting whose link is for its members.
 */
export async function runAttendeeReminderTick(appOrigin: string): Promise<void> {
  const due = await listAttendeeRemindersDue({ orgId: siteConfig.orgId });
  if (due.length === 0) return;

  const talkBase = process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "";

  for (const reminder of due) {
    if (!(await claimAttendeeReminder(reminder.threadId, reminder.occurrenceAt))) continue;

    try {
      const recipients = await listAttendeeReminderRecipients(reminder);
      if (recipients.length === 0) continue;

      const { sendReminderEmail } = await import("@elkdonis/email");
      const pageUrl = `${appOrigin}/${reminder.section ?? "offerings"}/${reminder.slug}`;
      const talkUrl = reminder.talkToken && talkBase ? `${talkBase}/call/${reminder.talkToken}` : undefined;

      let sent = 0;
      for (const person of recipients) {
        const mayHaveLink = person.isMember || reminder.visibility === "PUBLIC";
        try {
          const result = await sendReminderEmail(person.email, {
            purpose: "attendee",
            guestName: person.name,
            meetingTitle: reminder.title,
            scheduledAt: reminder.occurrenceAt,
            location: reminder.location ?? undefined,
            meetingUrl: mayHaveLink ? reminder.meetingUrl ?? undefined : undefined,
            talkJoinUrl: mayHaveLink ? talkUrl : undefined,
            threadKind: reminder.kind,
            rsvpUrl: pageUrl,
            orgId: siteConfig.orgId,
            orgName: siteConfig.orgName,
            threadId: reminder.threadId,
          });
          if (result.ok) sent++;
        } catch (error) {
          console.error(`[innergathering] attendee reminder failed for ${reminder.threadId}:`, error);
        }
      }

      await recordAttendeeReminderSent(reminder.threadId, reminder.occurrenceAt, sent);
      console.log(`[innergathering] attendee reminders: ${reminder.threadId}: sent ${sent}/${recipients.length}`);
    } catch (error) {
      console.error(`[innergathering] attendee reminders: tick failed for ${reminder.threadId}:`, error);
    }
  }
}

/**
 * Remind whoever is hosting, shortly before they have to.
 *
 * Scoped deliberately to HOSTS, not attendees. The rota's whole failure mode
 * is a person who agreed to run the 21st three weeks ago and has since
 * forgotten; everyone else already has it in their calendar because the
 * gathering is shared there.
 *
 * ── Why it is safe to run on a timer in a web process ──────────────────────
 *
 * The ledger is the interlock, not the timer. `claimHostReminder` inserts into
 * `thread_reminder_sends` with (thread, occurrence, kind='host') as the
 * primary key, so overlapping ticks — two instances, a restart mid-window —
 * produce exactly one winner and the losers do nothing. The `kind` column is
 * new in migration 136 precisely for this: before it, a host reminder and an
 * attendee reminder for the same occurrence collided on the key and the second
 * one silently never sent.
 *
 * The claim is taken BEFORE the send. A crash between the two loses a
 * reminder; the other order sends a duplicate on every tick until the insert
 * succeeds. For a letter that says "you are on in an hour", one lost is far
 * better than six delivered.
 */
export async function runHostReminderTick(appOrigin: string): Promise<void> {
  const due = await listHostRemindersDue({ orgId: siteConfig.orgId, withinMinutes: 65 });
  if (due.length === 0) return;

  for (const duty of due) {
    if (!(await claimHostReminder(duty.threadId, duty.occurrenceAt))) continue;

    try {
      const { sendReminderEmail } = await import("@elkdonis/email");
      const when = new Date(duty.occurrenceAt);
      const talkUrl = duty.talkToken
        ? `${process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? ""}/call/${duty.talkToken}`
        : undefined;

      await sendReminderEmail(duty.email, {
        guestName: duty.displayName,
        meetingTitle: duty.title,
        scheduledAt: when.toISOString(),
        orgName: siteConfig.orgName,
        rsvpUrl: `${appOrigin}/hub`,
        talkJoinUrl: talkUrl,
        // The template is shared with the attendee reminder, whose whole
        // message is "this is happening". A host needs a different sentence,
        // so the one thing that differs is said first and plainly.
        bodyText:
          `You are hosting ${duty.title} today.` +
          (duty.note ? ` Note on the rota: ${duty.note}` : "") +
          ` If you cannot make it, open the hub and change the rota so somebody else can pick it up.`,
        orgId: siteConfig.orgId,
        threadId: duty.threadId,
      });
    } catch (error) {
      // The claim stands: a transient SendGrid failure must not turn into a
      // reminder retried every five minutes for an hour.
      console.error(
        `[innergathering] host reminder failed for ${duty.threadId} @ ${duty.occurrenceAt}:`,
        error
      );
    }
  }
}
