// The Grand Forum read layer (forum.ts). Every thread is on the forum;
// visibility is per viewer. See GRAND_FORUM_PLAN.md.
export {
  listBoards,
  getBoardBySlug,
  listTopicIndex,
  listTopics,
  getForumThread,
  recordThreadView,
  listReplies,
  listReplyChildren,
  listHappening,
  listLatest,
  getPulse,
  getViewerRoles,
  firstUnreadReply,
  ANONYMOUS as FORUM_ANONYMOUS,
} from './forum';
export {
  REPLIES_PER_PAGE,
  textToHtml,
  htmlToQuote,
  canModerate,
  isOrgMember,
  createCategory,
  postReply,
  pageOfReply,
  createTopic,
  setVote,
  toggleHeart,
  listVoters,
  toggleWatch,
  toggleBookmark,
  markThreadRead,
  markAllRead,
  proposeTopic,
  reviewTopic,
  listTopicChoices,
  moderateThread,
  listNotifications,
  countUnreadNotifications,
  markNotificationsRead,
} from './forum-write';
export { searchForum, listModLog } from './forum-search';
export type { ForumSearchHit, ForumModLogEntry } from './forum-search';
export {
  listPeopleCards,
  getMember,
  listMemberActivity,
  listMembers,
  listPresent,
  listNewMembers,
  touchLastSeen,
  listOrgCards,
  listTopicEntries,
  getTopicBySlug,
  reviewTopicAndNotify,
} from './forum-people';
export type {
  ForumRoleLine,
  ForumPersonCard,
  ForumMember,
  ForumActivityItem,
  MemberSort as ForumMemberSort,
  ForumOrgCard,
  ForumTopicEntry,
} from './forum-people';
export type {
  WriteResult as ForumWriteResult,
  PostReplyInput,
  CreateTopicInput,
  CreateCategoryInput,
  VoteTarget,
  Voters as ForumVoters,
  ModAction as ForumModAction,
  ForumNotification,
} from './forum-write';
export type {
  ForumScope,
  ForumViewer,
  ForumSort,
  Paged,
  ForumPerson,
  ForumFeedRow,
  ForumBoard,
  ForumTopicRow,
  ForumThreadRecord,
  ForumReply,
  ForumHappeningRow,
  ForumLatestRow,
  ForumPulse,
  ForumTopicIndexRow,
  TopicListTarget,
} from './forum';

// Meeting services
export {
  createMeeting,
  getMeetingsByOrg,
  getUpcomingMeetings,
  updateMeeting,
  deleteMeeting,
} from './meetings';

// Post services
export {
  createPost,
  // Defined in posts.ts but never re-exported here, so two ifac modules that
  // import it could not compile. Kind-agnostic sibling of createPost.
  createThread,
  getPostsByOrg,
  getRecentPosts,
  getPostBySlug,
  updatePost,
  deletePost,
} from './posts';

// Wiki pages — threads with kind='wiki_page', plus full-snapshot edit
// history (migration 118). See wiki.ts.
export {
  createWikiPage,
  updateWikiPage,
  getWikiPage,
  listWikiPages,
  getWikiRevisions,
  revertWikiPage,
  archiveWikiPage,
  buildWikiTree,
  collectSubtreeIds,
  getWikiAncestors,
  resolveWikilinks,
  getWikiBacklinks,
  defineTerm,
  lookupTerm,
  resolveTerms,
  getTermDefinitions,
  WikiConflictError,
  listWikiTopics,
  setWikiTopics,
  listWikiPagesByTopic,
  searchWiki,
  wikiTalkThread,
  listDefinedTerms,
} from './wiki';
export type {
  WikiPage,
  WikiPageListItem,
  WikiTreeNode,
  WikiRevision,
  WikiPageRef,
  DefinedTerm,
  WikiDefinition,
  ResolvedTerms,
  WikiTopic,
  WikiSearchHit,
  WikiSearchSpan,
  WikiTalkThread,
  DefinedTermRow,
} from './wiki';

