// ============================================================================
// @elkdonis/cms-ui/surface — one popup for the whole network.
//
//   import "@elkdonis/cms-ui/surface.css";      (plus gallery.css for the lightbox)
//   import { SurfaceProvider, SurfaceCard } from "@elkdonis/cms-ui/surface";
//
// A host wraps a page in <SurfaceProvider connectors={…}> once, then any
// <SurfaceCard surface={{ type: "thread", id }}> anywhere beneath it opens
// that thread in the shared dialog. See types.ts for the descriptor and
// connector vocabulary, and surface.css for how an org themes it.
// ============================================================================

export { SurfaceProvider } from "./SurfaceProvider";
export type { SurfaceProviderProps } from "./SurfaceProvider";

export { useSurface, useSurfaceOptional, useLayer } from "./context";
export type { SurfaceApi, SurfaceLayer, LayerApi, LayerMeta } from "./context";

export { SurfaceCard, SurfaceCardGrid } from "./SurfaceCard";
export type { SurfaceCardProps } from "./SurfaceCard";

export {
  SurfaceFrame,
  SurfaceSection,
  SurfaceFacts,
  SurfaceSkeleton,
  ActionButton,
} from "./SurfaceShell";
export type { SurfaceFrameProps } from "./SurfaceShell";

export { SurfacePage } from "./SurfacePage";
export type { SurfacePageProps } from "./SurfacePage";
export { threadViewParts } from "./ThreadView";
export type { ThreadViewParts } from "./ThreadView";
export { BoardMini } from "./surfaces/BoardSurface";
export { ForumMini, ForumFace } from "./surfaces/ForumSurface";

export { MonthGrid } from "./surfaces/CalendarSurface";
export type { MonthGridProps } from "./surfaces/CalendarSurface";
export { defaultThreadToAnswers } from "./surfaces/ComposeSurface";
export { DefineSurface } from "./surfaces/DefineSurface";

export { kindMeta, asSurfaceKind } from "./kinds";
export type { KindMeta } from "./kinds";

export { buildIcs, icsDataUrl } from "./ics";
export {
  fmtDateTime,
  fmtDate,
  fmtShortDate,
  fmtTime,
  fmtMonth,
  fmtDuration,
  fmtFormat,
  fmtRecurrence,
  fmtPrice,
  relativeDay,
  toDatetimeLocal,
  toPlainText,
} from "./format";
export type { FormatOptions } from "./format";

export { serializeDescriptor, parseDescriptor, SURFACE_PARAM } from "./url";

export { SCHEDULED_KINDS, PRICED_KINDS } from "./types";
export type {
  SurfaceKind,
  SurfaceSize,
  SurfaceDescriptor,
  ThreadPreview,
  SurfaceEvent,
  SurfaceThread,
  SurfaceSession,
  SurfaceAction,
  SurfaceConnectors,
  SurfaceViewer,
  SurfaceBoard,
  SurfaceBoardStack,
  SurfaceBoardCard,
  SurfaceBoardLabel,
  SurfaceBoardComment,
  SurfaceBoardConnectors,
  SurfaceForum,
  SurfaceForumFeed,
  SurfaceForumThread,
  SurfaceForumConnectors,
  SurfaceProfile,
  SurfaceProfileInput,
  SurfaceProfileLink,
  SurfaceProfileTarget,
  SurfaceProfileConnectors,
  SurfaceCenterLayout,
  SurfaceCenterLayoutShape,
  SurfaceCenterLayoutConnectors,
  SaveProfileResult,
  SaveThreadResult,
  RsvpResult,
} from "./types";
