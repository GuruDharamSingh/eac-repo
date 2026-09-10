"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Files" — a person's cloud storage, on any hub page.
 *
 * Framework-neutral on purpose. @elkdonis/ui's MediaUpload and FileBrowser are
 * Mantine, and arts-collective is a Tailwind app with no MantineProvider, so
 * dropping those in would either not render or drag Mantine into a codebase
 * that deliberately stayed on shadcn. This is plain CSS driven by custom
 * properties (see files-card.css), same posture as ProfileView, so it renders
 * correctly on every hub regardless of stack.
 *
 * It talks to /api/my-files, which resolves the owner from the session — this
 * component never names a user, so it cannot be pointed at someone else's
 * storage.
 */

export interface FilesCardEntry {
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string | null;
  lastModified: string | null;
  isFolder: boolean;
}

/**
 * One place a person's files can come from.
 *
 * A hub shows more than one: your own storage AND the org's team folder are
 * both "files" to the person looking at them, and making them two separate
 * cards means you have to know which tree a file is in before you can look
 * for it.
 */
export interface FilesCardSource {
  id: string;
  label: string;
  /** Endpoint implementing GET/POST/DELETE for this tree. */
  endpoint: string;
  /** Start inside a subfolder of this source. */
  initialPath?: string;
  /** False for a tree this person may browse but not write to. */
  canUpload?: boolean;
}

export interface FilesCardProps {
  /** Endpoint implementing GET/POST/DELETE. Override per app if mounted elsewhere. */
  endpoint?: string;
  /**
   * Two or more trees, shown as a switcher. Takes precedence over `endpoint`.
   * Typically the person's own `EAC_Network/users/<slug>/` and the org's
   * team folder.
   */
  sources?: FilesCardSource[];
  /** Bucket new uploads land in. */
  folder?: "Images" | "Audio" | "Videos" | "Documents";
  title?: string;
  /** Start inside a subfolder, e.g. "Media/Images". */
  initialPath?: string;
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n < 10 && u > 0 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
}

const isImage = (e: FilesCardEntry) =>
  (e.mimeType ?? "").startsWith("image/") ||
  /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(e.name);

export function FilesCard({
  endpoint = "/api/my-files",
  sources,
  folder = "Images",
  title = "Files",
  initialPath = "",
}: FilesCardProps) {
  // A single endpoint is just a one-source list, so the rest of the component
  // has one shape to reason about.
  const resolved: FilesCardSource[] =
    sources?.length
      ? sources
      : [{ id: "mine", label: "My files", endpoint, initialPath, canUpload: true }];

  const [sourceId, setSourceId] = useState(resolved[0]!.id);
  const source = resolved.find((s) => s.id === sourceId) ?? resolved[0]!;
  const activeEndpoint = source.endpoint;
  const canUpload = source.canUpload !== false;

  const [path, setPath] = useState(source.initialPath ?? initialPath);
  const [entries, setEntries] = useState<FilesCardEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "uploading">("loading");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (next: string) => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`${activeEndpoint}?path=${encodeURIComponent(next)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Could not load your files");
        setEntries(body.files ?? []);
      } catch (err) {
        setError((err as Error).message);
        setEntries([]);
      } finally {
        setStatus("idle");
      }
    },
    [activeEndpoint]
  );

  useEffect(() => {
    void load(path);
  }, [load, path]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setStatus("uploading");
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const res = await fetch(activeEndpoint, { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `Could not upload ${file.name}`);
      }
      // Uploads always land in Media/<folder>; show that so the file just
      // added is actually visible rather than silently elsewhere.
      const dest = `Media/${folder}`;
      if (path === dest) await load(path);
      else setPath(dest);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatus("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(entry: FilesCardEntry) {
    const rel = entry.path.replace(/^.*?\/users\/[^/]+\//, "");
    setError(null);
    try {
      const res = await fetch(`${endpoint}?path=${encodeURIComponent(rel)}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Could not delete");
      await load(path);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const crumbs = path.split("/").filter(Boolean);

  return (
    <section className="eac-files" aria-label={title}>
      <header className="eac-files-head">
        <div>
          <h2>{title}</h2>
          <p className="eac-files-sub">
            {resolved.length > 1
              ? "Your own storage and the folders you share."
              : "Your own storage on the collective."}
          </p>
        </div>
        {canUpload && (
          <label className="eac-files-upload">
            {status === "uploading" ? "Uploading…" : "Upload"}
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => void upload(e.target.files)}
              disabled={status === "uploading"}
            />
          </label>
        )}
      </header>

      {resolved.length > 1 && (
        <div className="eac-picker-tabs" role="tablist" aria-label="Which files">
          {resolved.map((src) => (
            <button
              key={src.id}
              type="button"
              role="tab"
              aria-selected={src.id === sourceId}
              className={src.id === sourceId ? "is-active" : undefined}
              onClick={() => {
                setSourceId(src.id);
                // Each tree has its own root: carrying the current folder
                // across would ask one source for the other's path.
                setPath(src.initialPath ?? "");
              }}
            >
              {src.label}
            </button>
          ))}
        </div>
      )}

      <nav className="eac-files-crumbs" aria-label="Folder path">
        <button type="button" onClick={() => setPath("")} disabled={!path}>
          Home
        </button>
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`}>
            <span aria-hidden> / </span>
            <button
              type="button"
              onClick={() => setPath(crumbs.slice(0, i + 1).join("/"))}
              disabled={i === crumbs.length - 1}
            >
              {c}
            </button>
          </span>
        ))}
      </nav>

      {error && <p className="eac-files-error">{error}</p>}

      {status === "loading" ? (
        <p className="eac-files-empty">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="eac-files-empty">
          Nothing here yet. Upload something to get started.
        </p>
      ) : (
        <ul className="eac-files-list">
          {entries.map((e) => (
            <li key={e.path} className="eac-files-item">
              {e.isFolder ? (
                <button
                  type="button"
                  className="eac-files-name eac-files-folder"
                  onClick={() => setPath(path ? `${path}/${e.name}` : e.name)}
                >
                  {e.name}
                </button>
              ) : (
                <>
                  {isImage(e) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="eac-files-thumb" src={e.url} alt="" loading="lazy" />
                  ) : (
                    <span className="eac-files-thumb eac-files-thumb--none" aria-hidden />
                  )}
                  <a className="eac-files-name" href={e.url} target="_blank" rel="noreferrer">
                    {e.name}
                  </a>
                </>
              )}
              <span className="eac-files-size">{e.isFolder ? "" : formatSize(e.size)}</span>
              {!e.isFolder && (
                <button
                  type="button"
                  className="eac-files-remove"
                  onClick={() => void remove(e)}
                  aria-label={`Delete ${e.name}`}
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
