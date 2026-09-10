// ============================================================================
// Per-org Nextcloud Deck board — the kanban an org's hub renders.
//
// Isolation is enforced HERE, not by Nextcloud. Every call goes out over the
// single service-account credential (NEXTCLOUD_ADMIN_USER), which can see
// every board that account owns or was shared into — including other orgs'
// boards and boards belonging to individual members. Deck therefore has no
// signal about who is asking, and its board ACL cannot be the boundary.
//
// Two rules keep orgs apart, and both live in this file:
//   1. A board id is never accepted from a caller. It is always resolved from
//      `organizations.deck_board_id` for the org the caller is scoped to.
//   2. Every stack and card id a caller passes is verified to belong to that
//      board before it is written to — otherwise a member of one org could
//      name a stack id from another org's board and the service account would
//      happily write there.
//
// Callers still have to establish that the viewer belongs to the org (see
// getOrgRole) before calling anything here; this file assumes that check
// happened and guards the layer below it.
// ============================================================================

import { db } from '@elkdonis/db';
import {
  DECK_ACL_USER,
  addBoardAcl,
  archiveCard,
  assignCardLabel,
  assignCardUser,
  createBoard,
  createCard,
  createCardComment,
  createStack,
  deleteCard,
  deleteCardAttachment,
  deleteCardComment,
  deleteStack,
  downloadCardAttachment,
  getAdminClient,
  getArchivedStacks,
  getBoard,
  getBoardWithStacks,
  listCardActivity,
  listCardAttachments,
  listCardComments,
  moveCard,
  removeBoardAcl,
  removeCardLabel,
  unarchiveCard,
  unassignCardUser,
  updateCard,
  updateStack,
  uploadCardAttachment,
  type DeckAttachment,
  type DeckBoardDetail,
  type DeckCard,
  type DeckStack,
  type NextcloudClient,
} from '@elkdonis/nextcloud';

/**
 * Thrown when a caller names a stack or card that isn't on their org's board.
 * Distinct from a Nextcloud failure so routes can answer 404 rather than
 * reporting someone else's board as a broken upstream.
 */
export class OrgDeckScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgDeckScopeError';
  }
}

/** Deck's default board colour — Nextcloud blue. */
const DEFAULT_BOARD_COLOR = '0082c9';

/** What Deck itself seeds a new board with, so ours look like the real thing. */
const DEFAULT_STACKS = ['To do', 'Doing', 'Done'];

export interface OrgDeckBoard extends DeckBoardDetail {
  orgId: string;
}

function client(): NextcloudClient {
  return getAdminClient();
}

async function readBoardId(orgId: string): Promise<number | null> {
  const [row] = await db<Array<{ deck_board_id: number | null }>>`
    SELECT deck_board_id FROM organizations WHERE id = ${orgId}
  `;
  return row?.deck_board_id ?? null;
}

/**
 * The org's board id, or null when it has never been provisioned. Read paths
 * use this to render an empty state instead of creating a board as a side
 * effect of someone opening a page.
 */
export async function getOrgDeckBoardId(orgId: string): Promise<number | null> {
  return readBoardId(orgId);
}

/**
 * Create the org's board if it doesn't have one yet, and return its id.
 * Idempotent: a second call returns the stored id without touching Nextcloud.
 *
 * The board is owned by the service account and gets NO group ACL — sharing it
 * with `EAC_Network` or `Elkdonis Arts Collective` would put every org's board
 * in every member's Nextcloud sidebar, which is the thing this whole file
 * exists to prevent. Member access is granted per-user by syncOrgDeckMembers.
 */
export async function ensureOrgDeckBoard(orgId: string): Promise<number> {
  const existing = await readBoardId(orgId);
  if (existing !== null) return existing;

  const [org] = await db<Array<{ name: string }>>`
    SELECT name FROM organizations WHERE id = ${orgId}
  `;
  if (!org) throw new Error(`Unknown org: ${orgId}`);

  const nc = client();
  const board = await createBoard(nc, { title: org.name, color: DEFAULT_BOARD_COLOR });

  for (const [index, title] of DEFAULT_STACKS.entries()) {
    await createStack(nc, board.id, { title, order: index });
  }

  await db`
    UPDATE organizations
    SET deck_board_id = ${board.id}, deck_board_synced_at = NOW()
    WHERE id = ${orgId}
  `;

  await syncOrgDeckMembers(orgId);
  return board.id;
}

/**
 * Grant every org member who has connected a Nextcloud account edit access to
 * the org's board, and revoke anyone who is no longer a member. Only matters
 * for people working in Nextcloud directly — access through our apps never
 * consults this ACL — but it is what stops a board from becoming visible to
 * the wider network once members start linking accounts.
 *
 * Deck also refuses to assign a card to a uid with no ACL entry on the board,
 * so this is a precondition for card assignment, not only for native access.
 */
