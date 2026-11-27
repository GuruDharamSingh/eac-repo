"use client";

import * as React from "react";
import { ContentLibrary } from "./ContentLibrary";
import type { PieceLightboxAction } from "./PieceLightbox";
import { listItemToMediaFile, type MediaLibraryFile } from "./library/file-model";
import { acceptsFile } from "./library/file-utils";
import type { LibraryUpload } from "./library/upload";

// ============================================================================
// MediaLibrary: the one picker (docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §5), now a thin
// wrapper over ContentLibrary (CONTRACT §7, Step 2 of the content cornerstone, 2026-11-26):
//
//   <ContentLibrary view="files" lockView folders={{ sources }} … />
//
// Same exports, same props, and the same `MediaLibraryFile` values reported to onPick / onToggle /
// onUploaded / fileAction. The folder browser itself lives in ./library/FileBrowser.tsx (moved from
// this file). It reads `{ path, browsable, items: [...] }`, FileBrowser's `{ files }` and the flat
// `{ items | files: [{ url, name }] }`.
//
// Modes: browse (a lightbox with Open and the host's action), pick (one file, onPick),
// pickMany (picked + onToggle). What a pick MEANS is the host's attach route's decision.
// ============================================================================

export type MediaLibraryMode = "browse" | "pick" | "pickMany";
export type MediaLibraryView = "grid" | "list";

export interface MediaLibrarySource {
  key: string;
  label: string;
  endpoint: string;
  /** Extra query sent with every listing, e.g. `{ scope: "mine" }`. */
  params?: Record<string, string>;
  /** Open inside this folder the first time (a tour's own folder, say). */
  startPath?: string;
}

export type { MediaLibraryFile };
export type MediaLibraryUpload = LibraryUpload;

export interface MediaLibraryProps {
  sources: MediaLibrarySource[];
  mode?: MediaLibraryMode;
  /** pick: the chosen file's URL, marked. */
  value?: string;
  /** pickMany: the chosen URLs. */
  picked?: string[];
  onPick?: (file: MediaLibraryFile) => void;
  onToggle?: (file: MediaLibraryFile) => void;
  /** Which files to show and to take on upload, as an <input accept>: "image/*", "image/*,video/*". Default every file. */
  accept?: string;
  upload?: MediaLibraryUpload;
  /** After an upload. In pick mode the new file is also picked. */
  onUploaded?: (file: MediaLibraryFile) => void;
  /** browse: the lightbox's lead button for a file ("Use as cover", "Attach to this stop"). */
  fileAction?: (file: MediaLibraryFile) => PieceLightboxAction | null;
  /** A row above the bars, as ContentLibrary's `header`. */
  header?: React.ReactNode;
  /** Session-storage namespace for the remembered folder and view. Default "eac-mlib". */
  rememberAs?: string;
  defaultView?: MediaLibraryView;
  /** Which source opens first. Default the first. */
  initialSource?: string;
  emptyText?: string;
  className?: string;
}

export { acceptsFile };

export function MediaLibrary({
  sources,
  mode = "pick",
  value,
  picked,
  onPick,
  onToggle,
  accept = "*",
  upload,
  onUploaded,
  fileAction,
  header,
  rememberAs = "eac-mlib",
  defaultView = "grid",
  initialSource,
  emptyText = "This folder is empty.",
  className,
}: MediaLibraryProps) {
  return (
    <ContentLibrary
      view="files"
      lockView
      folders={{ sources }}
      mode={mode}
      value={value}
      picked={picked}
      onPick={onPick ? (it) => onPick(listItemToMediaFile(it)) : undefined}
      onToggle={onToggle ? (it) => onToggle(listItemToMediaFile(it)) : undefined}
      accept={accept}
      upload={upload}
      onUploaded={onUploaded ? (it) => onUploaded(listItemToMediaFile(it)) : undefined}
      primaryAction={fileAction ? (it) => fileAction(listItemToMediaFile(it)) : undefined}
      header={header}
      rememberAs={rememberAs}
      initial={{ view: defaultView === "list" ? "list" : "bricks" }}
      initialSource={initialSource}
      emptyText={emptyText}
      className={className}
    />
  );
}
