// ============================================================================
// The node tree of a block (pass 3, 2026-11-02). A block is a root container
// (the ad, the card) holding nodes; a node is a leaf (words, a picture, a
// divider) or a container (a box laid out as a stack or a grid) holding more
// nodes. The tree stores structure only: { id, kind, kids }. A node's style and
// words live beside it, keyed by its id (the host's overrides), so a template
// can define a tree and a block can override one node's look without copying
// the rest, and a block that never changed its structure stores no tree at all.
//
// Pure functions, no DOM. Every structural edit in an editor goes through
// these, and every stored tree goes through cleanTree on the server.
// ============================================================================

export interface TreeNode { id: string; kind: string; kids?: TreeNode[] }

export interface KindRule {
  /** Holds other nodes. */
  container?: boolean;
  /** Kinds it may hold (default: every non-root kind). */
  accepts?: readonly string[];
}

export interface TreeRules {
  /** Every kind the host knows, the root's included. */
  kinds: Record<string, KindRule>;
  /** The root container's kind (its kids are the tree, at depth 1). */
  root: string;
  /** Deepest allowed node (root kids are depth 1). */
  maxDepth: number;
  maxNodes: number;
  /** Valid node ids. Must not admit "__proto__" or similar. */
  idRe: RegExp;
  /** Ids that must carry one kind (legacy fixed parts: "title" is always a title). */
  fixed?: Record<string, string>;
}

export interface Found { node: TreeNode; parent: TreeNode | null; siblings: TreeNode[]; index: number; depth: number }

/** Visit every node, parents before children. Return false from fn to skip a node's kids. */
export function walk(tree: TreeNode[], fn: (n: TreeNode, parent: TreeNode | null, depth: number) => void | boolean, parent: TreeNode | null = null, depth = 1): void {
  for (const n of tree) {
    if (fn(n, parent, depth) === false) continue;
    if (n.kids) walk(n.kids, fn, n, depth + 1);
  }
}

export function findNode(tree: TreeNode[], id: string): Found | null {
  let out: Found | null = null;
  const go = (list: TreeNode[], parent: TreeNode | null, depth: number): boolean => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i]!;
      if (n.id === id) { out = { node: n, parent, siblings: list, index: i, depth }; return true; }
      if (n.kids && go(n.kids, n, depth + 1)) return true;
    }
    return false;
  };
  go(tree, null, 1);
  return out;
}

export function treeIds(tree: TreeNode[]): string[] {
  const out: string[] = [];
  walk(tree, (n) => { out.push(n.id); });
  return out;
}

export function countNodes(tree: TreeNode[]): number { return treeIds(tree).length; }

/** Levels below and including this node (a leaf is 1). */
export function subtreeDepth(n: TreeNode): number {
  return 1 + (n.kids && n.kids.length ? Math.max(...n.kids.map(subtreeDepth)) : 0);
}

/** Is `id` inside the subtree of `ancestor` (or the same node)? */
export function within(tree: TreeNode[], ancestor: string, id: string): boolean {
  const a = findNode(tree, ancestor);
  if (!a) return false;
  if (ancestor === id) return true;
  return !!a.node.kids && !!findNode(a.node.kids, id);
}

/** The kids array of a container (null = the root), or null when it is not a container. */
export function kidsOf(tree: TreeNode[], parentId: string | null): TreeNode[] | null {
  if (parentId === null) return tree;
  const f = findNode(tree, parentId);
  if (!f) return null;
  if (!f.node.kids) return null;
  return f.node.kids;
}

/** Depth of a container's kids (root kids = 1). */
export function depthOfKids(tree: TreeNode[], parentId: string | null): number {
  if (parentId === null) return 1;
  const f = findNode(tree, parentId);
  return f ? f.depth + 1 : 1;
}

/** Take a node (and its subtree) out. Mutates; returns it. */
export function removeNode(tree: TreeNode[], id: string): TreeNode | null {
  const f = findNode(tree, id);
  if (!f) return null;
  f.siblings.splice(f.index, 1);
  return f.node;
}

