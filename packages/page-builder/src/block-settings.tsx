"use client";

import { useMemo, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { Puck, type Config, type Data, type Plugin } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "./editor.css";
import { resolverKeysFor } from "./config";
import { isTopLayer, stackLayer } from "./layer-stack";
import { endSpell, partSelection, selectPart } from "./parts/store";

// ============================================================================
// One block's settings in Puck's own editor, over the page that opened it
// (2026-11-11, canvas first). The canvas editor (@elkdonis/direct-edit) lays the
// page out; Puck is where a sealed block's settings are changed when the
// canvas's right column cannot draw them (rows of a list, rich text, a site's
// own field). Puck gets a document of that one block, selected, with its
// drawer, drag, duplicate, delete and insert off; the canvas behind it is paused.
// Apply hands back the block's props without the keys its resolver fills (the
// host resolves again where the block sits); Cancel hands back nothing.
// ============================================================================

export interface BlockSettingsOptions {
  /** The editor-shape config (buildEditorConfig): Puck's fields for the block. */
  config: Config;
  node: { type: string; props: Record<string, unknown> };
  /** Ambient context for resolvers, as the page editor passes it. */
  metadata?: Record<string, unknown>;
  /** The header title. Default: the block's label. */
  title?: string;
  /** Keys a resolver fills that this host knows of, removed from what Apply hands back, beside the ones page-builder saw. */
  strip?: readonly string[];
  /**
   * Puck plugins for the sheet (2026-11-14, inception): `partsPlugin` with its `popup` lets the block's parts be
   * clicked into here, and opens direct-edit's block popup over this sheet, which hands back into it. Create them
   * once. Absent: Puck's own fields only, as before.
   */
  plugins?: Plugin[];
  /**
   * Esc cancels (2026-11-14, inception), while this sheet is the top layer: a field being typed in is left first, a
   * part selected by the parts plugin goes up a level first, and a sheet holding changes is not cancelled: its header
   * asks to Apply or Cancel instead. Absent: Esc does nothing here, as before.
   */
  escape?: boolean;
}

// Above the canvas editor's own bars and menus (direct-edit.css tops out at 2147483003).
const FRAME: CSSProperties = { position: "fixed", inset: 0, zIndex: 2147483600, background: "rgba(10, 12, 16, 0.55)", display: "flex", alignItems: "stretch", justifyContent: "center", padding: "3vh 3vw" };
const BTN: CSSProperties = { font: "500 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif", padding: "10px 16px", borderRadius: 6, cursor: "pointer", border: "1px solid #1d2129", background: "#fff", color: "#1d2129" };
const PRIMARY: CSSProperties = { ...BTN, background: "#1d4ed8", borderColor: "#1d4ed8", color: "#fff" };
const ASKING: CSSProperties = { boxShadow: "0 0 0 3px #f59e0b" };
const NOTE: CSSProperties = { font: "500 13px/1.3 system-ui, -apple-system, 'Segoe UI', sans-serif", color: "#92400e", alignSelf: "center", marginRight: 4 };

/**
 * What Esc may do (o.escape): a sheet holding changes is never thrown away by a key. Esc then asks, in the sheet's own
 * header (no browser dialog), to Apply or Cancel. Filled in by the component, read by the key handler.
 */
interface Guard {
  dirty(): boolean;
  ask(): void;
  asking(): boolean;
  subscribe(f: () => void): () => void;
}
function makeGuard(): Guard {
  let asking = false;
  const subs = new Set<() => void>();
  return {
    dirty: () => false,
    ask() {
      asking = true;
      subs.forEach((f) => f());
    },
    asking: () => asking,
    subscribe(f) {
      subs.add(f);
      return () => void subs.delete(f);
    },
  };
}

/** Same value whatever the key order (Puck may rebuild props in another order). Undefined values are absent. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

function HeaderActions({ guard, onCancel, onApply }: { guard: Guard; onCancel(): void; onApply(): void }) {
  const asking = useSyncExternalStore(guard.subscribe, guard.asking, () => false);
  return (
    // Native buttons: Puck's own Button draws no <button> here, so it could not be reached by keyboard.
    <div style={{ display: "flex", gap: 8 }}>
      {asking ? (
        <span role="status" data-block-settings-ask="" style={NOTE}>
          This block has changes. Apply them, or Cancel to drop them.
        </span>
      ) : null}
      <button type="button" data-block-settings-cancel="" style={asking ? { ...BTN, ...ASKING } : BTN} onClick={onCancel}>
        Cancel
      </button>
      <button type="button" data-block-settings-apply="" style={asking ? { ...PRIMARY, ...ASKING } : PRIMARY} onClick={onApply}>
        Apply
      </button>
    </div>
  );
}

const SHEET: CSSProperties = { flex: "1 1 auto", maxWidth: 1280, background: "#fff", color: "#111", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" };

function BlockSettings({ o, onDone, guard }: { o: BlockSettingsOptions; onDone(props: Record<string, unknown> | null): void; guard: Guard }) {
  const data = useMemo<Data>(() => ({ root: { props: {} }, content: [JSON.parse(JSON.stringify(o.node))] }) as Data, [o.node]);
  const latest = useRef<Data>(data);
  const drop = useMemo(() => new Set<string>([...(resolverKeysFor(o.node.type) ?? []), ...(o.strip ?? [])]), [o.node.type, o.strip]);
  /** What Apply would hand back from `d`: the block's props without the keys its resolver fills. */
  const handed = (d: Data) => {
    const n = d.content?.[0] as { type?: string; props?: Record<string, unknown> } | undefined;
    if (!n?.props || n.type !== o.node.type) return null;
    return Object.fromEntries(Object.entries(n.props).filter(([k]) => !drop.has(k)));
  };
  const start = useMemo(() => stable(handed(data)), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  guard.dirty = () => stable(handed(latest.current)) !== start;
  const apply = () => onDone(handed(latest.current));
  const label = (o.config.components as Record<string, { label?: string }>)[o.node.type]?.label ?? o.node.type;
  return (
    <Puck
      config={o.config}
      data={data}
      metadata={o.metadata}
      plugins={o.plugins}
      headerTitle={o.title ?? `${label}: settings`}
      onChange={(d) => {
        latest.current = d;
      }}
      ui={{ leftSideBarVisible: false, itemSelector: { index: 0, zone: "root:default-zone" } }}
      permissions={{ delete: false, duplicate: false, drag: false, insert: false }}
      height="100%"
      overrides={{
        headerActions: () => <HeaderActions guard={guard} onCancel={() => onDone(null)} onApply={apply} />,
      }}
    />
  );
}

/**
 * Open one block's settings in Puck over the page. Resolves with the block's new
 * props (resolver keys removed), or null when cancelled. Client only.
 */
export function openBlockSettings(o: BlockSettingsOptions): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const frame = document.createElement("div");
    frame.setAttribute("data-de-ui", "");
    frame.setAttribute("data-block-settings", "");
    Object.assign(frame.style, FRAME as Record<string, string>);
    const sheet = document.createElement("div");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", o.title ?? "Block settings");
    Object.assign(sheet.style, SHEET as Record<string, string>);
    frame.append(sheet);
    document.body.append(frame);
    // Over another layer (the block popup), this sheet is lifted above it. Alone: its own z-index, as before.
    const unstack = stackLayer(frame);
    // The parts plugin's state is one per page: an editor under this sheet gets its part back on close.
    const before = o.plugins?.length ? partSelection() : null;
    const root = createRoot(sheet);
    const guard = makeGuard();
    let settled = false;
    const done = (props: Record<string, unknown> | null) => {
      if (settled) return;
      settled = true;
      unstack();
      stopKeys();
      if (o.plugins?.length) {
        endSpell();
        selectPart(before);
      }
      resolve(props);
      // Not during a React commit: the click that closed it is still in one.
      setTimeout(() => {
        root.unmount();
        frame.remove();
      }, 0);
    };
    // Esc (o.escape): on this window and inside Puck's canvas iframe, whose keys do not reach this document.
    const docs = new Set<Document>();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented || settled || !isTopLayer(frame)) return;
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) {
        t.blur?.();
        return;
      }
      // The parts plugin's picker takes this Esc to go up from a part; the next one cancels.
      if (o.plugins?.length && partSelection()) return;
      ev.preventDefault();
      ev.stopPropagation();
      // Changes are never dropped by a key: ask in the header instead (Apply or Cancel).
      if (guard.dirty()) guard.ask();
      else done(null);
    };
    const listen = (d: Document | null | undefined) => {
      if (!d || docs.has(d)) return;
      docs.add(d);
      d.addEventListener("keydown", onKey, true);
    };
    const onLoad = (ev: Event) => {
      if (ev.target instanceof HTMLIFrameElement) listen(ev.target.contentDocument);
    };
    const seen = new MutationObserver(() => sheet.querySelectorAll("iframe").forEach((f) => listen(f.contentDocument)));
    if (o.escape) {
      listen(document);
      sheet.addEventListener("load", onLoad, true);
      seen.observe(sheet, { childList: true, subtree: true });
    }
    function stopKeys() {
      seen.disconnect();
      sheet.removeEventListener("load", onLoad, true);
      docs.forEach((d) => d.removeEventListener("keydown", onKey, true));
      docs.clear();
    }
    root.render(<BlockSettings o={o} onDone={done} guard={guard} />);
  });
}
