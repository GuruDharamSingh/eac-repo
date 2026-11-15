"use client";

import * as React from "react";
import type { SurfaceDescriptor } from "./types";
import { useSurface } from "./context";
import { SurfaceFrame } from "./SurfaceShell";
import { ThreadSurface } from "./surfaces/ThreadSurface";
import { ComposeSurface } from "./surfaces/ComposeSurface";
import { CalendarSurface } from "./surfaces/CalendarSurface";
import { GallerySurface } from "./surfaces/GallerySurface";
import { WriteSurface } from "./surfaces/WriteSurface";
import { BoardSurface, BoardCardSurface } from "./surfaces/BoardSurface";
import { ForumFeedSurface, ForumSurface } from "./surfaces/ForumSurface";
import { ProfileSurface } from "./surfaces/ProfileSurface";
import { CenterLayoutSurface } from "./surfaces/CenterLayoutSurface";
import { DefineSurface } from "./surfaces/DefineSurface";
import { DocumentsSurface } from "./surfaces/DocumentsSurface";
import { IdentitiesSurface } from "./surfaces/IdentitiesSurface";
import { MaterialSurface } from "./surfaces/MaterialSurface";
import { GatherSurface } from "./surfaces/GatherSurface";
import { PostToSurface } from "./surfaces/PostToSurface";
import { JourneySurface } from "./surfaces/JourneySurface";
import { MeSurface } from "./surfaces/MeSurface";
import { ArtworkSurface } from "./surfaces/ArtworkSurface";
import { asSurfaceKind } from "./kinds";
import type { SurfaceConnectors } from "./types";

/**
 * The shared site form a host registered for a thread kind (2026-11-14), as `connectors.custom["compose:<id>"]`
 * (@elkdonis/site-forms): the catalogue's id is the kind's own, except a post (`article`, `post` or `blog`).
 * Null when the host registered none, so the old form opens as before.
 */
function sharedFormKey(connectors: SurfaceConnectors, kind: string | undefined): string | null {
  if (!kind) return null;
  const ids = kind === "post" ? ["article", "post", "blog"] : [kind];
  for (const id of ids) if (connectors.custom?.[`compose:${id}`]) return `compose:${id}`;
  return null;
}

/** Descriptor → surface. The only place that knows every surface's name. */
export function SurfaceRouter({ descriptor }: { descriptor: SurfaceDescriptor }) {
  const { connectors } = useSurface();

  switch (descriptor.type) {
    case "thread":
      return <ThreadSurface descriptor={descriptor} />;
    case "compose": {
      // A kind the host draws with the shared form (thread Edit, the calendar's "+ add", hub tiles):
      // open that, editing `threadId` or starting from `prefill`. Signing as another identity stays on
      // the old form, which knows `actingAs`.
      const key = descriptor.actingAs ? null : sharedFormKey(connectors, descriptor.kind);
      if (key) return <>{connectors.custom![key]!({ descriptor: sharedDescriptor(key, descriptor.kind, descriptor.threadId, descriptor.prefill) })}</>;
      return <ComposeSurface descriptor={descriptor} />;
    }
    case "calendar":
      return <CalendarSurface descriptor={descriptor} />;
    case "gallery":
      return <GallerySurface descriptor={descriptor} />;
    case "write": {
      // The writing room's post: the shared post form where the host registered one.
      const key = sharedFormKey(connectors, "post");
      if (key) return <>{connectors.custom![key]!({ descriptor: sharedDescriptor(key, "post", descriptor.threadId, descriptor.prefill) })}</>;
      return <WriteSurface descriptor={descriptor} />;
    }
    case "board":
      return <BoardSurface />;
    case "boardCard":
      return <BoardCardSurface descriptor={descriptor} />;
    case "forum":
      return <ForumSurface />;
    case "forumFeed":
      return <ForumFeedSurface descriptor={descriptor} />;
    case "documents":
      return <DocumentsSurface descriptor={descriptor} />;
    case "identities":
      return <IdentitiesSurface />;
    case "profile":
      return <ProfileSurface descriptor={descriptor} />;
    case "centerLayout":
      return <CenterLayoutSurface descriptor={descriptor} />;
    case "define":
      return <DefineSurface descriptor={descriptor} />;
    case "material":
      return <MaterialSurface descriptor={descriptor} />;
    case "gather":
      return <GatherSurface descriptor={descriptor} />;
    case "postTo":
      return <PostToSurface descriptor={descriptor} />;
    case "journey":
      return <JourneySurface descriptor={descriptor} />;
    case "me":
      return <MeSurface descriptor={descriptor} />;
    case "artwork":
      return <ArtworkSurface />;
    case "custom": {
      const render = connectors.custom?.[descriptor.key];
      if (render) return <>{render({ descriptor })}</>;
      return (
        <SurfaceFrame kind="neutral" title={descriptor.title ?? "Not available"}>
          <p className="eac-surface-empty">This app has not supplied “{descriptor.key}”.</p>
        </SurfaceFrame>
      );
    }
  }
}

/** The custom descriptor a shared form reads: `threadId` to edit, `initialAnswers` to start from. */
function sharedDescriptor(
  key: string,
  kind: string | undefined,
  threadId: string | undefined,
  prefill: Record<string, unknown> | undefined
): Extract<SurfaceDescriptor, { type: "custom" }> {
  const props: Record<string, unknown> = {};
  if (threadId) props.threadId = threadId;
  if (prefill && Object.keys(prefill).length) props.initialAnswers = prefill;
  return { type: "custom", key, title: threadId ? "Edit" : "New", kind: asSurfaceKind(kind), props };
}

