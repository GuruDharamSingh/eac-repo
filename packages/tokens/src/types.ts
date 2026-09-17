// ============================================================================
// The Design Tokens Format, as far as we need it.
//
// DTCG reached its first stable version — 2025.10 — in October 2025, backed by
// Adobe, Figma, Google, Microsoft, Shopify and others, and read or written by
// Figma, Penpot, Sketch, Tokens Studio, Style Dictionary and Terrazzo. It is a
// COMMUNITY GROUP specification, not a ratified W3C Standard; stable and widely
// implemented, but worth describing accurately.
//
// Why we care: it means "an org arrives with a look already designed" is a file
// to read rather than a palette to transcribe by hand.
//
// These types describe the file, NOT our variables. The translation happens in
// css.ts and import.ts, deliberately in one direction: we read this format, we
// do not store it. What we store is a flat bag of {"--name": "value"}, which is
// what site_themes has always held and what the cascade actually wants.
// ============================================================================

/** Anything with a `$value` is a token; anything without one is a group. */
export interface DtcgToken {
  $value: unknown;
  $type?: string;
  $description?: string;
  $deprecated?: boolean | string;
  $extensions?: Record<string, unknown>;
}

export interface DtcgGroup {
  /** A group may declare a type that its children inherit. */
  $type?: string;
  $description?: string;
  [key: string]: unknown;
}

export type DtcgFile = DtcgGroup;

/**
 * A token once its group nesting, inherited `$type` and aliases are resolved.
 *
 * `path` is the token's position in the file — ["color", "brand", "primary"] —
 * which is what a variable name is derived from, and what an alias points at.
 */
export interface ResolvedToken {
  path: string[];
  type: string;
  value: unknown;
  description?: string;
  deprecated?: boolean | string;
}

/** A colour, per the DTCG colour module. */
export interface DtcgColor {
  colorSpace: string;
  /** Per-space ranges; the literal string "none" is valid for any component. */
  components: (number | "none")[];
  /** 0–1. Absent means fully opaque. */
  alpha?: number;
  /** Optional 6-digit hex fallback. */
  hex?: string;
}

/** A length. Note this is an OBJECT in 2025.10, not the string "16px". */
export interface DtcgDimension {
  value: number;
  unit: "px" | "rem";
}

export interface DtcgDuration {
  value: number;
  unit: "ms" | "s";
}

/** What went wrong, or what we chose not to carry across. */
export interface ImportIssue {
  /** Dotted token path, or "" for file-level problems. */
  path: string;
  kind:
    | "unknown-type"
    | "unresolved-alias"
    | "alias-cycle"
    | "bad-value"
    | "unsupported"
    | "unstorable"
    | "name-collision";
  message: string;
}
