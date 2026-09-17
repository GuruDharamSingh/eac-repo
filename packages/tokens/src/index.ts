// ============================================================================
// @elkdonis/tokens
//
// Reads a Design Tokens Format (DTCG) file — the shape Figma, Tokens Studio,
// Style Dictionary, Penpot and Sketch all now read or write — and turns it into
// the flat {"--name": "value"} bag that site_themes has stored since migration
// 090, and that the cascade actually wants.
//
// Zero dependencies and no database, so it runs in a build script, a server
// action or an admin screen without dragging @elkdonis/db behind it. Writing
// the result is `saveSiteTheme` in @elkdonis/services, which already exists.
// ============================================================================

export { importDtcg, linkHooks, varNameFor, STORABLE_NAME, STORABLE_VALUE } from "./import";
export type { ImportOptions, ImportResult } from "./import";
export { flatten, resolveAliases } from "./parse";
export { tokenToCss } from "./css";
export type {
  DtcgColor,
  DtcgDimension,
  DtcgDuration,
  DtcgFile,
  DtcgGroup,
  DtcgToken,
  ImportIssue,
  ResolvedToken,
} from "./types";
