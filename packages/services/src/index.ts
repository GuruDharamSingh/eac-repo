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