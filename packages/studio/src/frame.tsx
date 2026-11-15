'use client';

// ============================================================================
// The Studio frame's contract with the kinds plugged into it (brief §7.1,
// docs/open/STUDIO_BRIEF_2026-09-27.md).
//
// StudioShell owns the frame: top bar (kind switch, "Making as", theme,
// panel toggles), the error bar and the three columns. Writing is built into
// the shell. Every other kind is a StudioExtension the HOST registers (from a
// client module of its own, since a server page cannot pass components), so
// this package never imports an extension and its dependencies (the Video
// kind brings Remotion) stay out of it.
//
// An extension renders <StudioColumns> for its list, editor and settings,
// and puts its top-bar buttons and status through <StudioTopActions> /
// <StudioTopStatus>, which portal into the shell's bar. It reads the acting
// org, the viewer and the panel state from useStudioFrame().
//
// Kept free of everything but React so `@elkdonis/studio/frame` is cheap to
// import.
// ============================================================================

import * as React from 'react';
import {
  StudioFrameContext,
  StudioTopActions,
  StudioTopStatus,
  useStudioFrame,
  type StudioColTab,
  type StudioFrameApi,
  type StudioPieceRef,
} from '@elkdonis/studio-forms/host-frame';

// The context and the two portals live in studio-forms (the forms read them); re-exported as the
// same objects so the shell's provider reaches FormShell.
export { StudioFrameContext, StudioTopActions, StudioTopStatus, useStudioFrame };
export type { StudioColTab, StudioFrameApi, StudioPieceRef };

export interface StudioExtension {
  /** Matches a StudioKind id ("video"); the shell lists it in the kind switch and "New ▾". */
  id: string;
  label: string;
  /** What the drawer holds, for the mobile button: "Reels". */
  listLabel?: string;
  render: () => React.ReactNode;
  /**
   * Extra "New ▾" entries beyond the kind's own (2026-11-12): Video offers "Live" when the viewer may
   * go live. Choosing one opens the kind and hands it `as` through StudioFrameApi.takeNew.
   */
  newEntries?: Array<{ id: string; label: string; as: string }>;
}

/** A list section in the column that folds (Drafts, Published, Series; developer, 2026-11-12). */
export function StudioFold({
  label,
  count,
  aside,
  defaultOpen = true,
  children,
}: {
  label: string;
  count?: number;
  /** A control beside the title ("all" on a filtered series). */
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <>
      <div className="studio-panel__h studio-fold__h">
        <button type="button" className="studio-fold" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="studio-fold__caret" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span>{label}</span>
        </button>
        {aside}
        {count != null && <span>{count}</span>}
      </div>
      {open && children}
    </>
  );
}

/** The left column's head: the two tabs, and under "All pieces" the kinds. */
export function StudioColumnHead({
  tab,
  onTab,
  hasPiece,
  kinds,
  onKind,
}: {
  tab: StudioColTab;
  onTab?: (tab: StudioColTab) => void;
  /** False when the kind has no settings: only "All pieces" is offered. */
  hasPiece: boolean;
  kinds?: Array<{ id: string; label: string; current: boolean }>;
  onKind?: (id: string) => void;
}) {
  return (
    <div className="studio-colhead">
      <div className="studio-coltabs" role="tablist" aria-label="Left column">
        <button type="button" role="tab" aria-selected={tab === 'list'} onClick={() => onTab?.('list')}>
          All pieces
        </button>
        {hasPiece && (
          <button type="button" role="tab" aria-selected={tab === 'piece'} onClick={() => onTab?.('piece')}>
            This piece
          </button>
        )}
      </div>
      {tab === 'list' && kinds && kinds.length > 1 && (
        <nav className="studio-kindidx" aria-label="Kinds">
          {kinds.map((k) => (
            <button key={k.id} type="button" aria-current={k.current || undefined} onClick={() => !k.current && onKind?.(k.id)}>
              {k.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/** Run `start` when "New ▾" asks this kind for a new item (not on mount: a kind opened fresh starts new anyway). */
export function useNewRequest(start: () => void) {
  const { newRequest } = useStudioFrame();
  const seen = React.useRef(newRequest);
  const cb = React.useRef(start);
  cb.current = start;
  React.useEffect(() => {
    if (newRequest !== seen.current) {
      seen.current = newRequest;
      cb.current();
    }
  }, [newRequest]);
}

/**
 * The kind's layout: one left column (its list under "All pieces", its settings under "This piece")
 * and the editor, with the shell's collapse and sheet behaviour. Until 2026-11-11 the settings had
 * a column of their own on the right.
 */
export function StudioColumns({
  drawer,
  main,
  settings,
  wideSettings,
}: {
  drawer: React.ReactNode;
  main: React.ReactNode;
  settings?: React.ReactNode;
  /** 360px instead of 300px, for editors with a dense settings column. */
  wideSettings?: boolean;
}) {
  const f = useStudioFrame();
  const setHasColumn = f.setHasColumn;
  React.useEffect(() => {
    setHasColumn?.(true);
    return () => setHasColumn?.(false);
  }, [setHasColumn]);
  // One left column: the list and the settings share it behind two tabs (canvas R1).
  const hasPiece = settings != null && settings !== false;
  const tab: StudioColTab = hasPiece ? f.colTab ?? 'piece' : 'list';
  const cls = [
    'studio-frame',
    f.drawer ? '' : 'studio-frame--no-drawer',
    hasPiece ? '' : 'studio-frame--no-settings',
    wideSettings ? 'studio-frame--wide-settings' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} data-tab={tab}>
      <StudioColumnHead tab={tab} onTab={f.setColTab} hasPiece={hasPiece} kinds={f.kindIndex} onKind={f.switchKind} />
      <aside className={`studio-drawer ${f.sheet === 'drawer' ? 'is-open' : ''}`}>
        <div className="studio-panel">{drawer}</div>
      </aside>
      <main className="studio-main">{main}</main>
      <aside className={`studio-settings ${f.sheet === 'settings' ? 'is-open' : ''}`}>
        {settings ? <div className="studio-panel">{settings}</div> : null}
      </aside>
    </div>
  );
}
