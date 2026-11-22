// Shared between workshop-page.tsx (progress calc) and workshop-sections-nav.tsx
// (per-session live/upcoming/past indicators) so both agree on the same logic.

// Pinned to America/Toronto so server-rendered markup matches the client's
// re-render — the server runs in UTC, so leaving this to the runtime default
// causes a hydration mismatch on every visitor whose browser isn't also UTC.
export function fmt(date: string | Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", ...opts }).format(new Date(date));
}

export type SessionLiveStatus = "upcoming" | "live" | "past";

export function sessionStatus(
  scheduledAt: string | Date,
  durationMinutes: number | undefined,
  now: number
): SessionLiveStatus {
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes ?? 90) * 60_000;
  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "past";
}

export const STATUS_CONFIG: Record<SessionLiveStatus, { color: string; label: string; bg: string }> = {
  live: { color: "#c0392b", label: "Live Now", bg: "#fdf2f2" },
  upcoming: { color: "#7f5a2f", label: "Upcoming", bg: "#fffaf0" },
  past: { color: "#6b7280", label: "Completed", bg: "#f9fafb" },
};
