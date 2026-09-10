/**
 * Nextcloud Deck API
 *
 * Kanban boards. Deck's REST API is NOT under /ocs/ like every other
 * feature module here — it lives at {baseUrl}/apps/deck/api/v1.0/ and
 * returns bare JSON (no {ocs:{meta,data}} envelope), so it cannot reuse
 * client.ocs (hardcoded to /ocs/v2.php). Each call below builds its own
 * axios instance from client.config instead.
 */

import axios, { type AxiosInstance } from 'axios';
import { type NextcloudClient } from './client';

export interface DeckLabel {
  id: number;
  title: string;
  color: string;
  boardId: number;
}

export interface DeckAssignedUser {
  id: number;
  participant: {
    primaryKey: string;
    uid: string;
    displayname: string;
    type: number;
  };
}

export interface DeckCard {
  id: number;
  title: string;
  description: string;
  stackId: number;
  type: string;
  order: number;
  archived: boolean;
  done: string | null;
  duedate: string | null;
  /**
   * Null (not an empty array) on cards returned by the reorder and
   * assign/unassign endpoints — those serialize a partially loaded entity.
   * Always read via `card.labels ?? []`.
   */
  labels: DeckLabel[] | null;
  assignedUsers: DeckAssignedUser[] | null;
  /**
   * An object on read endpoints, a bare uid string on write endpoints —
   * Deck serializes the owner differently depending on how the entity was
   * loaded. Use `deckOwnerUid()` rather than reading it directly.
   */
  owner: string | { uid: string; displayname: string };
  attachmentCount?: number;
  commentsCount?: number;
  lastModified: number;
  createdAt: number;
  deletedAt: number;
}

/** Normalizes DeckCard.owner across Deck's two serializations. */
export function deckOwnerUid(owner: DeckCard['owner']): string {
  return typeof owner === 'string' ? owner : owner.uid;
}

export interface DeckStack {
  id: number;
  title: string;
  boardId: number;
  order: number;
  deletedAt: number;
  lastModified: number;
  /**
   * Absent (not an empty array) when the stack has zero cards — Deck's own
   * Stack::jsonSerialize() unsets the key entirely. Always read via
   * `stack.cards ?? []`, never assume presence.
   */
  cards?: DeckCard[];
}

/** Deck ACL participant types. 0 = user, 1 = group, 7 = circle. */
export const DECK_ACL_USER = 0;
export const DECK_ACL_GROUP = 1;

export interface DeckAcl {
  id: number;
  type: number;
  participant: { uid: string; displayname: string; type: number };
  boardId: number;
  permissionEdit: boolean;
  permissionShare: boolean;
  permissionManage: boolean;
  owner: boolean;
}

export interface DeckBoard {
  id: number;
  title: string;
  owner: { uid: string; displayname: string };
  color: string;
  archived: boolean;
  labels: DeckLabel[];
  acl?: DeckAcl[];
  /** 0 when live; a unix timestamp once the board is in Deck's trash. */
  deletedAt: number;
  permissions: {
    PERMISSION_READ: boolean;
    PERMISSION_EDIT: boolean;
    PERMISSION_MANAGE: boolean;
    PERMISSION_SHARE: boolean;
  };
}

export interface DeckBoardDetail extends DeckBoard {
  stacks: DeckStack[];
}

export interface DeckComment {
  id: number;
  objectId: number;
  message: string;
  actorId: string;
  actorType: string;
  actorDisplayName: string;
  creationDateTime: string;
  mentions: unknown[];
}

export interface DeckAttachment {
  id: number;
  cardId: number;
  /** `deck_file` for a file uploaded to the card. */
  type: string;
  /** The filename. */
  data: string;
  createdAt: number;
  createdBy: string;
  deletedAt: number;
  extendedData?: {
    filesize?: number;
    mimetype?: string;
    attachmentCreator?: { id: string; displayName: string };
  };
}

export interface DeckActivity {
  activity_id: number;
  type: string;
  subject: string;
  datetime: string;
  user: string;
}

