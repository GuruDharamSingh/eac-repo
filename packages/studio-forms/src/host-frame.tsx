'use client';

// ============================================================================
// The slice of the Studio frame that the forms need (2026-11-14, split out of
// @elkdonis/studio's frame.tsx; docs/open/STUDIO_FORMS_SPLIT_2026-11-14.md).
//
// FormShell and AfterPublish read StudioFrameContext and portal into the
// shell's bar through StudioTopActions / StudioTopStatus. The context object
// lives here and @elkdonis/studio/frame re-exports it (not a copy), so the
// Studio's provider reaches the forms. Outside a Studio the context is null
// and the forms draw their own chrome. Free of everything but React.
// ============================================================================

import * as React from 'react';
import { createPortal } from 'react-dom';

export type StudioColTab = 'list' | 'piece';

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
  /**
   * Goes up each time the top bar's "New ▾" asks this kind for a new item (2026-11-07). Kinds react
   * with useNewRequest; before it, New on the kind you were already in did nothing.
   */
  newRequest: number;
  /**
   * The intent behind the latest "New ▾" click on `kind`, once (2026-11-12): `{ as }` is the extension
   * entry's `as`, or null for the kind's own entry. Null when the click was for another kind or was
   * already taken. Kinds call it on mount and whenever newRequest changes; a kind opened fresh by the
   * click sees newRequest unchanged since mount, so useNewRequest alone cannot serve it.
   */
  takeNew?: (kind: string) => { as: string | null } | null;
  /** `?preset=` from the hand-off (2026-11-08): the kind applies it once, on a new item. Null when none. */
  preset?: string | null;
  /**
   * `?next=` (2026-11-11): where the person came from in Channel, already checked by the host to be
   * a Channel path. After Publish, "Back to Channel" goes here instead of the piece's board.
   */
  next?: string | null;
  /** `?back=` (developer, 2026-11-12): the site page to return to, href already through the session hand-off. */
  back?: { href: string; label: string } | null;
  /**
   * The kind reports the saved item that is open (null when none, or when Channel does not cover it),
   * so the shell's bar can link to its board in Channel (2026-11-11).
   */
  setPiece?: (ref: StudioPieceRef | null) => void;
  /**
   * The left column (canvas R1, developer 2026-11-11): one column with two tabs, the kind's list
   * ("All pieces") and the open item's settings ("This piece"), instead of a list on the left and
   * settings on the right. StudioColumns draws it; the shell owns the state.
   */
  colTab?: StudioColTab;
  setColTab?: (tab: StudioColTab) => void;
  /** The kinds, for "All pieces": the current one marked. A click switches kind. */
  kindIndex?: Array<{ id: string; label: string; current: boolean }>;
  switchKind?: (id: string) => void;
  /** StudioColumns says it is drawing the column, so the shell can drop the bar's kind switch. */
  setHasColumn?: (on: boolean) => void;
  /** The frame is dark (the person's choice, else the system): kinds with a dark theme use it. */
  dark?: boolean;
  /** The bar's search text (2026-11-12): kinds filter their "All pieces" list by it. */
  query?: string;
}

/** An open, saved item as Channel keys it. `orgId` is the item's own org; null for a personal piece. */
export interface StudioPieceRef {
  store: 'thread' | 'artwork';
  id: string;
  orgId: string | null;
}

export const StudioFrameContext = React.createContext<StudioFrameApi | null>(null);

export function useStudioFrame(): StudioFrameApi {
  const api = React.useContext(StudioFrameContext);
  if (!api) throw new Error('useStudioFrame: render inside StudioShell as a registered extension');
  return api;
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
