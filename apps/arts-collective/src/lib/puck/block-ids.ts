// The data blocks on an org landing page, by id. A module of its own, with
// no imports, because the EDITOR config (a client module) needs this list and
// the loader beside it imports @elkdonis/blocks/server, which pulls the
// database client into any bundle that reaches it.
export const BLOCK_DATA_IDS = ["thread-feed", "ac-offering", "ac-people"] as const;
export type BlockDataId = (typeof BLOCK_DATA_IDS)[number];

export function isBlockDataId(id: string): id is BlockDataId {
  return (BLOCK_DATA_IDS as readonly string[]).includes(id);
}
