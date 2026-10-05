"use client";

import { FieldLabel } from "@puckeditor/core";
import { useEffect, useState } from "react";
import { listPagesForHud, type HudPage } from "@/lib/hud-actions";

// ============================================================================
// Small editor controls for the Collections navigator's tile rows.
//
//   PageLinkField  "Leads to": choose one of her pages by name, or type any
//                  address. Stores the address itself ("/medicine-buddha").
//   TileKeyField   draws nothing; gives a new tile a stable id the first time
//                  its row is opened, so its arrangement follows it when rows
//                  are reordered (collection-nav-layout.ts tileKeys).
// ============================================================================

let pagesMemo: Promise<HudPage[]> | null = null;
function loadPages(): Promise<HudPage[]> {
  pagesMemo ??= listPagesForHud()
    .then((r) => ("error" in r ? [] : r.pages))
    .catch(() => []);
  return pagesMemo;
}

const OTHER = "__other__";

export function PageLinkField({
  value,
  onChange,
  field,
  readOnly,
}: {
  value?: unknown;
  onChange: (v: string) => void;
  field?: { label?: string };
  readOnly?: boolean;
}) {
  const current = typeof value === "string" ? value : "";
  const [pages, setPages] = useState<HudPage[] | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let live = true;
    void loadPages().then((p) => live && setPages(p));
    return () => {
      live = false;
    };
  }, []);

  const known = pages?.some((p) => p.href === current) ?? false;
  const showText = typing || (current !== "" && pages !== null && !known);

  return (
    <FieldLabel label={field?.label ?? "Leads to"} el="div">
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
          <option value="">{pages === null ? "Loading her pages…" : "Nowhere (not a link)"}</option>
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

export function TileKeyField({ value, onChange }: { value?: unknown; onChange: (v: string) => void }) {
  useEffect(() => {
    if (typeof value !== "string" || !value) onChange(crypto.randomUUID().slice(0, 8));
    // Only once, when the row first opens without an id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
