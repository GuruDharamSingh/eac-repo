// ============================================================================
// @elkdonis/cms-ui/hub — the members-area furniture.
//
// The faces a hub is built from, plus the tile catalogue. Lifted out of
// apps/amrit-canada and apps/innergathering, which held five of these
// components BYTE-IDENTICALLY (771 duplicated lines) and had already begun to
// drift apart in the connector file beside them.
//
// Like the rest of this package these components take data and hand back
// markup — nothing here reaches a database or a route. The shapes they accept
// are declared in ./types and are structural, so a host passes its
// @elkdonis/services objects in unchanged.
// ============================================================================

export { CalendarFace } from "./CalendarFace";
export { GalleryFace } from "./GalleryFace";
export { ComposeFace } from "./ComposeFace";
export { ProfileFace } from "./ProfileFace";
export { DocumentsFace } from "./DocumentsFace";
export { IdeasFace } from "./IdeasFace";
export { PipelineFace } from "./PipelineFace";
export { StandingMeetingFace } from "./StandingMeetingFace";
export { hubCards } from "./cards";
export type { HubCapabilities } from "./cards";
export { createHubConnectors } from "./connectors";
export type { HubConnectorOptions, HubRoutes } from "./connectors";
export type {
  HubCard,
  HubPipelineBoard,
  HubProfileSummary,
  HubStandingMeeting,
} from "./types";
