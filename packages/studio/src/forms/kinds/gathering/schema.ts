// ============================================================================
// Gathering (code kind `meeting`; people see "Gathering", PLAN §8.1), pass 1,
// soft tissue. Design: README §4, Publish Form.dc.html renderVals().
//
// Answer keys are cms-ui content-fields' meeting answers, saved by
// forms/adapters/gathering.ts through the Meetings tab's own conversion
// (meeting/convert.ts), plus the design keys the adapter resolves or drops:
// where_mode, start_time, forms.repeat_count, forms.repeat_as_series,
// forms.loaded_start.
//
// Series is derived, never chosen (pass 2, PLAN §12): Repeats on WEEKLY +
// "Present it as a series" (forms.repeat_as_series, drawn in When for a new
// gathering) makes codeKind 'series', the label "New series", the Sessions
// planner after When and the Series page row before Publishing. The answers
// stay the gathering's keys (specKind 'meeting', so the fields keep their
// meeting specs) plus forms.repeat_every_weeks, forms.sessions and
// forms.series_page; adapters/series.ts reads them through rules/series.ts.
// What a series cannot store is not drawn for one: Hosts, Emails, Materials
// (schema `when`), the RSVP minimum and closing time, Public | Members.
// ============================================================================

import { emptyContentAnswers, knownTimeZone, type ContentFieldContext } from '@elkdonis/cms-ui/compose';
import type { Answers, FormContext, FormKindSchema } from '../../contract';
import { isRepeating, isSeries } from '../../rules/answers';
import { GATHERING_RULES } from '../../rules/gathering';
import { seriesHeldCount, seriesPageSummary } from '../../rules/series';
import type { KindLayout } from '../post/parts';
import { SeriesPage } from './SeriesPage';
import { GatheringSessions } from './Sessions';
import {
  GatheringEmails,
  GatheringHosts,
  GatheringMaterials,
  GatheringPublishing,
  GatheringRsvp,
  emailRows,
  emailsSummary,
  hasHosts,
  hostsSummary,
  materialsSummary,
  publishingSummary,
  rsvpSummary,
} from './sections';
import { GatheringWhen } from './When';
import { GatheringWhere } from './Where';

/** The cms-ui context a gathering's fields are built with (MeetingKind's fieldContext plus the zone). */
export function gatheringFieldContext(ctx: FormContext): ContentFieldContext {
  return { ...(ctx.fields as ContentFieldContext), defaultTimeZone: knownTimeZone(ctx.timeZone) ?? undefined };
}

/**
 * A blank gathering: content-fields' meeting defaults (an hour, in person, RSVPs on)
 * in the host's zone. No where_mode (derived from format/create_talk_room, so a
 * preset's "online + Talk room" lands as Talk room), no reminder_minutes_before
 * (undefined until the switch is touched), no forms.loaded_start (new: a past
 * date blocks).
 */
export function emptyGatheringAnswers(ctx: FormContext): Answers {
  return emptyContentAnswers('meeting', gatheringFieldContext(ctx));
}

export const GATHERING_LAYOUT: KindLayout = {
  body: { section: 'description', field: 'body', editor: 'toolbar' },
  rows: [
    // Desktop: one line. 390px: date takes the line, time and the length seg drop under it.
    { section: 'when', row: 'when-start', cells: { scheduled_at: '1 1 170px', start_time: '0 0 132px', duration_choice: '0 1 auto', duration_minutes: '0 0 120px' } },
    { section: 'when', row: 'when-cadence', cells: { recurrence_pattern: '0 0 auto', 'forms.repeat_every_weeks': '0 0 auto', 'forms.repeat_ends': '0 1 auto' } },
    // The planner's "Skip dates…": From and To share a line, then wrap under each other at 390px.
    { section: 'sessions', row: 'sessions-skip', cells: { 'forms.skip_from': '1 1 150px', 'forms.skip_to': '1 1 150px' } },
    { section: 'hosts', row: 'hosts', cells: { host_user_id: '1 1 200px', co_host_user_id: '1 1 200px' } },
    { section: 'rsvp', row: 'rsvp-numbers', cells: { attendee_limit: '1 1 120px', min_attendees: '1 1 120px', rsvp_deadline: '1 1 150px' } },
    { section: 'emails', row: 'emails-reminder', cells: { reminder_on: '0 0 auto', reminder_minutes_before: '0 0 auto' } },
    { section: 'publishing', row: 'goes-on', cells: { feed_slug: '1 1 260px', visibility: '0 1 auto' } },
  ],
  // The repeat sub-block (cadence, ends, "Present it as a series") keeps its 46px at 390px.
  indents: [{ section: 'when', block: 'repeat', px: 46 }],
};

