/**
 * The keys of the console's own surfaces (host-registered `custom` surfaces).
 *
 * Lived in AttentionBands.tsx, the "what needs you" row, until that row left the
 * Organization page (2026-11-27). The surfaces themselves stay: the "Your pieces"
 * card opens drafts, published, answers, people and the schedule, and the Settings
 * card and button open settings. A plain module, so a server file may import it.
 */
export const CONSOLE_SURFACES = {
  drafts: "console-drafts",
  schedule: "console-schedule",
  responses: "console-responses",
  people: "console-people",
  published: "console-published",
  settings: "console-settings",
} as const;
