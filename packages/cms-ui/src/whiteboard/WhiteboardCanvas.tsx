"use client";

import { useCallback, useRef, useState } from "react";
import { Excalidraw, MainMenu, exportToBlob, exportToSvg, serializeAsJSON } from "@excalidraw/excalidraw";

// ============================================================================
// The Excalidraw canvas with "Save to…" and "Export image…" that ask WHERE
// first (owner, 2026-10-10): the organisation's Nextcloud folder, or this
// computer. "This computer" opens Excalidraw's own dialog unchanged.
//
// Loaded only through next/dynamic with ssr:false (WhiteboardSurface):
// Excalidraw touches window at module load, so every import from it — the
// menu, the exporters — lives in this file rather than the surface.
//
// Excalidraw 0.18's image-export dialog takes no custom UI, so the choice is
// made before it opens: the main menu's two items are replaced by our own,
// and Ctrl+Shift+E (its shortcut) still opens the stock dialog directly. The
// JSON "Save to…" dialog does take a custom card (`renderCustomUI`), so the
// Nextcloud option appears there too.
// ============================================================================

export interface WhiteboardCloudSave {
  /** POST multipart { file, name, kind: "scene" | "image" } → { ok, path?, name? }. */
  endpoint: string;
  /** Where it lands, as the member reads it: "Elkdonis Arts Collective › Whiteboards". */
  folderLabel: string;
}

export interface WhiteboardCanvasProps {
  initialData: unknown;
  onChange: (elements: any, appState: any, files: any) => void;
  cloudSave?: WhiteboardCloudSave | null;
}

type Choice = null | "scene" | "image";
type ImageFormat = "png" | "svg";

function defaultName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Whiteboard ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function WhiteboardCanvas({ initialData, onChange, cloudSave }: WhiteboardCanvasProps) {
  const api = useRef<any>(null);
  const [choice, setChoice] = useState<Choice>(null);
  const [name, setName] = useState(defaultName);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [withBackground, setWithBackground] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const open = (c: Exclude<Choice, null>) => {
    setResult(null);
    setName(defaultName());
    setChoice(c);
  };

  const toComputer = (c: Exclude<Choice, null>) => {
    setChoice(null);
    api.current?.updateScene({ appState: { openDialog: { name: c === "image" ? "imageExport" : "jsonExport" } } });
  };

  const saveToCloud = useCallback(
    async (kind: Exclude<Choice, null>) => {
      if (!cloudSave || !api.current) return;
      setBusy(true);
      setResult(null);
      try {
        const elements = api.current.getSceneElements();
        const appState = api.current.getAppState();
        const files = api.current.getFiles();
        const base = name.trim() || defaultName();
        let blob: Blob;
        let filename: string;
        if (kind === "scene") {
          blob = new Blob([serializeAsJSON(elements, appState, files, "local")], { type: "application/json" });
          filename = `${base}.excalidraw`;
        } else if (format === "svg") {
          const svg = await exportToSvg({
            elements,
            appState: { ...appState, exportBackground: withBackground },
            files,
          });
          blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
          filename = `${base}.svg`;
        } else {
          blob = await exportToBlob({
            elements,
            appState: { ...appState, exportBackground: withBackground },
            files,
            mimeType: "image/png",
          });
          filename = `${base}.png`;
        }
        const form = new FormData();
        form.set("file", blob, filename);
        form.set("name", filename);
        form.set("kind", kind);
        const res = await fetch(cloudSave.endpoint, { method: "POST", body: form });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; name?: string; error?: string } | null;
        if (!res.ok || !body?.ok) throw new Error(body?.error || "Nextcloud did not take the file.");
        setResult({ ok: true, message: `Saved to ${cloudSave.folderLabel} as ${body.name ?? filename}.` });
      } catch (error) {
        setResult({ ok: false, message: error instanceof Error ? error.message : "Could not save to Nextcloud." });
      } finally {
        setBusy(false);
      }
    },
    [cloudSave, name, format, withBackground]
  );

  return (
    <>
      <Excalidraw
        initialData={initialData as any}
        onChange={onChange}
        excalidrawAPI={(a) => {
          api.current = a;
        }}
        UIOptions={
          cloudSave
            ? {
                canvasActions: {
                  export: {
                    saveFileToDisk: true,
                    renderCustomUI: () => (
                      <div className="eac-wb-card">
                        <h3>Nextcloud</h3>
                        <p>Save to {cloudSave.folderLabel}.</p>
                        <button
                          type="button"
                          className="eac-wb-btn eac-wb-btn--primary"
                          onClick={() => {
                            api.current?.updateScene({ appState: { openDialog: null } });
                            open("scene");
                          }}
                        >
                          Save to Nextcloud
                        </button>
                      </div>
                    ),
                  },
                },
              }
            : undefined
        }
      >
        {cloudSave ? (
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.Item icon={<SaveIcon />} onSelect={() => open("scene")}>
              Save to…
            </MainMenu.Item>
            <MainMenu.Item icon={<ImageIcon />} onSelect={() => open("image")}>
              Export image…
            </MainMenu.Item>
            <MainMenu.DefaultItems.CommandPalette />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        ) : null}
      </Excalidraw>

      {choice && cloudSave ? (
        <div className="eac-wb-chooser" role="dialog" aria-modal="false" aria-labelledby="eac-wb-chooser-title">
          <div className="eac-wb-panel">
            <header className="eac-wb-panel-head">
              <h2 id="eac-wb-chooser-title">{choice === "scene" ? "Save the whiteboard" : "Export an image"}</h2>
              <button type="button" className="eac-wb-close" aria-label="Close" onClick={() => setChoice(null)}>
                ×
              </button>
            </header>

            <label className="eac-wb-field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </label>

            {choice === "image" ? (
              <div className="eac-wb-row">
                <div className="eac-wb-seg" role="group" aria-label="Format">
                  {(["png", "svg"] as const).map((f) => (
                    <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <label className="eac-wb-check">
                  <input type="checkbox" checked={withBackground} onChange={(e) => setWithBackground(e.target.checked)} />
                  Background
                </label>
              </div>
            ) : null}

            <div className="eac-wb-options">
              <button
                type="button"
                className="eac-wb-option eac-wb-option--primary"
                disabled={busy}
                onClick={() => saveToCloud(choice)}
              >
                <strong>{busy ? "Saving…" : "Nextcloud"}</strong>
                <span>{cloudSave.folderLabel}</span>
              </button>
              <button type="button" className="eac-wb-option" disabled={busy} onClick={() => toComputer(choice)}>
                <strong>This computer…</strong>
                <span>{choice === "scene" ? "Download an .excalidraw file" : "Download PNG or SVG, or copy"}</span>
              </button>
            </div>

            {result ? (
              <p className={`eac-wb-result${result.ok ? "" : " is-error"}`} role="status">
                {result.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

// Drawn at Excalidraw's menu-icon size and stroke, so they sit with its own.
function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4" />
      <path d="M8 20v-6h8v6" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M20 16l-5-5-9 8" />
    </svg>
  );
}
