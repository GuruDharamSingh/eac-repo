// ============================================================================
// Experiment (2026-11-06): "a larger container for both editors", with rails.
//
// One document, two rooms, one writer at a time. The house owns the bottom strip
// (both editors draw their own bars at the top):
//   Arrange  = Puck's editor (page-builder PuckEditor) with the parts plugin
//   Shape    = direct-edit's canvas (mountTreePage)
// The house owns the document. Only the open room may change it. Switching
// rooms is a handoff with three rails:
//   1. the leaving room hands over its whole document, which the house cleans
//      the same way a save does (resolver rows stripped, cleanBoxDoc);
//   2. the house refuses the handoff if any prop of a block that survives the
//      move disappeared (one editor silently dropping what the other wrote);
//   3. each handoff is logged (from, to, blocks, a short hash), so an undo
//      across rooms is "go back to that handoff" rather than two undo stacks.
// ============================================================================

import { createElement as h, Fragment, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { resolveAllData, useGetPuck, type Plugin } from "@puckeditor/core";
import { PuckEditor } from "/app/packages/page-builder/src/editor";
import { puckConfig, canvasConfig, canvasContract } from "/app/apps/sunjay/src/lib/puck/config.client";
import { RESOLVED_KEYS, stripResolved } from "/app/apps/sunjay/src/blocks/resolved-keys";
import { mountTreePage } from "/app/packages/direct-edit/src/puck/index";
import { cleanBoxDoc } from "/app/packages/direct-edit/src/block/puck-tree";
import seed from "/app/packages/direct-edit/harness/sunjay-try-page.json";
import { partsPlugin } from "./parts-plugin";

type Doc = { root: { props?: Record<string, unknown> }; content: Node[] };
type Node = { type: string; props: Record<string, unknown> & { id: string } };
type Room = "arrange" | "shape";
const g = globalThis as any;

// The hidden `morph` field comes from buildPuckConfig (2026-11-06).
const arrangeConfig = puckConfig;

// ── Rails ───────────────────────────────────────────────────────────────────

/** Every node, by id, wherever it sits (slots included). */
function nodesOf(doc: Doc): Map<string, Node> {
  const out = new Map<string, Node>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const n = v as Node;
    if (typeof n.type === "string" && n.props && typeof n.props.id === "string") out.set(n.props.id, n);
    Object.values(n.props ?? (v as object)).forEach((x) => { if (x && typeof x === "object") walk(x); });
  };
  walk(doc.content);
  return out;
}

/** What a save keeps: no resolver rows, no Puck read-only marks, own blocks cleaned. */
export function settle(doc: Doc): Doc {
  const plain = JSON.parse(JSON.stringify(doc, (k, v) => (k === "readOnly" ? undefined : v)));
  return cleanBoxDoc(stripResolved(plain)) as Doc;
}

/** Rail 2: a block that is still there must still have every prop it had. */
export function dropped(before: Doc, after: Doc): string[] {
  const a = nodesOf(before), b = nodesOf(after), out: string[] = [];
  for (const [id, n] of a) {
    const m = b.get(id);
    if (!m) continue; // deleted in the room: allowed
    for (const key of Object.keys(n.props)) if (!(key in m.props) && n.props[key] !== undefined && n.props[key] !== "") out.push(`${id}.${key}`);
  }
  return out;
}

const hash = (s: string) => { let x = 5381; for (let i = 0; i < s.length; i++) x = (x * 33) ^ s.charCodeAt(i); return (x >>> 0).toString(36); };

/** Rows for the Shape room, read the way Para Theater's CanvasEditor does: never stored. */
function rowsOf(filled: Doc): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [id, n] of nodesOf(filled)) {
    const keys = RESOLVED_KEYS[n.type];
    if (keys) out[id] = Object.fromEntries(keys.filter((k) => k in n.props).map((k) => [k, n.props[k]]));
  }
  return out;
}

// ── Rooms ───────────────────────────────────────────────────────────────────

type Reader = { current: (() => Doc) | null };

