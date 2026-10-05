"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Puck, useGetPuck, walkTree, type Config, type Data, type Plugin, type Viewports } from "@puckeditor/core";
import { textToHtml } from "@elkdonis/blocks";
// The declared public specifier, not the deep dist path — both resolve today,
// only one is a promise.
import "@puckeditor/core/puck.css";
// Our additions to the canvas and panels. Imported here, beside Puck's own
// sheet, so it is in the document when Puck mirrors the host's styles into
// the canvas iframe — see editor.css for what it fixes.
import "./editor.css";
import { blockDescription, resolverKeysFor } from "./config";
import { FocusedFields, ItemPicker } from "./drag/item-focus";
import { CanvasMenu } from "./drag/canvas-menu";

/**
 * The editor.
 *
 * Puck supplies the parts — a drawer of blocks, the canvas, the selected
 * block's fields, an outline, a viewport switcher — and this wires them to a
 * site's catalogue and its storage. The stock chrome is used deliberately:
 * Puck also exposes a composition API (`<Puck>` children + `usePuck`) for
 * building our own interface around the same engine, but that route also means
 * re-implementing the viewport/zoom canvas, which is NOT exported. Worth doing
 * when the chrome matters; not worth doing before the catalogue is worth
 * looking at.
 *
 * Publishing is an injected server action rather than anything this component
 * knows how to do. A client component is not an authorisation boundary, so the
 * role check belongs in the action, on the server, where it cannot be skipped
 * by anyone who can open dev tools.
 */
export interface PuckEditorProps {
  slug: string;
  initial: Data;
  config: Config;
  /** Ambient context for blocks and resolvers. `orgId` and `slug` are added. */
  metadata?: Record<string, unknown>;
  onPublish: (slug: string, data: Data) => Promise<{ ok: boolean; error?: string }>;
  orgId: string;
  /**
   * Extra tabs for the editor's left rail, beside Blocks and Outline — the
   * site's own panels (its pages, galleries, media…). Puck always keeps its
   * default tabs and appends these. Each needs a `name`, `label`, `icon` and
   * `render`; inside `render`, `useGetPuck()` reaches the editor's state.
   */
  plugins?: Plugin[];
  /** Shown as the header title. Defaults to the page's public address. */
  title?: string;
  /**
   * Replace Puck's default phone/tablet/desktop switcher with the exact
   * space this document will actually occupy — a store panel renders inside
   * a fixed, bounded section of an org's own page, not a whole page of
   * unknown width. Passing this makes the editor's canvas the REAL box
   * rather than an approximation of it; what fits here fits there.
   *
   * This alone enforces nothing at RENDER time — that is the host page's own
   * CSS container. It only stops the person designing for space they were
   * never going to have.
   */
  viewports?: Viewports;
  /**
   * Save without publishing. When given, the header gets a "Save draft"
   * button beside Publish, for a host whose Publish goes live at once
   * (ArtDirect's person pages) and so needs a way to keep work that is not
   * ready. Omitted, the header is unchanged and Publish is the only save.
   */
  onSaveDraft?: (slug: string, data: Data) => Promise<{ ok: boolean; error?: string }>;
  /** Status shown after a successful Publish. Default "Published". */
  publishedLabel?: string;
}

