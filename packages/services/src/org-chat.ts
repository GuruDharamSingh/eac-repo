// ============================================================================
// An org's General Chat — the Nextcloud Talk room its hub renders.
//
// Same boundary rules as org-deck.ts, for the same reason: every call goes out
// over credentials the member does not hold, so the app is the only thing that
// can keep one org out of another's room.
//   1. A room token is never accepted from a caller — always resolved from
//      `organizations.talk_room_token` for the org the caller is scoped to.
//   2. Callers must have established org membership before calling anything
//      here.
//
// Where this differs from Deck: messages are NOT posted by the service
// account. Each member gets their own Talk guest session (migration 102), so
// their name is on their own messages in Nextcloud too. Reads still go over
// the service account, which is a participant in every room we provision.
// ============================================================================

import { db } from '@elkdonis/db';
import {
  createTalkRoom,
  getAdminClient,
  getChatMessages,
  getTalkRoom,
  joinRoomAsGuest,
  makeTalkRoomPublic,
  sendChatMessageAsGuest,
  setGuestDisplayName,
  TalkSessionExpired,
  type NextcloudClient,
  type TalkMessage,
} from '@elkdonis/nextcloud';

/** Thrown when an org has no chat room yet, or a caller names another org's. */
export class OrgChatScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgChatScopeError';
  }
}

export interface OrgChatRoom {
  token: string;
  /** The room's name in Nextcloud. Hubs label it "General Chat" regardless. */
  name: string;
  /** 3 = public. Guests — i.e. our members — can only join a public room. */
  type: number;
}

export interface OrgChatMessage {
  id: number;
  authorName: string;
  message: string;
  /** ISO timestamp. */
  at: string;
  /** Talk's own join/leave/rename notices, rendered differently. */
  isSystem: boolean;
  /** True when this message was posted by the viewer. */
  own: boolean;
}

function client(): NextcloudClient {
  return getAdminClient();
}

function baseUrl(): string {
  const url = process.env.NEXTCLOUD_URL;
  if (!url) throw new Error('NEXTCLOUD_URL is required for Talk');
  return url;
}

async function readRoomToken(orgId: string): Promise<string | null> {
  const [row] = await db<Array<{ talk_room_token: string | null }>>`
    SELECT talk_room_token FROM organizations WHERE id = ${orgId}
  `;
  return row?.talk_room_token ?? null;
}

/** The org's chat room, or null when it has never been provisioned. */
export async function getOrgChatRoom(orgId: string): Promise<OrgChatRoom | null> {
  const token = await readRoomToken(orgId);
  if (!token) return null;
  try {
    const room = await getTalkRoom(client(), token);
    return { token: room.token, name: room.displayName || room.name, type: room.type };
  } catch {
    // A token pointing at a room that no longer exists reads as "no room" so
    // the hub offers to create one, rather than showing a broken panel.
    return null;
  }
}

/**
 * Create the org's chat room if it has none, and make sure an existing one can
 * actually be joined by our members.
 *
 * The room is named "<Org> — General Chat" in Nextcloud rather than plain
 * "General Chat": the service account is in every one of them, and fifteen
 * identically-named rooms in its sidebar would be unusable. Hubs label it
 * "General Chat" in their own UI.
 *
 * An org that already has a room keeps it, name and history intact — several
 * were provisioned earlier under the org's own name and members are already in
 * them. Only the public flag is enforced, because a private room silently
 * rejects every member who has no Nextcloud account, which today is all of them.
 */
export async function ensureOrgChatRoom(orgId: string): Promise<OrgChatRoom> {
  const existing = await getOrgChatRoom(orgId);
  if (existing) {
    if (existing.type !== 3) {
      await makeTalkRoomPublic(client(), existing.token);
      return { ...existing, type: 3 };
    }
    return existing;
  }

  const [org] = await db<Array<{ name: string }>>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;
  if (!org) throw new OrgChatScopeError(`Unknown org: ${orgId}`);

  const room = await createTalkRoom(client(), {
    name: `${org.name} — General Chat`,
    type: 'public',
  });
  await db`
    UPDATE organizations SET talk_room_token = ${room.token} WHERE id = ${orgId}
  `;
  return { token: room.token, name: room.displayName || room.name, type: 3 };
}

