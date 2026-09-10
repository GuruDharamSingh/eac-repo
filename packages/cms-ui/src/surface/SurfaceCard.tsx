"use client";

import * as React from "react";
import type { SurfaceDescriptor, SurfaceKind } from "./types";
import { kindMeta } from "./kinds";
import { useSurfaceOptional } from "./context";

// ============================================================================
// The face: a card whose click opens its surface.
//
// Generalised from ifac's HubCard (tile face + native dialog) and
// amrit-canada's CalendarCard (stretched link behind live content). The whole
// face is the hit target, but the content is inert to the pointer so a face
// can carry something live — a month grid whose days are their own targets —
// and a click on nothing in particular still opens the surface.
//
// Three ways a face can resolve a click, in order:
//   surface   opens a descriptor through the nearest SurfaceProvider
//   href      navigates — for a feature whose depth is a page, not a popup
//   onClick   anything else
// ============================================================================

export interface SurfaceCardProps {
  title: string;
  blurb?: string;
  /** Overrides the kind's glyph. */
  glyph?: string;
  /** Colours the hairline and glyph, names the kicker. */
  kind?: SurfaceKind | string;
  /** Small mono text above the title. Defaults to the kind's label. */
  kicker?: string | null;
  surface?: SurfaceDescriptor;
  href?: string;
  onClick?: () => void;
  /** Drawn between the blurb and the title block: server-rendered, so it
   *  costs nothing on the client and is visible before any JS runs. */
  preview?: React.ReactNode;
  /** Full-width in the grid. */
  wide?: boolean;
  /** Dense — the compose picker's options. */
  small?: boolean;
  /** Renders muted, no target. Prefer omitting the card altogether. */
  disabled?: boolean;
  /** Text for the hit-area's accessible name. Defaults to the title. */
  ariaLabel?: string;
  /** The corner cue. "+" opens a surface, "→" navigates. */
  cue?: string;
  className?: string;
}

export function SurfaceCard({
  title,
  blurb,
  glyph,
  kind = "neutral",
  kicker,
  surface,
  href,
  onClick,
  preview,
  wide,
  small,
  disabled,
  ariaLabel,
  cue,
  className,
}: SurfaceCardProps) {
  const surfaces = useSurfaceOptional();
  const meta = kindMeta(kind);

  const cls = [
    "eac-face",
    wide && "eac-face--wide",
    small && "eac-face--small",
    disabled && "is-disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const cueText = cue ?? (href && !surface ? "→" : "+");

  const hit = disabled ? null : href && !surface ? (
    <a className="eac-face-hit" href={href} aria-label={ariaLabel ?? title} />
  ) : (
    <button
      type="button"
      className="eac-face-hit"
      aria-label={ariaLabel ?? title}
      aria-haspopup={surface ? "dialog" : undefined}
      onClick={() => {
        if (surface && surfaces) surfaces.open(surface);
        else if (href) window.location.assign(href);
        onClick?.();
      }}
    />
  );

  return (
    <article className={cls} data-kind={kind} aria-disabled={disabled || undefined}>
      {hit}
      <span className="eac-face-glyph" aria-hidden>
        {glyph ?? meta.glyph}
      </span>
      {!disabled && (
        <span className="eac-face-cue" aria-hidden>
          {cueText}
        </span>
      )}
      {preview !== undefined && <div className="eac-face-preview">{preview}</div>}
      {kicker !== null && (kicker ?? meta.label) && (
        <span className="eac-face-kicker">{kicker ?? meta.label}</span>
      )}
      <span className="eac-face-title">{title}</span>
      {blurb && <span className="eac-face-blurb">{blurb}</span>}
    </article>
  );
}

/** The grid faces sit in. Plain CSS; `wide` faces span it. */
export function SurfaceCardGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`eac-face-grid${className ? ` ${className}` : ""}`}>{children}</div>;
}
