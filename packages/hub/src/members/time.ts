// Relative time words for the Members card ("seen yesterday", "for 3 days").
// Pure; `now` is injectable so the harness and tests are stable.

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "Today", "Yesterday", "5 days ago", "2 weeks ago", "3 months ago". null = unknown. */
export function seenText(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso);
  const n = new Date(now);
  const mins = (now - t.getTime()) / 60000;
  if (mins < 2) return 'Just now';
  if (sameDay(t, n)) return 'Today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameDay(t, y)) return 'Yesterday';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(n) - startOf(t)) / 86400000);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${plural(Math.floor(days / 7), 'week')} ago`;
  return `${plural(Math.floor(days / 30), 'month')} ago`;
}

/** "Mar 2021". */
export function joinedText(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Arrival "when": "2 hours ago", "yesterday", "5 days ago". */
export function whenText(iso: string, now = Date.now()): string {
  const mins = Math.max(0, (now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${plural(Math.max(1, Math.floor(mins)), 'minute')} ago`;
  if (mins < 1440) return `${plural(Math.floor(mins / 60), 'hour')} ago`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** How long someone has waited: "2 hours", "1 day", "5 days". */
export function waitText(iso: string, now = Date.now()): string {
  const mins = Math.max(0, (now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return plural(Math.max(1, Math.floor(mins)), 'minute');
  if (mins < 1440) return plural(Math.floor(mins / 60), 'hour');
  return plural(Math.floor(mins / 1440), 'day');
}
