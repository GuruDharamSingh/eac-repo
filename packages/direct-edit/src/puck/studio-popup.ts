"use client";

import type { EditorContract } from "../block/contract";
import type { PuckDoc, PuckNode } from "../block/puck-tree";
import { openBlockPopup, type PopupHandle } from "../canvas/popup";
import type { TreeConfig } from "./TreeCanvas";
import { mountTreePage } from "./mount";
import type { RecordSources } from "../canvas/records";

// ============================================================================
// The block popup opened from Puck Studio (2026-11-06, EDIT_LOOK_POPUP_BRIEF).
//
// The second door into canvas/popup.ts: the canvas opens it from its own tree
// (tree-editor `openLarge`); here page-builder's parts plugin hands over one
// node read from Puck, and gets the edited node back once, on "Use on this
// page". Nothing reaches Puck before that, so Discard leaves its data as it was.
// The popup and its editor are the canvas's, unchanged: a second mountTreePage
// on a working copy `{ root, content: [node] }`, drawn with the host's
// published-shape config and the rows Puck's resolvers already fetched.
//
// No @puckeditor/core import: page-builder passes plain data and callbacks
// (`BlockPopupContext` in packages/page-builder/src/parts/types.ts), and this
// function is what a host passes it as the plugin's `popup`.
// ============================================================================

export interface StudioPopupContext {
  id: string;
  label: string;
  /** The node as stored: resolver-filled props are in `resolved`, by node id. */
  node: { type: string; props: Record<string, unknown> & { id: string } };
  /** Rows Puck's resolvers fetched, by node id (this node and the nodes in its slots). Drawn, never handed back. */
  resolved: Record<string, Record<string, unknown>>;
  /** The page's root props, for blocks that read them. */
  root: Record<string, unknown>;
  /** Where Studio draws the block's page now (an element in the canvas iframe): its classes carry over to the stage. */
  scope: HTMLElement;
  /** The block's width on the page, in the page's own pixels. */
  width: number;
  developer: boolean;
  cleanRich(html: string): string;
  /** "Use on this page": the edited node, once. */
  use(node: { type: string; props: Record<string, unknown> }): void;
  /** The popup is gone, whichever way it closed. */
  closed(): void;
}

export interface StudioPopupHost {
  /** The host's published-shape config (buildPuckConfig), as the canvas uses: the editor shape's chrome needs Puck's context. */
  config: TreeConfig & { components: Record<string, unknown> };
  contract: EditorContract;
  /** "From what?" for props declared `binds` (2026-11-06): the same chooser the canvas uses. Absent: such a prop is a text field. */
  records?: RecordSources;
}

/** Keys Puck binds on Studio's document (undo, redo, interactive mode): kept from it while the popup is open. Delete and Backspace Puck already refuses under a dialog. */
const PUCK_KEYS = new Set(["z", "y", "i"]);

export function openStudioPopup(host: StudioPopupHost, ctx: StudioPopupContext): PopupHandle {
  const id = ctx.node.props.id;
  const working: PuckDoc = { root: { props: JSON.parse(JSON.stringify(ctx.root ?? {})) }, content: [JSON.parse(JSON.stringify(ctx.node)) as PuckNode] };
  // Puck listens on Studio's document, after the popup's own capture listeners: stopping these at the body keeps Puck's undo out of the popup's.
  const keep = (ev: KeyboardEvent) => {
    if ((ev.ctrlKey || ev.metaKey) && PUCK_KEYS.has(ev.key.toLowerCase())) ev.stopPropagation();
  };
  document.body.addEventListener("keydown", keep);
  let handle: PopupHandle | null = null;
  handle = openBlockPopup({
    name: ctx.label,
    scope: ctx.scope,
    width: ctx.width,
    measure: (stage) => stage.querySelector<HTMLElement>(`[data-tree-node="${CSS.escape(id)}"]`),
    mount: (h) =>
      mountTreePage({
        host: h.stage,
        config: host.config,
        contract: host.contract,
        records: host.records,
        doc: working,
        resolved: ctx.resolved,
        pageName: ctx.label,
        developer: ctx.developer,
        cleanRich: ctx.cleanRich,
        nested: { chrome: h.chrome, layers: h.layers, blockId: id, fitWidth: h.fitWidth, applyZoom: h.applyZoom, onClose: h.close },
        async onSave(saved) {
          const node = saved.content?.[0];
          if (node && node.props?.id === id) ctx.use(node);
          // As the canvas's openLarge does.
          handle?.close();
          return { ok: true };
        },
      }),
    onClosed() {
      document.body.removeEventListener("keydown", keep);
      ctx.closed();
    },
  });
  return handle;
}
