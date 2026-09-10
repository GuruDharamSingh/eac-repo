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

  // Create room — Talk v4 requires form-encoded, not JSON
  const body = new URLSearchParams();
  body.set('roomType', String(roomType));
  body.set('roomName', name);
  const response = await client.ocs.post('/apps/spreed/api/v4/room', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
  const url = baseUrl || process.env.NEXT_PUBLIC_NEXTCLOUD_URL || '';
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

// ============================================================================
// Chat: reading history, and posting as the member rather than as the robot.
//
// Reads go out over the service account, which is a participant in every room
// we provision, so history needs no per-member credential. Writes do not: a
// chat where every line is attributed to `eac_intergration` is not a chat.
// Talk's guest participants solve this — a public room accepts an anonymous
// join, and that guest can set its own display name — so each member posts
// under their own name, in our UI and in Nextcloud alike.
// ============================================================================

export interface TalkMessage {
  id: number;
  token: string;
  actorType: 'users' | 'guests' | 'bots' | string;
  actorId: string;
  actorDisplayName: string;
  /** Unix seconds. */
  timestamp: number;
  message: string;
  messageType: string;
  systemMessage: string;
  messageParameters?: Record<string, unknown>;
}

export interface TalkGuestSession {
  /** Serialized Cookie header authenticating as this guest. A credential. */
  cookie: string;
  actorId: string;
}

function talkUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/ocs/v2.php/apps/spreed${path}`;
}

const OCS_HEADERS = { 'OCS-APIRequest': 'true', Accept: 'application/json' };

/** Collects Set-Cookie headers into a single Cookie header value. */
function serializeCookies(setCookie: string[] | undefined, existing = ''): string {
  const jar = new Map<string, string>();
  for (const pair of existing.split('; ').filter(Boolean)) {
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  for (const header of setCookie ?? []) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

/**
 * Chat history, read as the service account.
 *
 * `lookIntoFuture: 0` walks backwards from the newest message, which is what a
 * page load wants; Talk returns them newest-first, so the caller reverses.
 * `setReadMarker: 0` keeps our polling from moving the robot's read marker.
 * A 304 means nothing new — Talk's way of saying "no messages", not an error.
 */
export async function getChatMessages(
  client: NextcloudClient,
  roomToken: string,
  options: { limit?: number; lastKnownMessageId?: number } = {}
): Promise<TalkMessage[]> {
  const response = await client.ocs.get(`/apps/spreed/api/v1/chat/${roomToken}`, {
    params: {
      lookIntoFuture: 0,
      limit: options.limit ?? 50,
      setReadMarker: 0,
      ...(options.lastKnownMessageId ? { lastKnownMessageId: options.lastKnownMessageId } : {}),
    },
    validateStatus: (status) => status === 200 || status === 304,
  });
  if (response.status === 304) return [];
  return (response.data?.ocs?.data ?? []) as TalkMessage[];
}

/** Rename a room — used to label an org's room as its General Chat. */
export async function renameTalkRoom(
  client: NextcloudClient,
  roomToken: string,
  name: string
): Promise<void> {
  const body = new URLSearchParams({ roomName: name });
  await client.ocs.put(`/apps/spreed/api/v4/room/${roomToken}`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

/**
 * Make a room public (type 3). Guests can only join a public room, so a room
 * created as type 2 accepts no member of ours who lacks a Nextcloud account —
 * which today is all of them.
 */
export async function makeTalkRoomPublic(
  client: NextcloudClient,
  roomToken: string
): Promise<void> {
  await client.ocs.post(`/apps/spreed/api/v4/room/${roomToken}/public`, {});
}

/**
 * Join a public room as a named guest and return the session that authenticates
 * as them. The display name is set on the same session immediately, because a
 * guest with no name posts as "Guest".
 */
export async function joinRoomAsGuest(
  baseUrl: string,
  roomToken: string,
  displayName: string
): Promise<TalkGuestSession> {
  const joined = await fetch(talkUrl(baseUrl, `/api/v4/room/${roomToken}/participants/active`), {
    method: 'POST',
    headers: { ...OCS_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: '',
  });
  if (!joined.ok) {
    throw new Error(`Talk guest join failed: ${joined.status} ${await joined.text()}`);
  }
  const cookie = serializeCookies(joined.headers.getSetCookie?.());
  if (!cookie) throw new Error('Talk guest join returned no session cookie');

  await setGuestDisplayName(baseUrl, roomToken, cookie, displayName);

  // The actor id only appears on a message, so it is resolved from the first
  // post rather than guessed here; callers fill it in.
  return { cookie, actorId: '' };
}

export async function setGuestDisplayName(
  baseUrl: string,
  roomToken: string,
  cookie: string,
  displayName: string
): Promise<void> {
  const response = await fetch(talkUrl(baseUrl, `/api/v1/guest/${roomToken}/name`), {
    method: 'POST',
    headers: { ...OCS_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ displayName }).toString(),
  });
  if (!response.ok) {
    throw new Error(`Talk guest rename failed: ${response.status}`);
  }
}

/**
 * Post a message as a guest. Throws TalkSessionExpired when Nextcloud no
 * longer recognises the session, which is the caller's cue to re-join rather
 * than to report a failure to the member.
 */
export async function sendChatMessageAsGuest(
  baseUrl: string,
  roomToken: string,
  cookie: string,
  message: string
): Promise<TalkMessage> {
  const response = await fetch(talkUrl(baseUrl, `/api/v1/chat/${roomToken}`), {
    method: 'POST',
    headers: { ...OCS_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ message }).toString(),
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new TalkSessionExpired(`Talk rejected the guest session: ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`Talk message failed: ${response.status} ${await response.text()}`);
  }
  const body = await response.json();
  return body?.ocs?.data as TalkMessage;
}

/** The guest session is gone or was never valid — mint a new one and retry. */
export class TalkSessionExpired extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TalkSessionExpired';
  }
}