// Auth services
export {
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  getUsersByOrg,
} from './auth';

// Nextcloud services
export {
  createNextcloudUser,
  createOrgFolders,
  createPublicShare,
  listFiles,
  uploadFile,
  getFileUrl,
  getPublicFileUrl,
  getProxyFileUrl,
  getUploadPath,
  uploadFilename,
  createCollaborativeDocument,
  getDocumentEmbedUrl,
  getDocumentEditorUrl,
  createTalkRoom,
  configureTalkRoom,
  sendTalkMessage,
} from './nextcloud';

// Availability polling services
export {
  createAvailabilityPoll,
  getPollById,
  getPollsByOrg,
  submitAvailabilityResponse,
  getPollResponses,
  getPollSummary,
  lockPoll,
  cancelPoll,
  deletePoll,
} from './availability';

// Question poll services
export {
  createQuestionPoll,
  getQuestionPollById,
  getQuestionPollsByOrg,
  voteOnPoll,
  unvoteOnPoll,
  getUserVotes,
  deleteQuestionPoll,
  closeQuestionPoll,
} from './question-polls';
export type { QuestionPoll, PollOption, CreateQuestionPollData } from './question-polls';

// Nextcloud sync services
export {
  storeNextcloudEvent,
  processNextcloudEvent,
  processUnprocessedEvents,
  getEventStats,
} from './nextcloud-sync';
export type { NextcloudEvent } from './nextcloud-sync';

// Calendar sync services
export {
  syncMeetingToNextcloud,
  deleteMeetingFromCalendar,
  syncCalendarEventToMeeting,
  handleCalendarWebhook,
  syncAllMeetingsForOrg,
  getMeetingSyncStatus,
} from './calendar-sync';
export type { MeetingForSync } from './calendar-sync';

// Nextcloud user provisioning
export { handleUserProvisioning } from './nextcloud-provisioning';
export type { ProvisioningResult, ProvisioningOptions } from './nextcloud-provisioning';

// Thread-agnostic RSVP — same primitives regardless of thread kind
// (meeting, event, workshop, and future kinds like auction listings/products)
export {
  checkRsvpEligibility,
  countConfirmedRsvps,
  getRsvpStatus,
  setRsvpStatus,
  deleteRsvp,
} from './thread-rsvp';
export type { RsvpStatus, RsvpEligibility } from './thread-rsvp';

// The standing meeting's card: a nuanced RSVP on top of the same four
// statuses, the green/yellow/red light, and what last week's occurrence
// produced. Kind-agnostic for the reason thread-rsvp.ts gives.
export {
  RSVP_FLAVOURS,
  rsvpFlavour,
  getMeetingAttendance,
  setMeetingAttendance,
  clearMeetingAttendance,
  resolveMeetingLight,
  setMeetingLight,
  clearMeetingLight,
  occurrenceKey,
  getPreviousMeetingOccurrence,
  listMeetingMaterials,
} from './standing-meeting';
export type {
  RsvpFlavour,
  RsvpFlavourStatus,
  MeetingAttendance,
  MeetingLight,
  MeetingLightState,
  MeetingMaterial,
  MeetingMaterialKind,
  PastMeetingOccurrence,
} from './standing-meeting';

// Workshop offerings — org-agnostic workshop CRUD (threads + workshop_pages
// + workshop_sessions). Sibling of service-offerings; every app shares this
// layer and differs only in its form UI.
export {
  listWorkshopOfferings,
  listAllWorkshopOfferingsForOrg,
  getWorkshopOffering,
  getWorkshopOfferingById,
  upsertWorkshopOffering,
  replaceWorkshopSessions,
  archiveWorkshopOffering,
  deleteWorkshopOffering,
  isEnrolledInWorkshop,
  workshopMaterialsFolder,
  listWorkshopMaterials,
  ensureWorkshopMaterialsFolder,
  uploadWorkshopMaterial,
  deleteWorkshopMaterial,
} from './workshop-offerings';
export type {
  WorkshopMaterial,
  WorkshopOffering,
  WorkshopOfferingInput,
  WorkshopSession,
  WorkshopSessionInput,
  WorkshopSessionResource,
  WorkshopFormat,
} from './workshop-offerings';

