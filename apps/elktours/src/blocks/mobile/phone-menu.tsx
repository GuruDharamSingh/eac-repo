import { defineBlock, type PropsOf } from "@elkdonis/blocks";
import { WHO_OPTIONS } from "@/lib/puck/viewer-rank";
import { PhoneMenuView } from "./phone-menu.client";
import { DEFAULT_SHOW_ON, itemsFor, type ShownItem } from "./phone-menu-logic";

// ============================================================================
// m-phone-menu (2026-11-21): the sticky footer menu as a block, "mobile menu #2". The shell's own bar (GuestTabBar:
// Discover, Tours, Experiences, on the three root paths) keeps working untouched; this block draws the same bar from
// settings and, where it is on the page, the shell's bar steps aside (blocks.css). Who sees an item is decided on the
// server (lib/puck/mobile-menu.ts); the block draws only the items it was given.
// ============================================================================

const props = [
  {
    name: "shape",
    kind: "select",
    label: "Shape",
    default: "pill",
    options: [
      { value: "pill", label: "Floating pill (today)" },
      { value: "rounded", label: "Floating, softly rounded" },
      { value: "square", label: "Floating, square corners" },
      { value: "flat", label: "Flat bar along the bottom" },
    ],
  },
  {
    name: "items",
    kind: "rows",
    label: "Items",
    addLabel: "Add an item",
    summary: ["label", "to"],
    description: "Two to six. Empty: Discover, Tours, Experiences.",
    fields: [
      { name: "label", kind: "string", label: "Words", default: "" },
      { name: "to", kind: "string", label: "Where it goes", description: "A page of this site, like /tours.", default: "" },
      { name: "icon", kind: "select", label: "Icon", default: "none", options: ["none", "home", "compass", "star", "pin", "people", "chat", "user"].map((v) => ({ value: v, label: v === "none" ? "No icon (words only)" : v })) },
      { name: "who", kind: "select", label: "Who sees it", default: "everyone", options: WHO_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
    ],
  },
  {
    name: "showOn",
    kind: "list",
    label: "Pages it shows on",
    description: "One page per line, like /tours. End with /* for everything under it. Empty: /, /tours and /experiences.",
    default: DEFAULT_SHOW_ON,
  },
] as const;

export type MPhoneMenuProps = PropsOf<typeof props> & { shown?: ShownItem[] | null };

export const mPhoneMenu = defineBlock(
  {
    id: "m-phone-menu",
    category: "headers",
    label: "Phone menu (sticky footer)",
    description: "The bar fixed to the bottom of the phone screen: its shape, its items (words, icon, link, who sees it) and the pages it shows on.",
    memberSafe: true,
    dataDriven: true,
    interactive: true,
    styling: "tokens",
    props,
    reads: [
      { from: "viewer", what: "signed-in" },
      { from: "viewer", what: "role" },
      { from: "place", what: "placement" },
      { from: "site", what: "menu" },
    ],
  },
  ({ shape, showOn, shown }: MPhoneMenuProps) => <PhoneMenuView items={shown ?? []} shape={typeof shape === "string" ? shape : "pill"} showOn={Array.isArray(showOn) ? (showOn as string[]) : undefined} />,
  () => ({ shape: "pill", showOn: [...DEFAULT_SHOW_ON], shown: itemsFor(undefined, null) })
);
