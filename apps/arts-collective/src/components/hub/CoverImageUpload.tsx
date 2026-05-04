"use client";

import * as React from "react";
import { ImageIcon, VideoIcon, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MediaKind = "image" | "video";

type Props = {
  orgSlug: string;
  kind?: MediaKind;
  value?: string;
  onChange: (url: string | undefined) => void;
};

const CONFIG: Record<MediaKind, { accept: string; label: string; hint: string; maxMb: number; Icon: React.ElementType }> = {
  image: {
    accept: "image/*",
    label: "Drop an image or click to upload",
    hint: "PNG, JPG, WebP — max 10 MB",
    maxMb: 10,
    Icon: ImageIcon,
  },
  video: {
    accept: "video/*",
    label: "Drop a video or click to upload",
    hint: "MP4, MOV, WebM — max 500 MB",
    maxMb: 500,
    Icon: VideoIcon,
  },
};

export function CoverImageUpload({ orgSlug, kind = "image", value, onChange }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cfg = CONFIG[kind];

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("orgSlug", orgSlug);
      const res = await fetch("/api/upload/image", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const expectedPrefix = kind === "image" ? "image/" : "video/";
    if (!file.type.startsWith(expectedPrefix)) {
      setError(`${kind === "image" ? "Images" : "Videos"} only`);
      return;
    }
    upload(file);
  }

  const { Icon } = cfg;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={cfg.accept}
        className="hidden"
        onChange={onFileChange}
      />

      {value ? (
        <div className="relative w-full overflow-hidden rounded-md border border-border bg-muted">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-48 w-full object-cover" />
          ) : (
            <video
              src={value}
              className="h-48 w-full object-contain bg-black"
              controls={false}
              muted
            />
          )}
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1 h-3 w-3" />
              {uploading ? "Uploading…" : "Change"}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-7 w-7"
              onClick={() => onChange(undefined)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "flex h-48 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground transition-colors hover:bg-muted/60",
            isDragging && "border-foreground bg-muted/60",
            uploading && "cursor-wait opacity-60"
          )}
        >
          <Icon className="h-8 w-8 opacity-40" />
          {uploading ? (
            <span>Uploading…</span>
          ) : (
            <>
              <span className="font-medium">{cfg.label}</span>
              <span className="text-xs">{cfg.hint}</span>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
