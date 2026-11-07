"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { sampleKeysOf, type EditorContract } from "../block/contract";
import type { PuckDoc, PuckNode, SlotMap } from "../block/puck-tree";
import type { PictureChooser } from "../canvas/edit-shell";
import { mountTreeEditor, type NestedEditor, type TreeEditorHandle } from "../canvas/tree-editor";
import type { Binding, RecordSources } from "../canvas/records";
import { TreeCanvas, type TreeConfig } from "./TreeCanvas";

// ============================================================================
// A stored Puck page in the box editor: draws it with the host's own catalogue
// and hands structure edits to tree-editor. The same `config` a published page
// uses, so what is arranged here is what ships.
// ============================================================================

export interface TreePageOptions {
  host: HTMLElement;
  /** The host's Puck config. Use the published shape (buildPuckConfig): the editor shape's chrome needs Puck's own context. */
  config: TreeConfig & { components: Record<string, unknown> };
  doc: PuckDoc;
  /** Rows resolvers fetched, by node id. Never saved. */
  resolved?: Record<string, Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  onSave(doc: PuckDoc): Promise<{ ok: boolean; error?: string }>;
  onDone?(): void;
  /** Said once before the first save, with a way out. Not asked inside the popup: nothing is public there. */
  saveNotice?: string;
  choosePicture?: PictureChooser;
  blockEditorHref?: string;
  pageName?: string;
  onRestore?(): void;
  /** What each sealed block declares (contractOf). Absent: as before. */
  contract?: EditorContract;
  /** This mount is the popup's (canvas/popup.ts). */
  nested?: NestedEditor;
  /** The developer tools (tree-editor `developer`): only `false` removes them. */
  developer?: boolean;
  /** The host's sanitiser for rich text typed in place (tree-editor `cleanRich`). */
  cleanRich?(html: string): string;
  /**
   * Choosing records for props declared `binds` (2026-11-06): the drawer's lists and what a value draws. Needs a contract.
   * What the stored values drew when the page was opened comes in `resolved`, under each node's id.
   */
  records?: RecordSources;
  /** Shared by the popup's mount and the page's. Hosts leave it out. */
  boundCache?: Map<string, Record<string, unknown> | null>;
}

type Described = { label?: string; defaultProps?: Record<string, unknown>; fields?: Record<string, { type?: string; allow?: readonly string[] }>; permissions?: { insert?: boolean } };

/** Which props of each block are slots, read from its Puck fields. */
export function slotsOf(config: { components: Record<string, unknown> }): SlotMap {
  const out: Record<string, Array<{ name: string; allow?: readonly string[] }>> = {};
  for (const [type, c] of Object.entries(config.components)) {
    const list = Object.entries((c as Described).fields ?? {}).filter(([, f]) => f?.type === "slot").map(([name, f]) => ({ name, allow: f.allow }));
    if (list.length) out[type] = list;
  }
  return out;
}

const cacheKey = (type: string, prop: string, value: string) => `${type}\n${prop}\n${value}`;

/** Each node's props that hold a reference the host can choose, by block type. */
function boundPropsOf(o: TreePageOptions): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!o.records || !o.contract) return out;
  for (const [type, c] of Object.entries(o.contract)) {
    const names = c.props.filter((p) => p.group && p.binds && o.records!.handles(p.binds)).map((p) => p.name);
    if (names.length) out.set(type, names);
  }
  return out;
}

function eachNode(list: unknown, fn: (n: PuckNode) => void) {
  if (!Array.isArray(list)) return;
  for (const n of list as PuckNode[]) {
    if (!n || typeof n !== "object" || typeof n.type !== "string" || !n.props) continue;
    fn(n);
    for (const v of Object.values(n.props)) if (Array.isArray(v)) eachNode(v, fn);
  }
}

