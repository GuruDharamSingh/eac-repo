"use client";

import * as React from "react";
import { ExternalLink, X } from "lucide-react";
import { mediaThumbnail } from "@elkdonis/commerce/media-thumbnail";
import { familyName, familyOf, formatBytes } from "@elkdonis/cms-ui/file-types";
import type { ContentListItem } from "../../model";
import type { PieceLightboxAction } from "../PieceLightbox";
import { FilePreview } from "./file-tiles";
import { fmtDate, kindOf } from "./file-utils";
import { listItemToFileLike } from "./file-model";

/** Is this a file item (the file store)? Derived from the key when `store` is absent. */
export const isFileItem = (item: ContentListItem) => (item.store ?? item.key.split(":")[0]) === "file";

/**
 * The lightbox for a file, lifted from MediaLibrary (2026-11-26): the picture or film at size, the kind
 * and where it sits, its size and date, the path, the host's lead button, and Open.
 */
export function FileLightbox({
  item,
  onClose,
  primary,
  railSlot,
  actions,
}: {
  item: ContentListItem;
  onClose: () => void;
  primary?: PieceLightboxAction | null;
  railSlot?: React.ReactNode;
  actions?: PieceLightboxAction[];
}) {
  const f = listItemToFileLike(item);
  const k = kindOf(f);
  const url = item.links.public ?? undefined;
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
          {k === "image" && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaThumbnail(url, 1024)} alt={item.title} />
          ) : k === "video" && url ? (
            <video src={url} controls preload="metadata" playsInline style={{ width: "100%" }} />
          ) : (
            <FilePreview item={f} size={512} />
          )}
        </div>
        <div className="chn-lightbox-text">
          <p className="chn-kicker">
            {familyName(familyOf(f))} · {item.siteName}
          </p>
          <h3>{item.title}</h3>
          <p className="chn-quiet">{[typeof f.size === "number" ? formatBytes(f.size) : "", fmtDate(f.lastModified)].filter(Boolean).join(" · ")}</p>
          <p className="chn-quiet eac-c-media-where">{item.file?.path ?? ""}</p>
          <div className="chn-actions">
            {primary ? (
              primary.href ? (
                <a className="chn-btn is-primary" href={primary.href}>
                  {primary.label}
                </a>
              ) : (
                <button type="button" className="chn-btn is-primary" onClick={primary.onClick}>
                  {primary.label}
                </button>
              )
            ) : null}
            {actions?.map((a) => (a.href ? <a key={a.label} className="chn-btn" href={a.href}>{a.label}</a> : <button key={a.label} type="button" className="chn-btn" onClick={a.onClick}>{a.label}</button>))}
            {railSlot}
            {url ? (
              <a className="chn-link" href={url} target="_blank" rel="noreferrer">
                Open <ExternalLink size={12} aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