export async function syncOrgDeckMembers(orgId: string): Promise<void> {
  const boardId = await readBoardId(orgId);
  if (boardId === null) return;

  const members = await db<Array<{ nextcloud_user_id: string }>>`
    SELECT DISTINCT u.nextcloud_user_id
    FROM user_organizations uo
    JOIN users u ON u.id = uo.user_id
    WHERE uo.org_id = ${orgId} AND u.nextcloud_user_id IS NOT NULL
  `;

  const nc = client();
  const board = await getBoardWithStacks(nc, boardId);
  const current = board.acl ?? [];
  const wanted = new Set(members.map((m) => m.nextcloud_user_id));

  for (const uid of wanted) {
    if (current.some((a) => a.type === DECK_ACL_USER && a.participant.uid === uid)) continue;
    await addBoardAcl(nc, boardId, {
      type: DECK_ACL_USER,
      participant: uid,
      permissionEdit: true,
    });
  }

  for (const acl of current) {
    if (acl.owner) continue;
    if (acl.type === DECK_ACL_USER && wanted.has(acl.participant.uid)) continue;
    await removeBoardAcl(nc, boardId, acl.id);
  }

  await db`UPDATE organizations SET deck_board_synced_at = NOW() WHERE id = ${orgId}`;
}

/** The org's board with its stacks and cards, or null if not provisioned. */
export async function getOrgDeckBoard(orgId: string): Promise<OrgDeckBoard | null> {
  const boardId = await readBoardId(orgId);
  if (boardId === null) return null;
  const board = await getBoardWithStacks(client(), boardId);
  return { ...board, orgId };
}

interface ResolvedBoard {
  boardId: number;
  stacks: DeckStack[];
}

async function requireBoard(orgId: string): Promise<ResolvedBoard> {
  const boardId = await readBoardId(orgId);
  if (boardId === null) throw new OrgDeckScopeError(`Org ${orgId} has no Deck board`);
  const board = await getBoardWithStacks(client(), boardId);
  return { boardId, stacks: board.stacks };
}

/** Throws unless the stack is one of the org board's own stacks. */
async function requireStack(orgId: string, stackId: number): Promise<ResolvedBoard> {
  const board = await requireBoard(orgId);
  if (!board.stacks.some((s) => s.id === stackId)) {
    throw new OrgDeckScopeError(`Stack ${stackId} is not on org ${orgId}'s board`);
  }
  return board;
}

/**
 * Throws unless the card sits in one of the org board's own stacks.
 *
 * `/stacks` omits archived cards, so anything that has to reach an archived
 * card (unarchiving it, reading its detail) passes includeArchived and pays
 * for one extra round trip.
 */
async function requireCard(
  orgId: string,
  cardId: number,
  options: { includeArchived?: boolean } = {}
): Promise<ResolvedBoard & { stackId: number; card: DeckCard }> {
  const board = await requireBoard(orgId);
  const stacks = options.includeArchived
    ? [...board.stacks, ...(await getArchivedStacks(client(), board.boardId))]
    : board.stacks;

  for (const stack of stacks) {
    const card = (stack.cards ?? []).find((c) => c.id === cardId);
    if (card) return { ...board, stackId: stack.id, card };
  }
  throw new OrgDeckScopeError(`Card ${cardId} is not on org ${orgId}'s board`);
}

export async function createOrgCard(
  orgId: string,
  input: { stackId: number; title: string; description?: string; duedate?: string | null }
): Promise<DeckCard> {
  const { boardId, stacks } = await requireStack(orgId, input.stackId);
  const stack = stacks.find((s) => s.id === input.stackId)!;
  return createCard(client(), boardId, input.stackId, {
    title: input.title,
    description: input.description,
    duedate: input.duedate ?? null,
    order: (stack.cards ?? []).length,
  });
}

export async function moveOrgCard(
  orgId: string,
  cardId: number,
  toStackId: number,
  order: number
): Promise<DeckCard[]> {
  const { boardId, stacks } = await requireCard(orgId, cardId);
  if (!stacks.some((s) => s.id === toStackId)) {
    throw new OrgDeckScopeError(`Stack ${toStackId} is not on org ${orgId}'s board`);
  }
  return moveCard(client(), boardId, toStackId, cardId, order);
}

/**
 * Deck's card PUT is a full replace with no server-side defaults — title, type
 * and owner are required even to change a due date — so the stored card is
 * merged with the patch here rather than in every caller.
 */