export const gatheringKind: FormKindSchema & { layout: KindLayout } = {
  id: 'gathering',
  label: (a) => (isSeries(a) ? 'New series' : 'New gathering'),
  codeKind: (a) => (isSeries(a) ? 'series' : 'meeting'),
  // A series keeps the gathering's keys, so its fields keep the meeting specs (bone, c59dcee7).
  specKind: () => 'meeting',
  // No autosave while Repeats is on: an autosaved meeting draft would take away the
  // series choice (drawn only before there is a record). Series drafts save on Save draft / Publish.
  autosave: (a) => !isRepeating(a),
  sections: [
    // ── Essentials ──
    { id: 'title', label: 'Title', tier: 'essentials', fields: ['title'], quick: true },
    {
      id: 'when',
      label: 'When',
      tier: 'essentials',
      fields: ['scheduled_at', 'start_time', 'recurrence_until', 'forms.repeat_count'],
      render: 'gatheringWhen',
      quick: true,
    },
    {
      // Series only: the list planner (rules/series.ts), after When as the design's rail has it.
      id: 'sessions',
      label: 'Sessions',
      tier: 'essentials',
      fields: ['forms.sessions'],
      render: 'gatheringSessions',
      when: (a) => isSeries(a),
      done: (a) => seriesHeldCount(a) > 0,
    },
    { id: 'where', label: 'Where', tier: 'essentials', fields: ['location', 'meeting_url', 'create_talk_room'], render: 'gatheringWhere', quick: true },
    { id: 'description', label: 'Description', tier: 'essentials', fields: ['body'], quick: true },
    // ── More ──
    {
      id: 'hosts',
      label: 'Hosts',
      tier: 'more',
      fields: ['host_user_id', 'co_host_user_id'],
      render: 'gatheringHosts',
      summary: hostsSummary,
      // A series' hosts are set per week in its planner (assignSeriesRole, meeting-series.ts:1493).
      when: (a, ctx) => hasHosts(ctx) && !isSeries(a),
    },
    {
      id: 'rsvp',
      label: 'Places and RSVP',
      tier: 'more',
      fields: ['is_rsvp_enabled', 'attendee_limit', 'min_attendees', 'rsvp_deadline', 'notify_on_min_attendees'],
      render: 'gatheringRsvp',
      summary: (a) => rsvpSummary(a),
    },
    {
      id: 'emails',
      label: 'Emails',
      tier: 'more',
      fields: ['reminder_minutes_before'],
      render: 'gatheringEmails',
      summary: (a) => emailsSummary(a),
      // Drawn only when one of its rows works for this org (today: the reminder, where canRemind).
      // Not for a series: its letter goes to subscribers N days ahead (metadata.series.reminderDays,
      // meeting-series.ts:1042), which is not this attendee reminder.
      when: (a, ctx) => emailRows(ctx).length > 0 && !isSeries(a),
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
      render: 'gatheringMaterials',
      summary: materialsSummary,
      // A series has no document path, and its recordings are per week (adapters/series.ts).
      when: (a) => !isSeries(a),
    },
    {
      id: 'seriesPage',
      label: 'Series page',
      tier: 'more',
      fields: ['forms.series_page'],
      render: 'seriesPage',
      summary: (a) => seriesPageSummary(a),
      when: (a) => isSeries(a),
      // Listed by default, so the row already says something.
      done: () => true,
    },
    {
      id: 'publishing',
      label: 'Publishing',
      tier: 'more',
      fields: ['feed_slug', 'visibility', 'share_to_network'],
      render: 'gatheringPublishing',
      summary: publishingSummary,
    },
  ],
  components: {
    gatheringWhen: GatheringWhen,
    gatheringWhere: GatheringWhere,
    gatheringHosts: GatheringHosts,
    gatheringRsvp: GatheringRsvp,
    gatheringEmails: GatheringEmails,
    gatheringMaterials: GatheringMaterials,
    gatheringPublishing: GatheringPublishing,
    gatheringSessions: GatheringSessions,
    seriesPage: SeriesPage,
  },
  rules: GATHERING_RULES,
  // README "Interactions": Gathering opens Places and RSVP; a series opens nothing.
  defaultOpen: (a) => (isSeries(a) ? [] : ['rsvp']),
  empty: emptyGatheringAnswers,
  deferred: [
    // ── Emails: only the reminder sends from a per-gathering choice today ──
    {
      id: 'emails.confirmation',
      label: 'When someone RSVPs, a confirmation',
      reason:
        'Not a choice per gathering: some sites’ RSVP routes always send it on a first yes (apps/amrit-canada/src/app/api/threads/[id]/rsvp/route.ts:169, elktours :169, sunjay :173, innergathering :219) and others send none (apps/arts-collective/src/app/api/threads/[id]/rsvp/route.ts:119 writes the RSVP only). Nothing reads a switch.',
      pass: 4,
    },
    {
      id: 'emails.changes',
      label: 'If the time or place changes',
      reason: 'Saving a changed gathering mails nobody: saveMeetingContent writes, attaches rooms and syncs the calendar only (packages/services/src/meeting-content.ts:466-517).',
      pass: 4,
    },
    {
      id: 'emails.after',
      label: 'Afterwards, thanks with the materials',
      reason: 'No sender exists for a letter after a gathering (docs/open/EMAIL_RSVP_DEBRIEF_2026-10-10.md §2.5 lists every letter; none is sent afterwards), and gatherings store no materials (MeetingInput, meeting-content.ts:40-79).',
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
      reason: 'Per-gathering words never apply: resolveOrgTemplate prefers <key>:<threadId> only when the sender passes threadId (packages/email/src/template-store.ts:242), and the RSVP and reminder senders do not (EMAIL_RSVP_DEBRIEF §2.6).',
      pass: 4,
    },
    // ── Places and RSVP ──
    {
      id: 'rsvp.answers',
      label: 'Answers people can give',
      reason: 'The answers are fixed for every thread (RsvpStatus, packages/services/src/thread-rsvp.ts:16) and a gathering stores no allowed set (MeetingInput, meeting-content.ts:40-79); every RSVP route would have to read one (PLAN §1.6).',
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
      reason: 'A gathering stores one picture, its cover (metadata.coverImageUrl, meeting-content.ts:350). The section is "Cover" until more can be saved.',
      pass: 4,
    },
    {
      id: 'materials.files',
      label: 'Add files, Add a link',
      reason:
        'A gathering’s save carries no materials (MeetingInput, meeting-content.ts:40-79), and a new series takes none either: materials are per week (saveSeriesSession.materials, packages/services/src/meeting-series.ts:1167), added in its planner once it exists.',
      pass: 4,
    },
    {
      id: 'poll',
      label: 'Poll or questions',
      reason: 'Polls are org-scoped with no thread to attach to (packages/services/src/question-polls.ts:44-51). The attached add-on is pass 3.',
      pass: 3,
    },
    // ── Series in place (pass 2: drawn; what a series cannot store yet) ──
    {
      id: 'sessions.skip-reason',
      label: 'Skipped: Christmas Eve (the reason)',
      reason:
        'A skip is cancelSeriesSession, which takes no reason (packages/services/src/meeting-series.ts:1603-1608), and series_sessions has no column for one. The row reads "Skipped".',
      pass: 4,
    },
    {
      id: 'sessions.off-rule',
      label: 'Add a session on a date off the schedule',
      reason:
        'ensureSeriesSession refuses a date that is not on the series’ rule (packages/services/src/meeting-series.ts:1297) and moveSeriesSession only moves an existing week (:1676). "Add a session" adds the next date on the rule instead.',
      pass: 4,
    },
    {
      id: 'sessions.renumber',
      label: 'Skips renumber the sessions',
      reason:
        'The server keeps each week’s rule number when another is skipped (stable number, packages/services/src/meeting-series.ts:296; cancelSeriesSession keeps the row, :1603-1622), so the list keeps them too and strikes a skipped one through (bone’s ruling, PLAN §12 deviation).',
      pass: 4,
    },
    {
      id: 'sessions.calendar',
      label: 'Planner as a calendar (1d) or a programme (1e)',
      reason: 'The list planner comes first; the calendar and programme variants are pass 4 (PLAN §1.6, Series in place; §6).',
      pass: 4,
    },
    {
      id: 'series.rsvp-extras',
      label: 'A series’ minimum, its notice, RSVPs close, Hosts, Emails, Materials',
      reason:
        'A series week carries only its places (ensureSeriesSession copies attendee_limit, packages/services/src/meeting-series.ts:1333-1347); hosts are per week (assignSeriesRole, :1493) and the series letter is metadata.series.reminderDays to subscribers (:1042), not the attendee reminder. Not drawn for a series.',
      pass: 4,
    },
  ],
  layout: GATHERING_LAYOUT,
};
