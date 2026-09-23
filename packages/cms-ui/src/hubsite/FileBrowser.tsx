"use client";

import * as React from "react";
import { FileIcon, badgeOf, familyName, familyOf, formatBytes } from "./file-types";

// ============================================================================
// Files, as a place you move around in.
//
// The old card listed a folder. This one keeps track of where you are:
// breadcrumbs you can click, Back / Forward / Up like a file manager, and the
// last folder per source remembered for the session, so coming back to the
// hub lands you where you left. Each entry says what it is — a family icon
// with the extension on it, the family's name, size and date — and images get
// a real thumbnail in the grid view.
//
// Read-only on purpose: uploads and folder changes stay in the surfaces that
// already do them. The endpoint answers GET `?path=&scope=` with
// `{ files: [{ name, path, url, size, mimeType, lastModified, isFolder }] }`
// (IFAC's /api/hub/files shape). The server resolves the tree from the
// session; this component never names an owner.
// ============================================================================

export interface FileBrowserSource {
  id: string;
  label: string;
  endpoint: string;
  /** Extra query, e.g. `{ scope: "mine" }`. */
  params?: Record<string, string>;
}

interface Entry {
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string | null;
  lastModified: string | null;
  isFolder: boolean;
}

type View = "list" | "grid";

const STORE = "eac-hs-files:";

