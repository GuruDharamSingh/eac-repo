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
  archiveWorkshopOffering,
  deleteWorkshopOffering,
  isEnrolledInWorkshop,
} from './workshop-offerings';
export type {
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
  NetworkTier,
  OrgQuestionnaire,
  QuestionnaireField,
  FieldType,
  ResultsVisibility,
  QuestionnaireStatus,
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
