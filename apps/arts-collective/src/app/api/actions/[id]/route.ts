import { actionHttp } from "@/lib/actions/routes";

/**
 * GET  /api/actions/<id>?org=<orgId>  the entry's status for the signed-in person (reads only).
 * POST /api/actions/<id>              perform it; JSON body { input?, org? }, same-origin only.
 */
export const dynamic = "force-dynamic";
export const GET = actionHttp.entry.GET;
export const POST = actionHttp.entry.POST;
