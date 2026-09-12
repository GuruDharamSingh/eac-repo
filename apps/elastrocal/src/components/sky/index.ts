/**
 * The sky components come from @elkdonis/sky-ui, shared with the other sites
 * that carry a sky face. All this app adds is where to fetch charts from:
 * its own /api/sky, under this deployment's basePath.
 */
import { setSkyEndpoint } from "@elkdonis/sky-ui";
import { withBase } from "@/lib/base-path";

setSkyEndpoint(withBase("/api/sky"));

export { ChartWheel, SkyControls, SkyFace, SkyHeader, SkyList, SkyPanel, SkySurface, useSky } from "@elkdonis/sky-ui";
