"use client";

import * as React from "react";

import { cn } from "./cn";

export type UploadedImage = {
  /** DB media id when persisted, else undefined for fresh uploads. */
  id?: string;
  /** Browser-resolvable URL (usually an /api/media proxy path). */
  url: string;
  /** Nextcloud relative path, if returned by the upload endpoint. */
  path?: string;
  /** Nextcloud file id, if returned by the upload endpoint. */
  nextcloudFileId?: string;
  /** Per-image alt text. */
  alt?: string;
};

export type MultiImageUploaderProps = {
  /** Ordered list of uploaded images. Index 0 is the cover/primary image. */
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** Multipart endpoint that accepts a `file` field and returns `{ url, path?, id? }`. */
  uploadEndpoint?: string;
  /** Extra form fields sent with every upload (e.g. { orgId }). */
  uploadFields?: Record<string, string>;
  maxImages?: number;
  disabled?: boolean;
  className?: string;
};

type Pending = { tempId: string; name: string; error?: string };

const ACCEPT = "image/*";

/**
 * Multi-image uploader with drag-to-reorder, set-as-cover, per-image alt text,
 * and remove. Uploads each file to a configurable endpoint and keeps a
 * controlled, ordered list of descriptors. Framework-neutral (Tailwind only).
 */
export function MultiImageUploader({
  value,
  onChange,
  uploadEndpoint = "/api/upload",
  uploadFields,
  maxImages = 12,
  disabled = false,
  className,
}: MultiImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const dragIndex = React.useRef<number | null>(null);

  const remaining = Math.max(0, maxImages - value.length - pending.length);

  const uploadOne = React.useCallback(
    async (file: File) => {
      const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPending((p) => [...p, { tempId, name: file.name }]);
      try {
        const form = new FormData();
        form.append("file", file);
        if (uploadFields) {
          for (const [k, v] of Object.entries(uploadFields)) form.append(k, v);
        }
        const res = await fetch(uploadEndpoint, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || `Upload failed (${res.status})`);
        }
        const data = (await res.json()) as {
          url: string;
          path?: string;
          id?: string;
          nextcloudFileId?: string;
        };
        const img: UploadedImage = {
          id: data.id,
          url: data.url,
          path: data.path,
          nextcloudFileId: data.nextcloudFileId,
          alt: "",
        };
        // Append using the latest value via functional update on parent.
        onChange([...latest.current, img]);
        setPending((p) => p.filter((x) => x.tempId !== tempId));
      } catch (err) {
        setPending((p) =>
          p.map((x) =>
            x.tempId === tempId
              ? { ...x, error: err instanceof Error ? err.message : "Failed" }
              : x
          )
        );
      }
    },
    [onChange, uploadEndpoint, uploadFields]
  );

  // Keep a ref to the freshest value so concurrent uploads don't clobber order.
  const latest = React.useRef(value);
  React.useEffect(() => {
    latest.current = value;
  }, [value]);

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);
      for (const f of list) void uploadOne(f);
    },
    [remaining, uploadOne]
  );

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  const setCover = (index: number) => move(index, 0);
  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));
  const setAlt = (index: number, alt: string) =>
    onChange(value.map((img, i) => (i === index ? { ...img, alt } : img)));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled || remaining === 0}
        onClick={() => !disabled && remaining > 0 && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && remaining > 0) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && remaining > 0) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled && remaining > 0 && e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-8 text-center text-sm transition-colors",
          remaining === 0 || disabled
            ? "cursor-not-allowed border-input bg-muted/30 text-muted-foreground"
            : "cursor-pointer border-input bg-transparent text-muted-foreground hover:border-ring hover:text-foreground",
          isDragOver && "border-ring bg-accent/40 text-foreground"
        )}
      >
        <span className="font-medium">
          {remaining === 0
            ? `Maximum of ${maxImages} images reached`
            : "Drop images here or click to upload"}
        </span>
        <span className="text-xs">
          {value.length + pending.length}/{maxImages} • first image is the cover
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          disabled={disabled || remaining === 0}
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Grid of uploaded + pending tiles */}
      {(value.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((img, index) => (
            <li
              key={img.id ?? img.url}
              draggable={!disabled}
              onDragStart={() => (dragIndex.current = index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex.current != null) {
                  move(dragIndex.current, index);
                  dragIndex.current = null;
                }
              }}
              className={cn(
                "group relative flex flex-col gap-2 rounded-md border border-input bg-card p-2",
                !disabled && "cursor-grab active:cursor-grabbing"
              )}
            >
              <div className="relative overflow-hidden rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt || `Image ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Cover
                  </span>
                )}
              </div>

              <input
                type="text"
                value={img.alt ?? ""}
                onChange={(e) => setAlt(index, e.target.value)}
                placeholder="Alt text"
                disabled={disabled}
                className="w-full rounded border border-input bg-transparent px-2 py-1 text-xs outline-none focus:ring-[2px] focus:ring-ring/50"
              />

              <div className="flex items-center justify-between gap-1">
                {index !== 0 ? (
                  <button
                    type="button"
                    onClick={() => setCover(index)}
                    disabled={disabled}
                    className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Set cover
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="rounded px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}

          {pending.map((p) => (
            <li
              key={p.tempId}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-muted/30 p-2 text-center text-[11px] text-muted-foreground"
            >
              {p.error ? (
                <>
                  <span className="text-destructive">Failed</span>
                  <span className="line-clamp-2">{p.error}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPending((list) =>
                        list.filter((x) => x.tempId !== p.tempId)
                      )
                    }
                    className="mt-1 rounded px-1.5 py-0.5 hover:bg-accent"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <span className="line-clamp-2">{p.name}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
