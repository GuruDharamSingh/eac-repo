/**
 * Formatting shared by the hub tiles.
 *
 * These run in client components, so every one of them is locale-neutral by
 * way of `undefined` — the browser's own locale — rather than hardcoding
 * en-US. IFAC's membership is international and its dates were reading as
 * American to everyone.
 */

export function formatDateTime(value: string | null): string {
  if (!value) return "Date to be announced";
  return new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** "in 3 days" / "tomorrow" / "today" — a relative cue beside an absolute date. */
export function relativeDay(value: string | null): string | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round(
    (startOfDay(target) - startOfDay(new Date())) / 86_400_000
  );
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days < 14) return `in ${days} days`;
  if (days < -1 && days > -14) return `${Math.abs(days)} days ago`;
  return null;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};

export function formatLabel(format: string | null): string | null {
  return format ? (FORMAT_LABELS[format] ?? format) : null;
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "Recurring",
};

export function recurrenceLabel(pattern: string | null): string | null {
  return pattern ? (RECURRENCE_LABELS[pattern] ?? "Recurring") : null;
}
