"use client";

import { useState } from "react";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@elkdonis/primitives";

export interface MaterialItem {
  /** media.id — what gets attached to the thread on save. */
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface MaterialsFieldProps {
  value: MaterialItem[];
  onChange: (items: MaterialItem[]) => void;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Files that belong to a gathering — the Jap Ji PDF, a song sheet, an order of
 * service. Uploaded to the org's Nextcloud folder and attached to the thread
 * on save (media.attached_to_type / attached_to_id).
 *
 * Separate from the cover image on purpose: one is how the page looks, these
 * are what someone needs in hand at 4am.
 */
export function MaterialsField({ value, onChange }: MaterialsFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function uploadAll(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        body.append("visibility", "PUBLIC");

        const res = await fetch("/api/upload", { method: "POST", body });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.url) {
          toast.error(`${file.name}: ${data.error ?? "upload failed"}`);
          continue;
        }

        onChange([
          ...value,
          {
            id: data.id,
            url: data.url,
            filename: data.filename ?? file.name,
            mimeType: data.mimeType ?? file.type,
            size: data.size ?? file.size,
          },
        ]);
      }
    } catch {
      toast.error("Upload failed — could not reach the server.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.filename}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {humanSize(item.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove ${item.filename}`}
                onClick={() => onChange(value.filter((f) => f.id !== item.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) void uploadAll(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-accent/30" : "border-border hover:bg-accent/20"
        )}
      >
        <input
          type="file"
          multiple
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files?.length) void uploadAll(e.target.files);
            e.target.value = "";
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-sm text-muted-foreground">Uploading…</span>
          </>
        ) : (
          <>
            <Paperclip className="size-5 text-muted-foreground" aria-hidden />
            <span className="text-sm">Add materials — PDFs, sheets, audio</span>
            <span className="text-xs text-muted-foreground">
              Drop files here or click. Shown as downloads on the page.
            </span>
          </>
        )}
      </label>
    </div>
  );
}
