import type { HubView } from "@elkdonis/cms-ui/hubsite";

/**
 * The hub layouts IFAC offers, in toggle order. "cards2" (cards that open
 * pages, after innergathering's) was added 2026-10-10 and is the default
 * since 2026-10-18 (developer); "classic" and "site" are still one press away
 * and are remembered per browser (hub/page.tsx).
 */
export const HUB_VIEWS: HubView[] = ["cards2", "classic", "site"];
export const DEFAULT_HUB_VIEW: HubView = "cards2";
