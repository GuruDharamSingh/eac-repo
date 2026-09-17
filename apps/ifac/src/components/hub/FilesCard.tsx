"use client";

import { useCallback, useRef, useState } from "react";
import { SurfaceCard, SurfaceFrame, type SurfaceDescriptor } from "@elkdonis/cms-ui/surface";
import { formatBytes, formatDay } from "./format";

export type HubFile = {
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string | null;
  lastModified: string | null;
  isFolder: boolean;
};

/**
 * The group's shared drive.
 *
 * Paths handled here are RELATIVE to the org root — the API never accepts an
 * absolute one and never returns the org id in a navigable form. That is the
 * difference from every existing file browser in the repo, each of which
 * builds `EAC_Network/<org>` on the client and then has to guard it there.
 * Here the client cannot express a path outside the drive.
 *
 * Not built on @elkdonis/ui's FileBrowser: that component is Mantine, and
 * IFAC has deliberately never taken a UI dependency. The data layer it would
 * have brought (useNextcloudFiles) speaks a different response shape and a
 * POST-with-action protocol this route doesn't use for reads.
 */
/*
 * REVERTED 2026-09-16. This briefly became a header-led face with an
 * IFAC/Mine drive switch and a grid of thumbnails. It broke the card: the
 * preview was wrapped in `.eac-face-live` so the thumbnails could be hovered,
 * which re-enabled pointer events across the whole body — and a face is a
 * stretched hit-area BEHIND inert content, so making the content live means
 * clicking the card no longer opens anything. The drive switch is a good idea
 * and belongs in the surface, where there is room for it and nothing to
 * swallow. The face's job is to open that surface.
 */
export function FilesFace({
  initialFiles,
  canEdit,
}: {
  initialFiles: HubFile[];
  canEdit: boolean;
}) {
  return (
    <SurfaceCard
      kind="gallery"
      // Not ▦ — that is the calendar's mark, and two tiles wearing the same
      // glyph in one grid is the one thing a glyph exists to prevent.
      glyph="▩"
      // The default kicker is the KIND's label, which here is "Gallery" — a
      // card titled "Files" was announcing itself as a gallery.
      kicker="Shared drive"
      title="Files"
      blurb="Everything the group keeps together — images, documents, audio."
      surface={{
        type: "custom",
        key: "files",
        title: "Files",
        kind: "gallery",
        size: "wide",
        props: { files: initialFiles, canEdit },
      }}
      preview={
        initialFiles.length ? (
          <>
            {initialFiles.slice(0, 4).map((file) => (
              <span key={file.path} className="eac-preview-line">
                <span aria-hidden>{file.isFolder ? "▸" : "·"}</span> {file.name}
              </span>
            ))}
          </>
        ) : (
          <span className="eac-preview-empty">The drive is empty</span>
        )
      }
    />
  );
}

/** A mark per kind, for everything that cannot show itself. */
function tileGlyph(file: HubFile): string {
  const mime = file.mimeType ?? "";
  if (mime.startsWith("video/")) return "▶";
  if (mime.startsWith("audio/")) return "♪";
  if (mime === "application/pdf") return "▤";
  if (mime.startsWith("text/") || mime.includes("word") || mime.includes("document")) return "▭";
  return "▫";
}

