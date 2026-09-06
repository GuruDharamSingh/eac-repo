"use client";

import { useCallback, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface LibraryItem {
  url: string;
  filename: string;
  source: "upload" | "nextcloud";
}

interface MediaFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
}

/**
 * Pick an image: upload a new one, or choose something already in the org's
 * Nextcloud folder (EAC_Network/<org>/Media/Images).
 *
 * Replaces the plain URL text box the form used to have — pasting a URL meant
 * either hotlinking someone else's server or uploading elsewhere first.
 *
 * The Mantine MediaUpload/FileBrowser in @elkdonis/ui do this already, but
 * this app is deliberately Mantine-free, so this is the shadcn equivalent.
 */
export function MediaField({ value, onChange, label = "Image", hint }: MediaFieldProps) {
  const [library, setLibrary] = useState<LibraryItem[] | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/media/library");
      const data = await res.json();
      setLibrary(res.ok ? (data.items ?? []) : []);
      if (!res.ok) toast.error(data.error ?? "Could not load the library.");
    } catch {
      setLibrary([]);
      toast.error("Could not load the library.");
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("That doesn't look like an image.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      // Cover images are shown to the public, so they belong in the public
      // Media folder rather than Private.
      body.append("visibility", "PUBLIC");

      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }

      onChange(data.url);
      setLibrary(null); // stale now
      toast.success("Uploaded.");
    } catch {
      toast.error("Upload failed — could not reach the server.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>

      {value ? (
        <div className="flex items-start gap-4 rounded-lg border border-border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="size-24 shrink-0 rounded-md border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">{value}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => onChange("")}
            >
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Tabs
          defaultValue="upload"
          onValueChange={(v) => {
            if (v === "library" && library === null) void loadLibrary();
          }}
        >
          <TabsList>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void upload(file);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                dragging ? "border-primary bg-accent/30" : "border-border hover:bg-accent/20"
              )}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              {uploading ? (
                <>
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
                  <span className="text-sm text-muted-foreground">Uploading…</span>
                </>
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" aria-hidden />
                  <span className="text-sm">Drop an image here, or click to choose</span>
                  <span className="text-xs text-muted-foreground">
                    Saved to the site&rsquo;s media folder. Up to 25 MB.
                  </span>
                </>
              )}
            </label>
          </TabsContent>

          <TabsContent value="library">
            {loadingLibrary ? (
              <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </p>
            ) : !library || library.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <ImageIcon className="mx-auto mb-2 size-6" aria-hidden />
                Nothing in the library yet. Upload an image and it will appear here.
              </p>
            ) : (
              <ul className="grid max-h-72 grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4">
                {library.map((item) => (
                  <li key={item.url}>
                    <button
                      type="button"
                      onClick={() => onChange(item.url)}
                      title={item.filename}
                      className="group w-full overflow-hidden rounded-md border border-border transition hover:border-primary"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.filename}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                      <span className="block truncate px-1.5 py-1 text-[0.65rem] text-muted-foreground">
                        {item.filename}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
