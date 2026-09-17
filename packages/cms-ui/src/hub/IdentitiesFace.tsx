"use client";

import * as React from "react";
import { SurfaceCard, useSurface } from "../surface";
import type { SurfaceIdentity } from "../surface";

// ============================================================================
// "Your names", as a face.
//
// It draws the names themselves rather than describing the feature, for the
// same reason ProfileFace draws the person: a tile that says "Identities —
// manage your profiles" tells you a noun; a tile showing YOU and the two
// other names beside you tells you what you have.
//
// The face shows only what the viewer may write as. There is no direction in
// which it reads "who is behind this name" — that lookup exists once, on the
// server, and never reaches a response this component could render.
// ============================================================================

export function IdentitiesFace({ identities }: { identities?: SurfaceIdentity[] | null }) {
  const surfaces = useSurface();
  const rows = identities ?? [];
  const live = rows.filter((i) => !i.retiredAt);
  const pens = live.filter((i) => i.relation === "pseudonym").length;
  const bodies = live.filter((i) => i.relation === "organization").length;

  const blurb =
    pens || bodies
      ? [
          pens ? `${pens} name${pens === 1 ? "" : "s"} of your own` : null,
          bodies ? `${bodies} ${bodies === 1 ? "body" : "bodies"} you speak for` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Write under another name, or on behalf of a body you steward.";

  return (
    <SurfaceCard
      kind="neutral"
      glyph="◑"
      kicker="You"
      title="Your names"
      blurb={blurb}
      ariaLabel="Open the names you write under"
      onClick={(origin) => surfaces.open({ type: "identities" }, origin)}
      preview={
        live.length ? (
          <div className="eac-face-live eac-ident-face">
            {live.slice(0, 4).map((identity) => (
              <span key={identity.id} className="eac-ident-face-chip">
                <span className="eac-ident-face-dot" aria-hidden>
                  {identity.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={identity.avatarUrl} alt="" />
                  ) : (
                    identity.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="eac-ident-face-name">{identity.displayName}</span>
              </span>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}
