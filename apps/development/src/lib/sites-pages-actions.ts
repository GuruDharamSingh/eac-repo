"use server";

// ============================================================================
// What an admin can do to the development organisation's own pages (lane DEV, wave 2).
//
//   createPageAction   start a new page as a draft (never live until it is published, from the Sites tab)
//   pagesFieldsLoad    the live editor on /pages/<slug>: a block's words, and the page's version
//   pagesFieldsSave    the live editor: a word typed on the page, saved as ONE `set_prop` step through
//                      the one door, onto the published page, with the stale-save guard
//
// Every action calls the admin gate first (adminOrThrow -> getNetworkAdmin) and the lens's own `authorize` calls it
// again. The organisation is always `development`, never taken from the request. The save is the house
// `createSavePageAction`: gate, slug rules, resolver keys stripped, then the page store's `savePage` WITH the version
// the screen opened (an older screen is refused as stale and writes nothing).
// ============================================================================

import { loadPageWithVersion, savePage, isValidPagePath } from "@elkdonis/page-builder/server";
import { createFieldsActions, defineFields } from "../../../../packages/house-editor/src/fields/server";
import { createBlockFields } from "../../../../packages/house-editor/src/fields/blocks";
import { createSavePageAction } from "../../../../packages/house-editor/src/save";
import { getNetworkAdmin } from "./gate";
import { adminOrThrow } from "./sites";
import { checkable } from "./sites-contracts";
import { DEV_ORG, createDraftPage, slugOfTitle } from "./sites-pages-core";

const saveLive = createSavePageAction({
  orgId: DEV_ORG,
  gate: () => getNetworkAdmin(),
  denied: "Only network admins can change these pages.",
  slugProblem: (slug) => (isValidPagePath(slug) ? null : "That page name is not usable."),
  store: savePage,
});

const blockFields = () => {
  const { contracts, config } = checkable();
  return createBlockFields({
    contracts,
    config,
    loadPage: (slug) => loadPageWithVersion(DEV_ORG, slug),
    save: saveLive,
  });
};

const lens = () =>
  createFieldsActions({
    registry: defineFields({}),
    authorize: async () => ((await getNetworkAdmin()) ? true : "Only network admins can change these pages."),
    routes: {},
    blocks: blockFields(),
  });

export async function createPageAction(title: string) {
  const admin = await adminOrThrow();
  const slug = slugOfTitle(title);
  if (!slug) return { ok: false, say: "Give the page a name, using letters or numbers.", slug: null as string | null };
  // The label names the door, not the person: no address is kept in a page's draft.
  const made = await createDraftPage(DEV_ORG, slug, title, { id: admin.userId, kind: "person", label: "Network admin, development app" });
  return { ok: made.ok, say: made.say, slug: made.ok ? slug : null };
}

export async function pagesFieldsLoad(args: { kind: string; id: string }) {
  await adminOrThrow();
  return lens().load(args);
}

export async function pagesFieldsSave(input: { kind: string; id: string; values: Record<string, string>; version?: string }) {
  await adminOrThrow();
  return lens().save(input);
}
