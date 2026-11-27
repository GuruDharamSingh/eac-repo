"use client";

import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { sampleKeysOf, type EditorContract } from "../block/contract";
import type { PuckDoc, PuckNode, SlotMap } from "../block/puck-tree";
import type { PictureChooser } from "../canvas/edit-shell";
import { mountTreeEditor, type NestedEditor, type TreeEditorHandle, type TreeEditorOptions } from "../canvas/tree-editor";
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
  /** A page switcher in the canvas's page menu (tree-editor `pages`). Absent: as before. */
  pages?: TreeEditorOptions["pages"];
  /** Free placement: a Free move tool in the canvas (tree-editor `freeMove`). Absent: as before. */
  freeMove?: boolean;
  /** Style against look (tree-editor `blkStyleDecls`): the host's `blkStyle` reader. Absent: as before. */
  blkStyleDecls?: TreeEditorOptions["blkStyleDecls"];
  /** What each sealed block declares (contractOf). Absent: as before. */
  contract?: EditorContract;
  /** This mount is the popup's (canvas/popup.ts). */
  nested?: NestedEditor;
  /** The developer tools (tree-editor `developer`): only `false` removes them. */
  developer?: boolean;
  /** Figma basics: multiple selection, top and left handles, snapping (tree-editor `designTools`). Absent: as before. */
  designTools?: boolean;
  /** Starting layouts offered in Add (tree-editor `presets`). Absent: as before. */
  presets?: TreeEditorOptions["presets"];
  /**
   * A sealed block's settings in the host's editor (tree-editor `editSettings`, 2026-11-11): the new props, and the rows
   * its resolver draws with them where the block sits (by node id, like `resolved`; never saved). Absent: as before.
   */
  editSettings?(node: PuckNode): Promise<{ props: Record<string, unknown>; resolved?: Record<string, unknown> | null } | null>;
  /** The Content tab: a block's settings first in the side panel (tree-editor `contentTab`). Absent: as before. */
  contentTab?: boolean;
  /** The host's checked door for a setting (tree-editor `setProp`). Used with `contentTab`. */
  setProp?: TreeEditorOptions["setProp"];
  /**
   * The rows a data block's resolver draws with these props, by node (like `editSettings`' `resolved`; never saved). Asked after a
   * setting of the block changed in the Content tab. Absent: the rows stay as they were.
   */
  resolveRows?(node: PuckNode): Promise<Record<string, unknown> | null>;
  /** A live site page: drawn scaled beside the panel, not narrowed by it (tree-editor `fitToPanel`). Set by openPageAsTree and openVisitorPage. */
  fitToPanel?: TreeEditorOptions["fitToPanel"];
  /** Buttons the host adds to the edit bar (e.g. "Site style") and what they do. */
  barExtras?: TreeEditorOptions["barExtras"];
  onBarExtra?: TreeEditorOptions["onBarExtra"];
  /** What the panel says about a live part, by name (tree-editor `liveNote`). */
  liveNote?: TreeEditorOptions["liveNote"];
  /**
   * Inception (2026-11-14, tree-editor `inception`): `editSettings` also inside the block popup and from a part's menu,
   * each layer over the last (canvas/stack.ts), the selection handed back on close. Absent: as before.
   */
  inception?: boolean;
  /** The zoomed popup (tree-editor `largeView`): default OFF. Words that come from a record (tree-editor `recordWords`). */
  largeView?: boolean;
  recordWords?: TreeEditorOptions["recordWords"];
  /** The host's sanitiser for rich text typed in place (tree-editor `cleanRich`). */
  cleanRich?(html: string): string;
  /**
   * Choosing records for props declared `binds` (2026-11-06): the drawer's lists and what a value draws. Needs a contract.
   * What the stored values drew when the page was opened comes in `resolved`, under each node's id.
   */
  records?: RecordSources;
  /** Shared by the popup's mount and the page's. Hosts leave it out. */
  boundCache?: Map<string, Record<string, unknown> | null>;
  /** What a block drew with each set of its settings (editSettings), shared by the popup's mount and the page's, so a setting changed inside the popup draws its rows on the page too. Hosts leave it out. */
  settingsCache?: Map<string, Map<string, Record<string, unknown> | null>>;
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
      // An empty value is cached too: for some kinds "" draws a row (a service: the visitor's ?service=, else the newest).
      for (const name of names) { const v = n.props[name]; if (typeof v === "string") cache.set(cacheKey(n.type, name, v), have); }
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
        const got = typeof v === "string" ? cache.get(cacheKey(n.type, name, v)) : null;
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
  // What a block drew with each set of settings it has had in this session, so undo and redo draw the right rows (editSettings).
  const settingsRows = o.settingsCache ?? new Map<string, Map<string, Record<string, unknown> | null>>();
  const settingsKey = (p: Record<string, unknown>) => JSON.stringify(Object.keys(p).filter((k) => k !== "id" && k !== "morph").sort().map((k) => [k, p[k]]));
  const syncSettings = (doc: PuckDoc) => {
    if (!settingsRows.size) return;
    eachNode(doc.content, (n) => {
      const rows = settingsRows.get(n.props.id)?.get(settingsKey(n.props));
      if (rows === undefined) return;
      if (rows) resolved[n.props.id] = rows;
      else delete resolved[n.props.id];
    });
  };
  const editSettings: TreeEditorOptions["editSettings"] = o.editSettings && (!o.nested || o.inception)
    ? async (node) => {
      const id = node.props.id;
      const was = settingsRows.get(id) ?? new Map<string, Record<string, unknown> | null>();
      if (!was.has(settingsKey(node.props))) was.set(settingsKey(node.props), resolved[id] ?? null);
      const r = await o.editSettings!(node);
      if (!r) return null;
      was.set(settingsKey(r.props), r.resolved ?? null);
      settingsRows.set(id, was);
      return r.props;
    }
    : undefined;
  // The Content tab's settings change a data block's rows too: resolved again, remembered by settings like editSettings' rows.
  const resolveRows: TreeEditorOptions["resolveRows"] = o.contentTab && o.resolveRows && (!o.nested || o.inception)
    ? async (node, before) => {
      const id = node.props.id;
      const was = settingsRows.get(id) ?? new Map<string, Record<string, unknown> | null>();
      if (before && !was.has(settingsKey(before))) was.set(settingsKey(before), resolved[id] ?? null);
      const rows = await o.resolveRows!(node);
      was.set(settingsKey(node.props), rows ?? null);
      settingsRows.set(id, was);
    }
    : undefined;
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
    syncSettings(doc);
    // The editor measures the page right after this returns.
    flushSync(() => root.render(createElement(TreeCanvas, { config: o.config, doc, slots, resolved, samples, version, metadata: o.metadata, zones })));
  };
  const drawsSample = (n: PuckNode) => sampleKeysOf(o.contract, n.type).length > 0 && !resolved[n.props.id];
  // The popup is this same mount on a working copy of one block. Only with a contract, and never inside itself.
  const mountNested: Parameters<typeof mountTreeEditor>[0]["mountNested"] = o.largeView && o.contract && !o.nested
    ? (m) => mountTreePage({ ...o, resolved, boundCache: cache, host: m.stage, doc: m.doc, pageName: m.name, nested: m.nested, onSave: m.onSave, onDone: undefined, onRestore: undefined, blockEditorHref: undefined, saveNotice: undefined, editSettings: o.inception ? o.editSettings : undefined, settingsCache: o.inception ? settingsRows : undefined, resolveRows: o.inception ? o.resolveRows : undefined })
    : undefined;
  const editor = mountTreeEditor({ doc: o.doc, slots, scope: o.host, draw, labels, catalogue, contract: o.contract, drawsSample, onSave: o.onSave, saveNotice: o.saveNotice, onDone: o.onDone, choosePicture: o.choosePicture, blockEditorHref: o.blockEditorHref, pageName: o.pageName, onRestore: o.onRestore, pages: o.pages, nested: o.nested, mountNested, largeView: o.largeView, recordWords: o.recordWords, developer: o.developer, cleanRich: o.cleanRich, binding, presets: o.presets, editSettings, liveNote: o.liveNote, fitToPanel: o.fitToPanel, barExtras: o.barExtras, onBarExtra: o.onBarExtra, designTools: o.designTools, inception: o.inception, freeMove: o.freeMove, blkStyleDecls: o.blkStyleDecls, contentTab: o.contentTab, setProp: o.setProp, resolveRows });
  return {
    ...editor,
    dispose() {
      editor.dispose();
      // Not during a React commit: the host may be unmounting too.
      setTimeout(() => root.unmount(), 0);
    },
  };
}
