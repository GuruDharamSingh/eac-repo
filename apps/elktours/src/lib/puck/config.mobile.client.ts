"use client";

import { templateEditorResolvers } from "@/blocks/template/resolvers";
import type { Block } from "@elkdonis/blocks";
import { contractOf } from "@elkdonis/blocks/contract";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildEditorConfig, buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { MOBILE_BLOCKS } from "./catalogue";
import { PICTURE_LIBRARIES } from "../media-libraries-config";
import { mobileFeedAction, mobilePlacesAction } from "./mobile-overlay-actions";
import { mobileButtonsAction } from "./mobile-buttons-actions";
import { mobileExperiencesPickAction, mobileGuidesPickAction, mobileMenuAction, mobileShelfAction } from "./mobile-pick-actions";
import { referenceString } from "./reference-fields";
import { mobileContentAction, mobileDiscoverAction, mobileExpSampleAction, mobileToursAction, mobileTourSampleAction } from "./mobile-actions";

// The phone documents as the editors see them (G2): /studio/m-<name>. Separate from config.client.ts so the desktop
// editors are untouched. The palette offers only MOBILE_BLOCKS and the box blocks.

const blocks = [...MOBILE_BLOCKS, ...(BOX_BLOCKS as unknown as Block<never>[])];
const studioBlocks = blocks.filter((b) => b.def.id !== "part");

/** The block popup draws with the published shape (no resolvers; the page hands it what is stored). */
export const mobileCanvasConfig = buildPuckConfig({ blocks, root: BOX_ROOT, morph: MorphMark });
export const mobileCanvasContract = contractOf(MOBILE_BLOCKS);

/** In the browser the resolvers run through the editors' action: the same answer a visitor's page gets. */
const resolvers: BlockResolvers = {
  ...templateEditorResolvers,
  "m-page-title": async (props) => {
    const { count, rows } = await mobileToursAction();
    return { count, cover: props.coverBackground ? (rows.find((r) => r.img)?.img ?? null) : null };
  },
  "m-tour-list": async () => {
    const { rows, count } = await mobileToursAction();
    return { rows, count };
  },
  "m-places-catalogue": async () => { const d = await mobilePlacesAction(); return { rows: d.rows, tags: d.tags, favouriteCount: d.favouriteCount }; },
  "m-feed-list": async () => ({ rows: (await mobileFeedAction()).rows }),
  "m-experience-list": async () => ({ experiences: (await mobileContentAction()).experiences }),
  "m-artists-row": async () => ({ artists: (await mobileContentAction()).artists }),
  "m-people-grid": async () => ({ people: (await mobileContentAction()).people }),
  "m-people-slider": async () => ({ people: (await mobileContentAction()).people }),
  ...Object.fromEntries(["m-exp-hero", "m-exp-facts", "m-exp-body", "m-exp-tours", "m-exp-dates", "m-exp-private"].map((id) => [id, async () => ({ exp: await mobileExpSampleAction() })])),
  "m-masthead": async () => ({ viewer: (await mobileDiscoverAction()).viewer }),
  "m-featured-tour": async (props) => {
    const d = await mobileDiscoverAction();
    const slug = typeof props.tourSlug === "string" ? props.tourSlug : "";
    return { featured: (slug && d.featuredBySlug[slug]) || d.featuredDefault };
  },
  "m-places-shelf": async (props) => mobileShelfAction(props),
  "m-experiences-panel": async (props) => ({ experiences: await mobileExperiencesPickAction(props) }),
  "m-guides": async (props) => ({ guides: await mobileGuidesPickAction(props) }),
  "m-page-buttons": async (props) => ({ shown: await mobileButtonsAction(props.buttons, props.accountLabel) }),
  "m-phone-menu": async (props) => ({ shown: await mobileMenuAction(props.items) }),
  "m-link-rows": async () => { const d = await mobileDiscoverAction(); return { feed: d.feed, placesCount: d.placesCount, viewer: d.viewer }; },
  ...Object.fromEntries(["m-tour-topbar", "m-tour-hero", "m-tour-head", "m-tour-blurb", "m-tour-meet", "m-tour-route", "m-tour-dates", "m-tour-bookbar"].map((id) => [id, async () => ({ tour: await mobileTourSampleAction() })])),
};

export const mobilePuckConfig = buildEditorConfig({
  resolvers,
  blocks: studioBlocks,
  morph: MorphMark,
  root: BOX_ROOT,
  // Place, cover, guide, experience and tour references are chosen from lists, not typed (2026-11-21).
  fields: { string: referenceString },
  media: {
    uploadEndpoint: "/api/upload",
    libraries: PICTURE_LIBRARIES,
  },
});
