import { wordArtRoutes } from "@elkdonis/services/wordart-routes";
import { getCurrentUser } from "@/lib/session";

/**
 * Generated word art (packages/services/src/wordart-routes.ts).
 * GET: the signed-in person's targets, choices and recent pictures.
 * POST { orgId, text, pins? }: queue one; returns { jobId, job }.
 */
export const dynamic = "force-dynamic";
const routes = wordArtRoutes({ who: async () => (await getCurrentUser())?.id ?? null });
export const GET = routes.generate.GET;
export const POST = routes.generate.POST;
