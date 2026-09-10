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
  createCollaborativeDocument,
  getDocumentEmbedUrl,
  getDocumentEditorUrl,
  createTalkRoom,
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

export { listOrgMediaLibrary } from './media-library';
export type { MediaLibraryItem, ListOrgMediaLibraryOptions } from './media-library';

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
  setStandingMeeting,
  pushThreadToCalendar,
  removeThreadFromCalendar,
  syncOrgCalendarEvents,
  syncOrgCalendarShares,
} from './org-calendar';
export type {
  OrgCalendar,
  OrgCalendarEvent,
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
