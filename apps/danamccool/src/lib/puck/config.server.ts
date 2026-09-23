import { SHARED_BLOCKS } from "@elkdonis/blocks";
import { loadThreadFeed } from "@elkdonis/blocks/server";
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder";
import { currentOrgId } from "@/lib/site-org";
import { SITE_BLOCKS } from "@/blocks";
import { PAGE_SETTINGS, PageSettingsWrap } from "@/lib/puck/page-settings";
import { listWriting } from "@elkdonis/services";
import { getSiteOwnerUserId } from "@/lib/auth";
import { boundIds, loadArtworks, loadArtworksByIds, loadGalleryGrid, loadGalleryWorks, loadNestedGalleries } from "@/lib/artworks";
import { opensIds } from "@/blocks/nested";

// ============================================================================
// The catalogue as a PUBLISHED page sees it.
//
// Same blocks, same fields, no field controls — a published page renders no
// panel, so the picker and the slider stay out of this graph and out of every
// visitor's bundle.
// ============================================================================

/**
 * The published page's resolvers — the same feed, read straight from the
 * database. `<Render>` applies no defaults and runs no resolvers of its own,
 * which is why every route that renders a page calls `resolveAllData` first;
 * without it a feed would publish whatever happened to be in the document when
 * it was saved.
 */
const serverResolvers: BlockResolvers = {
  "thread-feed": async (props) => {
    const items = await loadThreadFeed(currentOrgId(), {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    });
    return { items };
  },
  // Bound artworks: the page stores only ids, and the record is read here,
  // at render, so a retitled or sold piece is right on every page.
  "dm-artwork-wall": async (props, metadata) => {
    const bound = await loadArtworksByIds(boundIds(props));
    if (props.source === "chosen") return { items: [], bound };
    if (props.source === "gallery") {
      return {
        bound,
        items: await loadGalleryWorks({
          galleryId: typeof props.gallery === "string" && props.gallery ? props.gallery : undefined,
          pagePath: typeof metadata.slug === "string" ? metadata.slug : undefined,
          limit: typeof props.limit === "number" ? props.limit : 24,
        }),
      };
    }
    return {
      bound,
      items: await loadArtworks({
        collection: typeof props.collection === "string" ? props.collection : undefined,
        limit: typeof props.limit === "number" ? props.limit : 24,
        includePortfolio: props.includePortfolio !== false,
      }),
    };
  },
  "dm-plate": async (props) => ({ bound: await loadArtworksByIds(boundIds(props)) }),
  "dm-image-set": async (props) => {
    const [bound, nested] = await Promise.all([loadArtworksByIds(boundIds(props)), loadNestedGalleries(opensIds(props))]);
    return { bound, nested };
  },
  "dm-circle-text": async (props) => ({ bound: await loadArtworksByIds(boundIds(props)) }),
  // Editable only on the published page, for a signed-in editor — the route
  // puts `canEdit` in the metadata. See blocks/gallery-grid.tsx.
  "dm-gallery-grid": async (props, metadata) => {
    const editable = metadata.canEdit === true;
    const { galleryId, title, items } = await loadGalleryGrid({
      galleryId: typeof props.gallery === "string" && props.gallery ? props.gallery : undefined,
      pagePath: typeof metadata.slug === "string" ? metadata.slug : undefined,
      editable,
    });
    const nested = await loadNestedGalleries(items.map((i) => i.opens));
    return { galleryId, galleryTitle: title, items, nested, editable };
  },
  // Published pieces only — drafts are for /blog, signed in.
  "dm-writing-shelf": async (props) => {
    const owner = await getSiteOwnerUserId();
    const limit = typeof props.limit === "number" ? props.limit : 5;
    return { items: owner ? await listWriting(owner, { limit }) : [] };
  },
};

export const serverPuckConfig = buildPuckConfig({
  resolvers: serverResolvers,
  blocks: [...SHARED_BLOCKS, ...SITE_BLOCKS],
  // The page's own settings (fonts) — see lib/puck/page-settings.tsx.
  root: { props: PAGE_SETTINGS, wrap: PageSettingsWrap },
});
