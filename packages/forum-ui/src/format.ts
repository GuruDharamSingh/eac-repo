// Time the way a board tells it: relative under a week, dated after.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function timeAgo(value: Date | string | null | undefined, now: Date = new Date()): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = now.getTime() - d.getTime();
  if (diff < MIN) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 2 * DAY) return "yesterday";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function fullStamp(value: Date | string | null | undefined, timeZone?: string): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-CA", {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone,
  });
}

export function dayHeading(value: Date, timeZone?: string): string {
  return value.toLocaleDateString("en-CA", { weekday: "long", day: "numeric", month: "short", timeZone }).toUpperCase();
}

export function clock(value: Date, timeZone?: string): string {
  return value
    .toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone })
    .replace(/\s?([ap])\.?m\.?/i, (_m, p: string) => `${p.toLowerCase()}m`)
    .replace(":00", "");
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-CA")} ${n === 1 ? one : many}`;
}

export function dayKey(value: Date, timeZone?: string): string {
  return value.toLocaleDateString("en-CA", { timeZone });
}
