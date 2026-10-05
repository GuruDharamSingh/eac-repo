import type { CollectOptions } from "@elkdonis/analytics/server";

/**
 * Collector options shared by the beacon route (app/api/pulse) and the server
 * actions that record events (app/actions.ts), so both credit the same org.
 */
export const analyticsOptions: CollectOptions = { defaultOrgId: "market" };