export async function updateOrgCard(
  orgId: string,
  cardId: number,
  patch: Partial<Pick<DeckCard, 'title' | 'description' | 'duedate' | 'archived' | 'done'>>
): Promise<DeckCard> {
  const { boardId, stackId, card } = await requireCard(orgId, cardId);
  return updateCard(client(), boardId, stackId, cardId, {
    title: patch.title ?? card.title,
    type: card.type,
    owner: typeof card.owner === 'string' ? card.owner : card.owner.uid,
    description: patch.description ?? card.description,
    duedate: patch.duedate !== undefined ? patch.duedate : card.duedate,
    archived: patch.archived !== undefined ? patch.archived : card.archived,
    // `done` is a TIMESTAMP in oc_deck_cards, not a flag: Deck stores the
    // moment a card was marked done and treats NULL as not done.
    done: patch.done !== undefined ? patch.done : card.done,
    order: card.order,
  });
}

/** Deck's "Mark as done" / "Mark as undone" — stamps or clears `done`. */
export async function setOrgCardDone(
  orgId: string,
  cardId: number,
  done: boolean
): Promise<DeckCard> {
  return updateOrgCard(orgId, cardId, { done: done ? new Date().toISOString() : null });
}

/**
 * The board's archived cards, as Deck's own "Archived cards" view shows them.
 * Without this an archive is a one-way trip from inside our apps: `/stacks`
 * never returns archived cards, so nothing could offer to bring one back.
 */
export async function listOrgArchivedCards(
  orgId: string
): Promise<Array<DeckCard & { stackTitle: string }>> {
  const boardId = await readBoardId(orgId);
  if (boardId === null) return [];
  const stacks = await getArchivedStacks(client(), boardId);
  return stacks
    .flatMap((stack) =>
      (stack.cards ?? []).map((card) => ({ ...card, stackTitle: stack.title }))
    )
    .sort((a, b) => b.lastModified - a.lastModified);
}

/** Deck's "Archive card" — off the board, not deleted. */
export async function setOrgCardArchived(
  orgId: string,
  cardId: number,
  archived: boolean
): Promise<DeckCard> {
  const { boardId, stackId } = await requireCard(orgId, cardId, { includeArchived: true });
  const fn = archived ? archiveCard : unarchiveCard;
  return fn(client(), boardId, stackId, cardId);
}

export async function deleteOrgCard(orgId: string, cardId: number): Promise<void> {
  const { boardId, stackId } = await requireCard(orgId, cardId);
  await deleteCard(client(), boardId, stackId, cardId);
}

export async function setOrgCardLabel(
  orgId: string,
  cardId: number,
  labelId: number,
  assigned: boolean
): Promise<void> {
  const { boardId, stackId } = await requireCard(orgId, cardId);
  const fn = assigned ? assignCardLabel : removeCardLabel;
  await fn(client(), boardId, stackId, cardId, labelId);
}

/**
 * Who a card can be assigned to: the board's ACL participants.
 *
 * `oc_deck_assigned_users.participant` holds a Nextcloud principal, and Deck
 * refuses `assignUser` for a uid with no ACL entry on the board — so a member
 * who has never connected a Nextcloud account cannot be assigned a card at
 * all. That is a real limit of Deck's data model, not something the app can
 * paper over, so the UI offers only the people who are actually assignable.
 */
export async function listOrgDeckAssignees(
  orgId: string
): Promise<Array<{ uid: string; displayName: string }>> {
  const boardId = await readBoardId(orgId);
  if (boardId === null) return [];
  const board = await getBoard(client(), boardId);
  const people = [{ uid: board.owner.uid, displayName: board.owner.displayname }];
  for (const acl of board.acl ?? []) {
    if (acl.type !== DECK_ACL_USER) continue;
    if (people.some((p) => p.uid === acl.participant.uid)) continue;
    people.push({ uid: acl.participant.uid, displayName: acl.participant.displayname });
  }
  return people;
}

/**
 * This person's Nextcloud uid, or null if they've never connected an account —
 * which is what decides whether "Assign to me" can do anything for them.
 */
export async function getDeckIdentity(userId: string): Promise<string | null> {
  const [row] = await db<Array<{ nextcloud_user_id: string | null }>>`
    SELECT nextcloud_user_id FROM users WHERE id = ${userId}
  `;
  return row?.nextcloud_user_id ?? null;
}

export async function setOrgCardAssignee(
  orgId: string,
  cardId: number,
  userId: string,
  assigned: boolean
): Promise<void> {
  const { boardId, stackId } = await requireCard(orgId, cardId);
  const assignable = await listOrgDeckAssignees(orgId);
  if (!assignable.some((p) => p.uid === userId)) {
    throw new OrgDeckScopeError(`${userId} is not a participant on org ${orgId}'s board`);
  }
  const fn = assigned ? assignCardUser : unassignCardUser;
  await fn(client(), boardId, stackId, cardId, userId);
}

