/**
 * Nextcloud Integration
 * Main export file for all Nextcloud services
 */

export { nextcloudConfig, getNextcloudUrl, getWebDAVUrl, getTalkUrl } from './config';
export { adminClient, default as NextcloudClient } from './client';
export { webdavService, default as WebDAVService } from './webdav';
export { userService, default as UserService } from './users';
export { talkService, default as TalkService } from './talk';

// Re-export types
export type { NextcloudFile } from './webdav';
export type { NextcloudUser, CreateUserParams } from './users';
export type { TalkRoom, CreateRoomParams, TalkMessage } from './talk';