import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { MTourListView } from "./m-tour-list.client";
import type { MobileTourRow } from "./types";

// ============================================================================
// m-tour-list (G2): the phone Tours list, screen 02. A search box that filters titles as you type, type chips,
// and one card per tour (arch picture, "type · duration", title, guide, next date, price). The words around the
// data (chip labels, placeholder, "with", the empty line) are the owner's. The tours themselves are locked: the
// resolver reads them (lib/puck/mobile-data.ts) and they are never stored. Declaration here, interactive half
// behind its own "use client" module (see blocks/contact-form).
// ============================================================================

const props = [
  { name: "showSearch", kind: "boolean", label: "Show the search box", default: false },
  { name: "showChips", kind: "boolean", label: "Show the type chips", default: false },
  { name: "searchPlaceholder", kind: "string", label: "Search placeholder", default: "Search walks, ateliers, museums", inlineEditable: true },
  { name: "chipAll", kind: "string", label: "Chip: all", default: "All", inlineEditable: true },
  { name: "chipWalks", kind: "string", label: "Chip: walks", default: "Walks", inlineEditable: true },
  { name: "chipAteliers", kind: "string", label: "Chip: ateliers", default: "Ateliers", inlineEditable: true },
  { name: "chipMuseums", kind: "string", label: "Chip: museums", default: "Museums", inlineEditable: true },
  { name: "chipFood", kind: "string", label: "Chip: food and markets", default: "Food & markets", inlineEditable: true },
  { name: "chipPrivate", kind: "string", label: "Chip: private", default: "Private", inlineEditable: true },
  { name: "withLabel", kind: "string", label: "Word before the guide", default: "with", inlineEditable: true },
  { name: "onRequestLabel", kind: "string", label: "Price when there is none", default: "On request", inlineEditable: true },
  { name: "emptyText", kind: "string", label: "When nothing matches", default: "Nothing matches that yet.", inlineEditable: true },
] as const;

export type MTourListProps = PropsOf<typeof props> & {
  /** From the resolver. Never stored. */
  rows?: MobileTourRow[] | null;
  count?: number | null;
};

export function MTourList(p: MTourListProps) {
  return <MTourListView {...p} />;
}

export const mTourList = defineBlock(
  {
    id: "m-tour-list",
    category: "content",
    label: "Phone tour list",
    description: "Search box, type chips and the tours as cards, as on the phone Tours page.",
    memberSafe: true,
    dataDriven: true,
    interactive: true,
    styling: "tokens",
    props,
    parts: {
      root: { label: "Tour list", sel: "> .blk-mtl" },
      search: { label: "Search box", sel: ".blk-mtl-search" },
      chips: { label: "Chips", sel: ".blk-mtl-chips" },
      chipAll: { label: "Chip: all", sel: ".blk-mtl-chip-all", prop: "chipAll" },
      chipWalks: { label: "Chip: walks", sel: ".blk-mtl-chip-walks", prop: "chipWalks" },
      chipAteliers: { label: "Chip: ateliers", sel: ".blk-mtl-chip-ateliers", prop: "chipAteliers" },
      chipMuseums: { label: "Chip: museums", sel: ".blk-mtl-chip-museums", prop: "chipMuseums" },
      chipFood: { label: "Chip: food and markets", sel: ".blk-mtl-chip-food", prop: "chipFood" },
      chipPrivate: { label: "Chip: private", sel: ".blk-mtl-chip-private", prop: "chipPrivate" },
      card: { label: "Tour card", sel: ".blk-mtl-card" },
      thumb: { label: "Picture", sel: ".blk-mtl-thumb" },
      cardTitle: { label: "Tour title", sel: ".blk-mtl-title" },
      price: { label: "Price", sel: ".blk-mtl-price" },
      empty: { label: "Empty line", sel: ".blk-mtl-empty", prop: "emptyText" },
    },
  },
  MTourList,
  () => ({
    showSearch: false, showChips: false, searchPlaceholder: "Search walks, ateliers, museums", chipAll: "All", chipWalks: "Walks", chipAteliers: "Ateliers", chipMuseums: "Museums", chipFood: "Food & markets", chipPrivate: "Private", withLabel: "with", onRequestLabel: "On request", emptyText: "Nothing matches that yet.",
    rows: [{ id: "s1", slug: "sample", title: "A walk through the old quarter", typeKey: "walk", typeLabel: "Walk", duration: "2 h 30", guide: "Dana", nextLabel: "Sat 21 Nov, 10:00", priceLabel: "€45", img: null }],
  })
);
