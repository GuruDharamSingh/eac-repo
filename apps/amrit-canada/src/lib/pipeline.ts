import { getAdminClient, getBoardWithStacks, moveCard, type DeckBoardDetail } from "@elkdonis/nextcloud";

/**
 * The Pipeline hub tile surfaces a real, existing Nextcloud Deck board
 * ("Agenda", owned by stephan, shared with the whole Elkdonis group) rather
 * than a parallel one. An env var, never a literal in code: this points at
 * someone else's live board, which could be recreated with a new id
 * independent of any deploy here.
 */
export const PIPELINE_BOARD_ID = Number(process.env.NEXTCLOUD_PIPELINE_BOARD_ID ?? 14);

/**
 * Server-side kill switch for card moves — checked here, not just hidden in
 * the UI, so a direct fetch to the reorder route can't bypass it. Off by
 * default: this board has real, currently-used content belonging to someone
 * else, so the read path ships and gets verified live before any write path
 * touches it. Flip the env var when ready — no code change needed.
 */
export const pipelineWritesEnabled = (): boolean =>
  process.env.NEXTCLOUD_PIPELINE_WRITES_ENABLED === "true";

export async function getPipelineBoard(): Promise<DeckBoardDetail> {
  return getBoardWithStacks(getAdminClient(), PIPELINE_BOARD_ID);
}

export async function movePipelineCard(
  fromStackId: number,
  cardId: number,
  toStackId: number,
  order: number
) {
  return moveCard(getAdminClient(), PIPELINE_BOARD_ID, fromStackId, cardId, {
    stackId: toStackId,
    order,
  });
}
