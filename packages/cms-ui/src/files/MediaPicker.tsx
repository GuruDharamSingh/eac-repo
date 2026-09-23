"use client";

import { useMemo, useRef, useState } from "react";
import { MediaBrowser, isMediaDrag, readMediaDrop } from "./MediaBrowser";

/**
 * Pick an image: upload a new one, or choose something already in storage.
 *
 * The Mantine-free replacement for MediaUpload + FileBrowser in
 * @elkdonis/ui. Those pull Mantine into whichever app imports them, and the
 * sites are moving off Mantine — amrit-canada had already hand-rolled a
 * shadcn version of exactly this (components/manage/media-field.tsx) rather
 * than take that dependency, which is the duplication this replaces.
 *
 * Plain CSS driven by custom properties, NOT Tailwind utilities like the
 * wizard in this package: ifac and artdirect are not Tailwind apps, so
 * utility classes would silently render unstyled there. Plain CSS is the only
 * thing that works across every site.
 *
 * Endpoints are props because each app mounts its own — an org-scoped upload
 * route, a person-scoped one, or both. Nothing here assumes Nextcloud; it
 * only ever sees platform URLs.
 */

export interface MediaPickerItem {
  url: string;
  name: string;
}

export interface MediaPickerProps {
  value?: string;
  onChange: (url: string) => void;
  /** POST target taking multipart `file`; must return `{ url }`. */
  uploadEndpoint: string;
  /** GET target returning `{ files: [{url,name}] }` or `{ items: [...] }`. Omit to hide the Library tab. */
  libraryEndpoint?: string;
  /**
   * Several places to choose from, instead of one.
   *
   * Each becomes its own tab beside Upload — "This site", "My files" — rather
   * than a toggle nested inside a Library tab. Flattening keeps every source
   * one click away and makes it obvious that more than one exists, which a
   * second-level control does not.
   *
   * Takes precedence over `libraryEndpoint`, which stays for the callers that
   * have only one.
   */
  libraries?: Array<{ key: string; label: string; endpoint: string }>;
  /** Extra multipart fields sent with the upload (org id, folder, target…). */
  uploadFields?: Record<string, string>;
  label?: string;
  hint?: string;
  accept?: string;
}

/** "upload", or the key of one of the libraries. */
type Tab = string;

export function MediaPicker({
  value,
  onChange,
  uploadEndpoint,
  libraryEndpoint,
  libraries,
  uploadFields,
  label = "Image",
  hint,
  accept = "image/*",
}: MediaPickerProps) {
  // One shape internally, whichever prop the caller used.
  const sources = useMemo(
    () =>
      libraries?.length
        ? libraries
        : libraryEndpoint
          ? [{ key: "library", label: "Library", endpoint: libraryEndpoint }]
          : [],
    [libraries, libraryEndpoint]
  );

  const [tab, setTab] = useState<Tab>("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSource = sources.find((s) => s.key === tab);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (accept.startsWith("image/") && !file.type.startsWith("image/")) {
      setError("That doesn't look like an image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      for (const [k, v] of Object.entries(uploadFields ?? {})) fd.append(k, v);
      const res = await fetch(uploadEndpoint, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? "Upload failed");
      }
      onChange(body.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // The WHOLE picker takes a drop: a picture dragged from a library tile, from
  // the editor's Media panel, or a file from the desktop (which is uploaded).
  // Aiming at a small upload box was the hard part of "drag it in".
  return (
    <div
      className={`eac-picker${dragging ? " is-dragging" : ""}`}
      onDragOver={(e) => {
        if (!isMediaDrag(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!isMediaDrag(e)) return;
        e.preventDefault();
        setDragging(false);
        const picture = readMediaDrop(e);
        if (picture) {
          setError(null);
          onChange(picture.url);
        } else {
          void upload(e.dataTransfer.files?.[0]);
        }
      }}
    >
      <div className="eac-picker-label">
        <span>{label}</span>
        {sources.length > 0 && (
          <span className="eac-picker-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "upload"}
              className={tab === "upload" ? "is-active" : undefined}
              onClick={() => setTab("upload")}
            >
              Upload
            </button>
            {sources.map((source) => (
              <button
                key={source.key}
                type="button"
                role="tab"
                aria-selected={tab === source.key}
                className={tab === source.key ? "is-active" : undefined}
                onClick={() => setTab(source.key)}
              >
                {source.label}
              </button>
            ))}
          </span>
        )}
      </div>

      {value && (
        <div className="eac-picker-current">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" />
          <button type="button" onClick={() => onChange("")} className="eac-picker-clear">
            Remove
          </button>
        </div>
      )}
      {dragging ? <p className="eac-picker-dropnote">Drop to use this picture</p> : null}

      {tab === "upload" ? (
        <div
          className={`eac-picker-drop${dragging ? " is-dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <p>{busy ? "Uploading…" : "Drop a file here, or click to choose"}</p>
          {hint && <p className="eac-picker-hint">{hint}</p>}
        </div>
      ) : activeSource ? (
        // Keyed by source: another person's folder never flashes up under
        // the wrong tab while the new one loads.
        <MediaBrowser key={activeSource.key} endpoint={activeSource.endpoint} value={value} onPick={(item) => onChange(item.url)} />
      ) : null}

      {error && <p className="eac-picker-error">{error}</p>}
    </div>
  );
}