// Org-scoped membership, roles, and followers — deliberately excludes the
// global superadmin flag (users.is_admin), which stays admin-app-only.
export {
  getOrgRole,
  hasOrgRole,
  hasAnyOrgRole,
  listOrgMembers,
  listUserMemberships,
  getOwnedOrgId,
  setOrgRole,
  removeOrgMember,
  isFollowingOrg,
  followOrg,
  unfollowOrg,
  listOrgFollowers,
  getOrgFollowerCount,
} from './org-membership';
export type { OrgRole, OrgMembership, OrgMember, OrgFollower } from './org-membership';

// Authorization for /api/media/* reads. The single Nextcloud service account
// means storage-layer ACLs cannot enforce per-user rules on app traffic —
// this is where that enforcement lives. See media-authz.ts.
export {
  canReadMedia,
  canAccessWorkshopMaterials,
  parseMediaPath,
} from './media-authz';
export type { MediaTarget } from './media-authz';

// Per-person cloud storage (EAC_Network/users/<slug>/), surfaced through the
// platform rather than through Nextcloud. Every principal has a folder from
// the moment they exist; only a minority ever get a Nextcloud login.
export {
  listUserFiles,
  uploadUserFile,
  deleteUserFile,
  createUserFolder,
  getUserStorageUsage,
  getStorageSlug,
  userStorageRoot,
  resolveUserPath,
  USER_MEDIA_FOLDERS,
} from './user-storage';
export type { UserFile, UserMediaFolder, UploadResult } from './user-storage';

// Where an org lives — its verified primary custom domain from org_domains,
// or null when it sits at its network subdomain. Data only; URL assembly is
// the app's job (arts-collective lib/org-url.ts).
export {
  getPrimaryDomain,
  listOrgHomes,
  getOrgHomeBySlug,
  getOrgIdentity,
  canEditOrgIdentity,
} from './org-domains';
export type { OrgHome, OrgIdentity } from './org-domains';

// Per-org content feeds — the named sections of an org site. Presentation
// only; feeds never grant access (see the header note in org-feeds.ts).
export {
  listOrgFeeds,
  getOrgFeed,
  upsertOrgFeed,
  deleteOrgFeed,
  canViewFeed,
} from './org-feeds';
export type { OrgFeed, OrgFeedInput } from './org-feeds';

// Service offerings — sellable threads (kind='service'), org-agnostic so any
// app can list, publish, and edit them. Pairs with createServiceOrder in
// @elkdonis/commerce for the booking/checkout side.
export {
  listServiceOfferings,
  getServiceOffering,
  getServiceOfferingById,
  listAllServiceOfferingsForOrg,
  upsertServiceOffering,
  deleteServiceOffering,
} from './service-offerings';
export type {
  ServiceOffering,
  ServiceOfferingInput,
  BookingType,
  ServiceFormat,
  RegistrationStatus,
} from './service-offerings';

export { ensureUniqueThreadSlug } from './thread-slug';

// Profiles — one person (users), published on any number of orgs
// (org_profiles). See profiles.ts header for the full model and the
// authorship split it enforces (identity vs. org-scoped publishing).
export {
  getProfile,
  getProfileBySlug,
  listOrgProfiles,
  getOrgProfileBySlug,
  listProfileOrgs,
  listOrgProfilesByEntityType,
  unpublishOrgProfile,
  canEditProfile,
  canPublishOrgProfile,
  ensureUniqueUserSlug,
  updateProfile,
  upsertOrgProfile,
  createUnclaimedProfile,
  requestClaim,
  approveClaim,
  adminAssignProfile,
  mergeProfile,
  listPublicProfiles,
  listProfileGeoFacets,
  hasVouched,
  vouchForProfile,
  setProfileVerified,
  getAuthoredThreads,
  getAuthoredMedia,
} from './profiles';
export type { ProfileOrgMembership } from './profiles';

