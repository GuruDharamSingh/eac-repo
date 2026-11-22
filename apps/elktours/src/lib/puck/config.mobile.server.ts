import { templateServerResolvers } from "@/blocks/template/resolvers";
import type { Block } from "@elkdonis/blocks";
import { BOX_BLOCKS, BOX_ROOT } from "@elkdonis/direct-edit/puck/blocks";
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder/config";
import { MOBILE_BLOCKS } from "./catalogue";
import { toursFor } from "./mobile-data";
import { discoverFor } from "./mobile-discover";
import { mobileFeaturedMap, tourFor } from "./mobile-tour";
import { contentFor, expFor } from "./mobile-content";
import { feedFor, placesFor } from "./mobile-places";
import { experiencesFor, guidesFor, shelfFor } from "./mobile-pick";
import { shownButtons } from "./mobile-buttons";
import { shownMenu } from "./mobile-menu";

/**
 * The catalogue a published phone document draws with (G2): the phone blocks plus the box blocks, nothing from
 * PAGE_BLOCKS beyond the generic text ones MOBILE_BLOCKS names. Separate from serverPuckConfig so the desktop draw
 * is untouched. Server only: the resolvers reach the database.
 */
const resolvers: BlockResolvers = {
  ...templateServerResolvers,
  "m-page-title": async (props, metadata) => {
    const { count, rows } = await toursFor(metadata);
    return { count, cover: props.coverBackground ? (rows.find((r) => r.img)?.img ?? null) : null };
  },
  "m-tour-list": async (_props, metadata) => {
    const { rows, count } = await toursFor(metadata);
    return { rows, count };
  },
  // Discover (G3a): one read of the screen, each block takes its share.
  "m-masthead": async (_p, metadata) => ({ viewer: (await discoverFor(metadata)).viewer }),
  "m-featured-tour": async (props, metadata) => {
    const d = await discoverFor(metadata);
    const slug = typeof props.tourSlug === "string" ? props.tourSlug : "";
    const featured = (slug && d.featuredBySlug[slug]) || d.featuredDefault;
    // No cover photo: the card plays the tour's 3D route (developer, 2026-11-17).
    if (featured && !featured.img) return { featured: { ...featured, map: await mobileFeaturedMap(featured.slug) } };
    return { featured };
  },
  "m-places-shelf": async (props, metadata) => shelfFor(props, metadata),
  "m-experiences-panel": async (props, metadata) => ({ experiences: await experiencesFor(props, metadata) }),
  "m-guides": async (props, metadata) => ({ guides: await guidesFor(props, metadata) }),
  // Who sees which button / menu item is decided here, from the session (lib/puck/mobile-buttons.ts).
  "m-page-buttons": async (props, metadata) => ({ shown: await shownButtons(props.buttons, props.accountLabel, metadata), afterFeed: Boolean((metadata?.mobileDiscover as { feed?: unknown } | undefined)?.feed) }),
  "m-phone-menu": async (props) => ({ shown: await shownMenu(props.items) }),
  "m-link-rows": async (_p, metadata) => { const d = await discoverFor(metadata); return { feed: d.feed, placesCount: d.placesCount, viewer: d.viewer }; },
  // Places catalogue and Feed (G5/G6).
  "m-places-catalogue": async (_p, metadata) => { const d = await placesFor(metadata); return { rows: d.rows, tags: d.tags, favouriteCount: d.favouriteCount }; },
  "m-feed-list": async (_p, metadata) => ({ rows: (await feedFor(metadata)).rows }),
  // Experiences, people, About (G4).
  "m-experience-list": async (_p, metadata) => ({ experiences: (await contentFor(metadata)).experiences }),
  "m-artists-row": async (_p, metadata) => ({ artists: (await contentFor(metadata)).artists }),
  "m-people-grid": async (_p, metadata) => ({ people: (await contentFor(metadata)).people }),
  "m-people-slider": async (_p, metadata) => ({ people: (await contentFor(metadata)).people }),
  ...Object.fromEntries(["m-exp-hero", "m-exp-facts", "m-exp-body", "m-exp-tours", "m-exp-dates", "m-exp-private"].map((id) => [id, async (_p: Record<string, unknown>, metadata: Record<string, unknown>) => ({ exp: await expFor(metadata) })])),
  // Tour template (G3a): the tour comes from the page (metadata.mobileTour), else a sample in the Studio.
  ...Object.fromEntries(["m-tour-topbar", "m-tour-hero", "m-tour-head", "m-tour-blurb", "m-tour-meet", "m-tour-route", "m-tour-dates", "m-tour-bookbar"].map((id) => [id, async (_p: Record<string, unknown>, metadata: Record<string, unknown>) => ({ tour: await tourFor(metadata) })])),
};

export const mobileServerConfig = buildPuckConfig({
  blocks: [...(BOX_BLOCKS as unknown as Block<never>[]), ...MOBILE_BLOCKS],
  root: BOX_ROOT,
  resolvers,
  morph: MorphMark,
});
