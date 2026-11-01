import { connectionsHandlers } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";

/**
 * The signed-in person's own OAuth connections (Facebook & Instagram,
 * Threads, YouTube), for the Connections tab of "View profile" on /center
 * (2026-10-31). Self only; services/connections.ts scopes every query to
 * the acting user. Consent itself runs on the network host
 * (arts-collective /api/connections/start). Migration 192.
 */
export const dynamic = "force-dynamic";

const handlers = connectionsHandlers(async () => (await getViewer())?.userId ?? null);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
