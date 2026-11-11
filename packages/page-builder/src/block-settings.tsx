"use client";

import { useMemo, useRef, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { Puck, type Config, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import "./editor.css";
import { resolverKeysFor } from "./config";

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
}

// Above the canvas editor's own bars and menus (direct-edit.css tops out at 2147483003).
const FRAME: CSSProperties = { position: "fixed", inset: 0, zIndex: 2147483600, background: "rgba(10, 12, 16, 0.55)", display: "flex", alignItems: "stretch", justifyContent: "center", padding: "3vh 3vw" };
const BTN: CSSProperties = { font: "500 14px/1 system-ui, -apple-system, 'Segoe UI', sans-serif", padding: "10px 16px", borderRadius: 6, cursor: "pointer", border: "1px solid #1d2129", background: "#fff", color: "#1d2129" };
const PRIMARY: CSSProperties = { ...BTN, background: "#1d4ed8", borderColor: "#1d4ed8", color: "#fff" };
const SHEET: CSSProperties = { flex: "1 1 auto", maxWidth: 1280, background: "#fff", color: "#111", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", display: "flex", flexDirection: "column" };

function BlockSettings({ o, onDone }: { o: BlockSettingsOptions; onDone(props: Record<string, unknown> | null): void }) {
  const data = useMemo<Data>(() => ({ root: { props: {} }, content: [JSON.parse(JSON.stringify(o.node))] }) as Data, [o.node]);
  const latest = useRef<Data>(data);
  const apply = () => {
    const n = latest.current.content?.[0] as { type?: string; props?: Record<string, unknown> } | undefined;
    if (!n?.props || n.type !== o.node.type) return onDone(null);
    const drop = new Set<string>([...(resolverKeysFor(o.node.type) ?? []), ...(o.strip ?? [])]);
    onDone(Object.fromEntries(Object.entries(n.props).filter(([k]) => !drop.has(k))));
  };
  const label = (o.config.components as Record<string, { label?: string }>)[o.node.type]?.label ?? o.node.type;
  return (
    <Puck
      config={o.config}
      data={data}
      metadata={o.metadata}
      headerTitle={o.title ?? `${label}: settings`}
      onChange={(d) => {
        latest.current = d;
      }}
      ui={{ leftSideBarVisible: false, itemSelector: { index: 0, zone: "root:default-zone" } }}
      permissions={{ delete: false, duplicate: false, drag: false, insert: false }}
      height="100%"
      overrides={{
        headerActions: () => (
          // Native buttons: Puck's own Button draws no <button> here, so it could not be reached by keyboard.
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={BTN} onClick={() => onDone(null)}>
              Cancel
            </button>
            <button type="button" style={PRIMARY} onClick={apply}>
              Apply
            </button>
          </div>
        ),
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
    const root = createRoot(sheet);
    let settled = false;
    const done = (props: Record<string, unknown> | null) => {
      if (settled) return;
      settled = true;
      resolve(props);
      // Not during a React commit: the click that closed it is still in one.
      setTimeout(() => {
        root.unmount();
        frame.remove();
      }, 0);
    };
    root.render(<BlockSettings o={o} onDone={done} />);
  });
}
