import {
  addOrgCardAttachment,
  createOrgCard,
  createOrgCardComment,
  createOrgStack,
  deleteOrgCard,
  deleteOrgCardComment,
  deleteOrgStack,
  ensureOrgDeckBoard,
  getOrgDeckBoard,
  listOrgArchivedCards,
  listOrgCardActivity,
  listOrgCardAttachments,
  listOrgCardComments,
  listOrgDeckAssignees,
  moveOrgCard,
  readOrgCardAttachment,
  removeOrgCardAttachment,
  renameOrgStack,
  setOrgCardArchived,
  setOrgCardAssignee,
  setOrgCardDone,
  setOrgCardLabel,
  updateOrgCard,
  type OrgDeckBoard,
} from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * The Pipeline hub tile renders THIS org's Nextcloud Deck board.
 *
 * It used to render whatever board `NEXTCLOUD_PIPELINE_BOARD_ID` pointed at,
 * which in every deployment resolved to board 14 — a board owned by another
 * member and shared with the whole `Elkdonis Arts Collective` group. So this
 * org's hub showed another org's cards, and pointing a second site at the
 * same env var would have shown them the same ones. The board is now a
 * property of the org (`organizations.deck_board_id`, migration 101) and every
 * call below resolves it from siteConfig.orgId; no board id crosses the wire.
 */
const ORG = siteConfig.orgId;

export type { OrgDeckBoard };

export function getPipelineBoard(): Promise<OrgDeckBoard | null> {
  return getOrgDeckBoard(ORG);
}

export function provisionPipelineBoard(): Promise<number> {
  return ensureOrgDeckBoard(ORG);
}

export function createPipelineCard(input: {
  stackId: number;
  title: string;
  description?: string;
  duedate?: string | null;
}) {
  return createOrgCard(ORG, input);
}

export function movePipelineCard(cardId: number, toStackId: number, order: number) {
  return moveOrgCard(ORG, cardId, toStackId, order);
}

export function updatePipelineCard(
  cardId: number,
  patch: { title?: string; description?: string; duedate?: string | null; archived?: boolean }
) {
  return updateOrgCard(ORG, cardId, patch);
}

export function deletePipelineCard(cardId: number) {
  return deleteOrgCard(ORG, cardId);
}

export function setPipelineCardLabel(cardId: number, labelId: number, assigned: boolean) {
  return setOrgCardLabel(ORG, cardId, labelId, assigned);
}

export function createPipelineStack(title: string) {
  return createOrgStack(ORG, title);
}

export function renamePipelineStack(stackId: number, title: string) {
  return renameOrgStack(ORG, stackId, title);
}

export function deletePipelineStack(stackId: number) {
  return deleteOrgStack(ORG, stackId);
}

export function setPipelineCardDone(cardId: number, done: boolean) {
  return setOrgCardDone(ORG, cardId, done);
}

export function setPipelineCardArchived(cardId: number, archived: boolean) {
  return setOrgCardArchived(ORG, cardId, archived);
}

export function listPipelineAssignees() {
  return listOrgDeckAssignees(ORG);
}

export function setPipelineCardAssignee(cardId: number, userId: string, assigned: boolean) {
  return setOrgCardAssignee(ORG, cardId, userId, assigned);
}

export function listPipelineComments(cardId: number) {
  return listOrgCardComments(ORG, cardId);
}

export function addPipelineComment(cardId: number, authorName: string, message: string) {
  return createOrgCardComment(ORG, cardId, authorName, message);
}

export function deletePipelineComment(cardId: number, commentId: number) {
  return deleteOrgCardComment(ORG, cardId, commentId);
}

export function listPipelineAttachments(cardId: number) {
  return listOrgCardAttachments(ORG, cardId);
}

export function addPipelineAttachment(
  cardId: number,
  file: { filename: string; content: Buffer; contentType?: string }
) {
  return addOrgCardAttachment(ORG, cardId, file);
}

export function readPipelineAttachment(cardId: number, attachmentId: number) {
  return readOrgCardAttachment(ORG, cardId, attachmentId);
}

export function removePipelineAttachment(cardId: number, attachmentId: number) {
  return removeOrgCardAttachment(ORG, cardId, attachmentId);
}

export function listPipelineActivity(cardId: number) {
  return listOrgCardActivity(ORG, cardId);
}

export function listPipelineArchivedCards() {
  return listOrgArchivedCards(ORG);
}
