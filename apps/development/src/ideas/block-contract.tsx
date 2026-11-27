import { BlockContract } from "./block-contract/BlockContract";
import type { Idea } from "./types";

// Metadata lives here, in a server file; the page itself is a client component (it keeps its answers in the browser).
// Source: docs/open/BLOCK_CONTRACT_2026-11-23/ (CONTRACT.md is the proposal). Numbers: src/data/block-contract.json.

const idea: Idea = {
  slug: "block-contract",
  title: "The block contract",
  summary:
    "A block is code. This is the written agreement between a block and the editor: what a block tells the editor, what the editor may do, six stages a block grows through, and every one of the blocks measured against it. Includes a clickable mock of the live editor's cursor toolbar and pencils. Nothing here changes a site.",
  status: "proposal",
  added: "2026-11-23",
  refs: [
    "docs/open/BLOCK_CONTRACT_2026-11-23/CONTRACT.md",
    "apps/development/scripts/refresh-block-contract.mjs",
    "packages/blocks/src/types.ts",
    "packages/house-editor/src/steps",
  ],
  Component: () => <BlockContract />,
};

export default idea;