export function PuckEditor({
  slug,
  initial: stored,
  config,
  metadata,
  onPublish,
  orgId,
  plugins,
  title,
  viewports,
  onSaveDraft,
  publishedLabel = "Published",
}: PuckEditorProps) {
  // Plain-text bodies from before a prop became rich, as paragraphs the rich
  // editor can hold. Also what "saved" is compared against, so opening an old
  // page does not read as an unsaved change.
  const initial = useMemo(() => upgradeRichText(stored, config), [stored, config]);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // What "saved" looks like, as a normalised string. Compared on every change
  // instead of flipping `dirty` on the first onChange, because Puck calls
  // onChange for things nobody did: resolvers refreshing a block's rows on
  // load, root defaults being applied. The first version marked every page
  // "Unsaved changes" the moment it opened, which teaches people to ignore
  // the one warning that matters.
  const saved = useRef<Data>(initial);
  useEffect(() => {
    // Moving to another page (Puck is re-keyed below) starts clean.
    saved.current = initial;
    setDirty(false);
  }, [slug, initial]);
  // A ref rather than state: two fast clicks would both read the same `false`
  // from a state value captured at render, and publish twice. The stock header
  // never passes `loading` to its own button, so it will not stop this for us.
  const publishing = useRef(false);

  /**
   * Warn before closing with unsaved work.
   *
   * Puck keeps every edit in memory until Publish. Without this, twenty
   * minutes of arranging a page is lost by closing the tab, with no prompt —
   * which is the single worst thing a page builder can do to someone.
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const publish = useCallback(
    async (data: Data) => {
      if (publishing.current) return;
      publishing.current = true;
      setStatus("Saving…");

      const res = await onPublish(slug, data);
      publishing.current = false;

      if (res.ok) {
        saved.current = data;
        setDirty(false);
        setStatus(publishedLabel);
      } else {
        // Keep `dirty` true on failure: the work is still only in this tab, so
        // the leave-warning must stay armed.
        setStatus(res.error ?? "Could not save");
      }
    },
    [slug, onPublish, publishedLabel]
  );

  // Same guard and bookkeeping as publish: a saved draft is what "saved"
  // now means, so the leave-warning disarms until the next change.
  const saveDraft = useCallback(
    async (data: Data) => {
      if (!onSaveDraft || publishing.current) return;
      publishing.current = true;
      setStatus("Saving…");
      const res = await onSaveDraft(slug, data);
      publishing.current = false;
      if (res.ok) {
        saved.current = data;
        setDirty(false);
        setStatus("Draft saved");
      } else {
        setStatus(res.error ?? "Could not save");
      }
    },
    [slug, onSaveDraft]
  );

  // Stable unless the host's draft action changes: Puck re-derives its whole
  // UI when `overrides` changes identity.
  const overrides = useMemo(
    () =>
      onSaveDraft
        ? {
            ...OVERRIDES,
            headerActions: ({ children }: { children: ReactNode }) => (
              <>
                <SaveDraftButton onSave={saveDraft} />
                {children}
              </>
            ),
          }
        : OVERRIDES,
    [onSaveDraft, saveDraft]
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      <Puck
        // Puck reads `data` ONCE, in a useState initialiser — it is an
        // uncontrolled component. Keying on the slug is what makes moving
        // between pages load the right one instead of silently keeping the
        // first page's content.
        key={slug}
        config={config}
        data={initial}
        // The sanctioned channel for ambient context. Unlike `data`, metadata
        // updates live, and it reaches every block as `props.puck.metadata`
        // and every resolver — which is how a data-driven block learns which
        // org and page it is on.
        metadata={{ ...metadata, orgId, slug }}
        onChange={(data: Data) => setDirty(signature(data) !== signature(saved.current))}
        onPublish={publish}
        plugins={plugins}
        headerTitle={title ?? `/p/${slug}`}
        headerPath={status ?? (dirty ? "Unsaved changes" : undefined)}
        viewports={viewports}
        overrides={overrides}
      />
    </div>
  );
}

/** "Save draft", beside Publish. Reads the document at the moment of the click. */
function SaveDraftButton({ onSave }: { onSave: (data: Data) => Promise<void> }) {
  const getPuck = useGetPuck();
  return (
    <Button variant="secondary" onClick={() => onSave(getPuck().appState.data as Data)}>
      Save draft
    </Button>
  );
}

/**
 * Puck's chrome, adjusted. Module-level so the object is stable — Puck
 * re-derives its whole UI when `overrides` changes identity.
 */
const OVERRIDES = {
  // A name alone does not say which block is which. `children` is Puck's own
  // item (name + drag icon); the description goes under it, inside the same
  // draggable element, so the whole card still picks up.
  drawerItem: ({ children, name }: { children: ReactNode; name: string }) => {
    const about = blockDescription(name);
    return (
      <div title={about}>
        {children}
        {about ? <div className="eac-drawer-item-about">{about}</div> : null}
      </div>
    );
  },
  // Clicking one picture of a many-picture block edits that picture: the
  // canvas side finds the row clicked, the panel side shows only its fields
  // (drag/item-focus.tsx). Right-click and double-click menus on the canvas:
  // drag/canvas-menu.tsx.
  iframe: ({ children, document }: { children: ReactNode; document?: Document }) => (
    <ItemPicker doc={document}>
      {children}
      <CanvasMenu doc={document} />
    </ItemPicker>
  ),
  fields: ({ children }: { children: ReactNode }) => <FocusedFields>{children}</FocusedFields>,
};

/**
 * Give every rich-text prop holding PLAIN text (typed before the prop was
 * rich) the HTML the rich editor expects. Without this the editor reads the
 * whole body as one paragraph and the first keystroke saves it that way,
 * losing the blank-line breaks. Nothing is written until the page is saved.
 */
function upgradeRichText(data: Data, config: Config): Data {
  const rich = (type: string) =>
    Object.entries(config.components[type]?.fields ?? {})
      .filter(([, f]) => (f as { type?: string }).type === "richtext")
      .map(([name]) => name);
  return walkTree(data, config, (content) =>
    content.map((node) => {
      const props = node.props as Record<string, unknown>;
      let next: Record<string, unknown> | null = null;
      for (const name of rich(node.type as string)) {
        const value = props[name];
        if (typeof value === "string" && value.trim()) {
          const html = textToHtml(value);
          if (html !== value) (next ??= { ...props })[name] = html;
        }
      }
      return next ? { ...node, props: next as typeof node.props } : node;
    })
  ) as Data;
}

/**
 * A page reduced to what an author can have changed: resolver-filled props,
 * Puck's own readOnly markers, empty values and empty zone maps are dropped,
 * and keys are sorted, so two documents that differ only in those compare
 * equal.
 */
function signature(data: Data): string {
  const walk = (value: unknown, type?: string): unknown => {
    if (Array.isArray(value)) return value.map((v) => walk(v));
    if (!value || typeof value !== "object") return value;
    const node = value as Record<string, unknown>;
    const nodeType = typeof node.type === "string" && "props" in node ? node.type : undefined;
    const skip = type ? resolverKeysFor(type) : undefined;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(node).sort()) {
      const v = node[key];
      if (key === "readOnly" || skip?.has(key)) continue;
      if (v === undefined || v === null || v === "") continue;
      if (key === "zones" && typeof v === "object" && Object.keys(v as object).length === 0) continue;
      // A node's props are checked against its own type's resolver keys.
      out[key] = key === "props" ? walk(v, nodeType) : walk(v);
    }
    return out;
  };
  return JSON.stringify(walk(data));
}
