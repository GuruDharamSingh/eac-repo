"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

/**
 * "Write something…" above the feed.
 *
 * With a provider and a viewer who may compose, it opens the writing room
 * (`write:post`) in place; otherwise it is a link to wherever this host
 * lets the person write (the forum, say). Not a form: the surface is the
 * form, and the bar is only the invitation.
 */
export function CenterComposeBar({
  avatarUrl,
  name,
  href,
  canCompose,
}: {
  avatarUrl: string | null;
  name: string;
  /** Fallback destination when no surface can open. */
  href: string | null;
  canCompose: boolean;
}) {
  const surfaces = useSurfaceOptional();
  // With "Post to…" on the host, anyone who belongs somewhere may post — to
  // any org they are part of, not only this site's (Brief A slice 3); the
  // surface itself says so when there is nowhere. Otherwise the writing
  // room, for this org's editors only, as before.
  const anywhere = Boolean(surfaces?.connectors.postTo);
  const inPlace = Boolean(surfaces) && (anywhere || canCompose);
  if (!inPlace && !href) return null;

  const body = (
    <>
      <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[color:var(--sf-faint)]" aria-hidden>
            ◯
          </span>
        )}
      </span>
      <span className="flex-1 rounded-full border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] px-4 py-2 text-left text-[0.92rem] text-[color:var(--sf-muted)]">
        Write something, {name}…
      </span>
      <span className="eac-btn eac-btn--primary">Post</span>
    </>
  );

  const cls =
    "eac-center-compose flex w-full items-center gap-3 rounded-[var(--sf-radius)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)] p-3 text-[color:var(--sf-fg)] no-underline";

  return inPlace ? (
    <button
      type="button"
      className={cls}
      aria-haspopup="dialog"
      onClick={(e) =>
        surfaces?.open(anywhere ? { type: "postTo" } : { type: "write", kind: "post" }, e.currentTarget)
      }
    >
      {body}
    </button>
  ) : (
    <a className={cls} href={href ?? "#"}>
      {body}
    </a>
  );
}
