"use client";

import * as React from "react";
import { useSurfaceOptional } from "../surface";

// ============================================================================
// What the group has been posting — full width, newest first after pins.
//
// Rows open the thread in place. The host decides the scope (org threads a
// member may read); this only draws them. Nothing yet → nothing drawn.
// ============================================================================

export interface ActivityItem {
  id: string;
  title: string;
  kind: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  authorName?: string | null;
  authorAvatar?: string | null;
  at?: string | null;
  pinned?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  post: "Post",
  meeting: "Gathering",
  event: "Event",
  workshop: "Workshop",
  idea: "Idea",
  service: "Offering",
};

export function ActivityFeed({ items, moreHref }: { items: ActivityItem[]; moreHref?: string | null }) {
  const surfaces = useSurfaceOptional();
  if (items.length === 0) return null;
  return (
    <section className="eac-hs-feed" aria-label="Latest from the group">
      <div className="eac-hs-row-head">
        <h2 className="eac-hs-h">Latest</h2>
        {moreHref && (
          <a className="eac-hs-link" href={moreHref}>
            Everything on the forum →
          </a>
        )}
      </div>
      <ul className="eac-hs-feed-list">
        {items.map((t) => {
          const body = (
            <>
              <span className="eac-hs-avatar">
                {t.authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.authorAvatar} alt="" />
                ) : (
                  <span aria-hidden>{(t.authorName ?? t.title).slice(0, 1)}</span>
                )}
              </span>
              <span className="eac-hs-feed-text">
                <span className="eac-hs-feed-meta">
                  <span className="eac-hs-tag">{KIND_LABEL[t.kind] ?? t.kind}</span>
                  {t.pinned && <span className="eac-hs-tag">Pinned</span>}
                  {t.authorName && <span>{t.authorName}</span>}
                  {t.at && (
                    <span>
                      {new Date(t.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                </span>
                <span className="eac-hs-feed-title">{t.title}</span>
                {t.excerpt && <span className="eac-hs-feed-excerpt">{t.excerpt}</span>}
              </span>
              {t.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="eac-hs-feed-cover" src={t.coverImageUrl} alt="" loading="lazy" />
              )}
            </>
          );
          return (
            <li key={t.id}>
              <button
                type="button"
                className="eac-hs-feed-row"
                aria-haspopup="dialog"
                onClick={(e) =>
                  surfaces?.open({ type: "thread", id: t.id, preview: { title: t.title, kind: t.kind } }, e.currentTarget)
                }
              >
                {body}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