function deckClient(client: NextcloudClient, apiVersion = '1.0'): AxiosInstance {
  return axios.create({
    baseURL: `${client.config.baseUrl}/apps/deck/api/v${apiVersion}`,
    auth: {
      username: client.config.username,
      password: client.config.password,
    },
    headers: {
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

/**
 * Deck serves comments over OCS (`/ocs/v2.php/apps/deck/...`), not the bare
 * REST path the rest of the app uses — the REST path answers 405. Responses
 * come back in the usual `{ocs:{meta,data}}` envelope.
 */
function deckOcsClient(client: NextcloudClient): AxiosInstance {
  return axios.create({
    baseURL: `${client.config.baseUrl}/ocs/v2.php/apps/deck/api/v1.0`,
    auth: {
      username: client.config.username,
      password: client.config.password,
    },
    headers: {
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    params: { format: 'json' },
  });
}

export async function listBoards(client: NextcloudClient): Promise<DeckBoard[]> {
  const response = await deckClient(client).get('/boards');
  return response.data;
}

/**
 * Board metadata only — its stacks are NOT enriched with cards. Use
 * getBoardWithStacks for a renderable kanban view.
 */
export async function getBoard(client: NextcloudClient, boardId: number): Promise<DeckBoard> {
  const response = await deckClient(client).get(`/boards/${boardId}`);
  return response.data;
}

/**
 * Board + every stack, each with its cards embedded (or `cards` absent if
 * that stack has none) — one shape, one round trip for the whole kanban
 * view. /boards/{id}/stacks is the endpoint Deck's own service layer
 * enriches with cards; /boards/{id} on its own does not.
 */
export async function getBoardWithStacks(
  client: NextcloudClient,
  boardId: number
): Promise<DeckBoardDetail> {
  const dc = deckClient(client);
  const [board, stacks] = await Promise.all([
    dc.get(`/boards/${boardId}`).then((r) => r.data as DeckBoard),
    dc.get(`/boards/${boardId}/stacks`).then((r) => r.data as DeckStack[]),
  ]);
  return { ...board, stacks };
}

/**
 * Deck seeds every new board with its four default labels (Finished, To
 * review, Action needed, Later), so the returned board already has a usable
 * label set.
 */
export async function createBoard(
  client: NextcloudClient,
  input: { title: string; color: string }
): Promise<DeckBoard> {
  const response = await deckClient(client).post('/boards', input);
  return response.data;
}

/**
 * Moves the board to Deck's trash (sets `deletedAt`); it stays in GET /boards
 * until Deck's cleanup job purges it. A second DELETE returns 403, so filter
 * on `deletedAt === 0` rather than expecting the list to shrink.
 */
export async function deleteBoard(client: NextcloudClient, boardId: number): Promise<void> {
  await deckClient(client).delete(`/boards/${boardId}`);
}

export async function getBoardAcl(
  client: NextcloudClient,
  boardId: number
): Promise<DeckAcl[]> {
  const board = await getBoard(client, boardId);
  return board.acl ?? [];
}

export async function addBoardAcl(
  client: NextcloudClient,
  boardId: number,
  input: {
    type: number;
    participant: string;
    permissionEdit?: boolean;
    permissionShare?: boolean;
    permissionManage?: boolean;
  }
): Promise<DeckAcl> {
  const response = await deckClient(client).post(`/boards/${boardId}/acl`, {
    permissionEdit: false,
    permissionShare: false,
    permissionManage: false,
    ...input,
  });
  return response.data;
}

export async function removeBoardAcl(
  client: NextcloudClient,
  boardId: number,
  aclId: number
): Promise<void> {
  await deckClient(client).delete(`/boards/${boardId}/acl/${aclId}`);
}

export async function updateStack(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  input: { title: string; order: number }
): Promise<DeckStack> {
  const response = await deckClient(client).put(`/boards/${boardId}/stacks/${stackId}`, input);
  return response.data;
}

/**
 * The board's stacks carrying only their ARCHIVED cards. `/stacks` omits
 * archived cards entirely, so this is the only way to reach one — needed to
 * unarchive a card, since that call still wants its stack id.
 */
export async function getArchivedStacks(
  client: NextcloudClient,
  boardId: number
): Promise<DeckStack[]> {
  const response = await deckClient(client).get(`/boards/${boardId}/stacks/archived`);
  return response.data;
}

export async function createStack(
  client: NextcloudClient,
  boardId: number,
  input: { title: string; order: number }
): Promise<DeckStack> {
  const response = await deckClient(client).post(`/boards/${boardId}/stacks`, input);
  return response.data;
}

export async function deleteStack(
  client: NextcloudClient,
  boardId: number,
  stackId: number
): Promise<void> {
  await deckClient(client).delete(`/boards/${boardId}/stacks/${stackId}`);
}

export async function createCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  input: { title: string; description?: string; order?: number; duedate?: string | null }
): Promise<DeckCard> {
  const response = await deckClient(client).post(`/boards/${boardId}/stacks/${stackId}/cards`, {
    type: 'plain',
    ...input,
  });
  return response.data;
}

/**
 * Full-resource update. Deck's PUT requires title/type/owner even to touch
 * one field, with no server-side defaults — pass the current DeckCard
 * (already in hand from getBoardWithStacks) merged with whatever changed,
 * not a sparse patch. For moving a card between stacks/positions, use
 * moveCard instead — it only needs stackId + order.
 */
export async function updateCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  card: Pick<DeckCard, 'title' | 'type' | 'owner'> &
    Partial<Pick<DeckCard, 'description' | 'order' | 'duedate' | 'archived' | 'done'>>
): Promise<DeckCard> {
  const response = await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}`,
    card
  );
  return response.data;
}

/**
 * Move a card to a (possibly different) stack and/or position — Deck's
 * dedicated reorder endpoint. This is what drag-and-drop should call; it
 * never needs the rest of the card and can't hit the PUT-requires-owner
 * foot-gun above.
 *
 * `toStackId` is the DESTINATION and goes in the URL, not the source stack.
 * Nextcloud merges route parameters over the request body, so the `stackId`
 * in the JSON payload is always shadowed by the one in the path: posting the
 * source stack there returns 200 and silently moves the card nowhere. Verified
 * against Deck on the live server, 2026-09-06.
 *
 * Returns every card in the destination stack, with their new `order` values —
 * not the single moved card.
 */
export async function moveCard(
  client: NextcloudClient,
  boardId: number,
  toStackId: number,
  cardId: number,
  order: number
): Promise<DeckCard[]> {
  const response = await deckClient(client).put(
    `/boards/${boardId}/stacks/${toStackId}/cards/${cardId}/reorder`,
    { stackId: toStackId, order }
  );
  return response.data;
}

/**
 * Deck's own "Archive card". Archived cards vanish from the board view and
 * live under the board's Archive tab; the card is not deleted.
 */
export async function archiveCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number
): Promise<DeckCard> {
  const response = await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/archive`,
    {}
  );
  return response.data;
}

export async function unarchiveCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number
): Promise<DeckCard> {
  const response = await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/unarchive`,
    {}
  );
  return response.data;
}

/**
 * Card comments. Every comment we post is authored by the service account,
 * because that is the only Nextcloud identity our apps hold — see the
 * attribution note in @elkdonis/services' org-deck.ts.
 */
export async function listCardComments(
  client: NextcloudClient,
  cardId: number,
  limit = 50
): Promise<DeckComment[]> {
  const response = await deckOcsClient(client).get(`/cards/${cardId}/comments`, {
    params: { limit },
  });
  return response.data?.ocs?.data ?? [];
}

export async function createCardComment(
  client: NextcloudClient,
  cardId: number,
  message: string
): Promise<DeckComment> {
  const response = await deckOcsClient(client).post(`/cards/${cardId}/comments`, { message });
  return response.data?.ocs?.data;
}

export async function deleteCardComment(
  client: NextcloudClient,
  cardId: number,
  commentId: number
): Promise<void> {
  await deckOcsClient(client).delete(`/cards/${cardId}/comments/${commentId}`);
}

/**
 * Attachments. API v1.1 is used for reads because v1.0's getAll filters the
 * list down to `deck_file` entries only.
 */
export async function listCardAttachments(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number
): Promise<DeckAttachment[]> {
  const response = await deckClient(client, '1.1').get(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/attachments`
  );
  return (response.data as DeckAttachment[]).filter((a) => a.deletedAt === 0);
}

