"use client";

import { MediaPicker } from "@elkdonis/cms-ui/files";
import type { UploadedImage } from "@elkdonis/studio-ui";

/**
 * A piece's pictures: an ordered list (first = cover, move, alt text, remove)
 * and ONE picker to add to it, with the same three sources as the /channel
 * quick form and Para Theater's chooser: Upload (lands in the site's own
 * folder), "This site" (the org's pictures) and "My files" (the signed-in
 * person's own folder, and nobody else's: /api/media/library/mine).
 *
 * Replaces `MultiImageUploader` here (2026-11-17), which could only upload.
 * The save path is unchanged: the URLs go through `cleanImages` in
 * lib/manage-actions.ts, which accepts any `/api/media/EAC_Network/` address.
 */

const LIBRARIES = [
  { key: "site", label: "This site", endpoint: "/api/media/library" },
  { key: "mine", label: "My files", endpoint: "/api/media/library/mine" },
];

export function PieceImages({
  value,
  onChange,
  maxImages = 12,
  disabled = false,
}: {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}) {
  const full = value.length >= maxImages;

  const add = (url: string) => {
    if (!url || full || value.some((v) => v.url === url)) return;
    onChange([...value, { url, alt: "" }]);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {full ? (
        <p className="ktp-m-fine">Maximum of {maxImages} pictures reached. Remove one to add another.</p>
      ) : (
        <MediaPicker
          // No `value`: the picker adds to the list below rather than holding one picture.
          onChange={add}
          uploadEndpoint="/api/media/upload"
          libraries={LIBRARIES}
          label="Add a picture"
          hint={`${value.length}/${maxImages}. The first picture is the cover.`}
          accept="image/*"
          preview="none"
        />
      )}

      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((img, index) => (
            <li key={img.url} className="relative flex flex-col gap-2 rounded-md border border-input bg-card p-2">
              <div className="relative overflow-hidden rounded">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || `Picture ${index + 1}`} className="aspect-square w-full object-cover" />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Cover
                  </span>
                )}
              </div>
              <input
                type="text"
                value={img.alt ?? ""}
                onChange={(e) => onChange(value.map((v, i) => (i === index ? { ...v, alt: e.target.value } : v)))}
                placeholder="Alt text"
                aria-label={`Description of picture ${index + 1}`}
                disabled={disabled}
                className="w-full rounded border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              />
              <div className="flex items-center justify-between gap-1 text-xs">
                <span className="flex gap-1">
                  <button type="button" className="ktp-btn ktp-btn--ghost" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Move picture ${index + 1} earlier`}>
                    ←
                  </button>
                  <button type="button" className="ktp-btn ktp-btn--ghost" disabled={disabled || index === value.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move picture ${index + 1} later`}>
                    →
                  </button>
                </span>
                <button type="button" className="ktp-btn ktp-btn--ghost" disabled={disabled} onClick={() => onChange(value.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
