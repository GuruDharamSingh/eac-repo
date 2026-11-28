"use client";

import * as React from "react";
import { ExternalLink, X } from "lucide-react";
import type { ContentListItem } from "../model";
import { typeGlyph, typeLabel } from "../registry";
import { Timeline } from "./atoms";
import { KindLine, OutletMarks } from "./piece-atoms";
import { ItemBadges } from "./library/badges";
import { FileLightbox, isFileItem } from "./library/file-lightbox";

// Lifted from Channel's library (components/channel/Library.tsx: the brick and
// the lightbox, 2026-11-08). The markup and class names are Channel's own, so
// Channel renders them unchanged; the host supplies only the data and what
// "Manage this piece" does (connectors, no next/*, no app actions).

export interface PieceBrickProps {
  item: ContentListItem;
  onOpen: (item: ContentListItem, el: HTMLElement) => void;
  /** Tags the brick "Open now" (the piece the host already has open). */
  current?: boolean;
  /** pick / pickMany: a click chooses the piece (aria-pressed) instead of opening the lightbox. Default: open it. */
  mode?: "browse" | "pick" | "pickMany";
  /** Chosen (pick, pickMany). */
  selected?: boolean;
  /** pick modes: the piece cannot be chosen (server said can.pick is false). */
  disabled?: boolean;
  /** pick modes, someone else's piece: "Owner name · Site", so it reads as a reference. */
  attribution?: string | null;
}

/** A piece's tile in the gallery. Renders its own `<li>`; put it in `<ul className="chn-bricks">`. */
export function PieceBrick({ item, onOpen, current, mode = "browse", selected, disabled, attribution }: PieceBrickProps) {
  const picking = mode !== "browse";
  return (
    <li>
      <button
        type="button"
        className={`chn-brick${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
        onClick={(e) => onOpen(item, e.currentTarget)}
        aria-haspopup={picking ? undefined : "dialog"}
        aria-pressed={picking ? Boolean(selected) : undefined}
        aria-disabled={disabled ? true : undefined}
      >
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt="" loading="lazy" />
        ) : (
          <span className="chn-brick-blank" data-kind={item.type} aria-hidden>
            {typeGlyph(item.type)}
          </span>
        )}
        <span className="chn-brick-body">
          <strong>
            {item.title} {current && <span className="chn-tag is-now">Open now</span>}
          </strong>
          <KindLine type={item.type} />
          <OutletMarks marks={item.marks} />
          <small data-motion={item.note?.motion ? "1" : "0"}>{item.note?.text}</small>
          <ItemBadges item={item} />
          {attribution ? <small className="eac-c-attrib">{attribution}</small> : null}
        </span>
      </button>
    </li>
  );
}

export interface PieceLightboxAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

/** A secondary action: a plain button or link. */
export function ActionButton({ action }: { action: PieceLightboxAction }) {
  return action.href ? (
    <a className="chn-btn" href={action.href}>
      {action.label}
    </a>
  ) : (
    <button type="button" className="chn-btn" onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export interface PieceLightboxProps {
  item: ContentListItem;
  timeZone: string;
  onClose: () => void;
  /** The lead button: "Manage this piece" (opens the piece view) or "Use this piece" (a chooser). */
  primary?: PieceLightboxAction | null;
  /** The host's own buttons beside the lead one (the market's "Write about it", "Make into a post"). */
  railSlot?: React.ReactNode;
  /** Secondary actions after the lead button (CONTRACT §10.9). */
  actions?: PieceLightboxAction[];
  /** pickPart="image": the piece's images as selectable thumbs; choosing one reports it. */
  imagePick?: { images: string[]; onChoose: (image: string) => void };
}

/**
 * The small box that opens when you click a brick or a row: the cover, the
 * kind and site, the title, the meta line and excerpt, the outlet marks, the
 * last four timeline rows, and the way on: Manage this piece, Open in Studio,
 * View. Absolutely positioned over its nearest positioned parent (the
 * library or the pop-up body), which the host should make inert behind it.
 */
export function PieceLightbox({ item, timeZone, onClose, primary, railSlot, actions, imagePick }: PieceLightboxProps) {
  // A file (CONTRACT §2: store "file") has no coverage or timeline; it gets the file box MediaLibrary always had.
  if (isFileItem(item)) return <FileLightbox item={item} onClose={onClose} primary={primary} railSlot={railSlot} actions={actions} />;
  return (
    <div
      className="chn-lightbox"
      role="dialog"
      aria-label={item.title}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="chn-lightbox-inner">
        <button type="button" className="chn-iconbtn chn-lightbox-x" aria-label="Close preview" onClick={onClose} autoFocus>
          <X size={16} />
        </button>
        <div className="chn-lightbox-media">
          {item.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cover} alt={item.title} />
          ) : (
            <span className="chn-brick-blank is-big" aria-hidden>
              {typeGlyph(item.type)}
            </span>
          )}
        </div>
        <div className="chn-lightbox-text">
          <p className="chn-kicker">
            {typeGlyph(item.type)} {typeLabel(item.type)} · {item.siteName}
          </p>
          <h3>{item.title}</h3>
          <p className="chn-quiet">{item.meta}</p>
          <ItemBadges item={item} />
          {item.excerpt && <p>{item.excerpt}</p>}
          {imagePick ? (
            <>
              <h4 className="chn-kicker">Choose an image</h4>
              <ul className="eac-c-imgpick">
                {imagePick.images.map((src, i) => (
                  <li key={src}>
                    <button type="button" className="eac-c-imgpick-btn" aria-label={`Use image ${i + 1}${i === 0 ? " (cover)" : ""}`} onClick={() => imagePick.onChoose(src)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h4 className="chn-kicker">Coverage</h4>
          <OutletMarks marks={item.marks} />
          {item.hidden ? (
            <p className="eac-c-hiddenline">
              <strong>Hidden from the site</strong>
            </p>
          ) : (
            <Timeline events={item.timeline} identities={[]} timeZone={timeZone} limit={4} />
          )}
          <div className="chn-actions">
            {primary &&
              (primary.href ? (
                <a className="chn-btn is-primary" href={primary.href}>
                  {primary.label}
                </a>
              ) : (
                <button type="button" className="chn-btn is-primary" onClick={primary.onClick}>
                  {primary.label}
                </button>
              ))}
            {actions?.map((a) => <ActionButton key={a.label} action={a} />)}
            {railSlot}
            {/* Owner tool: only when the server says this viewer may edit it (item.can.edit), never to a stranger. */}
            {item.can?.edit && item.links.studio && (
              <a className="chn-btn" href={item.links.studio}>
                Open in Studio
              </a>
            )}
            {item.links.public && (
              <a className="chn-link" href={item.links.public} target="_blank" rel="noreferrer">
                View <ExternalLink size={12} aria-hidden />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
