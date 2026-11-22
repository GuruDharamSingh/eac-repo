"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Puck, type Config, type Data, type Plugin } from "@puckeditor/core";
// Imported here, in the lazily loaded chunk, never in the root layout: puck.css opens with an
// external @import that the bundler cannot hoist when it shares a chunk with the Tailwind sheet.
// The chunk is loaded before Puck mounts, so its iframe still copies these sheets.
import "@puckeditor/core/puck.css";
import "@elkdonis/direct-edit/direct-edit.css";
import type { Block } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { partsPlugin } from "@elkdonis/page-builder";
import { openStudioPopup } from "@elkdonis/direct-edit/puck";
import { mountLookPanel } from "@elkdonis/direct-edit/puck";
import { partLookOf, setPartLook, partSafeDecls } from "@elkdonis/direct-edit/puck/morph";
import { setTheme, themeList, useThemeId } from "@/lib/theme-store";
import { nodeProps } from "./model";
import { History } from "./versions/History";
import { FoundCopy, VersionsBar } from "./versions/VersionsBar";
import { useVersions } from "./versions/useVersions";

// ============================================================================
// The editing suite for one block, in a sandbox: nothing here is saved to any
// site. It is page-builder's own Puck on a one-block document (the shape of
// openBlockSettings), kept open so the block draws live beside its fields:
//   - Fields: Puck's own controls for every prop, from buildEditorConfig.
//   - Parts and looks: when the block declares parts, page-builder's partsPlugin
//     with direct-edit's look panel and popup (click a part in the preview).
//   - Theme: the header switcher previews the block under each app's variables.
// ============================================================================

const FRAME: CSSProperties = { position: "fixed", inset: "44px 0 0 0", zIndex: 50, background: "rgba(8,10,14,0.6)", display: "flex", padding: "16px 20px" };
const SHEET: CSSProperties = { position: "relative", flex: "1 1 auto", background: "#fff", color: "#111", borderRadius: 10, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column" };
const BTN: CSSProperties = { font: "500 13px/1 system-ui, sans-serif", padding: "8px 12px", borderRadius: 6, cursor: "pointer", border: "1px solid #1d2129", background: "#fff", color: "#1d2129" };

function HeaderBar({ onReset, onClose }: { onReset(): void; onClose(): void }) {
  const id = useThemeId();
  const themes = themeList();
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ font: "500 12px system-ui", color: "#92400e" }}>Sandbox: kept only as versions here, on no site</span>
      <label style={{ font: "500 12px system-ui", display: "flex", gap: 6, alignItems: "center" }}>
        Theme
        <select value={id ?? ""} onChange={(e) => setTheme(e.target.value || null)} style={{ ...BTN, padding: "6px 8px" }}>
          <option value="">The block&apos;s own look</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button type="button" style={BTN} onClick={onReset}>
        Reset block
      </button>
      <button type="button" style={{ ...BTN, background: "#1d4ed8", borderColor: "#1d4ed8", color: "#fff" }} onClick={onClose}>
        Done
      </button>
    </div>
  );
}

export interface BlockSuiteProps {
  block: Block<never>;
  /** Everything loaded, so nested blocks and the look popup know the whole catalogue. */
  blocks: Block<never>[];
  /** The tile config (published shape): the look popup draws with it. */
  renderConfig: Config;
  /** The editor-shape config built over `blocks`. */
  editorConfig: Config;
  edits?: Record<string, unknown>;
  /** Versions key for this block, "block:<app>:<id>". */
  subject: string;
  /** Called with the number of saved versions once known and after each save (tile badge). */
  onVersionCount?(subject: string, n: number): void;
  onChange(props: Record<string, unknown>): void;
  onReset(): void;
  onClose(): void;
}

export default function BlockSuite({ block, blocks, renderConfig, editorConfig, edits, subject, onVersionCount, onChange, onReset, onClose }: BlockSuiteProps) {
  const type = block.def.id;
  const data = useMemo<Data>(() => ({ root: { props: {} }, content: [{ type, props: { id: `dev-${type}`, ...nodeProps(block, edits) } }] }) as unknown as Data, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = useRef(data);
  // Versions: `seed` is the document Puck starts from (the block, a picked-up working copy or a
  // version we continue from); changing it remounts Puck on that document.
  const [seed, setSeed] = useState<{ n: number; data: Data }>({ n: 0, data });
  const [showHistory, setShowHistory] = useState(false);
  const themeId = useThemeId();
  const api = useVersions(subject, themeId);
  const { baseline } = api;
  useEffect(() => baseline(data), [baseline, data]);
  useEffect(() => {
    if (api.phase === "ready") onVersionCount?.(subject, api.versions.length);
  }, [api.phase, api.versions.length, subject, onVersionCount]);
  const take = (doc: unknown, base: string | null, theme: string | null) => {
    const d = doc as Data;
    latest.current = d;
    api.setBaseId(base);
    api.baseline(d);
    setTheme(theme);
    const n = d.content?.[0] as { props?: Record<string, unknown> } | undefined;
    if (n?.props) {
      const { id: _id, ...rest } = n.props;
      void _id;
      onChange(rest);
    }
    setSeed((s) => ({ n: s.n + 1, data: d }));
  };
  const plugins = useMemo<Plugin[]>(() => {
    if (!block.def.parts) return [];
    const contract = contractOf(blocks);
    return [
      partsPlugin({
        contract,
        look: { partLookOf, setPartLook, partSafeDecls },
        panel: mountLookPanel,
        developer: false,
        handBack: true,
        popup: (ctx) => openStudioPopup({ config: renderConfig as never, contract: contract as never, records: undefined, freeMove: true, contentTab: true }, ctx),
      }),
    ];
  }, [block, blocks, renderConfig]);

  return (
    <div style={FRAME} data-dev-suite={type}>
      <div style={SHEET}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", padding: "6px 14px", borderBottom: "1px solid #e4e7ec", background: "#f9fafb" }} data-dev-versions-bar>
          <span style={{ font: "600 12px system-ui", color: "#475467", marginRight: "auto" }}>Versions</span>
          <VersionsBar api={api} getDoc={() => latest.current} onHistory={() => setShowHistory(true)} />
        </div>
        {!edits && api.found ? <FoundCopy api={api} onPickUp={() => take(api.found!.doc, api.found!.baseId, api.found!.theme)} /> : null}
        <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <Puck
          key={`${type}:${seed.n}`}
          config={editorConfig}
          data={seed.data}
          plugins={plugins}
          headerTitle={`${block.def.label}: sandbox`}
          onChange={(d) => {
            latest.current = d;
            api.changed(d);
            const n = d.content?.[0] as { props?: Record<string, unknown> } | undefined;
            if (n?.props) {
              const { id: _id, ...rest } = n.props;
              void _id;
              onChange(rest);
            }
          }}
          ui={{ leftSideBarVisible: false, itemSelector: { index: 0, zone: "root:default-zone" } }}
          permissions={{ delete: false, duplicate: false, drag: false, insert: false }}
          height="100%"
          overrides={{ headerActions: () => <HeaderBar onReset={onReset} onClose={onClose} /> }}
        />
        </div>
        {showHistory ? (
          <History
            versions={api.versions}
            baseId={api.baseId}
            config={renderConfig}
            title={block.def.label}
            onContinue={(v) => {
              take(v.doc, v.id, v.theme);
              setShowHistory(false);
            }}
            onKeep={(id, on) => void api.keep(id, on)}
            onClose={() => setShowHistory(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