// Identities — one account, several names. A pen name and an organisation's
// own byline are the same mechanism with different targets; see
// identities.ts for why the link back to the owner lives in its own table.
export {
  MAX_PSEUDONYMS,
  getIdentityIds,
  listActingIdentities,
  resolveActor,
  createPseudonym,
  retirePseudonym,
  restorePseudonym,
  accountForIdentity,
} from './identities';
export type {
  ActingIdentity,
  IdentityRelation,
  CreatePseudonymInput,
} from './identities';
export type {
  Profile,
  OrgProfile,
  ProfileListItem,
  SocialLink,
  PortfolioItem,
  ClaimStatus,
  EntityType,
  UpdateProfileInput,
  UpsertOrgProfileInput,
  CreateUnclaimedProfileInput,
  CreateProfileResult,
  AuthoredThread,
  AuthoredMedia,
} from './profiles';

// Questionnaires — wizard/workbook answers and the Elkdonis review queue.
export {
  listQuestionnaires,
  listResponsesForUser,
  getOpenResponse,
  saveResponseAnswers,
  submitResponse,
  listPendingReviews,
  reviewResponse,
} from './questionnaires';
export {
  canManageQuestionnaires,
  listOrgQuestionnaires,
  getQuestionnaire,
  createOrgQuestionnaire,
  setQuestionnaireStatus,
  getQuestionnaireResults,
} from './questionnaires';
export type {
  Questionnaire,
  QuestionnaireResponse,
  PendingReview,
  QuestionnaireScope,
  ResponseStatus,
  OrgQuestionnaire,
  QuestionnaireField,
  FieldType,
  ResultsVisibility,
  QuestionnaireStatus,
  QuestionnaireKind,
  FieldResult,
  QuestionnaireResults,
  ResultsOutcome,
  CreateOrgQuestionnaireInput,
} from './questionnaires';

// Themes — CSS custom property overrides per site, page and person.
export {
  resolveTheme,
  getThemeOverrides,
  saveSiteTheme,
  saveUserTheme,
  renderThemeCss,
  sanitizeThemeVars,
  SITE_DEFAULT_PAGE,
} from './themes';
export type { ThemeVars } from './themes';

// Org agreements — the terms a member accepted, and the only thing that
// authorises an org to take a cut of their sale (migration 096).
export {
  draftAgreement,
  updateDraftAgreement,
  publishAgreement,
  retireAgreement,
  getAgreement,
  listOrgAgreements,
  listAgreementsForMember,
  listAcceptances,
  acceptAgreement,
  revokeAcceptance,
  resolveOrgShare,
} from './agreements';
export type {
  OrgAgreement,
  AgreementStatus,
  AgreementAcceptance,
  AgreementForMember,
  DraftAgreementInput,
  ResolvedShare,
} from './agreements';

// Per-org Nextcloud Deck board (migration 101). Board ids are resolved from
// the org, never accepted from a caller — see the header in org-deck.ts.
export {
  getOrgDeckBoardId,
  ensureOrgDeckBoard,
  syncOrgDeckMembers,
  getOrgDeckBoard,
  createOrgCard,
  moveOrgCard,
  updateOrgCard,
  deleteOrgCard,
  setOrgCardLabel,
  createOrgStack,
  renameOrgStack,
  deleteOrgStack,
  setOrgCardDone,
  setOrgCardArchived,
  listOrgArchivedCards,
  listOrgDeckAssignees,
  getDeckIdentity,
  setOrgCardAssignee,
  listOrgCardComments,
  createOrgCardComment,
  deleteOrgCardComment,
  listOrgCardAttachments,
  addOrgCardAttachment,
  readOrgCardAttachment,
  removeOrgCardAttachment,
  listOrgCardActivity,
  OrgDeckScopeError,
} from './org-deck';
export type { OrgDeckBoard, OrgDeckComment } from './org-deck';

