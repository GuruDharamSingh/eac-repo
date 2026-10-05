// ============================================================================
// Which item of a block a piece of its markup draws.
//
// A picture wall is one block holding a list of pictures (a `rows` prop). On
// the editor's canvas, clicking one picture should open THAT picture's fields,
// not the whole block's. The editor cannot tell which row an element came
// from — a block may filter, sort or rearrange its rows before drawing them —
// so the block says so itself, with an attribute on the element that draws
// the row:
//
//     <li {...editItem("pictures", row)}>…</li>
//
// For a `rows` prop the item is the index in the stored rows array, not the
// position on screen. For any other prop it is whatever key that prop's
// editor control understands — the Gallery grid's "Pictures" field takes a
// gallery item id and shows only that picture (useFocusedItem in
// @elkdonis/page-builder). The editor side is page-builder
// drag/item-focus.tsx. On a published page the attribute is inert.
//
// Client components import this through "@elkdonis/blocks/edit-item", so
// they do not pull the whole catalogue into the browser bundle.
// ============================================================================

export const EDIT_ITEM_ATTR = "data-edit-item";

/** Attributes marking an element as the drawing of item `item` of prop `prop`. */
export function editItem(prop: string, item: number | string): Record<string, string> {
  return { [EDIT_ITEM_ATTR]: `${prop}:${item}` };
}

/** The reverse of `editItem`; null for anything malformed. */
export function parseEditItem(value: string | null | undefined): { prop: string; key: string } | null {
  if (!value) return null;
  const at = value.indexOf(":");
  if (at <= 0 || at === value.length - 1) return null;
  return { prop: value.slice(0, at), key: value.slice(at + 1) };
}
