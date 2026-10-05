/** The zone gatherings are shown in. Same value the hub and the landing page use. */
export const TIME_ZONE = "America/Toronto";

/** `scheduledAt` and friends arrive as ISO strings on the editor's HTTP path. */
export function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}
