import { itemsFor, type ShownItem } from "@/blocks/mobile/phone-menu-logic";
import { viewerLike } from "./mobile-buttons";

// The server side of m-phone-menu (2026-11-21): the items this person may see. Server only. The decision is made from
// the session here; the block draws only what comes back.
export async function shownMenu(items: unknown): Promise<ShownItem[]> {
  return itemsFor(items, await viewerLike());
}
