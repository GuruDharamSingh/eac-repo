"use client";

import * as React from "react";
import { ForumMini, SurfaceCard, useSurface } from "@elkdonis/cms-ui/surface";
import type { SurfaceForum } from "@elkdonis/cms-ui/surface";
import { FORUM_SURFACES } from "./forum-keys";
import "./forum-card.css";

/**
 * The forum card on the Organization page: the selected org's board at a glance.
 *
 * Same as cms-ui's `ForumFace` (what Sunjay's hub draws): "N new" or the title, "N topics · M posts", the first
 * sections, and up to six latest titles; a click opens the forum surface. It is built from the same parts
 * (SurfaceCard + ForumMini) rather than calling ForumFace itself for one reason: it adds one live control,
 * "Across your organisations", which opens the cross-org board the page used to carry at its foot.
 *
 * Draw it inside the console's SurfaceProvider, and give it the snapshot from `loadOrgForumFace` (server).
 */
export function OrgForumFace({ forum }: { forum: SurfaceForum | null }) {
  const surfaces = useSurface();

  if (!forum) {
    return (
      <SurfaceCard
        kind="forum"
        kicker={null}
        title="Forum"
        blurb="This organisation's forum has not been set up."
        disabled
      />
    );
  }

  const unread = forum.unreadCount ?? 0;
  const blurb =
    unread > 0
      ? `${unread} ${unread === 1 ? "topic has" : "topics have"} something new.`
      : `${forum.topicCount} ${forum.topicCount === 1 ? "topic" : "topics"} · ${forum.postCount} ${forum.postCount === 1 ? "post" : "posts"}.`;

  return (
    <SurfaceCard
      kind="forum"
      kicker={null}
      title={unread > 0 ? `${unread} new` : forum.title}
      blurb={blurb}
      surface={{ type: "forum" }}
      tools={
        (forum.feeds?.length ?? 0) > 0 ? (
          <span className="eac-forum-face-feeds">
            {(forum.feeds ?? []).slice(0, 4).map((f) => (
              <span key={f.slug} className={`eac-forum-face-feed${f.unreadCount ? " is-unread" : ""}`}>
                {f.name}
              </span>
            ))}
          </span>
        ) : undefined
      }
      preview={
        <div className="afc-face-preview">
          <ForumMini recent={forum.recent ?? []} />
          <span className="eac-face-live">
            <button
              type="button"
              className="afc-across"
              onClick={(e) =>
                surfaces.open(
                  { type: "custom", key: FORUM_SURFACES.across, title: "Across your organisations", kind: "forum", size: "wide" },
                  e.currentTarget
                )
              }
            >
              Across your organisations
            </button>
          </span>
        </div>
      }
    />
  );
}
