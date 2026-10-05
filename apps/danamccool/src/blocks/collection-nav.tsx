import type { CSSProperties } from "react";
import { defineBlock, editItem, type PropsOf } from "@elkdonis/blocks";
import { sized, srcSet } from "./media";
import { parseLayout, placeTiles, tileKeys, type TileRow } from "./collection-nav-layout";

// ============================================================================
// Collections navigator — a page of doors into her collections.
//
// Each tile is a picture, a name and the page it leads to. Tiles are stored in
// the block itself (the page), not in a gallery: they point at pages, and a
// page's own navigation belongs to that page.
//
// They sit on the Gallery grid's 12-column grid, so a tile can be any size
// and anywhere: arranged by dragging and resizing in the "Arrange tiles"
// window (right column), which also frames each picture inside its tile.
// The published tiles are plain links on a CSS grid — no script, readable by
// search engines and screen readers, in the arranged reading order. On a
// narrow screen the arrangement gives way to two squares across.
//
// Names default to the menu's lettering (the Theme's menu face, weight,
// capitals and spacing), because these ARE navigation. The block's "Text
// style" (every block has one, at the foot of its fields) overrides that.
//
// In the editor a tile is not a link — clicking a link inside Puck's canvas
// navigates the canvas away (see the danamccool handover of 2026-09-18).
// ============================================================================

const POSITIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top", label: "Top" },
  { value: "top-right", label: "Top right" },
  { value: "left", label: "Middle left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom", label: "Bottom" },
  { value: "bottom-right", label: "Bottom right" },
] as const;

const props = [
  { name: "heading", kind: "string", label: "Heading", default: "" },
  {
    name: "tiles",
    kind: "rows",
    label: "Tile",
    addLabel: "Add a tile",
    summary: ["label", "link"],
    fields: [
      { name: "image", kind: "image", label: "Picture" },
      { name: "label", kind: "string", label: "Name", description: "The collection's name, shown on the picture.", default: "" },
      {
        name: "link",
        kind: "string",
        binds: "page-link",
        label: "Leads to",
        description: "One of her pages, or any address.",
        default: "",
      },
      // Not shown: a stable id so the arrangement follows the tile when rows are reordered.
      { name: "key", kind: "string", binds: "tile-key", label: "Tile id", default: "" },
    ],
  },
  {
    // Written by the Arrange window, never typed.
    name: "layout",
    kind: "string",
    binds: "tile-layout",
    label: "Arrangement",
    default: "",
  },
  {
    name: "perRow",
    kind: "select",
    label: "New tiles across",
    description: "Where a tile has not been arranged yet.",
    default: "3",
    options: [
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "6", label: "6" },
    ],
  },
  {
    name: "gap",
    kind: "select",
    label: "Space between tiles",
    default: "12",
    options: [
      { value: "0", label: "None — edge to edge" },
      { value: "2", label: "Hairline" },
      { value: "6", label: "Small" },
      { value: "12", label: "Medium" },
      { value: "20", label: "Roomy" },
      { value: "32", label: "Airy" },
    ],
  },
  { name: "labelAt", kind: "select", label: "Name position", default: "center", options: POSITIONS },
  {
    name: "labelShow",
    kind: "select",
    label: "Show names",
    description: "On a touch screen, which has no hover, names always show.",
    default: "always",
    options: [
      { value: "always", label: "Always" },
      { value: "hover", label: "When pointed at" },
    ],
  },
  {
    name: "labelSize",
    kind: "select",
    label: "Name size",
    default: "m",
    options: [
      { value: "s", label: "Small" },
      { value: "m", label: "Medium" },
      { value: "l", label: "Large" },
      { value: "xl", label: "Extra large" },
    ],
  },
  {
    name: "labelColor",
    kind: "string",
    format: "color",
    label: "Name colour",
    description: "Empty: white, on a shade.",
    default: "",
  },
  {
    name: "shade",
    kind: "select",
    label: "Shade behind the name",
    default: "soft",
    options: [
      { value: "none", label: "None" },
      { value: "soft", label: "Soft" },
      { value: "strong", label: "Strong" },
    ],
  },
] as const;

