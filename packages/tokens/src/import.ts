import { tokenToCss } from "./css";
import { flatten, resolveAliases } from "./parse";
import type { DtcgFile, ImportIssue, ResolvedToken } from "./types";

// ============================================================================
// The top-level: a DTCG file in, a bag of CSS custom properties out.
//
// The output shape is deliberately the one site_themes already stores —
// {"--name": "value"} — rather than anything new. That table has held exactly
// that since migration 090; what it has never had is something that WRITES to
// it. This is that.
// ============================================================================

/**
 * These two mirror `sanitizeThemeVars` in @elkdonis/services/themes.
 *
 * Duplicated on purpose: this package has no database and must stay free of
 * one, so it cannot import the service. The duplication is worth it because of
 * what the service does with a failure — it DROPS silently, by design, since a
 * missing colour is better than a broken stylesheet on every page. Silent is
 * right at save time and useless at import time, where the whole job is to tell
 * someone what did and did not come across. So we check first and report.
 *
 * If the service's rules change, change these. `assertInSyncWithServices` in
 * the smoke test exists to make that failure loud.
 */
export const STORABLE_NAME = /^--[a-z0-9-]{1,60}$/i;
export const STORABLE_VALUE = /^[a-z0-9\s.,%#()/_-]{1,120}$/i;

export interface ImportOptions {
  /**
   * Prepended to every generated name: `eac` → `--eac-color-brand-primary`.
   * Namespacing an imported file keeps it from colliding with an app's own
   * variables, which is the difference between a theme and a hostile takeover.
   */
  prefix?: string;
  /**
   * Keep tokens marked `$deprecated`. Off by default — a design system that
   * has retired a colour should not have it reappear because we imported the
   * file that still documents it.
   */
  includeDeprecated?: boolean;
}

export interface ImportResult {
  /** Ready for `saveSiteTheme` — every entry is known to be storable. */
  vars: Record<string, string>;
  /** Generated name → the dotted token path it came from, for a mapping UI. */
  sources: Record<string, string>;
  /** Anything dropped, and why. Never empty silently — always inspect it. */
  issues: ImportIssue[];
  counts: { tokens: number; vars: number; dropped: number };
}

/** `Brand Primary` / `brandPrimary` / `brand_primary` → `brand-primary`. */
function slug(segment: string): string {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function varNameFor(path: string[], prefix?: string): string {
  const parts = [...(prefix ? [slug(prefix)] : []), ...path.map(slug)].filter(Boolean);
  return `--${parts.join("-")}`;
}

export function importDtcg(file: DtcgFile, options: ImportOptions = {}): ImportResult {
  const issues: ImportIssue[] = [];

  if (!file || typeof file !== "object" || Array.isArray(file)) {
    return {
      vars: {},
      sources: {},
      issues: [{ path: "", kind: "bad-value", message: "Not a JSON object." }],
      counts: { tokens: 0, vars: 0, dropped: 0 },
    };
  }

  const resolved = resolveAliases(flatten(file, issues), issues);

  const vars: Record<string, string> = {};
  const sources: Record<string, string> = {};
  let dropped = 0;

  for (const token of resolved.values() as Iterable<ResolvedToken>) {
    const path = token.path.join(".");

    if (token.deprecated && !options.includeDeprecated) {
      issues.push({
        path,
        kind: "unsupported",
        message:
          typeof token.deprecated === "string"
            ? `Deprecated: ${token.deprecated}`
            : "Marked deprecated in the source file.",
      });
      dropped++;
      continue;
    }

    const pairs = tokenToCss(token, issues);
    if (pairs.length === 0) {
      dropped++;
      continue;
    }

    for (const [suffix, value] of pairs) {
      const name = `${varNameFor(token.path, options.prefix)}${suffix}`;

      if (!STORABLE_NAME.test(name)) {
        issues.push({
          path,
          kind: "unstorable",
          message: `Generated name "${name}" is longer than 60 characters or contains something other than letters, digits and dashes.`,
        });
        dropped++;
        continue;
      }
      if (!STORABLE_VALUE.test(value)) {
        // Overwhelmingly this is a quoted font family: the storage rules reject
        // quote characters, so `"Source Sans 3", sans-serif` cannot be saved
        // while `Georgia, serif` can. Saying so beats letting it vanish.
        issues.push({
          path,
          kind: "unstorable",
          message: `Value ${JSON.stringify(value)} cannot be stored — it contains a character the theme storage rejects${value.includes('"') ? ' (a quote mark, which CSS requires around this font name)' : ""}.`,
        });
        dropped++;
        continue;
      }
      if (name in vars) {
        issues.push({
          path,
          kind: "name-collision",
          message: `Two tokens both produce "${name}"; kept ${sources[name]}.`,
        });
        dropped++;
        continue;
      }

      vars[name] = value;
      sources[name] = path;
    }
  }

  return {
    vars,
    sources,
    issues,
    counts: { tokens: resolved.size, vars: Object.keys(vars).length, dropped },
  };
}

/**
 * Point our own hooks at imported variables.
 *
 * An imported file names things in its own vocabulary — `color.brand.primary`,
 * `palette.accent.default` — and no importer can reliably guess which of those
 * is "the colour a button is filled with". That guess is the one thing a person
 * must make, so this takes an explicit map rather than inventing a heuristic:
 *
 *     linkHooks(result, {
 *       "--eac-control-accent":    "color.brand.primary",
 *       "--eac-control-accent-on": "color.brand.on-primary",
 *     })
 *
 * The hooks are emitted as `var()` references rather than copied values, so the
 * imported palette stays the single source: re-import the file and everything
 * pointed at it moves together.
 */
export function linkHooks(
  result: ImportResult,
  map: Record<string, string>
): { vars: Record<string, string>; issues: ImportIssue[] } {
  const byPath = new Map(Object.entries(result.sources).map(([name, path]) => [path, name]));
  const vars: Record<string, string> = {};
  const issues: ImportIssue[] = [];

  for (const [hook, path] of Object.entries(map)) {
    if (!STORABLE_NAME.test(hook)) {
      issues.push({ path, kind: "unstorable", message: `"${hook}" is not a usable variable name.` });
      continue;
    }
    const target = byPath.get(path);
    if (!target) {
      issues.push({
        path,
        kind: "unresolved-alias",
        message: `No imported variable came from "${path}" — it may have been dropped; check the issues list.`,
      });
      continue;
    }
    vars[hook] = `var(${target})`;
  }

  return { vars, issues };
}
