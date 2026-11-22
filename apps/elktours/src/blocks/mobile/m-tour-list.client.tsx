"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArchFrame, Chip, ChipRow } from "@/components/mobile";
import { TourQuickLink } from "./tour-quick-link";
import type { MobileTourRow } from "./types";

// The interactive half of m-tour-list (the live search and chips). Split from the declaration the same way contact-form is.

export interface MTourListViewProps {
  showSearch?: boolean;
  showChips?: boolean;
  searchPlaceholder?: ReactNode;
  chipAll?: ReactNode;
  chipWalks?: ReactNode;
  chipAteliers?: ReactNode;
  chipMuseums?: ReactNode;
  chipFood?: ReactNode;
  chipPrivate?: ReactNode;
  emptyText?: ReactNode;
  withLabel?: ReactNode;
  onRequestLabel?: ReactNode;
  rows?: MobileTourRow[] | null;
}

export function MTourListView(p: MTourListViewProps) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const chips: { key: string; label: ReactNode; cls: string }[] = [
    { key: "all", label: p.chipAll, cls: "all" },
    { key: "walk", label: p.chipWalks, cls: "walks" },
    { key: "atelier", label: p.chipAteliers, cls: "ateliers" },
    { key: "museum", label: p.chipMuseums, cls: "museums" },
    { key: "food", label: p.chipFood, cls: "food" },
    { key: "private", label: p.chipPrivate, cls: "private" },
  ];
  const rows = p.rows;
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (type === "all" || r.typeKey === type) && (!needle || r.title.toLowerCase().includes(needle)));
  }, [rows, q, type]);

  return (
    <section className="blk blk-mtl">
      {p.showSearch && (
      <div className="blk-mtl-search">
        <span className="blk-mtl-glass" />
        <input
          className="blk-mtl-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={typeof p.searchPlaceholder === "string" ? p.searchPlaceholder : "Search"}
          aria-label="Search tours"
        />
      </div>
      )}
      {p.showChips && (
      <ChipRow>
        {chips.map((c) => (
          <Chip key={c.key} selected={c.key === type} onClick={() => setType(c.key)}>
            <span className={`blk-mtl-chip-${c.cls}`}>{c.label}</span>
          </Chip>
        ))}
      </ChipRow>
      )}
      <div className="blk-mtl-list">
        {shown.map((t) => (
          <TourQuickLink key={t.id} slug={t.slug} title={t.title} className="blk-mtl-card m-cusp" style={{ ["--cusp" as string]: "16px" }}>
            <span className="blk-mtl-thumb">
              <ArchFrame w={112} h={144} bottom={14} brass src={t.img} frame={t.imgFrame} />
            </span>
            <span className="blk-mtl-text">
              <span className="m-kicker blk-mtl-meta">{[t.typeLabel, t.duration].filter(Boolean).join(" · ")}</span>
              <span className="blk-mtl-title">{t.title}</span>
              {t.guide && (
                <span className="blk-mtl-guide">
                  <span className="blk-mtl-with">{p.withLabel}</span> {t.guide}
                </span>
              )}
              <span className="blk-mtl-foot">
                <span className="blk-mtl-next">{t.nextLabel}</span>
                <span className="blk-mtl-price">{t.priceLabel || p.onRequestLabel || "On request"}</span>
              </span>
            </span>
          </TourQuickLink>
        ))}
        {shown.length === 0 && <p className="blk-mtl-empty">{p.emptyText}</p>}
      </div>
    </section>
  );
}
