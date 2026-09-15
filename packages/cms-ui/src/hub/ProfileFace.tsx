"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "../surface";
import type { HubProfileSummary } from "./types";
import { faceOf } from "./face-origin";

// ============================================================================
// "My profile", as a face.
//
// Two things changed here from the tile it replaces.
//
// It no longer LEAVES. The tile's href was `${ARTDIRECT_URL}/${slug}` — click
// your own name on your own org's hub and you were on a different site, signed
// in or not, with no way back but the browser's button. The identity is one
// `users` row and the profile surface already reads and writes it, so the face
// opens that instead and the member stays where they are.
//
// And it shows the person rather than describing the feature: their portrait,
// their name, and what is waiting for them. The two doors — Details and Edit —
// are on the face, because "read what's waiting" and "change my bio" are
// different errands and making both start in a form served neither.
// ============================================================================

export function ProfileFace({
  summary,
  /** An org's identity rather than the viewer's own. */
  target,
}: {
  summary: HubProfileSummary | null;
  target?: { kind: "org"; orgId: string };
}) {
  const surfaces = useSurface();
  const open = (mode: "details" | "edit", origin: HTMLElement | null = null) =>
    surfaces.open({ type: "profile", target, mode }, origin);

  const alerts = summary?.alerts;
  const waiting = [
    alerts?.unreadMessages
      ? `${alerts.unreadMessages} unread`
      : null,
    alerts?.notifications
      ? `${alerts.notifications} notification${alerts.notifications === 1 ? "" : "s"}`
      : null,
    alerts?.upcoming ? `${alerts.upcoming} upcoming` : null,
  ].filter(Boolean);

  return (
    <SurfaceCard
      kind="neutral"
      glyph="◍"
      kicker={target ? "Organisation" : "You"}
      title={target ? "Organisation" : "My profile"}
      blurb={
        summary?.headline ??
        (target
          ? "The organisation's name, image and description."
          : "Your bio, portrait and links across the collective.")
      }
      ariaLabel="Open your profile"
      onClick={(origin) => open("details", origin)}
      preview={
        <div className="eac-face-live eac-profile-face">
          <span className="eac-profile-face-id">
            {summary?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="eac-profile-face-avatar"
                src={summary.avatarUrl}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="eac-profile-face-avatar is-empty" aria-hidden>
                {target ? "◆" : "◯"}
              </span>
            )}
            <span className="eac-profile-face-lines">
              <span className="eac-profile-face-name">
                {summary?.displayName ?? "Not set up yet"}
              </span>
              {/* "Nothing waiting" is a CLAIM, so it is only made when the
                  host actually counted. With no `alerts` the line falls back
                  to the headline, or is omitted — saying nothing beats
                  asserting an all-clear nobody checked. */}
              {alerts ? (
                <span className="eac-preview-cue">
                  {waiting.length ? waiting.join(" · ") : "Nothing waiting"}
                </span>
              ) : summary?.headline ? (
                <span className="eac-preview-cue">{summary.headline}</span>
              ) : null}
            </span>
          </span>

          <span className="eac-profile-face-doors">
            <button
              type="button"
              className="eac-preview-action"
              onClick={(e) => open("details", faceOf(e.currentTarget))}
            >
              Details
            </button>
            {summary?.canEdit !== false && (
              <button
                type="button"
                className="eac-preview-action"
                onClick={(e) => open("edit", faceOf(e.currentTarget))}
              >
                Edit
              </button>
            )}
          </span>
        </div>
      }
    />
  );
}
