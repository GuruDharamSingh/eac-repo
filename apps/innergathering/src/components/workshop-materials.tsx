"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Lock, Trash2, Upload } from "lucide-react";
import type { WorkshopMaterial } from "@elkdonis/services";

/**
 * The workshop's materials folder, on the workshop page.
 *
 * Three states, decided by the page: `open` lists the files with download
 * links (the author, the enrolled, editors); `locked` says how many there are
 * and that joining opens them — a count, never the names; `none` renders
 * nothing. Editors also get the desk: drop a file in, take one out. The
 * folder is the same one a participant with a Nextcloud account sees in
 * their own Files, so a guide can equally fill it from the desktop client.
 */
export function WorkshopMaterials({
  threadId,
  materials,
  access,
  canEdit,
}: {
  threadId: string;
  materials: WorkshopMaterial[];
  access: "open" | "locked" | "none";
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (access === "none" && !canEdit) return null;
  if (access === "locked" && materials.length === 0 && !canEdit) return null;

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      setBusy(file.name);
      const body = new FormData();
      body.append("file", file);
      try {
        const res = await fetch(`/api/workshops/${threadId}/materials`, { method: "POST", body });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Could not upload ${file.name}`);
          break;
        }
      } catch {
        setError(`Could not upload ${file.name}`);
        break;
      }
    }
    setBusy(null);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function remove(name: string) {
    if (!confirm(`Remove "${name}" from the materials?`)) return;
    setBusy(name);
    setError(null);
    const res = await fetch(`/api/workshops/${threadId}/materials?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!res.ok) setError("Could not remove that file");
    setBusy(null);
    router.refresh();
  }

  return (
    <section className="ws-materials" aria-label="Materials">
      <div className="ws-materials-head">
        <h2 className="ig-h2" style={{ margin: 0 }}>Materials</h2>
        {access === "locked" && (
          <span className="ws-chip"><Lock className="size-3" aria-hidden /> Participants</span>
        )}
      </div>

      {access === "locked" && !canEdit ? (
        <p className="ws-materials-locked">
          {materials.length === 1 ? "One file" : `${materials.length} files`} for participants.
          Join the workshop to open them.
        </p>
      ) : materials.length === 0 ? (
        <p className="ws-materials-locked">
          {canEdit ? "Nothing here yet. Readings, handouts and recordings you add are for the people in the workshop." : "Nothing has been shared yet."}
        </p>
      ) : (
        <ul className="ws-materials-list">
          {materials.map((m) => (
            <li key={m.name} className="ws-material">
              <FileText className="size-4 shrink-0" aria-hidden />
              <a href={m.url} target="_blank" rel="noreferrer" className="ws-material-name">
                {m.name}
              </a>
              <span className="ws-material-size">{formatSize(m.size)}</span>
              <a href={m.url} download className="ws-material-dl" aria-label={`Download ${m.name}`}>
                <Download className="size-4" aria-hidden />
              </a>
              {canEdit && (
                <button
                  type="button"
                  className="ws-material-rm"
                  onClick={() => remove(m.name)}
                  disabled={busy === m.name}
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="ws-materials-upload">
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
            accept=".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.ppt,.pptx,.xls,.xlsx,.epub,.zip,image/*,audio/*,video/*"
          />
          <button
            type="button"
            className="eac-btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            <Upload className="size-4" aria-hidden /> {busy ? `Uploading ${busy}…` : "Add files"}
          </button>
          <span className="ws-materials-hint">
            Also in the org&rsquo;s cloud at <code>workshops/{threadId}/materials</code>.
          </span>
        </div>
      )}

      {error && <p className="ws-materials-error" role="alert">{error}</p>}
    </section>
  );
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
