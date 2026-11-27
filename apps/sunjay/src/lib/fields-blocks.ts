// Block content for the Fields lens on Para Theater (live editor, 2026-11-20). Server only.
//
// `blockFieldMap` says which part of which block a person may type into (from the blocks' own declarations: a part with
// a `prop`); it goes to the lens on the page. `blockFields` is the server door that loads a block's words and saves a
// change as ONE `set_prop` step (@elkdonis/house-editor/steps), through this site's gated page save.

import { contractOf } from "@elkdonis/blocks/contract";
import { createBlockFields } from "@elkdonis/house-editor/fields/server";
import { sanitizePageText } from "@elkdonis/utils/sanitize";
import { serverBlocks, serverPuckConfig } from "@/lib/puck/config.server";
import { savePageAction } from "@/lib/puck/actions";
import { loadPageWithVersion } from "@/lib/puck/store";

const contracts = contractOf(serverBlocks);

export const blockFields = createBlockFields({
  contracts,
  config: serverPuckConfig,
  loadPage: (slug) => loadPageWithVersion(slug),
  // The page save is the one the editors use: editors only, the slug rules, the resolver keys stripped, revalidated.
  save: savePageAction,
  // Formatted text (Text, Text with picture) is offered on the page and cleaned by the same sanitiser the blocks draw it through.
  sanitizeRichText: sanitizePageText,
});

// What the lens may change on a page, from the blocks' own declarations (and, because a cleaner is given, formatted text too).
export const blockFieldMap = blockFields.map;