/**
 * Uploads a file onto a card. `data` (the filename) is a REQUIRED parameter
 * alongside the multipart file — omitting it is answered with a bare 400 and
 * an empty body, which is how this looks like a broken endpoint rather than a
 * missing argument.
 */
export async function uploadCardAttachment(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  file: { filename: string; content: Buffer | Blob; contentType?: string }
): Promise<DeckAttachment> {
  const form = new FormData();
  form.append('type', 'deck_file');
  form.append('data', file.filename);
  const blob =
    file.content instanceof Blob
      ? file.content
      : new Blob([new Uint8Array(file.content)], {
          type: file.contentType ?? 'application/octet-stream',
        });
  form.append('file', blob, file.filename);

  const response = await axios.post(
    `${client.config.baseUrl}/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards/${cardId}/attachments`,
    form,
    {
      auth: { username: client.config.username, password: client.config.password },
      headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
    }
  );
  return response.data;
}

/** The attachment's bytes, for proxying a download to a member's browser. */
export async function downloadCardAttachment(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  attachmentId: number
): Promise<{ data: Buffer; contentType: string }> {
  const response = await axios.get(
    `${client.config.baseUrl}/apps/deck/api/v1.0/boards/${boardId}/stacks/${stackId}/cards/${cardId}/attachments/${attachmentId}`,
    {
      auth: { username: client.config.username, password: client.config.password },
      headers: { 'OCS-APIRequest': 'true' },
      responseType: 'arraybuffer',
    }
  );
  return {
    data: Buffer.from(response.data),
    contentType: response.headers['content-type'] ?? 'application/octet-stream',
  };
}

