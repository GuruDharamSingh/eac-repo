"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

// ============================================================================
// You, as a picture — beside the calendar.
//
// Just the photo, with your name as a small label in its bottom-left corner
// (on its own solid ground, so it reads on any photo). Under it three doors:
// Profile (edit it, in the popup), Page (which sections your page carries —
// the popup's Page tab) and Center (your /center).
// ============================================================================

export function HubPortrait({
  name,
  avatarUrl,
  centerHref = "/center",
}: {
  name: string;
  avatarUrl: string | null;
  centerHref?: string | null;
}) {
  const surfaces = useSurfaceOptional();
  const profile = surfaces?.connectors.profile;
  const openTab = (el: HTMLElement, tab?: "page") => surfaces?.open({ type: "profile", tab }, el);

  return (
    <section className="eac-hs-portrait" aria-label="You">
      <div className="eac-hs-portrait-img">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" />
        ) : (
          <span className="eac-hs-portrait-initial" aria-hidden>
            {name.slice(0, 1)}
          </span>
        )}
        <span className="eac-hs-portrait-name">{name}</span>
      </div>
      <nav className="eac-hs-portrait-doors" aria-label="Your profile">
        {/* "Profile" is the door to Center since 2026-10-18 (developer): the
            card, payouts, where you show and what to do next are there. The
            popup stays reachable from Center itself. Without a center the
            button keeps opening the popup. */}
        {centerHref ? (
          <a href={centerHref}>Profile</a>
        ) : (
          profile && (
            <button type="button" aria-haspopup="dialog" onClick={(e) => openTab(e.currentTarget)}>
              Profile
            </button>
          )
        )}
        {profile?.page && (
          <button type="button" aria-haspopup="dialog" onClick={(e) => openTab(e.currentTarget, "page")}>
            Page
          </button>
        )}
        {centerHref && <a href={centerHref}>Center</a>}
      </nav>
    </section>
  );
}
