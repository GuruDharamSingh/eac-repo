import { renderWelcomeEmail } from './templates/welcome';
import { renderProvisioningEmail } from './templates/provisioning';
import { renderRsvpGuestEmail } from './templates/rsvp-guest';
import { renderRsvpOwnerEmail } from './templates/rsvp-owner';
import { renderReminderEmail } from './templates/reminder';
import { renderMeetingTriggerEmail } from './templates/meeting-trigger';
import { renderContactOwnerEmail } from './templates/contact-owner';
import { renderNewsletterEmail } from './templates/newsletter';
import type { TemplateKey } from './template-store';

// ============================================================================
// One sample of each letter, so every surface that shows the suite shows the
// same thing.
//
// Admin's preview page and each org's hub both need "what does this email look
// like", and two hand-written sets of sample props drift within a week — one
// gets a new field, the other keeps rendering last month's design and nobody
// notices because both look plausible.
// ============================================================================

export interface TemplateMeta {
  key: TemplateKey;
  title: string;
  /** What causes it to be sent. */
  trigger: string;
  /** Who receives it. */
  recipient: string;
  /** Whether an org can sensibly write its own words for this one. */
  editable: boolean;
  /** One line on what an org's copy would add, shown above the form. */
  editHint: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    key: 'welcome',
    title: 'Signup',
    trigger: 'Someone creates an account with this organisation',
    recipient: 'The new member',
    editable: true,
    editHint:
      'Your words appear as their own section, under the confirmation and above the collective’s letter, which is always sent with it.',
  },
  {
    key: 'provisioning',
    title: 'Cloud account ready',
    trigger: 'Nextcloud provisioning completes for a member',
    recipient: 'The member',
    editable: true,
    editHint: 'Anything this organisation wants said about its team folder.',
  },
  {
    key: 'rsvp-guest',
    title: 'Registration confirmed',
    trigger: 'Someone reserves a place',
    recipient: 'The attendee',
    editable: true,
    editHint:
      'What to bring, where to park, when to arrive. Shown under the thread card as “From {org}”.',
  },
  {
    key: 'rsvp-owner',
    title: 'Someone arrived',
    trigger: 'Any signup, follow, RSVP, purchase or message',
    recipient: 'Whoever runs this organisation',
    editable: false,
    editHint: 'This one goes to you, so it is not worth writing copy for.',
  },
  {
    key: 'reminder',
    title: 'Reminder',
    trigger: 'Automatically, before a gathering begins',
    recipient: 'Everyone who said they were coming',
    editable: true,
    editHint: 'A line for the day itself. Kept short — this is read on a phone.',
  },
  {
    key: 'meeting-trigger',
    title: 'Manual blast',
    trigger: 'You send a reminder or a cancellation by hand',
    recipient: 'Everyone who RSVP’d',
    editable: true,
    editHint: 'What you want said when you reach for this.',
  },
  {
    key: 'contact-owner',
    title: 'Contact form',
    trigger: 'Someone writes in through the site',
    recipient: 'Whoever runs this organisation',
    editable: false,
    editHint: 'This one goes to you, so it is not worth writing copy for.',
  },
  {
    key: 'newsletter',
    title: 'Newsletter',
    trigger: 'You send one from the newsletter editor',
    recipient: 'Your contacts, minus anyone unsubscribed',
    editable: false,
    editHint: 'A newsletter is written each time rather than templated.',
  },
];

export function templateMeta(key: string): TemplateMeta | undefined {
  return TEMPLATE_META.find((t) => t.key === key);
}

export interface SampleOptions {
  orgName?: string;
  /** True once the org sends from its own domain — the header changes. */
  orgHeader?: boolean;
  orgAccent?: string;
  /** The org's stored words, so a preview shows what will actually send. */
  bodyText?: string;
}

const THREAD_TITLE = 'The Fourth Way: Attention and the Moving Centre';

/**
 * The props behind every sample, as ONE object per letter.
 *
 * Pulled out of the render switch so that more than one surface can read them.
 * The previews need them to draw a sample; the newsletter seeder needs them to
 * work out which rendered string corresponds to which `{field}` (see
 * `renderTemplateBody`). Two hand-written sets would drift within a week —
 * which is the same argument this file's header already makes about the
 * previews themselves.
 *
 * A function rather than a constant because the dates are relative to now, so
 * "begins in 3 hours" reads correctly in a preview taken at any time instead
 * of being frozen to whenever this file was written.
 */