export { listOrgMediaLibrary, listUserMediaLibrary, browseMediaFolder, cleanBrowsePath } from './media-library';
export type {
  BrowseItem,
  BrowseResult,
  MediaLibraryItem,
  ListOrgMediaLibraryOptions,
  ListUserMediaLibraryOptions,
} from './media-library';

// Per-org Nextcloud calendar. Same isolation doctrine as org-deck, opposite
// data direction: Postgres owns the events, the calendar is a read-only
// projection members subscribe to. See the header in org-calendar.ts.
export {
  OrgCalendarScopeError,
  SCHEDULED_KINDS,
  ensureOrgCalendar,
  getCalendarSubscriptionUrl,
  getOrgCalendar,
  getOrgCalendarUri,
  getStandingMeeting,
  getStandingMeetingId,
  listOrgEventsInRange,
  readOrgCalendarWindow,
  CALENDAR_MAX_SPAN_DAYS,
  setStandingMeeting,
  pushThreadToCalendar,
  removeThreadFromCalendar,
  syncOrgCalendarEvents,
  syncOrgCalendarShares,
} from './org-calendar';
export type {
  OrgCalendar,
  OrgCalendarEvent,
  OrgCalendarWindow,
  StandingMeeting,
  StandingMeetingSource,
} from './org-calendar';

// An org's shared cloud storage. The org-scoped twin of user-storage; both now
// sit on the one WebDAV implementation in dav.ts rather than the five that had
// accumulated. NOT an authorization boundary — see the header in org-storage.ts.
export {
  ORG_MEDIA_FOLDERS,
  createOrgFolder,
  deleteOrgFile,
  folderForMime,
  listOrgFiles,
  orgStorageRoot,
  resolveOrgPath,
  uploadOrgFile,
} from './org-storage';
export type { OrgFile, OrgMediaFolder, OrgUploadResult } from './org-storage';
export { davListDeep } from './dav';
export type { DavEntry } from './dav';

// One implementation of "serve a media file from Nextcloud": prefix check,
// canReadMedia, range passthrough, correct Cache-Control for private bytes,
// nosniff, and inline-vs-attachment. Replaces createMediaGetHandler in
// @elkdonis/blog-server, whose only adopters were the three throwaway blog
// drafts. See media-serve.ts.
export { serveMedia } from './media-serve';
export type { ServeMediaOptions } from './media-serve';
export { THUMBNAIL_WIDTHS, parseThumbnailWidth } from './media-thumbnail';

// Blog documents that live in both places: a thread's markdown body and a
// file in the author's own EAC_Network/users/<slug>/Documents/, kept in step.
// This is what threads.nextcloud_last_sync has been waiting for since the
// schema was written. See thread-document.ts.
export {
  attachThreadDocument,
  getThreadDocument,
  syncThreadDocument,
} from './thread-document';
export type { ThreadDocument, SyncDirection } from './thread-document';

// Per-org Nextcloud Talk room — the hub's General Chat (migration 102).
// Room tokens are resolved from the org, never accepted from a caller.
export {
  getOrgChatRoom,
  ensureOrgChatRoom,
  listOrgChatMessages,
  postOrgChatMessage,
  getOrgChatNextcloudUrl,
  getOrgChatIdentity,
  setOrgChatDisplayName,
  OrgChatScopeError,
} from './org-chat';
export type { OrgChatRoom, OrgChatMessage, OrgChatIdentity } from './org-chat';

// Publishing a thread as a static artifact in Nextcloud — the model Silex
// already uses on this platform, applied to a post. `published_at` says
// someone decided; this produces the thing. See thread-publish.ts.
export {
  publishThreadStatic,
  getPublishedArtifact,
  readPublishedArtifact,
  listStaleArtifacts,
  artifactPath,
} from './thread-publish';
export type { PublishedArtifact } from './thread-publish';

