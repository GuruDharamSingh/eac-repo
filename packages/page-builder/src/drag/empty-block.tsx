"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { registerOverlayPortal, useGetPuck, walkTree, type Data } from "@puckeditor/core";
import type { Block } from "@elkdonis/blocks";

// ============================================================================
// A block that draws nothing, made visible.
//
// Most blocks render nothing until they have content — a banner with no
// heading, a figure with no picture, a picture wall with no pictures — which
// is right on a published page. In the editor it was the single worst thing
// about dropping a block: new blocks arrive with EMPTY props (sample content
// is deliberately not a default, see config.tsx), so the drop "worked", the
// outline gained an entry, and the canvas showed nothing. Nothing to see,
// nothing to click, nothing to drag. It read as "the block didn't render".
//
// So in the editor only, a block whose output is empty is followed by a card
// saying what it is and what to do next. The check is on the DOM, not on the
// props: whether a block has "enough" to draw is the block's own business,
// and the only honest answer to "did it draw anything" is to look.
// ============================================================================

export interface EmptyBlockProps {
  id: string;
  block: Block<never>;
  children?: ReactNode;
}

/** Nothing drawn: no elements and no visible text. */
function isEmpty(el: HTMLElement): boolean {
  return el.childElementCount === 0 && !(el.textContent ?? "").trim();
}

/** A prop an author has not filled in yet. */
function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function EmptyBlock({ id, block, children }: EmptyBlockProps) {
  const body = useRef<HTMLSpanElement | null>(null);
  const [empty, setEmpty] = useState(false);

  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const check = () => setEmpty(isEmpty(el));
    check();
    // The canvas is an iframe; its own MutationObserver watches its own DOM.
    const View = el.ownerDocument.defaultView ?? window;
    const observer = new View.MutationObserver(check);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* `display: contents` — a probe, not a box. Layout is unchanged. */}
      <span ref={body} style={{ display: "contents" }}>
        {children}
      </span>
      {empty ? <Placeholder id={id} block={block} /> : null}
    </>
  );
}

function Placeholder({ id, block }: { id: string; block: Block<never> }) {
  const getPuck = useGetPuck();
  const button = useRef<HTMLButtonElement | null>(null);
  const def = block.def;

  // Sample content is offered as an explicit choice, never applied on drop.
  // Not for data-driven blocks: their sample ROWS are stand-ins for records,
  // and written into a page they would publish as though they were real.
  const canFill = !!block.sample && !def.dataDriven;

  useLayoutEffect(() => {
    // Everything inside a block is click-through in Puck's canvas (it owns
    // the pointer so the block can be selected and dragged). An overlay
    // portal is its sanctioned exception.
    if (!button.current) return;
    return registerOverlayPortal(button.current);
  }, [canFill]);

  const fill = useCallback(() => {
    const sample = (block.sample?.() ?? {}) as Record<string, unknown>;
    const { dispatch, config, getItemById, getSelectorForId } = getPuck();
    const current = (getItemById(id)?.props ?? {}) as Record<string, unknown>;
    // Only the blanks. Anything the author already typed stays theirs.
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(sample)) {
      if (isBlank(current[key]) && !isBlank(value)) patch[key] = value;
    }
    dispatch({
      type: "setData",
      data: (previous: Data) =>
        walkTree(previous, config, (content) =>
          content.map((node) =>
            (node.props as { id?: string })?.id === id ? { ...node, props: { ...node.props, ...patch } } : node
          )
        ),
    });
    const selector = getSelectorForId(id);
    if (selector) dispatch({ type: "setUi", ui: { itemSelector: selector } });
  }, [block, getPuck, id]);

  return (
    <div data-eac-empty-block="" className="eac-empty-block">
      <strong className="eac-empty-block-name">{def.label}</strong>
      {def.description ? <span className="eac-empty-block-about">{def.description}</span> : null}
      <span className="eac-empty-block-next">
        Nothing to show yet — select it and fill in its fields in the panel.
      </span>
      {canFill ? (
        <button
          ref={button}
          type="button"
          className="eac-empty-block-fill"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            fill();
          }}
        >
          Fill with example content
        </button>
      ) : null}
    </div>
  );
}
