import { loadThreadFeed } from "@elkdonis/blocks/server";
// The /config entry, not the package's main: that also exports Puck's editor,
// and a server page importing it sends those scripts to every visitor.
import { buildPuckConfig, type BlockResolvers } from "@elkdonis/page-builder/config";
// Server-safe: draws a block's stored look (`morph`); with none set the markup is unchanged.
import { MorphMark } from "@elkdonis/direct-edit/puck/morph";
import { currentOrgId } from "@/lib/site-org";
import { CATALOGUE } from "@/lib/puck/catalogue";
import { loadCourse } from "@/lib/course";
import { figurePlacement } from "@/blocks/enneagram-block";
import { loadShelf } from "@/lib/shelf";
import { loadForumTopics, loadPerson, loadPersonPage, loadPostBlock, loadServiceBlock } from "@/lib/record-blocks";

// ============================================================================
// The catalogue as a PUBLISHED page sees it: same blocks, resolvers that read
// the database directly. `<Render>` applies no defaults and runs no
// resolvers, so every route that draws a page calls `resolveAllData` first
// (lib/puck/render.tsx). Importing this pulls @elkdonis/db in; nothing a
// client component imports may reach it.
// ============================================================================

const serverResolvers: BlockResolvers = {
  // Where the figure sits decides its reader when Reader is "auto".
  "he-enneagram": async (_props, metadata) => ({ placement: figurePlacement(metadata.placement) }),
  // Ario's course: the published version's modules and step count.
  "he-course": async () => ({ course: await loadCourse() }),
  "thread-feed": async (props) => ({
    items: await loadThreadFeed(currentOrgId(), {
      limit: typeof props.limit === "number" ? props.limit : 10,
      upcomingOnly: true,
    }),
  }),
  // Round 3: the records the quiet pages frame.
  "he-shelf": async (props) => ({ items: await loadShelf(props) }),
  "he-forum": async (props) => ({ topics: await loadForumTopics(props.limit) }),
  // Round 6: layout "page" is the /about/<slug> template (routeSlug injected by the route).
  "he-person": async (props) =>
    props.layout === "page"
      ? { person: null, page: await loadPersonPage(typeof props.routeSlug === "string" ? props.routeSlug : props.slug) }
      : { person: await loadPerson(props.slug) },
  "he-service": async (props) => loadServiceBlock(props),
  // Round 6: the /<feed>/<slug> template (routeFeed + routeSlug injected by the route).
  "he-post": async (props) => loadPostBlock(props),
};

export const serverPuckConfig = buildPuckConfig({
  resolvers: serverResolvers,
  blocks: CATALOGUE,
  morph: MorphMark,
});