function readStore(key: string): string | null {
  try {
    return sessionStorage.getItem(STORE + key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    sessionStorage.setItem(STORE + key, value);
  } catch {
    /* storage unavailable: the browser still works, it just won't remember */
  }
}

export function FileBrowser({ sources, title = "Files" }: { sources: FileBrowserSource[]; title?: string }) {
  const [sourceId, setSourceId] = React.useState(sources[0]?.id ?? "");
  const source = sources.find((s) => s.id === sourceId) ?? sources[0];

  // History per source: a stack and a position, like a browser tab.
  const [history, setHistory] = React.useState<string[]>([""]);
  const [pos, setPos] = React.useState(0);
  const path = history[pos] ?? "";

  const [entries, setEntries] = React.useState<Entry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>("list");

  // Restore the last folder and view for this source.
  React.useEffect(() => {
    if (!source) return;
    const last = readStore(`path:${source.id}`) ?? "";
    setHistory([last]);
    setPos(0);
    const v = readStore("view");
    if (v === "grid" || v === "list") setView(v);
  }, [source?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!source) return;
    let live = true;
    setEntries(null);
    setError(null);
    const q = new URLSearchParams({ ...(source.params ?? {}), path });
    fetch(`${source.endpoint}?${q}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok) {
          setError(data.error ?? (r.status === 403 ? "You can't open this folder." : "Could not open this folder."));
          setEntries([]);
          return;
        }
        const list: Entry[] = Array.isArray(data.files) ? data.files : [];
        list.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name));
        setEntries(list);
        writeStore(`path:${source.id}`, path);
      })
      .catch(() => {
        if (live) {
          setError("Could not reach the files.");
          setEntries([]);
        }
      });
    return () => {
      live = false;
    };
  }, [source, path]);

  if (!source) return null;

  function go(next: string) {
    const trimmed = next.replace(/^\/+|\/+$/g, "");
    if (trimmed === path) return;
    const h = history.slice(0, pos + 1).concat(trimmed);
    setHistory(h);
    setPos(h.length - 1);
  }
  const up = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const crumbs = path ? path.split("/") : [];

  function setViewAndSave(v: View) {
    setView(v);
    writeStore("view", v);
  }

  const folders = entries?.filter((e) => e.isFolder).length ?? 0;
  const files = (entries?.length ?? 0) - folders;

  return (
    <section className="eac-hs-files" aria-label={title}>
      <div className="eac-hs-files-top">
        <h2 className="eac-hs-h">{title}</h2>
        {sources.length > 1 && (
          <div className="eac-hs-seg" role="tablist" aria-label="Which files">
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === source.id}
                className={s.id === source.id ? "is-on" : undefined}
                onClick={() => setSourceId(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="eac-hs-files-bar">
        <div className="eac-hs-nav">
          <button type="button" aria-label="Back" disabled={pos === 0} onClick={() => setPos((p) => Math.max(0, p - 1))}>
            ‹
          </button>
          <button
            type="button"
            aria-label="Forward"
            disabled={pos >= history.length - 1}
            onClick={() => setPos((p) => Math.min(history.length - 1, p + 1))}
          >
            ›
          </button>
          <button type="button" aria-label="Up one folder" disabled={!path} onClick={() => go(up)}>
            ↑
          </button>
        </div>
        <nav className="eac-hs-crumbs" aria-label="Where you are">
          <button type="button" onClick={() => go("")} aria-current={path === "" ? "location" : undefined}>
            {source.label}
          </button>
          {crumbs.map((c, i) => {
            const to = crumbs.slice(0, i + 1).join("/");
            const here = i === crumbs.length - 1;
            return (
              <React.Fragment key={to}>
                <span aria-hidden>/</span>
                <button type="button" onClick={() => go(to)} aria-current={here ? "location" : undefined}>
                  {c}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
        <div className="eac-hs-seg eac-hs-seg--small" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "list"} className={view === "list" ? "is-on" : undefined} onClick={() => setViewAndSave("list")}>
            List
          </button>
          <button type="button" aria-pressed={view === "grid"} className={view === "grid" ? "is-on" : undefined} onClick={() => setViewAndSave("grid")}>
            Grid
          </button>
        </div>
      </div>

      {entries === null ? (
        <p className="eac-hs-muted eac-hs-pad">Opening…</p>
      ) : error ? (
        <p className="eac-hs-muted eac-hs-pad">{error}</p>
      ) : entries.length === 0 ? (
        <p className="eac-hs-muted eac-hs-pad">This folder is empty.</p>
      ) : view === "list" ? (
        <ul className="eac-hs-list">
          {entries.map((e) => {
            const fam = familyOf(e);
            const body = (
              <>
                <FileIcon family={fam} badge={badgeOf(e, fam)} size={34} />
                <span className="eac-hs-list-name">{e.name}</span>
                <span className="eac-hs-list-meta">
                  {familyName(fam)}
                  {!e.isFolder && ` · ${formatBytes(e.size)}`}
                  {e.lastModified && ` · ${new Date(e.lastModified).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
                </span>
              </>
            );
            return (
              <li key={e.path}>
                {e.isFolder ? (
                  <button type="button" className="eac-hs-list-row" onClick={() => go(path ? `${path}/${e.name}` : e.name)}>
                    {body}
                  </button>
                ) : (
                  <a className="eac-hs-list-row" href={e.url} target="_blank" rel="noopener">
                    {body}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="eac-hs-grid">
          {entries.map((e) => {
            const fam = familyOf(e);
            const thumb = fam === "image" && !e.isFolder;
            const body = (
              <>
                <span className="eac-hs-grid-thumb">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${e.url}${e.url.includes("?") ? "&" : "?"}w=320`} alt="" loading="lazy" />
                  ) : (
                    <FileIcon family={fam} badge={badgeOf(e, fam)} size={52} />
                  )}
                </span>
                <span className="eac-hs-grid-name" title={e.name}>
                  {e.name}
                </span>
                <span className="eac-hs-list-meta">{e.isFolder ? "Folder" : formatBytes(e.size)}</span>
              </>
            );
            return (
              <li key={e.path}>
                {e.isFolder ? (
                  <button type="button" className="eac-hs-grid-cell" onClick={() => go(path ? `${path}/${e.name}` : e.name)}>
                    {body}
                  </button>
                ) : (
                  <a className="eac-hs-grid-cell" href={e.url} target="_blank" rel="noopener">
                    {body}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {entries && entries.length > 0 && (
        <p className="eac-hs-files-foot">
          {folders > 0 && `${folders} ${folders === 1 ? "folder" : "folders"}`}
          {folders > 0 && files > 0 && " · "}
          {files > 0 && `${files} ${files === 1 ? "file" : "files"}`}
        </p>
      )}
    </section>
  );
}
