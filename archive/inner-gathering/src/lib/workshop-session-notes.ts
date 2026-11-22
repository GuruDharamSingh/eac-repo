/**
 * workshop_sessions.notes is JSONB, but a past bug (JSON.stringify(...) passed
 * into the postgres.js dynamic insert helper, which serializes JS values for
 * jsonb columns itself) double-encoded it for some existing rows — the
 * column ends up holding a jsonb *string* of JSON text instead of an object,
 * so `row.notes.description` silently reads as undefined. This normalizes
 * either shape so existing rows keep working without a data backfill.
 */
export function parseSessionNotes(raw: unknown): Record<string, any> {
  if (raw && typeof raw === "object") return raw as Record<string, any>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
