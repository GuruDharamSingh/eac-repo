import type { PropDef } from "@elkdonis/blocks";

// ============================================================================
// A section's look — the light set of style fields every directory section
// carries.
//
// Declared as @elkdonis/blocks `PropDef`s, so registering these sections as
// Puck blocks later is a matter of handing the arrays to `defineBlock` rather
// than re-describing them. The pattern is the store panel's `store-frame`:
// every choice is a SELECT from a measured set, never a free colour picker or
// a typed font name, so no combination an author can reach draws unreadable
// text or pulls a font the page has not loaded.
//
// These are only what the studio's generic "Style" (page-builder's
// `blkStyle`: spacing, width, border, radius, shadow, visibility) does not
// cover — the ground with its matched ink, the two fonts, the text size and
// where the text sits. A section carries both: `look` here, and `blkStyle`,
// which ./Section hands to the same `BlockStyleWrap` a Puck block gets.
//
// Nothing here is editable by visitors yet. Each section renders from the
// defaults in ./directory-page, and the values travel to the markup as data
// attributes that src/theme/directory.css resolves.
// ============================================================================

export const LOOK_PROPS = [
  {
    name: "ground",
    kind: "select",
    label: "Background",
    default: "desk",
    options: [
      { value: "desk", label: "Desk — the page's near-black" },
      { value: "folder", label: "Folder — a shade lighter" },
      { value: "paper", label: "Paper — cream, black ink" },
      { value: "manila", label: "Manila — file-folder tan, black ink" },
    ],
  },
  {
    name: "headingFont",
    kind: "select",
    label: "Heading font",
    default: "type",
    options: [
      { value: "type", label: "Typewriter (Courier Prime)" },
      { value: "display", label: "Serif (Playfair Display)" },
      { value: "gothic", label: "Blackletter (UnifrakturMaguntia)" },
    ],
  },
  {
    name: "bodyFont",
    kind: "select",
    label: "Text font",
    default: "type",
    options: [
      { value: "type", label: "Typewriter (Courier Prime)" },
      { value: "display", label: "Serif (Playfair Display)" },
    ],
  },
  {
    name: "scale",
    kind: "select",
    label: "Text size",
    default: "regular",
    options: [
      { value: "small", label: "Small" },
      { value: "regular", label: "Regular" },
      { value: "large", label: "Large" },
    ],
  },
  {
    name: "align",
    kind: "select",
    label: "Alignment",
    default: "start",
    options: [
      { value: "start", label: "Left" },
      { value: "center", label: "Centred" },
    ],
  },
] as const satisfies readonly PropDef[];

type LookProp = (typeof LOOK_PROPS)[number];

/** One section's look: each field narrowed to its declared options. */
export type SectionLook = {
  [P in LookProp as P["name"]]?: P["options"][number]["value"];
};

export const DEFAULT_LOOK: Required<SectionLook> = Object.fromEntries(
  LOOK_PROPS.map((p) => [p.name, p.default])
) as Required<SectionLook>;

/**
 * The look as data attributes, with anything unknown replaced by the default.
 *
 * Stored page JSON is hand-editable and will one day be member-written, so a
 * value is never trusted to be one of the options just because the type says
 * so — the same posture as `coerceProps` in @elkdonis/blocks.
 */
export function lookAttributes(look: SectionLook = {}): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const prop of LOOK_PROPS) {
    const value = look[prop.name];
    const known = prop.options.some((o) => o.value === value);
    attrs[`data-${prop.name.toLowerCase()}`] = known ? (value as string) : prop.default;
  }
  return attrs;
}
