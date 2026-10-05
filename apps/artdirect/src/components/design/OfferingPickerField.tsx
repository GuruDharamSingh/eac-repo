"use client";

import { FieldLabel } from "@puckeditor/core";
import { useMemo, useState } from "react";
import type { OfferingRecord } from "@elkdonis/blocks";

// ============================================================================
// "Offering (live)" — the control for a `binds: "record"` prop on a person's
// own pages (the spotlight, a card). Lists only the page owner's public
// offerings, which the designer route loaded with the page
// (loadPersonBlockContext → `offerings`); the page stores the reference
// (`artwork:<id>`, `thread:<id>`, `writing:<id>`, `gallery:<id>`), never a
// copy. Same shape as danamccool's record picker, without the HTTP hop: the
// records are already in the editor.
// ============================================================================

const KIND_LABELS: Record<string, string> = {
  artwork: "Work for sale",
  writing: "Writing",
  gallery: "Gallery",
};

function kindLabel(kind: string | null | undefined): string {
  if (!kind) return "Offering";
  return KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

function thumb(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  return src.startsWith("/api/media/") ? `${src}?w=256` : src;
}

const small: React.CSSProperties = { fontSize: 12, opacity: 0.75 };
const button: React.CSSProperties = {
  font: "inherit",
  fontSize: 13,
  padding: "0.3rem 0.6rem",
  border: "1px solid var(--puck-color-grey-09, #ccc)",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer",
};
const box: React.CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  alignItems: "center",
  padding: "0.4rem",
  border: "1px solid var(--puck-color-grey-09, #ddd)",
  borderRadius: 6,
  background: "var(--puck-color-white, #fff)",
};

export function OfferingPickerField({
  value,
  onChange,
  readOnly,
  field,
  offerings,
}: {
  value?: unknown;
  onChange: (v: string) => void;
  readOnly?: boolean;
  field?: { label?: string };
  offerings: OfferingRecord[];
}) {
  const ref = typeof value === "string" ? value : "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = useMemo(() => offerings.find((o) => o.ref === ref) ?? null, [offerings, ref]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? offerings.filter((o) => `${o.title ?? ""} ${o.kind ?? ""} ${o.meta ?? ""}`.toLowerCase().includes(q))
      : offerings;
  }, [offerings, query]);

  return (
    // el="div": a <label> forwards a click on its text to the first control.
    <FieldLabel label={field?.label ?? "Offering (live)"} readOnly={readOnly} el="div">
      {ref && !current ? (
        <div style={{ ...box, justifyContent: "space-between" }}>
          <span style={small}>This offering is no longer public.</span>
          {!readOnly ? (
            <button type="button" style={button} onClick={() => onChange("")}>
              Remove
            </button>
          ) : null}
        </div>
      ) : current ? (
        <div style={box}>
          {current.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb(current.image)} alt="" width={48} height={48} style={{ objectFit: "cover", borderRadius: 3 }} />
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{current.title}</div>
            <div style={small}>{[kindLabel(current.kind), current.meta].filter(Boolean).join(" · ")}</div>
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
          {open ? "Close" : "Choose one of your offerings…"}
        </button>
      ) : (
        <span style={small}>None</span>
      )}

      {open && !readOnly ? (
        <div style={{ marginTop: 8 }}>
          {offerings.length === 0 ? (
            <p style={small}>
              Nothing public to choose from yet: works in an open store, published writing, public galleries, and
              events or workshops you host show here.
            </p>
          ) : (
            <>
              <input
                type="search"
                placeholder="Search your offerings"
                aria-label="Search your offerings"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ width: "100%", padding: "0.4rem", font: "inherit", fontSize: 13, marginBottom: 6 }}
              />
              {matches.length === 0 ? (
                <p style={small}>Nothing matches.</p>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4, maxHeight: 340, overflowY: "auto" }}>
                  {matches.map((o) => (
                    <li key={o.ref}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(o.ref);
                          setOpen(false);
                          setQuery("");
                        }}
                        style={{
                          ...button,
                          width: "100%",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          textAlign: "left",
                          borderColor: o.ref === ref ? "var(--puck-color-azure-04, #0158ad)" : "transparent",
                        }}
                      >
                        {o.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb(o.image)} alt="" width={36} height={36} style={{ objectFit: "cover", borderRadius: 3, flex: "none" }} />
                        ) : (
                          <span style={{ width: 36, height: 36, flex: "none", background: "#eee", borderRadius: 3 }} aria-hidden="true" />
                        )}
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{o.title}</span>
                          <span style={{ ...small, display: "block" }}>{[kindLabel(o.kind), o.meta].filter(Boolean).join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "#5b5b5b", lineHeight: 1.4 }}>
        Fields you type stay as typed; the offering fills the empty ones and keeps them current.
      </p>
    </FieldLabel>
  );
}
