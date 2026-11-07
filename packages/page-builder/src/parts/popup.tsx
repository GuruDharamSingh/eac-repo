"use client";

import type { ReactNode, SyntheticEvent } from "react";
import { ActionBar, createUsePuck, useGetPuck } from "@puckeditor/core";
import { sanitizeRichValues } from "@elkdonis/blocks";
import { resolverKeysFor } from "../config";
import { closeItemFocus } from "../drag/item-focus";
import { blockWrapper } from "./find";
import { canvasDocument, endSpell, recordStep, selectPart } from "./store";
import type { BlockPopupHandle, PartsPluginOptions } from "./types";

// ============================================================================
// The block popup's door in Puck Studio (2026-11-06, docs/open/
// EDIT_LOOK_POPUP_BRIEF_2026-11-06.md). "Edit look" in a block's action bar,
// or a double-click on the block, hands that one block to the host's popup
// (direct-edit's `openStudioPopup`), mounted over Studio's window, outside the
// canvas iframe. A double-click on a Puck inline field stays Puck's typing.
//
// Out: the node as stored, with the props its resolvers fill taken out and
// passed beside it, so the popup draws Puck's own rows and never hands them
// back as page content. In, on "Use on this page": the edited node with those
// rows put back, as one `replace` with `recordHistory: false` and one history
// entry (store.ts `recordStep`), so one undo in Studio reverts the whole popup
// session. Then Puck's own `resolveDataById(id, "replace")`: a plain dispatch
// runs no resolver, and a setting the popup changed may be one a resolver
// reads. Discard dispatches nothing.
// ============================================================================

const usePuck = createUsePuck();
type GetPuck = ReturnType<typeof useGetPuck>;
type Node = { type: string; props: Record<string, unknown> & { id: string } };

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isNode = (v: unknown): v is Node =>
  !!v && typeof v === "object" && typeof (v as Node).type === "string" && !!(v as Node).props && typeof (v as Node).props === "object" && typeof (v as Node).props.id === "string";
const holdsNodes = (v: unknown): v is unknown[] => Array.isArray(v) && v.some(isNode);

/** The node with each node's resolver-filled props taken out, into `out` by id. */
function split(node: Node, out: Record<string, Record<string, unknown>>): Node {
  const keys = resolverKeysFor(node.type);
  const props: Record<string, unknown> = {};
  const filled: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.props)) {
    if (k !== "id" && keys?.has(k)) filled[k] = v;
    else props[k] = holdsNodes(v) ? v.map((x) => (isNode(x) ? split(x, out) : x)) : v;
  }
  if (Object.keys(filled).length) out[node.props.id] = filled;
  return { type: node.type, props: props as Node["props"] };
}

/** The reverse: the rows Puck held go back on every node that kept its id. */
function join(node: Node, rows: Record<string, Record<string, unknown>>): Node {
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.props)) props[k] = holdsNodes(v) ? v.map((x) => (isNode(x) ? join(x, rows) : x)) : v;
  const filled = own(rows, node.props.id) ? rows[node.props.id] : undefined;
  return { type: node.type, props: { ...props, ...(filled ?? {}) } as Node["props"] };
}

/** The element that holds the page's root zone in the canvas: its classes (fonts, theme) are the page's. */
function scopeOf(wrapper: HTMLElement): HTMLElement {
  let top: HTMLElement | null = null;
  for (let z = wrapper.closest<HTMLElement>("[data-puck-dropzone]"); z; z = z.parentElement?.closest<HTMLElement>("[data-puck-dropzone]") ?? null) top = z;
  return top?.parentElement ?? wrapper.ownerDocument.querySelector<HTMLElement>("[data-puck-entry]") ?? wrapper.ownerDocument.body;
}

let current: BlockPopupHandle | null = null;
export const blockPopupOpen = () => current !== null;

/** Opens block `id` in the host's popup. False when it cannot (no popup, a block the contract does not list, one open already). */
export function openBlockPopupFor(getPuck: GetPuck, options: PartsPluginOptions, id: string): boolean {
  if (current || !options.popup) return false;
  const puck = getPuck();
  const item = puck.getItemById(id) as Node | undefined;
  const doc = canvasDocument();
  const wrapper = doc ? blockWrapper(doc, id) : null;
  if (!item || !own(options.contract, item.type) || !wrapper) return false;
  endSpell();
  selectPart(null);
  closeItemFocus();
  const resolved: Record<string, Record<string, unknown>> = {};
  const node = split(item, resolved);
  const data = puck.appState.data as { root?: { props?: Record<string, unknown> } & Record<string, unknown> };
  const root = (data.root?.props ?? data.root ?? {}) as Record<string, unknown>;
  const label = (puck.config.components[item.type] as { label?: string } | undefined)?.label ?? item.type;
  try {
    current = options.popup({
      id,
      type: item.type,
      label,
      node,
      resolved,
      root,
      scope: scopeOf(wrapper),
      width: wrapper.getBoundingClientRect().width,
      developer: !!options.developer,
      cleanRich: (html) => sanitizeRichValues(html),
      use(edited) {
        const { dispatch, getItemById, getSelectorForId } = getPuck();
        const now = getItemById(id);
        const where = getSelectorForId(id);
        if (!now || !where || !isNode(edited)) return;
        const back = join({ type: item.type, props: { ...edited.props, id } as Node["props"] }, resolved);
        dispatch({ type: "replace", destinationIndex: where.index, destinationZone: where.zone, data: { ...now, props: back.props } as never, recordHistory: false });
        recordStep(getPuck);
        void getPuck().resolveDataById(id, "replace");
      },
      closed() {
        current = null;
      },
    });
  } catch (e) {
    current = null;
    console.error("The block popup did not open", e);
    return false;
  }
  return true;
}

/** Puck's action bar with "Edit look" before its own actions, on a block the contract lists. */
export function LookActionBar({ label, children, parentAction, options }: { label?: string; children: ReactNode; parentAction: ReactNode; options: PartsPluginOptions }) {
  const getPuck = useGetPuck();
  const type = usePuck((s) => (s.selectedItem as { type?: string } | null)?.type);
  const can = !!options.popup && !!type && own(options.contract, type);
  return (
    <ActionBar>
      <ActionBar.Group>
        {parentAction}
        {label ? <ActionBar.Label label={label} /> : null}
      </ActionBar.Group>
      <ActionBar.Group>
        {can ? (
          <ActionBar.Action
            label="Edit look"
            onClick={(e: SyntheticEvent) => {
              e.stopPropagation();
              const id = (getPuck().selectedItem as Node | null)?.props.id;
              if (id) openBlockPopupFor(getPuck, options, id);
            }}
          >
            <svg data-eac-edit-look="" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21l3-1 11-11-2-2L4 18l-1 3z" />
              <path d="M14 6l2-2 4 4-2 2" />
            </svg>
          </ActionBar.Action>
        ) : null}
        {children}
      </ActionBar.Group>
    </ActionBar>
  );
}
