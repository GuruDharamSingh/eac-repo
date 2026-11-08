"use client";

import * as React from "react";
import { fmtDay, type ContentListItem } from "../model";
import { typeGlyph, typeLabel } from "../registry";
import { Thumb } from "./atoms";
import { OutletMarks, StatusChip } from "./piece-atoms";

export interface PieceRowProps {
  item: ContentListItem;
  timeZone: string;
  /** Click: open the lightbox. The element comes back so focus can return to it. */
  onOpen?: (item: ContentListItem, el: HTMLElement) => void;
  /** Render as a link instead (the host's own piece route). */
  href?: string;
  /** compact: thumbnail, title, kind, chip, date (the pop-up). regular: adds the site and the outlet marks (the /content list). */
  density?: "compact" | "regular";
  /** Name the site in the sub line (when the list spans several). */
  showSite?: boolean;
  current?: boolean;
}

/**
 * One piece as a small row: thumbnail, title, kind, status chip, date. Use
 * inside `<ul className="eac-c-rows">` (a `<li>` is added here), or let
 * PieceList do it. A container query drops the date under the title when the
 * room is narrow (phone, compact pop-up).
 */
export function PieceRow({ item, timeZone, onOpen, href, density = "compact", showSite, current }: PieceRowProps) {
  const date = fmtDay(item.date, timeZone);
  const sub = (
    <span className="eac-c-row-sub">
      <span aria-hidden>{typeGlyph(item.type)}</span> {typeLabel(item.type)}
      {showSite ? ` · ${item.siteName}` : ""}
      {date && <span className="eac-c-row-subdate"> · {date}</span>}
    </span>
  );
  const inner = (
    <>
      <Thumb cover={item.cover} type={item.type} size={density === "regular" ? 44 : 38} h={density === "regular" ? 44 : 38} />
      <span className="eac-c-row-main">
        <strong>{item.title}</strong>
        {density === "compact" ? sub : <span className="eac-c-row-sub">{item.meta || item.excerpt}</span>}
      </span>
      {density === "regular" && (
        <span className="eac-c-row-main">
          {sub}
          <OutletMarks marks={item.marks} />
        </span>
      )}
      <StatusChip status={item.status} label={item.statusNote} />
      <time className="eac-c-row-date" dateTime={item.date ?? undefined}>
        {date}
      </time>
    </>
  );
  return (
    <li>
      {href ? (
        <a className="eac-c-row" data-density={density} href={href} aria-current={current ? "true" : undefined}>
          {inner}
        </a>
      ) : (
        <button type="button" className="eac-c-row" data-density={density} aria-haspopup="dialog" aria-current={current ? "true" : undefined} onClick={(e) => onOpen?.(item, e.currentTarget)}>
          {inner}
        </button>
      )}
    </li>
  );
}

/** A list of rows. */
export function PieceList({ items, ...rest }: { items: ContentListItem[] } & Omit<PieceRowProps, "item">) {
  return (
    <ul className="eac-c-rows">
      {items.map((it) => (
        <PieceRow key={it.key} item={it} {...rest} />
      ))}
    </ul>
  );
}
