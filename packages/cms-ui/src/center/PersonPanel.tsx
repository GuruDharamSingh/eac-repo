"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";
import type { SurfaceProfileTab } from "../surface";
import { CenterComposeBar } from "./CenterComposeBar";

// ============================================================================
// You, across the network — the card as control panel (Brief A slice 4).
//
// The same three things /center's profile card opens, for a host that has no
// /center of its own (arts-collective's network hub): the card opens the
// profile popup, "Where you show" opens it on that tab, and the compose bar
// opens "Post to…". Every door is a surface, so this needs a SurfaceProvider
// with `profile` (and `presence` / `postTo` for those two) above it; without
// one it falls back to `pageHref`.
// ============================================================================

export function PersonPanel({
  name,
  avatarUrl,
  headline,
  pageHref,
}: {
  name: string;
  avatarUrl: string | null;
  headline?: string | null;
  /** The person's public page — the fallback when no provider is mounted. */
  pageHref?: string | null;
}) {
  const surfaces = useSurfaceOptional();
  const profile = surfaces?.connectors.profile;

  const openTab = (tab: SurfaceProfileTab, el: HTMLElement) =>
    surfaces?.open({ type: "profile", tab: tab === "profile" ? undefined : tab }, el);

  const portrait = (
    <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[color:var(--sf-line)] bg-[color:var(--sf-bg-soft)]">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center text-xl text-[color:var(--sf-muted)]" aria-hidden>
          ◯
        </span>
      )}
    </span>
  );

  const card = (
    <>
      {portrait}
      <span className="grid min-w-0 gap-0.5 text-left">
        <span className="font-[family-name:var(--sf-font-record)] text-[0.66rem] uppercase tracking-[0.16em] text-[color:var(--sf-muted)]">
          You · across the collective
        </span>
        <span className="truncate font-[family-name:var(--sf-font-title)] text-[1.35rem] leading-tight">{name}</span>
        {headline && <span className="truncate text-[0.88rem] text-[color:var(--sf-muted)]">{headline}</span>}
      </span>
    </>
  );

  const cardCls =
    "flex min-w-0 basis-full items-center gap-4 sm:basis-0 sm:flex-1 rounded-[var(--sf-radius)] border border-[color:var(--sf-line)] bg-[color:var(--sf-bg)] p-4 text-[color:var(--sf-fg)] no-underline";

  return (
    <section aria-label="You" className="grid gap-3">
      <div className="flex flex-wrap items-stretch gap-3">
        {profile ? (
          <button type="button" aria-haspopup="dialog" className={cardCls} onClick={(e) => openTab("profile", e.currentTarget)}>
            {card}
            {/* The whole card is the button; the label only where there is room. */}
            <span className="ml-auto hidden shrink-0 text-[0.85rem] underline underline-offset-2 sm:inline">Your profile</span>
          </button>
        ) : pageHref ? (
          <a className={cardCls} href={pageHref}>
            {card}
          </a>
        ) : (
          <div className={cardCls}>{card}</div>
        )}
        {profile?.presence && (
          <button
            type="button"
            aria-haspopup="dialog"
            className="eac-btn sm:self-center"
            onClick={(e) => openTab("show", e.currentTarget)}
          >
            Where you show
          </button>
        )}
      </div>
      {surfaces?.connectors.postTo && (
        <CenterComposeBar avatarUrl={avatarUrl} name={name.split(" ")[0] || "you"} href={null} canCompose />
      )}
    </section>
  );
}
