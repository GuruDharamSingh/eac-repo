import { applyStep, type BlockContractLike, type PageDoc } from "./steps";

// ============================================================================
// The Content tab's writer (2026-11-21, PLAN 9 step A). direct-edit's canvas is plain DOM and cannot import this package, so it
// is handed this function: given a block and a setting's new value, the value the one door (`set_prop`) would keep, or why not.
// The step runs on a page of just that block, so another block's trouble never refuses this one's change. The canvas writes
// the answer as one undo step, and Puck's sheet, typing on the page and this panel all end in the same prop.
// ============================================================================

type Node = { type: string; props: Record<string, unknown> };

export function contentDoor(contracts: unknown): (node: Node, name: string, value: unknown) => { ok: true; value: unknown } | { ok: false; say: string } {
  return (node, name, value) => {
    if (!contracts || typeof node.props.id !== "string") return { ok: true, value };
    const doc: PageDoc = { root: { props: {} }, content: [{ type: node.type, props: node.props }] };
    const r = applyStep(doc, { op: "set_prop", block: node.props.id, prop: name, value }, { contracts: contracts as Readonly<Record<string, BlockContractLike>> });
    if (!r.ok) return { ok: false, say: r.say };
    return { ok: true, value: r.doc.content[0]?.props[name] };
  };
}