export function mountTreePage(o: TreePageOptions): TreeEditorHandle {
  const root = createRoot(o.host);
  // What a bound prop's value draws, looked up by value before each draw (canvas/records.ts). The page's own rows stay under `resolved`.
  const bound = boundPropsOf(o);
  const cache = o.boundCache ?? new Map<string, Record<string, unknown> | null>();
  const resolved: Record<string, Record<string, unknown>> = { ...(o.resolved ?? {}) };
  if (bound.size && !o.boundCache) {
    eachNode(o.doc.content, (n) => {
      const names = bound.get(n.type);
      const have = o.resolved?.[n.props.id];
      if (!names || !have) return;
      for (const name of names) { const v = n.props[name]; if (typeof v === "string" && v) cache.set(cacheKey(n.type, name, v), have); }
    });
  }
  const syncBound = (doc: PuckDoc) => {
    if (!bound.size) return;
    eachNode(doc.content, (n) => {
      const names = bound.get(n.type);
      if (!names) return;
      const id = n.props.id;
      let drawn: Record<string, unknown> | null = null;
      for (const name of names) {
        const v = n.props[name];
        const got = typeof v === "string" && v ? cache.get(cacheKey(n.type, name, v)) : null;
        if (got) drawn = { ...(drawn ?? {}), ...got };
      }
      if (drawn) resolved[id] = drawn;
      else delete resolved[id];
    });
  };
  const binding: Binding | undefined = o.records && bound.size ? {
    records: o.records,
    drawn: (type, prop, value) => cache.get(cacheKey(type, prop, value)),
    remember: (type, prop, value, drawn) => { cache.set(cacheKey(type, prop, value), drawn); },
  } : undefined;
  const zones = new Map();
  const slots = slotsOf(o.config);
  const labels: Record<string, string> = {};
  const catalogue: Array<{ type: string; label: string; defaults: Record<string, unknown> }> = [];
  for (const [type, c] of Object.entries(o.config.components)) {
    const d = c as Described;
    labels[type] = d.label ?? type;
    if (d.permissions?.insert !== false) catalogue.push({ type, label: d.label ?? type, defaults: d.defaultProps ?? {} });
  }
  // Drawn beside the document, never written into it. Undefined with no contract, so that host's canvas is as before.
  const samples = o.contract && Object.fromEntries(Object.entries(o.contract).filter(([, c]) => Object.keys(c.sample).length > 0).map(([type, c]) => [type, c.sample as Record<string, unknown>]));
  let version = 0;
  const draw = (doc: PuckDoc) => {
    version++;
    syncBound(doc);
    // The editor measures the page right after this returns.
    flushSync(() => root.render(createElement(TreeCanvas, { config: o.config, doc, slots, resolved, samples, version, metadata: o.metadata, zones })));
  };
  const drawsSample = (n: PuckNode) => sampleKeysOf(o.contract, n.type).length > 0 && !resolved[n.props.id];
  // The popup is this same mount on a working copy of one block. Only with a contract, and never inside itself.
  const mountNested: Parameters<typeof mountTreeEditor>[0]["mountNested"] = o.contract && !o.nested
    ? (m) => mountTreePage({ ...o, resolved, boundCache: cache, host: m.stage, doc: m.doc, pageName: m.name, nested: m.nested, onSave: m.onSave, onDone: undefined, onRestore: undefined, blockEditorHref: undefined, saveNotice: undefined })
    : undefined;
  const editor = mountTreeEditor({ doc: o.doc, slots, scope: o.host, draw, labels, catalogue, contract: o.contract, drawsSample, onSave: o.onSave, saveNotice: o.saveNotice, onDone: o.onDone, choosePicture: o.choosePicture, blockEditorHref: o.blockEditorHref, pageName: o.pageName, onRestore: o.onRestore, nested: o.nested, mountNested, developer: o.developer, cleanRich: o.cleanRich, binding });
  return {
    ...editor,
    dispose() {
      editor.dispose();
      // Not during a React commit: the host may be unmounting too.
      setTimeout(() => root.unmount(), 0);
    },
  };
}
