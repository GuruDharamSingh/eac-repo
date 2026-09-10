// ============================================================================
// @elkdonis/forum-ui — The Grand Forum, as a package.
//
//   import "@elkdonis/cms-ui/surface.css";
//   import "@elkdonis/forum-ui/forum.css";
//   import { renderForumRoute, serviceConnectors, networkHrefs } from "@elkdonis/forum-ui";
//
// A host writes one catch-all route that calls renderForumRoute with its
// connectors. apps/forum does so for every org; an org site does so scoped to
// itself at /forum. Every page here is a server component — no hooks, no
// client state — and reads only the connectors, never a database or a route.
// See GRAND_FORUM_PLAN.md.
// ============================================================================

export { renderForumRoute } from "./routes";
export type { ForumRouteContext } from "./routes";

export { serviceConnectors, networkHrefs, orgHrefs } from "./connectors";
export type { ForumConnectors, ForumHrefs, ForumWriteConnectors, ServiceConnectorOptions } from "./connectors";

export { handleForumAction } from "./actions";
export { NotificationsBell } from "./bell";
export { SearchBox } from "./search";
export type { ForumActionName, HandleActionOptions } from "./actions";

export { timeAgo, fullStamp } from "./format";
export { configureForumMedia, mediaUrl } from "./media";

export { forumSnapshot } from "./snapshot";
export type { ForumSnapshotOptions } from "./snapshot";