export async function deleteCardAttachment(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  attachmentId: number
): Promise<void> {
  await deckClient(client).delete(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/attachments/${attachmentId}`
  );
}

/**
 * A card's activity feed, from the Activity app rather than Deck — Deck has
 * no activity endpoint of its own. Only activities visible to the
 * authenticated account are returned, which for us means the service
 * account's: everything our apps did, plus anything done to the card in
 * Nextcloud by someone whose activity it can see.
 */
export async function listCardActivity(
  client: NextcloudClient,
  cardId: number,
  limit = 30
): Promise<DeckActivity[]> {
  const response = await axios.get(
    `${client.config.baseUrl}/ocs/v2.php/apps/activity/api/v2/activity/filter`,
    {
      auth: { username: client.config.username, password: client.config.password },
      headers: { 'OCS-APIRequest': 'true', Accept: 'application/json' },
      params: { format: 'json', object_type: 'deck_card', object_id: cardId, limit },
      validateStatus: (status) => status === 200 || status === 304,
    }
  );
  return response.data?.ocs?.data ?? [];
}

export async function assignCardLabel(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  labelId: number
): Promise<void> {
  await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/assignLabel`,
    { labelId }
  );
}

export async function removeCardLabel(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  labelId: number
): Promise<void> {
  await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/removeLabel`,
    { labelId }
  );
}

/**
 * Deck rejects this with 400 "The user is not part of the board" unless the
 * uid already holds an ACL entry on the board — share first, then assign.
 */
export async function assignCardUser(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  userId: string
): Promise<void> {
  await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/assignUser`,
    { userId }
  );
}

export async function unassignCardUser(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  userId: string
): Promise<void> {
  await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/unassignUser`,
    { userId }
  );
}

export async function deleteCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number
): Promise<void> {
  await deckClient(client).delete(`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`);
}
