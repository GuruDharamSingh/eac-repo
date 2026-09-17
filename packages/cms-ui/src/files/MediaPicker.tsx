"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [library, setLibrary] = useState<MediaPickerItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeSource = sources.find((s) => s.key === tab);

  const loadLibrary = useCallback(async () => {
    if (!activeSource) return;
    setError(null);
    try {
      const res = await fetch(activeSource.endpoint);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not load the library");
      // Accept either shape: /api/media/library returns `items`, the
      // per-person /api/my-files returns `files`.
      const raw: unknown[] = body.items ?? body.files ?? [];
      setLibrary(
        raw
          .map((r) => r as Record<string, unknown>)
          .filter((r) => typeof r.url === "string" && !r.isFolder)
          .map((r) => ({
            url: String(r.url),
            name: String(r.name ?? r.filename ?? r.url),
          }))
      );
    } catch (err) {
      setLibrary([]);
      setError((err as Error).message);
    }
  }, [activeSource]);

  useEffect(() => {
    if (activeSource && library === null) void loadLibrary();
  }, [activeSource, library, loadLibrary]);

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
      // A newly uploaded file belongs in the library too — drop the cache so
      // reopening that tab shows it rather than a stale list.
      setLibrary(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="eac-picker">
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
                onClick={() => {
                  // Drop the cache on the way in, or the new tab briefly shows
                  // the previous source's files — which look plausible and are
                  // the wrong person's.
                  if (tab !== source.key) setLibrary(null);
                  setTab(source.key);
                }}
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

      {tab === "upload" ? (
        <div
          className={`eac-picker-drop${dragging ? " is-dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files?.[0]);
          }}
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
      ) : library === null ? (
        <p className="eac-picker-hint">Loading…</p>
      ) : library.length === 0 ? (
        <p className="eac-picker-hint">Nothing stored yet.</p>
      ) : (
        <ul className="eac-picker-grid">
          {library.map((item) => (
            <li key={item.url}>
              <button
                type="button"
                onClick={() => onChange(item.url)}
                className={item.url === value ? "is-selected" : undefined}
                title={item.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="eac-picker-error">{error}</p>}
    </div>
  );
}
