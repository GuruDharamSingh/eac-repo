"use client";

import * as React from "react";
import type { SurfaceAction, SurfaceKind } from "./types";
import { kindMeta } from "./kinds";

// ============================================================================
// The anatomy every surface shares.
//
//   ┌────────────────────────────────────────────────┐
//   │ ◎  MEETING · ‹ Calendar             [ ← ] [ ✕ ]│  head: glyph, kicker, title
//   │    Amrit Vela Sadhana                          │
//   ├────────────────────────────────────────────────┤  hairline in the kind's colour
//   │  main                            │  rail       │  body scrolls; rail optional
//   ├────────────────────────────────────────────────┤
//   │ status                     [ quiet ] [ PRIMARY]│  foot: one primary, in kind colour
//   └────────────────────────────────────────────────┘
//
// A surface composes these; it does not lay itself out. That is the whole
// reason two surfaces built weeks apart in different apps look like one
// system. The dialog element itself, the stack and the URL are the
// provider's — see SurfaceProvider.
// ============================================================================

export interface SurfaceFrameProps {
  kind: SurfaceKind | string;
  /** The masthead title. Falls back to the kind's label while loading. */
  title?: string | null;
  /** Small text before the title: the kind, a feed, a breadcrumb. Defaults to the kind label. */
  kicker?: React.ReactNode;
  /** Rendered beside the main pane at ≥760px, below it on phones. */
  rail?: React.ReactNode;
  /** Buttons for the foot. One may be `primary`. */
  actions?: SurfaceAction[];
  /** Left side of the foot: "Saving…", an error, a count. */
  status?: React.ReactNode;
  statusTone?: "normal" | "error";
  /** Remove the main pane's padding — a gallery grid wants the edge. */
  flush?: boolean;
  children: React.ReactNode;
}

interface FrameChrome {
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string | null;
  /** Per-layer id for aria-labelledby — layers beneath the top stay mounted. */
  titleId?: string;
}

const ChromeCtx = React.createContext<FrameChrome>({ onClose: () => {} });
export const SurfaceChromeProvider = ChromeCtx.Provider;

export function SurfaceFrame({
  kind,
  title,
  kicker,
  rail,
  actions,
  status,
  statusTone = "normal",
  flush,
  children,
}: SurfaceFrameProps) {
  const chrome = React.useContext(ChromeCtx);
  const meta = kindMeta(kind);

  return (
    <>
      <header className="eac-surface-head">
        <span className="eac-surface-glyph" aria-hidden>
          {meta.glyph}
        </span>
        <div className="eac-surface-headings">
          <div className="eac-surface-kicker">
            {chrome.onBack && chrome.backLabel ? (
              <>
                <button type="button" className="eac-surface-crumb" onClick={chrome.onBack}>
                  ‹ {chrome.backLabel}
                </button>
                <span className="eac-surface-sep" aria-hidden>
                  ·
                </span>
              </>
            ) : null}
            <span>{kicker ?? meta.label}</span>
          </div>
          <h2 className="eac-surface-title" id={chrome.titleId}>
            {title || meta.label || " "}
          </h2>
        </div>
        <div className="eac-surface-controls">
          {chrome.onBack && (
            <button
              type="button"
              className="eac-surface-iconbtn"
              onClick={chrome.onBack}
              aria-label={chrome.backLabel ? `Back to ${chrome.backLabel}` : "Back"}
            >
              ←
            </button>
          )}
          <button
            type="button"
            className="eac-surface-iconbtn"
            onClick={chrome.onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </header>

      <div className={`eac-surface-body${rail ? " has-rail" : ""}`}>
        <div className={`eac-surface-main${flush ? " is-flush" : ""}`}>{children}</div>
        {rail && <aside className="eac-surface-rail">{rail}</aside>}
      </div>

      {(status || (actions && actions.length > 0)) && (
        <footer className="eac-surface-foot">
          {status ? (
            <div className={`eac-surface-status${statusTone === "error" ? " is-error" : ""}`}>
              {status}
            </div>
          ) : (
            <span />
          )}
          {actions && actions.length > 0 && (
            <div className="eac-surface-buttons">
              {actions.map((action, i) => (
                <ActionButton key={`${action.label}-${i}`} action={action} />
              ))}
            </div>
          )}
        </footer>
      )}
    </>
  );
}

export function ActionButton({ action }: { action: SurfaceAction }) {
  const [busy, setBusy] = React.useState(false);
  const cls = [
    "eac-btn",
    action.primary && "eac-btn--primary",
    action.quiet && "eac-btn--quiet",
    action.danger && "eac-btn--danger",
    action.done && "eac-btn--done",
  ]
    .filter(Boolean)
    .join(" ");

  if (action.href && !action.onClick) {
    return (
      <a
        className={cls}
        href={action.href}
        target={action.external ? "_blank" : undefined}
        rel={action.external ? "noreferrer" : undefined}
        download={action.download}
        aria-disabled={action.disabled || undefined}
        onClick={action.disabled ? (e) => e.preventDefault() : undefined}
      >
        {action.label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      disabled={action.disabled || busy}
      aria-busy={busy || undefined}
      onClick={async () => {
        if (!action.onClick) return;
        setBusy(true);
        try {
          await action.onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {action.label}
    </button>
  );
}

/** A labelled section inside the main pane. */
export function SurfaceSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="eac-surface-section">
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

/** The registry entry: label / value pairs. Nulls are skipped. */
export function SurfaceFacts({
  facts,
}: {
  facts: Array<{ label: string; value: React.ReactNode | null | undefined }>;
}) {
  const shown = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
  if (shown.length === 0) return null;
  return (
    <dl className="eac-facts">
      {shown.map((f) => (
        <React.Fragment key={f.label}>
          <dt>{f.label}</dt>
          <dd>{f.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function SurfaceSkeleton({ block = false }: { block?: boolean }) {
  return (
    <div className="eac-skeleton" aria-busy aria-label="Loading">
      {block && <span className="is-block" />}
      <span />
      <span />
      <span />
    </div>
  );
}