export function FilesSurface({
  descriptor,
}: {
  descriptor: Extract<SurfaceDescriptor, { type: "custom" }>;
}) {
  const initialFiles = (descriptor.props?.files as HubFile[] | undefined) ?? [];
  const canEdit = Boolean(descriptor.props?.canEdit);
  const [path, setPath] = useState("");
  const [files, setFiles] = useState(initialFiles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (next: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/hub/files?path=${encodeURIComponent(next)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not open that folder.");
        return;
      }
      setFiles(data.files ?? []);
      setPath(next);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Path segments, for breadcrumbs. Empty string is the drive root. */
  const segments = path.split("/").filter(Boolean);

  /** Turn an absolute returned path back into one relative to the root. */
  const relativeOf = (absolute: string) => {
    const parts = absolute.split("/");
    // The API returns `EAC_Network/<org>/…`; drop those two.
    return parts.slice(2).join("/");
  };

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      // Upload into the folder being looked at, which is what a member means
      // by "add a file" while standing in one.
      if (path) form.set("path", path);
      const res = await fetch("/api/hub/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      await load(path);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <SurfaceFrame kind="gallery" title="Files" kicker="Shared drive">
      <div className="hub-panel">
        <nav className="hub-crumbs" aria-label="Folder path">
          <button
            type="button"
            className="hub-crumb"
            onClick={() => load("")}
            disabled={!path}
          >
            IFAC
          </button>
          {segments.map((segment, index) => (
            <button
              key={`${segment}-${index}`}
              type="button"
              className="hub-crumb"
              onClick={() => load(segments.slice(0, index + 1).join("/"))}
              disabled={index === segments.length - 1}
            >
              {segment}
            </button>
          ))}
        </nav>

        {error && (
          <p className="hub-error" role="alert">
            {error}
          </p>
        )}

        {/* A grid, not a list. This is a MEDIA drive — most of what is in it
            is an image, and an image shows itself. A column of filenames
            differing only in their extension is the one presentation a
            picture replaces outright. Anything that is not an image gets a
            mark for its kind, which is still faster to scan than a name. */}
        <ul className="hub-grid-files" aria-busy={loading}>
          {files.length === 0 && !loading && (
            <li className="hub-muted">This folder is empty.</li>
          )}
          {files.map((file) => (
            <li key={file.path} className="hub-grid-cell">
              {file.isFolder ? (
                <button
                  type="button"
                  className="hub-tile hub-tile--folder"
                  onClick={() => load(relativeOf(file.path))}
                  title={file.name}
                >
                  <span className="hub-tile-face" aria-hidden>
                    ▸
                  </span>
                  <span className="hub-tile-name">{file.name}</span>
                </button>
              ) : (
                <a
                  className="hub-tile"
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`${file.name}${
                    formatBytes(file.size) ? ` — ${formatBytes(file.size)}` : ""
                  }`}
                >
                  <span className="hub-tile-face">
                    {file.mimeType?.startsWith("image/") ? (
                      // `?w=` asks the media route for a variant rather than
                      // the master — a 3MB original behind a 90px tile is the
                      // difference between a grid that paints and one that
                      // hangs.
                      <img
                        src={`${file.url}${file.url.includes("?") ? "&" : "?"}w=200`}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <span aria-hidden>{tileGlyph(file)}</span>
                    )}
                  </span>
                  <span className="hub-tile-name">{file.name}</span>
                  <span className="hub-tile-meta">
                    {[formatBytes(file.size), formatDay(file.lastModified)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="hub-panel-actions">
          <input
            ref={fileInput}
            type="file"
            id="hub-file-upload"
            className="hub-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <label className="hub-btn hub-btn--primary" htmlFor="hub-file-upload">
            {uploading ? "Uploading…" : "Add a file here"}
          </label>
          {canEdit && (
            <NewFolderButton
              onCreate={async (name) => {
                const target = path ? `${path}/${name}` : name;
                const res = await fetch("/api/hub/files", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "createFolder", path: target }),
                });
                if (res.ok) await load(path);
                else setError((await res.json()).error ?? "Could not create it.");
              }}
            />
          )}
        </div>
      </div>
    </SurfaceFrame>
  );
}

/**
 * Inline rather than window.prompt: prompt() is blocked in some browsers when
 * fired from inside a <dialog>, which is exactly where this lives.
 */
function NewFolderButton({
  onCreate,
}: {
  onCreate: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button type="button" className="hub-btn" onClick={() => setOpen(true)}>
        New folder
      </button>
    );
  }

  return (
    <span className="hub-inline-form">
      <input
        className="hub-input"
        value={name}
        autoFocus
        placeholder="Folder name"
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        className="hub-btn hub-btn--primary"
        onClick={async () => {
          const trimmed = name.trim();
          if (!trimmed) return;
          await onCreate(trimmed);
          setName("");
          setOpen(false);
        }}
      >
        Create
      </button>
      <button type="button" className="hub-btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </span>
  );
}
