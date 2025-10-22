/**
 * Nextcloud Talk API
 * 
 * Video chat and messaging functionality
 * Only import in apps that need Talk features (likely forum and admin)
 */

import { type NextcloudClient, extractOcsData } from './client';

export interface TalkRoom {
  token: string;
  name: string;
  displayName: string;
  type: number; // 1=one-to-one, 2=group, 3=public
  participantType: number;
}

export interface CreateRoomOptions {
  name: string;
  type?: 'group' | 'public' | 'one-to-one';
  invite?: string[]; // User IDs to invite
}

/**
 * Create a Talk room (for video chat/messaging)
 * 
 * Usage in meeting creation:
 * ```typescript
 * import { createTalkRoom } from '@elkdonis/nextcloud/talk';
 * 
 * const room = await createTalkRoom(client, {
 *   name: 'Meditation Session - Oct 17',
 *   type: 'public',
 *   invite: ['user1', 'user2']
 * });
 * 
 * // Store room.token in your database
 * await db`UPDATE meetings SET nextcloud_talk_token = ${room.token} ...`;
 * ```
 */
export async function createTalkRoom(
  client: NextcloudClient,
  options: CreateRoomOptions
): Promise<TalkRoom> {
  const { name, type = 'public', invite = [] } = options;

  // Map type to Nextcloud Talk room type
  const roomType = {
    'one-to-one': 1,
    'group': 2,
    'public': 3,
  }[type];

  // Create room
  const response = await client.ocs.post('/apps/spreed/api/v4/room', {
    roomType,
    roomName: name,
  });

  const room = extractOcsData<TalkRoom>(response);

  // Invite users if specified
  for (const userId of invite) {
    try {
      await addParticipant(client, room.token, userId);
    } catch (error) {
      console.error(`Failed to invite ${userId} to room:`, error);
    }
  }

  return room;
}

/**
 * Get Talk room info
 */
export async function getTalkRoom(
  client: NextcloudClient,
  token: string
): Promise<TalkRoom> {
  const response = await client.ocs.get(`/apps/spreed/api/v4/room/${token}`);
  return extractOcsData<TalkRoom>(response);
}

/**
 * Add participant to Talk room
 */
export async function addParticipant(
  client: NextcloudClient,
  roomToken: string,
  userId: string
): Promise<void> {
  await client.ocs.post(`/apps/spreed/api/v4/room/${roomToken}/participants`, {
    newParticipant: userId,
    source: 'users',
  });
}

/**
 * Send a chat message to a Talk room
 */
export async function sendMessage(
  client: NextcloudClient,
  roomToken: string,
  message: string
): Promise<void> {
  await client.ocs.post(`/apps/spreed/api/v1/chat/${roomToken}`, {
    message,
  });
}

/**
 * Get chat messages from a Talk room
 */
export async function getMessages(
  client: NextcloudClient,
  roomToken: string,
  limit: number = 100
): Promise<any[]> {
  const response = await client.ocs.get(`/apps/spreed/api/v1/chat/${roomToken}`, {
    params: {
      limit,
      lookIntoFuture: 0,
    },
  });

  return extractOcsData<any[]>(response);
}

/**
 * Delete a Talk room
 */
export async function deleteTalkRoom(
  client: NextcloudClient,
  roomToken: string
): Promise<void> {
  await client.ocs.delete(`/apps/spreed/api/v4/room/${roomToken}`);
}

/**
 * Get embed URL for Talk room (for iframe)
 * 
 * Usage:
 * ```tsx
 * <iframe src={getTalkEmbedUrl(meeting.nextcloud_talk_token)} />
 * ```
 */
export function getTalkEmbedUrl(
  roomToken: string,
  baseUrl?: string
): string {
  const url = baseUrl || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || 'http://localhost:8080';
  return `${url}/call/${roomToken}`;
}

/**
 * Start recording a Talk session
 * Note: Requires Talk recording server to be configured
 */
export async function startRecording(
  client: NextcloudClient,
  roomToken: string
): Promise<void> {
  await client.ocs.post(`/apps/spreed/api/v4/room/${roomToken}/recording`, {
    status: 1, // 1 = start recording
  });
}

/**
 * Stop recording a Talk session
 */
export async function stopRecording(
  client: NextcloudClient,
  roomToken: string
): Promise<void> {
  await client.ocs.post(`/apps/spreed/api/v4/room/${roomToken}/recording`, {
    status: 0, // 0 = stop recording
  });
}
