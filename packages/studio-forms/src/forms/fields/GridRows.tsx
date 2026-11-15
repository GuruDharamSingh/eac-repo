'use client';

import * as React from 'react';
import type { FormIconName } from '../contract';
import { Icon } from '../theme/context';

// ============================================================================
// GridRows: the inline list joint (design §2 "Inline lists"; the DS `.table`
// rules). The session planner (1c) and the variants grid (1f) both draw
// with it; a kind supplies the columns and the cells, never the styling.
//
//   NO.  DATE        TITLE AND NOTE                    ← header: 11px caps, divider rule
//   1    Thu 19 Nov  Monotype basics               [⊠]  ← rows: 10px padding, faint rule
//   –    Thu 24 Dec  Skipped: Christmas Eve        [↺]  ← a muted row, its action in accent
//
// Columns come from a CSS grid-template-columns string, one track per column
// (no repeat()); the action column (30px) is added after when rows carry an
// action. Every cell is placed by its column number, so the DOM can keep the
// order assistive tech reads while the grid shows the design's order.
//
// Row states: normal, muted (a skipped date: faint ink, a column may strike
// through) and highlighted (a new row: the soft accent fill).
//
// Keyboard: everything is a real button or input in Tab order. On a button
// in a cell, ↑/↓ move to the same column's button in the row above/below,
// Home/End to the first/last. When an action removes its own row, focus moves
// to the action now in that place, or to `afterRef` ("Add a variant").
//
// Narrow (the list's own width ≤ 440px, so it reflows at 390 and inside a
// popover alike): columns marked `narrow: 'stack'` leave the line and sit
// under it, side by side, each with its label shown; `narrow: 'hide'` ones are
// not drawn. The rest keep `narrowTemplate`, by default the template without
// the columns that left.
// ============================================================================

export interface GridColumn {
  id: string;
  /** The header; also each cell's column name for assistive tech. */
  label: string;
  /** Keep the header empty on screen (a number or action column); it is still read. */
  hideLabel?: boolean;
  /** At the narrow width: stay on the row's line (default), move under it, or not be drawn. */
  narrow?: 'keep' | 'stack' | 'hide';
  /** In a muted row, strike this cell through (a skipped session's date). */
  strikeWhenMuted?: boolean;
  align?: 'start' | 'end';
}

export type GridRowState = 'normal' | 'muted' | 'highlighted';

export interface GridRowAction {
  icon: FormIconName;
  /** Spoken, and the tooltip: "Skip Thu 24 Dec", "Put Thu 24 Dec back", "Remove Framed in oak". */
  label: string;
  onClick: () => void;
  /** 'muted' (default: skip, remove) or 'accent' (put back). */
  tone?: 'muted' | 'accent';
  disabled?: boolean;
}

export interface GridRow {
  key: string;
  state?: GridRowState;
  /** Column id → content. */
  cells: Record<string, React.ReactNode>;
  action?: GridRowAction | null;
  /** A line under the row's cells (an editor opened on the row), across `detailColumns`. */
  detail?: React.ReactNode;
}

export interface GridRowsProps {
  /** For ids inside the list; from the field name (hydration-safe). */
  id: string;
  /** The list's accessible name ("Sessions", "Variants"). */
  label: string;
  columns: GridColumn[];
  /** grid-template-columns for `columns`, one track each: "24px 82px minmax(0,1fr)". */
  template: string;
  /** The kept columns' tracks at the narrow width; default `template` without the stacked and hidden ones. */
  narrowTemplate?: string;
  /** At the narrow width, the column (1-based, of the narrow grid) the stacked line starts under. Default 1. */
  stackFrom?: number;
  /** The action column's track. Default 30px. */
  actionWidth?: string;
  /** The action column's header, read only. Default "Action". */
  actionLabel?: string;
  rows: GridRow[];
  /** grid-column of a row's detail line, in the wide grid ("2 / -1"). Default the whole row. */
  detailColumns?: string;
  /** Shown under the header when there are no rows. */
  empty?: React.ReactNode;
  /** Where focus goes when the last row is removed (the "Add" button). */
  afterRef?: React.RefObject<HTMLElement | null>;
  describedBy?: string;
  className?: string;
}

/** A grid-template-columns string, one entry per track (parentheses kept whole). */
export function splitTemplate(template: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of template.trim()) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

type CellVars = React.CSSProperties & Record<'--frm-gc' | '--frm-gcn', string>;

const FOCUSABLE = 'button:not(:disabled), a[href], [role="button"]:not([aria-disabled="true"])';

