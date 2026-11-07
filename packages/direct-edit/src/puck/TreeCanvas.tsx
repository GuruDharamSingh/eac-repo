"use client";

import { Component, createContext, createElement, useContext, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { hasOwn } from "../block/contract";
import { ROOT_ID, ROOT_SLOT, slotRulesOf, type PuckDoc, type PuckNode, type SlotMap } from "../block/puck-tree";

// ============================================================================
// Draws a Puck document in the editor with the same components the published
// page uses, and marks what the editor needs to find: each node's first element
// (`data-tree-node`) and each slot's element (`data-tree-slot="<id>:<name>"`).
//
// It stands in for Puck's <Render> only inside the editor. Puck's renderer gives
// no way to mark nodes without adding wrappers to the published markup; here a
// `display: contents` wrapper changes no layout and never ships. Slot components
// are cached by key, so an edit updates the page instead of remounting it.
// ============================================================================

interface PuckComponent { render: ComponentType<Record<string, unknown>> }
export interface TreeConfig { components: Record<string, PuckComponent | undefined>; root?: { render?: ComponentType<Record<string, unknown>> } }

interface Ctx {
  config: TreeConfig;
  doc: PuckDoc;
  slots: SlotMap;
  /** Props a resolver fetched (rows of a feed), by node id; never stored. */
  resolved: Record<string, Record<string, unknown>>;
  /** Rows to draw for a block with none resolved, by block type; never stored. Absent when the host passes no contract. */
  samples?: Record<string, Record<string, unknown>>;
  /** Counts draws. A block that failed is tried again on a new one. */
  version: number;
  metadata: Record<string, unknown>;
  zones: Map<string, ComponentType<{ as?: string | ComponentType<Record<string, unknown>>; className?: string; style?: CSSProperties }>>;
}
const TreeContext = createContext<Ctx | null>(null);

function listAt(ctx: Ctx, id: string, slot: string): PuckNode[] {
  if (id === ROOT_ID) return ctx.doc.content ?? [];
  let out: PuckNode[] = [];
  const go = (list: PuckNode[]) => {
    for (const n of list) {
      if (n.props.id === id) { const v = n.props[slot]; out = Array.isArray(v) ? (v as PuckNode[]) : []; return true; }
      for (const s of slotRulesOf(ctx.slots, n.type)) { const v = n.props[s.name]; if (Array.isArray(v) && go(v as PuckNode[])) return true; }
    }
    return false;
  };
  go(ctx.doc.content ?? []);
  return out;
}

function zoneFor(ctx: Ctx, id: string, slot: string) {
  const key = `${id}:${slot}`;
  let Zone = ctx.zones.get(key);
  if (!Zone) {
    Zone = function SlotZone({ as, className, style }) {
      const c = useContext(TreeContext)!;
      return createElement(as ?? "div" as never, { className, style, "data-tree-slot": key } as never, listAt(c, id, slot).map((n) => createElement(NodeView, { key: n.props.id, node: n })));
    };
    ctx.zones.set(key, Zone);
  }
  return Zone;
}

const NOT_A_BOX = new Set(["STYLE", "SCRIPT", "LINK", "TEMPLATE"]);
/** The first element that draws: a morphed block has its stylesheet and its marker before its root. */
const firstBox = (el: Element | null | undefined) => Array.from(el?.children ?? []).find((k) => !NOT_A_BOX.has(k.tagName)) as HTMLElement | undefined;

/** Marks a node's first element; a block that draws nothing shows its name, so it can still be selected. */
function NodeMark({ id, type, sealed, label, children }: { id: string; type: string; sealed: boolean; label: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(false);
  useLayoutEffect(() => {
    let first = firstBox(ref.current);
    // A wrapper with no box of its own stands for what is inside it.
    while (first && firstBox(first) && getComputedStyle(first).display === "contents") first = firstBox(first);
    if (!first) { if (!empty) setEmpty(true); return; }
    if (empty && first.dataset.treeEmpty === undefined && (ref.current?.children.length ?? 0) > 1) setEmpty(false);
    first.dataset.treeNode = id;
    first.dataset.treeType = type;
    if (sealed) first.dataset.treeSealed = ""; else delete first.dataset.treeSealed;
  });
  return createElement("div", { ref, style: { display: "contents" }, "data-tree-wrap": id }, children,
    empty ? createElement("div", { className: "de-tree-empty", "data-tree-empty": "" }, label) : null);
}

/** A block that throws draws a named box instead of blanking the page. Nodes are changed in place, so `version`, not node identity, is what lets it try again. */
class NodeBoundary extends Component<{ id: string; type: string; sealed: boolean; label: string; version: number; children?: ReactNode }, { failed: boolean; version: number }> {
  state = { failed: false, version: this.props.version };
  static getDerivedStateFromError() { return { failed: true }; }
  // In the render pass, not componentDidUpdate: a re-render of this class alone would not run NodeMark's layout effect, and the block that drew again would carry no mark.
  static getDerivedStateFromProps(props: { version: number }, state: { version: number }) { return props.version === state.version ? null : { failed: false, version: props.version }; }
  // The stand-in carries the node's mark itself: a block that throws after it mounted, from its own state update, fails this class alone, and NodeMark's layout effect does not run.
  render() { return this.state.failed ? createElement("div", { className: "de-tree-empty", "data-tree-standin": "", "data-tree-node": this.props.id, "data-tree-type": this.props.type, "data-tree-sealed": this.props.sealed ? "" : undefined }, `${this.props.label}: this block cannot draw here. It runs on the real site.`) : this.props.children; }
}

function NodeView({ node }: { node: PuckNode }) {
  const ctx = useContext(TreeContext)!;
  // By own key: a stored type called `constructor` is an unknown block, and `components.constructor` is a function.
  const Component = hasOwn(ctx.config.components, node.type) ? ctx.config.components[node.type] : undefined;
  const id = node.props.id;
  const slots = slotRulesOf(ctx.slots, node.type);
  if (!Component) return createElement("div", { "data-tree-node": id, "data-tree-type": node.type, "data-tree-sealed": "", className: "de-tree-empty" }, `Unknown block: ${node.type}`);
  const resolved = hasOwn(ctx.resolved, id) ? ctx.resolved[id] : undefined;
  const sample = ctx.samples && hasOwn(ctx.samples, node.type) ? ctx.samples[node.type] : undefined;
  const props: Record<string, unknown> = {
    ...node.props,
    // Resolved rows replace samples whole: what the editor's drawsSample reports must be all of what is drawn.
    ...(resolved ?? sample ?? {}),
    id,
    // The published shape, so blocks draw as they do for visitors; `boxEditing` is read only by this layer's own blocks.
    puck: { renderDropZone: () => null, metadata: ctx.metadata, dragRef: null, isEditing: false, boxEditing: true },
  };
  for (const s of slots) props[s.name] = zoneFor(ctx, id, s.name);
  const label = (Component as unknown as { label?: string }).label ?? node.type;
  const drawn = createElement(Component.render, props);
  // Only with a contract: a host with none draws as it did, and "It runs on the real site" would be false there.
  const sealed = slots.length === 0;
  return createElement(NodeMark, { id, type: node.type, sealed, label: ctx.samples ? `${label}: nothing to show yet` : label },
    ctx.samples ? createElement(NodeBoundary, { id, type: node.type, sealed, label, version: ctx.version }, drawn) : drawn);
}

export function TreeCanvas({ config, doc, slots, resolved = {}, samples, version, metadata = {}, zones }: { config: TreeConfig; doc: PuckDoc; slots: SlotMap; resolved?: Ctx["resolved"]; samples?: Ctx["samples"]; version: number; metadata?: Ctx["metadata"]; /** Keep one Map per mount. */ zones: Ctx["zones"] }) {
  const ctx: Ctx = { config, doc, slots, resolved, samples, version, metadata, zones };
  const Root = zoneFor(ctx, ROOT_ID, ROOT_SLOT);
  const body = createElement(Root);
  const RootRender = config.root?.render;
  const rootProps = (doc.root && typeof doc.root === "object" && "props" in doc.root ? (doc.root as { props?: Record<string, unknown> }).props : doc.root) as Record<string, unknown> | undefined;
  return createElement(TreeContext.Provider, { value: ctx }, RootRender ? createElement(RootRender, { ...(rootProps ?? {}), puck: { boxEditing: true, isEditing: false, metadata, dragRef: null, renderDropZone: () => null }, children: body }) : body);
}
