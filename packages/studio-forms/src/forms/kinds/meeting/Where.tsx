'use client';

// ============================================================================
// Meeting → Where (soft tissue). Design: the Quick-Form canvas (2026-11-14,
// https://claude.ai/artifact/RLfYxi9Hj5v3WZgScS4nSo), on every tier.
//
//   [✓ A place] [  A link] [✓ Talk room]      three boxes, any combination,
//   [Place or address                ]        except a link with a Talk room
//
// Each ticked box shows its own input: the address, the joining link; a Talk
// room needs none. A link and a Talk room exclude each other (one join link;
// developer, 2026-11-14): ticking one unticks the other. A place combines with
// either, saved as format 'hybrid'. `where_mode` holds the choice (rules/answers.ts
// whereOf / whereEncode; adapters/meeting.ts resolveMeetingAnswers maps it onto
// format, location, meeting_url and create_talk_room). Unticking keeps what was
// typed in the component, so ticking again within the session restores it.
//
// Copy checked against the code (owner ruling 7, nothing claimed that isn't so):
//   - since 53b80e80 the join link (meeting_url, or the Talk token behind
//     /call/<token>) reaches only people who RSVP'd yes or maybe, the hosts and
//     the org's editors (services/join-link.ts mayReceiveJoinLink); a series
//     keeps it in metadata.joinDetails for RSVP'd viewers (meeting-series.ts:485-495)
//   - a room is made when it goes out (submitted or published), never for a draft
//     (saveMeetingContent skips attachRooms for status 'draft' since 94f20407),
//     always public (createTalkRoom(title, 'public'), meeting-content.ts)
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps } from '../../contract';
import { text, trimmed, whereEncode, whereOf, type WhereChoice } from '../../rules/answers';
import { Hint, Stack } from '../post/parts';

const LINK_HINT = 'Only people who say they’re coming see the link, and the hosts.';
const TALK_HINT = 'A public room is made in Nextcloud when you publish. People who say they’re coming join it from the page, no account needed.';

/** Talk room is offered where Nextcloud Talk is wired, and kept visible on a record that already chose it. */
export function canChooseTalk(a: Answers, ctx: FormContext): boolean {
  return ctx.fields.canCreateTalkRoom === true || whereOf(a).talk;
}

/** The where line under a card's title: "Studio 4, 120 Harbord St" | "Online" | "Studio 4, and in a Talk room". */
export function whereLine(a: Answers): string {
  const w = whereOf(a);
  const place = trimmed(a.location);
  const online = w.talk ? 'in a Talk room' : w.link ? 'online' : '';
  if (w.place) return place ? `${place}${online ? `, and ${online}` : ''}` : '';
  if (w.talk) return 'Online, in a Talk room';
  if (w.link) return 'Online';
  return '';
}

type WhereKey = keyof WhereChoice;

export function MeetingWhere({ answers: a, patch, ctx, field }: SectionProps) {
  const w = whereOf(a);
  const kept = React.useRef<{ location: string; link: string }>({ location: '', link: '' });

  /** Tick or untick one box. A link and a Talk room never both: the newer one wins. */
  const toggle = (key: WhereKey, on: boolean) => {
    if (trimmed(a.location)) kept.current.location = text(a.location);
    if (trimmed(a.meeting_url)) kept.current.link = text(a.meeting_url);
    const next: WhereChoice = { ...w, [key]: on };
    if (on && key === 'link') next.talk = false;
    if (on && key === 'talk') next.link = false;
    const fields: Partial<Answers> = { where_mode: whereEncode(next), create_talk_room: next.talk };
    fields.location = next.place ? text(a.location) || kept.current.location : '';
    fields.meeting_url = next.link ? text(a.meeting_url) || kept.current.link : '';
    fields.format = next.place ? (next.link || next.talk ? 'hybrid' : 'in_person') : next.link || next.talk ? 'online' : 'in_person';
    patch(fields);
  };

  const options = [
    { value: 'place', label: 'A place' },
    { value: 'link', label: 'A link' },
    ...(canChooseTalk(a, ctx) ? [{ value: 'talk', label: 'Talk room' }] : []),
  ];
  const ticked = (['place', 'link', 'talk'] as WhereKey[]).filter((k) => w[k]);

  return (
    <Stack gap={8}>
      {field('where_mode', {
        input: 'multichoice',
        label: 'Where',
        hideLabel: true,
        boxes: true,
        options,
        value: ticked,
        onChange: (v) => {
          const list = Array.isArray(v) ? v.map(String) : [];
          const added = list.find((k) => !ticked.includes(k as WhereKey)) as WhereKey | undefined;
          const removed = ticked.find((k) => !list.includes(k));
          if (added) toggle(added, true);
          else if (removed) toggle(removed, false);
        },
      })}
      {w.place && field('location', { label: 'Place', hideLabel: true, placeholder: 'Place or address', required: true })}
      {w.link && field('meeting_url', { label: 'Joining link', hideLabel: true, placeholder: 'Paste the joining link', hint: LINK_HINT, required: true })}
      {w.talk && <Hint>{TALK_HINT}</Hint>}
    </Stack>
  );
}
