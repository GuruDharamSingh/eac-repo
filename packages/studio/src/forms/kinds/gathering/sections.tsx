'use client';

// ============================================================================
// Gathering's More rows (soft tissue): Hosts, Places and RSVP, Emails,
// Materials, Publishing, with their closed-row summaries. Design: README §4.
//
// Only what saves today is drawn (owner ruling 7); the rest is in the
// schema's `deferred` with the code that shows why.
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps } from '../../contract';
import { datePart, dayLabel, isRepeating, num, text, timeOf, trimmed } from '../../rules/answers';
import { Cell, GoesOnFields, Hint, Row, Stack, Words, hostCandidatesOf, placementSummary } from '../post/parts';

// ── Hosts ────────────────────────────────────────────────────────────────────

/** Hosts go on the rota for the next occurrence (meeting-content.ts assignNextHosts); only where the org has candidates. */
export function hasHosts(ctx: FormContext): boolean {
  return hostCandidatesOf(ctx).length > 0;
}

export function GatheringHosts({ answers: a, ctx, field }: SectionProps) {
  const options = hostCandidatesOf(ctx).map((c) => ({ value: c.userId, label: c.displayName }));
  return (
    <Stack gap={8}>
      <Row name="hosts">
        <Cell flex="1 1 200px">{field('host_user_id', { input: 'select', label: 'Host', options, placeholder: 'Nobody yet' })}</Cell>
        <Cell flex="1 1 200px">{field('co_host_user_id', { input: 'select', label: 'Co-host', options, placeholder: 'Nobody' })}</Cell>
      </Row>
      {isRepeating(a) && <Hint>For the next time it happens. Later dates are set in Plan ahead.</Hint>}
    </Stack>
  );
}

export function hostsSummary(a: Answers, ctx: FormContext): string {
  const byId = new Map(hostCandidatesOf(ctx).map((c) => [c.userId, c.displayName]));
  const names = [text(a.host_user_id), text(a.co_host_user_id)].filter(Boolean).map((id) => byId.get(id) ?? 'Someone');
  return names.length ? names.join(' and ') : 'Nobody yet';
}

// ── Places and RSVP ──────────────────────────────────────────────────────────

export function GatheringRsvp({ answers: a, field }: SectionProps) {
  const on = a.is_rsvp_enabled !== false;
  return (
    <Stack gap={18}>
      {field('is_rsvp_enabled', { input: 'toggle', label: 'Take RSVPs', placeholder: 'people can say they are coming' })}
      {on && (
        <Row name="rsvp-numbers" gap={14} align="flex-start">
          <Cell flex="1 1 120px">{field('attendee_limit', { input: 'number', label: 'Places', min: 1, placeholder: '', hint: 'Empty means no cap.' })}</Cell>
          <Cell flex="1 1 120px">{field('min_attendees', { input: 'number', label: 'Needs at least', min: 1, placeholder: '', hint: 'Below this, it may not go ahead.' })}</Cell>
          <Cell flex="1 1 150px">{field('rsvp_deadline', { input: 'datetime', label: 'RSVPs close', placeholder: 'When it starts', hint: 'Empty means when it starts.' })}</Cell>
        </Row>
      )}
      {on && num(a.min_attendees) !== null && field('notify_on_min_attendees', { input: 'toggle', label: 'Tell me when the minimum is reached' })}
    </Stack>
  );
}

/** "24 places · closes when it starts"; with the warning, the design's "Needs 12 to go ahead, but only 10 places". */
export function rsvpSummary(a: Answers): string {
  if (a.is_rsvp_enabled === false) return 'No RSVPs';
  const cap = num(a.attendee_limit);
  const min = num(a.min_attendees);
  if (cap !== null && min !== null && min > cap) return `Needs ${min} to go ahead, but only ${cap} ${cap === 1 ? 'place' : 'places'}`;
  const deadline = text(a.rsvp_deadline);
  const closes = datePart(deadline)
    ? `closes ${dayLabel(datePart(deadline), { weekday: true })}${timeOf(deadline) ? ` at ${timeOf(deadline)}` : ''}`
    : 'closes when it starts';
  return `${cap !== null ? `${cap} ${cap === 1 ? 'place' : 'places'}` : 'No cap'} · ${closes}`;
}

// ── Emails ───────────────────────────────────────────────────────────────────

