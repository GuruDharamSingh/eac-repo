// ============================================================================
// Meeting (code kind `meeting`; people see "Meeting", PLAN §8.1), pass 1,
// soft tissue. Design: README §4, Publish Form.dc.html renderVals().
//
// Answer keys are cms-ui content-fields' meeting answers, saved by
// forms/adapters/meeting.ts through the shared conversion (meeting/convert.ts),
// plus the design keys the adapter resolves or drops: where_mode, start_time,
// forms.repeat_count, forms.loaded_start.
//
// A series is its own kind since 2026-11-14 (docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md
// §7, reversing PLAN §3 "derived, never chosen"): "Present it as a series", the
// Sessions planner and the Series page row left this form. Repeats stays: one
// meeting thread that recurs.
// ============================================================================

import { emptyContentAnswers, knownTimeZone, type ContentFieldContext } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema } from '../../contract';
import { MEETING_RULES } from '../../rules/meeting';
import type { KindLayout } from '../post/parts';
import {
  MeetingEmails,
  MeetingHosts,
  MeetingMaterials,
  MeetingPublishing,
  MeetingRsvp,
  MeetingWhy,
  MeetingBadge,
  badgeSummary,
  emailRows,
  emailsSummary,
  hasHosts,
  hostsSummary,
  materialsSummary,
  publishingSummary,
  rsvpSummary,
} from './sections';
import { MeetingWhen } from './When';
import { MeetingWhere } from './Where';

/** The cms-ui context a meeting's fields are built with (MeetingKind's fieldContext plus the zone). */
export function meetingFieldContext(ctx: FormContext): ContentFieldContext {
  return { ...(ctx.fields as ContentFieldContext), defaultTimeZone: knownTimeZone(ctx.timeZone) ?? undefined };
}

/**
 * A blank meeting: content-fields' meeting defaults (an hour, in person, RSVPs on)
 * in the host's zone. No where_mode (derived from format/create_talk_room, so a
 * preset's "online + Talk room" lands as Talk room), no reminder_minutes_before
 * (undefined until the switch is touched), no forms.loaded_start (new: a past
 * date blocks).
 */
export function emptyMeetingAnswers(ctx: FormContext): Answers {
  return emptyContentAnswers('meeting', meetingFieldContext(ctx));
}

export const MEETING_LAYOUT: KindLayout = {
  // The essay Canvas in focus (2026-11-11): body_doc is kept by adapters/meeting.ts and
  // meeting-content.ts writeColumns; quick compose still uses the lite editor.
  body: { section: 'description', field: 'body', editor: 'blocks', omit: ['threadCard:meeting'] },
  rows: [
    // Desktop: one line. 390px: date takes the line, time and the length seg drop under it.
    { section: 'when', row: 'when-start', cells: { scheduled_at: '1 1 12em', start_time: '0 0 9.5em', duration_choice: '0 1 auto', duration_minutes: '0 0 8.5em' } },
    { section: 'when', row: 'when-cadence', cells: { recurrence_pattern: '0 0 auto', 'forms.repeat_every_weeks': '0 0 auto', 'forms.repeat_ends': '0 1 auto' } },
    { section: 'hosts', row: 'hosts', cells: { host_user_id: '1 1 200px', co_host_user_id: '1 1 200px' } },
    { section: 'rsvp', row: 'rsvp-numbers', cells: { attendee_limit: '1 1 120px', min_attendees: '1 1 120px', rsvp_deadline: '1 1 150px' } },
    { section: 'emails', row: 'emails-reminder', cells: { reminder_on: '0 0 auto', reminder_minutes_before: '0 0 auto' } },
    { section: 'publishing', row: 'goes-on', cells: { feed_slug: '1 1 260px', visibility: '0 1 auto' } },
  ],
  // The repeat sub-block (cadence, ends) keeps its 46px at 390px.
  indents: [{ section: 'when', block: 'repeat', px: 46 }],
};

