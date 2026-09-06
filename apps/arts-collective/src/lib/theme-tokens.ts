import type { CssVarDef } from "@elkdonis/live-editor";

/**
 * The variables an owner may change on an arts-collective site.
 *
 * Deliberately short. Every one of these is already consumed by the app's
 * stylesheet AND by the shared embeds (bg-card compiles to hsl(var(--card)),
 * bg-primary to hsl(var(--primary))), so changing one restyles the page and
 * the live components together. Exposing the full shadcn set would let an
 * owner make text unreadable against its own background without ever seeing
 * the combination — the foreground pairs are left to follow the defaults.
 *
 * Values are bare HSL triplets, not hsl() calls, because that is what the
 * Tailwind theme layer wraps: --color-primary: hsl(var(--primary)).
 */
export const SITE_THEME_VARS: CssVarDef[] = [
  { name: "--primary", label: "Primary", type: "text", default: "18 54% 38%",
    hint: "Buttons, links, active states. HSL triplet: 18 54% 38%" },
  { name: "--accent", label: "Accent", type: "text", default: "30 58% 86%",
    hint: "Hovers and highlights." },
  { name: "--background", label: "Page background", type: "text", default: "38 30% 96%" },
  { name: "--card", label: "Card background", type: "text", default: "40 34% 98%" },
  { name: "--muted", label: "Muted background", type: "text", default: "36 18% 92%",
    hint: "Wells, secondary panels." },
  { name: "--border", label: "Borders", type: "text", default: "34 20% 86%" },
  { name: "--radius", label: "Corner radius", type: "text", default: "0.5rem",
    hint: "A CSS length: 0 for square, 0.5rem default, 1rem soft." },
];

/**
 * Pages an owner can theme separately, beyond the site default.
 * Keys must match what the app passes as `pageKey` when rendering.
 */
export const THEMEABLE_PAGES: Array<{ key: string; label: string }> = [
  { key: "", label: "Whole site" },
  { key: "home", label: "Home page" },
  { key: "hub", label: "Member hub" },
];
