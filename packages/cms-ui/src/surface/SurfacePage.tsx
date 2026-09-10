import * as React from "react";
import type { SurfaceAction } from "./types";
import { ActionButton } from "./SurfaceShell";
import { kindMeta } from "./kinds";

// ============================================================================
// The surface, at page size.
//
// The third size of the same object: face (card) → surface (popup) → page.
// Same masthead, same body-and-rail, same foot; no scrim, no close, no
// max-height, sitting in the page flow. A detail page built from this looks
// like the popup that opened it, which is what makes "Open page" a
// continuation rather than a jump.
//
// Server-renderable: no hooks, no client state. Interactive actions (RSVP,
// Edit) are passed in as children of the foot by the host, which owns them.
// ============================================================================

export interface SurfacePageProps {
  kind: string;
  title: string;
  kicker?: React.ReactNode;
  /** Small link row above the masthead — "← Amrit Vela Sadhana". */
  crumb?: React.ReactNode;
  rail?: React.ReactNode;
  actions?: SurfaceAction[];
  /** Extra foot content the host owns — a client RSVP control, say. */
  footExtra?: React.ReactNode;
  status?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SurfacePage({
  kind,
  title,
  kicker,
  crumb,
  rail,
  actions,
  footExtra,
  status,
  children,
  className,
  style,
}: SurfacePageProps) {
  const meta = kindMeta(kind);
  const hasFoot = Boolean(status || footExtra || (actions && actions.length > 0));

  return (
    <div className={`eac-surface-page${className ? ` ${className}` : ""}`} data-kind={kind} style={style}>
      {crumb && <div className="eac-surface-page-crumb">{crumb}</div>}
      <article className="eac-surface-panel eac-surface-panel--page">
        <header className="eac-surface-head">
          <span className="eac-surface-glyph" aria-hidden>
            {meta.glyph}
          </span>
          <div className="eac-surface-headings">
            <div className="eac-surface-kicker">
              <span>{kicker ?? meta.label}</span>
            </div>
            <h1 className="eac-surface-title">{title}</h1>
          </div>
        </header>

        <div className={`eac-surface-body${rail ? " has-rail" : ""}`}>
          <div className="eac-surface-main">{children}</div>
          {rail && <aside className="eac-surface-rail">{rail}</aside>}
        </div>

        {hasFoot && (
          <footer className="eac-surface-foot">
            {status ? <div className="eac-surface-status">{status}</div> : <span />}
            <div className="eac-surface-buttons">
              {actions?.map((action, i) => <ActionButton key={`${action.label}-${i}`} action={action} />)}
              {footExtra}
            </div>
          </footer>
        )}
      </article>
    </div>
  );
}
