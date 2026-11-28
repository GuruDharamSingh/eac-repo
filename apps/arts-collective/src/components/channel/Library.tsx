"use client";

import * as React from "react";
import { ContentLibrary } from "@elkdonis/content/ui";
import { SurfaceFrame } from "@elkdonis/cms-ui/surface";
import { useChannel } from "./context";

const FORUM = (process.env.NEXT_PUBLIC_FORUM_URL ?? "https://forum.arts-collective.com").replace(/\/$/, "");

/**
 * Content library (3b): the Content tab of network search, now the shared
 * `ContentLibrary` in remote mode (content cornerstone, Step 7). The server
 * decides what this person may see (`/api/content/search`, scope `mine` plus the orgs this person runs, and
 * one org at a time through the scope toggle); the bricks and lightbox are the
 * library's own. Grouped by site. Picking a piece replaces the piece pop-up
 * beneath with that piece's pop-up.
 */
export function LibrarySurface({ fromKey, onPick }: { fromKey: string | null; onPick?: (key: string) => void }) {
  const { model, openPiece, surface } = useChannel();
  const pick = (key: string) => {
    onPick?.(key);
    surface.pop();
  };
  const startKind = fromKey?.startsWith("kind:") ? fromKey.slice(5) : null;
  const current = fromKey && !fromKey.startsWith("kind:") ? fromKey : null;

  return (
    <SurfaceFrame kind="gallery" kicker={onPick ? "Content library" : "Network search"} title={onPick ? "Choose a piece" : "Content library"} flush>
      <div className="chn-lib">
        <ContentLibrary
          source={{ endpoint: "/api/content/search" }}
          scope={{ kind: "mine", includeManagedOrgs: true }}
          identities={model.identities}
          groupBy="site"
          timeZone={model.timeZone}
          currentKey={current}
          initial={startKind ? { kind: startKind as never } : undefined}
          searchPlaceholder="Search your sites"
          header={
            <nav className="chn-tabs is-inline" aria-label="Network search">
              <span aria-current="page">Content</span>
              <a href="/artists">People</a>
              <a href="/directory">Sites</a>
              <a href={FORUM}>Forum</a>
            </nav>
          }
          primaryAction={(item) => (onPick ? { label: "Use this piece", onClick: () => pick(item.key) } : { label: "Manage this piece", onClick: () => openPiece(item.key) })}
        />
      </div>
    </SurfaceFrame>
  );
}
