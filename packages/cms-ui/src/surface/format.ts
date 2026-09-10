// ============================================================================
// Date and label formatting for surfaces.
//
// Every function takes the connectors' zone and locale rather than the
// browser's, because some orgs are one physical room — "4:00 AM" on
// amrit-canada must mean 4am in Toronto for a reader anywhere.
// ============================================================================

export interface FormatOptions {
  timeZone?: string;
  locale?: string;
}

function date(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(value: string | Date | null | undefined, o: FormatOptions = {}): string {
  const d = date(value);
  if (!d) return "";
  return d.toLocaleString(o.locale, {
    timeZone: o.timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(value: string | Date | null | undefined, o: FormatOptions = {}): string {
  const d = date(value);
  if (!d) return "";
  return d.toLocaleDateString(o.locale, {
    timeZone: o.timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtShortDate(value: string | Date | null | undefined, o: FormatOptions = {}): string {
  const d = date(value);
  if (!d) return "";
  return d.toLocaleDateString(o.locale, { timeZone: o.timeZone, month: "short", day: "numeric" });
}

export function fmtTime(value: string | Date | null | undefined, o: FormatOptions = {}): string {
  const d = date(value);
  if (!d) return "";
  return d.toLocaleTimeString(o.locale, { timeZone: o.timeZone, hour: "numeric", minute: "2-digit" });
}

export function fmtMonth(value: Date, o: FormatOptions = {}): string {
  return value.toLocaleDateString(o.locale, { month: "long", year: "numeric" });
}

export function fmtDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};
export function fmtFormat(value: string | null | undefined): string | null {
  return value ? FORMAT_LABELS[value] ?? null : null;
}

const RECURRENCE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "On a custom schedule",
};
export function fmtRecurrence(value: string | null | undefined): string | null {
  if (!value || value === "NONE") return null;
  return RECURRENCE_LABELS[value] ?? null;
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", or null past a week. */
export function relativeDay(value: string | Date | null | undefined, o: FormatOptions = {}): string | null {
  const d = date(value);
  if (!d) return null;
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: o.timeZone }); // YYYY-MM-DD
  const today = new Date();
  const days = Math.round(
    (Date.parse(key(d)) - Date.parse(key(today))) / 86_400_000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < -1 && days >= -7) return `${-days} days ago`;
  return null;
}

export function fmtPrice(
  price: number | string | null | undefined,
  currency: string | null | undefined,
  o: FormatOptions = {}
): string | null {
  if (price === null || price === undefined || price === "") return null;
  const n = typeof price === "number" ? price : Number(price);
  if (Number.isNaN(n)) return null;
  if (n === 0) return "Free";
  try {
    return new Intl.NumberFormat(o.locale, { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return `${n} ${currency ?? ""}`.trim();
  }
}

/** A `datetime-local` value for a Date, in the display zone. */
export function toDatetimeLocal(value: Date, o: FormatOptions = {}): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: o.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Strip tags for a plain-text summary. Good enough for an .ics DESCRIPTION. */
export function toPlainText(html: string | null | undefined, limit = 400): string {
  if (!html) return "";
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
