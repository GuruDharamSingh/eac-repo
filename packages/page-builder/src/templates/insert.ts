import type { Data } from "@puckeditor/core";
import type { Section } from "@elkdonis/blocks/sections";
import { instantiate } from "./instantiate";

// ============================================================================
// Add a section to a page.
//
// A section is a few ordinary blocks as data. Adding one copies them with fresh ids and puts them in the page right
// AFTER the block that is selected (in the same list: the page, or the slot that block sits in), or at the end of the
// page when nothing is selected. One new document, so one setData and one undo step. After that the blocks are the
// page's own: nothing links them back to the section.
//
// The one trace is `_section` on each inserted top-level block: the section id, kept so use can be counted later.
// Blocks ignore it when they draw; page-builder `validatePage` and direct-edit `cleanBoxDoc` pass unknown props of
// other blocks through (box/words/picture nodes keep only their own props, so the mark would be dropped there; shared
// sections do not use them). Pure: no editor, no DOM.
// ============================================================================

export const SECTION_MARK = "_section";

/** Which top-level nodes are "bands": containers whose `slot` holds the page's real content. App-supplied, never guessed. */
export interface WrapIn {
  types: string[];
  slot: string;
}

export interface Selector {
  index: number;
  zone?: string;
}

type Node = Data["content"][number];
type Props = Record<string, unknown>;

const isNode = (v: unknown): v is Node => !!v && typeof v === "object" && "type" in v && "props" in v;
const isSlot = (v: unknown): v is Node[] => Array.isArray(v) && v.length > 0 && v.every(isNode);

/** Put `add` into the slot `parentId:slotName` at `index`. Returns null when that slot is not found. */
function intoSlot(list: Node[], parentId: string, slot: string, index: number, add: Node[]): Node[] | null {
  let found = false;
  const next = list.map((node) => {
    if (found) return node;
    const props = node.props as Props;
    if (props.id === parentId) {
      const current = Array.isArray(props[slot]) ? (props[slot] as Node[]) : [];
      const at = Math.max(0, Math.min(current.length, index));
      found = true;
      return { ...node, props: { ...props, [slot]: [...current.slice(0, at), ...add, ...current.slice(at)] } } as Node;
    }
    for (const [key, value] of Object.entries(props)) {
      if (!isSlot(value)) continue;
      const inner = intoSlot(value, parentId, slot, index, add);
      if (inner) {
        found = true;
        return { ...node, props: { ...props, [key]: inner } } as Node;
      }
    }
    return node;
  });
  return found ? next : null;
}

export interface Placed {
  data: Data;
  /** Every id given out, nested ones included (for asking data blocks to fetch). */
  ids: string[];
  /** The first inserted top-level block, to select. */
  firstId: string | null;
}

/**
 * The page with the section's blocks added after `selected` (or at the end of the page).
 *
 * With `wrapIn` (the app's band type and slot): a selected top-level band takes the blocks at the end of its slot, and
 * when nothing usable is selected and the page's top level is non-empty and all bands, they go at the end of the LAST
 * band's slot instead of outside it. Without `wrapIn`, nothing changes.
 */
export function placeSection(data: Data, section: Section, selected: Selector | null | undefined, wrapIn?: WrapIn): Placed {
  const ids: string[] = [];
  const tops = instantiate(section.blocks, ids);
  for (const n of tops) (n.props as Props)[SECTION_MARK] = section.id;
  const firstId = tops.length ? ((tops[0].props as Props).id as string) : null;
  const root = data.content ?? [];

  const isBand = (n: Node | undefined) => !!n && !!wrapIn && wrapIn.types.includes(n.type as string);
  const intoBandAt = (i: number): Placed | null => {
    const band = root[i];
    const bandId = (band?.props as Props | undefined)?.id;
    if (!wrapIn || typeof bandId !== "string") return null;
    const placed = intoSlot(root, bandId, wrapIn.slot, Number.MAX_SAFE_INTEGER, tops);
    return placed ? { data: { ...data, content: placed }, ids, firstId } : null;
  };

  if (selected) {
    const zone = selected.zone ?? "root:default-zone";
    if (zone.startsWith("root:")) {
      if (isBand(root[selected.index])) {
        const inBand = intoBandAt(selected.index);
        if (inBand) return inBand;
      }
      const at = Math.max(0, Math.min(root.length, selected.index + 1));
      return { data: { ...data, content: [...root.slice(0, at), ...tops, ...root.slice(at)] }, ids, firstId };
    }
    const cut = zone.lastIndexOf(":");
    const placed = intoSlot(root, zone.slice(0, cut), zone.slice(cut + 1), selected.index + 1, tops);
    if (placed) return { data: { ...data, content: placed }, ids, firstId };
  }
  if (wrapIn && root.length > 0 && isBand(root[root.length - 1])) {
    const inBand = intoBandAt(root.length - 1);
    if (inBand) return inBand;
  }
  return { data: { ...data, content: [...root, ...tops] }, ids, firstId };
}