// /center — the follower's home on an org's site. One read, every section
// fail-soft. See center.ts and CENTER_PAGE_BRIEF_2026-09-09.md.
export { loadCenter } from './center';
export type {
  CenterData,
  CenterThread,
  CenterPerson,
  CenterOrg,
  CenterOrgLink,
  CenterPromo,
  CenterPromoKind,
  CenterPromoConfig,
  LoadCenterOptions,
} from './center';
// The profile popup's Details tab — explicit columns, never USER_COLS.
export { getProfileDetails, saveProfileDetails } from './center';
// Post from /center to any org you belong to, or your blog (slice 3).
export { listPostTargets, createPostAnywhere } from './center';
// The hub's page layout reads the org's own feed on its own.
export { listOrgActivity, listNetworkActivity } from './center';
export type { PostTarget, PostAnywhereInput, PostAnywhereResult } from './center';
export type { ProfileDetails, ProfileDetailsInput, SaveProfileDetailsResult } from './center';

// The rotating line on a center. The smallest content on the network: no
// thread, no slug, no page of its own. See quotes.ts and migration 127.
export {
  listCenterQuotes,
  listQuotes,
  submitQuote,
  setQuoteStatus,
  deleteQuote,
  QUOTE_MAX_BODY,
} from './quotes';
export type { Quote, QuoteStatus, SubmitQuoteInput } from './quotes';

// The center's definition as data: network default ← org override, resolved
// server-side like themes. See center-layout.ts.
export {
  resolveCenterLayout,
  saveCenterLayout,
  DEFAULT_CENTER_LAYOUT,
  CENTER_SECTION_IDS,
} from './center-layout';
export type { CenterLayout, CenterSectionId, ResolvedCenterLayout } from './center-layout';

// One shared Excalidraw scene per org, stored whole. See whiteboard.ts.
export { getWhiteboard, saveWhiteboard } from './whiteboard';
export type { WhiteboardScene } from './whiteboard';

// A person's gallery pages — many per user, org-agnostic, the same item
// shape as users.portfolio (migration 124). See galleries.ts.
export {
  listUserGalleries,
  countUserGalleries,
  getUserGallery,
  getUserGalleryByPage,
  getUserGalleryById,
  createUserGallery,
  updateUserGallery,
  updateOwnGalleryItems,
  deleteUserGallery,
  reorderUserGalleries,
  asGalleryItems,
} from './galleries';
export type {
  UserGallery,
  UserGallerySummary,
  CreateUserGalleryInput,
  UpdateUserGalleryInput,
} from './galleries';

// The group's living documents and its suggested ideas — both lifted out of
// apps/ifac, which was the only host where either was real.
export {
  listOrgDocuments,
  createOrgDocument,
  deleteOrgDocument,
  assignOrgDocument,
} from './org-documents';
export type { OrgDocument } from './org-documents';
export {
  listOrgIdeas,
  createOrgIdea,
  ensureIdeasFeed,
  IDEAS_FEED,
} from './org-ideas';
export type { OrgIdea } from './org-ideas';

// What a thread HOLDS — the occasion made out of a meeting, the document
// written in it, the terms defined out of that and the board it moved. One
// edge table (migration 131) in place of the five half-overlapping grouping
// mechanisms the network had grown. See gather.ts, and note that
// `getGathered` withholds living-document URLs unless the caller asserts
// membership: those links are public and WRITABLE.
export {
  getGathered,
  getGathering,
  getGatheredBy,
  getReferencedTerms,
  gatherOnto,
  ungather,
  reorderGathered,
  gatherViewerFor,
  gatheringFolder,
  ensureGatheringFolder,
  GatherError,
  GATHER_ANONYMOUS,
} from './gather';
// The constellation — every connection one thread has, as a graph, plus a
// person's own drawn lines (migration 137). See constellation.ts.
export {
  getConstellation,
  getPersonMap,
  drawLine,
  eraseLine,
  LineError,
} from './constellation';
export type { Constellation, MapNode, MapEdge, MapEdgeKind } from './constellation';

