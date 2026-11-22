// ============================================================================
// THE TEST THEME: one neutral, complete set of values for the shared roles.
//
// Why: a tile drawn outside its own app has none of that app's variables, so blocks fall back to whatever
// the packages hard-code. This theme gives every role a sane value, following worker D's proposal
// (docs/open/DEVELOPMENT_APP_2026-11-20/design-system.md and design-system.json): ROLES FIRST, then every
// family's own names pointed at the roles (aliases). Change a role below and every family follows.
//
// What it sets (the names components actually read today):
//   roles          --eac-ground, --eac-ink, --eac-accent ... (D's vocabulary; nothing reads them yet, the aliases do)
//   shadcn         --background, --foreground, --card, --primary, --border, --radius ... (HSL triplets)
//   surface        hooks --eac-surface-*  and resolved --sf-*
//   blocks         hooks --eac-block-*    and resolved --blk-*
//   fields         --fld-*  and --eac-field-*
//   forms          hooks --eac-form-*     and resolved --frm-*
//   controls       --eac-control-*
//   type           --eac-font-*, --font-* roles, --eac-block-font-*, --eac-form-font-*, --blk-font-*
//
// It is a light, warm-neutral look with one calm blue accent. Per-kind colours (--eac-kind-*) are left unset
// on purpose: kinds follow the accent (D's open question 1, option b).
// ============================================================================

import type { ThemeApp } from "@/lib/types";

/** The roles. Colours are hex (the shadcn triplets are derived), fonts are CSS font-family values. */
export const ROLES = {
  // colour
  ground: "#ffffff",
  groundSoft: "#f5f3ef",
  ink: "#1d1c1a",
  inkMuted: "#5d5a55",
  inkFaint: "#8e8a83",
  line: "#e3dfd8",
  rule: "#cbc6bc",
  accent: "#2f5d8a",
  accentInk: "#264c72",
  onAccent: "#ffffff",
  accentSoft: "#e7eef5",
  danger: "#b3261e",
  ok: "#2e7d4f",
  warn: "#a86400",
  scrim: "rgba(24, 22, 20, 0.5)",
  // type (families are loaded by ./fonts.ts)
  fontBody: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  fontTitle: '"Fraunces", Georgia, "Times New Roman", serif',
  fontNav: '"Inter", system-ui, sans-serif',
  fontCaption: '"Inter", system-ui, sans-serif',
  fontReading: '"Newsreader", Georgia, serif',
  fontRecord: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
  // shape
  radius: "8px",
  radiusControl: "6px",
  radiusMark: "4px",
  shadowRest: "0 1px 2px rgba(24,22,20,.05), 0 10px 22px -18px rgba(24,22,20,.22)",
  shadowLift: "0 2px 4px rgba(24,22,20,.06), 0 16px 30px -18px rgba(24,22,20,.3)",
  shadowPanel: "0 24px 60px -24px rgba(24,22,20,.38)",
  shadowPop: "0 10px 30px -8px rgba(24,22,20,.35)",
  measure: "68ch",
  labelWeight: "600",
  textScale: "1",
} as const;

export type RoleName = keyof typeof ROLES;

/** "#rrggbb" -> "H S% L%" (shadcn's triplet form, used as hsl(var(--x))). */
export function hexToHslTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "0 0% 0%";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const R = ROLES;

