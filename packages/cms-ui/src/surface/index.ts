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

export { useWritingRoom, WritingRoomBody } from "./surfaces/writing-room";
export type { WritingRoom, WritingRoomOptions, WritingView } from "./surfaces/writing-room";

export { SurfacePage } from "./SurfacePage";
export type { SurfacePageProps } from "./SurfacePage";
export { toSurfaceThread } from "./thread-mapper";
export type { ThreadMapperInput, ThreadMapperExtras } from "./thread-mapper";
export { threadViewParts } from "./ThreadView";
export type { ThreadViewParts, ThreadViewOptions } from "./ThreadView";
export { BoardMini } from "./surfaces/BoardSurface";
export { ForumMini, ForumFace } from "./surfaces/ForumSurface";

export { MonthGrid } from "./surfaces/CalendarSurface";
export type { MonthGridProps } from "./surfaces/CalendarSurface";
export { defaultThreadToAnswers } from "./surfaces/ComposeSurface";
export { DefineSurface } from "./surfaces/DefineSurface";
export { DocumentsSurface } from "./surfaces/DocumentsSurface";

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
  SurfaceImage,
  SurfaceMaterial,
  SurfaceDocument,
  SurfaceDocumentConnectors,
  SurfaceIdentity,
  SurfaceIdentityConnectors,
  SurfaceIdea,
  SurfaceIdeaConnectors,
  SurfaceThread,
  SurfaceSession,
  SurfaceGathered,
  SurfaceGatherCandidate,
  SurfaceGatherConnectors,
  SurfaceGatheredBy,
  SurfaceGatherRelation,
  SurfaceTerm,
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
  SurfaceProfilePageConnectors,
  SurfaceProfileTab,
  SurfaceProfileDetails,
  SurfacePresence,
  SurfacePresenceColumn,
  SurfacePresenceCell,
  SurfacePresenceRow,
  SurfacePresenceConnectors,
  SurfacePostTarget,
  SurfacePostToConnectors,
  SurfaceProfileSection,
  SurfaceProfilePayouts,
  SurfaceProfilePayoutLine,
  SurfaceCenterLayout,
  SurfaceCenterLayoutShape,
  SurfaceCenterLayoutConnectors,
  SaveProfileResult,
  SaveThreadResult,
  RsvpResult,
} from "./types";