function ArrangeRoom({ doc, reader }: { doc: Doc; reader: Reader }) {
  // The room's only door out: the house reads Puck's current data when it switches.
  const door: Plugin = { name: "door", overrides: { puck: ({ children }: any) => h(Fragment, null, h(Door, { reader }), children) } } as any;
  return h(PuckEditor, { slug: "try", orgId: "sunjay", initial: doc as any, config: arrangeConfig as any, onPublish: async () => ({ ok: true }), plugins: [partsPlugin(canvasContract as any), door] });
}
function Door({ reader }: { reader: Reader }) {
  const getPuck = useGetPuck();
  g.__getPuck = getPuck;
  reader.current = () => getPuck().appState.data as unknown as Doc;
  return null;
}

function ShapeRoom({ doc, reader }: { doc: Doc; reader: Reader }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let handle: ReturnType<typeof mountTreePage> | null = null, stop = false;
    (async () => {
      const filled = (await resolveAllData(doc as any, canvasConfig as any, { orgId: "sunjay", slug: "try" }).catch(() => doc)) as unknown as Doc;
      if (stop || !host.current) return;
      handle = mountTreePage({ host: host.current, config: canvasConfig as any, contract: canvasContract as any, doc: doc as any, resolved: rowsOf(filled),
        metadata: { orgId: "sunjay", slug: "try" }, pageName: "Try", onSave: async () => ({ ok: true }) } as any);
      g.__shape = handle;
      reader.current = () => handle!.doc() as unknown as Doc;
    })();
    return () => { stop = true; reader.current = null; handle?.dispose(); g.__shape = null; };
  }, [doc, reader]);
  return h("div", { ref: host, style: { position: "absolute", inset: 0, overflow: "auto" } });
}

// ── The house ───────────────────────────────────────────────────────────────

function House() {
  const [doc, setDoc] = useState<Doc>(() => settle(seed as unknown as Doc));
  const [room, setRoom] = useState<Room>("arrange");
  const [note, setNote] = useState("");
  const reader = useRef<() => Doc>(null) as Reader;
  const log = useRef<Array<{ from: Room; to: Room; blocks: number; hash: string }>>([]);
  g.__house = { room, doc, log: log.current, dropped, settle };

  const switchTo = (to: Room) => {
    if (to === room || !reader.current) return;
    const handed = settle(reader.current());          // rail 1
    const lost = dropped(doc, handed);                 // rail 2
    if (lost.length) { setNote(`Not switched: ${room === "arrange" ? "Arrange" : "Shape"} would drop ${lost.slice(0, 3).join(", ")}`); return; }
    log.current.push({ from: room, to, blocks: nodesOf(handed).size, hash: hash(JSON.stringify(handed)) }); // rail 3
    setNote(`Handed ${nodesOf(handed).size} blocks from ${room === "arrange" ? "Arrange" : "Shape"}`);
    setDoc(handed);
    setRoom(to);
  };

  const tab = (r: Room, label: string) => h("button", { type: "button", "data-room": r, "aria-pressed": room === r, onClick: () => switchTo(r),
    style: { font: "600 13px system-ui", padding: "6px 14px", borderRadius: 999, border: "1px solid #c9ced6", background: room === r ? "#1f2a44" : "#fff", color: room === r ? "#fff" : "#1f2a44" } }, label);

  return h(Fragment, null,
    h("div", { "data-house-bar": "", style: { position: "fixed", inset: "auto 0 0 0", height: 44, zIndex: 2147483646, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "#f4f5f7", borderTop: "1px solid #dde1e7", font: "13px system-ui" } },
      tab("arrange", "Arrange (Puck)"), tab("shape", "Shape (canvas)"),
      h("span", { "data-house-note": "", style: { marginLeft: 12, color: "#555" } }, note)),
    h("div", { key: room, style: { position: "fixed", inset: "0 0 44px 0" } },
      room === "arrange"
        // PuckEditor fixes itself to the window; a transform makes this box its containing block.
        ? h("div", { style: { position: "absolute", inset: 0, transform: "translateZ(0)" } }, h(ArrangeRoom, { doc, reader }))
        : h(ShapeRoom, { doc, reader })));
}

createRoot(document.getElementById("host")!).render(h(House));
