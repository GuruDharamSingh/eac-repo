import type { DtcgFile, DtcgToken, ImportIssue, ResolvedToken } from "./types";

// ============================================================================
// Flatten the file, then resolve what each token actually means.
//
// Three things have to happen before a token has a usable value, and they have
// to happen in this order:
//
//   1. WALK    groups nest arbitrarily; a token's identity is its full path.
//   2. TYPE    `$type` may be declared on the token, or inherited from the
//              nearest ancestor group that declares one, or — for an alias —
//              taken from whatever it points at.
//   3. ALIAS   `{color.brand.primary}` resolves to that token's whole $value,
//              and the target may itself be an alias.
//
// Step 3 is where a file can be malformed in ways that hang a naive resolver,
// so cycles are detected rather than recursed into.
// ============================================================================

const ALIAS_RE = /^\{([^{}]+)\}$/;

/** Is this node a token (has `$value`) rather than a group? */
function isToken(node: unknown): node is DtcgToken {
  return !!node && typeof node === "object" && "$value" in (node as object);
}

/**
 * Every token in the file, keyed by dotted path, with `$type` inherited.
 *
 * Aliases are NOT resolved here — the whole set has to exist first, because an
 * alias may point forwards to a token declared later in the file.
 */
export function flatten(file: DtcgFile, issues: ImportIssue[]): Map<string, ResolvedToken> {
  const out = new Map<string, ResolvedToken>();

  const walk = (node: unknown, path: string[], inheritedType: string | undefined) => {
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    // A group may set the type its children inherit.
    const typeHere = typeof obj.$type === "string" ? obj.$type : inheritedType;

    if (isToken(obj)) {
      out.set(path.join("."), {
        path,
        // May still be empty for an alias; resolveAliases fills it in from the
        // target, which is exactly what the spec says to do.
        type: typeHere ?? "",
        value: obj.$value,
        description: typeof obj.$description === "string" ? obj.$description : undefined,
        deprecated: obj.$deprecated as boolean | string | undefined,
      });
      return;
    }

    if ("$extends" in obj) {
      issues.push({
        path: path.join("."),
        kind: "unsupported",
        message:
          "$extends (group inheritance by deep merge) is not implemented; this group's inherited tokens were skipped.",
      });
    }

    for (const [key, child] of Object.entries(obj)) {
      // $-prefixed keys are metadata, never token names — the spec forbids a
      // token or group name from starting with $.
      if (key.startsWith("$")) continue;
      walk(child, [...path, key], typeHere);
    }
  };

  walk(file, [], undefined);
  return out;
}

/**
 * Replace every `{path.to.token}` with the value it points at.
 *
 * An alias resolves to the target's COMPLETE `$value` — so an alias to a
 * colour yields the colour object, not a string. It also inherits the target's
 * type when it has none of its own.
 *
 * Unresolvable aliases and cycles drop the token and record why. Dropping is
 * right: a token whose value is the literal text "{color.brand.primary}" would
 * reach CSS as garbage and paint nothing, which is far harder to diagnose than
 * a named, reported omission.
 */
export function resolveAliases(
  tokens: Map<string, ResolvedToken>,
  issues: ImportIssue[]
): Map<string, ResolvedToken> {
  const out = new Map<string, ResolvedToken>();

  const resolve = (
    key: string,
    seen: Set<string>
  ): { value: unknown; type: string } | null => {
    const token = tokens.get(key);
    if (!token) return null;

    const alias = typeof token.value === "string" ? ALIAS_RE.exec(token.value) : null;
    if (!alias) return { value: token.value, type: token.type };

    const target = alias[1]!.trim();
    if (seen.has(target)) {
      issues.push({
        path: key,
        kind: "alias-cycle",
        message: `Alias cycle: ${[...seen, target].join(" → ")}`,
      });
      return null;
    }
    if (!tokens.has(target)) {
      issues.push({
        path: key,
        kind: "unresolved-alias",
        message: `Points at {${target}}, which is not in this file.`,
      });
      return null;
    }

    const resolved = resolve(target, new Set([...seen, target]));
    if (!resolved) return null;
    // The alias keeps its own declared type if it has one; otherwise it takes
    // the target's.
    return { value: resolved.value, type: token.type || resolved.type };
  };

  for (const [key, token] of tokens) {
    const resolved = resolve(key, new Set([key]));
    if (!resolved) continue;
    out.set(key, { ...token, value: resolved.value, type: resolved.type });
  }

  return out;
}
