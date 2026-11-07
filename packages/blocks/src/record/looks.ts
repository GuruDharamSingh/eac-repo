// ============================================================================
// LOOKS: named presets a record's card can wear (katie's Ember / Glaze Lab /
// Profile). The list and the CSS are the app's; this is the plumbing:
//
//   export const { LOOKS, lookOf, lookProp, SITE_LOOK_VAR } = defineLooks(
//     [{ value: "house", label: "House" }, { value: "ember", label: "Ember" }],
//     { siteVar: "--ktp-look", inheritLabel: "As around it (row, then the site)" },
//   );
//
// Convention (all CSS, so it is live in the editor and on the page alike):
//   1. the block's own `look` prop, drawn as `data-look` on its card
//   2. a parent row's `look`, drawn as `data-look` on the row
//   3. the site default: a Site style variable (`siteVar`) the root layout
//      writes as `data-site-look` on <body> and on the editor canvas root
// "" means "as around it", so it is never a look: an entry with an empty
// value, and any repeat of a value, is skipped. Never rename a value: they
// are stored in pages.
// ============================================================================

export interface LookOption {
  value: string;
  label: string;
}

export function defineLooks<const L extends readonly LookOption[]>(
  list: L,
  opts: { siteVar: string; inheritLabel?: string },
) {
  type Look = L[number]["value"];
  const seen = new Set<string>();
  const looks = list.filter((l) => {
    if (typeof l.value !== "string" || !l.value.trim() || seen.has(l.value)) return false;
    seen.add(l.value);
    return true;
  }) as unknown as L;
  const inheritLabel = opts.inheritLabel ?? "As around it";

  /** A stored look, or null for "as around it" (and for anything unknown). */
  function lookOf(v: unknown): Look | null {
    return typeof v === "string" && seen.has(v) ? (v as Look) : null;
  }

  /** The `look` prop every card-drawing block declares. */
  const lookProp = (description: string) =>
    ({
      name: "look",
      kind: "select",
      label: "Look",
      description,
      default: "",
      options: [{ value: "", label: inheritLabel }, ...looks.map((l) => ({ value: l.value, label: l.label }))],
    }) as const;

  return { LOOKS: looks, lookOf, lookProp, SITE_LOOK_VAR: opts.siteVar };
}
