import { claimHostReminder, listHostRemindersDue } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

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
