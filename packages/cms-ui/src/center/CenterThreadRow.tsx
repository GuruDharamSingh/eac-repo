"use client";

import * as React from "react";
import { kindMeta, useSurfaceOptional } from "../surface";
import type { CenterThread } from "./types";

/**
 * One line of the org's feed — a row-shaped face.
 *
 * A real link, so it works without JavaScript and keeps its meaning under a
 * modifier-click. With a SurfaceProvider above it, a plain click opens the
 * thread's surface in place instead; without one (a host that has not
 * mounted the provider yet) it simply navigates.
 *
 * Two shapes: the compact row (kind · title · note) and, with `post`, the
 * post card — the author's avatar beside the words, the way a social feed
 * shows who said it, with the cover image on the right.
 */
export function CenterThreadRow({
  thread,
  href,
  meta,
  openInPlace = true,
  post = false,
}: {
  thread: CenterThread;
  href: string;
  /** The right-hand note: a date, a kind, an org name. */
  meta: string | null;
  /** False for another org's thread — its surface lives on its own site. */
  openInPlace?: boolean;
  /** Render as a post card with the author. */
  post?: boolean;
}) {
  const surfaces = useSurfaceOptional();
  const k = kindMeta(thread.kind);

  function onClick(e: React.MouseEvent) {
    if (!openInPlace || !surfaces) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    // The row is the face here, so the surface grows out of the row.
    surfaces.open(
      {
        type: "thread",
        id: thread.id,
        preview: {
          title: thread.title,
          kind: thread.kind,
          scheduledAt: thread.scheduledAt,
          coverImageUrl: thread.coverImageUrl,
        },
      },
      e.currentTarget as HTMLElement
    );
  }

  if (post) {
    const label = thread.pinned ? "pinned" : k.label || thread.kind;
    return (
      <a
        className="eac-center-post group grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-t border-[color:var(--sf-line)] py-3 no-underline text-[color:var(--sf-fg)] first:border-t-0 focus-visible:outline-2 focus-visible:outline-[color:var(--sf-accent)]"
        href={href}
        data-kind={thread.kind}
        onClick={onClick}
      >
        <span className="block h-11 w-11 overflow-hidden rounded-full border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
          {thread.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thread.authorAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-[color:var(--sf-faint)]" aria-hidden>
              ◯
            </span>
          )}
        </span>
        <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
          <span className="min-w-0">
            <span className="block truncate text-[0.82rem]">
              <b className="font-semibold">{thread.authorName ?? thread.orgName}</b>
              {meta && <span className="text-[color:var(--sf-muted)]"> · {meta}</span>}
            </span>
            <span className="block font-[family-name:var(--sf-font-title)] text-[1.05rem] leading-snug transition-colors group-hover:text-[color:var(--sf-accent)]">
              {thread.title}
            </span>
            {thread.excerpt && (
              <span className="mt-1 line-clamp-2 block text-[0.88rem] leading-snug text-[color:var(--sf-muted)]">
                {thread.excerpt}
              </span>
            )}
            <span className="eac-center-row-k mt-1 block">{label}</span>
          </span>
          {thread.coverImageUrl && (
            <span className="block h-16 w-24 overflow-hidden rounded-[var(--sf-radius-sm)] border border-[color:var(--sf-line)] sm:h-20 sm:w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thread.coverImageUrl} alt="" className="h-full w-full object-cover" />
            </span>
          )}
        </span>
      </a>
    );
  }

  return (
    <a className="eac-center-row" href={href} data-kind={thread.kind} onClick={onClick}>
      <span className="eac-center-row-k" aria-hidden>
        {thread.pinned ? "pinned" : k.label || thread.kind}
      </span>
      <span className="eac-center-row-t">{thread.title}</span>
      {meta && <span className="eac-center-row-d">{meta}</span>}
    </a>
  );
}
