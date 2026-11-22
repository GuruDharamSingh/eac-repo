// Plain helpers on a stored page document, shared by the Sites screens and their check. No React, no database.
//
// A page is Puck JSON: `{ root: { props }, content: [ { type, props: { id, ... } } ] }`. A slot is any array of
// such nodes inside a block's props, so a block can hold blocks to any depth.

export interface DocNode {
  type: string;
  props: Record<string, unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNode = (v: unknown): v is DocNode => isObject(v) && typeof v.type === "string" && isObject(v.props);

export interface Listed {
  id: string;
  type: string;
  /** "content[0].items[1]": where the block sits. */
  path: string;
  depth: number;
  node: DocNode;
}

/** Every block of the page in page order, nested ones included. A block without a string id is named by its path. */
export function listBlocks(doc: unknown): Listed[] {
  const out: Listed[] = [];
  const walk = (list: unknown, path: string, depth: number) => {
    if (!Array.isArray(list) || depth > 40) return;
    list.forEach((n, i) => {
      if (!isNode(n)) return;
      const here = `${path}[${i}]`;
      out.push({ id: typeof n.props.id === "string" ? n.props.id : here, type: n.type, path: here, depth, node: n });
      for (const [k, v] of Object.entries(n.props)) if (Array.isArray(v) && v.some(isNode)) walk(v, `${here}.${k}`, depth + 1);
    });
  };
  if (isObject(doc)) walk(doc.content, "content", 0);
  return out;
}

/**
 * A copy of the page for DRAWING: a block this app cannot load becomes an `st-missing` block that says what it
 * was (nothing is dropped; the stored document is not touched), and a block that draws from the database gets its
 * example rows underneath whatever the page stores (the real rows are not read here).
 */
export function forDrawing(
  doc: unknown,
  has: (type: string) => boolean,
  sampleOf: (type: string) => Record<string, unknown> | null,
): { root: { props: Record<string, unknown> }; content: DocNode[] } {
  const d = isObject(doc) ? doc : {};
  const fix = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    return list.map((n) => {
      if (!isNode(n)) return n;
      if (!has(n.type)) return { type: "st-missing", props: { id: typeof n.props.id === "string" ? n.props.id : "missing", was: n.type } };
      const props: Record<string, unknown> = { ...(sampleOf(n.type) ?? {}), ...n.props };
      for (const [k, v] of Object.entries(props)) if (Array.isArray(v) && v.some(isNode)) props[k] = fix(v);
      return { type: n.type, props };
    });
  };
  const root = isObject(d.root) && isObject(d.root.props) ? { props: d.root.props } : { props: {} };
  return { root, content: (fix(d.content) as DocNode[]) ?? [] };
}

/**
 * Why a page cannot be published from this app, in plain words (empty: nothing in the way). `known` says whether a
 * block type is in a block list this app has. A page holding a block of no list, or still in Puck's old layout, is
 * refused whole: the door could not say what a change did to what it cannot read.
 */
export function publishProblems(doc: unknown, known: (type: string) => boolean): string[] {
  const out: string[] = [];
  const zones = isObject(doc) ? doc.zones : null;
  if (isObject(zones) && Object.keys(zones).length > 0) out.push("It uses an older page layout that this app cannot check.");
  const odd = [...new Set(listBlocks(doc).map((b) => b.type).filter((t) => t !== "st-missing" && !known(t)))];
  if (odd.length) out.push(`It holds blocks that are in no block list this app knows (${odd.slice(0, 4).join(", ")}${odd.length > 4 ? ", and more" : ""}), so it cannot say what a change would do to them.`);
  return out;
}
