"use client";

import { FieldLabel } from "@puckeditor/core";
import { useEffect, useMemo, useState } from "react";
import type { ArtworkItem } from "@/blocks/artwork-data";

// ============================================================================
// The editor's control for a `binds: "artwork"` prop.
//
// What the page stores is only the artwork's id; this is how an author picks
// one without ever seeing an id: her pieces as thumbnails, searchable by
// title, each marked for sale / sold / portfolio so it is plain what the
// visitor will be offered. "Remove" unbinds, and the block falls back to
// whatever was typed by hand.
//
// Puck applies no FieldLabel to a custom field, so it is drawn here.
// ============================================================================

let cache: Promise<ArtworkItem[]> | null = null;

function loadAll(): Promise<ArtworkItem[]> {
  cache ??= fetch("/api/blocks/artworks?picker=1")
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((b: { items?: ArtworkItem[] }) => b.items ?? [])
    .catch(() => {
      cache = null; // let the next open try again
      return [];
    });
  return cache;
}

const STATUS: Record<ArtworkItem["status"], string> = {
  available: "For sale",
  reserved: "Reserved",
  sold: "Sold",
  portfolio: "Not for sale",
};

function thumb(src: string | null): string | undefined {
  if (!src) return undefined;
  return src.startsWith("/api/media/") ? `${src}?w=256` : src;
}

export function ArtworkPickerField({
  value,
  onChange,
  readOnly,
  field,
}: {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
}) {
  const [items, setItems] = useState<ArtworkItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    loadAll().then((all) => live && setItems(all));
    return () => {
      live = false;
    };
  }, []);

  const current = useMemo(() => items?.find((i) => i.id === value) ?? null, [items, value]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = items ?? [];
    return q ? all.filter((i) => `${i.title} ${i.year ?? ""} ${i.medium ?? ""}`.toLowerCase().includes(q)) : all;
  }, [items, query]);

  const box: React.CSSProperties = {
    display: "flex",
    gap: "0.6rem",
    alignItems: "center",
    padding: "0.4rem",
    border: "1px solid var(--puck-color-border, #ddd)",
    borderRadius: 6,
    background: "var(--puck-color-surface, #fff)",
  };
  const small: React.CSSProperties = { fontSize: 12, opacity: 0.75 };
  const button: React.CSSProperties = {
    font: "inherit",
    fontSize: 13,
    padding: "0.3rem 0.6rem",
    border: "1px solid var(--puck-color-border, #ccc)",
    borderRadius: 4,
    background: "transparent",
    cursor: "pointer",
  };

  return (
    // el="div": a <label> hands a click on its text to the first control
    // inside it, so tapping the heading would have fired "Change".
    <FieldLabel label={field?.label ?? "Artwork"} readOnly={readOnly} el="div">
      {value && !current && items !== null ? (
        // Bound to something no longer shown on her site (unlisted and not
        // kept as portfolio). Say so rather than looking unbound.
        <div style={{ ...box, justifyContent: "space-between" }}>
          <span style={small}>This artwork is no longer shown on the site.</span>
          {!readOnly ? (
            <button type="button" style={button} onClick={() => onChange("")}>
              Remove
            </button>
          ) : null}
        </div>
      ) : current ? (
        <div style={box}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(current.image)} alt="" width={48} height={48} style={{ objectFit: "cover", borderRadius: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
              {current.title}
              {current.year ? `, ${current.year}` : ""}
            </div>
            <div style={small}>{STATUS[current.status]}</div>
          </div>
          {!readOnly ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <button type="button" style={button} onClick={() => setOpen((o) => !o)}>
                Change
              </button>
              <button type="button" style={button} onClick={() => onChange("")}>
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ) : !readOnly ? (
        <button type="button" style={{ ...button, width: "100%" }} onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "Choose an artwork…"}
        </button>
      ) : (
        <span style={small}>None</span>
      )}

      {open && !readOnly ? (
        <div style={{ marginTop: 8 }}>
          <input
            type="search"
            placeholder="Search her artworks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", padding: "0.4rem", font: "inherit", fontSize: 13, marginBottom: 6 }}
            aria-label="Search her artworks"
          />
          {items === null ? (
            <p style={small}>Loading…</p>
          ) : matches.length === 0 ? (
            <p style={small}>Nothing matches.</p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    title={`${item.title} — ${STATUS[item.status]}`}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: 0,
                      border: item.id === value ? "2px solid var(--puck-color-interactive, #2563eb)" : "1px solid transparent",
                      borderRadius: 4,
                      background: "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb(item.image)}
                      alt=""
                      style={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 3 }}
                    />
                    <span style={{ display: "block", fontSize: 11, lineHeight: 1.25, padding: "2px 1px" }}>
                      {item.title}
                    </span>
                    <span style={{ display: "block", fontSize: 10, opacity: 0.7, padding: "0 1px 2px" }}>
                      {STATUS[item.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </FieldLabel>
  );
}
