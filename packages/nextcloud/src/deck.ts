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
  labels: DeckLabel[];
  assignedUsers: DeckAssignedUser[];
  owner: string;
  lastModified: number;
  createdAt: number;
  deletedAt: number;
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

export interface DeckBoard {
  id: number;
  title: string;
  owner: { uid: string; displayname: string };
  color: string;
  archived: boolean;
  labels: DeckLabel[];
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

function deckClient(client: NextcloudClient): AxiosInstance {
  return axios.create({
    baseURL: `${client.config.baseUrl}/apps/deck/api/v1.0`,
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
    Partial<Pick<DeckCard, 'description' | 'order' | 'duedate' | 'archived'>>
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
 */
export async function moveCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number,
  input: { stackId: number; order: number }
): Promise<DeckCard> {
  const response = await deckClient(client).put(
    `/boards/${boardId}/stacks/${stackId}/cards/${cardId}/reorder`,
    input
  );
  return response.data;
}

export async function deleteCard(
  client: NextcloudClient,
  boardId: number,
  stackId: number,
  cardId: number
): Promise<void> {
  await deckClient(client).delete(`/boards/${boardId}/stacks/${stackId}/cards/${cardId}`);
}
