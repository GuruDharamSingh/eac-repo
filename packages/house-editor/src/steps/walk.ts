import type { PageDoc, PageNode } from "./types";

// Walks a document's blocks, slots included. Pure.

const isNode = (x: unknown): x is PageNode =>
  !!x && typeof x === "object" && typeof (x as PageNode).type === "string" && !!(x as PageNode).props && typeof (x as PageNode).props === "object";

/** A slot's value: a list of blocks. An empty list counts (an empty slot looks like any empty list). */
export const isSlotList = (v: unknown): v is PageNode[] => Array.isArray(v) && v.every(isNode);

/** Every block of the page, depth first, parents before children. */
export function eachNode(doc: Pick<PageDoc, "content">, visit: (node: PageNode) => void): void {
  const go = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list) {
      if (!isNode(n)) continue;
      visit(n);
      for (const v of Object.values(n.props)) if (isSlotList(v) && v.length) go(v);
    }
  };
  go(doc.content);
}

export function findNode(doc: Pick<PageDoc, "content">, id: unknown): PageNode | null {
  if (typeof id !== "string" || !id) return null;
  let hit: PageNode | null = null;
  eachNode(doc, (n) => {
    if (!hit && n.props.id === id) hit = n;
  });
  return hit;
}

/** Block types on the page that are not in `known`. */
export function unknownTypes(doc: Pick<PageDoc, "content">, known: (type: string) => boolean): string[] {
  const out = new Set<string>();
  eachNode(doc, (n) => {
    if (!known(n.type)) out.add(n.type);
  });
  return [...out];
}

/** True when every block has a string id (Puck gives every saved block one). */
export function allHaveIds(doc: Pick<PageDoc, "content">): boolean {
  let ok = true;
  eachNode(doc, (n) => {
    if (typeof n.props.id !== "string" || !n.props.id) ok = false;
  });
  return ok;
}

/** The page with one block's props replaced (the block may sit in a slot). Every other block is the same object. */
export function replaceProps(doc: PageDoc, id: string, props: Record<string, unknown>): PageDoc {
  const go = (list: PageNode[]): PageNode[] => {
    let changed = false;
    const out = list.map((n) => {
      if (n.props.id === id) {
        changed = true;
        return { ...n, props };
      }
      let next = n.props;
      for (const [k, v] of Object.entries(n.props)) {
        if (isSlotList(v) && v.length) {
          const inner = go(v);
          if (inner !== v) next = { ...next, [k]: inner };
        }
      }
      if (next === n.props) return n;
      changed = true;
      return { ...n, props: next };
    });
    return changed ? out : list;
  };
  const content = go(doc.content);
  return content === doc.content ? doc : { ...doc, content };
}

/** How many blocks on the page carry this id (a page should have one; a pasted or hand-edited one may have two). */
export function countId(doc: Pick<PageDoc, "content">, id: string): number {
  let n = 0;
  eachNode(doc, (node) => {
    if (node.props.id === id) n++;
  });
  return n;
}
