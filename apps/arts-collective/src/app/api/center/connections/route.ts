import { connectionsHandlers } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

/**
 * The profile popup's "Connections" tab: the signed-in person's own OAuth
 * links (YouTube). Self only; services/connections.ts scopes every query to
 * the acting user. Migration 192.
 */
export const dynamic = "force-dynamic";

const handlers = connectionsHandlers(async () => (await getCurrentUser())?.id ?? null);
export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
