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
export { IdentitiesFace } from "./IdentitiesFace";
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
  RsvpFlavourOption,
  StandingMeetingAttendance,
  StandingMeetingHistory,
  StandingMeetingLight,
  StandingMeetingPast,
} from "./types";
export {
  PlanAheadSurface,
  type PlanAheadData,
  type PlanAheadOccurrence,
  type PlanAheadCandidate,
  type PlanAheadPerson,
} from './PlanAheadSurface';
export { KindTilesFace, type KindTile } from "./KindTilesFace";
// The member's way into Nextcloud — links out (Nextcloud can't be framed
// cross-site). Host registers `custom: { cloud: CloudSurface }`.
export { CloudFace, CloudSurface, type HubCloud } from "./CloudFace";

// A meeting series: the weeks of a recurring gathering, each with its own
// host, title, write-up, materials and RSVP topic (migration 201).
export { SeriesFace } from "./SeriesFace";
export type { HubSeries, HubSeriesWeek } from "./SeriesFace";
export { SeriesPlannerSurface } from "./SeriesPlannerSurface";
export type {
  SeriesPlannerData,
  SeriesPlannerWeek,
  SeriesPlannerPerson,
  SeriesPlannerMaterial,
  SeriesPlannerSettings,
  SeriesPlannerPeople,
  SeriesPlannerPersonRow,
  SeriesPlannerEmailStats,
  SeriesPlannerEmailLine,
  SeriesPlannerEmailTracking,
  SeriesPlannerLetterKind,
  SeriesPlannerSessionStats,
} from "./SeriesPlannerSurface";

// The organisation's public Series page: intro, order, featured series (2026-10-18).
export { SeriesPageEditor } from "./SeriesPageEditor";
export type { SeriesPageEditorSeries } from "./SeriesPageEditor";
