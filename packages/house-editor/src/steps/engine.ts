import { createReducer } from "@puckeditor/core/internal";
import type { PageDoc, PageNode } from "./types";
import { isSlotList } from "./walk";

// ============================================================================
// The only file that touches Puck's own document reducer.
//
// `createReducer` comes from "@puckeditor/core/internal": exported, undocumented,
// pinned at 0.24.0 (the package version is exact in package.json). Re-run
// scripts/check-steps.mts on every Puck upgrade; it is the proof that insert,
// duplicate, move and remove still behave here as they do in the editor.
//
// How it is driven (verified on 0.24.0, ~/scratch/manjushri/mj-headless.mts):
//   a bare private state, `setData` to build Puck's index of the page, then one action.
// The reducer is not trusted with bytes. It reorders a block's props, drops a
// document's own extra keys and fills defaults, so its answer is only used for
// STRUCTURE: which blocks sit in which zone, and the new ids. `graft` puts every
// block that was already on the page back as the original object it was.
// ============================================================================

export type Zone = string;
export const ROOT_ZONE: Zone = "root:default-zone";

interface IndexedNode {
  data: PageNode;
  path: string[];
  parentId: string | null;
  zone: string | null;
}
interface State {
  data: PageDoc;
  ui: unknown;
  indexes: { nodes: Record<string, IndexedNode>; zones: Record<string, { contentIds: string[]; type: string }> };
}

type Config = { components?: Record<string, { fields?: Record<string, { type?: string; allow?: string[]; disallow?: string[] }> }> };