/** The reminder's choices (the design's "[1 day ▾] before"). */
export const REMINDER_CHOICES = [
  { minutes: 60, label: '1 hour', phrase: 'an hour' },
  { minutes: 180, label: '3 hours', phrase: '3 hours' },
  { minutes: 1440, label: '1 day', phrase: 'a day' },
  { minutes: 2880, label: '2 days', phrase: '2 days' },
];

function reminderPhrase(minutes: number): string {
  const known = REMINDER_CHOICES.find((c) => c.minutes === minutes);
  if (known) return known.phrase;
  if (minutes % 1440 === 0) return `${minutes / 1440} days`;
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

/**
 * The Emails rows that work for this org. Today that is the attendee reminder
 * alone, and only where the org's site runs a reminder tick (ctx.fields.canRemind,
 * set by the host: gatheringActions' canRemind option). With none, the section
 * is not drawn at all.
 */
export function emailRows(ctx: FormContext): Array<'reminder'> {
  return ctx.fields.canRemind === true ? ['reminder'] : [];
}

export function GatheringEmails({ answers: a, patch, ctx, field }: SectionProps) {
  const rows = emailRows(ctx);
  const minutes = num(a.reminder_minutes_before);
  const on = minutes !== null;
  const last = React.useRef<number>(minutes ?? 1440);
  if (minutes !== null) last.current = minutes;
  const options = REMINDER_CHOICES.map((c) => ({ value: String(c.minutes), label: c.label }));
  if (minutes !== null && !REMINDER_CHOICES.some((c) => c.minutes === minutes)) {
    options.push({ value: String(minutes), label: reminderPhrase(minutes) });
  }
  return (
    <Stack gap={12}>
      {rows.includes('reminder') && (
        <Stack gap={6}>
          <Row name="emails-reminder" gap={10} align="center">
            <Cell flex="0 0 auto">
              {field('reminder_on', {
                input: 'boolean',
                label: 'A reminder',
                value: on,
                // undefined (never touched) keeps the stored value; null turns it off.
                onChange: (v) => patch({ reminder_minutes_before: v ? last.current : null }),
              })}
            </Cell>
            {on && (
              <>
                <Cell flex="0 0 auto">
                  {field('reminder_minutes_before', {
                    input: 'select',
                    label: 'How long before',
                    hideLabel: true,
                    options,
                    value: String(minutes),
                    onChange: (v) => patch({ reminder_minutes_before: Number(v) }),
                  })}
                </Cell>
                <Words>before</Words>
              </>
            )}
          </Row>
          {/* attendee-reminders.ts:160-190: people who said yes, and guests who asked for one. */}
          <Hint>Goes to everyone who said they’re coming.</Hint>
        </Stack>
      )}
    </Stack>
  );
}

export function emailsSummary(a: Answers): string {
  const minutes = num(a.reminder_minutes_before);
  return minutes !== null ? `A reminder ${reminderPhrase(minutes)} before` : 'No reminder';
}

// ── Materials ────────────────────────────────────────────────────────────────

/** The living document is offered where Nextcloud is wired, and kept visible once chosen. */
export function canMakeDocument(a: Answers, ctx: FormContext): boolean {
  return ctx.fields.canCreateDocument === true || a.create_document === true;
}

export function GatheringMaterials({ answers: a, ctx, field }: SectionProps) {
  return (
    <Stack gap={12}>
      {canMakeDocument(a, ctx) &&
        field('create_document', {
          input: 'boolean',
          label: 'Make a living document',
          hint: 'A shared page in Nextcloud for notes and a running order.',
        })}
      {field('video_link', { input: 'url', label: 'Recording', placeholder: 'https://', hint: 'Added afterwards, usually.' })}
    </Stack>
  );
}

export function materialsSummary(a: Answers, ctx: FormContext): string {
  const parts: string[] = [];
  if (a.create_document === true) parts.push('A living document');
  if (trimmed(a.video_link)) parts.push(parts.length ? 'the recording' : 'The recording');
  if (parts.length) return parts.join(' and ');
  return canMakeDocument(a, ctx) ? 'A shared document, or the recording afterwards' : 'The recording, afterwards';
}

// ── Publishing ───────────────────────────────────────────────────────────────

export function GatheringPublishing(props: SectionProps) {
  return <GoesOnFields {...props} label="Goes on" network />;
}

export function publishingSummary(a: Answers, ctx: FormContext): string {
  return placementSummary(a, ctx);
}