export function GridRows({
  id,
  label,
  columns,
  template,
  narrowTemplate,
  stackFrom = 1,
  actionWidth = '30px',
  actionLabel = 'Action',
  rows,
  detailColumns,
  empty,
  afterRef,
  describedBy,
  className,
}: GridRowsProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const lastAction = React.useRef<number | null>(null);

  const hasActions = rows.some((r) => Boolean(r.action));
  const tracks = splitTemplate(template);
  const isKept = (c: GridColumn) => (c.narrow ?? 'keep') === 'keep';
  // DOM order: the row's own line (kept and narrow-hidden columns), then the stacked ones, then the action.
  const lead = columns.filter((c) => c.narrow !== 'stack');
  const kept = columns.filter(isKept);
  const stacked = columns.filter((c) => c.narrow === 'stack');
  const narrowTracks = narrowTemplate
    ? splitTemplate(narrowTemplate)
    : columns.map((c, i) => (isKept(c) ? tracks[i] ?? 'minmax(0,1fr)' : null)).filter((t): t is string => t !== null);
  const wideCols = [...tracks, ...(hasActions ? [actionWidth] : [])].join(' ');
  const narrowCols = [...narrowTracks, ...(hasActions ? [actionWidth] : [])].join(' ');
  const narrowCount = narrowTracks.length + (hasActions ? 1 : 0);

  const wideIndex = (c: GridColumn) => columns.indexOf(c) + 1;
  const narrowIndex = (c: GridColumn) => kept.indexOf(c) + 1;
  const actionVars: CellVars = { '--frm-gc': String(columns.length + 1), '--frm-gcn': String(narrowTracks.length + 1) };
  const cellVars = (c: GridColumn): CellVars => ({ '--frm-gc': String(wideIndex(c)), '--frm-gcn': String(Math.max(1, narrowIndex(c))) });

  const rootStyle = {
    '--frm-grid-cols': wideCols,
    '--frm-grid-ncols': narrowCols,
    '--frm-grid-stack': `${Math.min(Math.max(1, stackFrom), Math.max(1, narrowCount))} / -1`,
    '--frm-grid-detail': detailColumns ?? '1 / -1',
  } as React.CSSProperties;

  // An action that removed its own row: focus the action now in its place, else the "Add" button.
  React.useLayoutEffect(() => {
    const at = lastAction.current;
    lastAction.current = null;
    const el = root.current;
    if (at === null || !el) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (active && active !== document.body && document.contains(active)) return;
    const actions = el.querySelectorAll<HTMLElement>('[data-grid-action]:not(:disabled)');
    const next = actions[Math.min(at, actions.length - 1)];
    (next ?? afterRef?.current ?? null)?.focus();
  }, [rows, afterRef]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown' && e.key !== 'Home' && e.key !== 'End') return;
    const t = e.target as HTMLElement;
    if (!t.matches(FOCUSABLE)) return; // text inputs and selects keep their arrows
    const cell = t.closest<HTMLElement>('[data-grid-col]');
    const el = root.current;
    if (!cell || !el) return;
    const col = cell.getAttribute('data-grid-col');
    const targets: HTMLElement[] = [];
    el.querySelectorAll<HTMLElement>('[data-grid-row] [data-grid-col]').forEach((c) => {
      if (c.getAttribute('data-grid-col') !== col) return;
      const f = c.querySelector<HTMLElement>(FOCUSABLE);
      if (f) targets.push(f);
    });
    const i = targets.indexOf(t);
    if (i < 0) return;
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? targets.length - 1 : e.key === 'ArrowUp' ? i - 1 : i + 1;
    const next = targets[j];
    if (next && next !== t) {
      e.preventDefault();
      next.focus();
    }
  };

  const head = (c: GridColumn) => (
    <div
      key={c.id}
      role="columnheader"
      className="frm-grid-cell"
      data-narrow={c.narrow && c.narrow !== 'keep' ? c.narrow : undefined}
      data-align={c.align === 'end' ? 'end' : undefined}
      style={cellVars(c)}
    >
      {c.hideLabel === true ? <span className="frm-sr">{c.label}</span> : c.label}
    </div>
  );

  const cell = (row: GridRow, c: GridColumn) => (
    <div
      key={c.id}
      role="cell"
      className="frm-grid-cell"
      data-grid-col={c.id}
      data-narrow={c.narrow && c.narrow !== 'keep' ? c.narrow : undefined}
      data-strike={c.strikeWhenMuted === true && row.state === 'muted' ? '' : undefined}
      data-align={c.align === 'end' ? 'end' : undefined}
      style={cellVars(c)}
    >
      {c.narrow === 'stack' && (
        <span className="frm-grid-cell-label" aria-hidden="true">
          {c.label}
        </span>
      )}
      {row.cells[c.id] ?? null}
    </div>
  );

  return (
    <div
      ref={root}
      id={id}
      role="table"
      aria-label={label}
      aria-describedby={describedBy}
      className={className ? `frm-grid ${className}` : 'frm-grid'}
      style={rootStyle}
      onKeyDown={onKeyDown}
    >
      <div role="rowgroup">
        <div role="row" className="frm-grid-row frm-grid-head">
          {lead.map(head)}
          {stacked.length > 0 && (
            <div className="frm-grid-stack" role="none">
              {stacked.map(head)}
            </div>
          )}
          {hasActions && (
            <div role="columnheader" className="frm-grid-cell" style={actionVars}>
              <span className="frm-sr">{actionLabel}</span>
            </div>
          )}
        </div>
      </div>
      <div role="rowgroup" data-grid-body="">
        {rows.length === 0 && empty ? (
          <div role="row" className="frm-grid-empty">
            <div role="cell">{empty}</div>
          </div>
        ) : null}
        {rows.map((row, ri) => (
          <div key={row.key} role="row" className="frm-grid-row" data-grid-row="" data-state={row.state && row.state !== 'normal' ? row.state : undefined}>
            {lead.map((c) => cell(row, c))}
            {stacked.length > 0 && (
              <div className="frm-grid-stack" role="none">
                {stacked.map((c) => cell(row, c))}
              </div>
            )}
            {hasActions && (
              <div role="cell" className="frm-grid-cell frm-grid-act-cell" data-grid-col="__action" style={actionVars}>
                {row.action ? (
                  <button
                    type="button"
                    className="frm-btn frm-btn--icon frm-grid-act"
                    data-grid-action=""
                    data-tone={row.action.tone === 'accent' ? 'accent' : undefined}
                    aria-label={row.action.label}
                    title={row.action.label}
                    disabled={row.action.disabled === true}
                    onClick={() => {
                      lastAction.current = ri;
                      row.action?.onClick();
                    }}
                  >
                    <Icon name={row.action.icon} size={17} />
                  </button>
                ) : null}
              </div>
            )}
            {row.detail !== undefined && row.detail !== null && row.detail !== false ? (
              <div className="frm-grid-detail" role="cell">
                {row.detail}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