async function requireRoomToken(orgId: string): Promise<string> {
  const token = await readRoomToken(orgId);
  if (!token) throw new OrgChatScopeError(`Org ${orgId} has no chat room`);
  return token;
}

/**
 * Recent messages, oldest first. Talk returns newest-first when reading
 * backwards from the end, which is the wrong order for a transcript.
 */
export async function listOrgChatMessages(
  orgId: string,
  viewerUserId: string,
  options: { limit?: number } = {}
): Promise<OrgChatMessage[]> {
  const token = await requireRoomToken(orgId);
  const [messages, session] = await Promise.all([
    getChatMessages(client(), token, { limit: options.limit ?? 50 }),
    readGuestSession(viewerUserId, token),
  ]);

  return messages
    .filter(isReadableByMembers)
    .map((m) => toOrgChatMessage(m, session?.actor_id ?? null))
    .sort((a, b) => a.id - b.id);
}

/**
 * Talk phrases system messages relative to whoever is reading, and we read as
 * the service account — so its notices arrive as "You created the
 * conversation", "You allowed guests", "You deleted a message" for every
 * member. Rather than show members a first person that isn't them, the
 * transcript carries only what people actually said. Deletion tombstones
 * ("Message deleted by you") go for the same reason.
 */
function isReadableByMembers(m: TalkMessage): boolean {
  if (m.messageType === 'system' || m.systemMessage) return false;
  if (m.messageType === 'comment_deleted') return false;
  return true;
}

function toOrgChatMessage(m: TalkMessage, viewerActorId: string | null): OrgChatMessage {
  return {
    id: m.id,
    authorName: m.actorDisplayName || 'Someone',
    message: m.message,
    at: new Date(m.timestamp * 1000).toISOString(),
    isSystem: m.messageType === 'system' || Boolean(m.systemMessage),
    own: viewerActorId !== null && m.actorId === viewerActorId,
  };
}

interface GuestSessionRow {
  cookie: string;
  actor_id: string;
  display_name: string | null;
  name_is_custom: boolean;
}

async function readGuestSession(
  userId: string,
  roomToken: string
): Promise<GuestSessionRow | null> {
  const [row] = await db<GuestSessionRow[]>`
    SELECT cookie, actor_id, display_name, name_is_custom
    FROM talk_guest_sessions
    WHERE user_id = ${userId} AND room_token = ${roomToken}
  `;
  return row ?? null;
}

export interface OrgChatIdentity {
  /** The name this member's messages will carry. */
  displayName: string;
  /** They chose it, rather than it being derived from their profile. */
  isCustom: boolean;
}

/**
 * The name this member posts under, and whether they picked it.
 *
 * `fallbackName` is what the app derives from their profile; a name they chose
 * themselves outranks it. The fallback is often an email address, which is a
 * poor thing to put in front of a room — hence the offer to change it.
 */
export async function getOrgChatIdentity(
  orgId: string,
  userId: string,
  fallbackName: string
): Promise<OrgChatIdentity> {
  const token = await readRoomToken(orgId);
  if (!token) return { displayName: fallbackName, isCustom: false };

  const session = await readGuestSession(userId, token);
  if (session?.name_is_custom && session.display_name) {
    return { displayName: session.display_name, isCustom: true };
  }
  return { displayName: fallbackName, isCustom: false };
}

/**
 * Set the name this member's guest account posts under.
 *
 * This is RETROACTIVE for that guest session: Talk resolves a guest's display
 * name when a message is read, not when it is sent, so renaming also changes
 * the name shown on messages the session already posted. Verified live,
 * 2026-09-07 — the opposite of what the API's shape suggests. Messages sent
 * from an earlier, expired session keep whatever name that session held, so a
 * long-lived room can show one person under two names.
 */
