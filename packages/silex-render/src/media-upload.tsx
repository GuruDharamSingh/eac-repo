"use client";

import { useRef, useState } from "react";

type Uploaded = { url: string; name: string };

/**
 * Client half of the `media-upload` embed.
 *
 * The server component decides *whether* this renders at all (signed in, and a
 * member of this org). This component only does the transfer, so it carries no
 * authorisation logic of its own — /api/upload/image re-checks both, because a
 * client-side gate is a UI affordance and never a security boundary.
 */
export function MediaUploadWidget({
  orgSlug,
  accept = "image/*,video/*",
}: {
  orgSlug: string;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);

    const done: Uploaded[] = [];
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        body.append("orgSlug", orgSlug);

        const res = await fetch("/api/upload/image", { method: "POST", body });
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(payload?.error ?? `Upload failed (${res.status})`);
        }
        done.push({ url: payload.url, name: file.name });
      }
      setUploaded((prev) => [...done, ...prev]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <label
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-6 text-center transition hover:bg-muted/50 ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          disabled={busy}
          onChange={(e) => void upload(e.target.files)}
        />
        <span className="text-sm font-medium text-foreground">
          {busy ? "Uploading…" : "Choose images or video"}
        </span>
        <span className="text-xs text-muted-foreground">
          Images up to 10 MB · video up to 500 MB
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {uploaded.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {uploaded.map((item) => (
            <li
              key={item.url}
              className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt=""
                className="h-12 w-12 shrink-0 rounded object-cover"
                onError={(e) => {
                  // Videos have no thumbnail at this URL; drop the broken icon.
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {item.name}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener"
                className="shrink-0 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                View
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
