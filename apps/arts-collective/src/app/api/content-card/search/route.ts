import { contentRoutes } from "@elkdonis/content/routes";
import { contentCardHost } from "@/lib/content-card-host";

export const dynamic = "force-dynamic";

/**
 * GET /api/content-card/search: the Content card's search. The same route as /api/content/search, but on the card's
 * host, so a file in the viewer's own or team folder comes back with its source key (`mine`, `org:<id>`) and a path
 * below that root (the card's Delete and the Files view need both). Rights are the route's: the session only.
 */
export const GET = contentRoutes(contentCardHost).search;
