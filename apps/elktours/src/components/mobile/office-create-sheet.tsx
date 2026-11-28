"use client";

import Link from "next/link";
import type * as React from "react";
import { useSurfaceOptional, type SurfaceDescriptor, type SurfaceKind } from "@elkdonis/cms-ui/surface";
import { ArchFrame, Sheet } from "@/components/mobile";
import { roman } from "./roman";
import "./board.css";

// The Office's "+" sheet (OFFICE_SPEC, Justin 2026-11-15): a row of three create tiles instead of the plus going
// straight to New slots, and two quiet rows under it. Labels and links match lib/office.ts OFFICE_CREATE; they are
// repeated here only because that module is server-side (it reads the database), and this one is a client component.
// Since 2026-11-19 the tiles open the hub's popups in place (the office moved to /hub); the descriptors match
// components/office/* (written out here so the sheet does not bundle the popups). New experience stays a page.
const pop = (key: string, title: string, size: "wide" | "full", kind: SurfaceKind = "event"): SurfaceDescriptor => ({ type: "custom", key, title, kind, size });
const TILES: Array<{ key: string; label: string; line: string; href: string; surface?: SurfaceDescriptor }> = [
  { key: "tour", label: "New tour", line: "Route, stops and price", href: "/manage/tours/new", surface: pop("office-create-tour", "Create a tour", "full") },
  { key: "experience", label: "New experience", line: "An artist's visit or workshop", href: "/manage/experiences/new" },
  { key: "dates", label: "New dates", line: "Offer a tour on days and times", href: "/manage/schedule/new", surface: pop("office-schedule", "Offer a tour", "wide") },
];

const QUIET: Array<{ label: string; line: string; href: string; surface?: SurfaceDescriptor }> = [
  { label: "Share a post", line: "A post or a link for Discover", href: "/manage/share" },
  { label: "Add a place", line: "To the catalogue guests browse", href: "/manage/places", surface: pop("office-add-place", "Add a place", "full", "service") },
  { label: "Offer availability", line: "The days you are free", href: "/hub", surface: pop("office-availability", "Offer availability", "wide") },
];

export function OfficeCreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const close = () => onOpenChange(false);
  const surfaces = useSurfaceOptional();
  // Open the popup over the page when the surface system is mounted; otherwise follow the link.
  const go = (surface?: SurfaceDescriptor) => (e: React.MouseEvent) => {
    close();
    if (surface && surfaces) {
      e.preventDefault();
      surfaces.open(surface);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Create">
      <div className="b-create">
        <span className="m-kicker">Create</span>
        <h2 className="b-create-title">Make something</h2>
        <div className="b-create-tiles">
          {TILES.map((t, i) => (
            <Link key={t.key} href={t.href} className="b-create-tile" onClick={go(t.surface)}>
              <ArchFrame w={64} h={76} bottom={12} brass>
                <span className="b-create-num" aria-hidden="true">{roman(i + 1)}</span>
              </ArchFrame>
              <span className="b-create-label">{t.label}</span>
              <span className="b-create-line">{t.line}</span>
            </Link>
          ))}
        </div>
        <div className="b-create-quiet">
          {QUIET.map((q) => (
            <Link key={q.label} href={q.href} className="b-create-row" onClick={go(q.surface)}>
              <span className="b-create-row-text">
                <span className="b-create-row-title">{q.label}</span>
                <span className="b-create-row-line">{q.line}</span>
              </span>
              <span className="m-row-chev" aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
