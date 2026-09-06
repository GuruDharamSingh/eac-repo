/**
 * Dotted-path resolution into the render context.
 *
 * Paths come from manifest JSON, which is authored by us but shipped alongside
 * owner-editable template files — so resolution is deliberately narrow: own
 * enumerable properties and array indices only, no prototype walking, no calls.
 */

/** Segments that would reach the prototype chain rather than data. */
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Resolve `path` against `context`.
 *
 * Supports dots and numeric indices: `workshop.sessions.0.title`. Returns
 * `undefined` for any miss, so callers can distinguish "absent" from "empty
 * string" when deciding whether to warn.
 */
export function resolvePath(context: unknown, path: string): unknown {
  if (!path) return undefined;

  let current: unknown = context;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (BLOCKED.has(segment)) return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0) return undefined;
      current = current[index];
      continue;
    }

    if (typeof current !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/** True for values that should be treated as "nothing to render". */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Coerce a resolved value to a display string.
 *
 * Numbers and booleans stringify; `null`/`undefined` become empty rather than
 * the literal "null" the old regex renderer could emit.
 */
export function toDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value);
}
