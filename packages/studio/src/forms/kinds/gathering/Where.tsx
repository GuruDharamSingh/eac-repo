'use client';

// ============================================================================
// Gathering → Where (soft tissue). Design: README §4 "Where".
//
//   [Place | Online link | Talk room]
//   Place        the address, plus "Also online" (a link beside it = hybrid)
//   Online link  the joining link
//   Talk room    a sentence: the room is made on publish, public, joined from the page
//
// `where_mode` is the seg's answer key (forms/adapters/gathering.ts whereModeOf /
// resolveGatheringAnswers map it onto format, location, meeting_url and
// create_talk_room). Switching modes clears what the other mode would save and
// keeps it in the component, so going back within the session restores it.
//
// Copy checked against the code (owner ruling 7, nothing claimed that isn't so):
//   - the join link is not gated on an RSVP: ThreadSurface.tsx:107-110,241 shows
//     "Join" to anyone who can see the page, so the hint says only that
//   - a room is made when it goes out (submitted or published), never for a draft
//     (saveMeetingContent skips attachRooms for status 'draft' since 94f20407),
//     always public (createTalkRoom(title, 'public'), meeting-content.ts)
// ============================================================================

import * as React from 'react';
import type { Answers, FormContext, SectionProps } from '../../contract';
import { whereModeOf, type WhereMode } from '../../adapters/gathering';
import { text, trimmed } from '../../rules/answers';
import { Hint, Stack } from '../post/parts';

const LINK_HINT = 'It shows as a Join button on the page.';
const TALK_HINT = 'A public room is made in Nextcloud when you publish. People join it from the page, no account needed.';

/** Talk room is offered where Nextcloud Talk is wired, and kept visible on a record that already chose it. */
export function canChooseTalk(a: Answers, ctx: FormContext): boolean {
  return ctx.fields.canCreateTalkRoom === true || whereModeOf(a) === 'talk';
}

/** The where line under a card's title: "Studio 4, 120 Harbord St" | "Online" | "Online, in a Talk room". */
export function whereLine(a: Answers): string {
  const mode = whereModeOf(a);
  if (mode === 'talk') return 'Online, in a Talk room';
  if (mode === 'link') return 'Online';
  const place = trimmed(a.location);
  if (!place) return '';
  return trimmed(a.meeting_url) ? `${place}, and online` : place;
}

export function GatheringWhere({ answers: a, patch, ctx, field }: SectionProps) {
  const mode = whereModeOf(a);
  const kept = React.useRef<{ location: string; link: string }>({ location: '', link: '' });
  const [alsoOnline, setAlsoOnline] = React.useState(mode === 'place' && trimmed(a.meeting_url) !== '');

  const remember = () => {
    if (trimmed(a.location)) kept.current.location = text(a.location);
    if (trimmed(a.meeting_url)) kept.current.link = text(a.meeting_url);
  };

  const choose = (next: WhereMode) => {
    if (next === mode) return;
    remember();
    if (next === 'place') {
      setAlsoOnline(false);
      patch({ where_mode: 'place', format: 'in_person', create_talk_room: false, location: text(a.location) || kept.current.location, meeting_url: '' });
    } else if (next === 'link') {
      patch({ where_mode: 'link', format: 'online', create_talk_room: false, location: '', meeting_url: text(a.meeting_url) || kept.current.link });
    } else {
      patch({ where_mode: 'talk', format: 'online', create_talk_room: true, location: '', meeting_url: '' });
    }
  };

  const options = [
    { value: 'place', label: 'Place', icon: 'place' as const },
    { value: 'link', label: 'Online link', icon: 'link' as const },
    ...(canChooseTalk(a, ctx) ? [{ value: 'talk', label: 'Talk room', icon: 'talk' as const }] : []),
  ];

  return (
    <Stack gap={10}>
      {field('where_mode', {
        input: 'radio',
        label: 'Where',
        hideLabel: true,
        options,
        value: mode,
        onChange: (v) => choose(v as WhereMode),
      })}

      {mode === 'place' && (
        <>
          {field('location', { label: 'Address', hideLabel: true, placeholder: 'An address or a room', required: true })}
          {field('also_online', {
            input: 'boolean',
            label: 'Also online',
            value: alsoOnline,
            onChange: (on) => {
              if (on) {
                setAlsoOnline(true);
                patch({ format: 'hybrid', meeting_url: text(a.meeting_url) || kept.current.link });
              } else {
                remember();
                setAlsoOnline(false);
                patch({ format: 'in_person', meeting_url: '' });
              }
            },
          })}
          {alsoOnline && field('meeting_url', { label: 'Joining link', placeholder: 'https://', hint: LINK_HINT })}
        </>
      )}

      {mode === 'link' && field('meeting_url', { label: 'Joining link', hideLabel: true, placeholder: 'Paste the joining link', hint: LINK_HINT, required: true })}

      {mode === 'talk' && <Hint>{TALK_HINT}</Hint>}
    </Stack>
  );
}
