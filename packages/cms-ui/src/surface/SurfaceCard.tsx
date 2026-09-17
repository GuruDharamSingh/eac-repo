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
  /**
   * Receives the face element, so a card that opens its OWN surface (the
   * hub faces do: they pass `onClick` and no `surface`) can still hand the
   * face over and grow out of it. Ignore the argument and nothing changes.
   */
  onClick?: (origin: HTMLElement | null) => void;
  /** Drawn between the blurb and the title block: server-rendered, so it
   *  costs nothing on the client and is visible before any JS runs. */
  preview?: React.ReactNode;
  /**
   * The top row — where the kind's medallion sits by default.
   *
   * That row was decoration: a 32px tinted tile restating a kind the card's
   * own accent, kicker and title already say three other ways, occupying the
   * most reachable corner of every tile. Anything passed here takes it
   * instead and is LIVE (the face's content is otherwise inert so the whole
   * card can be one hit target), so a face can put its most useful control
   * where the ornament was: an RSVP on the gathering, a personal/team switch
   * on the drive, a quick-add on the board.
   *
   * The glyph is dropped when this is present — two marks competing for one
   * corner is what the slot exists to stop.
   */
  tools?: React.ReactNode;
  /**
   * Where the title block sits.
   *
   * "footer" (the default) puts kicker/title/blurb at the BOTTOM, under the
   * preview, so a row of tiles shares a baseline however tall each preview
   * is. Right for a grid read at a glance.
   *
   * "header" leads with the title and puts the live content beneath it —
   * right for a face you read top-down and then USE, where the preview is
   * the point (a list of documents, an input, a directory) rather than a
   * glance-value summary.
   */
  layout?: "footer" | "header";
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
  tools,
  layout = "footer",
  className,
}: SurfaceCardProps) {
  const surfaces = useSurfaceOptional();
  const meta = kindMeta(kind);

  const cls = [
    "eac-face",
    wide && "eac-face--wide",
    small && "eac-face--small",
    layout === "header" && "eac-face--header",
    tools && "eac-face--tools",
    disabled && "is-disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const cueText = cue ?? (href && !surface ? "→" : "+");

  // The kicker names the kind; the title names the thing. When a face is
  // simply its own kind — Calendar, Compose — the default kicker repeats the
  // title verbatim, and the card says the same word twice in two type sizes.
  // A host can still pass one explicitly, and `null` still suppresses it.
  const defaultKicker = meta.label;
  const resolvedKicker =
    kicker === null
      ? null
      : (kicker ??
         (defaultKicker && defaultKicker.toLowerCase() === title.trim().toLowerCase()
           ? null
           : defaultKicker));

  const hit = disabled ? null : href && !surface ? (
    <a className="eac-face-hit" href={href} aria-label={ariaLabel ?? title} />
  ) : (
    <button
      type="button"
      className="eac-face-hit"
      aria-label={ariaLabel ?? title}
      aria-haspopup={surface ? "dialog" : undefined}
      onClick={(e) => {
        // Hand the face itself over, so the surface grows out of it rather
        // than appearing from nowhere — see the morph in surface.css.
        const face = e.currentTarget.closest<HTMLElement>(".eac-face");
        if (surface && surfaces) {
          surfaces.open(surface, face);
        } else if (href) {
          window.location.assign(href);
        }
        onClick?.(face);
      }}
    />
  );

  const titleBlock = (
    <div className="eac-face-head">
      {resolvedKicker && <span className="eac-face-kicker">{resolvedKicker}</span>}
      <span className="eac-face-title">{title}</span>
      {blurb && <span className="eac-face-blurb">{blurb}</span>}
    </div>
  );

  return (
    <article className={cls} data-kind={kind} aria-disabled={disabled || undefined}>
      {hit}
      {tools ? (
        // Live, unlike everything else in a face: the whole card is a hit
        // target behind inert content, and a control in this row has to take
        // its own clicks back.
        <div className="eac-face-tools eac-face-live">{tools}</div>
      ) : layout === "header" ? null : (
        // Dropped entirely in the header layout. The medallion is absolutely
        // positioned in the card's top-left, which is exactly where a
        // header-led face puts its title — drawn, it sits BEHIND the first
        // word. Reserving a row for it instead would give back the space the
        // header layout exists to reclaim, and the kind is already said by
        // the card's accent, its top edge and its kicker. So: a face either
        // leads with its mark, or leads with its title.
        <span className="eac-face-glyph" aria-hidden>
          {glyph ?? meta.glyph}
        </span>
      )}
      {/* The corner cue is a hint that the card opens — a "+" or a "→". On a
          card carrying a real tools row it is the opposite of useful: an
          unlabelled mark competing with actual controls for the same band,
          and the first thing anyone asks about it is what it does. A face
          with tools has its actions on show; it does not need a hint too. */}
      {!disabled && !tools && (
        <span className="eac-face-cue" aria-hidden>
          {cueText}
        </span>
      )}
      {layout === "header" && titleBlock}
      {preview !== undefined && <div className="eac-face-preview">{preview}</div>}
      {layout === "footer" && titleBlock}
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