/** Role variables: D's vocabulary (--eac-*). Aliases below point at these. */
const roleVars: Record<string, string> = {
  "--eac-ground": R.ground,
  "--eac-ground-soft": R.groundSoft,
  "--eac-ink": R.ink,
  "--eac-ink-muted": R.inkMuted,
  "--eac-ink-faint": R.inkFaint,
  "--eac-line": R.line,
  "--eac-rule": R.rule,
  "--eac-accent": R.accent,
  "--eac-accent-ink": R.accentInk,
  "--eac-on-accent": R.onAccent,
  "--eac-accent-soft": R.accentSoft,
  "--eac-danger": R.danger,
  "--eac-ok": R.ok,
  "--eac-warn": R.warn,
  "--eac-scrim": R.scrim,
  "--eac-font-title": R.fontTitle,
  "--eac-font-body": R.fontBody,
  "--eac-font-nav": R.fontNav,
  "--eac-font-caption": R.fontCaption,
  "--eac-font-reading": R.fontReading,
  "--eac-font-record": R.fontRecord,
  "--eac-text-scale": R.textScale,
  "--eac-label-weight": R.labelWeight,
  "--eac-gap-1": "4px",
  "--eac-gap-2": "8px",
  "--eac-gap-3": "12px",
  "--eac-gap-4": "18px",
  "--eac-gap-5": "24px",
  "--eac-measure": R.measure,
  "--eac-width-compact": "440px",
  "--eac-width-standard": "640px",
  "--eac-width-wide": "940px",
  "--eac-width-full": "1180px",
  "--eac-radius": R.radius,
  "--eac-radius-control": R.radiusControl,
  "--eac-radius-mark": R.radiusMark,
  "--eac-shadow-rest": R.shadowRest,
  "--eac-shadow-lift": R.shadowLift,
  "--eac-shadow-panel": R.shadowPanel,
  "--eac-shadow-pop": R.shadowPop,
  "--eac-ease": "cubic-bezier(0.2, 0.7, 0.2, 1)",
  "--eac-dur-fast": "120ms",
  "--eac-dur-base": "180ms",
  "--eac-dur-slow": "320ms",
};

const role = (name: string) => `var(${name})`;

