// The Outlets page's tabs. A plain module (no "use client"): the server page
// validates ?tab= against it, and a constant imported from a client module
// reaches a server component as a reference, not the array (2026-11-07: that
// 500'd /channel/outlets in production).
export const OUTLET_TABS = ["site", "instagram", "facebook", "threads", "youtube", "live", "newsletter"] as const;
export type OutletTab = (typeof OUTLET_TABS)[number];
