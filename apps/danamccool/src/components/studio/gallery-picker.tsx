"use client";

import { FieldLabel } from "@puckeditor/core";
import { useEffect, useState } from "react";
import { listGalleriesForHud, type HudGallery } from "@/lib/gallery-actions";

// The editor's control for a `binds: "gallery"` prop: her galleries as a
// list. Empty = "the gallery linked to this page", which is what most pages
// want and what survives the page being copied to a new address.
export function GalleryPickerField({
  value,
  onChange,
  readOnly,
  field,
  emptyLabel = "This page’s gallery",
}: {
  emptyLabel?: string;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
}) {
  const [galleries, setGalleries] = useState<HudGallery[] | null>(null);
  useEffect(() => {
    listGalleriesForHud().then((res) => setGalleries("error" in res ? [] : res.galleries));
  }, []);
  return (
    <FieldLabel label={field?.label ?? "Gallery"} readOnly={readOnly} el="div">
      <select
        value={value ?? ""}
        disabled={readOnly || galleries === null}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "0.4rem", font: "inherit" }}
        aria-label={field?.label ?? "Gallery"}
      >
        <option value="">{emptyLabel}</option>
        {(galleries ?? []).map((g) => (
          <option key={g.id} value={g.id}>
            {g.title} ({g.itemCount}){g.pagePath ? ` — /${g.pagePath}` : ""}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}