/** Put a node into a container at `index` (clamped). Mutates. */
export function insertNode(tree: TreeNode[], parentId: string | null, index: number, node: TreeNode): boolean {
  const kids = kidsOf(tree, parentId);
  if (!kids) return false;
  kids.splice(Math.max(0, Math.min(kids.length, index)), 0, node);
  return true;
}

/**
 * Move a node into a container at `index`, where `index` counts the
 * container's kids WITHOUT the moved node (what a drop indicator shows).
 * Refuses to move a node into itself or its own subtree. Mutates.
 */
export function moveNode(tree: TreeNode[], id: string, parentId: string | null, index: number): boolean {
  if (parentId !== null && within(tree, id, parentId)) return false;
  if (!kidsOf(tree, parentId)) return false;
  const n = removeNode(tree, id);
  if (!n) return false;
  return insertNode(tree, parentId, index, n);
}

/** Wrap a node in a new container placed where it was. Mutates. */
export function wrapNode(tree: TreeNode[], id: string, box: TreeNode): boolean {
  const f = findNode(tree, id);
  if (!f) return false;
  f.siblings.splice(f.index, 1, { ...box, kids: [f.node] });
  return true;
}

/** Replace a container by its kids, in place. Mutates. */
export function unwrapNode(tree: TreeNode[], id: string): boolean {
  const f = findNode(tree, id);
  if (!f || !f.node.kids) return false;
  f.siblings.splice(f.index, 1, ...f.node.kids);
  return true;
}

export const cloneTree = (t: TreeNode[]): TreeNode[] => t.map((n) => ({ id: n.id, kind: n.kind, ...(n.kids ? { kids: cloneTree(n.kids) } : {}) }));

/** Same structure (ids, kinds, nesting, order)? */
export function sameTree(a: TreeNode[] | undefined, b: TreeNode[] | undefined): boolean {
  return JSON.stringify(a ? cloneTree(a) : null) === JSON.stringify(b ? cloneTree(b) : null);
}

/** May a node of `kind`, whose subtree is `levels` deep, go into a container of `parentKind` whose kids sit at `depth`? */
export function canPlace(rules: TreeRules, kind: string, parentKind: string, depth: number, levels = 1, maxDepth = rules.maxDepth): boolean {
  const p = rules.kinds[parentKind];
  if (!p?.container || !rules.kinds[kind] || kind === rules.root) return false;
  if (p.accepts && !p.accepts.includes(kind)) return false;
  return depth + levels - 1 <= Math.min(maxDepth, rules.maxDepth);
}

/**
 * Server-side validation of a stored tree: known kinds only, valid and unique
 * ids, fixed ids keep their kind, kids only on containers and only of kinds
 * the container accepts, depth and size capped. Bad nodes are dropped with
 * their subtrees; the rest is kept in order. Returns undefined for non-arrays.
 */
export function cleanTree(v: unknown, rules: TreeRules): TreeNode[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  let count = 0;
  const go = (list: unknown[], parentKind: string, depth: number): TreeNode[] => {
    const out: TreeNode[] = [];
    if (depth > rules.maxDepth) return out;
    for (const raw of list.slice(0, rules.maxNodes)) {
      if (count >= rules.maxNodes) break;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const r = raw as Record<string, unknown>;
      const id = typeof r.id === "string" && rules.idRe.test(r.id) ? r.id : null;
      const kind = typeof r.kind === "string" && Object.prototype.hasOwnProperty.call(rules.kinds, r.kind) ? r.kind : null;
      if (!id || !kind || kind === rules.root || seen.has(id)) continue;
      if (rules.fixed && Object.prototype.hasOwnProperty.call(rules.fixed, id) && rules.fixed[id] !== kind) continue;
      if (!canPlace(rules, kind, parentKind, depth)) continue;
      seen.add(id);
      count++;
      const node: TreeNode = { id, kind };
      if (rules.kinds[kind]!.container) node.kids = Array.isArray(r.kids) ? go(r.kids, kind, depth + 1) : [];
      out.push(node);
    }
    return out;
  };
  return go(v, rules.root, 1);
}