export const meetingKind: FormKindSchema & { layout: KindLayout } = {
  id: 'meeting',
  label: () => 'New meeting',
  codeKind: () => 'meeting',
  specKind: () => 'meeting',
  sections: [
    // ── Essentials ──
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    // The line under the title (threads.excerpt), named Why on every kind (developer, 2026-11-11).
    // Never required: readiness comes from the rules, and an empty one is taken from the body.
    { id: 'why', label: 'Why', tier: 'essentials', fields: ['excerpt'], render: 'meetingWhy', quick: true },
    {
      id: 'when',
      label: 'When',
      tier: 'essentials',
      fields: ['scheduled_at', 'start_time', 'recurrence_until', 'forms.repeat_count'],
      render: 'meetingWhen',
      quick: true,
    },
    { id: 'where', label: 'Where', tier: 'essentials', fields: ['location', 'meeting_url', 'create_talk_room'], render: 'meetingWhere', quick: true },
    // "What", as the developer's sketch names the row (2026-11-11).
    { id: 'description', label: 'What', tier: 'essentials', fields: ['body'], quick: true },
    // ── More ──
    {
      id: 'hosts',
      label: 'Hosts',
      tier: 'more',
      fields: ['host_user_id', 'co_host_user_id'],
      render: 'meetingHosts',
      summary: hostsSummary,
      when: (_a, ctx) => hasHosts(ctx),
    },
    {
      id: 'rsvp',
      label: 'Places and RSVP',
      tier: 'more',
      fields: ['is_rsvp_enabled', 'attendee_limit', 'min_attendees', 'rsvp_deadline', 'notify_on_min_attendees'],
      render: 'meetingRsvp',
      summary: (a) => rsvpSummary(a),
    },
    {
      id: 'emails',
      label: 'Emails',
      tier: 'more',
      fields: ['reminder_minutes_before'],
      render: 'meetingEmails',
      summary: (a) => emailsSummary(a),
      // Drawn only when one of its rows works for this org (today: the reminder, where canRemind).
      when: (_a, ctx) => emailRows(ctx).length > 0,
    },
    {
      id: 'cover',
      label: 'Cover',
      tier: 'more',
      fields: ['cover_image_url'],
      summary: (a) => (typeof a.cover_image_url === 'string' && a.cover_image_url ? 'A cover picture' : 'None yet'),
    },
    {
      id: 'materials',
      label: 'Materials',
      tier: 'more',
      fields: ['create_document', 'video_link'],
      render: 'meetingMaterials',
      summary: materialsSummary,
    },
    {
      // innergathering's confirmation badge; only where the host offers it.
      id: 'badge',
      label: 'Confirmation badge',
      tier: 'more',
      fields: ['show_cycle_badge'],
      render: 'meetingBadge',
      summary: (a) => badgeSummary(a),
      when: (_a, ctx) => ctx.fields.canShowCycleBadge === true,
      done: () => true,
    },
    {
      id: 'publishing',
      label: 'Publishing',
      tier: 'more',
      fields: ['feed_slug', 'visibility', 'share_to_network'],
      render: 'meetingPublishing',
      summary: publishingSummary,
    },
  ],
  components: {
    meetingWhen: MeetingWhen,
    meetingWhere: MeetingWhere,
    meetingHosts: MeetingHosts,
    meetingRsvp: MeetingRsvp,
    meetingWhy: MeetingWhy,
    meetingEmails: MeetingEmails,
    meetingMaterials: MeetingMaterials,
    meetingPublishing: MeetingPublishing,
    meetingBadge: MeetingBadge,
  },
  rules: MEETING_RULES,
  // README "Interactions": a meeting opens Places and RSVP.
  defaultOpen: () => ['rsvp'],
  empty: emptyMeetingAnswers,
  deferred: [
    // ── Emails: only the reminder sends from a per-meeting choice today ──
    {
      id: 'emails.confirmation',
      label: 'When someone RSVPs, a confirmation',
      reason:
        'Not a choice per meeting: some sites’ RSVP routes always send it on a first yes (apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts:169, elktours :169, sunjay :173, innergathering :219) and others send none (apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts:119 writes the RSVP only). Nothing reads a switch.',
      pass: 4,
    },
    {
      id: 'emails.changes',
      label: 'If the time or place changes',
      reason: 'Saving a changed meeting mails nobody: saveMeetingContent writes, attaches rooms and syncs the calendar only (packages/services/src/meeting-content.ts:466-517).',
      pass: 4,
    },
    {
      id: 'emails.after',
      label: 'Afterwards, thanks with the materials',
      reason: 'No sender exists for a letter after a meeting (docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md §2.5 lists every letter; none is sent afterwards), and meetings store no materials (MeetingInput, meeting-content.ts:40-79).',
      pass: 4,
    },
    {
      id: 'emails.host-digest',
      label: 'To hosts, the morning’s RSVPs',
      reason: 'There is no digest: the owner gets one notice per RSVP on the sites that send it (apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts:195), not a morning summary to hosts.',
      pass: 4,
    },
    {
      id: 'emails.wording',
      label: 'Edit wording',
      reason: 'Per-meeting words never apply: resolveOrgTemplate prefers <key>:<threadId> only when the sender passes threadId (packages/email/src/template-store.ts:242), and the RSVP and reminder senders do not (EMAIL_RSVP_DEBRIEF §2.6).',
      pass: 4,
    },
    // ── Places and RSVP ──
    {
      id: 'rsvp.answers',
      label: 'Answers people can give',
      reason: 'The answers are fixed for every thread (RsvpStatus, packages/services/src/thread-rsvp.ts:16) and a meeting stores no allowed set (MeetingInput, meeting-content.ts:40-79); every RSVP route would have to read one (PLAN §1.6).',
      pass: 4,
    },
    {
      id: 'rsvp.questions',
      label: 'Ask something when people RSVP',
      reason: 'Questions are org-scoped with nothing tying them to a thread or an RSVP (createQuestionPoll inserts org_id only, packages/services/src/question-polls.ts:44-51). The Questions add-on is pass 3.',
      pass: 3,
    },
    // ── Where: Talk room ──
    {
      id: 'talk.guests',
      label: 'Let people in without an account',
      reason: 'Not a choice yet: every room made here is public, joinable by link (createTalkRoom(title, \'public\', …), meeting-content.ts:403). The Talk hint says so. createTalkRoom also takes \'group\' (packages/services/src/nextcloud.ts:353-356), so a switch is one services edit away.',
      pass: 4,
    },
    {
      id: 'talk.early',
      label: 'Open the room 10 minutes early',
      reason: 'Rooms have no opening time: createTalkRoom takes a name, a type and a moderator only (packages/services/src/nextcloud.ts:353-356), and nothing opens or closes a room.',
      pass: 4,
    },
    // ── Cover and pictures, Materials ──
    {
      id: 'pictures',
      label: 'More pictures than the cover',
      reason: 'A meeting stores one picture, its cover (metadata.coverImageUrl, meeting-content.ts:350). The section is "Cover" until more can be saved.',
      pass: 4,
    },
    {
      id: 'materials.files',
      label: 'Add files, Add a link',
      reason:
        'A meeting’s save carries no materials (MeetingInput, packages/services/src/meeting-content.ts:62-123).',
      pass: 4,
    },
    {
      id: 'poll',
      label: 'Poll or questions',
      reason: 'Polls are org-scoped with no thread to attach to (packages/services/src/question-polls.ts:44-51). The attached add-on is pass 3.',
      pass: 3,
    },
  ],
  layout: MEETING_LAYOUT,
};

/**
 * An event (2026-11-14): the meeting form, saved as `threads.kind = 'event'` (saveMeetingContent
 * takes 'meeting' | 'event'). Same sections, rules and answers; the host binds
 * meetingActions(actions, { kind: 'event' }) under 'event'.
 */
export const eventKind: FormKindSchema & { layout: KindLayout } = {
  ...meetingKind,
  id: 'event',
  label: () => 'New event',
  codeKind: () => 'event',
  specKind: () => 'meeting',
};