// Remove a thread as its author or a moderator; feature a meeting as the
// standing one; and the host route for both. See thread-admin.ts.
export { removeThread, removeThreadAs, featureMeeting, createThreadAdminRoutes } from './thread-admin';
export type { RemoveResult, FeatureResult, ThreadAdminRouteHandlers } from './thread-admin';

// Drawings — a post whose body is a picture: Excalidraw scene + exported SVG
// in metadata.drawing, the SVG served as an image so every host shows it.
export { getDrawing, createDrawing, updateDrawing, canEditDrawing, DrawingError } from './drawing';
export type { Drawing, DrawingScene } from './drawing';
// The same four verbs on every host. See the header in gather-route.ts for why
// this is a factory and not a third copy of the route.
export { createGatherRoutes } from './gather-route';
export type {
  GatherRouteOptions,
  GatherRouteViewer,
  GatherRouteHandler,
  GatherRouteHandlers,
  GatherCandidate,
} from './gather-route';
export type {
  Gathering,
  GatheredItem,
  GatheredBy,
  GatheredOptions,
  GatherInput,
  GatherRelation,
  GatherTargetType,
  GatherViewer,
  ReferencedTerm,
} from './gather';

// What is waiting for a person — the counts the profile face states.
export { getViewerAlerts } from './viewer-alerts';
export type { ViewerAlerts } from './viewer-alerts';

// Which kinds an org surface may harvest. Read thread-kinds.ts before adding
// a `kind` — a new one is enrolled in every feed and the forum by default.
export { OFF_FEED_KINDS, WRITING_KIND } from './thread-kinds';

// A person's own writing — the blog behind a profile page. Threads, so it
// shares the editor and the reading layer; off every org feed, so it stays
// theirs. See writing.ts.
export {
  listWriting,
  listOrgWriting,
  countWriting,
  getWritingPost,
  getWritingPostById,
  createWritingPost,
  updateWritingPost,
  deleteWritingPost,
} from './writing';
export type {
  WritingPost,
  WritingSummary,
  OrgWritingSummary,
  WritingStatus,
  ListWritingOptions,
  CreateWritingInput,
  UpdateWritingInput,
  WritingResult,
} from './writing';

// The rota on a recurring gathering: who is running which occurrence, what
// happened at one, and who is due a host reminder. See migration 136.
export {
  HOST_ROLE,
  CO_HOST_ROLE,
  occurrencesOf,
  getMeetingRota,
  setOccurrencePlan,
  assignMeetingRole,
  clearMeetingRole,
  isOccurrenceHost,
  getRoleHolder,
  listRotaCandidates,
  getOccurrenceRecord,
  saveOccurrenceRecord,
  suggestAttendanceFromTalk,
  listHostRemindersDue,
  claimHostReminder,
} from './meeting-rota';
export type {
  RotaAssignment,
  RotaOccurrence,
  AttendanceEntry,
  AttendanceSource,
  OccurrenceRecord,
  HostDuty,
} from './meeting-rota';

// Feed write gate + stewardship (migration 138).
export { canPostToFeed } from './org-feeds';

// Nextcloud access as an org owner sees it: network-admin grant (org_grants)
// + owner role, member link status, and a queued sync the host runs.
// See org-nextcloud-access.ts.
export {
  hasOrgGrant,
  listOrgGrants,
  setOrgGrant,
  canManageNextcloudAccess,
  getNextcloudAccessOverview,
  listNextcloudSyncRequests,
  requestNextcloudSync,
  createNextcloudAccessRoutes,
  getViewerCloud,
} from './org-nextcloud-access';
export type {
  OrgCapability,
  NextcloudSyncStatus,
  NextcloudSyncRequest,
  NextcloudAccessMember,
  NextcloudAccessOverview,
  NextcloudAccessRouteHandlers,
  ViewerCloud,
} from './org-nextcloud-access';

