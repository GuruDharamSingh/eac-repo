import { centerRoutes } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * The Connections tab of "View profile" on /center, from the shared Center
 * route factory (2026-11-01). Self only; consent runs on the network host.
 */
export const dynamic = "force-dynamic";

const { connections } = centerRoutes({ who: async () => (await getViewer())?.userId ?? null });
export const GET = connections.GET;
export const POST = connections.POST;
export const PATCH = connections.PATCH;
export const DELETE = connections.DELETE;
