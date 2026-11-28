import { wordArtRoutes } from "@elkdonis/services/wordart-routes";
import { getCurrentUser } from "@/lib/session";

/** GET /api/wordart/generate/<jobId>: one of the signed-in person's pictures, with its status. */
export const dynamic = "force-dynamic";
const routes = wordArtRoutes({ who: async () => (await getCurrentUser())?.id ?? null });
export const GET = routes.job.GET;
