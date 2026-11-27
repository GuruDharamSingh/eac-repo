"use client";

import * as React from "react";
import { mediaThumbnail } from "@elkdonis/commerce/media-thumbnail";
import { FileIcon, badgeOf, familyName, familyOf, formatBytes } from "@elkdonis/cms-ui/file-types";
import { writeMediaDrag } from "@elkdonis/cms-ui/files";
import { fmtDate, kindOf } from "./file-utils";

// File bricks and rows, lifted from MediaLibrary (2026-11-26). They draw anything file-shaped: a
// folder-listing entry or a file item from the search index (listItemToFileLike).

export interface FileLike {
  name: string;
  url?: string;
  thumb?: string;
  mimeType?: string | null;
  size?: number;
  path: string;
  lastModified?: string | null;
}

/** The picture, film frame or type icon a file shows. `size` is the thumbnail width asked for. */
export function FilePreview({ item, size }: { item: FileLike; size: number }) {
  const k = kindOf(item);
  if (item.url && k === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaThumbnail(item.thumb ?? item.url, size)} alt="" loading="lazy" draggable={false} />;
  }
  if (item.url && k === "video") {
    // #t=0.5: the browser shows that frame as the poster.
    return <video src={`${item.url}#t=0.5`} preload="metadata" muted playsInline />;
  }
  const fam = familyOf(item);
  return (
    <span className="chn-brick-blank eac-c-media-blank" aria-hidden>
      <FileIcon family={fam} badge={badgeOf(item, fam)} size={size > 200 ? 56 : 40} />
    </span>
  );
}

/** "Image · 1.7 MB", plus the path when a search spans folders. */
export function fileMeta(item: FileLike, withPath: boolean): string {
  const parts = [familyName(familyOf(item))];
  if (typeof item.size === "number") parts.push(formatBytes(item.size));
  if (withPath) parts.push(item.path);
  return parts.join(" · ");
}

export interface FileTileProps {
  item: FileLike;
  /** browse opens a lightbox; pick and pickMany mark the chosen. */
  mode: "browse" | "pick" | "pickMany";
  /** Chosen (pick, pickMany). */
  on: boolean;
  /** A search across folders: the tooltip and the meta line carry the path. */
  searching?: boolean;
  onActivate: (el: HTMLElement) => void;
  /** Extra marks after the meta line (sale state, hidden). */
  badges?: React.ReactNode;
}

function tileButtonProps(p: FileTileProps) {
  return {
    type: "button" as const,
    draggable: true,
    "aria-pressed": p.mode === "browse" ? undefined : p.on,
    "aria-haspopup": p.mode === "browse" ? ("dialog" as const) : undefined,
    title: p.searching ? p.item.path : p.item.name,
    onDragStart: (e: React.DragEvent) => writeMediaDrag(e, { url: p.item.url!, name: p.item.name }),
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => p.onActivate(e.currentTarget),
  };
}

/** A file's tile in the gallery. Renders its own `<li>`; put it in `<ul className="chn-bricks">`. */
export function FileBrick(p: FileTileProps) {
  return (
    <li>
      <button {...tileButtonProps(p)} className={`chn-brick eac-c-media-brick${p.on ? " is-selected" : ""}`}>
        <FilePreview item={p.item} size={512} />
        <span className="chn-brick-body">
          <strong>{p.item.name}</strong>
          <small>{fileMeta(p.item, Boolean(p.searching))}</small>
          {p.badges}
        </span>
        {p.on ? (
          <span className="eac-c-media-check" aria-hidden>
            ✓
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** A file as a row. Renders its own `<li>`; put it in `<ul className="eac-c-rows">`. */
export function FileRow(p: FileTileProps) {
  return (
    <li>
      <button {...tileButtonProps(p)} className={`eac-c-row eac-c-media-row${p.on ? " is-selected" : ""}`}>
        <span className="eac-c-media-rowthumb">
          <FilePreview item={p.item} size={128} />
        </span>
        <span className="eac-c-row-main">
          <strong>{p.item.name}</strong>
          <span className="eac-c-row-sub">{fileMeta(p.item, Boolean(p.searching))}</span>
        </span>
        <span className="eac-c-row-sub">{p.on ? "Chosen" : ""}</span>
        <time className="eac-c-row-date" dateTime={p.item.lastModified ?? undefined}>
          {fmtDate(p.item.lastModified)}
        </time>
      </button>
    </li>
  );
}
