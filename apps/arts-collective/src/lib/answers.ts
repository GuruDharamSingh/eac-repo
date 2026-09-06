/**
 * Presentation helpers for questionnaire answers.
 *
 * Answers are JSONB with camelCase keys and no schema at the database layer,
 * so both the member-facing hub and the admin vetting queue need the same
 * two functions to render them. Shared here rather than copied into each —
 * this repo has enough of that.
 */

/** camelCase answer key → readable label. */
export function humanizeAnswerKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Status chips shared by the hub and the review queue. */
export const RESPONSE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Awaiting review",
  reviewed: "Accepted",
  returned: "Needs another look",
};
