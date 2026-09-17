/**
 * Render every template to an HTML file you can open in a browser.
 *
 * A type-check proves the props line up; it proves nothing about whether the
 * letter reads well or whether a card collapses. This is how you look at it.
 *
 *   docker exec -w /app/packages/email <container> \
 *     ./node_modules/.bin/tsx scripts/preview.mts [outDir]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import {
  renderWelcomeEmail,
  renderProvisioningEmail,
  renderRsvpGuestEmail,
  renderOwnerNotificationEmail,
  renderReminderEmail,
  renderMeetingTriggerEmail,
  renderNewsletterEmail,
  renderContactOwnerEmail,
} from '../src/index';

const outDir = process.argv[2] ?? '/tmp/email-preview';

const THREAD = {
  title: 'The Fourth Way: Attention and the Moving Centre',
  kind: 'workshop',
  when: 'Saturday, 3 October 2026, 7:00 p.m. EDT',
  where: 'Toronto, and online',
  summary: 'Six weeks of practical work on divided attention, with materials shared through the group folder.',
  url: 'https://elkdonis-arts.org/workshops/attention-and-the-moving-centre',
};

const soon = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
const later = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();

const previews: Array<[string, Promise<string>]> = [
  ['01-welcome-plain', renderWelcomeEmail({
    displayName: 'Ada Whitfield',
    email: 'ada@example.com',
    username: 'adaw',
    orgName: 'International Fine Art Collectors',
    confirmUrl: 'https://example.org/auth/confirm?token=demo',
  })],

  ['02-welcome-by-purchase', renderWelcomeEmail({
    displayName: 'Ada Whitfield',
    email: 'ada@example.com',
    orgName: 'InnerGathering',
    confirmUrl: 'https://example.org/auth/confirm?token=demo',
    thread: THREAD,
    reminderSettingsUrl: 'https://example.org/account/reminders',
    calendarUrl: 'https://example.org/api/calendar/demo.ics',
    bodyText: 'We meet in the upper room. Bring a notebook, and come a few minutes early if you can.',
  })],

  // What an org sees once its own domain is authenticated: its name and its
  // colour lead, the network becomes the line underneath.
  ['02b-welcome-org-branded', renderWelcomeEmail({
    displayName: 'Ada Whitfield',
    email: 'ada@example.com',
    orgName: 'International Fine Art Collectors',
    orgHeader: true,
    orgAccent: '#8B6914',
    confirmUrl: 'https://example.org/auth/confirm?token=demo',
  })],

  ['03-provisioning', renderProvisioningEmail({
    displayName: 'Ada Whitfield',
    orgName: 'Amrit Canada',
    claimUrl: 'https://cloud.elkdonis-arts.org/claim?token=demo',
    nextcloudUsername: 'ada.whitfield',
    teamFolderName: 'EAC_Network/amrit_canada',
  })],

  ['04-rsvp-guest', renderRsvpGuestEmail({
    guestName: 'Ada Whitfield',
    meetingTitle: THREAD.title,
    threadKind: 'workshop',
    orgName: 'InnerGathering',
    scheduledAt: later,
    location: 'Toronto, and online',
    summary: THREAD.summary,
    threadUrl: THREAD.url,
    materialsUrl: 'https://cloud.elkdonis-arts.org/f/demo',
    talkRoomUrl: 'https://cloud.elkdonis-arts.org/call/demo',
    reminderSettingsUrl: 'https://example.org/account/reminders',
    calendarUrl: 'https://example.org/api/calendar/demo.ics',
  })],

  ['05-owner-rsvp', renderOwnerNotificationEmail({
    notificationKind: 'rsvp',
    guestName: 'Ada Whitfield',
    guestEmail: 'ada@example.com',
    guestUsername: 'adaw',
    guestMessage: 'Looking forward to it — I have read the first two chapters already.',
    wantsReminder: true,
    meetingTitle: THREAD.title,
    threadKind: 'workshop',
    orgName: 'InnerGathering',
    scheduledAt: later,
    rsvpCreatedAt: new Date().toISOString(),
    threadUrl: THREAD.url,
    rsvpCount: 7,
  })],

  ['06-owner-follow', renderOwnerNotificationEmail({
    notificationKind: 'follow',
    guestName: 'Ada Whitfield',
    guestEmail: 'ada@example.com',
    meetingTitle: 'Dana McCool — Paintings',
    threadKind: 'post',
    orgName: 'Dana McCool',
    threadUrl: 'https://danamccool.com/writing/paintings',
  })],

  ['07-reminder', renderReminderEmail({
    guestName: 'Ada Whitfield',
    meetingTitle: THREAD.title,
    threadKind: 'workshop',
    orgName: 'InnerGathering',
    scheduledAt: soon,
    location: 'Toronto, and online',
    summary: THREAD.summary,
    rsvpUrl: THREAD.url,
    talkJoinUrl: 'https://cloud.elkdonis-arts.org/call/demo',
    rsvpCount: 7,
    reminderSettingsUrl: 'https://example.org/account/reminders',
    calendarUrl: 'https://example.org/api/calendar/demo.ics',
  })],

  ['08-meeting-trigger', renderMeetingTriggerEmail({
    type: 'reminder',
    senderName: 'InnerGathering',
    guestName: 'Ada Whitfield',
    meetingTitle: THREAD.title,
    scheduledAt: later,
  })],

  ['09-newsletter', renderNewsletterEmail({
    title: 'What we are working on this month',
    orgName: 'Amrit Canada',
    bodyText: 'A short letter about the season ahead.',
  })],

  ['10-contact-owner', renderContactOwnerEmail({
    senderName: 'Ada Whitfield',
    senderEmail: 'ada@example.com',
    message: 'I would like to know more about joining the study group.',
    orgName: 'IFAC',
  })],
];

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const index: string[] = [];

  for (const [name, promise] of previews) {
    try {
      const html = await promise;
      await writeFile(`${outDir}/${name}.html`, html, 'utf8');
      const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
      // Over ~102KB Gmail clips the message and hides the rest behind
      // "View entire message" — worth knowing before someone sends it.
      const clipped = kb > 100 ? '  ⚠ over 100KB — Gmail will clip this' : '';
      console.log(`✓ ${name.padEnd(24)} ${String(kb).padStart(3)}KB${clipped}`);
      index.push(`<li><a href="./${name}.html">${name}</a> — ${kb}KB</li>`);
    } catch (err) {
      console.log(`✗ ${name.padEnd(24)} ${(err as Error).message}`);
    }
  }

  await writeFile(
    `${outDir}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Email previews</title>` +
      `<body style="font:16px/1.6 system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem">` +
      `<h1>Email previews</h1><ul>${index.join('')}</ul></body>`,
    'utf8'
  );
  console.log(`\nwritten to ${outDir}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
