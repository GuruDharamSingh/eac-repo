// CONTRACT: shared types for places, tour assets, fly-over requests, experiences, commissions and suggestions (Platform Engineer, Phase A; spec ELKTOURS_EXPERIENCES_SPEC_2026-11-02).
/**
 * Type-only module: safe to import from client components. Re-exported by
 * lib/types.ts. Dates cross the server/client boundary as ISO strings.
 *
 * Where things live:
 *   places        lib/places.ts (reads)          lib/place-actions.ts (server actions)
 *   assets        lib/assets.ts (reads/writes)   lib/asset-actions.ts
 *   fly-overs     lib/render-requests.ts         lib/render-request-actions.ts
 *   experiences   lib/experiences.ts             lib/experience-actions.ts
 *   commissions   lib/commissions.ts (stub: no money path)
 *   suggestions   lib/suggest.ts                 (action: suggestPlacesAction in place-actions.ts)
 */

/** Every server action in these modules returns this shape. */
export type Result<T = object> = ({ ok: true; error?: undefined } & T) | { ok: false; error: string };

// ── places (migration 235) ───────────────────────────────────────────────

export type PlaceSource = "stop_backfill" | "manual" | "photon" | "overpass";

/** A catalogue place. Editor-only: `privateNotes` must never reach a public page. */
export interface Place {
  id: string;
  orgId: string;
  slug: string;
  title: string;
  /** Sanitised HTML, public copy. */
  body: string | null;
  /** One short public line for cards (plain text, <= 200 chars). */
  excerpt: string | null;
  /** Shown by the public places read (listPublicPlaces/getPublicPlace). Default true. */
  isPublic: boolean;
  /** Operating business/venue (shop, café, museum, church ...) vs landmark; null = not classified (migration 241, scripts/classify-places.mts). */
  operating?: boolean | null;
  /** e.g. bakery | butcher | cafe | cabaret | museum | church | street | square | monument. */
  operatingKind?: string | null;
  /** Network business listings at this place (place_businesses, migration 242), primary first. */
  businesses?: PlaceBusinessSummary[];
  /** Company knowledge, never rendered publicly. */
  privateNotes: string | null;
  lat: number | null;
  lng: number | null;
  /** Default Street View pose. */
  heading: number | null;
  pitch: number | null;
  fov: number | null;
  address: string | null;
  tags: string[];
  source: PlaceSource;
  /** e.g. 'osm:node/123' for photon/overpass places. */
  sourceRef: string | null;
  /** Best image for cards: the place's first visible image asset, else the still of its latest linked stop. */
  imageUrl: string | null;
  /** Confident outbound links (Wikipedia, website, Wikidata, OSM); filled by listPlaces/getPlace. */
  links?: PlaceLink[];
  /** The follower credited when this place came from an accepted visitor suggestion. */
  suggestedBy?: { userId: string; name: string | null } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The place_stats view, computed on read. */
export interface PlaceStats {
  placeId: string;
  toursCount: number;
  publishedToursCount: number;
  /** "Times visited": past, non-cancelled departures of tours using the place. */
  runsCount: number;
  /** Confirmed party sizes summed over those runs. */
  guestsCount: number;
  lastVisitedAt: string | null;
  experiencesCount: number;
}

export interface PlaceWithStats extends Place {
  stats: PlaceStats;
}

/** A tour stop that links to the place. */
export interface PlaceUsage {
  stopId: string;
  threadId: string;
  tourTitle: string;
  tourSlug: string;
  tourStatus: string;
  position: number;
}

export interface PlaceListFilter {
  /** Matches title, address and tags. */
  q?: string;
  tag?: string;
  /** true = linked to at least one stop; false = unused. */
  used?: boolean;
  includeArchived?: boolean;
  /** Within `radiusM` (default 600) of this point, nearest first. */
  near?: { lat: number; lng: number; radiusM?: number };
  limit?: number;
}

export interface PlaceInput {
  /** Omit to create. */
  id?: string;
  title: string;
  body?: string | null;
  /** Short public line; plain text, <= 200 chars. */
  excerpt?: string | null;
  /** Default true for new places. */
  isPublic?: boolean;
  privateNotes?: string | null;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  pitch?: number | null;
  fov?: number | null;
  address?: string | null;
  tags?: string[];
  source?: PlaceSource;
  sourceRef?: string | null;
}

/**
 * A stop draft for the tour builder: what picking a place or an experience
 * puts into the stop list (copy on pick). Same field names as commerce's
 * TourStopInput, so it goes straight into saveStopsAction.
 */
export interface StopDraft {
  id?: string | null;
  title: string;
  body: string | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  pitch: number | null;
  fov: number | null;
  imageUrl: string | null;
  durationMinutes: number | null;
  placeId: string | null;
  experienceId: string | null;
}

// ── suggestions ──────────────────────────────────────────────────────────

export type SuggestionSource = "catalogue" | "photon" | "overpass";

export interface PlaceSuggestion {
  /** Stable key for React lists: 'place:<id>' | 'osm:node/123' | 'photon:...'. */
  key: string;
  source: SuggestionSource;
  title: string;
  lat: number;
  lng: number;
  address: string | null;
  /** e.g. 'museum', 'place_of_worship', 'historic'. */
  category: string | null;
  /** Set when source = 'catalogue'. */
  placeId: string | null;
  /** 'osm:node/123' for OSM sources. */
  sourceRef: string | null;
  /** Metres from `near`, when given. */
  distanceM: number | null;
}

export interface SuggestQuery {
  q?: string;
  near?: { lat: number; lng: number };
}

export interface SuggestResult {
  /** Ordered: catalogue, then Photon, then Overpass; de-duplicated. */
  items: PlaceSuggestion[];
  /** "© OpenStreetMap contributors" whenever an OSM item is in the list; render it under the list. */
  attribution: string | null;
  attributionUrl: string | null;
}

// ── assets (migrations 233 + 235) ────────────────────────────────────────

export type AssetKind = "film" | "poster" | "image" | "still" | "map3d" | "streetview" | "document";
export type AssetStorage = "nextcloud" | "external";

export interface TourAsset {
  id: string;
  orgId: string;
  /** Tour or experience thread; null for a catalogue (place) asset. */
  threadId: string | null;
  /** Null = the whole tour. */
  stopId: string | null;
  placeId: string | null;
  kind: AssetKind;
  /** 'hero' | 'gallery' | 'card' | 'background' ... */
  role: string | null;
  /** '1080' | '720' | 'poster' ... */
  variant: string | null;
  storage: AssetStorage;
  storageKey: string | null;
  /** Null only for the live switches (map3d, streetview). */
  url: string | null;
  mimeType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  seconds: number | null;
  sha256: string | null;
  /** 'elktour-unity' | 'upload' | 'streetview-static' | 'import' | 'live' | 'place' */
  source: string;
  attribution: string | null;
  licenceNote: string | null;
  /** The per-asset on/off switch. Public reads need visible && !archivedAt. */
  visible: boolean;
  /** True while the file sits under Private/; making it visible copies it to public Media/. */
  isPrivateFile: boolean;
  position: number;
  caption: string | null;
  altText: string | null;
  meta: Record<string, unknown>;
  renderRequestId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** Which assets to list. Exactly one of threadId / stopId / placeId. */
export type AssetScope =
  | { threadId: string; includeStops?: boolean; includeArchived?: boolean }
  | { stopId: string; includeArchived?: boolean }
  | { placeId: string; includeArchived?: boolean };

export interface AssetInput {
  /** Omit to create. */
  id?: string;
  threadId?: string | null;
  stopId?: string | null;
  placeId?: string | null;
  kind: AssetKind;
  role?: string | null;
  variant?: string | null;
  /** Our own /api/media/EAC_Network/elktours/... URL, or an external https URL. */
  url?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  seconds?: number | null;
  source?: string;
  attribution?: string | null;
  licenceNote?: string | null;
  caption?: string | null;
  altText?: string | null;
  position?: number;
  /** Defaults to false: new assets start hidden. */
  visible?: boolean;
}

/** What the public tour page reads (visible, not archived only). */
export interface PublicTourAssets {
  /** The visible hero film, or null. */
  film: { url: string; url720: string | null; poster: string | null; seconds: number | null; assetId: string; attribution: string | null } | null;
  /** Visible tour poster (falls back to the film's poster). */
  poster: string | null;
  /** The tour's 3D-map switch (no row = on, so nothing changes for tours without one). */
  map3d: boolean;
  /** Per stop: Street View switch. Missing key = on. */
  streetview: Record<string, boolean>;
  /** Per stop: visible still (Street View Static) URL, if switched on. */
  stills: Record<string, string>;
  /** Per stop: visible images. */
  stopImages: Record<string, { url: string; caption: string | null; altText: string | null; attribution: string | null }[]>;
  /** Visible tour gallery images. */
  images: { url: string; caption: string | null; altText: string | null; attribution: string | null }[];
}

// ── fly-over render requests (migration 234) ─────────────────────────────

export type RenderStatus = "requested" | "accepted" | "claimed" | "rendering" | "delivered" | "failed" | "rejected" | "cancelled";
export const OPEN_RENDER_STATUSES: readonly RenderStatus[] = ["requested", "accepted", "claimed", "rendering"];

export interface RenderStyle {
  camera: "mapcam";
  routeLine: "waveform";
  highlights: false;
  timeOfDay?: "day" | "golden" | "dusk";
  aspect?: ("16:9" | "9:16" | "1:1")[];
  /** Stop ids to linger on. */
  emphasizeStopIds?: string[];
  notes?: string;
}

/** What the editor's "Request fly-over" form sends. The server fixes camera/routeLine/highlights and the 30 s cap. */
export interface RenderStyleInput {
  timeOfDay?: RenderStyle["timeOfDay"];
  aspect?: RenderStyle["aspect"];
  emphasizeStopIds?: string[];
  notes?: string;
}

export interface RenderPayloadStop {
  id: string;
  position: number;
  title: string;
  lat: number;
  lng: number;
  placeId: string | null;
  experienceId: string | null;
}

/** Frozen at accept; the worker renders from this, never from live rows. No stills, no Street View. */
export interface RenderPayload {
  schemaVersion: 1;
  tour: { id: string; title: string; slug: string };
  meetingPoint: { lat: number; lng: number; label: string | null } | null;
  route: { legs: [number, number][][]; source: string; fetchedAt: string };
  stops: RenderPayloadStop[];
  style: RenderStyle;
  limits: { maxSeconds: 30 };
}

export interface RenderRequest {
  id: string;
  orgId: string;
  threadId: string;
  tourTitle: string;
  tourSlug: string;
  kind: "flyover";
  status: RenderStatus;
  requestedBy: string | null;
  requestedByName: string | null;
  requesterEmail: string | null;
  note: string | null;
  style: RenderStyle;
  /** Null until accepted. */
  payload: RenderPayload | null;
  payloadSha256: string | null;
  priority: number;
  acceptedBy: string | null;
  acceptedByName: string | null;
  acceptedAt: string | null;
  rejectedReason: string | null;
  workerId: string | null;
  claimedAt: string | null;
  heartbeatAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  maxAttempts: number;
  /** 0..1 */
  progress: number;
  errorCode: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  deliveredAssetIds: string[];
  autoPublish: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RenderRequestFilter {
  threadId?: string;
  status?: RenderStatus | RenderStatus[];
  /** Only requested/accepted/claimed/rendering. */
  openOnly?: boolean;
  limit?: number;
}

// ── experiences (migration 236) ──────────────────────────────────────────

export type ExperienceFormat = "in_person" | "online" | "hybrid";
export type ExperiencePersonRole = "artist" | "host";

export interface ExperiencePerson {
  userId: string;
  role: ExperiencePersonRole;
  position: number;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  /** ArtDirect profile (forumProfileUrl), or null without a slug. */
  profileUrl: string | null;
}

export interface Experience {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published" | "archived" | string;
  visibility: string;
  /** Sanitised HTML. */
  body: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  location: string | null;
  isOnline: boolean;
  durationMinutes: number | null;
  /** Display only (inquiry-only in Phase A). */
  price: number | null;
  currency: string;
  format: ExperienceFormat;
  highlights: string[];
  /** Map position, when in person. */
  lat: number | null;
  lng: number | null;
  serviceThreadId: string | null;
  /** Catalogue place where it happens (metadata.experience.placeId), when set. Editor info; resolve with getPlace. */
  placeId?: string | null;
  /** The artist's public service page on ArtDirect, when serviceThreadId resolves. */
  serviceUrl: string | null;
  /** Puck Data for this experience's page; null = the default layout (site_config puck:experience-detail). */
  page: unknown | null;
  people: ExperiencePerson[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceInput {
  title: string;
  body?: string | null;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  location?: string | null;
  isOnline?: boolean;
  durationMinutes?: number | null;
  price?: number | null;
  currency?: string | null;
  format?: ExperienceFormat;
  highlights?: string[];
  lat?: number | null;
  lng?: number | null;
  serviceThreadId?: string | null;
  /** Catalogue place where it happens; lat/lng default to the place's when not given. */
  placeId?: string | null;
  status?: "draft" | "published";
  /** PUBLIC (default) or ORGANIZATION (members of the org only; never on public pages). */
  visibility?: ExperienceVisibility;
}

export type ExperienceVisibility = "PUBLIC" | "ORGANIZATION";

export interface ExperiencePersonInput {
  userId: string;
  role: ExperiencePersonRole;
}

/** A tour stop that features the experience. */
export interface ExperienceTourUse {
  stopId: string;
  threadId: string;
  tourTitle: string;
  tourSlug: string;
  tourStatus: string;
  position: number;
}

/** For the artist and host pickers: org members, plus the artist's public services. */
export interface PersonOption {
  userId: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface ServiceOption {
  threadId: string;
  title: string;
  slug: string;
  price: number | null;
  currency: string | null;
  url: string | null;
}

/** An inquiry from the public experience page (inquiry-only in Phase A). */
export interface ExperienceInquiryInput {
  experienceId: string;
  name: string;
  email: string;
  message: string;
  partySize?: number | null;
  preferredDate?: string | null;
}

// ── service commissions (migration 236; payment is a STUB) ───────────────

export type CommissionUnit = "per_run" | "per_guest" | "flat";
export type CommissionStatus = "proposed" | "accepted" | "declined" | "cancelled" | "completed";

export interface ServiceCommission {
  id: string;
  serviceThreadId: string;
  serviceTitle: string;
  sellerUserId: string;
  sellerName: string | null;
  buyerOrgId: string;
  requestedBy: string | null;
  experienceThreadId: string | null;
  tourThreadId: string | null;
  departureId: string | null;
  unit: CommissionUnit;
  quantity: number;
  /** Snapshot of the listed price at proposal, minor units. */
  priceCents: number | null;
  currency: string | null;
  termsSnapshot: string | null;
  status: CommissionStatus;
  /** Always 'stub' in Phase A: no money moves. */
  paymentStatus: "stub";
  paymentRef: string | null;
  createdAt: string;
  updatedAt: string;
  respondedAt: string | null;
}

export interface CommissionProposal {
  serviceThreadId: string;
  experienceThreadId?: string | null;
  tourThreadId?: string | null;
  departureId?: string | null;
  unit: CommissionUnit;
  quantity?: number;
  terms?: string | null;
}

// ── custom locations: pin or geotagged photo (lib/custom-place-actions.ts) ──

/** A pin dropped on the map. Title/address are optional: missing ones are filled from Photon reverse geocoding. */
export interface PinPlaceInput {
  lat: number;
  lng: number;
  title?: string | null;
  address?: string | null;
  body?: string | null;
  privateNotes?: string | null;
  tags?: string[];
  heading?: number | null;
  pitch?: number | null;
  fov?: number | null;
}

/** Photon reverse-geocode suggestion. Show `attribution` (OSM) wherever it is displayed. */
export interface ReverseGeocode {
  title: string | null;
  address: string | null;
  category: string | null;
  /** 'osm:node/123' when Photon gives one. */
  sourceRef: string | null;
  attribution: string;
  attributionUrl: string;
}

/** What the photo's EXIF said. Null fields = not in the file. */
export interface PhotoGeo {
  lat: number | null;
  lng: number | null;
  /** GPSImgDirection, degrees 0-360: becomes the place's Street View heading. */
  direction: number | null;
  /** DateTimeOriginal/CreateDate, ISO. */
  takenAt: string | null;
  altitudeM: number | null;
}

export type PhotoPlaceResult =
  | { ok: true; needsPin: false; place: Place; stop: StopDraft; asset: TourAsset; geo: PhotoGeo; reverse: ReverseGeocode | null; error?: undefined }
  /** No GPS in the photo: it is kept (private, unattached). Ask for a pin, then call attachPhotoToPinAction(assetId, pin). */
  | { ok: true; needsPin: true; assetId: string; asset: TourAsset; geo: PhotoGeo; error?: undefined }
  | { ok: false; error: string };

// ── reviews (migration 238; lib/reviews.ts + lib/review-actions.ts) ──────

export type ReviewTargetType = "place" | "tour" | "experience";

export interface ReviewTarget {
  type: ReviewTargetType;
  /** places.id (uuid) or threads.id. */
  id: string;
}

export interface Review {
  id: string;
  target: ReviewTarget;
  /** 1..5, or null for a note without stars. */
  rating: number | null;
  /** Plain text (no HTML). */
  body: string | null;
  status: "visible" | "hidden";
  author: { userId: string; name: string; slug: string | null; avatarUrl: string | null };
  /** True when the current viewer wrote it (they may edit/delete). */
  mine: boolean;
  createdAt: string;
  updatedAt: string;
  /** Editors only (null for everyone else). */
  hiddenReason: string | null;
}

export interface ReviewSummary {
  target: ReviewTarget;
  count: number;
  /** Visible reviews with a rating. */
  ratedCount: number;
  /** Mean of visible ratings, 1 decimal; null when none. */
  average: number | null;
}

export interface ReviewList {
  reviews: Review[];
  summary: ReviewSummary;
  /** What the current viewer may do. */
  viewer: { signedIn: boolean; canReview: boolean; canModerate: boolean; mineId: string | null };
}

export interface ReviewInput {
  target: ReviewTarget;
  rating?: number | null;
  body?: string | null;
}

// ── round 6: stop notes, visitor suggestions, place links (migration 239) ──

/** A private editor note on a stop, "from the event". Never public. */
export interface StopNote {
  id: string;
  stopId: string;
  threadId: string;
  /** The run it came from, when tagged. */
  departureId: string | null;
  departureStartsAt: string | null;
  /** A plain date (YYYY-MM-DD) when tagged by date instead of a departure. */
  runDate: string | null;
  /** Plain text. */
  body: string;
  author: { userId: string | null; name: string | null };
  /** Set once promoted into the stop's public excerpt. */
  promotedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StopNoteInput {
  stopId: string;
  body: string;
  departureId?: string | null;
  runDate?: string | null;
}

/** Outbound link for a place (only confident ones are returned by reads). */
export type PlaceLinkKind = "wikipedia_en" | "wikipedia_fr" | "website" | "wikidata" | "osm";
export interface PlaceLink {
  kind: PlaceLinkKind;
  url: string;
  /** Web-search links (DB source 'web') are reported as 'manual' with sourceRef 'web:...' until the UI labels 'web'. */
  source: "wikidata" | "osm" | "manual";
  sourceRef: string | null;
}

/** One item of a suggested route: a catalogue place, or a spot with a point. */
export type RouteItem =
  | { placeId: string }
  | { lat: number; lng: number; title: string };

export interface RoutePreview {
  /** [lng, lat] pairs per leg, FOSSGIS foot routing (falls back to straight lines). */
  legs: [number, number][][];
  source: "osrm" | "straight";
  km: number;
}

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface VisitorSuggestion {
  id: string;
  kind: "spot" | "route";
  status: SuggestionStatus;
  title: string;
  /** "Why" (spot) or the note (route). */
  note: string | null;
  // spot
  lat: number | null;
  lng: number | null;
  address: string | null;
  photoAssetId: string | null;
  /** Private photo URL: editors and the suggester only. */
  photoUrl: string | null;
  // route
  items: (RouteItem & { resolvedTitle: string; lat: number | null; lng: number | null })[];
  preview: RoutePreview | null;
  suggester: { userId: string; name: string | null; slug: string | null };
  resultPlaceId: string | null;
  resultThreadId: string | null;
  rejectReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface SpotSuggestionInput {
  title: string;
  why?: string | null;
  lat: number;
  lng: number;
  address?: string | null;
}

export interface RouteSuggestionInput {
  title: string;
  note?: string | null;
  items: RouteItem[];
}

/** Per-stop extras the tour read adds (TourFull.stopExtras): the public excerpt and the linked place's links. */
export interface StopExtras {
  excerpt: string | null;
  links: PlaceLink[];
  /** The stop's place's primary business, if any (public facts only). */
  business: PlaceBusinessSummary | null;
}

/** What a public page may show of a place: no private notes, no stats, no provenance. */
export interface PublicPlace {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  /** Sanitised HTML. */
  body: string | null;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  pitch: number | null;
  fov: number | null;
  address: string | null;
  tags: string[];
  imageUrl: string | null;
  links: PlaceLink[];
  /** Published tours that visit it. */
  tours: { title: string; slug: string }[];
}

/** A stored link the editors have not confirmed (low-confidence match from the enrichment script). */
export interface PlaceLinkCandidate extends PlaceLink {
  id: string;
  placeId: string;
  placeTitle: string;
  /** Match evidence: label, sim (0..1), distM, via, conflict. */
  evidence: Record<string, unknown>;
  createdAt: string;
}

/**
 * A business at a place, as elktours shows it (from @elkdonis/services/businesses).
 * Shells must be rendered with `marking` ("Unclaimed · listed by ...") and `attributions`.
 * `website` is null unless confirmed (pending-review websites are never public).
 */
export interface PlaceBusinessSummary {
  userId: string;
  slug: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  website: string | null;
  websiteStatus: "confirmed" | "pending_review" | "none";
  phone: string | null;
  /** OSM opening_hours syntax. */
  openingHours: string | null;
  status: "shell" | "claimed" | "removed";
  marking: string | null;
  steward: { orgId: string; name: string } | null;
  attributions: string[];
  relation: "operates" | "hosts" | "former";
  isPrimary: boolean;
  /** The business page on ArtDirect (directory.arts-collective.com/<slug>), when configured. */
  pageUrl: string | null;
}
