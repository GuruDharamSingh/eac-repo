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
import { ForumSurface } from "./surfaces/ForumSurface";
import { ProfileSurface } from "./surfaces/ProfileSurface";
import { CenterLayoutSurface } from "./surfaces/CenterLayoutSurface";
import { DefineSurface } from "./surfaces/DefineSurface";
import { DocumentsSurface } from "./surfaces/DocumentsSurface";

/** Descriptor → surface. The only place that knows every surface's name. */
export function SurfaceRouter({ descriptor }: { descriptor: SurfaceDescriptor }) {
  const { connectors } = useSurface();

  switch (descriptor.type) {
    case "thread":
      return <ThreadSurface descriptor={descriptor} />;
    case "compose":
      return <ComposeSurface descriptor={descriptor} />;
    case "calendar":
      return <CalendarSurface descriptor={descriptor} />;
    case "gallery":
      return <GallerySurface descriptor={descriptor} />;
    case "write":
      return <WriteSurface descriptor={descriptor} />;
    case "board":
      return <BoardSurface />;
    case "boardCard":
      return <BoardCardSurface descriptor={descriptor} />;
    case "forum":
      return <ForumSurface />;
    case "documents":
      return <DocumentsSurface descriptor={descriptor} />;
    case "profile":
      return <ProfileSurface descriptor={descriptor} />;
    case "centerLayout":
      return <CenterLayoutSurface descriptor={descriptor} />;
    case "define":
      return <DefineSurface descriptor={descriptor} />;
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