export async function setOrgChatDisplayName(
  orgId: string,
  userId: string,
  displayName: string
): Promise<OrgChatIdentity> {
  const token = await requireRoomToken(orgId);
  const name = displayName.trim();
  if (!name) throw new OrgChatScopeError('A display name is required');

  const session = await readGuestSession(userId, token);
  const cookie = session?.cookie ?? (await mintGuestSession(userId, token, name));

  try {
    await setGuestDisplayName(baseUrl(), token, cookie, name);
  } catch {
    // An expired session can't be renamed — mint a fresh one under the new
    // name instead of reporting a failure the member can do nothing about.
    await mintGuestSession(userId, token, name);
  }

  await db`
    UPDATE talk_guest_sessions
    SET display_name = ${name}, name_is_custom = TRUE, refreshed_at = NOW()
    WHERE user_id = ${userId} AND room_token = ${token}
  `;
  return { displayName: name, isCustom: true };
}

async function mintGuestSession(
  userId: string,
  roomToken: string,
  displayName: string
): Promise<string> {
  const session = await joinRoomAsGuest(baseUrl(), roomToken, displayName);
  await db`
    INSERT INTO talk_guest_sessions (user_id, room_token, cookie, actor_id, display_name)
    VALUES (${userId}, ${roomToken}, ${session.cookie}, '', ${displayName})
    ON CONFLICT (user_id, room_token) DO UPDATE
      SET cookie = EXCLUDED.cookie,
          actor_id = '',
          display_name = EXCLUDED.display_name,
          refreshed_at = NOW()
  `;
  return session.cookie;
}

/**
 * Post a message to the org's chat as this member.
 *
 * `fallbackName` is derived from the caller's own profile and is never taken
 * from the request — it is what everyone in Nextcloud will see against the
 * message. A name the member chose for themselves (setOrgChatDisplayName)
 * outranks it and is never overwritten from the profile.
 *
 * A session Nextcloud has expired is re-minted once and the post retried —
 * these sessions are disposable by design, so an expiry is routine rather
 * than an error worth showing anyone.
 */
export async function postOrgChatMessage(
  orgId: string,
  viewerUserId: string,
  fallbackName: string,
  message: string
): Promise<OrgChatMessage> {
  const token = await requireRoomToken(orgId);
  const existing = await readGuestSession(viewerUserId, token);
  const displayName =
    existing?.name_is_custom && existing.display_name ? existing.display_name : fallbackName;

  let cookie = existing?.cookie ?? (await mintGuestSession(viewerUserId, token, displayName));

  // Keep Talk's copy of the name in step, whichever name won above.
  if (existing && existing.display_name !== displayName) {
    await setGuestDisplayName(baseUrl(), token, cookie, displayName).catch(() => undefined);
  }

  let posted: TalkMessage;
  try {
    posted = await sendChatMessageAsGuest(baseUrl(), token, cookie, message);
  } catch (error) {
    if (!(error instanceof TalkSessionExpired)) throw error;
    cookie = await mintGuestSession(viewerUserId, token, displayName);
    posted = await sendChatMessageAsGuest(baseUrl(), token, cookie, message);
  }

  // Talk only reveals the guest's actor id on a message, so it is recorded
  // from the first successful post and thereafter marks the member's own lines.
  await db`
    UPDATE talk_guest_sessions
    SET actor_id = ${posted.actorId}, display_name = ${displayName}, refreshed_at = NOW()
    WHERE user_id = ${viewerUserId} AND room_token = ${token}
  `;

  return toOrgChatMessage(posted, posted.actorId);
}

/** The Nextcloud URL a member with their own account can open the room at. */
export async function getOrgChatNextcloudUrl(orgId: string): Promise<string | null> {
  const token = await readRoomToken(orgId);
  if (!token) return null;
  const publicUrl = process.env.NEXTCLOUD_PUBLIC_URL ?? process.env.NEXT_PUBLIC_NEXTCLOUD_URL;
  return publicUrl ? `${publicUrl.replace(/\/$/, '')}/call/${token}` : null;
}
