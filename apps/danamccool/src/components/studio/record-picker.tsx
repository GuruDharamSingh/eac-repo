"use client";

import { FieldLabel } from "@puckeditor/core";
import { useState } from "react";
import { ArtworkPickerField } from "@/components/studio/artwork-picker";
import { GalleryPickerField } from "@/components/studio/gallery-picker";

// ============================================================================
// "Filled from (live)" — a Card's record, chosen by kind and then by name.
// Stores a reference ("artwork:<id>", "gallery:<id>"), never a copy: the card
// reads the record at every render (lib/card-records.ts).
// ============================================================================

type Kind = "" | "artwork" | "gallery";

function split(v: unknown): { kind: Kind; id: string } {
  const s = typeof v === "string" ? v : "";
  const [k, id = ""] = s.split(":", 2);
  return k === "artwork" || k === "gallery" ? { kind: k, id } : { kind: "", id: "" };
}

export function RecordPickerField({
  value,
  onChange,
  readOnly,
  field,
}: {
  value?: unknown;
  onChange: (v: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
}) {
  const stored = split(value);
  const [kind, setKind] = useState<Kind>(stored.kind);

  return (
    <FieldLabel label={field?.label ?? "Filled from (live)"} el="div">
      <div style={{ display: "grid", gap: 6 }}>
        <select
          value={kind}
          disabled={readOnly}
          onChange={(e) => {
            const k = e.target.value as Kind;
            setKind(k);
            if (k !== stored.kind) onChange("");
          }}
          style={{ width: "100%", padding: "5px 6px", font: "inherit" }}
        >
          <option value="">Nothing — typed by hand</option>
          <option value="artwork">One of her artworks</option>
          <option value="gallery">One of her galleries</option>
        </select>
        {kind === "artwork" ? (
          <ArtworkPickerField
            value={stored.kind === "artwork" ? stored.id : ""}
            readOnly={readOnly}
            field={{ label: "Artwork" }}
            onChange={(id) => onChange(id ? `artwork:${id}` : "")}
          />
        ) : null}
        {kind === "gallery" ? (
          <GalleryPickerField
            value={stored.kind === "gallery" ? stored.id : ""}
            readOnly={readOnly}
            emptyLabel="Choose a gallery"
            field={{ label: "Gallery" }}
            onChange={(id) => onChange(id ? `gallery:${id}` : "")}
          />
        ) : null}
        <p style={{ margin: 0, fontSize: 12, color: "#5b5b5b", lineHeight: 1.4 }}>
          Fields you typed above stay as typed; the record fills the empty ones and keeps them current.
        </p>
      </div>
    </FieldLabel>
  );
}
