"use client";

import { FieldLabel } from "@puckeditor/core";
import { useEffect, useMemo, useState } from "react";
import type { PickerArtwork, PickerCopy, PickerGallery, PickerPage, SiteSources } from "./site-sources";

// ============================================================================
// The editor's controls for a block prop that BINDS to a record
// (`binds: "artwork" | "gallery" | "opens-gallery" | "record" | "page-link" |
// "tile-key"`). Shared by every site; each takes its lists from a
// `SiteSources` and its words from `PickerCopy`, so nothing here knows whose
// pieces they are. What a page stores is only an id (or an address), never a
// copy.
//
// Puck applies no FieldLabel to a custom field, so it is drawn here.
// ============================================================================

interface FieldBase<V = string> {
  value?: V;
  onChange: (value: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
}

// One load per loader function, per page load. Artworks forget a failure so
// the next open retries; pages remember an empty answer.
const memo = new WeakMap<object, Promise<unknown>>();
function once<T>(fn: () => Promise<T[]>, retryOnFailure: boolean): Promise<T[]> {
  let p = memo.get(fn) as Promise<T[]> | undefined;
  if (!p) {
    p = fn().catch(() => {
      if (retryOnFailure) memo.delete(fn);
      return [] as T[];
    });
    memo.set(fn, p);
  }
  return p;
}

const STATUS: Record<PickerArtwork["status"], string> = {
  available: "For sale",
  reserved: "Reserved",
  sold: "Sold",
  portfolio: "Not for sale",
};

function thumb(src: string | null): string | undefined {
  if (!src) return undefined;
  return src.startsWith("/api/media/") ? `${src}?w=256` : src;
}

// ---------------------------------------------------------------- artwork

export function ArtworkPickerField({
  value,
  onChange,
  readOnly,
  field,
  sources,
  copy,
}: FieldBase & { sources: SiteSources; copy?: PickerCopy }) {
  const [items, setItems] = useState<PickerArtwork[] | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    const load = sources.artworks;
    if (!load) setItems([]);
    else void once(load, true).then((all) => live && setItems(all));
    return () => {
      live = false;
    };
  }, [sources]);

  const current = useMemo(() => items?.find((i) => i.id === value) ?? null, [items, value]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = items ?? [];
    return q ? all.filter((i) => `${i.title} ${i.year ?? ""} ${i.medium ?? ""}`.toLowerCase().includes(q)) : all;
  }, [items, query]);

  const search = copy?.artworkSearch ?? "Search artworks";
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
    <FieldLabel label={field?.label ?? copy?.artworkLabel ?? "Artwork"} readOnly={readOnly} el="div">
      {value && !current && items !== null ? (
        // Bound to something no longer shown on the site (unlisted and not
        // kept as portfolio). Say so rather than looking unbound.
        <div style={{ ...box, justifyContent: "space-between" }}>
          <span style={small}>{copy?.artworkMissing ?? "This artwork is no longer shown on the site."}</span>
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
          {open ? "Close" : (copy?.artworkChoose ?? "Choose an artwork…")}
        </button>
      ) : (
        <span style={small}>None</span>
      )}

      {open && !readOnly ? (
        <div style={{ marginTop: 8 }}>
          <input
            type="search"
            placeholder={search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", padding: "0.4rem", font: "inherit", fontSize: 13, marginBottom: 6 }}
            aria-label={search}
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
                    <span style={{ display: "block", fontSize: 11, lineHeight: 1.25, padding: "2px 1px" }}>{item.title}</span>
                    <span style={{ display: "block", fontSize: 10, opacity: 0.7, padding: "0 1px 2px" }}>{STATUS[item.status]}</span>
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

// ---------------------------------------------------------------- gallery

/**
 * A gallery as a list. Empty = "the gallery linked to this page", which is
 * what most pages want and what survives the page being copied to a new
 * address. `emptyLabel` words the empty choice.
 */
export function GalleryPickerField({
  value,
  onChange,
  readOnly,
  field,
  emptyLabel,
  sources,
  copy,
}: FieldBase & { sources: SiteSources; copy?: PickerCopy; emptyLabel?: string }) {
  const [galleries, setGalleries] = useState<PickerGallery[] | null>(null);
  useEffect(() => {
    let live = true;
    const load = sources.galleries;
    if (!load) setGalleries([]);
    else void load().then((g) => live && setGalleries(g), () => live && setGalleries([]));
    return () => {
      live = false;
    };
  }, [sources]);
  const label = field?.label ?? copy?.galleryLabel ?? "Gallery";
  return (
    <FieldLabel label={label} readOnly={readOnly} el="div">
      <select
        value={value ?? ""}
        disabled={readOnly || galleries === null}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "0.4rem", font: "inherit" }}
        aria-label={label}
      >
        <option value="">{emptyLabel ?? copy?.galleryEmpty ?? "This page’s gallery"}</option>
        {(galleries ?? []).map((g) => (
          <option key={g.id} value={g.id}>
            {g.title} ({g.itemCount}){g.pagePath ? ` — /${g.pagePath}` : ""}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

// ----------------------------------------------------------------- record

type Kind = "" | "artwork" | "gallery";

function split(v: unknown): { kind: Kind; id: string } {
  const s = typeof v === "string" ? v : "";
  const [k, id = ""] = s.split(":", 2);
  return k === "artwork" || k === "gallery" ? { kind: k, id } : { kind: "", id: "" };
}

/**
 * "Filled from (live)": a card's record, chosen by kind and then by name.
 * Stores a reference ("artwork:<id>", "gallery:<id>"), never a copy.
 */
export function RecordPickerField({
  value,
  onChange,
  readOnly,
  field,
  sources,
  copy,
}: FieldBase<unknown> & { sources: SiteSources; copy?: PickerCopy }) {
  const stored = split(value);
  const [kind, setKind] = useState<Kind>(stored.kind);

  return (
    <FieldLabel label={field?.label ?? copy?.recordLabel ?? "Filled from (live)"} el="div">
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
          <option value="">{copy?.recordNone ?? "Nothing — typed by hand"}</option>
          <option value="artwork">{copy?.recordArtwork ?? "One of the artworks"}</option>
          <option value="gallery">{copy?.recordGallery ?? "One of the galleries"}</option>
        </select>
        {kind === "artwork" ? (
          <ArtworkPickerField
            value={stored.kind === "artwork" ? stored.id : ""}
            readOnly={readOnly}
            field={{ label: "Artwork" }}
            sources={sources}
            copy={copy}
            onChange={(id) => onChange(id ? `artwork:${id}` : "")}
          />
        ) : null}
        {kind === "gallery" ? (
          <GalleryPickerField
            value={stored.kind === "gallery" ? stored.id : ""}
            readOnly={readOnly}
            emptyLabel={copy?.recordGalleryEmpty ?? "Choose a gallery"}
            field={{ label: "Gallery" }}
            sources={sources}
            copy={copy}
            onChange={(id) => onChange(id ? `gallery:${id}` : "")}
          />
        ) : null}
        <p style={{ margin: 0, fontSize: 12, color: "#5b5b5b", lineHeight: 1.4 }}>
          {copy?.recordHint ?? "Fields you typed above stay as typed; the record fills the empty ones and keeps them current."}
        </p>
      </div>
    </FieldLabel>
  );
}

// -------------------------------------------------------------- page link

const OTHER = "__other__";

/**
 * "Leads to": choose one of the site's pages by name, or type any address.
 * Stores the address itself ("/medicine-buddha").
 */
export function PageLinkField({
  value,
  onChange,
  field,
  readOnly,
  sources,
  copy,
}: FieldBase<unknown> & { sources: SiteSources; copy?: PickerCopy }) {
  const current = typeof value === "string" ? value : "";
  const [pages, setPages] = useState<PickerPage[] | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let live = true;
    const load = sources.pages;
    if (!load) setPages([]);
    else void once(load, false).then((p) => live && setPages(p));
    return () => {
      live = false;
    };
  }, [sources]);

  const known = pages?.some((p) => p.href === current) ?? false;
  const showText = typing || (current !== "" && pages !== null && !known);

  return (
    <FieldLabel label={field?.label ?? copy?.pageLinkLabel ?? "Leads to"} el="div">
      <div style={{ display: "grid", gap: 6 }}>
        <select
          value={showText ? OTHER : current}
          disabled={readOnly || pages === null}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setTyping(true);
              return;
            }
            setTyping(false);
            onChange(e.target.value);
          }}
          style={{ width: "100%", padding: "5px 6px", font: "inherit" }}
        >
          <option value="">{pages === null ? (copy?.pageLinkLoading ?? "Loading pages…") : "Nowhere (not a link)"}</option>
          {(pages ?? []).map((p) => (
            <option key={p.slug} value={p.href}>
              {p.title} — {p.href}
            </option>
          ))}
          <option value={OTHER}>Another address…</option>
        </select>
        {showText ? (
          <input
            type="text"
            inputMode="url"
            defaultValue={current}
            placeholder="/a-page or https://…"
            disabled={readOnly}
            onBlur={(e) => onChange(e.target.value.trim())}
            style={{ width: "100%", padding: "5px 6px", font: "inherit" }}
          />
        ) : null}
      </div>
    </FieldLabel>
  );
}

/**
 * Draws nothing; gives a new tile a stable id the first time its row is
 * opened, so its arrangement follows it when rows are reordered.
 */
export function TileKeyField({ value, onChange }: { value?: unknown; onChange: (v: string) => void }) {
  useEffect(() => {
    if (typeof value !== "string" || !value) onChange(crypto.randomUUID().slice(0, 8));
    // Only once, when the row first opens without an id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ------------------------------------------------------- binds -> control

type PropLike = { binds?: string };

/**
 * The `fields.string` entry for `buildEditorConfig`, covering the binds kinds
 * this file draws. Returns null for any other kind so a host can chain its
 * own (gallery-pictures, tile-layout...):
 *
 *     string: (prop) => bindsField(prop) ?? myOwn(prop)
 */
export function siteBindsFields(sources: SiteSources, copy?: PickerCopy) {
  return function bindsField(prop: PropLike): ((props: Record<string, unknown>) => React.ReactElement) | null {
    switch (prop.binds) {
      case "artwork":
        return function ArtworkProp(props: Record<string, unknown>) {
          return <ArtworkPickerField {...(props as unknown as FieldBase)} sources={sources} copy={copy} />;
        };
      case "gallery":
        return function GalleryProp(props: Record<string, unknown>) {
          return <GalleryPickerField {...(props as unknown as FieldBase)} sources={sources} copy={copy} />;
        };
      case "opens-gallery":
        return function OpensGalleryProp(props: Record<string, unknown>) {
          return <GalleryPickerField {...(props as unknown as FieldBase)} sources={sources} copy={copy} emptyLabel={copy?.opensGalleryEmpty ?? "None — an ordinary picture"} />;
        };
      case "record":
        return function RecordProp(props: Record<string, unknown>) {
          return <RecordPickerField {...(props as unknown as FieldBase)} sources={sources} copy={copy} />;
        };
      case "page-link":
        return function PageLinkProp(props: Record<string, unknown>) {
          return <PageLinkField {...(props as unknown as FieldBase)} sources={sources} copy={copy} />;
        };
      case "tile-key":
        return function TileKeyProp(props: Record<string, unknown>) {
          return <TileKeyField {...(props as unknown as FieldBase)} />;
        };
      default:
        return null;
    }
  };
}
