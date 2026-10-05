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
import { createPortal } from 'react-dom';

export interface StudioExtension {
  /** Matches a StudioKind id ("video"); the shell lists it in the kind switch and "New ▾". */
  id: string;
  label: string;
  /** What the drawer holds, for the mobile button: "Reels". */
  listLabel?: string;
  render: () => React.ReactNode;
}

export interface StudioFrameApi {
  /** The acting org; `oad` is "Just me". */
  orgId: string;
  orgs: Array<{ orgId: string; name: string; slug: string }>;
  viewer: { userId: string; displayName: string; slug: string | null };
  setError: (message: string | null) => void;
  /** Desktop column toggles and the mobile sheet, owned by the shell's bar. */
  drawer: boolean;
  settings: boolean;
  sheet: null | 'drawer' | 'settings';
  setSheet: (s: null | 'drawer' | 'settings') => void;
  actionsSlot: HTMLElement | null;
  statusSlot: HTMLElement | null;
}

export const StudioFrameContext = React.createContext<StudioFrameApi | null>(null);

export function useStudioFrame(): StudioFrameApi {
  const api = React.useContext(StudioFrameContext);
  if (!api) throw new Error('useStudioFrame: render inside StudioShell as a registered extension');
  return api;
}

/** The three columns, with the shell's collapse and sheet behaviour. */
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
  const cls = [
    'studio-frame',
    f.drawer ? '' : 'studio-frame--no-drawer',
    f.settings && settings ? '' : 'studio-frame--no-settings',
    wideSettings ? 'studio-frame--wide-settings' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
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

/** Buttons for the shell's top bar (right side, before the theme toggle). */
export function StudioTopActions({ children }: { children: React.ReactNode }) {
  const { actionsSlot } = useStudioFrame();
  return actionsSlot ? createPortal(children, actionsSlot) : null;
}

/** Text for the shell's status area ("Saved", "Rendering 40%"). */
export function StudioTopStatus({ children }: { children: React.ReactNode }) {
  const { statusSlot } = useStudioFrame();
  return statusSlot ? createPortal(children, statusSlot) : null;
}
