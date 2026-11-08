"use client";

import * as React from "react";
import { ExternalLink, X } from "lucide-react";
import type { ContentListItem } from "../model";
import { typeGlyph, typeLabel } from "../registry";
import { Timeline } from "./atoms";
import { KindLine, OutletMarks } from "./piece-atoms";

// Lifted from Channel's library (components/channel/Library.tsx: the brick and
// the lightbox, 2026-11-08). The markup and class names are Channel's own, so
// Channel renders them unchanged; the host supplies only the data and what
// "Manage this piece" does (connectors, no next/*, no app actions).

export interface PieceBrickProps {
  item: ContentListItem;
  onOpen: (item: ContentListItem, el: HTMLElement) => void;
  /** Tags the brick "Open now" (the piece the host already has open). */
  current?: boolean;
}

/** A piece's tile in the gallery. Renders its own `<li>`; put it in `<ul className="chn-bricks">`. */
export function PieceBrick({ item, onOpen, current }: PieceBrickProps) {
  return (
    <li>
      <button type="button" className="chn-brick" onClick={(e) => onOpen(item, e.currentTarget)} aria-haspopup="dialog">
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

export interface PieceLightboxProps {
  item: ContentListItem;
  timeZone: string;
  onClose: () => void;
  /** The lead button: "Manage this piece" (opens the piece view) or "Use this piece" (a chooser). */
  primary?: PieceLightboxAction | null;
}

/**
 * The small box that opens when you click a brick or a row: the cover, the
 * kind and site, the title, the meta line and excerpt, the outlet marks, the
 * last four timeline rows, and the way on: Manage this piece, Open in Studio,
 * View. Absolutely positioned over its nearest positioned parent (the
 * library or the pop-up body), which the host should make inert behind it.
 */
export function PieceLightbox({ item, timeZone, onClose, primary }: PieceLightboxProps) {
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
          {item.excerpt && <p>{item.excerpt}</p>}
          <h4 className="chn-kicker">Coverage</h4>
          <OutletMarks marks={item.marks} />
          <Timeline events={item.timeline} identities={[]} timeZone={timeZone} limit={4} />
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
            {item.links.studio && (
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
