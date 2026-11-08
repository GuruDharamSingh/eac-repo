// ============================================================================
// Reading form answers for a preview. Answers hold WALL-CLOCK times
// ("YYYY-MM-DDTHH:mm" in `time_zone`, cms-ui's datetime shape), so these
// format the digits as typed and never convert through an instant: the
// preview says what the form says, on the server and in any browser.
// ============================================================================

import type { Answers, FormContext, FormHost } from '../contract';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface WallClock {
  y: number;
  mo: number;
  d: number;
  h: number | null;
  mi: number | null;
}

export function parseWallClock(v: unknown): WallClock | null {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v) : null;
  if (!m) return null;
  return { y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: m[4] ? +m[4] : null, mi: m[5] ? +m[5] : null };
}

const pad = (n: number) => String(n).padStart(2, '0');
const weekday = (w: WallClock) => new Date(Date.UTC(w.y, w.mo - 1, w.d)).getUTCDay();

/** "Thu 19 Nov" */
export function shortDay(w: WallClock): string {
  return `${DAYS[weekday(w)]} ${w.d} ${MONTHS[w.mo - 1]}`;
}

/** "Thursdays" */
export function weekdayPlural(w: WallClock): string {
  return DAYS_LONG[weekday(w)]!;
}

/** "18:30" */
export function clock(w: WallClock): string {
  return w.h === null ? '' : `${pad(w.h)}:${pad(w.mi ?? 0)}`;
}

/** "18:30 to 20:30" from a start and a length in minutes. */
export function span(w: WallClock, minutes: unknown): string {
  if (w.h === null) return '';
  const len = typeof minutes === 'number' && minutes > 0 ? minutes : 0;
  if (!len) return clock(w);
  const end = (w.h * 60 + (w.mi ?? 0) + len) % (24 * 60);
  return `${clock(w)} to ${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

export function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** The feed a draft goes on, by its slug in `feed_slug`. */
export function feedName(answers: Answers, host: Pick<FormHost, 'feeds'>, ctx?: FormContext): string | null {
  const slug = text(answers.feed_slug);
  const feeds = host.feeds?.length ? host.feeds : ((ctx?.fields.feeds as Array<{ slug: string; name: string }> | undefined) ?? []);
  return feeds.find((f) => f.slug === slug)?.name ?? feeds[0]?.name ?? null;
}

/** Where a gathering happens, in the words its card prints. */
export function whereLine(a: Answers): string {
  // The Where seg's mode (adapters/gathering.ts where_mode) wins over half-filled keys.
  if (a.where_mode === 'talk') return 'Online, in a Talk room';
  if (a.where_mode === 'link') return 'Online';
  const place = text(a.location);
  if (a.create_talk_room && !text(a.meeting_url)) return place ? `${place}, and in a Talk room` : 'Online, in a Talk room';
  if (text(a.meeting_url)) return place ? `${place}, and online` : 'Online';
  return place || 'Place to be announced';
}

/** Plain paragraphs from stored HTML, for a preview that never injects markup. */
export function paragraphs(html: unknown, max = 3): string[] {
  const s = typeof html === 'string' ? html : '';
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h\d|blockquote|figcaption)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, max);
}

export function readingMinutes(html: unknown): number {
  const words = paragraphs(html, 1000).join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