// The Nextcloud Forum app mirrored per org (migration 144): one category per
// org scoped to its Team; opted-in topics + their replies sync both ways.
// See nc-forum.ts.
export {
  NC_FORUM_SENTINEL_ID,
  ncForumConfigured,
  ncThreadUrl,
  htmlToBbcode,
  ncHtmlToSite,
  getOrgNcForum,
  ensureOrgNcCategory,
  pushTopicToNextcloud,
  pushReplyToNextcloud,
  pushModerationToNextcloud,
  threadNcState,
  syncOrgNcForum,
  syncOrgNcForumIfStale,
  runNcForumSyncTick,
} from './nc-forum';
export type { OrgNcForum, NcSyncReport, ThreadNcState, NcModeration } from './nc-forum';
export { listNcCategories, moveNcThreadsToOrg } from './nc-forum';

// Where you show — a person's own switches for where they appear (Brief A
// slice 2). Self only; see presence.ts for the column behind each cell.
export { loadPresence, setPresence, listListingRequests, decideListingRequest } from './presence';
export type {
  Presence,
  PresenceColumn,
  PresenceCell,
  PresenceRow,
  PresenceRowKey,
  PresenceChange,
  SetPresenceResult,
  ListingRequest,
} from './presence';

// Video pipelines (migration 147): a Nextcloud drop folder in, an edited video
// out. The ffmpeg half is `@elkdonis/services/video-render`, worker only.
export {
  PIPELINE_FOLDERS,
  DEFAULT_PIPELINE_SETTINGS,
  normalizeSettings as normalizeVideoPipelineSettings,
  pipelinePath as videoPipelinePath,
  listVideoPipelines,
  listEnabledVideoPipelines,
  getVideoPipeline,
  createVideoPipeline,
  updateVideoPipeline,
  provisionPipelineFolders,
  listPipelineAssets,
  listVideoJobs,
  getVideoJob,
  scanVideoPipeline,
  claimNextVideoJob,
  requeueStaleVideoJobs,
  updateVideoJobReview,
  requeueVideoJob,
  approveVideoJob,
} from './video-pipeline';
export type {
  PipelineSettings as VideoPipelineSettings,
  VideoPipeline,
  VideoPipelineSummary,
  PipelineAsset as VideoPipelineAsset,
  VideoJob,
  VideoJobStatus,
  VideoProbe,
  VideoAutoEdit,
  VideoEditOverride,
  DropSightings,
} from './video-pipeline';

// Moderation: owners and guides review what members submit, and an org
// chooses whether members' work waits at all (default: it does not).
// See moderation.ts.
export {
  canModerateOrg,
  orgRequiresReview,
  setOrgReview,
  statusForNewThread,
  listPendingThreads,
  listReviewedThreads,
  countPendingThreads,
  reviewThread,
} from './moderation';
export type { ReviewDecision, PendingThread, ReviewedThread } from './moderation';

// Moderation for a person's designed page hosted inside an org's layout
// (store panels, to start). Two gates, not one — see user-pages.ts.
export {
  orgHostsStorePanels,
  setOrgStorePanels,
  submitUserPage,
  listPendingUserPages,
  countPendingUserPages,
  reviewUserPage,
} from './user-pages';
export type { UserPageDecision, PendingUserPage } from './user-pages';

// The showcase: an org's published work as one public digest, with the card
// size its guides chose. See showcase.ts.
export { getShowcase, listShowcaseSections, getShowcaseCardSize, setShowcaseCardSize } from './showcase';
export type { ShowcaseItem, ShowcasePage, ShowcaseSection, ShowcaseCardSize } from './showcase';

// The org calendar, two-way with Nextcloud: imports (and adopts) events made
// there, removes what the hub archived, and takes edits from whichever side
// changed last. See org-calendar-sync.ts.
export {
  reconcileOrgCalendar,
  syncOrgCalendarIfStale,
  runOrgCalendarSyncTick,
  syncEditorWriteAccess,
} from './org-calendar-sync';
export type { CalendarSyncReport } from './org-calendar-sync';
