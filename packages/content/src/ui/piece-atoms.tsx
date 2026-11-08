"use client";

import * as React from "react";
import type { ContentCellState, ContentMark, ContentStatus, ContentType } from "../model";
import { STATUS_WORD, typeGlyph, typeLabel } from "../registry";
import { OutletIcon } from "./atoms";

// Small parts the row, the brick and the lightbox share. The brick and the
// lightbox keep Channel's `chn-*` classes (lifted from components/channel/
// Library.tsx and bits.tsx, 2026-11-08) so Channel renders them unchanged;
// see content.css for how other hosts get those rules.

const CELL_WORD: Record<ContentCellState, string> = {
  published: "Published",
  scheduled: "Scheduled",
  live: "Live",
  draft: "Draft",
  failed: "Failed",
  suggested: "Suggested",
  info: "Note",
  empty: "Not yet",
};

/** The outlet marks on a brick, coloured by state (Channel's design 1a). */
export function OutletMarks({ marks }: { marks: ContentMark[] }) {
  return (
    <span className="chn-marks" aria-label={marks.map((m) => `${m.label}: ${CELL_WORD[m.state].toLowerCase()}`).join(", ")}>
      {marks.map((m) => (
        <OutletIcon key={m.outlet} outlet={m.outlet} state={m.state} size={14} />
      ))}
    </span>
  );
}

/** "◉ Writing". */
export function KindLine({ type }: { type: ContentType }) {
  return (
    <span className="chn-kind">
      <span aria-hidden>{typeGlyph(type)}</span> {typeLabel(type)}
    </span>
  );
}

/** The draft / scheduled / live / published chip. */
export function StatusChip({ status, label }: { status: ContentStatus; label?: string | null }) {
  return (
    <span className="eac-c-chip" data-state={status}>
      {label || STATUS_WORD[status]}
    </span>
  );
}