/** The aliases: each family's own names, pointed at a role. Left = the name a component reads. */
const aliasMap: Record<string, string> = {
  // surface (hooks, then resolved)
  "--eac-surface-bg": "--eac-ground",
  "--eac-surface-bg-soft": "--eac-ground-soft",
  "--eac-surface-fg": "--eac-ink",
  "--eac-surface-muted": "--eac-ink-muted",
  "--eac-surface-faint": "--eac-ink-faint",
  "--eac-surface-line": "--eac-line",
  "--eac-surface-rule": "--eac-rule",
  "--eac-surface-accent": "--eac-accent",
  "--eac-surface-primary": "--eac-accent",
  "--eac-surface-on-accent": "--eac-on-accent",
  "--eac-surface-on-primary": "--eac-on-accent",
  "--eac-surface-danger": "--eac-danger",
  "--eac-surface-scrim": "--eac-scrim",
  "--eac-surface-radius": "--eac-radius",
  "--sf-bg": "--eac-ground",
  "--sf-bg-soft": "--eac-ground-soft",
  "--sf-fg": "--eac-ink",
  "--sf-muted": "--eac-ink-muted",
  "--sf-faint": "--eac-ink-faint",
  "--sf-line": "--eac-line",
  "--sf-rule": "--eac-rule",
  "--sf-accent": "--eac-accent",
  "--sf-on-accent": "--eac-on-accent",
  "--sf-danger": "--eac-danger",
  "--sf-scrim": "--eac-scrim",
  "--sf-radius": "--eac-radius",
  "--sf-radius-sm": "--eac-radius-mark",
  "--sf-shadow": "--eac-shadow-panel",
  "--sf-font-title": "--eac-font-title",
  "--sf-font-body": "--eac-font-body",
  "--sf-font-record": "--eac-font-record",
  "--sf-w-compact": "--eac-width-compact",
  "--sf-w-standard": "--eac-width-standard",
  "--sf-w-wide": "--eac-width-wide",
  "--sf-w-full": "--eac-width-full",
  "--sf-morph-easing": "--eac-ease",
  // blocks
  "--eac-block-bg": "--eac-ground",
  "--eac-block-fg": "--eac-ink",
  "--eac-block-muted": "--eac-ink-muted",
  "--eac-block-line": "--eac-line",
  "--eac-block-accent": "--eac-accent",
  "--eac-block-on-accent": "--eac-on-accent",
  "--eac-block-danger": "--eac-danger",
  "--eac-block-ok": "--eac-ok",
  "--eac-block-radius": "--eac-radius",
  "--eac-block-radius-sm": "--eac-radius-mark",
  "--eac-block-measure": "--eac-measure",
  "--eac-block-font-title": "--eac-font-title",
  "--eac-block-font-body": "--eac-font-body",
  "--eac-block-font-nav": "--eac-font-nav",
  "--eac-block-field-bg": "--eac-ground",
  "--eac-block-field-fg": "--eac-ink",
  "--eac-block-field-line": "--eac-rule",
  "--blk-bg": "--eac-ground",
  "--blk-bg-soft": "--eac-ground-soft",
  "--blk-fg": "--eac-ink",
  "--blk-muted": "--eac-ink-muted",
  "--blk-faint": "--eac-ink-faint",
  "--blk-line": "--eac-line",
  "--blk-accent": "--eac-accent",
  "--blk-accent-ink": "--eac-accent-ink",
  "--blk-on-accent": "--eac-on-accent",
  "--blk-danger": "--eac-danger",
  "--blk-ok": "--eac-ok",
  "--blk-radius": "--eac-radius",
  "--blk-radius-sm": "--eac-radius-mark",
  "--blk-measure": "--eac-measure",
  "--blk-font-title": "--eac-font-title",
  "--blk-font-body": "--eac-font-body",
  // fields
  "--fld-fg": "--eac-ink",
  "--fld-muted": "--eac-ink-muted",
  "--fld-line": "--eac-rule",
  "--fld-bg": "--eac-ground",
  "--fld-bg-soft": "--eac-ground-soft",
  "--fld-danger": "--eac-danger",
  "--fld-radius": "--eac-radius-control",
  "--fld-record": "--eac-font-record",
  "--fld-accent": "--eac-accent",
  "--fld-on-accent": "--eac-on-accent",
  "--eac-field-fg": "--eac-ink",
  "--eac-field-muted": "--eac-ink-muted",
  "--eac-field-line": "--eac-rule",
  "--eac-field-bg": "--eac-ground",
  "--eac-field-bg-soft": "--eac-ground-soft",
  "--eac-field-danger": "--eac-danger",
  "--eac-field-radius": "--eac-radius-control",
  "--eac-field-accent": "--eac-accent",
  "--eac-field-on-accent": "--eac-on-accent",
  // studio forms (hooks, then resolved)
  "--eac-form-bg": "--eac-ground",
  "--eac-form-surface": "--eac-ground",
  "--eac-form-text": "--eac-ink",
  "--eac-form-muted": "--eac-ink-muted",
  "--eac-form-faint": "--eac-ink-faint",
  "--eac-form-divider": "--eac-line",
  "--eac-form-rule": "--eac-rule",
  "--eac-form-accent": "--eac-accent",
  "--eac-form-accent-on": "--eac-on-accent",
  "--eac-form-accent-ink": "--eac-accent-ink",
  "--eac-form-accent-soft": "--eac-accent-soft",
  "--eac-form-danger": "--eac-danger",
  "--eac-form-warn": "--eac-warn",
  "--eac-form-radius-control": "--eac-radius-control",
  "--eac-form-radius-panel": "--eac-radius",
  "--eac-form-radius-mark": "--eac-radius-mark",
  "--eac-form-shadow-panel": "--eac-shadow-panel",
  "--eac-form-shadow-pop": "--eac-shadow-pop",
  "--eac-form-font-body": "--eac-font-body",
  "--eac-form-font-heading": "--eac-font-title",
  "--eac-form-label-weight": "--eac-label-weight",
  "--eac-form-text-scale": "--eac-text-scale",
  "--eac-form-cols-gap": "--eac-gap-5",
  "--eac-form-field": "--eac-ground-soft",
  "--eac-form-field-line": "--eac-line",
  "--frm-bg": "--eac-ground",
  "--frm-surface": "--eac-ground",
  "--frm-text": "--eac-ink",
  "--frm-muted": "--eac-ink-muted",
  "--frm-faint": "--eac-ink-faint",
  "--frm-divider": "--eac-line",
  "--frm-accent": "--eac-accent",
  "--frm-accent-on": "--eac-on-accent",
  "--frm-accent-ink": "--eac-accent-ink",
  "--frm-accent-soft": "--eac-accent-soft",
  "--frm-danger": "--eac-danger",
  // controls (elktours' shadcn bridge)
  "--eac-control-bg": "--eac-ground",
  "--eac-control-fg": "--eac-ink",
  "--eac-control-muted": "--eac-ink-muted",
  "--eac-control-line": "--eac-line",
  "--eac-control-accent": "--eac-accent",
  "--eac-control-accent-on": "--eac-on-accent",
  "--eac-control-accent-ink": "--eac-accent-ink",
  "--eac-control-danger": "--eac-danger",
  "--eac-control-radius": "--eac-radius-control",
  // font roles (@elkdonis/fonts: --font-<role>)
  "--font-body": "--eac-font-body",
  "--font-heading": "--eac-font-title",
  "--font-nav": "--eac-font-nav",
  "--font-caption": "--eac-font-caption",
  "--font-reading": "--eac-font-reading",
};

