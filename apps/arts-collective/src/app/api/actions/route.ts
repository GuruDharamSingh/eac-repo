import { actionHttp } from "@/lib/actions/routes";

/** GET /api/actions — the registry's catalogue; runnable entries carry their input as JSON Schema. Public. */
export const dynamic = "force-dynamic";
export const GET = actionHttp.catalogue.GET;