export interface Where {
  zone: Zone;
  index: number;
  parentId: string | null;
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export class Engine {
  private state: State;
  private reduce: (s: State, a: unknown) => State;

  constructor(private readonly config: Config, doc: PageDoc) {
    this.reduce = createReducer({ appStore: { config } as never }) as unknown as (s: State, a: unknown) => State;
    const bare: State = {
      data: { root: { props: {} }, content: [] },
      ui: { itemSelector: null, arrayState: {}, componentList: {} },
      indexes: { nodes: {}, zones: {} },
    };
    // setData warns once per call about its own cost; the warning is not ours to print.
    const warn = console.warn;
    console.warn = () => {};
    try {
      this.state = this.reduce(bare, { type: "setData", data: structuredClone(doc) });
    } finally {
      console.warn = warn;
    }
  }

  /** The reducer's answer. Structure only: see `graft`. */
  get data(): PageDoc {
    return this.state.data;
  }

  /** An indexed block by id. Own keys only: a zone named "constructor:x" must not find Object's. */
  private node(id: string): IndexedNode | undefined {
    return has(this.state.indexes.nodes, id) ? this.state.indexes.nodes[id] : undefined;
  }

  /** Where a block sits now, or null. */
  where(id: string): Where | null {
    const n = this.node(id);
    if (!n || id === "root") return null;
    const zone = n.path[n.path.length - 1];
    const z = zone && has(this.state.indexes.zones, zone) ? this.state.indexes.zones[zone] : undefined;
    const index = z ? z.contentIds.indexOf(id) : -1;
    return zone && index >= 0 ? { zone, index, parentId: n.parentId ?? null } : null;
  }

  /** The slot's blocks count, or null when `zone` is not a zone of this page. */
  zoneLength(zone: Zone): number | null {
    if (zone === ROOT_ZONE) return this.state.data.content.length;
    const cut = zone.indexOf(":");
    if (cut < 1) return null;
    const owner = this.node(zone.slice(0, cut));
    const slot = zone.slice(cut + 1);
    if (!owner) return null;
    const comps = this.config.components;
    const fields = comps && has(comps, owner.data.type) ? comps[owner.data.type]!.fields : undefined;
    if (!fields || !has(fields, slot) || fields[slot]!.type !== "slot") return null;
    const list = owner.data.props[slot];
    return Array.isArray(list) ? list.length : 0;
  }

  /** The block that owns `zone`, or null for the root. */
  ownerOf(zone: Zone): string | null {
    return zone === ROOT_ZONE ? null : zone.slice(0, zone.indexOf(":"));
  }

  /** Is `id` the block `maybeAncestor`, or somewhere inside it? */
  isInside(id: string, maybeAncestor: string): boolean {
    if (id === maybeAncestor) return true;
    const n = this.node(id);
    return !!n && n.path.some((p) => p.slice(0, p.indexOf(":")) === maybeAncestor);
  }

  /** A slot's allow and disallow lists, as the block declared them. */
  slotRules(zone: Zone): { allow?: string[]; disallow?: string[] } {
    const owner = this.ownerOf(zone);
    const node = owner ? this.node(owner) : undefined;
    const comps = this.config.components;
    const fields = node && comps && has(comps, node.data.type) ? comps[node.data.type]!.fields : undefined;
    const slot = zone.slice(zone.indexOf(":") + 1);
    const field = fields && has(fields, slot) ? fields[slot] : undefined;
    return { allow: field?.allow, disallow: field?.disallow };
  }

  insert(type: string, zone: Zone, index: number): void {
    this.state = this.reduce(this.state, { type: "insert", componentType: type, destinationIndex: index, destinationZone: zone });
  }
  duplicate(zone: Zone, index: number): void {
    this.state = this.reduce(this.state, { type: "duplicate", sourceIndex: index, sourceZone: zone });
  }
  move(from: Where, zone: Zone, index: number): void {
    this.state = this.reduce(this.state, { type: "move", sourceIndex: from.index, sourceZone: from.zone, destinationIndex: index, destinationZone: zone });
  }
  remove(zone: Zone, index: number): void {
    this.state = this.reduce(this.state, { type: "remove", index, zone });
  }
}

/** The block types Puck's config knows. */
export const configHas = (config: unknown, type: string): boolean =>
  !!(config as Config)?.components && Object.prototype.hasOwnProperty.call((config as Config).components, type);

/** Every block that carries an id, by id. */
function byId(list: unknown, into: Map<string, PageNode>): void {
  if (!Array.isArray(list)) return;
  for (const n of list as PageNode[]) {
    if (!n?.props) continue;
    if (typeof n.props.id === "string") into.set(n.props.id, n);
    for (const v of Object.values(n.props)) if (isSlotList(v) && v.length) byId(v, into);
  }
}

/**
 * The page the reducer arranged, with every block that was already on it put back as the original object.
 * A block keeps its own props, in their own order; only a slot's list of children follows the reducer.
 * A block the reducer made (an insert, a duplicate and its children) is taken as it is.
 */
export function graft(original: PageDoc, reduced: PageDoc): PageDoc {
  const before = new Map<string, PageNode>();
  byId(original.content, before);
  const rebuild = (node: PageNode): PageNode => {
    const id = node.props.id;
    const was = typeof id === "string" ? before.get(id) : undefined;
    if (!was) return node;
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(was.props)) {
      const now = node.props[key];
      const old = was.props[key];
      props[key] = Array.isArray(now) && isSlotList(now) && isSlotList(old) ? now.map(rebuild) : old;
    }
    // A slot the block did not have before and now holds a block.
    for (const key of Object.keys(node.props)) {
      const now = node.props[key];
      if (!(key in props) && isSlotList(now) && now.length) props[key] = now.map(rebuild);
    }
    return { ...was, props };
  };
  return { ...original, content: reduced.content.map(rebuild) };
}

/** Ids on the page after a step that were not there before. */
export function newIds(before: PageDoc, after: PageDoc): string[] {
  const a = new Map<string, PageNode>();
  const b = new Map<string, PageNode>();
  byId(before.content, a);
  byId(after.content, b);
  return [...b.keys()].filter((k) => !a.has(k));
}