export type CollectionNavProps = PropsOf<typeof props> & {
  /** Puck's editor context, passed to every block; only `isEditing` is read. */
  puck?: { isEditing?: boolean };
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A same-site path or an http(s)/mailto address; anything else is not a link. */
function safeLink(v: unknown): string {
  const s = String(v ?? "").trim();
  if (s.startsWith("/")) return s.startsWith("//") ? "" : s;
  return /^(https?:\/\/|mailto:)/i.test(s) ? s : "";
}

export function CollectionNav({
  heading,
  tiles,
  layout,
  perRow = "3",
  gap = "12",
  labelAt = "center",
  labelShow = "always",
  labelSize = "m",
  labelColor = "",
  shade = "soft",
  puck,
}: CollectionNavProps) {
  const rows = ((tiles ?? []) as TileRow[]).filter((t) => typeof t.image === "string" && t.image.trim());
  const editing = Boolean(puck?.isEditing);

  if (rows.length === 0) {
    return editing ? (
      <p className="dm-cnav-empty">Add tiles in the right column: a picture, a name, and the page it leads to.</p>
    ) : null;
  }

  const keys = tileKeys(rows);
  const places = placeTiles(keys, parseLayout(layout), Number(perRow));
  // Reading order = what the eye sees: row by row, left to right.
  const order = rows
    // `r`: the tile's row in `tiles` (before empty ones were dropped), so a
    // click on it in the editor opens that row.
    .map((t, i) => ({ t, p: places[i]!, k: keys[i]!, r: (tiles as TileRow[]).indexOf(t) }))
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x);
  const ink = HEX.test(String(labelColor)) ? String(labelColor) : undefined;
  const gapPx = Number.isFinite(Number(gap)) ? Number(gap) : 12;

  return (
    <section
      className="dm-cnav"
      data-at={labelAt}
      data-show={labelShow}
      data-size={labelSize}
      data-shade={shade}
      style={{ "--cnav-gap": `${gapPx}px` } as CSSProperties}
    >
      {typeof heading === "string" && heading.trim() ? <h2 className="dm-cnav-title">{heading}</h2> : null}
      <ul className="dm-cnav-grid">
        {order.map(({ t, p, k, r }) => {
          const src = String(t.image);
          const label = String(t.label ?? "").trim();
          const link = safeLink(t.link);
          const at = `${p.fx ?? 50}% ${p.fy ?? 50}%`;
          const inner = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="dm-cnav-img"
                src={sized(src, 1024)}
                srcSet={srcSet(src)}
                // A tile spans w of 12 columns; on a phone, half the width.
                sizes={`(max-width: 560px) 50vw, ${Math.round((p.w / 12) * 100)}vw`}
                alt=""
                loading="lazy"
                style={{
                  objectPosition: at,
                  ...(p.zoom && p.zoom !== 1 ? { transform: `scale(${p.zoom})`, transformOrigin: at } : {}),
                }}
              />
              {label ? (
                <span className="dm-cnav-label" style={ink ? { color: ink } : undefined}>
                  <span className="dm-cnav-label-text">{label}</span>
                </span>
              ) : null}
            </>
          );
          return (
            <li
              key={k}
              className="dm-cnav-cell"
              {...editItem("tiles", r)}
              style={{ gridColumn: `${p.x + 1} / span ${p.w}`, gridRow: `${p.y + 1} / span ${p.h}` }}
            >
              {link && !editing ? (
                <a className="dm-cnav-tile" href={link} {...(label ? {} : { "aria-label": link })}>
                  {inner}
                </a>
              ) : (
                <div className="dm-cnav-tile">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export const collectionNav = defineBlock(
  {
    id: "dm-collection-nav",
    label: "Collections navigator",
    category: "listings",
    description:
      "Picture tiles that lead to her collection pages — arrange, resize and frame them freely; names in the menu's lettering.",
    memberSafe: true,
    styling: "tokens",
    props,
  },
  CollectionNav,
  () => ({
    heading: "",
    tiles: [],
    layout: "",
    perRow: "3" as const,
    gap: "12" as const,
    labelAt: "center" as const,
    labelShow: "always" as const,
    labelSize: "m" as const,
    labelColor: "",
    shade: "soft" as const,
  })
);