/** shadcn: HSL triplets (hsl(var(--background))), derived from the colour roles. */
const shadcnVars: Record<string, string> = (() => {
  const t = hexToHslTriplet;
  return {
    "--background": t(R.ground),
    "--foreground": t(R.ink),
    "--card": t(R.ground),
    "--card-foreground": t(R.ink),
    "--popover": t(R.ground),
    "--popover-foreground": t(R.ink),
    "--primary": t(R.accent),
    "--primary-foreground": t(R.onAccent),
    "--secondary": t(R.groundSoft),
    "--secondary-foreground": t(R.ink),
    "--muted": t(R.groundSoft),
    "--muted-foreground": t(R.inkMuted),
    "--accent": t(R.groundSoft),
    "--accent-foreground": t(R.ink),
    "--destructive": t(R.danger),
    "--destructive-foreground": t(R.onAccent),
    "--border": t(R.line),
    "--input": t(R.rule),
    "--ring": t(R.accent),
    "--radius": R.radius,
  };
})();

/** The complete variable set, as an inline style object for a wrapper. */
export function testThemeVars(): Record<string, string> {
  const vars: Record<string, string> = { ...roleVars, ...shadcnVars };
  for (const [name, target] of Object.entries(aliasMap)) vars[name] = role(target);
  // The block library reads the title and body fonts under one more name each, and takes ink on ground.
  vars.color = role("--eac-ink");
  vars.background = role("--eac-ground");
  return vars;
}

/** The theme as the switcher's ThemeApp (id "test"). Fonts here are the roles; ./fonts.ts loads the families. */
export function testTheme(): ThemeApp {
  const vars = testThemeVars();
  const colourNames = ["--eac-ground", "--eac-ground-soft", "--eac-ink", "--eac-ink-muted", "--eac-line", "--eac-accent", "--eac-accent-soft", "--eac-danger", "--eac-ok", "--eac-warn"];
  return {
    id: "test",
    label: "Test theme (neutral)",
    source: "apps/development/src/theme/test-theme.ts",
    vars,
    fonts: { heading: R.fontTitle, body: R.fontBody },
    families: ["roles", "shadcn", "surface", "blocks", "fields", "forms", "controls", "fonts"],
    counts: { total: Object.keys(vars).length, colours: colourNames.length, fonts: 6 },
    editedBy: "worker S",
    swatches: colourNames.map((n) => ({ name: n, value: (vars[n] ?? "") as string })),
  };
}

export const TEST_THEME_ID = "test";
