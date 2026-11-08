"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Clock, Pencil, Radio, Repeat, Zap } from "lucide-react";
import {
  MATRIX_COLUMNS,
  MATRIX_LABELS,
  fmtDay,
  kindGlyph,
  kindLabel,
  type ItemState,
  type Piece,
  type RoutineView,
  type Suggestion,
  type TimelineEntry,
} from "@/lib/channel/model";
import { CHANNEL_BASE, useChannel } from "./context";
import { IdentityMark, OutletIcon } from "./icons";
import { specFromSuggestion } from "./quick-spec";

export function StateMark({ state, size = 13 }: { state: ItemState; size?: number }) {
  const p = { size, strokeWidth: 1.8, "aria-hidden": true as const };
  switch (state) {
    case "published":
      return <Check {...p} className="chn-sm" data-state="published" />;
    case "scheduled":
      return <Clock {...p} className="chn-sm" data-state="scheduled" />;
    case "live":
      return <Radio {...p} className="chn-sm" data-state="live" />;
    case "draft":
      return <Pencil {...p} className="chn-sm" data-state="draft" />;
    case "failed":
      return <AlertTriangle {...p} className="chn-sm" data-state="failed" />;
    default:
      return null;
  }
}

const STATE_WORD: Record<ItemState, string> = {
  published: "Published",
  scheduled: "Scheduled",
  live: "Live",
  draft: "Draft",
  failed: "Failed",
  empty: "Not yet",
};

export function StatusTag({ state }: { state: ItemState }) {
  return (
    <span className="chn-tag" data-state={state}>
      {STATE_WORD[state]}
    </span>
  );
}

/** The seven outlet marks on a row, coloured by state (design 1a). */
export function OutletMarks({ piece }: { piece: Piece }) {
  return (
    <span className="chn-marks" aria-label={MATRIX_COLUMNS.map((c) => `${MATRIX_LABELS[c]}: ${STATE_WORD[piece.row[c].state].toLowerCase()}`).join(", ")}>
      {MATRIX_COLUMNS.map((c) => (
        <OutletIcon key={c} outlet={c} state={piece.row[c].state} size={14} />
      ))}
    </span>
  );
}

export function Thumb({ piece, size = 52, h }: { piece: Pick<Piece, "imageUrl" | "title" | "kind">; size?: number; h?: number }) {
  return piece.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="chn-thumb" src={piece.imageUrl} alt="" width={size} height={h ?? size} loading="lazy" style={{ width: size, height: h ?? size }} />
  ) : (
    <span className="chn-thumb is-empty" style={{ width: size, height: h ?? size }} aria-hidden>
      {kindGlyph(piece.kind)}
    </span>
  );
}

export function KindLine({ piece }: { piece: Pick<Piece, "kind"> }) {
  return (
    <span className="chn-kind">
      <span aria-hidden>{kindGlyph(piece.kind)}</span> {kindLabel(piece.kind)}
    </span>
  );
}

/** "Next" chip: an action-registry entry point, shown light (design: inline chips only). */
export function NextChip({ suggestion, piece, compact }: { suggestion: Suggestion; piece?: Piece; compact?: boolean }) {
  const { openQuick, model } = useChannel();
  const routine = suggestion.routineId ? model.routines.find((r) => r.id === suggestion.routineId) : undefined;
  return (
    <button
      type="button"
      className={compact ? "chn-gap" : "chn-next"}
      title={suggestion.reason}
      onClick={(e) => {
        e.stopPropagation();
        openQuick(specFromSuggestion(suggestion, piece, routine?.name ?? null), e.currentTarget);
      }}
    >
      {compact ? suggestion.chip : (
        <>
          <Zap size={13} aria-hidden /> {suggestion.text}
        </>
      )}
    </button>
  );
}

export function Timeline({ entries, showIdentity, limit }: { entries: TimelineEntry[]; showIdentity?: boolean; limit?: number }) {
  const { model, identity } = useChannel();
  const list = limit ? entries.slice(-limit) : entries;
  if (list.length === 0) return <p className="chn-quiet">Nothing has gone out yet.</p>;
  return (
    <ol className="chn-timeline">
      {list.map((e) => {
        const idn = identity(e.identityId);
        return (
          <li key={e.id}>
            <span className="chn-tl-date">{fmtDay(e.at, model.timeZone)}</span>
            {showIdentity && <span className="chn-tl-id">{idn ? <IdentityMark initials={idn.initials} kind={idn.kind} title={idn.name} /> : null}</span>}
            <OutletIcon outlet={e.outlet} state={e.state} size={16} />
            <span className="chn-tl-text">
              {e.href ? (
                <a href={e.href} target="_blank" rel="noreferrer">
                  {e.label}
                </a>
              ) : (
                e.label
              )}
              <small>{e.sub}</small>
            </span>
            <StatusTag state={e.state} />
          </li>
        );
      })}
    </ol>
  );
}

export function RoutinesStrip({ routines, compact }: { routines: RoutineView[]; compact?: boolean }) {
  const { href, model } = useChannel();
  return (
    <section className="chn-routines" aria-labelledby="chn-routines-h">
      <div className="chn-section-head">
        <h2 id="chn-routines-h" className="chn-kicker">
          Routines
        </h2>
        <p className="chn-quiet">Each one opens slots in the week.</p>
        <Link className="chn-link" href={href(`${CHANNEL_BASE}/routines`)}>
          Edit routines ↗
        </Link>
      </div>
      {routines.length === 0 ? (
        <p className="chn-empty-line">
          {model.ready
            ? "No routines yet. A routine (Instagram on Tuesdays and Fridays, a letter on the 1st) opens a slot each time it comes round."
            : "Routines need migration 252."}
        </p>
      ) : (
        <ul className={`chn-routine-grid${compact ? " is-compact" : ""}`}>
          {routines.map((r) => (
            <li key={r.id}>
              <OutletIcon outlet={r.outlet} size={17} />
              <div>
                <strong>{r.name}</strong>
                <small>{r.cadence}</small>
                <span data-tone={r.tone}>{r.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RoutineLine({ name }: { name: string }) {
  return (
    <span className="chn-routine-line">
      <Repeat size={12} aria-hidden /> {name}
    </span>
  );
}
