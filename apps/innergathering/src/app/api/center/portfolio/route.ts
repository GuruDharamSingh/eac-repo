import { sitePortfolioRoutes } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * This site's own portfolio of a person (org_profiles.portfolio, migration
 * 264), chosen on their person page with SitePortfolioEditor: the library to
 * pick from (GET), save (PUT), upload into their own folder (POST). The
 * person or a global admin only; the factory checks.
 * docs/open/MEDIA_OWNERSHIP_AND_PLACEMENT_2026-11-11.md
 */
export const dynamic = "force-dynamic";

const r = sitePortfolioRoutes({ orgId: siteConfig.orgId, who: async () => (await getViewer())?.userId ?? null });
export const GET = r.GET;
export const PUT = r.PUT;
export const POST = r.POST;