export function sampleProps(
  key: string,
  opts: SampleOptions = {}
): Record<string, unknown> {
  const { orgName = 'Your Organization', orgHeader, orgAccent, bodyText } = opts;
  const brand = { orgName, orgHeader, orgAccent };

  const soon = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
  const later = new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString();

  const thread = {
    title: THREAD_TITLE,
    kind: 'workshop',
    when: 'Saturday, 7:00 p.m.',
    where: 'Toronto, and online',
    summary: 'Six weeks of practical work on divided attention.',
    url: 'https://example.org/workshops/attention',
  };

  switch (key) {
    case 'welcome':
      return {
        ...brand,
        displayName: 'Ada Whitfield',
        email: 'ada@example.com',
        username: 'adaw',
        confirmUrl: 'https://example.org/auth/confirm?token=sample',
        bodyText,
      };

    case 'provisioning':
      return {
        ...brand,
        displayName: 'Ada Whitfield',
        claimUrl: 'https://cloud.elkdonis-arts.org/claim?token=sample',
        nextcloudUsername: 'ada.whitfield',
        teamFolderName: `EAC_Network/${orgName}`,
        bodyText,
      };

    case 'rsvp-guest':
      return {
        ...brand,
        guestName: 'Ada Whitfield',
        meetingTitle: thread.title,
        threadKind: thread.kind,
        scheduledAt: later,
        location: thread.where,
        summary: thread.summary,
        threadUrl: thread.url,
        talkRoomUrl: 'https://cloud.elkdonis-arts.org/call/sample',
        materialsUrl: 'https://cloud.elkdonis-arts.org/f/sample',
        reminderSettingsUrl: 'https://example.org/account/reminders',
        calendarUrl: 'https://example.org/api/calendar/sample.ics',
        bodyText,
      };

    case 'rsvp-owner':
      return {
        ...brand,
        notificationKind: 'rsvp',
        guestName: 'Ada Whitfield',
        guestEmail: 'ada@example.com',
        guestUsername: 'adaw',
        guestMessage: 'Looking forward to it — I have read the first two chapters.',
        wantsReminder: true,
        meetingTitle: thread.title,
        threadKind: thread.kind,
        scheduledAt: later,
        rsvpCreatedAt: new Date().toISOString(),
        threadUrl: thread.url,
        rsvpCount: 7,
        bodyText,
      };

    case 'reminder':
      return {
        ...brand,
        guestName: 'Ada Whitfield',
        meetingTitle: thread.title,
        threadKind: thread.kind,
        scheduledAt: soon,
        location: thread.where,
        summary: thread.summary,
        rsvpUrl: thread.url,
        talkJoinUrl: 'https://cloud.elkdonis-arts.org/call/sample',
        rsvpCount: 7,
        reminderSettingsUrl: 'https://example.org/account/reminders',
        calendarUrl: 'https://example.org/api/calendar/sample.ics',
        bodyText,
      };

    case 'meeting-trigger':
      return {
        ...brand,
        type: 'reminder',
        senderName: 'Guru Dharam',
        guestName: 'Ada Whitfield',
        meetingTitle: thread.title,
        scheduledAt: later,
        location: thread.where,
        rsvpUrl: thread.url,
        meetingUrl: 'https://cloud.elkdonis-arts.org/call/sample',
        materialsUrl: 'https://cloud.elkdonis-arts.org/f/sample',
        rsvpCount: 7,
        bodyText,
      };

    case 'contact-owner':
      return {
        orgName,
        senderName: 'Ada Whitfield',
        senderEmail: 'ada@example.com',
        message: 'I would like to know more about joining.',
      };

    case 'newsletter':
      return {
        orgName,
        title: 'What we are working on this month',
        bodyText: bodyText ?? 'A short letter about the season ahead.',
      };

    default:
      return {};
  }
}

/**
 * The renderer behind each letter.
 *
 * One cast, here, rather than one per case: each render function has its own
 * props interface and the props come out of `sampleProps` as a bag, so the
 * types cannot meet without restating all eleven interfaces. Keeping the cast
 * in a single table is the containable version of that.
 */
const RENDERERS: Record<string, (p: never) => Promise<string>> = {
  welcome: renderWelcomeEmail as (p: never) => Promise<string>,
  provisioning: renderProvisioningEmail as (p: never) => Promise<string>,
  'rsvp-guest': renderRsvpGuestEmail as (p: never) => Promise<string>,
  'rsvp-owner': renderRsvpOwnerEmail as (p: never) => Promise<string>,
  reminder: renderReminderEmail as (p: never) => Promise<string>,
  'meeting-trigger': renderMeetingTriggerEmail as (p: never) => Promise<string>,
  'contact-owner': renderContactOwnerEmail as (p: never) => Promise<string>,
  newsletter: renderNewsletterEmail as (p: never) => Promise<string>,
};

/** Render one template with believable sample content. */
export async function renderSample(
  key: string,
  opts: SampleOptions = {}
): Promise<string> {
  const render = RENDERERS[key];
  if (!render) return '';
  return render(sampleProps(key, opts) as never);
}

/** Render one template from props a caller supplies. */
export async function renderWithProps(
  key: string,
  props: Record<string, unknown>
): Promise<string> {
  const render = RENDERERS[key];
  if (!render) return '';
  return render(props as never);
}
