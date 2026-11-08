/**
 * Timestamps out of a row, as ISO strings.
 *
 * postgres.js returns `timestamptz` columns as `Date` objects. Casting them
 * `as string` only satisfies TypeScript: at runtime callers still got a Date,
 * and string methods (`localeCompare`, `slice`) threw. These helpers make the
 * type true. A value that is already a string (e.g. from to_char or a JSON
 * aggregate) passes through unchanged.
 *
 * Not for `date` columns: those come back at local midnight, and toISOString
 * can shift the day (see `localDay` in queries/index.ts).
 */
export function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  // A NULL in a column typed as non-null keeps its old runtime value (null)
  // rather than becoming "", so callers that test truthiness see no change.
  if (v == null) return v as unknown as string;
  return String(v);
}

export function isoOrNull(v: unknown): string | null {
  return v == null ? null : iso(v);
}