export interface OrgDeckComment {
  id: number;
  message: string;
  /** Who wrote it, as our apps know them — see the attribution note below. */
  authorName: string;
  createdAt: string;
  /** True when the comment was written in Nextcloud rather than through us. */
  fromNextcloud: boolean;
}

/**
 * Comment attribution, and its limit.
 *
 * Our apps hold exactly one Nextcloud identity — the service account — so
 * every comment we post is authored by it in `oc_comments.actor_id`. Nextcloud
 * cannot be told otherwise without giving each member their own account. The
 * author is therefore carried in the message itself, as a leading `**Name**:`,
 * which reads correctly in Deck (it renders markdown) and is parsed back out
 * here so our own UI shows the right person.
 *
 * This is a convention, not a guarantee: someone typing `**Bob**: hi` in
 * Nextcloud would be shown as Bob. It attributes, it does not authenticate,
 * and it must never be used to decide what anyone is allowed to do.
 */
const ATTRIBUTION = /^\*\*(.+?)\*\*:\s([\s\S]*)$/;

export async function listOrgCardComments(
  orgId: string,
  cardId: number
): Promise<OrgDeckComment[]> {
  await requireCard(orgId, cardId, { includeArchived: true });
  const comments = await listCardComments(client(), cardId);
  return comments.map((c) => {
    const match = ATTRIBUTION.exec(c.message);
    return {
      id: c.id,
      message: match ? match[2] : c.message,
      authorName: match ? match[1] : c.actorDisplayName,
      createdAt: c.creationDateTime,
      fromNextcloud: !match,
    };
  });
}

export async function createOrgCardComment(
  orgId: string,
  cardId: number,
  authorName: string,
  message: string
): Promise<OrgDeckComment> {
  await requireCard(orgId, cardId, { includeArchived: true });
  // Strip markdown that would break the attribution prefix's parse.
  const safeName = authorName.replace(/[*:\n]/g, '').trim() || 'A member';
  const comment = await createCardComment(client(), cardId, `**${safeName}**: ${message}`);
  return {
    id: comment.id,
    message,
    authorName: safeName,
    createdAt: comment.creationDateTime,
    fromNextcloud: false,
  };
}

export async function deleteOrgCardComment(
  orgId: string,
  cardId: number,
  commentId: number
): Promise<void> {
  await requireCard(orgId, cardId, { includeArchived: true });
  await deleteCardComment(client(), cardId, commentId);
}

export async function listOrgCardAttachments(
  orgId: string,
  cardId: number
): Promise<DeckAttachment[]> {
  const { boardId, stackId } = await requireCard(orgId, cardId, { includeArchived: true });
  return listCardAttachments(client(), boardId, stackId, cardId);
}

export async function addOrgCardAttachment(
  orgId: string,
  cardId: number,
  file: { filename: string; content: Buffer; contentType?: string }
): Promise<DeckAttachment> {
  const { boardId, stackId } = await requireCard(orgId, cardId);
  return uploadCardAttachment(client(), boardId, stackId, cardId, file);
}

export async function readOrgCardAttachment(
  orgId: string,
  cardId: number,
  attachmentId: number
): Promise<{ data: Buffer; contentType: string }> {
  const { boardId, stackId } = await requireCard(orgId, cardId, { includeArchived: true });
  return downloadCardAttachment(client(), boardId, stackId, cardId, attachmentId);
}

export async function removeOrgCardAttachment(
  orgId: string,
  cardId: number,
  attachmentId: number
): Promise<void> {
  const { boardId, stackId } = await requireCard(orgId, cardId);
  await deleteCardAttachment(client(), boardId, stackId, cardId, attachmentId);
}

/** The card's Activity feed, as Deck's own card detail shows it. */
export async function listOrgCardActivity(
  orgId: string,
  cardId: number
): Promise<Array<{ id: number; subject: string; at: string }>> {
  await requireCard(orgId, cardId, { includeArchived: true });
  const activity = await listCardActivity(client(), cardId);
  return activity.map((a) => ({ id: a.activity_id, subject: a.subject, at: a.datetime }));
}

export async function createOrgStack(orgId: string, title: string): Promise<DeckStack> {
  const { boardId, stacks } = await requireBoard(orgId);
  return createStack(client(), boardId, { title, order: stacks.length });
}

export async function renameOrgStack(
  orgId: string,
  stackId: number,
  title: string
): Promise<DeckStack> {
  const { boardId, stacks } = await requireStack(orgId, stackId);
  const stack = stacks.find((s) => s.id === stackId)!;
  return updateStack(client(), boardId, stackId, { title, order: stack.order });
}

export async function deleteOrgStack(orgId: string, stackId: number): Promise<void> {
  const { boardId } = await requireStack(orgId, stackId);
  await deleteStack(client(), boardId, stackId);
}
