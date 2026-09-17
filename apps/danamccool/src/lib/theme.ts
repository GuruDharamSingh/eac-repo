// ============================================================================
// The site's palette — the DATA half, and nothing that touches a database.
//
// Split from ./theme-store because the palette editor is a client component
// and imports the roles from here. When this file also held `loadPalette`, the
// import chain ran editor → theme → @elkdonis/db → postgres → `fs`, and the
// page died with "Module not found: Can't resolve 'fs'". Same split, same
// reason, as @elkdonis/blocks and its /server entry.
//
// Tailwind v4 compiles every colour utility to a CSS VARIABLE —
// `.bg-white { background-color: var(--color-white) }`, `.text-gray-900 {
// color: var(--color-gray-900) }` — which is the whole reason the UI kits can
// come in with their own class names untouched and still end up wearing this
// site's colours. Re-define the variables and every harvested section follows.
//
// So a "theme" here is not a stylesheet. It is a short map of variable → value
// that is written into the page at render time, and the kits' markup is left
// exactly as its authors wrote it.
//
// Deliberately NOT a set of invented role names layered over the real ones. A
// role called "Page" that secretly writes three Tailwind variables is a lie
// the moment one of them is used for something else — and `--color-white` IS,
// as both a page ground and the label on a coloured button. The roles below
// each say which variables they write, the editor shows it, and the contrast
// readouts are computed on the pairs the kits actually put together.
// ============================================================================

export interface PaletteRole {
  key: string;
  label: string;
  hint: string;
  /** The Tailwind theme variables this role writes. */
  vars: string[];
  fallback: string;
}

/**
 * The roles, and the variables behind each.
 *
 * Drawn from what the harvested sections actually use: HyperUI's banner and
 * feature grid reach for white / gray-50 / gray-100 / gray-200 / gray-700 /
 * gray-900 / indigo-600 / indigo-700, and Preline's opening reaches for the
 * shadcn names. Both sets are written together so one choice moves both.
 */
export const PALETTE_ROLES: PaletteRole[] = [
  {
    key: "page",
    label: "Page",
    hint: "The ground a section sits on.",
    vars: ["--color-white", "--color-background"],
    fallback: "#ffffff",
  },
  {
    key: "soft",
    label: "Soft ground",
    hint: "Panels, icon chips, the second tone.",
    vars: ["--color-gray-50", "--color-gray-100", "--color-muted"],
    fallback: "#f3f4f6",
  },
  {
    key: "ink",
    label: "Ink",
    hint: "Headings, and the darkest text.",
    vars: ["--color-gray-900", "--color-foreground"],
    fallback: "#111827",
  },
  {
    key: "body",
    label: "Body text",
    hint: "Running text under a heading.",
    vars: ["--color-gray-700", "--color-muted-foreground"],
    fallback: "#374151",
  },
  {
    key: "line",
    label: "Lines",
    hint: "Card edges and rules. Needs 3:1 against the page to be seen.",
    vars: ["--color-gray-200", "--color-border"],
    fallback: "#e5e7eb",
  },
  {
    key: "accent",
    label: "Accent",
    hint: "Buttons and the emphasised word.",
    vars: ["--color-indigo-600", "--color-primary"],
    fallback: "#4f46e5",
  },
  {
    key: "accentDeep",
    label: "Accent, pressed",
    hint: "The hover state of an accent button.",
    vars: ["--color-indigo-700"],
    fallback: "#4338ca",
  },
];

export type Palette = Record<string, string>;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Only the declared roles, only real hex. Anything else is dropped. */
export function cleanPalette(raw: unknown): Palette {
  const out: Palette = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const role of PALETTE_ROLES) {
    const value = (raw as Record<string, unknown>)[role.key];
    if (typeof value === "string" && HEX.test(value)) out[role.key] = value.toLowerCase();
  }
  return out;
}

/**
 * The palette as CSS, for a <style> element in the document head.
 *
 * A `<style>` rather than an inline style attribute on <html>, and that is not
 * a preference: Puck's canvas is an IFRAME, and it mirrors the parent
 * document's <style> and <link> elements into itself. An attribute on <html>
 * is copied by nothing, so the editor would show the kit's own colours while
 * the published page showed the site's.
 *
 * Unlayered on purpose. Tailwind's own values live in `@layer theme`, and an
 * unlayered rule beats a layered one whatever the order — so this needs no
 * specificity trick and no `!important`.
 */
export function paletteCss(palette: Palette): string {
  const lines: string[] = [];
  for (const role of PALETTE_ROLES) {
    const value = palette[role.key];
    if (!value) continue;
    for (const name of role.vars) lines.push(`${name}:${value}`);
  }
  return lines.length ? `:root{${lines.join(";")}}` : "";
}
