/**
 * The named formatter registry.
 *
 * Manifests declare *wiring*; formatters hold *domain logic*. Anything
 * conditional, pluralised or locale-aware belongs here rather than in manifest
 * syntax — that is what keeps the JSON free of a homegrown expression language.
 *
 * A formatter receives the resolved value(s) for its binding's `from` paths, in
 * order, and returns a display string. Returning `""` means "nothing to show",
 * which drives `fallback` and `omitWhenEmpty`.
 */

import type { Formatter, FormatterMap } from "./types";

const LOCALE = "en-CA";

// ─── Primitive coercion ───────────────────────────────────────────────────────

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * Dates are stored as timestamps but displayed as calendar dates, so they are
 * formatted in UTC. Rendering in the server's local zone would shift an evening
 * session onto the previous day for anyone west of it.
 */
export function formatDate(iso: unknown, locale = LOCALE): string {
  const value = str(iso);
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(iso: unknown, locale = LOCALE): string {
  const value = str(iso);
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: unknown): string {
  const date = formatDate(iso);
  const time = formatTime(iso);
  return date && time ? `${date}, ${time}` : date || time;
}

/** Machine-readable value for a `<time datetime="…">` attribute. */
export function formatIsoDate(iso: unknown): string {
  const value = str(iso);
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function formatWeekday(iso: unknown, locale = LOCALE): string {
  const value = str(iso);
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
}

export function startsIn(iso: unknown): string {
  const value = str(iso);
  if (!value) return "";
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return "";
  const ms = target - Date.now();
  if (ms < 0) return "Started";
  const days = Math.ceil(ms / 86_400_000);
  if (days === 0) return "Begins today";
  if (days === 1) return "Begins tomorrow";
  return `Begins in ${days} days`;
}

export function formatDeadline(iso: unknown): string {
  const date = formatDate(iso);
  return date ? `Registration deadline: ${date}` : "";
}

// ─── Money ────────────────────────────────────────────────────────────────────

export function formatPrice(price: unknown, currency?: unknown): string {
  const n = num(price);
  if (n === null || n <= 0) return "Free";
  const code = (str(currency) || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: code,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${n} ${code}`;
  }
}

export function registrationCta(
  status: unknown,
  price?: unknown,
  currency?: unknown
): string {
  const priceLabel = formatPrice(price, currency);
  switch (str(status)) {
    case "full":
      return "Join waitlist";
    case "closed":
      return "Registration closed";
    default:
      return priceLabel === "Free" ? "Register now" : `Register — ${priceLabel}`;
  }
}

// ─── Enumerations ─────────────────────────────────────────────────────────────

const LEVELS: Record<string, string> = {
  all_levels: "All levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function formatLevel(level: unknown): string {
  const value = str(level);
  return value ? (LEVELS[value] ?? value) : "";
}

const FORMATS: Record<string, string> = {
  in_person: "In-person",
  online: "Online",
  hybrid: "Hybrid",
};

export function formatFormat(fmt: unknown): string {
  const value = str(fmt);
  return value ? (FORMATS[value] ?? value) : "";
}

// ─── Counts (the phrases the old renderer built inline) ───────────────────────

export function formatSessionCount(count: unknown): string {
  const n = num(count);
  return n && n > 0 ? `${n} ${plural(n, "session")}` : "";
}

/** Price suffix, e.g. `"/ 3 sessions"`. Empty for a single session. */
export function formatSessionCountSuffix(count: unknown): string {
  const n = num(count);
  return n && n > 0 ? `/ ${n} ${plural(n, "session")}` : "";
}

export function formatSessionDuration(hours: unknown): string {
  const n = num(hours);
  return n && n > 0 ? `${n} ${plural(n, "hr")} each` : "";
}

export function formatSpots(limit: unknown): string {
  const n = num(limit);
  return n && n > 0 ? `${n} ${plural(n, "spot")}` : "";
}

export function formatSpotsRemaining(limit: unknown): string {
  const spots = formatSpots(limit);
  return spots ? `${spots} remaining` : "";
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Wrap a URL for a `background-image` value. Empty in → empty out. */
export function formatCssUrl(url: unknown): string {
  const value = str(url).trim();
  if (!value) return "";
  // Close the url() token safely even if the path contains a quote.
  return `url('${value.replace(/['\\]/g, "\\$&")}')`;
}

export function formatPlain(value: unknown): string {
  return str(value);
}

export function formatCount(value: unknown): string {
  if (Array.isArray(value)) return String(value.length);
  const n = num(value);
  return n === null ? "" : String(n);
}

/** Join non-empty values with `", "`. Useful for tag/discipline lists. */
export function formatList(value: unknown): string {
  if (Array.isArray(value)) return value.map(str).filter(Boolean).join(", ");
  return str(value);
}

/**
 * First non-empty value. Expresses the `a || b` coalescing the old renderer did
 * inline — a location falling back to a street address, a per-workshop author
 * note overriding the facilitator's default bio.
 */
export function formatFirst(...values: unknown[]): string {
  for (const value of values) {
    const s = str(value).trim();
    if (s) return s;
  }
  return "";
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const builtinFormatters: FormatterMap = {
  plain: formatPlain as Formatter,
  date: formatDate as Formatter,
  time: formatTime as Formatter,
  dateTime: formatDateTime as Formatter,
  isoDate: formatIsoDate as Formatter,
  weekday: formatWeekday as Formatter,
  startsIn: startsIn as Formatter,
  deadline: formatDeadline as Formatter,
  price: formatPrice as Formatter,
  registrationCta: registrationCta as Formatter,
  level: formatLevel as Formatter,
  format: formatFormat as Formatter,
  sessionCount: formatSessionCount as Formatter,
  sessionCountSuffix: formatSessionCountSuffix as Formatter,
  sessionDuration: formatSessionDuration as Formatter,
  spots: formatSpots as Formatter,
  spotsRemaining: formatSpotsRemaining as Formatter,
  cssUrl: formatCssUrl as Formatter,
  count: formatCount as Formatter,
  list: formatList as Formatter,
  first: formatFirst as Formatter,
};
