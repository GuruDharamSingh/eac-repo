"use client";

import { useState } from "react";

/**
 * Real file upload for the admin directory form, replacing a plain
 * "paste an image URL" text input. Uploads to Nextcloud via /api/upload
 * (see that route's two modes — this works for both an existing member and
 * a not-yet-saved draft, keyed by `memberSlug`) and hands the resulting
 * proxy URL back to the caller; the caller still owns the actual field
 * (portrait_url, or an artworksText line) so this stays a plain upload
 * widget rather than a bigger form-state entanglement.
 */
export function ImageUploadField({
  memberSlug,
  onUploaded,
  label = "Upload image",
  target = "avatar",
}: {
  memberSlug: string;
  onUploaded: (url: string, filename: string) => void;
  label?: string;
  /** "avatar" (default): just returns a URL, doesn't touch portfolio — this
   *  field's own onUploaded callback decides where the URL goes. "gallery"
   *  additionally appends to users.portfolio server-side. */
  target?: "avatar" | "gallery";
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!memberSlug.trim()) {
      setError("Set a name or slug first, so the file has somewhere to go.");
      return;
    }
    setUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("memberSlug", memberSlug.trim());
    formData.append("target", target);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Upload failed.");
      return;
    }
    onUploaded(data.url, data.filename);
  }

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        disabled={uploading}
        onChange={(e) => handleFile(e.currentTarget.files?.[0])}
      />
      {uploading && <span className="small-note"> Uploading…</span>}
      {error && <div className="form-status" aria-live="polite">{error}</div>}
    </div>
  );
}
