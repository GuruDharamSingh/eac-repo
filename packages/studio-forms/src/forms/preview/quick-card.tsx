'use client';

import * as React from 'react';
import type { Answers, FormContext, FormKindId } from '../contract';
import { mediaUrl } from '../fields/MediaField';
import { whereOf } from '../rules/answers';
import { clock, paragraphs, parseWallClock, text } from './format';
import { artworkLines, serviceLines } from './kind-lines';

// ============================================================================
// The Quick-Form's last row (2026-11-14): one compact card of what is being
// made, as the approved canvas draws it (https://claude.ai/artifact/
// RLfYxi9Hj5v3WZgScS4nSo): a meeting's date block or a piece's picture, the
// title, and one line under it. Plain text from the answers, never stored HTML.
// The full preview (the site's own cards, PreviewFrame) stays with the full form.
// ============================================================================

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "7:00 pm" from "19:00". */
function twelveHour(hm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

/** "in person" | "online" | "in Talk" | "in person and in Talk" | "in person and online". */
function whereWords(a: Answers): string {
  const w = whereOf(a);
  const online = w.talk ? 'in Talk' : w.link ? 'online' : '';
  if (w.place) return online ? `in person and ${online}` : 'in person';
  return online;
}

function Thumb({ url }: { url: string | null }) {
  return url ? <img className="frm-qcard-pic" src={url} alt="" /> : <span className="frm-qcard-pic frm-dots" aria-hidden="true" />;
}

export function QuickCard({ kind, answers: a, ctx }: { kind: FormKindId; answers: Answers; ctx: FormContext }) {
  const title = text(a.title) || 'Untitled';
  let lead: React.ReactNode = null;
  let line = '';
  if (kind === 'meeting' || kind === 'event' || kind === 'workshop' || kind === 'series') {
    const dates = kind === 'series' && a.series_mode === 'dates' && Array.isArray(a.series_dates) ? (a.series_dates as unknown[]).map(text).filter(Boolean).sort() : [];
    const w = parseWallClock(dates[0] ?? a.scheduled_at);
    lead = (
      <span className="frm-qcard-date" aria-hidden={w ? undefined : true}>
        <span className="frm-qcard-mon">{w ? MONTHS[w.mo - 1] : '—'}</span>
        <span className="frm-qcard-day">{w ? w.d : ''}</span>
      </span>
    );
    const time = w ? twelveHour(clock(w)) : '';
    const how =
      kind === 'series'
        ? dates.length
          ? `${dates.length} ${dates.length === 1 ? 'date' : 'dates'}`
          : Number(a.series_every_weeks) > 1
            ? `Every ${a.series_every_weeks} weeks`
            : 'Every week'
        : kind === 'workshop'
          ? text(a.location) || ''
          : whereWords(a);
    line = [time || (w ? '' : 'Date to be set'), how].filter(Boolean).join(' · ');
  } else if (kind === 'artwork') {
    const lines = artworkLines(a, ctx);
    lead = <Thumb url={lines.pictures[0] ?? null} />;
    line = [lines.price === 'No price yet' ? 'Price not set' : lines.price, lines.artist || ctx.orgName].filter(Boolean).join(' · ');
  } else if (kind === 'service') {
    const lines = serviceLines(a);
    lead = <Thumb url={mediaUrl(a.cover_image_url ?? a.image_url ?? null)} />;
    line = lines.meta || lines.lede;
  } else {
    lead = <Thumb url={mediaUrl(a.cover_image_url ?? null)} />;
    line = text(a.excerpt) || paragraphs(a.body, 1)[0] || '';
  }
  return (
    <figure className="frm-qcard" data-kind={kind}>
      {lead}
      <figcaption className="frm-qcard-text">
        <strong className="frm-qcard-title">{title}</strong>
        {line && <span className="frm-qcard-line">{line}</span>}
      </figcaption>
    </figure>
  );
}
