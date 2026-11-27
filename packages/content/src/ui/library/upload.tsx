"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { isMediaDrag, readMediaDrop } from "@elkdonis/cms-ui/files";
import { acceptsFile } from "./file-utils";

// Upload and drag/drop, lifted from MediaLibrary (2026-11-26).

export interface LibraryUpload {
  /** POST multipart `file`; must answer `{ url }` (and may add `name`, `path`). */
  endpoint: string;
  /** Extra multipart fields: the destination (tour, place, slot), say. */
  fields?: Record<string, string>;
  /** Button text. Default "Upload". */
  label?: string;
}

export interface UploadedFile {
  url: string;
  name: string;
  path: string;
  mimeType: string | null;
  size: number;
}

export function useUpload({ upload, accept, onUploaded }: { upload?: LibraryUpload; accept: string; onUploaded: (file: UploadedFile) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function run(file: File | undefined) {
    if (!file || !upload) return;
    if (!acceptsFile(accept, { name: file.name, mimeType: file.type })) {
      setError("This picker does not take that kind of file.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(upload.fields ?? {})) fd.append(k, v);
      const res = await fetch(upload.endpoint, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { url?: string; name?: string; path?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed");
      onUploaded({ url: body.url, name: body.name ?? file.name, path: body.path ?? "", mimeType: file.type || null, size: file.size });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  return { busy, error, inputRef, run };
}

/** The Upload button and its hidden input. Renders nothing without an `upload`. */
export function UploadButton({ upload, accept, busy, inputRef, onFile }: { upload?: LibraryUpload; accept: string; busy: boolean; inputRef: React.RefObject<HTMLInputElement | null>; onFile: (f: File | undefined) => void }) {
  if (!upload) return null;
  return (
    <>
      <input ref={inputRef} type="file" accept={accept === "*" ? undefined : accept} hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" className="chn-btn is-small" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload size={14} aria-hidden />
        {busy ? "Uploading…" : upload.label ?? "Upload"}
      </button>
    </>
  );
}

/**
 * Drop handling for the library root: a tile dragged from another library on the page (`onTile`) or a
 * file dragged from the desktop (`onFile`). Spread `handlers` on the root element.
 */
export function useDropZone({
  enabled,
  onTile,
  onFile,
}: {
  enabled: boolean;
  onTile: (tile: { url: string; name: string }) => void;
  onFile: (file: File | undefined) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const handlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!enabled || !isMediaDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragging(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!enabled || !isMediaDrag(e)) return;
      e.preventDefault();
      setDragging(false);
      const tile = readMediaDrop(e);
      if (tile) onTile(tile);
      else onFile(e.dataTransfer.files?.[0]);
    },
  };
  return { dragging, handlers };
}
