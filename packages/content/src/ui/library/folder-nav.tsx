"use client";

import * as React from "react";
import { ArrowUp, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { FileIcon } from "@elkdonis/cms-ui/file-types";
import { readStore, type FolderItem } from "./file-utils";

// Folder navigation, lifted from MediaLibrary (2026-11-26): history across sources like a browser
// tab, the Back / Forward / Up and breadcrumb row, and the folder chips.

export interface Place {
  source: string;
  path: string;
}

export interface FolderSource {
  key: string;
  label: string;
  /** Open inside this folder the first time. */
  startPath?: string;
  /** Own listing endpoint and extra query; without them the `folders.endpoint` and `?source=<key>` are used. */
  endpoint?: string;
  params?: Record<string, string>;
}

export function useFolderHistory(sources: FolderSource[], initialSource: string | undefined, rememberAs: string) {
  const firstSource = sources.find((s) => s.key === initialSource) ?? sources[0];
  const [history, setHistory] = React.useState<Place[]>(() => (firstSource ? [{ source: firstSource.key, path: firstSource.startPath ?? "" }] : []));
  const [pos, setPos] = React.useState(0);
  const here = history[pos];
  const source = sources.find((s) => s.key === here?.source) ?? firstSource;
  const path = here?.path ?? "";

  // The remembered folder of the first source unless the host asked for a start folder.
  React.useEffect(() => {
    if (firstSource && !firstSource.startPath) {
      const last = readStore(rememberAs, `path:${firstSource.key}`);
      if (last) setHistory([{ source: firstSource.key, path: last }]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Returns true when it moved (so the caller can clear the search). */
  function go(next: Place): boolean {
    const clean = { source: next.source, path: next.path.replace(/^\/+|\/+$/g, "") };
    if (clean.source === here?.source && clean.path === here?.path) return false;
    const h = history.slice(0, pos + 1).concat(clean);
    setHistory(h);
    setPos(h.length - 1);
    return true;
  }
  return { history, pos, setPos, source, path, go, firstSource };
}

export function PathBar({
  sourceLabel,
  path,
  pos,
  historyLength,
  canUp,
  searching,
  onBack,
  onForward,
  onUp,
  onCrumb,
}: {
  sourceLabel: string;
  path: string;
  pos: number;
  historyLength: number;
  canUp: boolean;
  /** A search is showing: the crumbs give way to its status line. */
  searching?: React.ReactNode;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  /** "" is the source's root. */
  onCrumb: (path: string) => void;
}) {
  const crumbs = path ? path.split("/") : [];
  return (
    <div className="eac-c-media-path">
      <button type="button" className="chn-iconbtn" aria-label="Back" disabled={pos === 0} onClick={onBack}>
        <ChevronLeft size={16} aria-hidden />
      </button>
      <button type="button" className="chn-iconbtn" aria-label="Forward" disabled={pos >= historyLength - 1} onClick={onForward}>
        <ChevronRight size={16} aria-hidden />
      </button>
      <button type="button" className="chn-iconbtn" aria-label="Up one folder" disabled={!canUp} onClick={onUp}>
        <ArrowUp size={15} aria-hidden />
      </button>
      {searching ? (
        <p className="eac-c-media-crumbs" role="status">
          {searching}
        </p>
      ) : (
        <nav className="eac-c-media-crumbs" aria-label="Where you are">
          <button type="button" onClick={() => onCrumb("")} aria-current={path === "" ? "location" : undefined}>
            {sourceLabel}
          </button>
          {crumbs.map((c, i) => {
            const to = crumbs.slice(0, i + 1).join("/");
            return (
              <React.Fragment key={to}>
                <span aria-hidden>/</span>
                <button type="button" onClick={() => onCrumb(to)} aria-current={i === crumbs.length - 1 ? "location" : undefined}>
                  {c}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/** The folders of the current place as a row of chips; a shortcut chip leads into another source. */
export function FolderChips({ folders, onOpen }: { folders: FolderItem[]; onOpen: (f: FolderItem) => void }) {
  if (folders.length === 0) return null;
  return (
    <ul className="eac-c-media-folders" aria-label="Folders">
      {folders.map((f) => (
        <li key={`${f.shortcut ? "sc:" : ""}${f.path}`}>
          <button type="button" className={`eac-c-media-folder${f.shortcut ? " is-shortcut" : ""}`} onClick={() => onOpen(f)} title={f.shortcut ? `${f.name} (shortcut)` : f.name}>
            <FileIcon family="folder" badge="" size={22} />
            <span>{f.name}</span>
            {f.shortcut ? <ExternalLink size={12} aria-label="Shortcut" /> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
